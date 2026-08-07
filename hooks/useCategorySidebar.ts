/**
 * useCategorySidebar - Hook for managing category sidebar state and data
 * 
 * Implements Requirements:
 * - 4.1: Load category list with approximate counts within 200ms
 * - 4.2: Use pre-computed or estimated counts instead of real-time COUNT queries
 * - 2.4: Cancel pending requests on category change
 * 
 * Features:
 * - Fetches category counts from RPC
 * - Caches counts locally
 * - Manages selection and expansion state
 * - Handles request cancellation on category change
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../services/supabase/supabase';
import { ProductQueryService } from '../services/products/ProductQueryService';

export interface CategoryCount {
  category: string;
  subcategory: string | null;
  product_count: number;
}

export interface CategoryWithSubcategories {
  name: string;
  count: number;
  subcategories: Array<{
    name: string;
    count: number;
  }>;
}

export interface UseCategorySidebarOptions {
  sellerId: string;
  enableLogging?: boolean;
  /** Initial selected category */
  initialCategory?: string | null;
  /** Initial selected subcategory */
  initialSubcategory?: string | null;
}

export interface UseCategorySidebarResult {
  /** Aggregated categories with subcategories */
  categories: CategoryWithSubcategories[];
  /** Raw category counts from database */
  rawCounts: CategoryCount[];
  /** Currently selected category (null for "All") */
  selectedCategory: string | null;
  /** Currently selected subcategory */
  selectedSubcategory: string | null;
  /** Currently expanded category */
  expandedCategory: string | null;
  /** Whether categories are loading */
  isLoading: boolean;
  /** Error message if loading failed */
  error: string | null;
  /** Total product count across all categories */
  totalCount: number;
  /** Select a category and optionally a subcategory */
  selectCategory: (category: string | null, subcategory: string | null) => void;
  /** Expand or collapse a category */
  expandCategory: (category: string | null) => void;
  /** Refresh category counts */
  refresh: () => void;
}

// Cache for category counts by seller
const categoryCountsCache = new Map<string, {
  data: CategoryCount[];
  timestamp: number;
}>();

// Cache TTL: 5 minutes
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * useCategorySidebar - Main hook for category sidebar functionality
 */
