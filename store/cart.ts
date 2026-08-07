import { create } from 'zustand';
import { supabase } from '../services/supabase/supabase';
import { useAuthStore } from './auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RealtimeChannel } from '@supabase/supabase-js';

// Helper function to generate a UUID v4
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Cache for validated sellers (avoids repeated DB calls)
const validatedSellersCache = new Map<string, number>(); // seller_id -> timestamp
const SELLER_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const isSellerCacheValid = (sellerId: string): boolean => {
  const cached = validatedSellersCache.get(sellerId);
  if (cached && Date.now() - cached < SELLER_CACHE_TTL) {
    return true;
  }
  return false;
};

const cacheSellerValidation = (sellerId: string) => {
  validatedSellersCache.set(sellerId, Date.now());
};

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
  category?: string;
  subcategory?: string;
  has_volatile_pricing?: boolean;
  min_quantity?: number; // Minimum quantity requirement for the product
  // Variant support - Requirements 3.6
  variant_id?: string;
  variant_sku?: string;
  variant_details?: string; // e.g., "500ml", "Chocolate"
  seller_name?: string;
}

interface CartStore {
  items: CartItem[];
  loading: boolean;
  subscription: RealtimeChannel | null;
  subscribedUserId: string | null;
  isInitializing: boolean;
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
  subscribedUserId: null,
  isInitializing: false,

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
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c; // Distance in km
      return distance;
    };

    const deg2rad = (deg: number): number => {
      return deg * (Math.PI / 180);
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
    // Prevent duplicate initialization
    if (get().isInitializing) {
      console.log('[CartStore] Already initializing, skipping duplicate loadCart call');
      return;
    }

    try {
      set({ loading: true, isInitializing: true });
      const user = useAuthStore.getState().user;

      if (!user) {
        console.log('No user found');
        set({ items: [], loading: false, isInitializing: false });
        return;
      }

      // Clean up existing subscription if user changed
      const existingSub = get().subscription;
      if (existingSub) {
        existingSub.unsubscribe();
        set({ subscription: null, subscribedUserId: null });
      }

      // Create new subscription with unique channel per user
      const subscription = supabase
        .channel(`cart_changes_${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'cart_items',
            filter: `retailer_id=eq.${user.id}`,
          },
          async (payload) => {
            // Guard: only process if still subscribed for this user
            if (get().subscribedUserId === user.id) {
              console.log('Cart change detected:', payload);
              await get().fetchCartItems();
            }
          }
        )
        .subscribe();

      set({ subscription, subscribedUserId: user.id });

      // Fetch initial cart data
      await get().fetchCartItems();
    } catch (error) {
      console.error('Error loading cart:', error);
    } finally {
      set({ loading: false, isInitializing: false });
    }
  },

  fetchCartItems: async () => {
    try {
      const user = useAuthStore.getState().user;
      if (!user) return;

      // Step 1: fetch raw cart rows without embedded relations
      // Include variant fields for Requirements 3.6
      const { data: rows, error: cartErr } = await supabase
        .from('cart_items')
        .select('id, quantity, price, product_id, seller_id, variant_id, variant_sku, variant_details')
        .eq('retailer_id', user.id);

      if (cartErr) throw cartErr;

      // Only log in development mode to reduce noise
      if (__DEV__ && rows && rows.length > 0) {
        console.log(`[CartStore] Fetched ${rows.length} cart items`);
      }

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
          .select('id, name, image_url, unit, min_quantity')
          .in('id', productIds);
        if (prodErr) throw prodErr;
        productMap = new Map(products.map(p => [p.id, p]));
      }

      // Step 3: fetch variant details for items with variant_id
      const variantIds = [...new Set(rows.map(r => r.variant_id).filter(Boolean))];
      let variantMap = new Map<string, any>();
      if (variantIds.length > 0) {
        const { data: variants, error: varErr } = await supabase
          .from('product_variants')
          .select('id, sku, variant_type, variant_value, image_url')
          .in('id', variantIds);
        if (!varErr && variants) {
          variantMap = new Map(variants.map(v => [v.id, v]));
        }
      }

      // Step 3.5: fetch seller details (business_name)
      const sellerIds = [...new Set(rows.map(r => r.seller_id).filter(Boolean))];
      let sellerMap = new Map<string, string>();
      if (sellerIds.length > 0) {
        const { data: sellers, error: sellerErr } = await supabase
          .from('seller_details')
          .select('user_id, business_name')
          .in('user_id', sellerIds);

        if (!sellerErr && sellers) {
          sellerMap = new Map(sellers.map(s => [s.user_id, s.business_name]));
        }
      }

      // Step 4: map to CartItem[], using placeholders when related data is unavailable
      // Requirements 3.6: Display variant details in cart (e.g., "Mirinda 500ml")
      const cartItems = rows.map(row => {
        const product = productMap.get(row.product_id);
        const variant = row.variant_id ? variantMap.get(row.variant_id) : null;

        // Build display name with variant details
        let displayName = product?.name || 'Unknown product';
        let variantDetails = row.variant_details || '';

        if (variant) {
          // Use variant details from the variant record if not stored in cart
          if (!variantDetails) {
            variantDetails = variant.variant_value;
          }
          // Append variant to name for display (e.g., "Mirinda 500ml")
          displayName = `${displayName} ${variantDetails}`;
        }

        return {
          uniqueId: row.id,
          name: displayName,
          price: (row.price || 0).toString(),
          quantity: row.quantity || 1,
          image_url: variant?.image_url || product?.image_url || '',
          unit: product?.unit || '',
          product_id: row.product_id || '',
          seller_id: row.seller_id || '',
          category: product?.category || '',
          subcategory: product?.subcategory || '',
          has_volatile_pricing: product?.has_volatile_pricing || false,
          min_quantity: product?.min_quantity || 1, // Default to 1 if not set
          // Variant fields (Requirements 3.6)
          variant_id: row.variant_id || undefined,
          variant_sku: row.variant_sku || variant?.sku || undefined,
          variant_details: variantDetails || undefined,
          seller_name: sellerMap.get(row.seller_id || '') || undefined
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
      set({ subscription: null, subscribedUserId: null });
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
      // Get the item to check min_quantity
      const state = get();
      const item = state.items.find(i => i.uniqueId === id);
      
      if (item) {
        const minQuantity = item.min_quantity || 1;
        // Ensure quantity doesn't go below min_quantity
        const validatedQuantity = Math.max(minQuantity, quantity);
        
        const { error } = await supabase
          .from('cart_items')
          .update({ quantity: validatedQuantity })
          .eq('id', id);

        if (error) throw error;

        set(state => ({
          items: state.items.map(item =>
            item.uniqueId === id ? { ...item, quantity: validatedQuantity } : item
          )
        }));
      }
    } catch (error) {
      console.error('Error updating quantity:', error);
    }
  },

  addToCart: async (item: CartItem) => {
    const user = useAuthStore.getState().user;
    if (!user) throw new Error('User not authenticated');

    const profileId = user.id;
    if (!profileId) throw new Error('Profile ID not available');

    // Check seller distance constraint (use cache if available)
    if (!isSellerCacheValid(item.seller_id)) {
      await get().validateSellerDistance(item.seller_id);
      cacheSellerValidation(item.seller_id);
    }

    // Generate a temporary unique ID for optimistic update
    const tempUniqueId = uuidv4();
    const newItem: CartItem = {
      ...item,
      uniqueId: tempUniqueId,
    };

    // OPTIMISTIC UPDATE: Immediately update local state
    const currentItems = get().items;
    // Check if item already exists in local state (by product_id and variant)
    const existingIndex = currentItems.findIndex(i =>
      i.product_id === item.product_id &&
      (item.variant_id ? i.variant_id === item.variant_id : !i.variant_id)
    );

    if (existingIndex >= 0) {
      // Update quantity optimistically
      const updatedItems = [...currentItems];
      updatedItems[existingIndex] = {
        ...updatedItems[existingIndex],
        quantity: updatedItems[existingIndex].quantity + item.quantity,
      };
      set({ items: updatedItems });
    } else {
      // Add new item optimistically
      set({ items: [...currentItems, newItem] });
    }

    // BACKGROUND SYNC: Persist to database without blocking UI
    const syncToDb = async () => {
      try {
        // Check if item already exists in DB
        let existingItemQuery = supabase
          .from('cart_items')
          .select('id, quantity')
          .eq('retailer_id', profileId)
          .eq('product_id', item.product_id);

        if (item.variant_id) {
          existingItemQuery = existingItemQuery.eq('variant_id', item.variant_id);
        } else {
          existingItemQuery = existingItemQuery.is('variant_id', null);
        }

        const { data: existingItem, error: checkError } = await existingItemQuery.maybeSingle();

        if (checkError) {
          console.error('Error checking for existing item:', checkError);
        }

        if (existingItem) {
          // Update existing item in DB
          await supabase
            .from('cart_items')
            .update({
              quantity: existingItem.quantity + item.quantity,
              price: parseFloat(item.price)
            })
            .eq('id', existingItem.id);
        } else {
          // Insert new item in DB
          const insertData: any = {
            retailer_id: profileId,
            seller_id: item.seller_id,
            product_id: item.product_id,
            quantity: item.quantity,
            price: parseFloat(item.price)
          };

          if (item.variant_id) insertData.variant_id = item.variant_id;
          if (item.variant_sku) insertData.variant_sku = item.variant_sku;
          if (item.variant_details) insertData.variant_details = item.variant_details;

          await supabase.from('cart_items').insert(insertData);
        }

        // After successful DB sync, do a silent background refresh to get correct IDs
        get().fetchCartItems().catch((err) => {
          console.error('Error refreshing cart after sync:', err);
        });

      } catch (error) {
        console.error('Error syncing cart to DB:', error);
        // Rollback only THIS item's optimistic addition (not entire state)
        if (existingIndex >= 0) {
          // Was a quantity update — revert just that item's quantity
          set(state => ({
            items: state.items.map(i =>
              i.product_id === item.product_id &&
              (item.variant_id ? i.variant_id === item.variant_id : !i.variant_id)
                ? { ...i, quantity: i.quantity - item.quantity }
                : i
            )
          }));
        } else {
          // Was a new item — remove only it by tempUniqueId
          set(state => ({
            items: state.items.filter(i => i.uniqueId !== tempUniqueId)
          }));
        }
      }
    };

    // Fire without blocking the caller, but don't use setTimeout
    syncToDb().catch((err) => {
      console.error('Unhandled error in cart DB sync:', err);
    });
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
        const dLat = (lat2 - lat1) * (Math.PI / 180);
        const dLon = (lon2 - lon1) * (Math.PI / 180);
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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
// Capture unsubscribe function to prevent memory leak
const unsubscribeAuthListener = useAuthStore.subscribe((state) => {
  if (!state.session) {
    useCartStore.getState().cleanup();
    useCartStore.getState().removeAll();
  }
});

export { unsubscribeAuthListener };