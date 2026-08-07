/**
 * PrefetchManager - Manages prefetch queue with priority and cancellation
 * 
 * Implements Requirements 3.1, 3.2, 3.3, 3.4, 3.5:
 * - Prefetch products for visible wholesaler cards
 * - Priority prefetch on long-press
 * - Fetch only critical data fields
 * - Queue size management with priority
 * - Network-adaptive prefetching
 */

import { supabase } from '../supabase/supabase';
import { NetworkQualityService, type NetworkQuality } from '../network/NetworkQualityService';
import { ProductCacheService, type Product } from './ProductCacheService';

// Critical data fields for prefetch - Requirements 3.3, 5.2
export const CRITICAL_FIELDS = [
  'id',
  'name',
  'price',
  'image_url',
  'min_quantity',
  'unit',
  'seller_id',
] as const;

export type CriticalProduct = Pick<Product, typeof CRITICAL_FIELDS[number]>;

export type PrefetchPriority = 'low' | 'high';

export interface PrefetchRequest {
  sellerId: string;
  priority: PrefetchPriority;
  timestamp: number;
  abortController: AbortController;
  status: 'pending' | 'fetching' | 'completed' | 'cancelled';
}

export interface PrefetchManagerConfig {
  maxQueueSize: number;
  defaultLimit: number;
  enableLogging: boolean;
}

const DEFAULT_CONFIG: PrefetchManagerConfig = {
  maxQueueSize: 3,      // Max 3 concurrent prefetch requests - Requirements 3.4
  defaultLimit: 20,     // Default product limit per prefetch
  enableLogging: true,
};

type PrefetchCallback = (sellerId: string, success: boolean) => void;

class PrefetchManagerClass {
  private queue: Map<string, PrefetchRequest> = new Map();
  private config: PrefetchManagerConfig;
  private callbacks: Set<PrefetchCallback> = new Set();
  private networkUnsubscribe: (() => void) | null = null;
  private currentNetworkQuality: NetworkQuality = 'fast';

  constructor(config: Partial<PrefetchManagerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initNetworkListener();
  }

  /**
   * Initialize network quality listener
   */
  private initNetworkListener(): void {
    this.networkUnsubscribe = NetworkQualityService.subscribe((state) => {
      this.currentNetworkQuality = state.quality;
      
      // Cancel all low-priority prefetches when network becomes slow
      if (state.quality === 'slow' || state.quality === 'offline') {
        this.cancelLowPriorityRequests();
      }
    });
  }

  /**
   * Log message if logging is enabled
   */
  private log(message: string, data?: Record<string, unknown>): void {
    if (this.config.enableLogging) {
      console.log(`[PrefetchManager] ${message}`, data || '');
    }
  }

  /**
   * Add to prefetch queue - Requirements 3.1, 3.2
   * @param sellerId - Seller ID to prefetch products for
   * @param priority - Priority level ('low' for automatic, 'high' for user-triggered)
   */
  prefetch(sellerId: string, priority: PrefetchPriority = 'low'): void {
    // Check network conditions - Requirements 3.5
    if (this.currentNetworkQuality === 'offline') {
      this.log('[PREFETCH:SKIP] Device is offline', { sellerId });
      return;
    }

    // Disable automatic prefetch on slow networks - Requirements 3.5, 5.4
    if (priority === 'low' && this.currentNetworkQuality === 'slow') {
      this.log('[PREFETCH:SKIP] Automatic prefetch disabled on slow network', { sellerId });
      return;
    }

    // Check if already in queue
    const existing = this.queue.get(sellerId);
    if (existing) {
      // Upgrade priority if needed
      if (priority === 'high' && existing.priority === 'low') {
        existing.priority = 'high';
        this.log('[PREFETCH:UPGRADE] Priority upgraded to high', { sellerId });
      }
      return;
    }

    // Manage queue size - Requirements 3.4
    this.manageQueueSize(priority);

    // Create new prefetch request
    const request: PrefetchRequest = {
      sellerId,
      priority,
      timestamp: Date.now(),
      abortController: new AbortController(),
      status: 'pending',
    };

    this.queue.set(sellerId, request);
    this.log('[PREFETCH:QUEUED]', { sellerId, priority, queueSize: this.queue.size });

    // Execute prefetch
    this.executePrefetch(request);
  }

  /**
   * Manage queue size by cancelling oldest low-priority requests - Requirements 3.4
   */
  private manageQueueSize(newPriority: PrefetchPriority): void {
    if (this.queue.size < this.config.maxQueueSize) {
      return;
    }

    // Find oldest low-priority request to cancel
    let oldestLowPriority: PrefetchRequest | null = null;
    let oldestKey: string | null = null;

    for (const [key, request] of this.queue.entries()) {
      if (request.priority === 'low' && request.status !== 'completed') {
        if (!oldestLowPriority || request.timestamp < oldestLowPriority.timestamp) {
          oldestLowPriority = request;
          oldestKey = key;
        }
      }
    }

    // Cancel oldest low-priority request
    if (oldestKey && oldestLowPriority) {
      this.cancel(oldestKey);
      this.log('[PREFETCH:EVICTED] Oldest low-priority request cancelled', {
        evictedSellerId: oldestKey,
        reason: 'Queue full',
      });
    }
  }

