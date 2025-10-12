export interface Profile {
  id: string;
  phone_number: string;
  created_at: string;
  updated_at: string;
  profile_image_url?: string;
  business_details?: {
    shopName: string;
    address: string;
  };
  kyc_status?: 'pending' | 'verified' | null;
  documents?: Array<{
    type: 'id_proof' | 'address_proof' | 'business_proof';
    url: string;
  }>;
  // ... other fields
}