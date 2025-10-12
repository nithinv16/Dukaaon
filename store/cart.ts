import { create } from 'zustand';
import { supabase } from '../services/supabase/supabase';
import { useAuthStore } from './auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RealtimeChannel } from '@supabase/supabase-js';

// Helper function to generate a UUID v4
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

interface CartItemDB {
  id: string;
  quantity: number;
  price: number;
  product: {
    id: string;
    name: string;
    images?: string[] | null;
    image_url?: string | null;
    unit?: string | null;
  };
  seller: {
     id: string;
     business_details?: any;
   };
}

interface CartItem {
  uniqueId: string;
  product_id: string;
  name: string;
  price: string;
  quantity: number;
  image_url: string;
  unit: string;
  seller_id: string;
}

interface CartStore {
  items: CartItem[];
  loading: boolean;
  subscription: RealtimeChannel | null;
  loadCart: () => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  updateQuantity: (id: string, quantity: number) => Promise<void>;
  cleanup: () => void;
  fetchCartItems: () => Promise<void>;
  addToCart: (item: CartItem) => Promise<void>;
  getTotal: () => number;
  removeAll: () => void;
  clearCart: () => Promise<void>;
  calculateDeliveryFee: (subtotal: number, itemCount: number, srcLat: number, srcLng: number, destLat: number, destLng: number) => { fee: number, vehicleType: string, distance: number };
  validateSellerDistance: (newSellerId: string) => Promise<void>;
  splitCartBySeller: () => { [sellerId: string]: CartItem[] };
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  loading: true,
  subscription: null,

  getTotal: () => {
    return get().items.reduce((total, item) => {
      return total + (Number(item.price) * item.quantity);
    }, 0);
  },

  removeAll: () => {
    set({ items: [] });
  },

  // Calculate delivery fee based on cart subtotal, item count, and distance using Haversine formula
  calculateDeliveryFee: (subtotal: number, itemCount: number, srcLat: number, srcLng: number, destLat: number, destLng: number) => {
    // Calculate distance using Haversine formula
    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
      const R = 6371; // Radius of the earth in km
      const dLat = deg2rad(lat2 - lat1);
      const dLon = deg2rad(lon2 - lon1);
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const distance = R * c; // Distance in km
      return distance;
    };
    
    const deg2rad = (deg: number): number => {
      return deg * (Math.PI/180);
    };
    
    // Calculate distance between source and destination
    const distance = calculateDistance(srcLat, srcLng, destLat, destLng);
    
    // Determine vehicle type and calculate fee based on requirements
    let vehicleType: string;
    let fee: number;
    
    // 1. Two-wheeler condition
    if (subtotal < 5000 || itemCount < 10) {
      vehicleType = '2 wheeler';
      // Minimum ₹20 for distance up to 2 km and after that ₹8/km
      if (distance <= 2) {
        fee = 20;
      } else {
        fee = 20 + (distance - 2) * 8;
      }
    } 
    // 2. Three-wheeler condition (for mid-range orders)
    else if ((subtotal >= 5000 && subtotal <= 15000) || (itemCount >= 10 && itemCount <= 30)) {
      vehicleType = '3 wheeler';
      // Minimum ₹30 for distance up to 1.5 km and after that ₹15/km
      if (distance <= 1.5) {
        fee = 30;
      } else {
        fee = 30 + (distance - 1.5) * 15;
      }
    } 
    // 3. Four-wheeler condition (for large orders)
    else {
      vehicleType = '4 wheeler';
      // Minimum ₹40 for distance up to 1.5 km and after that ₹25/km
      if (distance <= 1.5) {
        fee = 40;
      } else {
        fee = 40 + (distance - 1.5) * 25;
      }
    }
    
    // Round fee to nearest integer
    fee = Math.round(fee);
    
