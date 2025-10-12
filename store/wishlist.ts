import { create } from 'zustand';
import { supabase } from '../services/supabase/supabase';
import { useAuthStore } from './auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface WishlistProduct {
  id: string;
  name: string;
  price: number;
  image_url: string;
  min_quantity: number;
  unit: string;
  seller_id: string;
}

interface WishlistStore {
  items: WishlistProduct[];
  loading: boolean;
  addToWishlist: (product: WishlistProduct) => Promise<void>;
  removeFromWishlist: (productId: string) => Promise<void>;
  isInWishlist: (productId: string) => boolean;
  loadWishlist: () => Promise<void>;
}

export const useWishlistStore = create<WishlistStore>((set, get) => ({
  items: [],
  loading: false,
  
  loadWishlist: async () => {
    const user = useAuthStore.getState().user;
    
    if (!user?.id) {
      console.error('Cannot load wishlist: No user profile found');
      return;
    }
    
    try {
      set({ loading: true });
      
      // Use the profile ID (UUID) from the user object
      const profileId = user.id;
      
      console.log('Loading wishlist for profile ID:', profileId);
      
      // First, get wishlist IDs
      const { data: wishlistData, error: wishlistError } = await supabase
        .from('wishlists')
        .select('product_id')
        .eq('user_id', profileId);
      
      if (wishlistError) {
        console.error('Error loading wishlist IDs:', wishlistError);
        // Ensure we set an empty array, not null
        set({ items: [], loading: false });
        return;
      }
      
      console.log('Wishlist data from DB:', wishlistData);
      
      if (!wishlistData || wishlistData.length === 0) {
        console.log('No wishlist items found');
        set({ items: [] });
        return;
      }
      
      // Extract product IDs
      const productIds = wishlistData.map(item => item.product_id);
      console.log('Product IDs:', productIds);
      
      // Now fetch the actual products
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .in('id', productIds);
        
      if (productsError) {
        console.error('Error loading products:', productsError);
        // Ensure we set an empty array, not null
        set({ items: [], loading: false });
        return;
      }
      
      console.log('Products data from DB:', productsData);
      
      // Handle the case where productsData might be null
      if (!productsData) {
        console.log('No products found for the given IDs');
        set({ items: [] });
        return;
      }
      
      // Transform the data to match our WishlistProduct interface
      const wishlistItems = productsData.map(product => ({
        id: product.id,
        name: product.name,
        price: product.price,
        image_url: product.image_url,
        min_quantity: product.min_quantity || 1,
        unit: product.unit || 'pc',
        seller_id: product.seller_id
      }));
      
      console.log('Transformed wishlist items:', wishlistItems);
      set({ items: wishlistItems });
    } catch (error) {
      console.error('Error in loadWishlist:', error);
      // Always ensure items is an array, not null
      set({ items: [], loading: false });
    } finally {
      set({ loading: false });
    }
  },
  
  addToWishlist: async (product) => {
    const user = useAuthStore.getState().user;
    
    if (!user?.id) {
      console.error('Cannot add to wishlist: No user profile found');
      return;
    }
    
    try {
      // Use the profile ID (UUID) from the user object
      const profileId = user.id;
      
      console.log('Adding product to wishlist:', {
        profileId,
        productId: product.id,
        productName: product.name
      });
      
      // Ensure current items is never null before updating
      const currentItems = get().items || [];
      
      // First update local state for immediate feedback
      set({
        items: [...currentItems, product]
      });
      
      // Insert into the wishlist table using profile ID
      const { data, error } = await supabase
        .from('wishlists')
        .insert({
          user_id: profileId,
          product_id: product.id,
          price_at_wishlist: product.price
        })
        .select();
      
      if (error) {
        console.error('Error adding to wishlist:', error);
        // Revert state if there was an error, ensuring it's never null
        const safeItems = get().items || [];
        set({
          items: safeItems.filter(item => item.id !== product.id)
        });
        return;
      }
      
      console.log('Successfully added to wishlist:', data);
      
      // Safely reload wishlist to ensure UI is in sync with database
      try {
        await get().loadWishlist();
      } catch (loadError) {
        console.error('Error reloading wishlist after add:', loadError);
        // No need to set items here as we've already updated it
      }
    } catch (error) {
      console.error('Error in addToWishlist:', error);
      // Revert state on exception, ensuring it's never null
      const safeItems = get().items || [];
      set({
        items: safeItems.filter(item => item.id !== product.id)
      });
    }
  },
  
  removeFromWishlist: async (productId) => {
    const user = useAuthStore.getState().user;
    
    if (!user?.id) {
      console.error('Cannot remove from wishlist: No user profile found');
      return;
    }
    
    try {
      // Use the profile ID (UUID) from the user object
      const profileId = user.id;
      
      // Ensure current items is never null before updating
      const currentItems = get().items || [];
      
      // First update local state for immediate feedback
      set({
        items: currentItems.filter(item => item.id !== productId)
      });
      
      // Delete from the wishlist table using profile ID
      const { error } = await supabase
        .from('wishlists')
        .delete()
        .eq('user_id', profileId)
        .eq('product_id', productId);
      
      if (error) {
        console.error('Error removing from wishlist:', error);
        // Safely reload wishlist if there was an error
        try {
          await get().loadWishlist();
        } catch (loadError) {
          console.error('Error reloading wishlist after remove:', loadError);
          // If reload fails, at least ensure we have a valid array
          if (!get().items) {
            set({ items: [] });
          }
        }
      }
    } catch (error) {
      console.error('Error in removeFromWishlist:', error);
      // Safely reload wishlist on exception
      try {
        await get().loadWishlist();
      } catch (loadError) {
        console.error('Error reloading wishlist after exception:', loadError);
        // If reload fails, at least ensure we have a valid array
        if (!get().items) {
          set({ items: [] });
        }
      }
    }
  },
  
  isInWishlist: (productId) => {
    // Always ensure we have an array, never null
    const items = get().items || [];
    return items.some(item => item.id === productId);
  }
})); 