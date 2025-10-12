import { createClient } from '@supabase/supabase-js';
import { supabase, storage } from './supabase/supabase';

// Supabase configuration - replace with your own config
const supabaseUrl = 'https://xcpznnkpjgyrpbvpnvit.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjcHpubmtwamd5cnBidnBudml0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg2MTc3MjgsImV4cCI6MjA1NDE5MzcyOH0.1Gg97eXqRmNcZpmKYaBNDozfc_mXrgFv_uHj-br-u_k';

/* 
Required Supabase RLS Policies for orders table:

-- Enable RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Policy to allow all users to view orders (temporary for development)
CREATE POLICY "allow_all_view_orders" ON orders
FOR SELECT
TO anon, authenticated
USING (true);

-- Policy to allow delivery partners to update orders they've accepted
CREATE POLICY "delivery_partners_update_accepted_orders" ON orders
FOR UPDATE
TO authenticated
USING (
  delivery_partner_id::text = auth.uid()::text OR
  (status = 'confirmed' AND delivery_partner_id IS NULL)
)
WITH CHECK (
  (status IN ('accepted', 'picked_up', 'in_transit', 'delivered') AND delivery_partner_id::text = auth.uid()::text) OR
  (status = 'cancelled' AND delivery_partner_id::text = auth.uid()::text)
);
*/

// Debug log to verify supabase is initialized correctly
// Removing excessive logs
// console.log('Supabase client initialized:', !!supabase);

// Helper function to get profile ID from Supabase user ID
// This function now works directly with Supabase user IDs
export const getProfileId = (userId) => {
  try {
    // Return the Supabase user ID directly
    return userId;
  } catch (error) {
    console.error('Error getting profile ID:', error);
    return null;
  }
};

// Add a test function to verify connection
export const testSupabaseConnection = async () => {
  try {
    console.log('Testing Supabase connection...');
    const { data, error } = await supabase
      .from('delivery_partners')
      .select('count')
      .limit(1);
      
    if (error) {
      console.error('Supabase connection test failed:', error);
      return false;
    }
    
    console.log('Supabase connection successful! Data:', data);
    return true;
  } catch (e) {
    console.error('Error testing Supabase connection:', e);
    return false;
  }
};

// User profile operations
export const createUserProfile = async (userData) => {
  try {
    console.log('Creating new user profile with data:', userData);
    
    // Make sure we're using 'id' instead of 'user_id'
    const profileData = {
      ...userData,
      id: userData.user_id, // Use Supabase user ID as the ID
    };
    
    // Remove the user_id field to avoid duplication
    delete profileData.user_id;

    // Ensure id_number is properly converted to integer
    if (profileData.id_number !== undefined) {
      profileData.id_number = Number(profileData.id_number);
      // Validate that it's a valid number
      if (isNaN(profileData.id_number)) {
        throw new Error('id_number must be a valid number');
      }
    }

    console.log('Inserting profile data with id:', profileData.id);
    
    // Insert the profile data directly (no need for UUID conversion)
    const { data, error } = await supabase
      .from('delivery_partners')
      .insert([profileData])
      .select();
    
    if (error) {
      console.error('Error creating profile:', error);
      throw error;
    }
    
    console.log('Profile created successfully:', data[0]);
    return data[0];
  } catch (error) {
    console.error('Error creating user profile:', error);
    throw error;
  }
};

