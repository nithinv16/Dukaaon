/**
 * Dynamic Category Service
 * 
 * Manages categories and subcategories from database
 * instead of hardcoded constants
 */

import { supabase } from '../supabase/supabase';
import { supabaseConfig } from '../../config/secrets';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Helper to get auth key
const SUPABASE_AUTH_KEY = `sb-${supabaseConfig.url.split('//')[1].split('.')[0]}-auth-token`;

interface Category {
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

interface Subcategory {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  image_url?: string;
  display_order: number;
  is_active: boolean;
  metadata?: any;
}

class DynamicCategoryService {
  private categoriesCache: Category[] = [];
  private subcategoriesCache: Map<string, Subcategory[]> = new Map();
  private lastFetch: number = 0;
  private CACHE_DURATION = 10 * 60 * 1000; // 10 minutes
  private STORAGE_KEY = '@dynamic_categories';
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize the service - loads cache from AsyncStorage
   * Call this at app startup for fastest category loading
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._doInitialize();
    return this.initPromise;
  }

  private async _doInitialize(): Promise<void> {
    try {
      const cached = await this.getCategoriesFromStorage();
      if (cached && cached.length > 0) {
        this.categoriesCache = cached;
        this.lastFetch = Date.now() - (this.CACHE_DURATION / 2); // Mark as half-valid to trigger background refresh
        console.log(`[DynamicCategoryService] Initialized with ${cached.length} cached categories`);
      }
      this.isInitialized = true;
    } catch (error) {
      console.warn('[DynamicCategoryService] Failed to initialize from cache:', error);
      this.isInitialized = true;
    }
  }

  /**
   * Get cached categories synchronously (for instant UI)
   * Returns empty array if not cached - caller should also call getCategories() in background
   */
  getCategoriesSync(): Category[] {
    return this.categoriesCache;
  }