    return {
      fee,
      vehicleType,
      distance: Math.round(distance * 100) / 100 // Round to 2 decimal places
    };
  },

  // Enhanced clear cart function that properly removes items from database
  clearCart: async () => {
    try {
      set({ loading: true });
      const user = useAuthStore.getState().user;
      
      if (!user) {
        console.log('No user found for clear cart');
        set({ items: [], loading: false });
        return;
      }

      // Delete all cart items for this user from the database
      const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('retailer_id', user.id);

      if (error) {
        console.error('Error clearing cart items:', error);
        throw error;
      }

      // Clear items in local state
      set({ items: [] });
      console.log('Cart cleared successfully');
      
      // Also update AsyncStorage for offline support
      await AsyncStorage.setItem('cart_items', JSON.stringify([]));
      
    } catch (error) {
      console.error('Error in clearCart:', error);
      // Still clear local items even if DB operation fails
      set({ items: [] });
    } finally {
      set({ loading: false });
    }
  },

  loadCart: async () => {
    try {
      set({ loading: true });
      const user = useAuthStore.getState().user;
      
      if (!user) {
        console.log('No user found');
        set({ items: [], loading: false });
        return;
      }

      // Clean up existing subscription
      if (get().subscription) {
        get().subscription.unsubscribe();
      }

      // Create new subscription
      const subscription = supabase
        .channel('cart_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'cart_items',
            filter: `retailer_id=eq.${user.id}`,
          },
          async (payload) => {
            console.log('Cart change detected:', payload);
            await get().fetchCartItems();
          }
        )
        .subscribe();

      set({ subscription });

      // Fetch initial cart data
      await get().fetchCartItems();
    } catch (error) {
      console.error('Error loading cart:', error);
    } finally {
      set({ loading: false });
    }
  },

  fetchCartItems: async () => {
    try {
      const user = useAuthStore.getState().user;
      if (!user) return;
  
      // Step 1: fetch raw cart rows without embedded relations
      const { data: rows, error: cartErr } = await supabase
        .from('cart_items')
        .select('id, quantity, price, product_id, seller_id')
        .eq('retailer_id', user.id);
  
      if (cartErr) throw cartErr;
  
      console.log('Raw cart_items rows:', rows);
  
      if (!rows || rows.length === 0) {
        set({ items: [] });
        return;
      }
  
      // Step 2: fetch products for all product_ids in cart
      const productIds = [...new Set(rows.map(r => r.product_id).filter(Boolean))];
      let productMap = new Map<string, any>();
      if (productIds.length > 0) {
        const { data: products, error: prodErr } = await supabase
          .from('products')
          .select('id, name, image_url, unit')
          .in('id', productIds);
        if (prodErr) throw prodErr;
        productMap = new Map(products.map(p => [p.id, p]));
      }
  
      // Step 3: (removed) fetch seller details - not needed for cart rendering
  
      // Step 4: map to CartItem[], using placeholders when related data is unavailable
      const cartItems = rows.map(row => {
        const product = productMap.get(row.product_id);
        return {
          uniqueId: row.id,
          name: product?.name || 'Unknown product',
          price: (row.price || 0).toString(),
          quantity: row.quantity || 1,
          image_url: product?.image_url || '',
          unit: product?.unit || '',
          product_id: row.product_id || '',
          seller_id: row.seller_id || ''
        };
      });
  
      set({ items: cartItems });
    } catch (error) {
      console.error('Error in fetchCartItems:', error);
      // Don't crash the entire cart on error
      set({ items: [], loading: false });
    }
  },

  cleanup: () => {
    const { subscription } = get();
    if (subscription) {
      subscription.unsubscribe();
      set({ subscription: null });
    }
  },

  removeItem: async (id: string) => {
    try {
      const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('id', id);

      if (error) throw error;

      set(state => ({
        items: state.items.filter(item => item.uniqueId !== id)
      }));
    } catch (error) {
      console.error('Error removing item:', error);
    }
  },

  updateQuantity: async (id: string, quantity: number) => {
    try {
      const { error } = await supabase
        .from('cart_items')
        .update({ quantity })
        .eq('id', id);

      if (error) throw error;

      set(state => ({
        items: state.items.map(item =>
          item.uniqueId === id ? { ...item, quantity } : item
        )
      }));
    } catch (error) {
      console.error('Error updating quantity:', error);
    }
  },

  addToCart: async (item: CartItem) => {
    try {
      const user = useAuthStore.getState().user;
      if (!user) throw new Error('User not authenticated');

      // Debug information
      console.log('Current auth state:', {
        user_id: user.id,
        user_role: user.role
      });
      
      // Use only the profile ID from user object
      const profileId = user.id;
      console.log('Using profile ID:', profileId);
      
      if (!profileId) {
        throw new Error('Profile ID not available');
      }

      // Check distance constraint before adding to cart
      await get().validateSellerDistance(item.seller_id);
      
      console.log('Adding to cart:', {
        retailer_id: profileId,
        product_id: item.product_id,
        seller_id: item.seller_id,
        quantity: item.quantity,
        price: item.price
      });
      
      // Check if item already exists
      console.log('Checking for existing cart item');
      const { data: existingItem, error: checkError } = await supabase
        .from('cart_items')
        .select('id, quantity')
        .eq('retailer_id', profileId)
        .eq('product_id', item.product_id)
        .maybeSingle();
      
      if (checkError) {
        console.error('Error checking for existing item:', checkError);
      }
      
      if (existingItem) {
        // Update existing item
        console.log('Item exists, updating quantity from', existingItem.quantity, 'to', existingItem.quantity + item.quantity);
        const { error: updateError } = await supabase
          .from('cart_items')
          .update({
            quantity: existingItem.quantity + item.quantity,
            price: parseFloat(item.price)
          })
          .eq('id', existingItem.id);
        
        if (updateError) {
          console.error('Error updating cart item:', updateError);
          throw updateError;
        }
        console.log('Successfully updated cart item');
      } else {
        // Insert new item
        console.log('Item does not exist, inserting new item');
        const { error: insertError } = await supabase
          .from('cart_items')
          .insert({
            retailer_id: profileId,
            seller_id: item.seller_id,
            product_id: item.product_id,
            quantity: item.quantity,
            price: parseFloat(item.price)
          });
        
        if (insertError) {
          console.error('Error inserting cart item:', insertError);
          throw insertError;
        }
        console.log('Successfully inserted cart item');
      }

      // Reload cart after adding/updating
      await get().fetchCartItems();
    } catch (error) {
      console.error('Error adding to cart:', error);
      throw error;
    }
  },

  validateSellerDistance: async (newSellerId: string) => {
    try {
      const currentItems = get().items;
      
      // If cart is empty, allow adding any seller
      if (currentItems.length === 0) {
        return;
      }

      // Get unique seller IDs from current cart
      const currentSellerIds = [...new Set(currentItems.map(item => item.seller_id))];
      
      // If the new seller is already in cart, allow it
      if (currentSellerIds.includes(newSellerId)) {
        return;
      }

      // Fetch seller locations for distance calculation
      const allSellerIds = [...currentSellerIds, newSellerId];
      
      const { data: sellerLocations, error } = await supabase
        .from('seller_details')
        .select('user_id, latitude, longitude, business_name')
        .in('user_id', allSellerIds);

      if (error) {
        console.error('Error fetching seller locations:', error);
        throw new Error('Unable to verify seller locations');
      }

      if (!sellerLocations || sellerLocations.length !== allSellerIds.length) {
        throw new Error('Some seller location data is missing');
      }

      // Calculate distances between all sellers
      const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
        const R = 6371; // Radius of the earth in km
        const dLat = (lat2 - lat1) * (Math.PI/180);
        const dLon = (lon2 - lon1) * (Math.PI/180);
        const a = 
          Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(lat1 * (Math.PI/180)) * Math.cos(lat2 * (Math.PI/180)) * 
          Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c; // Distance in km
      };

      // Check if any seller pair exceeds 3km distance
      for (let i = 0; i < sellerLocations.length; i++) {
        for (let j = i + 1; j < sellerLocations.length; j++) {
          const seller1 = sellerLocations[i];
          const seller2 = sellerLocations[j];
          
          if (!seller1.latitude || !seller1.longitude || !seller2.latitude || !seller2.longitude) {
            throw new Error('Seller location coordinates are missing');
          }

          const distance = calculateDistance(
            seller1.latitude, seller1.longitude,
            seller2.latitude, seller2.longitude
          );

          if (distance > 3) {
            const newSellerName = sellerLocations.find(s => s.user_id === newSellerId)?.business_name || 'Unknown Seller';
            const conflictingSellerName = seller1.user_id === newSellerId ? seller2.business_name : seller1.business_name;
            
            throw new Error(
              `Cannot add products from ${newSellerName}. ` +
              `Distance to ${conflictingSellerName} is ${distance.toFixed(1)}km (max 3km allowed). ` +
              `Please complete your current order or remove items from distant sellers.`
            );
          }
        }
      }
    } catch (error) {
      console.error('Error validating seller distance:', error);
      throw error;
    }
  },

  splitCartBySeller: () => {
    const items = get().items;
    const sellerGroups: { [sellerId: string]: CartItem[] } = {};
    
    items.forEach(item => {
      if (!sellerGroups[item.seller_id]) {
        sellerGroups[item.seller_id] = [];
      }
      sellerGroups[item.seller_id].push(item);
    });
    
    return sellerGroups;
  }
}));

// Update the subscription when auth state changes
useAuthStore.subscribe((state) => {
  if (!state.session) {
    useCartStore.getState().cleanup();
    useCartStore.getState().removeAll();
  }
});