// Function to wrap service methods with detailed logging
const withErrorLogging = (fn, name) => async (...args) => {
  // Removing logs for frequent operations
  // console.log(`📞 Calling ${name} with args:`, args);
  const startTime = Date.now();
  
  try {
    const result = await fn(...args);
    const duration = Date.now() - startTime;
    
    // Only log errors and very slow operations (>500ms)
    if (duration > 500) {
      console.log(`⚠️ ${name} took ${duration}ms to complete`);
    }
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ ${name} failed after ${duration}ms with error:`, error);
    throw error;
  }
};

// Define the original getUserProfile function
export const _getUserProfile = async (userId) => {
  try {
    // Removing frequent logs
    // console.log('Checking for user profile with ID:', userId);
    
    if (!userId) {
      console.error('getUserProfile called with null or undefined userId');
      return null;
    }
    
    // Simple direct query - no UUID conversion needed
    const { data, error } = await supabase
      .from('delivery_partners')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) {
      // If this is a "not found" error, return null
      if (error.code === 'PGRST116') {
        // console.log('Profile not found for ID:', userId);
        return null;
      }
      
      console.error('Error fetching profile:', error);
      throw error;
    }
    
    // console.log('Profile found:', data.id);
    return data;
  } catch (error) {
    console.error('Error getting user profile by ID:', error);
    throw error;
  }
};

// Apply the logging wrapper to create the public getUserProfile function
export const getUserProfile = withErrorLogging(_getUserProfile, 'getUserProfile');

export const getUserProfileByPhone = async (phoneNumber) => {
  try {
    // console.log('Checking for user profile with phone number:', phoneNumber);
    
    // Format the phone number by removing any non-numeric characters
    const cleanedPhoneNumber = phoneNumber.replace(/\D/g, '');
    const lastTenDigits = cleanedPhoneNumber.slice(-10); // Get last 10 digits
    
    // console.log('Cleaned phone number:', cleanedPhoneNumber);
    // console.log('Last 10 digits:', lastTenDigits);
    
    // Try to find by exact match first
    let { data, error } = await supabase
      .from('delivery_partners')
      .select('*')
      .eq('phone_number', phoneNumber);
    
    console.log('Exact match results:', data?.length || 0, 'profiles found');
    
    // If no exact match, try with just the last 10 digits
    if (!data || data.length === 0) {
      console.log('No exact match, trying with last 10 digits contained in phone_number');
      // Use ilike with wildcards to find the phone number anywhere in the string
      ({ data, error } = await supabase
        .from('delivery_partners')
        .select('*')
        .ilike('phone_number', `%${lastTenDigits}%`));
      
      console.log('Partial match results:', data?.length || 0, 'profiles found');
    }
    
    // For any error, throw it
    if (error) {
      console.error('Error in getUserProfileByPhone:', error);
      throw error;
    }
    
    // Return the first user if found, or null if no users were found
    return data && data.length > 0 ? data[0] : null;
  } catch (error) {
    console.error('Error getting user profile by phone number:', error);
    throw error;
  }
};

export const updateUserProfile = async (userId, updates) => {
  try {
    console.log('Updating user profile for ID:', userId, 'with updates:', updates);
    
    // Validate necessary fields
    if (!userId) {
      throw new Error('User ID is required for profile updates');
    }
    
    // Ensure id_number is properly converted to integer if provided
    if (updates.id_number !== undefined) {
      const idNum = Number(updates.id_number);
      // Validate that it's a valid number
      if (isNaN(idNum)) {
        throw new Error('id_number must be a valid number');
      }
      updates.id_number = idNum;
    }
    
    // Add updated_at timestamp if not provided
    if (!updates.updated_at) {
      updates.updated_at = new Date().toISOString();
    }
    
    // Simple direct update - no UUID conversion needed
    const { data, error } = await supabase
      .from('delivery_partners')
      .update(updates)
      .eq('id', userId)
      .select();
    
    if (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
    
    console.log('Profile updated successfully:', data[0]);
    return data[0];
  } catch (error) {
    console.error('Error in updateUserProfile:', error);
    throw error;
  }
};

// Function to fetch detailed order information with all joins
export const getDetailedOrders = async () => {
  try {
    console.log('DEBUG - getDetailedOrders: Fetching detailed order information...');
    
    // Simply get orders with no joins - keep it simple as requested
    const { data: orders, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('ERROR - getDetailedOrders: Error fetching orders:', error);
      throw error;
    }
    
    if (!orders || orders.length === 0) {
      console.log('DEBUG - getDetailedOrders: No orders found');
      return [];
    }
    
    console.log(`DEBUG - getDetailedOrders: Found ${orders.length} orders`);
    
    // Process each order to add pickup details
    const processedOrders = [];
    for (const order of orders) {
      // Copy the order and add estimated earnings
      const processedOrder = {
        ...order,
        estimated_earnings: calculateEstimatedEarnings(order)
      };
      
      // Get seller details for the order
      const { seller, error: sellerError } = await getSellerDetailsByOrderId(order.id);
      
      if (sellerError) {
        console.log(`DEBUG - getDetailedOrders: Used fallback seller details for order ${order.id} due to: ${sellerError}`);
      }
      
      // Add seller information to the order for displaying in the card
      if (seller) {
        processedOrder.seller = seller;
        
        console.log(`DEBUG - getDetailedOrders: Added seller details to order ${order.id}:`, {
          business_name: seller.business_name || 'Not available',
          address: seller.address ? 'Present' : 'Missing'
        });
      } else {
        // Fallback if no seller details found
        processedOrder.seller = {
          business_name: "Store",
          address: "Address unavailable"
        };
      }
      
      processedOrders.push(processedOrder);
    }
    
    return processedOrders;
  } catch (error) {
    console.error('ERROR - getDetailedOrders: Exception:', error);
    return [];
  }
};

// Helper function to calculate estimated earnings
function calculateEstimatedEarnings(order) {
  // Basic calculation based on order amount and distance
  // This can be replaced with your actual earnings calculation logic
  const baseAmount = 50; // Base fee
  const distanceMultiplier = 10; // Amount per KM
  
  // If order has estimated distance, use it for calculation
  const distance = order.estimated_distance || 5; // Default to 5 KM if not available
  
  return baseAmount + (distance * distanceMultiplier);
}

// Helper function to format address from JSON to string
export function formatAddress(addressObj) {
  try {
    if (!addressObj) return 'Address unavailable';
    
    // Handle string addresses
    if (typeof addressObj === 'string') {
      return addressObj;
    }
    
    // Parse JSON string if needed
    let address = addressObj;
    if (typeof addressObj === 'string') {
      try {
        address = JSON.parse(addressObj);
      } catch (e) {
        return addressObj; // If can't parse, return the original string
      }
    }
    
    // Handle possible address formats
    const parts = [];
    
    // Check for common address fields
    if (address.street) parts.push(address.street);
    if (address.line1) parts.push(address.line1);
    if (address.line2) parts.push(address.line2);
    if (address.area) parts.push(address.area);
    if (address.landmark) parts.push(address.landmark);
    if (address.city) parts.push(address.city);
    if (address.state) parts.push(address.state);
    if (address.pincode || address.zip || address.postal_code) {
      parts.push(address.pincode || address.zip || address.postal_code);
    }
    
    // If no structured address, check for flat text
    if (parts.length === 0) {
      if (address.address) return typeof address.address === 'string' ? address.address : 'Address unavailable';
      if (address.formatted_address) return address.formatted_address;
      if (address.full_address) return address.full_address;
    }
    
    return parts.join(', ') || 'Address unavailable';
  } catch (e) {
    console.error('Error formatting address:', e);
    return 'Address unavailable';
  }
}

// Function to fetch available orders for HomeScreen
export const getAvailableOrders = async () => {
  try {
    console.log('DEBUG - Fetching available orders...');
    
    // Get confirmed orders - removed the delivery_partner_id IS NULL filter
    console.log('DEBUG - Querying for orders with status=confirmed...');
    const { data: orders, error } = await supabase
      .from('orders')
      .select('*')
      .eq('status', 'confirmed') 
      // Removed .is('delivery_partner_id', null) to show all confirmed orders
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('ERROR - Error fetching available orders:', error);
      return [];
    }
    
    console.log('DEBUG - Database query response length:', orders ? orders.length : 0);
    
    // If there are orders, log their full details for debugging
    if (orders && orders.length > 0) {
      orders.forEach((order, index) => {
        console.log(`DEBUG - Order ${index+1}:`, {
          id: order.id,
          status: order.status,
          seller_id: order.seller_id,
          user_id: order.user_id,
          delivery_partner_id: order.delivery_partner_id || 'unassigned',
          created_at: order.created_at
        });
      });
      
      // Process orders to add seller and retailer info if needed
      const processedOrders = [];
      
      for (const order of orders) {
        // Get seller details using the enhanced function
        const { seller, error: sellerError } = await getSellerDetailsByOrderId(order.id);
        
        if (sellerError) {
          console.log(`DEBUG - Used fallback seller details for order ${order.id} due to: ${sellerError}`);
        }
        
        // Process the order with seller details
        const processedOrder = {
          ...order,
          seller: seller || { business_name: "Seller", address: "Address unavailable" },
          retailer: { name: "Customer" },
          estimated_earnings: calculateEstimatedEarnings(order)
        };
        
        processedOrders.push(processedOrder);
      }
      
      return processedOrders;
    } else {
      console.log('DEBUG - No available orders found in database.');
      
      // Debug query to check if there are ANY orders in the database
      try {
        console.log('DEBUG - Running diagnostic query for ALL orders...');
        const { data: allOrders, error: allOrdersError } = await supabase
          .from('orders')
          .select('id, status, delivery_partner_id, created_at')
          .order('created_at', { ascending: false })
          .limit(10);
          
        if (allOrdersError) {
          console.error('ERROR - Error fetching all orders:', allOrdersError);
        } else {
          console.log(`DEBUG - Found ${allOrders ? allOrders.length : 0} orders in database`);
          if (allOrders && allOrders.length > 0) {
            console.log('DEBUG - Sample orders in database:');
            allOrders.forEach((order, index) => {
              console.log(`DEBUG - Sample order ${index+1}:`, {
                id: order.id,
                status: order.status,
                delivery_partner_id: order.delivery_partner_id ? 'assigned' : 'unassigned',
                created_at: order.created_at
              });
            });
          }
        }
      } catch (e) {
        console.error('ERROR - Error in diagnostic query:', e);
      }
      
      return [];
    }
  } catch (error) {
    console.error('ERROR - General error in getAvailableOrders:', error);
    return [];
  }
};

/**
 * Get detailed order information by ID
 * Used when viewing order details after accepting an order
 */
export const getOrderById = async (orderId) => {
  try {
    console.log(`DEBUG - getOrderById: Fetching order details for order ${orderId}`);
    
    // Get the order with all its details
    const { data: order, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();
      
    if (error) {
      console.error(`ERROR - getOrderById: Failed to fetch order ${orderId}:`, error);
      return null;
    }
    
    if (!order) {
      console.log(`DEBUG - getOrderById: No order found with ID ${orderId}`);
      return null;
    }
    
    // Get the seller details using the enhanced function
    const { seller, error: sellerError } = await getSellerDetailsByOrderId(orderId);

    // Process the order data similar to getAvailableOrders but for a single order
    const processedOrder = {
      ...order,
      id: order.id,
      orderNumber: order.order_number,
      status: order.status,
      timestamp: order.created_at,
      paymentStatus: order.payment_status,
      estimated_earnings: calculateEstimatedEarnings(order)
    };
    
    // Add seller information from the new function
    if (seller) {
      processedOrder.seller = seller;
      
      // Log success or details about what seller info was found
      if (sellerError) {
        console.log(`DEBUG - getOrderById: Used fallback seller details due to: ${sellerError}`);
      } else {
        console.log(`DEBUG - getOrderById: Successfully added seller details for order ${orderId}`);
      }
    } else {
      // Fallback to minimal seller info if something went wrong
      processedOrder.seller = {
        name: "Store",
        address: "Address unavailable"
      };
      console.error(`ERROR - getOrderById: Failed to retrieve seller details for order ${orderId}`);
    }
    
    // Parse and format delivery address
    if (order.delivery_address) {
      try {
        let deliveryAddr = order.delivery_address;
        if (typeof deliveryAddr === 'string') {
          try {
            deliveryAddr = JSON.parse(deliveryAddr);
          } catch (e) {
            console.log(`DEBUG - getOrderById: Could not parse delivery_address as JSON, keeping as string`);
          }
        }
        
        // Set retailer info for delivery
        processedOrder.retailer = {
          name: order.retailer_name || 'Customer',
          address: formatAddress(deliveryAddr) || 'Address unavailable',
          location: order.retailer_location,
          latitude: deliveryAddr.latitude,
          longitude: deliveryAddr.longitude
        };
      } catch (e) {
        console.error(`ERROR - getOrderById: Error parsing delivery address for order ${order.id}:`, e);
        processedOrder.retailer = {
          name: "Customer",
          address: "Address unavailable"
        };
      }
    } else {
      processedOrder.retailer = {
        name: "Customer",
        address: "Address unavailable"
      };
    }
    
    console.log(`DEBUG - getOrderById: Successfully processed order ${orderId} details`);
    return processedOrder;
  } catch (error) {
    console.error(`ERROR - getOrderById: Exception in processing order ${orderId}:`, error);
    return null;
  }
};

export const acceptOrder = async (orderId, riderId) => {
  try {
    console.log(`DEBUG - acceptOrder: Starting to accept order ${orderId} for rider ${riderId}`);
    
    // Check if riderId is valid
    if (!riderId) {
      console.error(`ERROR - acceptOrder: Invalid rider ID provided: ${riderId}`);
      return { success: false, error: 'Authentication required. Please log in again.' };
    }
    
    // First check if the order exists and is available
    const { data: order, error: getOrderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();
    
    if (getOrderError) {
      console.error(`ERROR - acceptOrder: Failed to fetch order ${orderId}:`, getOrderError);
      return { success: false, error: 'Failed to fetch order details.' };
    }
    
    if (!order) {
      console.error(`ERROR - acceptOrder: Order ${orderId} not found`);
      return { success: false, error: 'Order not found or has been deleted.' };
    }
    
    if (order.status !== 'confirmed') {
      console.error(`ERROR - acceptOrder: Order ${orderId} is not in confirmed status, current status: ${order.status}`);
      return { success: false, error: 'This order is no longer available for acceptance.' };
    }
    
    if (order.delivery_partner_id && order.delivery_partner_id !== riderId) {
      console.error(`ERROR - acceptOrder: Order ${orderId} already assigned to another rider: ${order.delivery_partner_id}`);
      return { success: false, error: 'This order has already been accepted by another rider.' };
    }
    
    console.log(`DEBUG - acceptOrder: Order ${orderId} validated, proceeding with acceptance`);
    
    // Update the order's status and assign it to the rider
    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'accepted',
        delivery_partner_id: riderId,
        accepted_at: new Date().toISOString()
      })
      .eq('id', orderId)
      .select();
    
    if (updateError) {
      console.error(`ERROR - acceptOrder: Failed to update order ${orderId}:`, updateError);
      return { success: false, error: 'Failed to update order status.' };
    }
    
    console.log(`DEBUG - acceptOrder: Successfully accepted order ${orderId} for rider ${riderId}`);
    return { success: true, data: updatedOrder };
  } catch (error) {
    console.error(`ERROR - acceptOrder: Exception accepting order ${orderId}:`, error);
    return { success: false, error: 'An unexpected error occurred. Please try again.' };
  }
};

export const updateOrderStatus = async (orderId, status, statusDetails = {}) => {
  try {
    const updates = {
      status,
      ...statusDetails
    };
    
    // Add timestamp based on status
    if (status === 'picked_up') {
      updates.picked_up_at = new Date().toISOString();
    } else if (status === 'in_transit') {
      updates.out_for_delivery_at = new Date().toISOString();
      updates.status = 'in_transit';  // Ensure status matches the policy constraint
      
      // If delivery_otp is provided in statusDetails, include it in the update
      if (statusDetails.delivery_otp) {
        updates.delivery_otp = statusDetails.delivery_otp;
      }
    } else if (status === 'delivered') {
      updates.delivered_at = new Date().toISOString();
    }
    
    const { data, error } = await supabase
      .from('orders')
      .update(updates)
      .eq('id', orderId)
      .select();
    
    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error updating order status:', error);
    return { success: false, error: error.message };
  }
};

// Earnings operations
export const getEarnings = async (deliveryPartnerId, period = 'all') => {
  try {
    let query = supabase
      .from('orders')
      .select('*')
      .eq('delivery_partner_id', deliveryPartnerId)
      .eq('status', 'delivered');
    
    // Filter by period if specified
    if (period === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      query = query.gte('delivered_at', today.toISOString());
    } else if (period === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      query = query.gte('delivered_at', weekAgo.toISOString());
    } else if (period === 'month') {
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      query = query.gte('delivered_at', monthAgo.toISOString());
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error getting earnings:', error);
    throw error;
  }
};

// Add a safe storage helper that won't crash if methods are missing
const safeStorage = {
  buildAvatarPath: (userId, userRole) => {
    try {
      return storage && typeof storage.buildAvatarPath === 'function' 
        ? storage.buildAvatarPath(userId, userRole)
        : userRole === 'retailer'
          ? `retailer/${userId}/avatar/${Date.now()}.jpg`
          : `${userId}/avatar/${Date.now()}.jpg`;
    } catch (error) {
      console.error('Error in buildAvatarPath:', error);
      return userRole === 'retailer'
        ? `retailer/${userId}/avatar/${Date.now()}.jpg`
        : `${userId}/avatar/${Date.now()}.jpg`;
    }
  },
  
  buildShopPath: (userId) => {
    try {
      return storage && typeof storage.buildShopPath === 'function'
        ? storage.buildShopPath(userId)
        : `${userId}/shop/${Date.now()}.jpg`;
    } catch (error) {
      console.error('Error in buildShopPath:', error);
      return `${userId}/shop/${Date.now()}.jpg`;
    }
  },
  
  buildIdPath: (userId, idType) => {
    try {
      return storage && typeof storage.buildIdPath === 'function'
        ? storage.buildIdPath(userId, idType)
        : `${userId}/${idType}_${Date.now()}.jpg`;
    } catch (error) {
      console.error('Error in buildIdPath:', error);
      return `${userId}/${idType}_${Date.now()}.jpg`;
    }
  },
  
  buildProductPath: (userId, productId) => {
    try {
      return storage && typeof storage.buildProductPath === 'function'
        ? storage.buildProductPath(userId, productId)
        : `${userId}/${productId ? `${productId}_` : ''}${Date.now()}.jpg`;
    } catch (error) {
      console.error('Error in buildProductPath:', error);
      return `${userId}/${productId ? `${productId}_` : ''}${Date.now()}.jpg`;
    }
  },
  
  getProfileImageUrl: (userId, fileName, userRole) => {
    try {
      return storage && typeof storage.getProfileImageUrl === 'function'
        ? storage.getProfileImageUrl(userId, fileName, userRole)
        : userRole === 'retailer'
          ? supabase.storage.from('profiles').getPublicUrl(`retailer/${userId}/avatar/${fileName}`).data.publicUrl
          : supabase.storage.from('profiles').getPublicUrl(`${userId}/avatar/${fileName}`).data.publicUrl;
    } catch (error) {
      console.error('Error in getProfileImageUrl:', error);
      return userRole === 'retailer'
        ? supabase.storage.from('profiles').getPublicUrl(`retailer/${userId}/avatar/${fileName}`).data.publicUrl
        : supabase.storage.from('profiles').getPublicUrl(`${userId}/avatar/${fileName}`).data.publicUrl;
    }
  },
  
  getShopImageUrl: (userId, fileName) => {
    try {
      return storage && typeof storage.getShopImageUrl === 'function'
        ? storage.getShopImageUrl(userId, fileName)
        : supabase.storage.from('profiles').getPublicUrl(`${userId}/shop/${fileName}`).data.publicUrl;
    } catch (error) {
      console.error('Error in getShopImageUrl:', error);
      return supabase.storage.from('profiles').getPublicUrl(`${userId}/shop/${fileName}`).data.publicUrl;
    }
  },
  
  getIdImageUrl: (userId, idType) => {
    try {
      return storage && typeof storage.getIdImageUrl === 'function'
        ? storage.getIdImageUrl(userId, idType)
        : supabase.storage.from('id_verification').getPublicUrl(`${userId}/${idType}_latest.jpg`).data.publicUrl;
    } catch (error) {
      console.error('Error in getIdImageUrl:', error);
      return supabase.storage.from('id_verification').getPublicUrl(`${userId}/${idType}_latest.jpg`).data.publicUrl;
    }
  },
  
  getProductImageUrl: (userId, fileName) => {
    try {
      return storage && typeof storage.getProductImageUrl === 'function'
        ? storage.getProductImageUrl(userId, fileName)
        : supabase.storage.from('product-images').getPublicUrl(`${userId}/${fileName}`).data.publicUrl;
    } catch (error) {
      console.error('Error in getProductImageUrl:', error);
      return supabase.storage.from('product-images').getPublicUrl(`${userId}/${fileName}`).data.publicUrl;
    }
  }
};

// Now update the upload functions to use the safe storage helper

/**
 * Uploads a profile image to storage for a user
 * @param {string} userId The user ID
 * @param {string} imageUri The image URI
 * @param {string} userRole The user role (optional)
 * @returns {Promise<{success: boolean, publicUrl: string|null, error: string|null}>} Upload result
 */
export const uploadProfileImage = async (userId, imageUri, userRole) => {
  console.log('uploadProfileImage userId:', userId);
  console.log('uploadProfileImage imageUri:', imageUri);

  try {
    // Check if the image URI is valid
    if (!imageUri || typeof imageUri !== 'string') {
      const errorMsg = 'Invalid image URI provided';
      console.error(errorMsg);
      return { success: false, publicUrl: null, error: errorMsg };
    }

    // Extract file extension from URI and determine MIME type
    const extension = imageUri.split('.').pop() || 'jpg';
    const mimeType = getMimeType(extension);
    
    // Use the storage helper to build the avatar path
    const filePath = safeStorage.buildAvatarPath(userId, userRole);
    console.log('Uploading profile image to path:', filePath);

    // Convert image URI to base64 for reliable upload
    console.log('Converting image to base64...');
    const base64EncodedData = await getBase64FromURI(imageUri);
    
    // Import decode function for base64 to ArrayBuffer conversion
    const { decode } = require('base64-arraybuffer');
    
    console.log('Uploading to Supabase storage...');
    const { data, error } = await supabase.storage
      .from('profiles')
      .upload(filePath, decode(base64EncodedData), {
        contentType: mimeType,
        upsert: true,
      });

    if (error) {
      throw new Error(`Storage upload failed: ${error.message}`);
    }

    console.log('Upload successful:', data);
    const publicUrl = safeStorage.getProfileImageUrl(userId, filePath.split('/').pop(), userRole);
    console.log('Public URL:', publicUrl);
    
    return { success: true, publicUrl, error: null };
  } catch (error) {
    const errorMsg = `Failed to upload profile image: ${error.message}`;
    console.error(errorMsg);
    return { success: false, publicUrl: null, error: errorMsg };
  }
};

/**
 * Uploads an ID image (front, back, or selfie) for a user
 * @param {string} userId - The user's ID
 * @param {string} imageUri - The URI of the image to upload
 * @param {string} idType - The type of ID (front, back, or selfie)
 * @returns {Promise<{success: boolean, publicUrl: string|null, error: string|null}>} 
 */
export const uploadIdImage = async (userId, imageUri, idType) => {
  try {
    // Check if the image URI is valid
    if (!imageUri || typeof imageUri !== 'string') {
      const errorMsg = 'Invalid image URI provided';
      console.error(errorMsg);
      return { success: false, publicUrl: null, error: errorMsg };
    }

    // Validate ID type
    if (!['front', 'back', 'selfie'].includes(idType)) {
      const errorMsg = 'Invalid ID type provided. Must be front, back, or selfie';
      console.error(errorMsg);
      return { success: false, publicUrl: null, error: errorMsg };
    }

    // Extract file extension from URI and determine MIME type
    const extension = imageUri.split('.').pop() || 'jpg';
    const mimeType = getMimeType(extension);
    
    // Use the storage helper to build the ID image path
    // If there's no buildIdPath helper yet, we'll need to preserve the existing path structure
    const filePath = safeStorage.buildIdPath(userId, idType);
    console.log('Uploading ID image to path:', filePath);

    // Try RPC upload first (more efficient)
    try {
      console.log('Attempting RPC upload...');
      const base64EncodedData = await getBase64FromURI(imageUri);
      
      const { data, error } = await supabase.rpc('upload_id_image', {
        user_id: userId,
        file_path: filePath,
        file_mime: mimeType,
        file_data: base64EncodedData,
        id_type: idType
      });

      if (error) {
        throw new Error(`RPC upload failed: ${error.message}`);
      }

      console.log('RPC upload successful:', data);
      // Use the storage helper to get public URL if available
      const publicUrl = safeStorage.getIdImageUrl(userId, idType);
      console.log('Public URL:', publicUrl);
      
      return { success: true, publicUrl, error: null };
    } catch (rpcError) {
      // If RPC upload fails, fallback to direct upload
      console.warn('RPC upload failed, falling back to direct upload:', rpcError.message);
      
      // Convert URI to blob for direct upload
      const blob = await uriToBlob(imageUri);
      
      const { data, error } = await supabase.storage
        .from('id_verification')
        .upload(filePath, blob, {
          contentType: mimeType,
          upsert: true,
        });

      if (error) {
        throw new Error(`Direct upload failed: ${error.message}`);
      }

      console.log('Direct upload successful:', data);
      // Use the storage helper to get public URL if available
      const publicUrl = safeStorage.getIdImageUrl(userId, idType);
      console.log('Public URL:', publicUrl);
      
      return { success: true, publicUrl, error: null };
    }
  } catch (error) {
    const errorMsg = `Failed to upload ID image: ${error.message}`;
    console.error(errorMsg);
    return { success: false, publicUrl: null, error: errorMsg };
  }
};

/**
 * Uploads a product image for a seller/wholesaler
 * @param {string} userId - The user's ID (seller/wholesaler)
 * @param {string} imageUri - The URI of the image to upload
 * @param {string} productId - Optional product ID to associate with the image
 * @returns {Promise<{success: boolean, publicUrl: string|null, error: string|null}>}
 */
export const uploadProductImage = async (userId, imageUri, productId = null, base64Data = null) => {
  console.log('uploadProductImage userId:', userId);
  console.log('uploadProductImage imageUri:', imageUri);
  console.log('uploadProductImage base64Data provided:', !!base64Data);

  try {
    // Check if we have either imageUri or base64Data
    if ((!imageUri || typeof imageUri !== 'string') && !base64Data) {
      const errorMsg = 'Invalid image URI or base64 data provided';
      console.error(errorMsg);
      return { success: false, publicUrl: null, error: errorMsg };
    }

    // Determine MIME type
    const mimeType = 'image/jpeg'; // Default to JPEG for product images
    
    // Use the storage helper to build the product image path
    const filePath = safeStorage.buildProductPath(userId, productId);
    console.log('Uploading product image to path:', filePath);

    let base64EncodedData;
    
    if (base64Data) {
      // Use provided base64 data directly
      console.log('Using provided base64 data...');
      base64EncodedData = base64Data;
    } else {
      // Convert image URI to base64 for reliable upload
      console.log('Converting image URI to base64...');
      base64EncodedData = await getBase64FromURI(imageUri);
    }
    
    // Import decode function for base64 to ArrayBuffer conversion
    const { decode } = require('base64-arraybuffer');
    
    console.log('Uploading to Supabase storage...');
    const { data, error } = await supabase.storage
      .from('product-images')
      .upload(filePath, decode(base64EncodedData), {
        contentType: mimeType,
        upsert: true,
      });

    if (error) {
      throw new Error(`Storage upload failed: ${error.message}`);
    }

    console.log('Upload successful:', data);
    // Extract the filename from the path
    const fileName = filePath.split('/').pop();
    const publicUrl = safeStorage.getProductImageUrl(userId, fileName);
    console.log('Public URL:', publicUrl);
    
    return { success: true, publicUrl, error: null };
  } catch (error) {
    const errorMsg = `Failed to upload product image: ${error.message}`;
    console.error(errorMsg);
    return { success: false, publicUrl: null, error: errorMsg };
  }
};

// Location update function
export const updateDeliveryPartnerLocation = async (partnerId, latitude, longitude) => {
  try {
    if (!partnerId) {
      console.error('No delivery partner ID provided');
      return null;
    }

    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      console.error('Invalid coordinates:', { latitude, longitude });
      return null;
    }

    console.log('Updating location for delivery partner:', {
      partnerId,
      latitude,
      longitude
    });
    
    const { data, error } = await supabase
      .from('delivery_partners')
      .update({
        current_latitude: latitude,
        current_longitude: longitude,
        last_location_update: new Date().toISOString()
      })
      .eq('id', partnerId)
      .select();

    if (error) {
      console.error('Error updating location:', error);
      return null;
    }

    console.log('Location updated successfully:', data?.[0]);
    return data?.[0];
  } catch (error) {
    console.error('Error in updateDeliveryPartnerLocation:', error);
    return null;
  }
};

// Test function to directly check if we can access orders
export const testOrdersAccess = async () => {
  try {
    console.log('Testing direct access to orders table...');
    
    const { data, error, status, statusText } = await supabase
      .from('orders')
      .select('*')
      .limit(5);
    
    if (error) {
      console.error('Error accessing orders:', error);
      console.error('Status:', status, statusText);
      return { success: false, error };
    }
    
    console.log('Successfully accessed orders. Count:', data?.length || 0);
    if (data && data.length > 0) {
      console.log('Sample order:', data[0]);
    }
    
    return { success: true, data };
  } catch (error) {
    console.error('Exception in testOrdersAccess:', error);
    return { success: false, error };
  }
};

/* 
Required Supabase RLS Policies:

-- Check seller_details table structure (important columns)
-- This table should have columns: user_id, business_name, address, latitude, longitude

-- Enable RLS on seller_details table (if not already enabled)
ALTER TABLE seller_details ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all authenticated users to read seller_details
CREATE POLICY "Allow authenticated users to read seller_details"
ON seller_details
FOR SELECT
TO authenticated
USING (true);

-- Enable RLS on orders table (if not already enabled)
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Create policy to allow authenticated users to read orders
CREATE POLICY "Allow authenticated users to read orders"
ON orders
FOR SELECT
TO authenticated
USING (true);

-- Create policy to allow authenticated users to read profiles
CREATE POLICY "Allow authenticated users to read profiles"
ON profiles
FOR SELECT
TO authenticated
USING (true);
*/

// Test function to debug the join between orders, delivery_orders, and deliveries
export const testOrderJoins = async () => {
  try {
    console.log('Testing order joins...');
    
    // First let's check what tables exist and their relationships
    const { data: tables, error: tablesError } = await supabase
      .from('pg_tables')
      .select('schemaname, tablename')
      .eq('schemaname', 'public');
    
    if (tablesError) {
      console.error('Error fetching tables:', tablesError);
    } else {
      console.log('Available tables:', tables.map(t => t.tablename).join(', '));
    }
    
    // Now test a simpler join to see if we can get basic order data
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, order_number, status, total_amount')
      .eq('status', 'confirmed')
      .is('delivery_partner_id', null)
      .limit(5);
    
    if (ordersError) {
      console.error('Error fetching basic orders:', ordersError);
    } else {
      console.log('Basic orders test:', orders);
    }
    
    // Try to get delivery_orders data
    const { data: deliveryOrders, error: deliveryOrdersError } = await supabase
      .from('delivery_orders')
      .select('id, order_id, delivery_id')
      .limit(5);
    
    if (deliveryOrdersError) {
      console.error('Error fetching delivery_orders:', deliveryOrdersError);
    } else {
      console.log('Basic delivery_orders test:', deliveryOrders);
    }
    
    // Try a simple join between orders and delivery_orders
    const { data: joinTest, error: joinError } = await supabase
      .from('orders')
      .select(`
        id, 
        order_number,
        delivery_orders (id, delivery_id)
      `)
      .eq('status', 'confirmed')
      .is('delivery_partner_id', null)
      .limit(5);
    
    if (joinError) {
      console.error('Error testing join:', joinError);
    } else {
      console.log('Join test results:', joinTest);
    }
    
    return { 
      success: true, 
      tables: tables?.map(t => t.tablename) || [],
      orderSample: orders?.[0] || null,
      deliveryOrderSample: deliveryOrders?.[0] || null,
      joinSample: joinTest?.[0] || null
    };
  } catch (error) {
    console.error('Error in testOrderJoins:', error);
    return { success: false, error };
  }
};

// Function to check database structure and tables
export const checkDatabaseStructure = async () => {
  try {
    console.log('Checking database structure...');
    
    // Don't query information_schema, just check if we can access orders table
    console.log('Checking orders table access...');
    
    // Get a sample of orders to check the actual data
    const { data: orderSample, error: sampleError } = await supabase
      .from('orders')
      .select('*')
      .limit(3);
    
    if (sampleError) {
      console.error('Error accessing orders table:', sampleError);
      return { 
        error: sampleError,
        // Add empty arrays for backward compatibility
        sellerDetailsColumns: [],
        sellerDetailsSample: []
      };
    }
    
    console.log('Successfully accessed orders table');
    if (orderSample && orderSample.length > 0) {
      console.log('Sample order fields:', Object.keys(orderSample[0]).join(', '));
      console.log('Sample seller_id:', orderSample[0].seller_id || 'N/A');
    }
    
    // Create mock data for backward compatibility
    // This ensures code that expects these fields won't break
    const mockColumns = [
      { column_name: 'id', data_type: 'uuid' },
      { column_name: 'user_id', data_type: 'uuid' },
      { column_name: 'business_name', data_type: 'text' }
    ];
    
    // Create mock sample data
    const mockSample = orderSample && orderSample.length > 0 ? [
      {
        id: '00000000-0000-0000-0000-000000000000',
        user_id: orderSample[0].seller_id || null,
        business_name: 'Seller Business'
      }
    ] : [];
    
    return {
      success: true,
      message: 'Database access check completed',
      orderFields: orderSample && orderSample.length > 0 ? Object.keys(orderSample[0]) : [],
      // Include these for backward compatibility
      sellerDetailsColumns: mockColumns,
      sellerDetailsSample: mockSample
    };
  } catch (error) {
    console.error('Error checking database structure:', error);
    return { 
      error,
      // Add empty arrays for backward compatibility
      sellerDetailsColumns: [],
      sellerDetailsSample: []
    };
  }
};

// Function to check the orders table for retailer_profile_id
export const checkOrdersTable = async () => {
  try {
    console.log('Checking orders table structure...');
    
    // Simply check if orders table exists and what we can access
    console.log('Fetching sample orders to verify structure...');
    
    // Get a sample of orders to check the actual data
    const { data: orderSample, error: sampleError } = await supabase
      .from('orders')
      .select('*')
      .limit(3);
    
    if (sampleError) {
      console.error('Error getting orders sample:', sampleError);
    } else {
      console.log(`Fetched orders: ${orderSample ? orderSample.length : 0}`);
      
      if (orderSample && orderSample.length > 0) {
        console.log('Sample order contains these fields:', Object.keys(orderSample[0]).join(', '));
        
        // Focus on fields we actually need and use
        orderSample.forEach((order, index) => {
          console.log(`Sample order ${index+1}:`, {
            id: order.id,
            status: order.status || 'N/A',
            delivery_partner_id: order.delivery_partner_id || 'Not assigned',
            user_id: order.user_id || 'N/A'
          });
        });
        
        console.log('Transformed orders:', orderSample.length);
      } else {
        console.log('No sample orders found. Table may be empty.');
      }
    }
    
    return {
      success: true,
      message: 'Check logs for details'
    };
  } catch (error) {
    console.error('Error checking orders table structure:', error);
    return { error };
  }
};

// Function to test retrieving retailer profile using different ID fields
export const testRetailerProfileRetrieval = async () => {
  try {
    console.log('Testing different approaches to retrieve retailer profiles...');
    
    // Get a sample order first
    const { data: orderSample, error: sampleError } = await supabase
      .from('orders')
      .select('*')
      .limit(1)
      .single();
    
    if (sampleError) {
      console.error('Error getting order sample:', sampleError);
      return { success: false, error: sampleError };
    }
    
    if (!orderSample) {
      console.error('No orders found in the database');
      return { success: false, message: 'No orders found' };
    }
    
    console.log('Retrieved sample order with ID:', orderSample.id);
    console.log('Order fields that might contain user IDs:', 
      Object.keys(orderSample)
        .filter(key => 
          key.includes('id') || 
          key.includes('user') || 
          key.includes('customer') || 
          key.includes('retailer')
        )
        .join(', ')
    );
    
    const potentialUserIdFields = [
      'retailer_profile_id',
      'retailer_id',
      'user_id',
      'customer_id',
      'buyer_id'
    ];
    
    // Try each potential field to find a profile
    for (const field of potentialUserIdFields) {
      if (orderSample[field]) {
        console.log(`Testing field '${field}' with value:`, orderSample[field]);
        
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', orderSample[field])
          .single();
        
        if (profileError) {
          console.error(`Error retrieving profile with ${field}:`, profileError);
        } else if (profile) {
          console.log(`Success! Found profile using field '${field}':`);
          console.log('Profile data available:', Object.keys(profile).join(', '));
          console.log('Business details available:', !!profile.business_details);
          
          return { 
            success: true, 
            workingField: field,
            sample: {
              profileId: profile.id,
              hasBusinessDetails: !!profile.business_details
            }
          };
        } else {
          console.log(`No profile found using field '${field}'`);
        }
      } else {
        console.log(`Field '${field}' not present in the order data`);
      }
    }
    
    console.log('Could not find any working field to retrieve retailer profiles');
    return { 
      success: false, 
      message: 'No working field found' 
    };
  } catch (error) {
    console.error('Error in testRetailerProfileRetrieval:', error);
    return { success: false, error };
  }
};

// Function to get order pickup details through the proper join path
export const getOrderPickupDetailsWithCorrectJoin = async (orderId) => {
  try {
    console.log('DEBUG - Fetching pickup details for order with correct join path:', orderId);
    
    // First, get the order to find the seller_id
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, seller_id, order_number')
      .eq('id', orderId)
      .single();
    
    if (orderError) {
      console.error(`ERROR - Error fetching order ${orderId}:`, orderError);
      // Return fallback pickup details instead of error to avoid breaking UI
      return { 
        pickupDetails: {
          business_name: "Store", 
          address: { street: "Address unavailable" },
          latitude: null,
          longitude: null
        },
        error: orderError 
      };
    }
    
    if (!order) {
      console.error(`ERROR - Order ${orderId} not found`);
      // Return fallback pickup details
      return { 
        pickupDetails: {
          business_name: "Store", 
          address: { street: "Address unavailable" },
          latitude: null,
          longitude: null
        },
        error: 'Order not found' 
      };
    }
    
    if (!order.seller_id) {
      console.error(`ERROR - Order ${orderId} (order number: ${order.order_number || 'unknown'}) has no seller_id`);
      // Return fallback pickup details with more specific naming
      return { 
        pickupDetails: {
          business_name: `Order #${order.order_number || orderId}`, 
          address: { street: "Seller information unavailable" },
          latitude: null,
          longitude: null
        },
        error: 'Order missing seller_id' 
      };
    }
    
    console.log(`DEBUG - Found order ${orderId} with seller_id: ${order.seller_id}`);
    
    // Now fetch seller details with the correct join path:
    // 1. seller_id in orders = id in profiles
    // 2. id in profiles = user_id in seller_details
    
    // Confirm the seller_id exists in profiles
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', order.seller_id)
      .single();
    
    if (profileError) {
      console.error(`ERROR - Error fetching seller profile for seller_id ${order.seller_id}:`, profileError);
      // Return fallback pickup details
      return { 
        pickupDetails: {
          business_name: `Order #${order.order_number || orderId}`, 
          address: { street: "Seller profile unavailable" },
          latitude: null,
          longitude: null
        },
        error: profileError 
      };
    }
    
    if (!profile) {
      console.error(`ERROR - Seller profile not found with id: ${order.seller_id}`);
      // Return fallback pickup details
      return { 
        pickupDetails: {
          business_name: `Order #${order.order_number || orderId}`, 
          address: { street: "Seller profile not found" },
          latitude: null,
          longitude: null
        },
        error: 'Seller profile not found' 
      };
    }
    
    console.log(`DEBUG - Found seller profile for ${order.seller_id}, now checking seller_details`);
    
    // Now get the seller details using the user_id relationship
    const { data: sellerDetails, error: sellerError } = await supabase
      .from('seller_details')
      .select('business_name, address, latitude, longitude')
      .eq('user_id', profile.id)
      .single();
    
    if (sellerError) {
      console.error(`ERROR - Error fetching seller details for user_id ${profile.id}:`, sellerError);
      
      // Return with profile info but without seller details
      return {
        error: 'Seller details not found',
        seller: {
          business_name: profile.owner_name || `Store #${order.order_number}`,
          address: { street: "Address unavailable" },
          phone: profile.phone_number,
          latitude: null,
          longitude: null
        }
      };
    }
    
    if (!sellerDetails) {
      console.error(`ERROR - getSellerDetailsByOrderId: No seller_details found for user_id ${profile.id}`);
      
      // Return with profile info but without seller details
      return {
        error: 'Seller details not found',
        seller: {
          business_name: `Store #${order.order_number}`,
          address: { street: "Address unavailable" },
          phone: profile.phone_number,
          latitude: null,
          longitude: null
        }
      };
    }
    
    console.log('DEBUG - getSellerDetailsByOrderId: Successfully fetched seller details for order ${orderId}');
    
    // Parse address - handle both JSON strings and plain text
    let addressData = sellerDetails.address;
    
    if (typeof addressData === 'string') {
      // Check if it looks like JSON (starts with { or [)
      if (addressData.trim().startsWith('{') || addressData.trim().startsWith('[')) {
        try {
          addressData = JSON.parse(addressData);
        } catch (e) {
          console.error(`ERROR - getSellerDetailsByOrderId: Error parsing address JSON for seller ${profile.id}:`, e);
          console.log(`DEBUG - Raw address data: "${addressData}"`);
          // If JSON parsing fails, treat as plain text address
          addressData = { street: addressData || "Address unavailable" };
        }
      } else {
        // It's plain text, not JSON - wrap it in an object
        console.log(`DEBUG - getSellerDetailsByOrderId: Address is plain text for seller ${profile.id}: "${addressData}"`);
        addressData = { street: addressData || "Address unavailable" };
      }
    } else if (addressData && typeof addressData === 'object') {
      // It's already an object, use as-is
      console.log(`DEBUG - getSellerDetailsByOrderId: Address is already an object for seller ${profile.id}`);
    } else {
      // It's null, undefined, or some other type
      console.log(`DEBUG - getSellerDetailsByOrderId: Address is null/undefined for seller ${profile.id}`);
      addressData = { street: "Address unavailable" };
    }
    
    return {
      pickupDetails: {
        business_name: sellerDetails.business_name || sellerDetails.owner_name || `Store #${order.order_number}`,
        address: addressData,
        latitude: sellerDetails.latitude ? parseFloat(sellerDetails.latitude) : null,
        longitude: sellerDetails.longitude ? parseFloat(sellerDetails.longitude) : null
      }
    };
  } catch (error) {
    console.error(`ERROR - Exception in getOrderPickupDetailsWithCorrectJoin for order ${orderId}:`, error);
    // Return fallback pickup details instead of error
    return { 
      pickupDetails: {
        business_name: "Store", 
        address: { street: "Address unavailable" },
        latitude: null,
        longitude: null
      },
      error: error 
    };
  }
};

