export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

export interface OrderItem {
  id: string;
  product_id: string;
  name: string;
  quantity: number;
  price: number;
  unit: string;
  outOfStock?: boolean;
}

export interface Order {
  id: string;
  order_number: string;
  user_id: string;
  seller_id?: string;
  items: OrderItem[];
  out_of_stock_items?: OrderItem[];
  total_amount: number;
  delivery_fee?: number; // Optional delivery fee for individual orders
  status: OrderStatus;
  payment_status: 'pending' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
  delivery_address: string;
  tracking_number?: string;
  estimated_delivery?: string;
  cancellation_reason?: string;
  // Buyer information (for wholesaler view)
  buyer?: {
    id: string;
    business_details?: {
      shopName?: string;
      address?: string;
      ownerName?: string;
    };
  };
  // Batch order specific fields
  is_batch_order?: boolean;
  individual_orders?: IndividualOrderSummary[];
  total_orders?: number;
  master_order_id?: string;
  // Master order relationship for batch info
  master_orders?: {
    id: string;
    order_number: string;
    delivery_batches?: {
      batch_number: string;
    }[];
  };
}

export interface IndividualOrderSummary {
  order_id: string;
  order_number: string;
  seller_id: string;
  items: OrderItem[];
  subtotal: number;
  status: OrderStatus;
}
