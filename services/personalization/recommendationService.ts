import { supabase } from '../supabase/supabase';

export interface PurchaseStatistics {
  total_orders: number;
  total_products: number;
  total_spent: number;
  favorite_category: string | null;
  favorite_brand: string | null;
}

export interface FrequentProduct {
  product_id: string;
  purchase_count: number;
  last_purchased_at: string;
  total_quantity: number;
  average_price: number;
}

export interface RecommendedProduct {
  id: string;
  name: string;
  price: number;
  image_url?: string;
  category: string;
  brand?: string;
  score: number;
  reason: string;
}

class RecommendationService {
  /**
   * Track a product view
   */
  async trackProductView(retailerId: string, productId: string): Promise<void> {
    try {
      await supabase.from('product_views').insert({
        retailer_id: retailerId,
        product_id: productId,
        viewed_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error tracking product view:', error);
    }
  }

  /**
   * Track a purchase manually (usually handled by trigger)
   */
  async trackPurchase(
    retailerId: string,
    productId: string,
    orderId: string,
    quantity: number,
    price: number
  ): Promise<void> {
    try {
      await supabase.from('purchase_history').insert({
        retailer_id: retailerId,
        product_id: productId,
        order_id: orderId,
        quantity,
        price,
        purchased_at: new Date().toISOString(),
      });

      // Regenerate recommendations after purchase
      await this.generateRecommendations(retailerId);
    } catch (error) {
      console.error('Error tracking purchase:', error);
    }
  }

  /**
   * Get frequently purchased products for a retailer
   */
  async getFrequentlyPurchasedProducts(
    retailerId: string,
    limit: number = 10
  ): Promise<FrequentProduct[]> {
    try {
      const { data, error } = await supabase.rpc('get_frequently_purchased_products', {
        user_id_param: retailerId,
        limit_param: limit,
      });

      if (error) {
        console.error('Error getting frequently purchased products:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getFrequentlyPurchasedProducts:', error);
      return [];
    }
  }

  /**
   * Get purchase statistics for a retailer
   */
  async getPurchaseStatistics(retailerId: string): Promise<PurchaseStatistics | null> {
    try {
      const { data, error } = await supabase.rpc('get_purchase_statistics', {
        user_id_param: retailerId,
      });

      if (error) {
        console.error('Error getting purchase statistics:', error);
        return null;
      }

      if (data && data.length > 0) {
        return data[0];
      }

      return null;
    } catch (error) {
      console.error('Error in getPurchaseStatistics:', error);
      return null;
    }
  }

  /**
   * Generate recommendations for a retailer
   */
  async generateRecommendations(retailerId: string): Promise<void> {
    try {
      await supabase.rpc('generate_simple_recommendations', {
        user_id_param: retailerId,
      });
    } catch (error) {
      console.error('Error generating recommendations:', error);
    }
  }

  /**
   * Get personalized product recommendations
   */
  async getRecommendedProducts(
    retailerId: string,
    limit: number = 10
  ): Promise<RecommendedProduct[]> {
    try {
      // First, ensure recommendations are generated
      await this.generateRecommendations(retailerId);

      // Fetch recommendations with product details
      const { data, error } = await supabase
        .from('product_recommendations')
        .select(
          `
          product_id,
          score,
          reason,
          products:product_id (
            id,
            name,
            price,
            images,
            category,
            brand
          )
        `
        )
        .eq('retailer_id', retailerId)
        .order('score', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error getting recommendations:', error);
        return [];
      }

      if (!data || data.length === 0) {
        // Fallback: Get trending products
        return this.getTrendingProducts(limit);
      }

      // Format the response
      const recommendations: RecommendedProduct[] = data
        .filter((rec: any) => rec.products)
        .map((rec: any) => ({
          ...rec.products,
          score: rec.score,
          reason: rec.reason,
        }));

      return recommendations;
    } catch (error) {
      console.error('Error in getRecommendedProducts:', error);
      return [];
    }
  }

  /**
   * Get trending products (fallback when no recommendations)
   */
  async getTrendingProducts(limit: number = 10): Promise<RecommendedProduct[]> {
    try {
      // Get products ordered by recent creation or popularity
      const { data, error } = await supabase
        .from('products')
        .select('id, name, price, image_url, category, brand')
        .eq('status', 'available')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error getting trending products:', error);
        return [];
      }

      return (
        data?.map((product) => ({
          ...product,
          score: 1.0,
          reason: 'trending',
        })) || []
      );
    } catch (error) {
      console.error('Error in getTrendingProducts:', error);
      return [];
    }
  }

  /**
   * Get products similar to a given product
   */
  async getSimilarProducts(productId: string, limit: number = 10): Promise<any[]> {
    try {
      // Get the product details
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('category, brand')
        .eq('id', productId)
        .single();

      if (productError || !product) {
        return [];
      }

      // Find similar products in same category
      let query = supabase
        .from('products')
        .select('*')
        .eq('status', 'available')
        .eq('category', product.category)
        .neq('id', productId);

      // Prefer same brand
      if (product.brand) {
        query = query.eq('brand', product.brand);
      }

      const { data, error } = await query.limit(limit);

      if (error) {
        console.error('Error getting similar products:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getSimilarProducts:', error);
      return [];
    }
  }

  /**
   * Get products in retailer's favorite category
   */
  async getProductsInFavoriteCategory(
    retailerId: string,
    limit: number = 10
  ): Promise<any[]> {
    try {
      const stats = await this.getPurchaseStatistics(retailerId);

      if (!stats || !stats.favorite_category) {
        return [];
      }

      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('status', 'available')
        .eq('category', stats.favorite_category)
        .limit(limit);

      if (error) {
        console.error('Error getting products in favorite category:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getProductsInFavoriteCategory:', error);
      return [];
    }
  }

  /**
   * Check if retailer has purchase history
   */
  async hasPurchaseHistory(retailerId: string): Promise<boolean> {
    try {
      const { count, error } = await supabase
        .from('purchase_history')
        .select('*', { count: 'exact', head: true })
        .eq('retailer_id', retailerId);

      if (error) {
        console.error('Error checking purchase history:', error);
        return false;
      }

      return (count || 0) > 0;
    } catch (error) {
      console.error('Error in hasPurchaseHistory:', error);
      return false;
    }
  }
}

export const recommendationService = new RecommendationService();

