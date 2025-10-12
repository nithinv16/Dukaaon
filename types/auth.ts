import { Session, User } from '@supabase/supabase-js';

export interface BusinessDetails {
  shopName: string;
  ownerName: string;
  gstNumber?: string;
  address: string;
  pincode: string;
  created_at: string;
}

export interface Profile {
  id: string;
  fire_id?: string | null;
  phone_number: string;
  email?: string | null;
  role: 'retailer' | 'seller' | 'wholesaler' | 'manufacturer';
  status?: 'pending' | 'active' | 'suspended';
  language?: string;
  business_details: {
    shopName?: string;
    ownerName?: string;
    address?: string;
    pincode?: string;
    [key: string]: any;
  };
  created_at?: string;
  updated_at?: string;
  [key: string]: any;
}

export interface AuthState {
  session: Session | null;
  user: Profile | null;
  loading: boolean;
  setSession: (session: Session | null) => void;
  clearAuth: () => void;
  setUser: (user: Profile | null) => void;
  createProfileDirectly: (phoneNumber: string, role?: string) => Promise<Profile | null>;
}

export interface SellerDetails {
  id: string;
  user_id: string;
  business_name: string;
  owner_name: string;
  seller_type: 'wholesaler' | 'manufacturer';
  registration_number?: string;
  gst_number?: string;
  profile_image_url?: string;
  address: {
    street: string;
    city: string;
    state: string;
    pincode: string;
  };
  location_address?: string;
  latitude?: number;
  longitude?: number;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
}