// Function to get seller location details
export const getSellerLocationDetails = async (sellerId) => {
  try {
    console.log(`DEBUG - Fetching seller location details for seller_id: ${sellerId}`);
    
    if (!sellerId) {
      console.error('ERROR - No seller ID provided to getSellerLocationDetails');
      return {
        error: 'No seller ID provided',
        latitude: null,
        longitude: null
      };
    }

    // First check if seller exists in profiles
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', sellerId)
      .single();
      
    if (profileError || !profileData) {
      console.error(`ERROR - Seller profile with ID ${sellerId} not found:`, profileError || 'No data returned');
      return {
        error: 'Seller profile not found',
        latitude: null,
        longitude: null
      };
    }

    // Now get seller location from seller_details
    const { data, error } = await supabase
      .from('seller_details')
      .select('latitude, longitude')
      .eq('user_id', sellerId)
      .single();

    if (error) {
      console.error(`ERROR - Failed to fetch seller location for seller_id ${sellerId}:`, error);
      return {
        error: 'Database error fetching seller location',
        latitude: null,
        longitude: null
      };
    }

    if (!data) {
      console.log(`DEBUG - No seller location record found for seller_id: ${sellerId}`);
      return {
        error: 'No seller location data found',
        latitude: null,
        longitude: null
      };
    }

    if (!data.latitude || !data.longitude) {
      console.log(`DEBUG - Seller with ID ${sellerId} has null coordinates:`, data);
      return {
        error: 'Seller has no coordinates',
        latitude: null,
        longitude: null
      };
    }

    console.log(`DEBUG - Found seller location for ${sellerId}:`, data);
    return {
      latitude: parseFloat(data.latitude),
      longitude: parseFloat(data.longitude)
    };
  } catch (error) {
    console.error(`ERROR - Exception in getSellerLocationDetails for seller_id ${sellerId}:`, error);
    return {
      error: 'Exception in getSellerLocationDetails',
      latitude: null,
      longitude: null
    };
  }
};

