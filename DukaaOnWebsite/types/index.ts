// Geolocation Types
export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Location {
  city: string;
  state: string;
  coordinates: Coordinates;
}

// Seller Types
export interface Seller {
  id: string;
  businessName: string;
  businessType: 'wholesaler' | 'manufacturer';
  location: Location;
  categories: string[];
  thumbnailImage?: string;
  description?: string;
  distance?: number;
}

// Inquiry Types
export type StakeholderType = 'investor' | 'retailer' | 'wholesaler' | 'manufacturer' | 'fmcg' | 'other';

export interface InquiryData {
  visitorName: string;
  email: string;
  phone: string;
  location: string;
  message: string;
  sellerId?: string;
  enquiryType: 'seller' | 'general' | 'contact';
  stakeholderType?: StakeholderType;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: ValidationError[];
  message?: string;
}

export interface ValidationError {
  field: string;
  message: string;
}

// Sellers API Response
export interface SellersResponse {
  sellers: Seller[];
  count: number;
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Enquiry API Response
export interface EnquiryResponse {
  enquiryId: string;
}

// Geolocation API Response
export interface GeolocationResponse {
  latitude: number;
  longitude: number;
  city?: string;
  state?: string;
  country?: string;
}
