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
          // In a real implementation, you would fetch from Supabase or API
          // For now, using mock data
          const mockManufacturers: NearbyManufacturer[] = [
            {
              id: '1',
              name: 'ABC Manufacturing',
              distance: 3.2,
              categories: ['Food Products', 'Packaged Goods'],
              latitude: latitude + 0.01,
              longitude: longitude + 0.01
            },
            {
              id: '2',
              name: 'XYZ Industries',
              distance: 5.7,
              categories: ['Beverages', 'Snacks'],
              latitude: latitude - 0.01, 
              longitude: longitude - 0.01
            }
          ];
          
          // Set the manufacturers in the store
          set({ nearbyManufacturers: mockManufacturers });
          
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