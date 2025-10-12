import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface NearbyWholesaler {
  id: string;
  business_details: {
    shopName: string;
    ownerName: string;
  };
  distance: number;
  latitude: number;
  longitude: number;
}

interface WholesalersState {
  nearbyWholesalers: NearbyWholesaler[];
  setNearbyWholesalers: (wholesalers: NearbyWholesaler[]) => void;
}

export const useWholesalersStore = create<WholesalersState>()(
  persist(
    (set) => ({
      nearbyWholesalers: [],
      setNearbyWholesalers: (wholesalers) => set({ nearbyWholesalers: wholesalers }),
    }),
    {
      name: 'wholesalers-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
); 