/**
 * RequestQueueManager - Manages request deduplication and cancellation
 * 
 * Implements Requirements 5.1, 5.2, 5.3:
 * - Deduplicate identical requests (same params) to single network call
 * - Cancel pending requests when category changes
 * - Use AbortController for request cancellation
 */

export interface CursorPaginationParams {
  sellerId: string;
  category?: string;
  subcategory?: string;
  searchTerm?: string;
  cursor?: string;
  limit?: number;
}

export interface CursorPaginationResult<T = any> {
  products: T[];
  nextCursor: string | null;
  hasMore: boolean;
  fromCache: boolean;
}

interface QueuedRequest<T> {
  id: string;
  params: CursorPaginationParams;
  abortController: AbortController;
  promise: Promise<CursorPaginationResult<T>>;
  resolve: (result: CursorPaginationResult<T>) => void;
  reject: (error: Error) => void;
  timestamp: number;
}

export interface RequestQueueConfig {
  enableLogging?: boolean;
  requestTimeout?: number;
}

const DEFAULT_CONFIG: RequestQueueConfig = {
  enableLogging: true,
  requestTimeout: 30000, // 30 seconds
};

/**
 * Generate a unique cache key from pagination params
 * Requirements 8.1: Cache key uniqueness
 */
export function generateCacheKey(params: CursorPaginationParams): string {
  const parts = [
    'products',
    params.sellerId,
    params.category || 'all',
    params.subcategory || 'all',
    params.cursor || 'start',
    params.searchTerm ? `search_${params.searchTerm}` : 'nosearch',
    `limit_${params.limit || 20}`,
  ];
  return parts.join('_');
}

class RequestQueueManagerClass<T = any> {
  private queue: Map<string, QueuedRequest<T>> = new Map();
  private inFlight: Map<string, Promise<CursorPaginationResult<T>>> = new Map();
  private config: RequestQueueConfig;