// Function to get seller details by order ID - simplified to use proper relations
export const getSellerDetailsByOrderId = async (orderId) => {
  try {
    console.log(`DEBUG - getSellerDetailsByOrderId: Fetching details for order ${orderId}`);
    
    if (!orderId) {
      console.error('ERROR - getSellerDetailsByOrderId: No order ID provided');
      return {
        error: 'No order ID provided',
        seller: {
          business_name: "Unknown Store",
          address: { street: "Address unavailable" },
          latitude: null,
          longitude: null
        }
      };
    }
    
    // First, get the order to find the seller_id
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, order_number, seller_id')
      .eq('id', orderId)
      .single();
    
    if (orderError) {
      console.error(`ERROR - getSellerDetailsByOrderId: Error fetching order ${orderId}:`, orderError);
      return {
        error: 'Failed to fetch order details',
        seller: {
          business_name: "Unknown Store",
          address: { street: "Address unavailable" },
          latitude: null,
          longitude: null
        }
      };
    }
    
    if (!order) {
      console.error(`ERROR - getSellerDetailsByOrderId: Order ${orderId} not found`);
      return {
        error: 'Order not found',
        seller: {
          business_name: "Unknown Store",
          address: { street: "Address unavailable" },
          latitude: null,
          longitude: null
        }
      };
    }
    
    // If no seller_id in order, return with fallback details
    if (!order.seller_id) {
      console.log(`DEBUG - getSellerDetailsByOrderId: Order ${orderId} has no seller_id, using fallback details`);
      
      return {
        error: 'No seller_id in order',
        seller: {
          business_name: `Store #${order.order_number || orderId.substring(0, 8)}`,
          address: { street: "Address unavailable" },
          latitude: null,
          longitude: null
        }
      };
    }
    
    // We have a seller_id, fetch the profile and seller details in one query
    console.log(`DEBUG - getSellerDetailsByOrderId: Fetching profile and seller details for seller_id ${order.seller_id}`);
    
    // First get the seller profile info - only get id and phone_number
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, phone_number')
      .eq('id', order.seller_id)
      .single();
    
    if (profileError || !profile) {
      console.error(`ERROR - getSellerDetailsByOrderId: Error fetching profile for seller_id ${order.seller_id}:`, profileError || 'No profile found');
      
      return {
        error: profileError ? 'Error fetching seller profile' : 'Seller profile not found',
        seller: {
          business_name: `Store #${order.order_number}`,
          address: { street: "Address unavailable" },
          latitude: null,
          longitude: null
        }
      };
    }
    
    // Now get the seller details using the seller_details table with user_id relation
    const { data: sellerDetails, error: sellerError } = await supabase
      .from('seller_details')
      .select('business_name, owner_name, address, latitude, longitude')
      .eq('user_id', profile.id)
      .single();
    
    if (sellerError) {
      console.error(`ERROR - getSellerDetailsByOrderId: Error fetching seller_details for user_id ${profile.id}:`, sellerError);
      
      // Return with profile info but without seller details
      return {
        error: 'Failed to fetch seller details',
        seller: {
          business_name: `Store #${order.order_number}`,
          address: { street: "Address unavailable" },
          phone: profile.phone_number,
          latitude: null,
          longitude: null
        }
      };
    }
    
    if (!sellerDetails) {
      console.error(`ERROR - getSellerDetailsByOrderId: No seller_details found for user_id ${profile.id}`);
      
      // Return with profile info but without seller details
      return {
        error: 'Seller details not found',
        seller: {
          business_name: `Store #${order.order_number}`,
          address: { street: "Address unavailable" },
          phone: profile.phone_number,
          latitude: null,
          longitude: null
        }
      };
    }
    
    console.log(`DEBUG - getSellerDetailsByOrderId: Successfully fetched seller details for order ${orderId}`);
    
    // Parse address - handle both JSON strings and plain text
    let addressData = sellerDetails.address;
    if (typeof addressData === 'string') {
      // Check if it looks like JSON (starts with { or [)
      if (addressData.trim().startsWith('{') || addressData.trim().startsWith('[')) {
        try {
          addressData = JSON.parse(addressData);
        } catch (e) {
          console.error(`ERROR - getSellerDetailsByOrderId: Error parsing address JSON for seller ${profile.id}:`, e);
          console.log(`DEBUG - Raw address data: "${addressData}"`);
          // If JSON parsing fails, treat as plain text address
          addressData = { street: addressData || "Address unavailable" };
        }
      } else {
        // It's plain text, not JSON - wrap it in an object
        console.log(`DEBUG - getSellerDetailsByOrderId: Address is plain text for seller ${profile.id}: "${addressData}"`);
        addressData = { street: addressData || "Address unavailable" };
      }
    } else if (addressData && typeof addressData === 'object') {
      // It's already an object, use as-is
      console.log(`DEBUG - getSellerDetailsByOrderId: Address is already an object for seller ${profile.id}`);
    } else {
      // It's null, undefined, or some other type
      console.log(`DEBUG - getSellerDetailsByOrderId: Address is null/undefined for seller ${profile.id}`);
      addressData = { street: "Address unavailable" };
    }
    
    // If address is still undefined or null, use a fallback
    if (!addressData) {
      addressData = { street: "Address unavailable" };
    }
    
    // Return complete seller details
    return {
      seller: {
        business_name: sellerDetails.business_name || sellerDetails.owner_name || `Store #${order.order_number}`,
        address: addressData,
        phone: profile.phone_number,
        latitude: sellerDetails.latitude ? parseFloat(sellerDetails.latitude) : null,
        longitude: sellerDetails.longitude ? parseFloat(sellerDetails.longitude) : null
      }
    };
  } catch (error) {
    console.error(`ERROR - getSellerDetailsByOrderId: Exception for order ${orderId}:`, error);
    return {
      error: `Exception: ${error.message}`,
      seller: {
        business_name: "Unknown Store",
        address: { street: "Address unavailable" },
        latitude: null,
        longitude: null
      }
    };
  }
};

