/**
 * useInfiniteProducts - Hook for infinite scroll product loading
 * 
 * Implements Requirements 2.5:
 * - Reduce batch size to 10 for slow networks (2G/3G)
 * - Implement infinite scroll pagination
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { ProductCacheService, Product, ProductQueryOptions, CachedProductResult } from '../services/products/ProductCacheService';
import { NetworkQualityService, NetworkQuality } from '../services/network/NetworkQualityService';

interface UseInfiniteProductsOptions {
  categoryId?: string;
  sellerId?: string;
  searchTerm?: string;
  initialLimit?: number;
}

interface UseInfiniteProductsResult {
  products: Product[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  networkQuality: NetworkQuality;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  totalCount: number;
}

export function useInfiniteProducts(options: UseInfiniteProductsOptions): UseInfiniteProductsResult {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [networkQuality, setNetworkQuality] = useState<NetworkQuality>('fast');
  const [totalCount, setTotalCount] = useState(0);
  
  const offsetRef = useRef(0);
  const isLoadingRef = useRef(false);

  // Get adaptive batch size based on network quality
  const getBatchSize = useCallback(() => {
    return NetworkQualityService.getBatchSize({
      fast: options.initialLimit || 50,
      slow: 10, // Reduced for slow networks
      offline: 0,
    });
  }, [options.initialLimit]);

  // Subscribe to network quality changes
  useEffect(() => {
    const unsubscribe = NetworkQualityService.subscribe((state) => {
      setNetworkQuality(state.quality);
    });
    return unsubscribe;
  }, []);

  // Load products
  const loadProducts = useCallback(async (isRefresh: boolean = false) => {
    if (isLoadingRef.current && !isRefresh) return;
    
    isLoadingRef.current = true;
    
    if (isRefresh) {
      setIsLoading(true);
      offsetRef.current = 0;
    } else {
      setIsLoadingMore(true);
    }
    
    setError(null);

    try {
      const batchSize = getBatchSize();
      
      if (batchSize === 0) {
        // Offline mode - try to get from cache only
        setError('You are offline. Showing cached products.');
      }

      const queryOptions: ProductQueryOptions = {
        categoryId: options.categoryId,
        sellerId: options.sellerId,
        searchTerm: options.searchTerm,
        limit: batchSize,
        offset: offsetRef.current,
        networkQuality: networkQuality,
      };

      const result: CachedProductResult = await ProductCacheService.getProducts(queryOptions);

      if (isRefresh) {
        setProducts(result.products);
      } else {
        setProducts(prev => [...prev, ...result.products]);
      }

      setTotalCount(result.totalCount);
      offsetRef.current += result.products.length;
      setHasMore(offsetRef.current < result.totalCount);

      // Register for background updates
      const cacheKey = ProductCacheService.getCacheKey(queryOptions);
      const unsubscribe = ProductCacheService.onCacheUpdate(cacheKey, (updatedResult) => {
        if (isRefresh || offsetRef.current <= batchSize) {
          setProducts(updatedResult.products);
          setTotalCount(updatedResult.totalCount);
        }
      });

      // Cleanup subscription after a short delay
      setTimeout(() => unsubscribe(), 5000);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
      isLoadingRef.current = false;
    }
  }, [options.categoryId, options.sellerId, options.searchTerm, networkQuality, getBatchSize]);

  // Initial load
  useEffect(() => {
    loadProducts(true);
  }, [options.categoryId, options.sellerId, options.searchTerm]);

  // Refresh function
  const refresh = useCallback(async () => {
    await loadProducts(true);
  }, [loadProducts]);

  // Load more function for infinite scroll
  const loadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore || isLoading) return;
    await loadProducts(false);
  }, [hasMore, isLoadingMore, isLoading, loadProducts]);

  return {
    products,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    networkQuality,
    refresh,
    loadMore,
    totalCount,
  };
}

export default useInfiniteProducts;