  /**
   * Execute prefetch request - Requirements 3.3, 5.2
   * Fetches only critical data fields
   */
  private async executePrefetch(request: PrefetchRequest): Promise<void> {
    const { sellerId, abortController } = request;

    try {
      request.status = 'fetching';
      this.log('[PREFETCH:START]', { sellerId });

      // Check if aborted before starting
      if (abortController.signal.aborted) {
        this.log('[PREFETCH:ABORTED] Request was cancelled before fetch', { sellerId });
        return;
      }

      // Fetch only critical fields - Requirements 3.3, 5.2
      const { data, error } = await supabase
        .from('products')
        .select(CRITICAL_FIELDS.join(', '))
        .eq('seller_id', sellerId)
        .limit(this.config.defaultLimit)
        .abortSignal(abortController.signal);

      // Check if aborted during fetch
      if (abortController.signal.aborted) {
        this.log('[PREFETCH:ABORTED] Request was cancelled during fetch', { sellerId });
        return;
      }

      if (error) {
        throw error;
      }

      // Store in cache via ProductCacheService
      if (data && data.length > 0) {
        // Prefetch stores minimal data, full data will be fetched on navigation
        ProductCacheService.prefetchSellerProducts(sellerId);
        this.log('[PREFETCH:SUCCESS]', { sellerId, productCount: data.length });
      } else {
        this.log('[PREFETCH:EMPTY] No products found', { sellerId });
      }

      request.status = 'completed';
      this.notifyCallbacks(sellerId, true);

    } catch (error: any) {
      if (error.name === 'AbortError' || abortController.signal.aborted) {
        this.log('[PREFETCH:ABORTED]', { sellerId });
        request.status = 'cancelled';
      } else {
        this.log('[PREFETCH:ERROR]', { sellerId, error: error.message });
        request.status = 'cancelled';
        this.notifyCallbacks(sellerId, false);
      }
    } finally {
      // Clean up completed/cancelled requests after a delay
      setTimeout(() => {
        const current = this.queue.get(sellerId);
        if (current && (current.status === 'completed' || current.status === 'cancelled')) {
          this.queue.delete(sellerId);
        }
      }, 1000);
    }
  }

  /**
   * Cancel prefetch for a specific seller
   */
  cancel(sellerId: string): void {
    const request = this.queue.get(sellerId);
    if (request) {
      request.abortController.abort();
      request.status = 'cancelled';
      this.queue.delete(sellerId);
      this.log('[PREFETCH:CANCELLED]', { sellerId });
    }
  }

  /**
   * Cancel all pending prefetches
   */
  cancelAll(): void {
    for (const [sellerId, request] of this.queue.entries()) {
      request.abortController.abort();
      request.status = 'cancelled';
    }
    this.queue.clear();
    this.log('[PREFETCH:CANCELLED_ALL]');
  }

  /**
   * Cancel all low-priority requests (used when network becomes slow)
   */
  private cancelLowPriorityRequests(): void {
    const toCancel: string[] = [];
    
    for (const [sellerId, request] of this.queue.entries()) {
      if (request.priority === 'low' && request.status !== 'completed') {
        toCancel.push(sellerId);
      }
    }

    toCancel.forEach(sellerId => this.cancel(sellerId));
    
    if (toCancel.length > 0) {
      this.log('[PREFETCH:CANCELLED_LOW_PRIORITY]', { count: toCancel.length });
    }
  }

  /**
   * Check if prefetch is in progress for a seller
   */
  isPrefetching(sellerId: string): boolean {
    const request = this.queue.get(sellerId);
    return request?.status === 'pending' || request?.status === 'fetching';
  }

  /**
   * Get current queue size
   */
  getQueueSize(): number {
    return this.queue.size;
  }

  /**
   * Get queue status for debugging
   */
  getQueueStatus(): Array<{ sellerId: string; priority: PrefetchPriority; status: string }> {
    return Array.from(this.queue.entries()).map(([sellerId, request]) => ({
      sellerId,
      priority: request.priority,
      status: request.status,
    }));
  }

  /**
   * Subscribe to prefetch completion events
   */
  onPrefetchComplete(callback: PrefetchCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  /**
   * Notify callbacks of prefetch completion
   */
  private notifyCallbacks(sellerId: string, success: boolean): void {
    this.callbacks.forEach(callback => callback(sellerId, success));
  }

  /**
   * Check if automatic prefetch is allowed based on network
   */
  isAutoPrefetchAllowed(): boolean {
    return this.currentNetworkQuality === 'fast';
  }

  /**
   * Get current network quality
   */
  getNetworkQuality(): NetworkQuality {
    return this.currentNetworkQuality;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.cancelAll();
    this.callbacks.clear();
    if (this.networkUnsubscribe) {
      this.networkUnsubscribe();
      this.networkUnsubscribe = null;
    }
  }
}

// Export singleton instance
export const PrefetchManager = new PrefetchManagerClass();

// Export class for testing
export { PrefetchManagerClass };
