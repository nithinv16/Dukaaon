/**
 * Enhanced Context Service for Dai AI Assistant
 * 
 * Provides comprehensive user context including:
 * - User profile and preferences
 * - Order history and patterns
 * - Behavioral patterns
 * - Learned preferences
 * - Contextual information
 */

import { supabase } from '../supabase/supabase';

export interface UserProfile {
  id: string;
  role: string;
  business_name: string;
  location: {
    latitude: number;
    longitude: number;
    address: string;
    city: string;
    state: string;
  };
  language: string;
  preferences: Record<string, any>;
}

export interface CartItem {
  id: string;
  product_id: string;
  quantity: number;
  product?: {
    name: string;
    price: number;
    category: string;
  };
}

export interface CurrentCart {
  items: CartItem[];
  total: number;
  item_count: number;
  estimated_delivery?: string;
}

export interface OrderHistoryPatterns {
  recent_orders: any[];
  total_orders: number;
  average_order_value: number;
  favorite_categories: string[];
  favorite_brands: string[];
  preferred_sellers: string[];
  ordering_frequency: 'daily' | 'weekly' | 'monthly' | 'occasional';
  typical_order_size: number;
  seasonal_patterns: Record<string, number>;
}

export interface BehaviorPatterns {
  preferred_order_time: string[];
  preferred_payment_method: string;
  browsing_history: any[];
  search_patterns: string[];
  abandoned_carts: number;
  repeat_purchase_rate: number;
}

export interface LearnedPreferences {
  price_sensitivity: 'low' | 'medium' | 'high';
  quality_preference: 'premium' | 'standard' | 'budget';
  brand_loyalty: Record<string, number>;
  category_preferences: Record<string, number>;
  delivery_speed_preference: 'fast' | 'standard' | 'flexible';
  bulk_buying_tendency: boolean;
}

export interface ContextualInfo {
  current_time: string;
  day_of_week: string;
  season: string;
  upcoming_events?: string[];
  stockout_alerts?: string[];
  price_drops?: string[];
  new_products_available?: string[];
}

export interface ConversationContext {
  current_conversation_id: string;
  conversation_topic: string;
  mentioned_products: string[];
  mentioned_categories: string[];
  user_intent: string;
  conversation_summary?: string;
}

export interface EnhancedUserContext {
  user_profile: UserProfile;
  current_cart: CurrentCart;
  order_history: OrderHistoryPatterns;
  behavior_patterns: BehaviorPatterns;
  learned_preferences: LearnedPreferences;
  contextual_info: ContextualInfo;
  conversation_context: ConversationContext;
}

export class EnhancedContextService {
  /**
   * Get comprehensive user context
   */
  async getUserContext(userId: string): Promise<EnhancedUserContext> {
    try {
      // Parallel data fetching for performance
      const [
        profile,
        cart,
        orders,
        browsingHistory,
        preferences
      ] = await Promise.all([
        this.getUserProfile(userId),
        this.getCurrentCart(userId),
        this.getOrderHistory(userId),
        this.getBrowsingHistory(userId),
        this.getLearnedPreferences(userId)
      ]);

      // Analyze patterns
      const orderPatterns = this.analyzeOrderPatterns(orders);
      const behaviorPatterns = await this.analyzeBehaviorPatterns(userId, orders, browsingHistory);
      const contextualInfo = this.getContextualInfo();

      return {
        user_profile: profile,
        current_cart: cart,
        order_history: orderPatterns,
        behavior_patterns: behaviorPatterns,
        learned_preferences: preferences,
        contextual_info: contextualInfo,
        conversation_context: {
          current_conversation_id: '',
          conversation_topic: '',
          mentioned_products: [],
          mentioned_categories: [],
          user_intent: ''
        }
      };
    } catch (error) {
      console.error('[EnhancedContextService] Error getting user context:', error);
      // Return minimal context on error
      return this.getMinimalContext(userId);
    }
  }

  /**
   * Get user profile with location
   */
  private async getUserProfile(userId: string): Promise<UserProfile> {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !profile) {
      throw new Error('User profile not found');
    }

    const businessDetails = profile.business_details || {};
    const location = profile.seller_details?.[0] || {};