// Enhanced function to fetch the user's current active order with better error handling
export const getUserCurrentOrder = async (userId) => {
  try {
    console.log('Fetching current active order for user ID:', userId);
    
    if (!userId) {
      console.error('No user ID provided to getUserCurrentOrder');
      return null;
    }
    
    // First try to get any order that's in active status
    const { data: activeOrders, error: activeError } = await supabase
      .from('orders')
      .select(`
        *,
        seller:seller_id (*),
        retailer:retailer_id (*)
      `)
      .eq('delivery_partner_id', userId)
      .in('status', ['accepted', 'picked_up', 'in_transit'])
      .order('updated_at', { ascending: false })
      .limit(5); // Get a few in case there are multiple (should normally be just one)
    
    if (activeError) {
      console.error('Error fetching user\'s active orders:', activeError);
      return null;
    }
    
    if (activeOrders && activeOrders.length > 0) {
      console.log(`Found ${activeOrders.length} active orders for user ${userId}`);
      
      // Pick the most recently updated one
      const mostRecent = activeOrders[0];
      console.log('Using most recent active order:', mostRecent.id, 'with status:', mostRecent.status);
      return mostRecent;
    }
    
    // If no active orders, check if there's a delivered order from today
    // This helps if the rider has just completed an order but it's not showing up
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    
    console.log('No active orders found, checking for recently delivered orders since:', todayStart);
    
    const { data: deliveredOrders, error: deliveredError } = await supabase
      .from('orders')
      .select(`
        *,
        seller:seller_id (*),
        retailer:retailer_id (*)
      `)
      .eq('delivery_partner_id', userId)
      .eq('status', 'delivered')
      .gte('delivered_at', todayStart)
      .order('delivered_at', { ascending: false })
      .limit(1);
    
    if (deliveredError) {
      console.error('Error fetching user\'s delivered orders:', deliveredError);
      return null;
    }
    
    if (deliveredOrders && deliveredOrders.length > 0) {
      console.log('Found recently delivered order:', deliveredOrders[0].id);
      return deliveredOrders[0];
    }
    
    console.log('No active or recently delivered orders found for user:', userId);
    return null;
  } catch (error) {
    console.error('Exception in getUserCurrentOrder:', error);
    return null;
  }
};

