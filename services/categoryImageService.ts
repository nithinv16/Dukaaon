import { supabase } from './supabase/supabase';
import { CATEGORY_IMAGES, DYNAMIC_CATEGORY_MAPPING, getCategoryImage } from '../constants/categoryImages';

interface CategoryImageRecord {
  id: number;
  category_name: string;
  image_url: string | null;
  fallback_category: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

class CategoryImageService {
  private cache = new Map<string, string>();
  private cacheExpiry = new Map<string, number>();
  private readonly CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

  // Get category image with database fallback
  async getCategoryImageWithDB(categoryId: string): Promise<any> {
    try {
      // 1. Check cache first
      if (this.isCached(categoryId)) {
        const cachedUrl = this.cache.get(categoryId);
        return cachedUrl ? { uri: cachedUrl } : getCategoryImage(categoryId);
      }

      // 2. Check database
      const { data, error } = await supabase
        .from('category_images')
        .select('image_url, fallback_category')
        .eq('category_name', categoryId)
        .eq('is_active', true)
        .single();

      if (!error && data?.image_url) {
        const fullUrl = this.getStorageUrl(data.image_url);
        this.setCacheEntry(categoryId, fullUrl);
        return { uri: fullUrl };
      }

      // 3. Fallback to local images
      return getCategoryImage(categoryId);
    } catch (error) {
      console.warn('CategoryImageService error:', error);
      return getCategoryImage(categoryId);
    }
  }

  // Get subcategory image with database fallback
  async getSubcategoryImageWithDB(subcategoryId: string): Promise<any> {
    try {
      // 1. Check cache first
      const cacheKey = `sub_${subcategoryId}`;
      if (this.isCached(cacheKey)) {
        const cachedUrl = this.cache.get(cacheKey);
        return cachedUrl ? { uri: cachedUrl } : null;
      }

      // 2. Try direct storage lookup for subcategory images
      const subcategoryPath = `sub-categories/${subcategoryId}.png`;
      const { data: storageData } = supabase.storage
        .from('category-images')
        .getPublicUrl(subcategoryPath);

      // 3. Check if the image exists by attempting to fetch it
      try {
        const response = await fetch(storageData.publicUrl, { method: 'HEAD' });
        if (response.ok) {
          this.setCacheEntry(cacheKey, storageData.publicUrl);
          return { uri: storageData.publicUrl };
        }
      } catch (fetchError) {
        console.log(`Subcategory image not found in storage: ${subcategoryId}`);
      }

      // 4. Check database for subcategory mapping
      const { data, error } = await supabase
        .from('category_images')
        .select('image_url, fallback_category')
        .eq('category_name', subcategoryId)
        .eq('is_active', true)
        .single();

      if (!error && data?.image_url) {
        const fullUrl = this.getStorageUrl(data.image_url);
        this.setCacheEntry(cacheKey, fullUrl);
        return { uri: fullUrl };
      }

      return null; // No database image found
    } catch (error) {
      console.warn('SubcategoryImageService error:', error);
      return null;
    }
  }

  // Upload category image to storage
  async uploadCategoryImage(categoryId: string, imageFile: File): Promise<string | null> {
    try {
      const fileName = `dynamic-categories/${categoryId}-${Date.now()}.${imageFile.name.split('.').pop()}`;
      
      const { data, error } = await supabase.storage
        .from('category-images')
        .upload(fileName, imageFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) throw error;

      // Update database record
      await this.updateCategoryImageRecord(categoryId, fileName);
      
      return this.getStorageUrl(fileName);
    } catch (error) {
      console.error('Upload failed:', error);
      return null;
    }
  }

  // Update category image record in database
  async updateCategoryImageRecord(
    categoryName: string, 
    imageUrl: string, 
    fallbackCategory?: string
  ): Promise<void> {
    const { error } = await supabase
      .from('category_images')
      .upsert({
        category_name: categoryName,
        image_url: imageUrl,
        fallback_category: fallbackCategory || this.getFallbackCategory(categoryName),
        is_active: true,
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error('Database update failed:', error);
    } else {
      // Clear cache for this category
      this.cache.delete(categoryName);
      this.cacheExpiry.delete(categoryName);
    }
  }

  // Get all category mappings
  async getAllCategoryMappings(): Promise<CategoryImageRecord[]> {
    const { data, error } = await supabase
      .from('category_images')
      .select('*')
      .eq('is_active', true)
      .order('category_name');

    return data || [];
  }

  // Bulk insert initial category mappings
  async initializeCategoryMappings(): Promise<void> {
    const initialMappings = [
      // Dynamic categories with storage URLs
      { category_name: 'electronics', image_url: 'dynamic-categories/electronics.png', fallback_category: 'more' },
      { category_name: 'clothing', image_url: 'dynamic-categories/clothing.png', fallback_category: 'more' },
      { category_name: 'books', image_url: 'dynamic-categories/books.png', fallback_category: 'stationery' },
      { category_name: 'medicines', image_url: 'dynamic-categories/medicines.png', fallback_category: 'personal-care' },
      { category_name: 'toys', image_url: 'dynamic-categories/toys.png', fallback_category: 'more' },
      { category_name: 'fruits', image_url: 'dynamic-categories/fruits.png', fallback_category: 'groceries' },
      { category_name: 'vegetables', image_url: 'dynamic-categories/vegetables.png', fallback_category: 'groceries' },
      { category_name: 'furniture', image_url: 'dynamic-categories/furniture.png', fallback_category: 'household' }
    ];

    const { error } = await supabase
      .from('category_images')
      .upsert(initialMappings, { onConflict: 'category_name' });

    if (error) {
      console.error('Failed to initialize mappings:', error);
    }
  }

  // Private helper methods
  private isCached(categoryId: string): boolean {
    const expiry = this.cacheExpiry.get(categoryId);
    return expiry ? Date.now() < expiry : false;
  }

  private setCacheEntry(categoryId: string, url: string): void {
    this.cache.set(categoryId, url);
    this.cacheExpiry.set(categoryId, Date.now() + this.CACHE_DURATION);
  }

  private getStorageUrl(path: string): string {
    const { data } = supabase.storage
      .from('category-images')
      .getPublicUrl(path);
    return data.publicUrl;
  }

  private getFallbackCategory(categoryId: string): string {
    return DYNAMIC_CATEGORY_MAPPING[categoryId] || 'more';
  }

  // Clear all cache
  clearCache(): void {
    this.cache.clear();
    this.cacheExpiry.clear();
  }
}

export const categoryImageService = new CategoryImageService();
export default CategoryImageService;