    return {
      id: profile.id,
      role: profile.role || 'retailer',
      business_name: businessDetails.shopName || location.business_name || 'Unknown Business',
      location: {
        latitude: location.latitude || businessDetails.latitude || profile.latitude || 0,
        longitude: location.longitude || businessDetails.longitude || profile.longitude || 0,
        address: businessDetails.address || location.address || 'Address not specified',
        city: businessDetails.city || location.city || 'City not specified',
        state: businessDetails.state || location.state || 'State not specified'
      },
      language: profile.language || 'en',
      preferences: profile.preferences || {}
    };
  }

  /**
   * Get current cart
   */
  private async getCurrentCart(userId: string): Promise<CurrentCart> {
    const { data: cartItems, error } = await supabase
      .from('cart_items')
      .select(`
        id,
        product_id,
        quantity,
        products (
          name,
          price,
          category
        )
      `)
      .eq('user_id', userId);

    if (error || !cartItems) {
      return {
        items: [],
        total: 0,
        item_count: 0
      };
    }

    const items = cartItems.map(item => ({
      id: item.id,
      product_id: item.product_id,
      quantity: item.quantity,
      product: item.products ? {
        name: item.products.name,
        price: item.products.price,
        category: item.products.category
      } : undefined
    }));

    const total = items.reduce((sum, item) => {
      const price = item.product?.price || 0;
      return sum + (price * item.quantity);
    }, 0);

    return {
      items,
      total,
      item_count: items.length
    };
  }

  /**
   * Get order history
   */
  private async getOrderHistory(userId: string): Promise<any[]> {
    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          quantity,
          unit_price,
          products (
            id,
            name,
            category,
            brand
          )
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error || !orders) {
      return [];
    }

    return orders.map(order => ({
      ...order,
      items: order.order_items?.map((item: any) => ({
        ...item,
        product: item.products
      })) || []
    }));
  }

  /**
   * Get browsing history (product views, searches)
   */
  private async getBrowsingHistory(userId: string): Promise<any[]> {
    // Get recent behavior logs
    const { data: logs, error } = await supabase
      .from('user_behavior_logs')
      .select('*')
      .eq('user_id', userId)
      .in('action_type', ['view_product', 'search'])
      .order('created_at', { ascending: false })
      .limit(50);

    if (error || !logs) {
      return [];
    }

    return logs;
  }

  /**
   * Analyze order patterns
   */
  private analyzeOrderPatterns(orders: any[]): OrderHistoryPatterns {
    if (orders.length === 0) {
      return {
        recent_orders: [],
        total_orders: 0,
        average_order_value: 0,
        favorite_categories: [],
        favorite_brands: [],
        preferred_sellers: [],
        ordering_frequency: 'occasional',
        typical_order_size: 0,
        seasonal_patterns: {}
      };
    }

    // Calculate statistics
    const totalValue = orders.reduce((sum, order) => sum + (order.total || order.total_amount || 0), 0);
    const avgOrderValue = totalValue / orders.length;
    
    // Extract categories, brands, and sellers
    const categoryCounts: Record<string, number> = {};
    const brandCounts: Record<string, number> = {};
    const sellerCounts: Record<string, number> = {};
    
    orders.forEach(order => {
      order.items?.forEach((item: any) => {
        // Count categories
        if (item.product?.category) {
          categoryCounts[item.product.category] = 
            (categoryCounts[item.product.category] || 0) + item.quantity;
        }
        // Count brands
        if (item.product?.brand) {
          brandCounts[item.product.brand] = 
            (brandCounts[item.product.brand] || 0) + item.quantity;
        }
      });
      
      // Count sellers
      if (order.seller_id) {
        sellerCounts[order.seller_id] = (sellerCounts[order.seller_id] || 0) + 1;
      }
    });

    // Determine ordering frequency
    const orderDates = orders
      .map(o => new Date(o.created_at))
      .filter(d => !isNaN(d.getTime()));
    
    const daysBetween = this.calculateAverageDaysBetween(orderDates);
    const orderingFrequency = 
      daysBetween <= 1 ? 'daily' :
      daysBetween <= 7 ? 'weekly' :
      daysBetween <= 30 ? 'monthly' : 'occasional';

    return {
      recent_orders: orders.slice(0, 10),
      total_orders: orders.length,
      average_order_value: avgOrderValue,
      favorite_categories: Object.entries(categoryCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([cat]) => cat),
      favorite_brands: Object.entries(brandCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([brand]) => brand),
      preferred_sellers: Object.entries(sellerCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([seller]) => seller),
      ordering_frequency: orderingFrequency,
      typical_order_size: orders.reduce((sum, o) => 
        sum + (o.items?.length || 0), 0) / orders.length,
      seasonal_patterns: this.analyzeSeasonalPatterns(orders)
    };
  }

  /**
   * Analyze behavioral patterns
   */
  private async analyzeBehaviorPatterns(
    userId: string,
    orders: any[],
    browsingHistory: any[]
  ): Promise<BehaviorPatterns> {
    // Analyze order times
    const orderTimes = orders
      .map(o => {
        const date = new Date(o.created_at);
        if (isNaN(date.getTime())) return null;
        const hour = date.getHours();
        return hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
      })
      .filter((time): time is string => time !== null);
    
    const timeCounts = orderTimes.reduce((acc, time) => {
      acc[time] = (acc[time] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const preferredOrderTime = Object.entries(timeCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([time]) => time);

    // Analyze payment methods
    const paymentMethods = orders
      .map(o => o.payment_method || 'cod')
      .filter(Boolean);
    
    const paymentCounts = paymentMethods.reduce((acc, method) => {
      acc[method] = (acc[method] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const preferredPayment = Object.entries(paymentCounts)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || 'cod';

    // Calculate repeat purchase rate
    const productIds = new Set<string>();
    orders.forEach(o => {
      o.items?.forEach((item: any) => {
        if (item.product_id || item.product?.id) {
          productIds.add(item.product_id || item.product.id);
        }
      });
    });
    
    const uniqueProducts = productIds.size;
    const totalProducts = orders.reduce((sum, o) => 
      sum + (o.items?.length || 0), 0);
    
    const repeatRate = uniqueProducts > 0 && totalProducts > 0
      ? (totalProducts - uniqueProducts) / totalProducts
      : 0;

    // Extract search patterns
    const searchPatterns = this.extractSearchPatterns(browsingHistory);

    // Get abandoned cart count
    const abandonedCarts = await this.getAbandonedCartCount(userId);

    return {
      preferred_order_time: preferredOrderTime,
      preferred_payment_method: preferredPayment,
      browsing_history: browsingHistory.slice(0, 20),
      search_patterns: searchPatterns,
      abandoned_carts: abandonedCarts,
      repeat_purchase_rate: repeatRate
    };
  }

  /**
   * Get learned preferences
   */
  private async getLearnedPreferences(userId: string): Promise<LearnedPreferences> {
    // Try to get from database
    const { data } = await supabase
      .from('user_preferences')
      .select('preferences')
      .eq('user_id', userId)
      .single();

    if (data?.preferences) {
      try {
        const prefs = typeof data.preferences === 'string' 
          ? JSON.parse(data.preferences) 
          : data.preferences;
        return this.mergeWithDefaults(prefs);
      } catch (e) {
        console.error('[EnhancedContextService] Error parsing preferences:', e);
      }
    }

    // Calculate from behavior if not stored
    return await this.calculatePreferencesFromBehavior(userId);
  }

  /**
   * Calculate preferences from user behavior
   */
  private async calculatePreferencesFromBehavior(userId: string): Promise<LearnedPreferences> {
    // Get orders to analyze
    const orders = await this.getOrderHistory(userId);
    
    if (orders.length === 0) {
      return this.getDefaultPreferences();
    }

    // Analyze price sensitivity (based on average order value and price ranges)
    const avgOrderValue = orders.reduce((sum, o) => 
      sum + (o.total || o.total_amount || 0), 0) / orders.length;
    
    const priceSensitivity: 'low' | 'medium' | 'high' = 
      avgOrderValue > 10000 ? 'low' :
      avgOrderValue > 5000 ? 'medium' : 'high';

    // Analyze quality preference (based on brand choices)
    const brandCounts: Record<string, number> = {};
    orders.forEach(o => {
      o.items?.forEach((item: any) => {
        if (item.product?.brand) {
          brandCounts[item.product.brand] = (brandCounts[item.product.brand] || 0) + 1;
        }
      });
    });

    // Analyze category preferences
    const categoryCounts: Record<string, number> = {};
    orders.forEach(o => {
      o.items?.forEach((item: any) => {
        if (item.product?.category) {
          categoryCounts[item.product.category] = 
            (categoryCounts[item.product.category] || 0) + item.quantity;
        }
      });
    });

    // Normalize category preferences to 0-1 scale
    const maxCategoryCount = Math.max(...Object.values(categoryCounts), 1);
    const categoryPreferences: Record<string, number> = {};
    Object.entries(categoryCounts).forEach(([cat, count]) => {
      categoryPreferences[cat] = count / maxCategoryCount;
    });

    // Normalize brand loyalty to 0-1 scale
    const maxBrandCount = Math.max(...Object.values(brandCounts), 1);
    const brandLoyalty: Record<string, number> = {};
    Object.entries(brandCounts).forEach(([brand, count]) => {
      brandLoyalty[brand] = count / maxBrandCount;
    });

    return {
      price_sensitivity: priceSensitivity,
      quality_preference: 'standard', // Could be enhanced with product data
      brand_loyalty: brandLoyalty,
      category_preferences: categoryPreferences,
      delivery_speed_preference: 'standard',
      bulk_buying_tendency: avgOrderValue > 5000
    };
  }

  /**
   * Get contextual information
   */
  private getContextualInfo(): ContextualInfo {
    const now = new Date();
    const hour = now.getHours();
    const minutes = now.getMinutes();
    const day = now.getDay();
    const month = now.getMonth();
    
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const seasons = [
      'Winter', 'Winter', 'Spring', 'Spring', 'Spring', 'Summer',
      'Summer', 'Summer', 'Autumn', 'Autumn', 'Autumn', 'Winter'
    ];

    return {
      current_time: `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`,
      day_of_week: dayNames[day],
      season: seasons[month]
    };
  }

  /**
   * Helper methods
   */
  private calculateAverageDaysBetween(dates: Date[]): number {
    if (dates.length < 2) return 30; // Default to monthly
    
    const sortedDates = dates.sort((a, b) => a.getTime() - b.getTime());
    let totalDays = 0;
    
    for (let i = 1; i < sortedDates.length; i++) {
      const diff = sortedDates[i].getTime() - sortedDates[i - 1].getTime();
      totalDays += diff / (1000 * 60 * 60 * 24);
    }
    
    return totalDays / (sortedDates.length - 1);
  }

  private analyzeSeasonalPatterns(orders: any[]): Record<string, number> {
    const monthlyCounts: Record<string, number> = {};
    
    orders.forEach(order => {
      const date = new Date(order.created_at);
      if (isNaN(date.getTime())) return;
      
      const month = date.getMonth();
      const monthName = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                         'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][month];
      
      monthlyCounts[monthName] = (monthlyCounts[monthName] || 0) + 1;
    });
    
    return monthlyCounts;
  }

  private extractSearchPatterns(browsingHistory: any[]): string[] {
    const patterns: string[] = [];
    
    browsingHistory.forEach(log => {
      if (log.action_type === 'search' && log.action_data?.query) {
        patterns.push(log.action_data.query);
      }
    });
    
    // Return unique patterns, most recent first
    return [...new Set(patterns)].slice(0, 10);
  }

  private async getAbandonedCartCount(userId: string): Promise<number> {
    // Count carts that were created but never converted to orders
    // This is a simplified version - can be enhanced
    const { count } = await supabase
      .from('cart_items')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
    
    return count || 0;
  }

  private getDefaultPreferences(): LearnedPreferences {
    return {
      price_sensitivity: 'medium',
      quality_preference: 'standard',
      brand_loyalty: {},
      category_preferences: {},
      delivery_speed_preference: 'standard',
      bulk_buying_tendency: false
    };
  }

  private mergeWithDefaults(prefs: Partial<LearnedPreferences>): LearnedPreferences {
    return {
      ...this.getDefaultPreferences(),
      ...prefs
    };
  }

  private getMinimalContext(userId: string): EnhancedUserContext {
    return {
      user_profile: {
        id: userId,
        role: 'retailer',
        business_name: 'Unknown',
        location: {
          latitude: 0,
          longitude: 0,
          address: '',
          city: '',
          state: ''
        },
        language: 'en',
        preferences: {}
      },
      current_cart: {
        items: [],
        total: 0,
        item_count: 0
      },
      order_history: {
        recent_orders: [],
        total_orders: 0,
        average_order_value: 0,
        favorite_categories: [],
        favorite_brands: [],
        preferred_sellers: [],
        ordering_frequency: 'occasional',
        typical_order_size: 0,
        seasonal_patterns: {}
      },
      behavior_patterns: {
        preferred_order_time: [],
        preferred_payment_method: 'cod',
        browsing_history: [],
        search_patterns: [],
        abandoned_carts: 0,
        repeat_purchase_rate: 0
      },
      learned_preferences: this.getDefaultPreferences(),
      contextual_info: this.getContextualInfo(),
      conversation_context: {
        current_conversation_id: '',
        conversation_topic: '',
        mentioned_products: [],
        mentioned_categories: [],
        user_intent: ''
      }
    };
  }
}

// Export singleton instance
export const enhancedContextService = new EnhancedContextService();

