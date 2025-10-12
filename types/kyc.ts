export type DocumentType = 'rental_agreement' | 'electricity_bill' | 'shop_photo' | 'owner_photo';

export interface KYCDocument {
  type: DocumentType;
  uri: string;
  status: 'pending' | 'uploaded' | 'verified' | 'rejected';
}

export interface BusinessDetails {
  shopName: string;
  address: {
    street: string;
    city: string;
    state: string;
    pincode: string;
  };
  gstin?: string;
}

export interface Profile {
  id: string;
  phone_number: string;
  role: 'retailer' | 'seller';
  language: string;
  business_details?: BusinessDetails;
  status: 'pending' | 'active' | 'inactive' | 'suspended';
  created_at: string;
  updated_at: string;
}