  /**
   * Fetch all active categories
   */
  async getCategories(forceRefresh: boolean = false): Promise<Category[]> {
    try {
      // Return cache if valid
      if (!forceRefresh && this.isCacheValid() && this.categoriesCache.length > 0) {
        return this.categoriesCache;
      }

      // Try to get from AsyncStorage first
      if (!forceRefresh) {
        const cached = await this.getCategoriesFromStorage();
        if (cached && cached.length > 0) {
          this.categoriesCache = cached;
          return cached;
        }
      }

      // Fetch from database using direct fetch API
      console.log('[DynamicCategoryService] getCategories: Fetching from database...');

      const sessionStr = await AsyncStorage.getItem(SUPABASE_AUTH_KEY);
      let accessToken = '';
      if (sessionStr) {
        const sessionData = JSON.parse(sessionStr);
        accessToken = sessionData?.access_token || '';
      }

      if (!accessToken) {
        console.warn('[DynamicCategoryService] getCategories: No access token');
        return this.categoriesCache;
      }

      const response = await fetch(
        `${supabaseConfig.url}/rest/v1/categories?is_active=eq.true&parent_id=is.null&order=display_order.asc`,
        {
          method: 'GET',
          headers: {
            'apikey': supabaseConfig.anonKey,
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        console.error('[DynamicCategoryService] getCategories: Fetch failed');
        return this.categoriesCache;
      }

      const data = await response.json();
      console.log('[DynamicCategoryService] getCategories: Fetched', data?.length, 'categories');

      this.categoriesCache = data || [];
      this.lastFetch = Date.now();

      // Save to storage for offline access
      await this.saveCategoriesToStorage(this.categoriesCache);

      return this.categoriesCache;
    } catch (error: any) {
      console.error('[DynamicCategoryService] getCategories: Error:', error?.message);
      // Return cached data if available
      return this.categoriesCache;
    }
  }

  /**
   * Get subcategories for a category
   */
  async getSubcategories(categoryId: string, forceRefresh: boolean = false): Promise<Subcategory[]> {
    try {
      // Return cache if valid
      if (!forceRefresh && this.subcategoriesCache.has(categoryId)) {
        return this.subcategoriesCache.get(categoryId) || [];
      }

      console.log('[DynamicCategoryService] getSubcategories: Fetching for categoryId:', categoryId);

      const sessionStr = await AsyncStorage.getItem(SUPABASE_AUTH_KEY);
      let accessToken = '';
      if (sessionStr) {
        const sessionData = JSON.parse(sessionStr);
        accessToken = sessionData?.access_token || '';
      }

      if (!accessToken) {
        console.warn('[DynamicCategoryService] getSubcategories: No access token');
        return this.subcategoriesCache.get(categoryId) || [];
      }

      const response = await fetch(
        `${supabaseConfig.url}/rest/v1/subcategories?category_id=eq.${categoryId}&is_active=eq.true&order=display_order.asc`,
        {
          method: 'GET',
          headers: {
            'apikey': supabaseConfig.anonKey,
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        console.error('[DynamicCategoryService] getSubcategories: Fetch failed');
        return this.subcategoriesCache.get(categoryId) || [];
      }

      const data = await response.json();
      console.log('[DynamicCategoryService] getSubcategories: Fetched', data?.length, 'subcategories');

      const subcategories = data || [];
      this.subcategoriesCache.set(categoryId, subcategories);

      return subcategories;
    } catch (error: any) {
      console.error('[DynamicCategoryService] getSubcategories: Error:', error?.message);
      return this.subcategoriesCache.get(categoryId) || [];
    }
  }

  /**
   * Get a single category by slug
   */
  async getCategoryBySlug(slug: string): Promise<Category | null> {
    try {
      console.log('[DynamicCategoryService] getCategoryBySlug: Checking slug:', slug);

      // Get access token for direct fetch
      const sessionStr = await AsyncStorage.getItem(SUPABASE_AUTH_KEY);
      let accessToken = '';
      if (sessionStr) {
        const sessionData = JSON.parse(sessionStr);
        accessToken = sessionData?.access_token || '';
      }

      if (!accessToken) {
        console.warn('[DynamicCategoryService] getCategoryBySlug: No access token');
        return null;
      }

      const response = await fetch(
        `${supabaseConfig.url}/rest/v1/categories?slug=eq.${encodeURIComponent(slug)}&is_active=eq.true&limit=1`,
        {
          method: 'GET',
          headers: {
            'apikey': supabaseConfig.anonKey,
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        console.warn('[DynamicCategoryService] getCategoryBySlug: Fetch failed');
        return null;
      }

      const data = await response.json();
      console.log('[DynamicCategoryService] getCategoryBySlug: Found', data?.length, 'results');
      return data && data.length > 0 ? data[0] : null;
    } catch (error: any) {
      console.error('[DynamicCategoryService] getCategoryBySlug: Error:', error?.message);
      return null;
    }
  }

  /**
   * Get a single category by ID
   */
  async getCategoryById(id: string): Promise<Category | null> {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('id', id)
        .eq('is_active', true)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching category by ID:', error);
      return null;
    }
  }

  /**
   * Search categories by name
   */
  async searchCategories(query: string): Promise<Category[]> {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .ilike('name', `%${query}%`)
        .order('display_order', { ascending: true })
        .limit(20);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error searching categories:', error);
      return [];
    }
  }

  /**
   * Search subcategories by name across all categories
   */
  async searchSubcategories(query: string): Promise<Subcategory[]> {
    try {
      const { data, error } = await supabase
        .from('subcategories')
        .select('*')
        .eq('is_active', true)
        .ilike('name', `%${query}%`)
        .order('display_order', { ascending: true })
        .limit(20);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error searching subcategories:', error);
      return [];
    }
  }

  /**
   * Get all categories with their subcategories
   */
  async getCategoriesWithSubcategories(): Promise<(Category & { subcategories: Subcategory[] })[]> {
    try {
      const categories = await this.getCategories();

      const categoriesWithSubs = await Promise.all(
        categories.map(async (category) => {
          const subcategories = await this.getSubcategories(category.id);
          return {
            ...category,
            subcategories,
          };
        })
      );

      return categoriesWithSubs;
    } catch (error) {
      console.error('Error fetching categories with subcategories:', error);
      return [];
    }
  }

  /**
   * Get products count for each category
   */
  async getCategoriesWithProductCount(): Promise<(Category & { product_count: number })[]> {
    try {
      const categories = await this.getCategories();

      const categoriesWithCount = await Promise.all(
        categories.map(async (category) => {
          const { count, error } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true })
            .eq('category_id', category.id);

          return {
            ...category,
            product_count: count || 0,
          };
        })
      );

      return categoriesWithCount;
    } catch (error) {
      console.error('Error fetching categories with product count:', error);
      return [];
    }
  }

  /**
   * Create a new category
   */
  async createCategory(name: string): Promise<Category | null> {
    try {
      console.log('[DynamicCategoryService] createCategory: Starting with name:', name);
      const slug = name.trim().toLowerCase().replace(/\s+/g, '-');

      // Check if exists first
      const existing = await this.getCategoryBySlug(slug);
      if (existing) {
        console.log('[DynamicCategoryService] createCategory: Category already exists');
        return existing;
      }

      // Get access token for direct fetch
      const sessionStr = await AsyncStorage.getItem(SUPABASE_AUTH_KEY);
      let accessToken = '';
      if (sessionStr) {
        const sessionData = JSON.parse(sessionStr);
        accessToken = sessionData?.access_token || '';
      }

      if (!accessToken) {
        console.warn('[DynamicCategoryService] createCategory: No access token');
        return null;
      }

      console.log('[DynamicCategoryService] createCategory: Using direct fetch API...');

      const response = await fetch(
        `${supabaseConfig.url}/rest/v1/categories`,
        {
          method: 'POST',
          headers: {
            'apikey': supabaseConfig.anonKey,
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({
            name: name.trim(),
            slug,
            is_active: true,
            display_order: 999,
          })
        }
      );

      console.log('[DynamicCategoryService] createCategory: Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[DynamicCategoryService] createCategory: Error:', errorText);
        throw new Error(errorText);
      }

      const data = await response.json();
      console.log('[DynamicCategoryService] createCategory: Created successfully:', data[0]?.id);

      this.clearCache();
      return data[0] || data;
    } catch (error: any) {
      console.error('[DynamicCategoryService] createCategory: Error:', error?.message || error);
      return null;
    }
  }

  /**
   * Create a new subcategory
   */
  async createSubcategory(categoryId: string, name: string): Promise<Subcategory | null> {
    try {
      console.log('[DynamicCategoryService] createSubcategory: Starting with categoryId:', categoryId, 'name:', name);
      const slug = name.trim().toLowerCase().replace(/\s+/g, '-');

      // Get access token for direct fetch
      const sessionStr = await AsyncStorage.getItem(SUPABASE_AUTH_KEY);
      let accessToken = '';
      if (sessionStr) {
        const sessionData = JSON.parse(sessionStr);
        accessToken = sessionData?.access_token || '';
      }

      if (!accessToken) {
        console.warn('[DynamicCategoryService] createSubcategory: No access token');
        return null;
      }

      console.log('[DynamicCategoryService] createSubcategory: Using direct fetch API...');

      const response = await fetch(
        `${supabaseConfig.url}/rest/v1/subcategories`,
        {
          method: 'POST',
          headers: {
            'apikey': supabaseConfig.anonKey,
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({
            category_id: categoryId,
            name: name.trim(),
            slug,
            is_active: true,
            display_order: 999,
          })
        }
      );

      console.log('[DynamicCategoryService] createSubcategory: Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[DynamicCategoryService] createSubcategory: Error:', errorText);
        throw new Error(errorText);
      }

      const data = await response.json();
      console.log('[DynamicCategoryService] createSubcategory: Created successfully:', data[0]?.id);

      this.subcategoriesCache.delete(categoryId);
      return data[0] || data;
    } catch (error: any) {
      console.error('[DynamicCategoryService] createSubcategory: Error:', error?.message || error);
      return null;
    }
  }

  /**
   * Migrate old string-based categories to new table
   * Call this once to migrate existing data
   */
  async migrateOldCategories(): Promise<void> {
    try {
      console.log('Starting category migration...');

      // Get unique categories from products
      const { data: products, error } = await supabase
        .from('products')
        .select('category, subcategory')
        .not('category', 'is', null);

      if (error) throw error;

      // Extract unique categories
      const categorySet = new Set<string>();
      products?.forEach((p) => {
        if (p.category) categorySet.add(p.category);
      });

      // Insert categories into new table
      const categories = await this.getCategories(true);
      const existingSlugs = new Set(categories.map((c) => c.slug));

      for (const categoryName of categorySet) {
        const slug = categoryName.toLowerCase().replace(/\s+/g, '-');

        if (existingSlugs.has(slug)) {
          console.log(`Category ${categoryName} already exists, skipping...`);
          continue;
        }

        const { data: newCategory, error: insertError } = await supabase
          .from('categories')
          .insert({
            name: categoryName,
            slug: slug,
            is_active: true,
            display_order: 999,
          })
          .select()
          .single();

        if (insertError) {
          console.error(`Error inserting category ${categoryName}:`, insertError);
          continue;
        }

        console.log(`✅ Migrated category: ${categoryName}`);

        // Now migrate subcategories
        const uniqueSubcategories = new Set<string>();
        products?.forEach((p) => {
          if (p.category === categoryName && p.subcategory) {
            uniqueSubcategories.add(p.subcategory);
          }
        });

        for (const subcategoryName of uniqueSubcategories) {
          const subSlug = subcategoryName.toLowerCase().replace(/\s+/g, '-');

          await supabase.from('subcategories').insert({
            category_id: newCategory.id,
            name: subcategoryName,
            slug: subSlug,
            is_active: true,
            display_order: 999,
          });

          console.log(`  ✅ Migrated subcategory: ${subcategoryName}`);
        }
      }

      // Now update products to use category_id and subcategory_id
      console.log('Updating products with category IDs...');
      await this.updateProductCategoryReferences();

      console.log('✅ Migration completed!');
    } catch (error) {
      console.error('Error during migration:', error);
    }
  }

  /**
   * Update products to use category_id instead of category string
   */
  private async updateProductCategoryReferences(): Promise<void> {
    try {
      const { data: products, error: fetchError } = await supabase
        .from('products')
        .select('id, category, subcategory')
        .not('category', 'is', null);

      if (fetchError) throw fetchError;

      const categories = await this.getCategories(true);

      for (const product of products || []) {
        // Find matching category
        const category = categories.find(
          (c) =>
            c.name.toLowerCase() === product.category?.toLowerCase() ||
            c.slug === product.category?.toLowerCase().replace(/\s+/g, '-')
        );

        if (category) {
          const updates: any = { category_id: category.id };

          // Find matching subcategory
          if (product.subcategory) {
            const subcategories = await this.getSubcategories(category.id);
            const subcategory = subcategories.find(
              (s) =>
                s.name.toLowerCase() === product.subcategory?.toLowerCase() ||
                s.slug === product.subcategory?.toLowerCase().replace(/\s+/g, '-')
            );

            if (subcategory) {
              updates.subcategory_id = subcategory.id;
            }
          }

          await supabase
            .from('products')
            .update(updates)
            .eq('id', product.id);
        }
      }

      console.log('✅ Product category references updated');
    } catch (error) {
      console.error('Error updating product references:', error);
    }
  }

  /**
   * Clear cache and force refresh
   */
  clearCache(): void {
    this.categoriesCache = [];
    this.subcategoriesCache.clear();
    this.lastFetch = 0;
  }

  // ============ Private Helper Methods ============

  private isCacheValid(): boolean {
    return Date.now() - this.lastFetch < this.CACHE_DURATION;
  }

  private async saveCategoriesToStorage(categories: Category[]): Promise<void> {
    try {
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(categories));
    } catch (error) {
      console.warn('Error saving categories to storage:', error);
    }
  }

  private async getCategoriesFromStorage(): Promise<Category[] | null> {
    try {
      const data = await AsyncStorage.getItem(this.STORAGE_KEY);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      return null;
    }
  }
}

// Export singleton instance
export const dynamicCategoryService = new DynamicCategoryService();