  constructor(config: Partial<RequestQueueConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Log message if logging is enabled
   */
  private log(message: string, data?: Record<string, any>): void {
    if (this.config.enableLogging) {
      console.log(`[RequestQueueManager] ${message}`, data || '');
    }
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Add request to queue with deduplication
   * Requirements 5.1: Deduplicate identical requests
   * 
   * If an identical request is already in-flight, returns the existing promise
   * Otherwise, creates a new request entry
   */
  enqueue(
    params: CursorPaginationParams,
    executor: (signal: AbortSignal) => Promise<CursorPaginationResult<T>>
  ): { promise: Promise<CursorPaginationResult<T>>; requestId: string; abortController: AbortController } {
    const cacheKey = generateCacheKey(params);
    
    // Check if identical request is already in-flight (deduplication)
    const existingRequest = this.queue.get(cacheKey);
    if (existingRequest) {
      this.log('[DEDUP] Returning existing in-flight request', { cacheKey });
      return {
        promise: existingRequest.promise,
        requestId: existingRequest.id,
        abortController: existingRequest.abortController,
      };
    }

    // Create new request
    const requestId = this.generateRequestId();
    const abortController = new AbortController();
    
    let resolvePromise: (result: CursorPaginationResult<T>) => void;
    let rejectPromise: (error: Error) => void;
    
    const promise = new Promise<CursorPaginationResult<T>>((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;
    });

    const queuedRequest: QueuedRequest<T> = {
      id: requestId,
      params,
      abortController,
      promise,
      resolve: resolvePromise!,
      reject: rejectPromise!,
      timestamp: Date.now(),
    };

    this.queue.set(cacheKey, queuedRequest);
    this.inFlight.set(cacheKey, promise);
    
    this.log('[ENQUEUE] Request added to queue', { requestId, cacheKey });

    // Execute the request
    this.executeRequest(cacheKey, queuedRequest, executor);

    return { promise, requestId, abortController };
  }

  /**
   * Execute the queued request
   */
  private executeRequest(
    cacheKey: string,
    request: QueuedRequest<T>,
    executor: (signal: AbortSignal) => Promise<CursorPaginationResult<T>>
  ): void {
    executor(request.abortController.signal)
      .then((result) => {
        // Check if request was cancelled while executing
        if (request.abortController.signal.aborted) {
          this.log('[ABORT:IGNORED] Request completed but was aborted', { requestId: request.id });
          return;
        }

        request.resolve(result);
        this.log('[COMPLETE] Request completed successfully', { requestId: request.id, cacheKey });
      })
      .catch((error) => {
        // Check if this is an abort error - handle silently
        // since cancellation is intentional and not an error condition
        const isAbortError = 
          request.abortController.signal.aborted ||
          (error instanceof Error && error.name === 'AbortError') ||
          (error instanceof DOMException && error.name === 'AbortError') ||
          (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError');
        
        if (isAbortError) {
          this.log('[ABORT:ERROR] Request was aborted', { requestId: request.id });
          // Silently ignore abort errors - they are expected during cancellation
          return;
        }

        request.reject(error instanceof Error ? error : new Error(String(error)));
        this.log('[ERROR] Request failed', { requestId: request.id, error: String(error) });
      })
      .finally(() => {
        // Clean up from queue
        this.queue.delete(cacheKey);
        this.inFlight.delete(cacheKey);
      });
  }

  /**
   * Cancel a specific request by ID
   * Requirements 5.3: Use AbortController for cancellation
   */
  cancel(requestId: string): boolean {
    for (const [cacheKey, request] of this.queue.entries()) {
      if (request.id === requestId) {
        request.abortController.abort();
        this.queue.delete(cacheKey);
        this.inFlight.delete(cacheKey);
        this.log('[CANCEL] Request cancelled by ID', { requestId, cacheKey });
        return true;
      }
    }
    this.log('[CANCEL:NOT_FOUND] Request not found', { requestId });
    return false;
  }

  /**
   * Cancel all requests matching a pattern
   * Requirements 5.2: Cancel pending requests when category changes
   */
  cancelMatching(pattern: { sellerId?: string; category?: string }): number {
    let cancelledCount = 0;
    
    for (const [cacheKey, request] of this.queue.entries()) {
      let shouldCancel = false;
      
      if (pattern.sellerId && request.params.sellerId === pattern.sellerId) {
        // If only sellerId specified, cancel all for that seller
        if (!pattern.category) {
          shouldCancel = true;
        } else if (request.params.category === pattern.category) {
          // If both specified, must match both
          shouldCancel = true;
        }
      } else if (pattern.category && !pattern.sellerId) {
        // If only category specified, cancel all for that category
        if (request.params.category === pattern.category) {
          shouldCancel = true;
        }
      }

      if (shouldCancel) {
        request.abortController.abort();
        this.queue.delete(cacheKey);
        this.inFlight.delete(cacheKey);
        cancelledCount++;
        this.log('[CANCEL:MATCH] Request cancelled by pattern', { 
          requestId: request.id, 
          cacheKey,
          pattern,
        });
      }
    }

    this.log('[CANCEL:SUMMARY] Cancelled requests matching pattern', { 
      pattern, 
      cancelledCount,
    });
    
    return cancelledCount;
  }

  /**
   * Cancel all pending requests for a seller (except current category)
   * Useful when switching categories
   * Requirements 2.4, 5.2: Cancel pending requests when category changes
   */
  cancelAllExcept(sellerId: string, exceptCategory?: string): number {
    let cancelledCount = 0;
    
    for (const [cacheKey, request] of this.queue.entries()) {
      if (request.params.sellerId === sellerId) {
        // Don't cancel if it matches the exception category
        if (exceptCategory && request.params.category === exceptCategory) {
          continue;
        }
        
        request.abortController.abort();
        this.queue.delete(cacheKey);
        this.inFlight.delete(cacheKey);
        cancelledCount++;
        this.log('[CANCEL:EXCEPT] Request cancelled', { 
          requestId: request.id, 
          cacheKey,
          exceptCategory,
        });
      }
    }

    return cancelledCount;
  }

  /**
   * Cancel all pending requests
   * Requirements 5.4: Cancel all pending requests on navigation away
   */
  cancelAll(): number {
    const cancelledCount = this.queue.size;
    
    for (const [cacheKey, request] of this.queue.entries()) {
      request.abortController.abort();
    }
    
    this.queue.clear();
    this.inFlight.clear();
    
    this.log('[CANCEL:ALL] All requests cancelled', { cancelledCount });
    
    return cancelledCount;
  }

  /**
   * Check if a request with given params is currently in-flight
   */
  isInFlight(params: CursorPaginationParams): boolean {
    const cacheKey = generateCacheKey(params);
    return this.inFlight.has(cacheKey);
  }

  /**
   * Get the number of pending requests
   */
  getPendingCount(): number {
    return this.queue.size;
  }

  /**
   * Get all pending request IDs (for debugging)
   */
  getPendingRequestIds(): string[] {
    return Array.from(this.queue.values()).map(r => r.id);
  }

  /**
   * Get pending requests info (for debugging)
   * Requirements 10.5: Provide way to view pending requests
   */
  getPendingRequestsInfo(): Array<{
    id: string;
    cacheKey: string;
    params: CursorPaginationParams;
    age: number;
  }> {
    const now = Date.now();
    return Array.from(this.queue.entries()).map(([cacheKey, request]) => ({
      id: request.id,
      cacheKey,
      params: request.params,
      age: now - request.timestamp,
    }));
  }

  /**
   * Check if queue is empty
   */
  isEmpty(): boolean {
    return this.queue.size === 0;
  }

  /**
   * Clear the queue without aborting (for testing)
   */
  clear(): void {
    this.queue.clear();
    this.inFlight.clear();
    this.log('[CLEAR] Queue cleared');
  }
}

// Export singleton instance
export const RequestQueueManager = new RequestQueueManagerClass();

// Export class for testing and creating new instances
export { RequestQueueManagerClass };