export function useCategorySidebar(options: UseCategorySidebarOptions): UseCategorySidebarResult {
  const {
    sellerId,
    enableLogging = false,
    initialCategory = null,
    initialSubcategory = null,
  } = options;

  // State
  const [rawCounts, setRawCounts] = useState<CategoryCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(initialCategory);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(initialSubcategory);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(initialCategory);

  // Refs
  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Log message if logging is enabled
   */
  const log = useCallback((message: string, data?: Record<string, any>) => {
    if (enableLogging) {
      console.log(`[useCategorySidebar] ${message}`, data || '');
    }
  }, [enableLogging]);

  /**
   * Check if cached data is still valid
   */
  const isCacheValid = useCallback((sellerId: string): boolean => {
    const cached = categoryCountsCache.get(sellerId);
    if (!cached) return false;
    return Date.now() - cached.timestamp < CACHE_TTL_MS;
  }, []);

  /**
   * Get cached data if valid
   */
  const getCachedData = useCallback((sellerId: string): CategoryCount[] | null => {
    if (isCacheValid(sellerId)) {
      const cached = categoryCountsCache.get(sellerId);
      return cached?.data || null;
    }
    return null;
  }, [isCacheValid]);

  /**
   * Set cache data
   */
  const setCacheData = useCallback((sellerId: string, data: CategoryCount[]) => {
    categoryCountsCache.set(sellerId, {
      data,
      timestamp: Date.now(),
    });
  }, []);

  /**
   * Fallback: Fetch category counts using standard query
   * Used when get_seller_category_counts RPC doesn't exist
   */
  const fetchCategoryCountsFallback = useCallback(async (): Promise<CategoryCount[]> => {
    log('[FETCH:FALLBACK] Using standard query for category counts');
    
    const { data, error } = await supabase
      .from('products')
      .select('category, subcategory')
      .eq('seller_id', sellerId)
      .eq('is_active', true);

    if (error) {
      throw error;
    }

    // Aggregate counts manually
    const countMap = new Map<string, number>();
    
    for (const product of data || []) {
      const key = `${product.category || ''}|${product.subcategory || ''}`;
      countMap.set(key, (countMap.get(key) || 0) + 1);
    }

    const counts: CategoryCount[] = [];
    for (const [key, count] of countMap.entries()) {
      const [category, subcategory] = key.split('|');
      if (category) {
        counts.push({
          category,
          subcategory: subcategory || null,
          product_count: count,
        });
      }
    }

    return counts;
  }, [sellerId, log]);

  /**
   * Fetch category counts from database
   * Requirements 4.1, 4.2: Load category counts from pre-computed view
   */
  const fetchCategoryCounts = useCallback(async (forceRefresh: boolean = false) => {
    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cachedData = getCachedData(sellerId);
      if (cachedData) {
        log('[CACHE:HIT] Using cached category counts', { sellerId });
        setRawCounts(cachedData);
        setIsLoading(false);
        return;
      }
    }

    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setError(null);

    log('[FETCH:START] Fetching category counts', { sellerId });
    const startTime = Date.now();

    try {
      let counts: CategoryCount[] = [];
      
      // Try RPC first, fallback to standard query if RPC doesn't exist
      try {
        const { data, error: rpcError } = await supabase.rpc('get_seller_category_counts', {
          p_seller_id: sellerId,
        });

        // Check if aborted
        if (abortControllerRef.current?.signal.aborted) {
          log('[FETCH:ABORTED] Request was cancelled');
          return;
        }

        if (rpcError) {
          // Check if error is because function doesn't exist
          if (rpcError.message?.includes('function') || 
              rpcError.code === '42883' || // undefined_function
              rpcError.code === 'PGRST202') { // function not found
            log('[FETCH:RPC_NOT_FOUND] RPC function not found, using fallback');
            counts = await fetchCategoryCountsFallback();
          } else {
            throw rpcError;
          }
        } else {
          counts = (data || []).map((row: any) => ({
            category: row.category,
            subcategory: row.subcategory,
            product_count: Number(row.product_count),
          }));
        }
      } catch (rpcError: any) {
        // If RPC fails, try fallback
        log('[FETCH:RPC_ERROR] RPC failed, trying fallback', { error: String(rpcError) });
        counts = await fetchCategoryCountsFallback();
      }

      const fetchTime = Date.now() - startTime;
      log('[FETCH:SUCCESS] Category counts loaded', {
        sellerId,
        count: counts.length,
        fetchTime,
      });

      // Warn if fetch took too long (Requirements 4.1: within 200ms)
      if (fetchTime > 200) {
        console.warn('[useCategorySidebar] Category counts fetch exceeded 200ms', {
          sellerId,
          fetchTime,
        });
      }

      // Update cache
      setCacheData(sellerId, counts);

      if (mountedRef.current) {
        setRawCounts(counts);
        setError(null);
      }
    } catch (err) {
      // Ignore abort errors
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }

      const errorMessage = err instanceof Error ? err.message : 'Failed to load categories';
      log('[FETCH:ERROR]', { error: errorMessage });

      if (mountedRef.current) {
        setError(errorMessage);
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [sellerId, getCachedData, setCacheData, fetchCategoryCountsFallback, log]);

  /**
   * Aggregate raw counts into categories with subcategories
   */
  const categories = useMemo((): CategoryWithSubcategories[] => {
    const categoryMap = new Map<string, CategoryWithSubcategories>();

    for (const count of rawCounts) {
      if (!count.category) continue;

      let category = categoryMap.get(count.category);
      if (!category) {
        category = {
          name: count.category,
          count: 0,
          subcategories: [],
        };
        categoryMap.set(count.category, category);
      }

      // Add to category total
      category.count += count.product_count;

      // Add subcategory if present
      if (count.subcategory) {
        category.subcategories.push({
          name: count.subcategory,
          count: count.product_count,
        });
      }
    }

    // Sort categories alphabetically, subcategories by count (descending)
    const result = Array.from(categoryMap.values());
    result.sort((a, b) => a.name.localeCompare(b.name));
    
    for (const category of result) {
      category.subcategories.sort((a, b) => b.count - a.count);
    }

    return result;
  }, [rawCounts]);

  /**
   * Calculate total product count
   */
  const totalCount = useMemo(() => {
    return categories.reduce((sum, cat) => sum + cat.count, 0);
  }, [categories]);

  /**
   * Select a category and optionally a subcategory
   * Requirements 2.4: Cancel pending requests on category change
   */
  const selectCategory = useCallback((
    category: string | null,
    subcategory: string | null
  ) => {
    log('[SELECT] Category selected', { category, subcategory });

    // Cancel pending product requests for previous category
    if (selectedCategory !== category) {
      ProductQueryService.cancelRequests(sellerId, selectedCategory || undefined);
    }

    setSelectedCategory(category);
    setSelectedSubcategory(subcategory);

    // Auto-expand category when selected
    if (category && !subcategory) {
      const categoryData = categories.find(c => c.name === category);
      if (categoryData && categoryData.subcategories.length > 0) {
        setExpandedCategory(category);
      }
    }
  }, [sellerId, selectedCategory, categories, log]);

  /**
   * Expand or collapse a category
   */
  const expandCategory = useCallback((category: string | null) => {
    log('[EXPAND] Category expansion toggled', { category });
    setExpandedCategory(category);
  }, [log]);

  /**
   * Refresh category counts
   */
  const refresh = useCallback(() => {
    log('[REFRESH] Refreshing category counts');
    fetchCategoryCounts(true);
  }, [fetchCategoryCounts, log]);

  // Initial fetch
  useEffect(() => {
    mountedRef.current = true;
    fetchCategoryCounts();

    return () => {
      mountedRef.current = false;
      // Cancel any pending request on unmount
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [sellerId]); // Re-fetch when sellerId changes

  return {
    categories,
    rawCounts,
    selectedCategory,
    selectedSubcategory,
    expandedCategory,
    isLoading,
    error,
    totalCount,
    selectCategory,
    expandCategory,
    refresh,
  };
}

/**
 * Clear category counts cache for a seller
 * Call this when products are updated
 */
export function invalidateCategoryCountsCache(sellerId: string): void {
  categoryCountsCache.delete(sellerId);
}

/**
 * Clear all category counts cache
 */
export function clearCategoryCountsCache(): void {
  categoryCountsCache.clear();
}

export default useCategorySidebar;
