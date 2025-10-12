// Additional AI Agent Functions - Orders, Wishlist, Profile, Notifications
import { supabase } from '../supabase/supabase';
import { useCartStore } from '../../store/cart';
import { useWishlistStore } from '../../store/wishlist';

// Order Management Functions
export async function getOrderDetails(params: any, userId: string) {
  const { order_id } = params;
  
  try {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        master_orders!fk_orders_master_order_id(
          id,
          order_number,
          delivery_batches(batch_number)
        )
      `)
      .eq('id', order_id)
      .eq('user_id', userId)
      .single();

    if (error) throw error;
    return data;
  } catch (error: any) {
    return { error: `Failed to get order details: ${error.message}` };
  }
}

export async function cancelOrder(params: any, userId: string) {
  const { order_id, reason = 'Cancelled by user' } = params;
  
  try {
    // Check if order can be cancelled
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('status')
      .eq('id', order_id)
      .eq('user_id', userId)
      .single();

    if (fetchError) throw fetchError;
    
    if (order.status !== 'pending') {
      throw new Error('Only pending orders can be cancelled');
    }

    const { error } = await supabase
      .from('orders')
      .update({ 
        status: 'cancelled',
        cancellation_reason: reason
      })
      .eq('id', order_id)
      .eq('user_id', userId);

    if (error) throw error;

    return {
      message: 'Order cancelled successfully',
      order_id,
      reason
    };
  } catch (error: any) {
    return { error: `Failed to cancel order: ${error.message}` };
  }
}

export async function reorderPreviousOrder(params: any, userId: string) {
  const { order_id } = params;
  
  try {
    // Get original order
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', order_id)
      .eq('user_id', userId)
      .single();

    if (fetchError) throw fetchError;

    // Add items to cart
    const cartStore = useCartStore.getState();
    
    for (const item of order.items) {
      const cartItem = {
        uniqueId: '',
        product_id: item.product_id,
        name: item.name,
        price: item.price.toString(),
        quantity: item.quantity,
        image_url: '',
        unit: item.unit || '',
        seller_id: order.seller_id
      };
      
      await cartStore.addToCart(cartItem);
    }

    return {
      message: 'Items from previous order added to cart',
      items_added: order.items.length
    };
  } catch (error: any) {
    return { error: `Failed to reorder: ${error.message}` };
  }
}

export async function trackOrder(params: any, userId: string) {
  const { order_id } = params;
  
  try {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        status,
        created_at,
        delivery_address,
        master_orders!fk_orders_master_order_id(
          id,
          order_number,
          delivery_batches(
            batch_number,
            status,
            estimated_delivery_time
          )
        )
      `)
      .eq('id', order_id)
      .eq('user_id', userId)
      .single();

    if (error) throw error;
    return data;
  } catch (error: any) {
    return { error: `Failed to track order: ${error.message}` };
  }
}

// Wishlist Functions
export async function addToWishlist(params: any, userId: string) {
  const { product_id } = params;
  
  try {
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('*')
      .eq('id', product_id)
      .single();

    if (productError) throw productError;

    const wishlistStore = useWishlistStore.getState();
    await wishlistStore.addToWishlist(product);

    return {
      message: 'Product added to wishlist',
      product_id
    };
  } catch (error: any) {
    return { error: `Failed to add to wishlist: ${error.message}` };
  }
}

export async function removeFromWishlistFunc(params: any, userId: string) {
  const { product_id } = params;
  
  try {
    const wishlistStore = useWishlistStore.getState();
    await wishlistStore.removeFromWishlist(product_id);

    return {
      message: 'Product removed from wishlist',
      product_id
    };
  } catch (error: any) {
    return { error: `Failed to remove from wishlist: ${error.message}` };
  }
}

export async function getWishlist(userId: string) {
  try {
    const { data, error } = await supabase
      .from('wishlist')
      .select(`
        product_id,
        products (
          id, name, price, image_url, category,
          unit, min_quantity, seller_id
        )
      `)
      .eq('user_id', userId);

    if (error) throw error;
    
    return data.map(item => item.products);
  } catch (error: any) {
    return { error: `Failed to get wishlist: ${error.message}` };
  }
}

export async function moveWishlistToCart(params: any, userId: string) {
  const { product_id, quantity = 1 } = params;
  
  try {
    // Get product details
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('*')
      .eq('id', product_id)
        .single();

    if (productError) throw productError;

    // Add to cart
    const cartStore = useCartStore.getState();
    await cartStore.addToCart({
      uniqueId: '',
      product_id: product.id,
      name: product.name,
      price: product.price.toString(),
      quantity,
      image_url: product.image_url || '',
      unit: product.unit || '',
      seller_id: product.seller_id
    });

    // Remove from wishlist
    const wishlistStore = useWishlistStore.getState();
    await wishlistStore.removeFromWishlist(product_id);

    return {
      message: 'Product moved from wishlist to cart',
      product_id,
      quantity
    };
  } catch (error: any) {
    return { error: `Failed to move to cart: ${error.message}` };
  }
}

// Profile Functions
export async function getUserProfile(userId: string) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data;
  } catch (error: any) {
    return { error: `Failed to get profile: ${error.message}` };
  }
}

export async function updateUserProfile(params: any, userId: string) {
  const { shop_name, phone_number, address, city, state, pincode } = params;
  
  try {
    const updates: any = {};
    
    if (shop_name) {
      updates.business_details = { shopName: shop_name };
    }
    if (phone_number) {
      updates.phone_number = phone_number;
    }
    if (address || city || state || pincode) {
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('business_details')
        .eq('id', userId)
        .single();
        
      updates.business_details = {
        ...currentProfile?.business_details,
        address: address || currentProfile?.business_details?.address,
        city: city || currentProfile?.business_details?.city,
        state: state || currentProfile?.business_details?.state,
        pincode: pincode || currentProfile?.business_details?.pincode
      };
    }

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId);

    if (error) throw error;

    return {
      message: 'Profile updated successfully',
      updated_fields: Object.keys(updates)
    };
  } catch (error: any) {
    return { error: `Failed to update profile: ${error.message}` };
  }
}

// Notification Functions
export async function getNotifications(params: any, userId: string) {
  const { limit = 20, unread_only = false } = params;
  
  try {
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (unread_only) {
      query = query.eq('is_read', false);
    }

    const { data, error } = await query;
    
    if (error) throw error;
    return data || [];
  } catch (error: any) {
    return { error: `Failed to get notifications: ${error.message}` };
  }
}

export async function markNotificationRead(params: any, userId: string) {
  const { notification_id } = params;
  
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notification_id)
      .eq('user_id', userId);

    if (error) throw error;

    return {
      message: 'Notification marked as read',
      notification_id
    };
  } catch (error: any) {
    return { error: `Failed to mark notification as read: ${error.message}` };
  }
}

export async function markAllNotificationsRead(userId: string) {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) throw error;

    return {
      message: 'All notifications marked as read'
    };
  } catch (error: any) {
    return { error: `Failed to mark all notifications as read: ${error.message}` };
  }
}
