// Master Order Service
// Service for handling master order operations with Supabase

import { supabase } from './supabase/supabase';
import {
  MasterOrder,
  DeliveryBatch,
  CreateMasterOrderRequest,
  CreateMasterOrderResponse,
  CreateDeliveryBatchRequest,
  CreateDeliveryBatchResponse,
  AcceptDeliveryBatchRequest,
  AcceptDeliveryBatchResponse,
  UpdateDeliveryBatchStatusRequest,
  UpdateDeliveryBatchStatusResponse,
  DeliveryPartnerBatch,
  CustomerOrderTracking,
  PickupLocation,
  DeliveryAddress
} from '../types/master-orders';
import { OrderWithMaster } from '../types/master-orders';
import { NotificationService } from './notifications/NotificationService';
import { authkeyWhatsAppService } from './whatsapp/AuthkeyWhatsAppService';

export class MasterOrderService {
  /**
   * Create a new master order
   */
  static async createMasterOrder(
    request: CreateMasterOrderRequest
  ): Promise<CreateMasterOrderResponse> {
    try {
      const { data, error } = await supabase
        .rpc('create_master_order', {
          p_user_id: request.user_id,
          p_total_amount: request.total_amount,
          p_delivery_fee: request.delivery_fee,
          p_delivery_address: request.delivery_address,
          p_payment_method: request.payment_method,
          p_delivery_instructions: request.delivery_instructions
        });

      if (error) {
        console.error('Error creating master order:', error);
        return { master_order_id: '', order_number: '', success: false, error: error.message };
      }

      // Get the created master order details
      const { data: masterOrder, error: fetchError } = await supabase
        .from('master_orders')
        .select('id, order_number')
        .eq('id', data)
        .single();

      if (fetchError) {
        console.error('Error fetching master order:', fetchError);
        return { master_order_id: '', order_number: '', success: false, error: fetchError.message };
      }

      return {
        master_order_id: masterOrder.id,
        order_number: masterOrder.order_number,
        success: true
      };
    } catch (error) {
      console.error('Error in createMasterOrder:', error);
      return {
        master_order_id: '',
        order_number: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Create individual orders linked to a master order
   */
  static async createIndividualOrders(
    masterOrderId: string,
    orders: Omit<OrderWithMaster, 'id' | 'master_order_id' | 'created_at' | 'updated_at'>[]
  ): Promise<{ success: boolean; error?: string; orderIds?: string[]; orders?: { id: string; order_number: string; seller_id: string }[] }> {
    try {
      const ordersWithMasterId = orders.map(order => ({
        ...order,
        master_order_id: masterOrderId,
        delivery_fee: order.delivery_fee ?? 0, // Explicitly ensure delivery_fee is included
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      // Debug log to verify delivery_fee is included
      console.log('Creating individual orders with delivery_fee:', ordersWithMasterId.map(o => ({
        seller_id: o.seller_id,
        delivery_fee: o.delivery_fee,
        total_amount: o.total_amount
      })));

      const { data, error } = await supabase
        .from('orders')
        .insert(ordersWithMasterId)
        .select('id, order_number, seller_id');

      if (error) {
        console.error('Error creating individual orders:', error);
        return { success: false, error: error.message };
      }

      return {
        success: true,
        orderIds: data.map(order => order.id),
        orders: data
      };
    } catch (error) {
      console.error('Error in createIndividualOrders:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Create a delivery batch
   */
  static async createDeliveryBatch(
    request: CreateDeliveryBatchRequest
  ): Promise<CreateDeliveryBatchResponse> {
    try {
      const { data, error } = await supabase
        .rpc('create_delivery_batch', {
          p_master_order_id: request.master_order_id,
          p_pickup_locations: request.pickup_locations,
          p_delivery_address: request.delivery_address,
          p_total_amount: request.total_amount,
          p_delivery_fee: request.delivery_fee,
          p_distance_km: request.distance_km
        });

      if (error) {
        console.error('Error creating delivery batch:', error);
        return { delivery_batch_id: '', batch_number: '', success: false, error: error.message };
      }

      // Get the created delivery batch details
      const { data: deliveryBatch, error: fetchError } = await supabase
        .from('delivery_batches')
        .select('id, batch_number')
        .eq('id', data)
        .single();

      if (fetchError) {
        console.error('Error fetching delivery batch:', fetchError);
        return { delivery_batch_id: '', batch_number: '', success: false, error: fetchError.message };
      }

      return {
        delivery_batch_id: deliveryBatch.id,
        batch_number: deliveryBatch.batch_number,
        success: true
      };
    } catch (error) {
      console.error('Error in createDeliveryBatch:', error);
      return {
        delivery_batch_id: '',
        batch_number: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get pending delivery batches for delivery partners
   */
  static async getPendingDeliveryBatches(
    limit: number = 20,
    offset: number = 0
  ): Promise<{ batches: DeliveryPartnerBatch[]; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('delivery_partner_batches')
        .select('*')
        .eq('batch_status', 'pending')
        .order('batch_created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('Error fetching pending delivery batches:', error);
        return { batches: [], error: error.message };
      }

      return { batches: data || [] };
    } catch (error) {
      console.error('Error in getPendingDeliveryBatches:', error);
      return {
        batches: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get delivery batches for a specific delivery partner
   */
  static async getDeliveryPartnerBatches(
    deliveryPartnerId: string,
    status?: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ batches: DeliveryPartnerBatch[]; error?: string }> {
    try {
      let query = supabase
        .from('delivery_partner_batches')
        .select('*')
        .eq('delivery_partner_id', deliveryPartnerId);

      if (status) {
        query = query.eq('batch_status', status);
      }

      const { data, error } = await query
        .order('batch_created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('Error fetching delivery partner batches:', error);
        return { batches: [], error: error.message };
      }

      return { batches: data || [] };
    } catch (error) {
      console.error('Error in getDeliveryPartnerBatches:', error);
      return {
        batches: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Accept a delivery batch
   */
  static async acceptDeliveryBatch(
    request: AcceptDeliveryBatchRequest
  ): Promise<AcceptDeliveryBatchResponse> {
    try {
      const { data, error } = await supabase
        .rpc('accept_delivery_batch', {
          p_batch_id: request.batch_id,
          p_delivery_partner_id: request.delivery_partner_id
        });

      if (error) {
        console.error('Error accepting delivery batch:', error);
        return { success: false, error: error.message };
      }

      if (!data) {
        return { success: false, error: 'Failed to accept delivery batch' };
      }

      return { success: true };
    } catch (error) {
      console.error('Error in acceptDeliveryBatch:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Update delivery batch status
   */
  static async updateDeliveryBatchStatus(
    request: UpdateDeliveryBatchStatusRequest
  ): Promise<UpdateDeliveryBatchStatusResponse> {
    try {
      const { data, error } = await supabase
        .rpc('update_delivery_batch_status', {
          p_batch_id: request.batch_id,
          p_status: request.status,
          p_notes: request.notes
        });

      if (error) {
        console.error('Error updating delivery batch status:', error);
        return { success: false, error: error.message };
      }

      if (!data) {
        return { success: false, error: 'Failed to update delivery batch status' };
      }

      return { success: true };
    } catch (error) {
      console.error('Error in updateDeliveryBatchStatus:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get order details by ID (handles both individual orders and master orders)
   */
  static async getOrderById(
    orderId: string
  ): Promise<{ order: any; error?: string }> {
    try {
      // First, try to fetch as individual order
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (*),
          out_of_stock_items (*)
        `)
        .eq('id', orderId)
        .single();

      if (orderData && !orderError) {
        // Check if this order is part of a master order
        if (orderData.master_order_id) {
          // Fetch master order data with delivery batches and individual orders
          const { data: masterOrderData, error: masterError } = await supabase
            .from('master_orders')
            .select(`
              *,
              delivery_batches (
                *,
                pickup_locations
              )
            `)
            .eq('id', orderData.master_order_id)
            .single();

          if (masterOrderData && !masterError) {
            // Get all individual orders for this master order
            const { data: individualOrders, error: individualError } = await supabase
              .from('orders')
              .select(`
                *,
                order_items (*)
              `)
              .eq('master_order_id', orderData.master_order_id);

            if (!individualError && individualOrders) {
              // Transform to batch order format
              const batchOrder = {
                ...orderData,
                is_batch_order: true,
                master_order_id: masterOrderData.id,
                master_order_number: masterOrderData.order_number,
                total_orders: individualOrders.length,
                delivery_fee: masterOrderData.delivery_fee || 0,
                total_amount: masterOrderData.total_amount || 0,
                individual_orders: individualOrders.map((order: any) => ({
                  order_id: order.id,
                  order_number: order.order_number,
                  seller_id: order.seller_id,
                  status: order.status,
                  items: order.order_items || [],
                  subtotal: order.total_amount || 0
                }))
              };
              return { order: batchOrder };
            }
          }
        }
        return { order: orderData };
      }

      // Try to fetch as master order directly
      const { data: masterOrderData, error: masterError } = await supabase
        .from('master_orders')
        .select(`
          *,
          delivery_batches (
            *,
            pickup_locations
          )
        `)
        .eq('id', orderId)
        .single();

      if (masterOrderData && !masterError) {
        // Get all individual orders for this master order
        const { data: individualOrders, error: individualError } = await supabase
          .from('orders')
          .select(`
            *,
            order_items (*)
          `)
          .eq('master_order_id', masterOrderData.id);

        if (!individualError && individualOrders) {
          // Transform master order to order format
          const batchOrder = {
            id: masterOrderData.id,
            order_number: masterOrderData.order_number,
            status: masterOrderData.status,
            created_at: masterOrderData.created_at,
            delivery_address: typeof masterOrderData.delivery_address === 'string'
              ? masterOrderData.delivery_address
              : masterOrderData.delivery_address?.full_address || 'No address provided',
            delivery_fee: masterOrderData.delivery_fee || 0,
            total: masterOrderData.total_amount || 0,
            total_amount: masterOrderData.total_amount || 0,
            is_batch_order: true,
            master_order_id: masterOrderData.id,
            master_order_number: masterOrderData.order_number,
            total_orders: individualOrders.length,
            individual_orders: individualOrders.map((order: any) => ({
              order_id: order.id,
              order_number: order.order_number,
              seller_id: order.seller_id,
              status: order.status,
              items: order.order_items || [],
              subtotal: order.total_amount || 0
            })),
            items: [],
            out_of_stock_items: []
          };
          return { order: batchOrder };
        }
      }

      return { order: null, error: 'Order not found' };
    } catch (error) {
      console.error('Error in getOrderById:', error);
      return {
        order: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get customer order tracking information
   */
  static async getCustomerOrderTracking(
    userId: string,
    masterOrderId?: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ orders: CustomerOrderTracking[]; error?: string }> {
    try {
      let query = supabase
        .from('customer_order_tracking')
        .select('*')
        .eq('user_id', userId);

      if (masterOrderId) {
        query = query.eq('master_order_id', masterOrderId);
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('Error fetching customer order tracking:', error);
        return { orders: [], error: error.message };
      }

      return { orders: data || [] };
    } catch (error) {
      console.error('Error in getCustomerOrderTracking:', error);
      return {
        orders: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Helper function to create pickup locations from orders
   */
  static createPickupLocations(
    orders: { seller_id: string; items: any[]; total_amount: number }[],
    sellerDetails: Record<string, { name: string; address: DeliveryAddress; phone?: string }>
  ): PickupLocation[] {
    return orders.map(order => ({
      seller_id: order.seller_id,
      seller_name: sellerDetails[order.seller_id]?.name || 'Unknown Seller',
      address: sellerDetails[order.seller_id]?.address || {} as DeliveryAddress,
      contact_phone: sellerDetails[order.seller_id]?.phone,
      items_count: order.items.reduce((count, item) => count + item.quantity, 0),
      order_value: order.total_amount
    }));
  }

  /**
   * Complete order placement workflow
   */
  static async placeCompleteOrder(
    userId: string,
    ordersBySeller: Record<string, any>,
    deliveryAddress: DeliveryAddress,
    totalAmount: number,
    deliveryFee: number,
    paymentMethod?: string,
    deliveryInstructions?: string
  ): Promise<{ success: boolean; masterOrderId?: string; error?: string }> {
    try {
      // 1. Create master order
      const masterOrderResponse = await this.createMasterOrder({
        user_id: userId,
        total_amount: totalAmount,
        delivery_fee: deliveryFee,
        delivery_address: deliveryAddress,
        payment_method: paymentMethod,
        delivery_instructions: deliveryInstructions
      });

      if (!masterOrderResponse.success) {
        return { success: false, error: masterOrderResponse.error };
      }

      const masterOrderId = masterOrderResponse.master_order_id;
      const orderNumber = masterOrderResponse.order_number;

      // 2. Create individual orders
      const individualOrders = Object.entries(ordersBySeller).map(([sellerId, orderData]) => ({
        ...orderData,
        seller_id: sellerId
      }));

      const ordersResponse = await this.createIndividualOrders(masterOrderId, individualOrders);
      if (!ordersResponse.success) {
        return { success: false, error: ordersResponse.error };
      }

      // 3. Fetch retailer and seller details for notifications
      console.log('[MasterOrder] Step 3: Fetching data for notifications');
      console.log('[MasterOrder] User ID:', userId);
      console.log('[MasterOrder] Seller IDs:', Object.keys(ordersBySeller));

      // Fetch retailer data from profiles (business_details is JSONB with shopName, ownerName, address, etc.)
      const { data: retailerData, error: retailerError } = await supabase
        .from('profiles')
        .select('id, phone_number, business_details, latitude, longitude')
        .eq('id', userId)
        .single();

      if (retailerError) {
        console.warn('[MasterOrder] Error fetching retailer:', retailerError.message);
      }

      // Extract retailer name from business_details
      const retailerName = retailerData?.business_details?.shopName ||
        retailerData?.business_details?.ownerName ||
        'Customer';
      const retailerPhone = retailerData?.phone_number || '';
      console.log('[MasterOrder] Retailer data:', retailerData ? `${retailerName} (${retailerPhone})` : 'not found');

      // Fetch seller details from seller_details joined with profiles for phone numbers
      // profiles.phone_number for phone, seller_details for business_name, owner_name, etc.
      const sellerIds = Object.keys(ordersBySeller);
      const { data: sellersData, error: sellersError } = await supabase
        .from('seller_details')
        .select(`
          user_id,
          business_name,
          owner_name,
          seller_type,
          address,
          profiles!seller_details_user_id_fkey (
            id,
            phone_number
          )
        `)
        .in('user_id', sellerIds);

      if (sellersError) {
        console.warn('[MasterOrder] Error fetching sellers:', sellersError.message);
      }
      console.log('[MasterOrder] Sellers data:', sellersData ? `${sellersData.length} sellers found` : 'not found');

      // Transform seller data to expected format
      const transformedSellers = (sellersData || []).map(seller => {
        const profile = seller.profiles as any;
        const phoneNumber = profile?.phone_number || '';
        return {
          id: seller.user_id,
          name: seller.business_name || seller.owner_name || 'Seller',
          phone: phoneNumber,
          address: seller.address || ''
        };
      });
      console.log('[MasterOrder] Transformed sellers:', transformedSellers.map(s => `${s.name} (${s.phone})`));

      // 4. Send notifications to sellers via WhatsApp (Authkey.io)
      // This works for both wholesalers AND manufacturers
      console.log('[MasterOrder] Step 4: Sending WhatsApp notifications to sellers');
      console.log('[MasterOrder] Retailer data:', retailerData ? 'found' : 'missing');
      console.log('[MasterOrder] Sellers data:', transformedSellers.length > 0 ? `${transformedSellers.length} sellers found` : 'missing');

      // Create seller map for O(1) lookups (used in notifications and pickup locations)
      const sellerMap = new Map(transformedSellers.map(s => [s.id, s]));

      if (retailerData && transformedSellers.length > 0) {
        // Initialize Authkey service if not already
        console.log('[MasterOrder] Authkey available:', authkeyWhatsAppService.isAvailable());
        if (!authkeyWhatsAppService.isAvailable()) {
          console.log('[MasterOrder] Initializing Authkey service...');
          await authkeyWhatsAppService.initialize();
          console.log('[MasterOrder] Authkey initialized, available:', authkeyWhatsAppService.isAvailable());
        }

        // Create maps for O(1) lookups
        const sellerOrderMap = new Map<string, string>();
        if (ordersResponse.orders) {
          ordersResponse.orders.forEach(o => {
            if (o.seller_id && o.order_number) {
              sellerOrderMap.set(o.seller_id, o.order_number);
            }
          });
        }

        // Send notifications to all sellers in parallel
        await Promise.all(Object.entries(ordersBySeller).map(async ([sellerId, orderData]) => {
          const seller = sellerMap.get(sellerId);
          console.log(`[MasterOrder] Processing seller ${sellerId}:`, seller ? `${seller.name} (${seller.phone})` : 'not found');

          if (seller && seller.phone) {
            try {
              console.log(`[MasterOrder] Sending WhatsApp to ${seller.name} at ${seller.phone}...`);

              // Try Authkey WhatsApp first (primary method)
              // Get the specific order number for this seller, fallback to master order number
              const sellerOrderNumber = sellerOrderMap.get(sellerId) || orderNumber;

              const authkeyResult = await authkeyWhatsAppService.sendSellerOrderNotification(
                seller.phone,
                {
                  orderNumber: sellerOrderNumber,
                  customerName: retailerName,
                  customerPhone: retailerPhone,
                  items: (orderData.items || []).map((item: any) => ({
                    name: item.name || 'Item',
                    quantity: item.quantity || 1,
                    price: item.price,
                    unit: item.unit
                  })),
                  totalAmount: orderData.total_amount || 0,
                  deliveryAddress: `${deliveryAddress.address || ''}, ${deliveryAddress.city || ''}, ${deliveryAddress.state || ''}`.trim(),
                  paymentMethod: paymentMethod
                }
              );

              console.log(`[MasterOrder] Authkey result for ${seller.name}:`, authkeyResult);

              if (authkeyResult.success) {
                console.log(`[Authkey] ✅ WhatsApp notification sent to seller ${seller.name} (${seller.phone})`);
              } else {
                console.warn(`[Authkey] ❌ WhatsApp failed for ${seller.name}: ${authkeyResult.error}`);
                // Fallback to existing notification service
                await NotificationService.sendSellerOrderNotification(
                  seller.phone,
                  {
                    orderId: ordersResponse.orderIds?.find((_, index) =>
                      individualOrders[index].seller_id === sellerId
                    ) || masterOrderId,
                    orderNumber: sellerOrderNumber,
                    retailerName: retailerName,
                    items: orderData.items || [],
                    totalAmount: orderData.total_amount || 0,
                    deliveryAddress: `${deliveryAddress.address || ''}, ${deliveryAddress.city || ''}, ${deliveryAddress.state || ''}`.trim(),
                    paymentMethod: paymentMethod
                  }
                );
                console.log(`[Fallback] Notification sent to ${seller.name} via NotificationService`);
              }
            } catch (notificationError) {
              console.warn(`[MasterOrder] ❌ Failed to send notification to seller ${seller.name}:`, notificationError);
            }
          } else {
            console.warn(`[MasterOrder] ⚠️ Seller ${sellerId} has no phone number, skipping notification`);
          }
        }));
      } else {
        console.warn('[MasterOrder] ⚠️ Missing retailer or seller data, skipping notifications');
      }

      // 5. Create pickup locations (reuse sellerMap for O(1) lookups)
      const pickupLocations: PickupLocation[] = Object.keys(ordersBySeller).map(sellerId => {
        const seller = sellerMap.get(sellerId);
        return {
          seller_id: sellerId,
          seller_name: seller?.name || 'Seller',
          address: deliveryAddress, // Use delivery address as pickup location
          contact_phone: seller?.phone,
          items_count: ordersBySeller[sellerId].items?.length || 0,
          order_value: ordersBySeller[sellerId].total_amount || 0
        };
      });

      // 6. Create delivery batch
      const deliveryBatchResponse = await this.createDeliveryBatch({
        master_order_id: masterOrderId,
        pickup_locations: pickupLocations,
        delivery_address: deliveryAddress,
        total_amount: totalAmount,
        delivery_fee: deliveryFee
      });

      if (!deliveryBatchResponse.success) {
        return { success: false, error: deliveryBatchResponse.error };
      }

      return { success: true, masterOrderId };
    } catch (error) {
      console.error('Error in placeCompleteOrder:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}