// Function to directly update an order's status and return the updated order
export const updateAndGetOrder = async (orderId, newStatus, statusDetails = {}) => {
  try {
    console.log(`Updating order ${orderId} status to ${newStatus} with details:`, statusDetails);
    
    // First update the order status
    const result = await updateOrderStatus(orderId, newStatus, statusDetails);
    
    if (!result.success) {
      console.error('Failed to update order status:', result.error);
      return { success: false, error: result.error };
    }
    
    // Then fetch the updated order
    const updatedOrder = await getOrderById(orderId);
    
    if (!updatedOrder) {
      console.error('Failed to fetch updated order after status change');
      return { success: true, order: null };
    }
    
    return { success: true, order: updatedOrder };
  } catch (error) {
    console.error('Error in updateAndGetOrder:', error);
    return { success: false, error: error.message };
  }
};

// Function to verify delivery OTP
export const verifyDeliveryOTP = async (orderId, otp) => {
  try {
    console.log(`Verifying OTP for order ${orderId} with code: ${otp}`);
    
    // First fetch the order to check the OTP
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();
    
    if (fetchError) {
      console.error('Error fetching order for OTP verification:', fetchError);
      return { success: false, error: 'Failed to fetch order details' };
    }
    
    if (!order) {
      console.error('Order not found for OTP verification:', orderId);
      return { success: false, error: 'Order not found' };
    }
    
    // Check if the OTP matches
    if (!order.delivery_otp) {
      console.error('No delivery OTP found for order:', orderId);
      return { success: false, error: 'No verification code found for this order' };
    }
    
    if (order.delivery_otp !== otp) {
      console.error('OTP mismatch for order:', orderId, 'Expected:', order.delivery_otp, 'Received:', otp);
      return { success: false, error: 'Invalid verification code' };
    }
    
    // Update the order to mark OTP as verified
    const { error: updateError } = await supabase
      .from('orders')
      .update({ otp_verified: true })
      .eq('id', orderId);
    
    if (updateError) {
      console.error('Error updating OTP verification status:', updateError);
      return { success: false, error: 'Failed to update verification status' };
    }
    
    console.log('OTP verified successfully for order:', orderId);
    return { success: true };
  } catch (error) {
    console.error('Error in verifyDeliveryOTP:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Helper function to determine MIME type from file extension
 * @param {string} extension The file extension
 * @returns {string} The MIME type
 */
const getMimeType = (extension) => {
  const ext = extension?.toLowerCase() || 'jpg';
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    default:
      return 'image/jpeg';
  }
};

/**
 * Converts an image URI to a base64 string
 * @param {string} uri The image URI
 * @returns {Promise<string>} The base64 encoded image data
 */
const getBase64FromURI = async (uri) => {
  const response = await fetch(uri);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64data = reader.result;
      // Extract base64 data part (remove data:image/jpeg;base64, prefix)
      const base64EncodedData = base64data.split(',')[1];
      resolve(base64EncodedData);
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(blob);
  });
};

