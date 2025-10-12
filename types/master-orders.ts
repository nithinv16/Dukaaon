// Master Order System Types
// TypeScript interfaces for the new master order system

export interface MasterOrder {
  id: string;
  order_number: string;
  user_id: string;
  total_amount: number;
  delivery_fee: number;
  grand_total: number;
  status: MasterOrderStatus;
  payment_status: PaymentStatus;
  payment_method?: string;
  delivery_address: DeliveryAddress;
  delivery_instructions?: string;
  estimated_delivery_time?: string;
  actual_delivery_time?: string;
  created_at: string;
  updated_at: string;
}

export interface DeliveryBatch {
  id: string;
  batch_number: string;
  master_order_id: string;
  delivery_partner_id?: string;
  status: DeliveryBatchStatus;
  pickup_locations: PickupLocation[];
  delivery_address: DeliveryAddress;
  total_amount: number;
  delivery_fee: number;
  distance_km?: number;
  estimated_pickup_time?: string;
  estimated_delivery_time?: string;
  actual_pickup_time?: string;
  actual_delivery_time?: string;
  assigned_at?: string;
  accepted_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface PickupLocation {
  seller_id: string;
  seller_name: string;
  address: DeliveryAddress;
  contact_phone?: string;
  items_count: number;
  order_value: number;
}

export interface DeliveryAddress {
  address: string;
  city: string;
  state: string;
  pincode: string;
  landmark?: string;
  contact_name?: string;
  contact_phone?: string;
  latitude?: number;
  longitude?: number;
}

export type MasterOrderStatus = 
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

export type DeliveryBatchStatus = 
  | 'pending'
  | 'assigned'
  | 'accepted'
  | 'picked_up'
  | 'in_transit'
  | 'delivered'
  | 'cancelled'
  | 'failed';

export type PaymentStatus = 
  | 'pending'
  | 'paid'
  | 'failed'
  | 'refunded';

// Extended Order interface with master_order_id
export interface OrderWithMaster extends Order {
  master_order_id?: string;
}

// Delivery Partner Dashboard Types
export interface DeliveryPartnerBatch {
  batch_id: string;
  batch_number: string;
  batch_status: DeliveryBatchStatus;
  pickup_locations: PickupLocation[];
  delivery_address: DeliveryAddress;
  total_amount: number;
  delivery_fee: number;
  distance_km?: number;
  estimated_pickup_time?: string;
  estimated_delivery_time?: string;
  notes?: string;
  batch_created_at: string;
  master_order_id: string;
  master_order_number: string;
  user_id: string;
  delivery_instructions?: string;
  total_orders: number;
  orders: OrderSummary[];
}

export interface OrderSummary {
  order_id: string;
  order_number: string;
  seller_id: string;
  items: OrderItem[];
  subtotal: number;
}

// Customer Order Tracking Types
export interface CustomerOrderTracking {
  master_order_id: string;
  master_order_number: string;
  order_status: MasterOrderStatus;
  total_amount: number;
  delivery_fee: number;
  grand_total: number;
  payment_status: PaymentStatus;
  delivery_address: DeliveryAddress;
  estimated_delivery_time?: string;
  actual_delivery_time?: string;
  created_at: string;
  delivery_batch_id?: string;
  batch_number?: string;
  delivery_status?: DeliveryBatchStatus;
  delivery_partner_id?: string;
  actual_pickup_time?: string;
  batch_delivery_time?: string;
  total_orders: number;
  individual_orders: IndividualOrderSummary[];
}

export interface IndividualOrderSummary {
  order_id: string;
  order_number: string;
  seller_id: string;
  items: OrderItem[];
  subtotal: number;
  status: OrderStatus;
}

// API Request/Response Types
export interface CreateMasterOrderRequest {
  user_id: string;
  total_amount: number;
  delivery_fee: number;
  delivery_address: DeliveryAddress;
  payment_method?: string;
  delivery_instructions?: string;
}

export interface CreateMasterOrderResponse {
  master_order_id: string;
  order_number: string;
  success: boolean;
  error?: string;
}

export interface CreateDeliveryBatchRequest {
  master_order_id: string;
  pickup_locations: PickupLocation[];
  delivery_address: DeliveryAddress;
  total_amount: number;
  delivery_fee: number;
  distance_km?: number;
}

export interface CreateDeliveryBatchResponse {
  delivery_batch_id: string;
  batch_number: string;
  success: boolean;
  error?: string;
}

export interface AcceptDeliveryBatchRequest {
  batch_id: string;
  delivery_partner_id: string;
}

export interface AcceptDeliveryBatchResponse {
  success: boolean;
  error?: string;
}

export interface UpdateDeliveryBatchStatusRequest {
  batch_id: string;
  status: DeliveryBatchStatus;
  notes?: string;
}

export interface UpdateDeliveryBatchStatusResponse {
  success: boolean;
  error?: string;
}

// Utility Types
export interface MasterOrderWithDetails extends MasterOrder {
  individual_orders: OrderWithMaster[];
  delivery_batch?: DeliveryBatch;
}

export interface DeliveryBatchWithDetails extends DeliveryBatch {
  master_order: MasterOrder;
  individual_orders: OrderWithMaster[];
}

// Status Flow Mappings
export const DELIVERY_STATUS_TO_ORDER_STATUS: Record<DeliveryBatchStatus, MasterOrderStatus> = {
  pending: 'pending',
  assigned: 'confirmed',
  accepted: 'confirmed',
  picked_up: 'processing',
  in_transit: 'out_for_delivery',
  delivered: 'delivered',
  cancelled: 'cancelled',
  failed: 'cancelled'
};

export const ORDER_STATUS_LABELS: Record<MasterOrderStatus, string> = {
  pending: 'Order Placed',
  confirmed: 'Order Confirmed',
  processing: 'Being Prepared',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  refunded: 'Refunded'
};

export const DELIVERY_STATUS_LABELS: Record<DeliveryBatchStatus, string> = {
  pending: 'Waiting for Assignment',
  assigned: 'Assigned to Partner',
  accepted: 'Accepted by Partner',
  picked_up: 'Items Collected',
  in_transit: 'On the Way',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  failed: 'Delivery Failed'
};

// Import existing types
import { Order, OrderItem, OrderStatus } from './orders';