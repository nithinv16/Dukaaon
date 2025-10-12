export interface SharedProduct {
  id: string;
  user_id: string;
  name: string;
  brand: string | null;
  category: string;
  sub_category: string | null;
  units: number;
  price: number;
  image_url: string | null;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  location_address: string | null;
  is_available: boolean;
  created_at: string;
  updated_at: string;
  distance?: number | null;
  profiles?: {
    business_details?: {
      shopName: string;
    }
  };
} 