/**
 * Converts an image URI to a blob
 * @param {string} uri The image URI
 * @returns {Promise<Blob>} The blob object
 */
const uriToBlob = async (uri) => {
  const response = await fetch(uri);
  return await response.blob();
};

// Function to update user language in profiles table
export const updateUserLanguage = async (userId, languageCode) => {
  try {
    console.log('Updating user language:', { userId, languageCode });
    
    // Update the profiles table with the new language
    const { data, error } = await supabase
      .from('profiles')
      .update({ language: languageCode })
      .eq('fire_id', userId)
      .select();
    
    if (error) {
      console.error('Error updating user language:', error);
      return { success: false, error };
    }
    
    if (!data || data.length === 0) {
      console.log('No profile found with fire_id:', userId, 'trying with id field');
      
      // Fallback: try updating by id field if fire_id doesn't match
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('profiles')
        .update({ language: languageCode })
        .eq('id', userId)
        .select();
      
      if (fallbackError) {
        console.error('Error updating user language (fallback):', fallbackError);
        return { success: false, error: fallbackError };
      }
      
      console.log('User language updated successfully (fallback):', fallbackData);
      return { success: true, data: fallbackData };
    }
    
    console.log('User language updated successfully:', data);
    return { success: true, data };
  } catch (error) {
    console.error('Exception in updateUserLanguage:', error);
    return { success: false, error };
  }
};

// Make sure to include all exports
export default {
  supabase,
  testSupabaseConnection,
  createUserProfile,
  getUserProfile,
  getUserProfileByPhone,
  updateUserProfile,
  updateUserLanguage,
  getAvailableOrders,
  getOrderById,
  getUserCurrentOrder,
  acceptOrder,
  updateOrderStatus,
  updateAndGetOrder,
  verifyDeliveryOTP,
  getEarnings,
  uploadProfileImage,
  uploadIdImage,
  uploadProductImage,
  updateDeliveryPartnerLocation,
  testOrdersAccess,
  getDetailedOrders,
  testOrderJoins,
  checkDatabaseStructure,
  checkOrdersTable,
  testRetailerProfileRetrieval,
  getOrderPickupDetailsWithCorrectJoin,
  getSellerLocationDetails,
  getSellerDetailsByOrderId,
  formatAddress
};