/**
 * CategoriesDataService - Simplified categories data fetching (direct database)
 * 
 * Simplified version that fetches directly from database without complex caching.
 * Uses simple in-memory cache with short TTL for performance.
 */

import { dynamicCategoryService } from '../dynamic/dynamicCategoryService';

export interface Category {
  id: string;
  name: string;
  slug: string;
  image_url?: string;
  icon_url?: string;
  parent_id?: string;
  description?: string;
  display_order: number;
  is_active: boolean;
  metadata?: any;
}

export interface CategoriesFetchOptions {
  limit?: number;
  showProductCount?: boolean;
  useCache?: boolean;
}

export interface CategoriesFetchResult {
  categories: Category[];
  fromCache: boolean;
  error?: string;
}

// Simple in-memory cache
interface CacheEntry {
  data: Category[];
  timestamp: number;
}

class CategoriesDataServiceClass {
  private cache: CacheEntry | null = null;
  private readonly CACHE_TTL = 2 * 60 * 1000; // 2 minutes

  /**
   * Check if cache is valid
   */
  private isCacheValid(): boolean {
    if (!this.cache) return false;
    return Date.now() - this.cache.timestamp < this.CACHE_TTL;
  }

  /**
   * Fetch categories - direct database fetch with simple memory cache
   */
  async fetchCategories(options: CategoriesFetchOptions = {}): Promise<CategoriesFetchResult> {
    const { limit, showProductCount = false } = options;
    const fetchStartTime = Date.now();

    console.log('[CategoriesDataService] Fetching categories');

    // Check simple memory cache first
    if (this.isCacheValid() && this.cache) {
      let categories = this.cache.data;
      if (limit && limit > 0) {
        categories = categories.slice(0, limit);
      }
      console.log(`[CategoriesDataService] Cache hit (${categories.length} items)`);
      return { categories, fromCache: true };
    }

    try {
      let categories: Category[];

      if (showProductCount) {
        const categoriesWithCount = await dynamicCategoryService.getCategoriesWithProductCount();
        categories = categoriesWithCount as any;
      } else {
        categories = await dynamicCategoryService.getCategories(false);
      }

      // Store in simple memory cache
      this.cache = { data: categories, timestamp: Date.now() };

      // Apply limit if specified
      if (limit && limit > 0) {
        categories = categories.slice(0, limit);
      }

      const fetchTime = Date.now() - fetchStartTime;
      console.log(`[CategoriesDataService] Fetched ${categories.length} categories in ${fetchTime}ms`);

      return { categories, fromCache: false };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[CategoriesDataService] Error fetching categories:', errorMessage);

      // Return stale cache if available
      if (this.cache) {
        let categories = this.cache.data;
        if (limit && limit > 0) {
          categories = categories.slice(0, limit);
        }
        console.log('[CategoriesDataService] Returning stale cache');
        return { categories, fromCache: true };
      }

      return { categories: [], fromCache: false, error: errorMessage };
    }
  }

  /**
   * Get cached categories (for fallback)
   */
  async getCachedCategories(): Promise<CategoriesFetchResult | null> {
    if (this.cache && this.cache.data.length > 0) {
      return { categories: this.cache.data, fromCache: true };
    }
    return null;
  }

  /**
   * Clear cache
   */
  async clearCache(): Promise<void> {
    this.cache = null;
    dynamicCategoryService.clearCache();
  }

  /**
   * Invalidate cache (compatibility method)
   */
  async invalidateCache(): Promise<void> {
    this.cache = null;
  }
}

// Export singleton instance
export const CategoriesDataService = new CategoriesDataServiceClass();

// Export class for testing
export { CategoriesDataServiceClass };
