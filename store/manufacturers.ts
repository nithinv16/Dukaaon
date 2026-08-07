import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabase/supabase';

interface NearbyManufacturer {
  id: string;
  name: string;
  business_details?: {
    shopName: string;
    ownerName: string;
  };
  distance: number;
  latitude?: number;
  longitude?: number;
  categories: string[];
  image?: string;
}

interface ManufacturersState {
  nearbyManufacturers: NearbyManufacturer[];
  setNearbyManufacturers: (manufacturers: NearbyManufacturer[]) => void;
  fetchNearbyManufacturers: (latitude: number, longitude: number, radius: number) => Promise<void>;
}

export const useManufacturersStore = create<ManufacturersState>()(
  persist(
    (set) => ({
      nearbyManufacturers: [],
      setNearbyManufacturers: (manufacturers) => set({ nearbyManufacturers: manufacturers }),
      fetchNearbyManufacturers: async (latitude: number, longitude: number, radius: number) => {
        try {
          // NOTE: The UI (NearbyManufacturers component) uses SellersDataService.fetchNearbySellers() directly.
          // This store method is unused but kept for backward compatibility.
          const { data, error } = await supabase.rpc('get_nearby_sellers', {
            user_lat: latitude,
            user_lng: longitude,
            radius_km: radius,
            seller_role: 'manufacturer'
          });

          if (error) throw error;
          set({ nearbyManufacturers: data || [] });
        } catch (error) {
          console.error('Error fetching nearby manufacturers:', error);
        }
      }
    }),
    {
      name: 'manufacturers-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
); 