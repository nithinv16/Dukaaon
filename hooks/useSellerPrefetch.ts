/**
 * useSellerPrefetch - Hook for pre-fetching seller products on hover/focus
 * 
 * Implements Requirements 2.3, 3.1, 3.2:
 * - Pre-fetch product data during navigation animation to minimize perceived loading time
 * - Add prefetch trigger when user hovers/focuses on seller card
 * - Prefetch products for visible wholesaler cards (3.1)
 * - Priority prefetch on long-press (3.2)
 */

import { useCallback, useRef, useEffect } from 'react';
import { ProductCacheService } from '../services/products/ProductCacheService';
import { PrefetchManager } from '../services/products/PrefetchManager';

interface UseSellerPrefetchOptions {
  /** Delay before triggering prefetch (ms) - prevents prefetch on quick scroll */
  prefetchDelay?: number;
  /** Whether prefetching is enabled */
  enabled?: boolean;
  /** Maximum number of sellers to prefetch at once */
  maxVisiblePrefetch?: number;
}

interface UseSellerPrefetchResult {
  /** Call when user focuses/hovers on a seller card */
  onSellerFocus: (sellerId: string) => void;
  /** Call when user leaves a seller card */
  onSellerBlur: (sellerId: string) => void;
  /** Manually trigger prefetch for a seller */
  prefetchSeller: (sellerId: string) => void;
  /** Cancel pending prefetch for a seller */
  cancelPrefetch: (sellerId: string) => void;
  /** Prefetch products for array of visible seller IDs - Requirements 3.1 */
  prefetchVisible: (sellerIds: string[]) => void;
  /** Trigger high-priority prefetch on long-press - Requirements 3.2 */
  onLongPress: (sellerId: string) => void;
}

export function useSellerPrefetch(options: UseSellerPrefetchOptions = {}): UseSellerPrefetchResult {
  const { prefetchDelay = 150, enabled = true, maxVisiblePrefetch = 3 } = options;
  
  // Track pending prefetch timers
  const pendingPrefetches = useRef<Map<string, NodeJS.Timeout>>(new Map());
  // Track already prefetched sellers to avoid duplicate requests
  const prefetchedSellers = useRef<Set<string>>(new Set());
  // Track visible sellers for batch prefetch
  const visibleSellersRef = useRef<string[]>([]);

  /**
   * Trigger prefetch for a seller's products
   */
  const prefetchSeller = useCallback((sellerId: string) => {
    if (!enabled) return;
    
    // Skip if already prefetched
    if (prefetchedSellers.current.has(sellerId)) {
      return;
    }

    // Mark as prefetched
    prefetchedSellers.current.add(sellerId);
    
    // Trigger prefetch in ProductCacheService
    ProductCacheService.prefetchSellerProducts(sellerId);
  }, [enabled]);

  /**
   * Cancel pending prefetch for a seller
   */
  const cancelPrefetch = useCallback((sellerId: string) => {
    const timer = pendingPrefetches.current.get(sellerId);
    if (timer) {
      clearTimeout(timer);
      pendingPrefetches.current.delete(sellerId);
    }
  }, []);

  /**
   * Handle seller card focus/hover
   * Starts a delayed prefetch to avoid prefetching during quick scrolls
   */
  const onSellerFocus = useCallback((sellerId: string) => {
    if (!enabled) return;
    
    // Cancel any existing timer for this seller
    cancelPrefetch(sellerId);
    
    // Skip if already prefetched
    if (prefetchedSellers.current.has(sellerId)) {
      return;
    }

    // Start delayed prefetch
    const timer = setTimeout(() => {
      prefetchSeller(sellerId);
      pendingPrefetches.current.delete(sellerId);
    }, prefetchDelay);

    pendingPrefetches.current.set(sellerId, timer);
  }, [enabled, prefetchDelay, prefetchSeller, cancelPrefetch]);

  /**
   * Handle seller card blur/leave
   * Cancels pending prefetch if user leaves before delay completes
   */
  const onSellerBlur = useCallback((sellerId: string) => {
    cancelPrefetch(sellerId);
  }, [cancelPrefetch]);

  /**
   * Prefetch products for array of visible seller IDs - Requirements 3.1
   * Uses PrefetchManager for queue management
   * @param sellerIds - Array of visible seller IDs to prefetch
   */
  const prefetchVisible = useCallback((sellerIds: string[]) => {
    if (!enabled || !sellerIds || sellerIds.length === 0) return;

    // Store visible sellers for reference
    visibleSellersRef.current = sellerIds;

    // Filter out already prefetched sellers
    const toPrefetch = sellerIds
      .filter(id => !prefetchedSellers.current.has(id))
      .slice(0, maxVisiblePrefetch); // Limit to maxVisiblePrefetch

    if (toPrefetch.length === 0) return;

    // Queue prefetch requests with low priority (automatic)
    toPrefetch.forEach(sellerId => {
      PrefetchManager.prefetch(sellerId, 'low');
      prefetchedSellers.current.add(sellerId);
    });
  }, [enabled, maxVisiblePrefetch]);

  /**
   * Trigger high-priority prefetch on long-press - Requirements 3.2
   * Works even on slow networks
   * @param sellerId - Seller ID to prefetch with high priority
   */
  const onLongPress = useCallback((sellerId: string) => {
    if (!enabled) return;

    // High-priority prefetch bypasses network quality checks
    PrefetchManager.prefetch(sellerId, 'high');
    prefetchedSellers.current.add(sellerId);
  }, [enabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clear all pending timers
      pendingPrefetches.current.forEach(timer => clearTimeout(timer));
      pendingPrefetches.current.clear();
    };
  }, []);

  return {
    onSellerFocus,
    onSellerBlur,
    prefetchSeller,
    cancelPrefetch,
    prefetchVisible,
    onLongPress,
  };
}

export default useSellerPrefetch;
