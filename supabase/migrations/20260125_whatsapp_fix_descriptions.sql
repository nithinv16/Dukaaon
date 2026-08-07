-- Insert the new ORDER_CANCELLED_BY_RETAILER_to_seller template
-- This notifies the seller when a retailer cancels an order

INSERT INTO whatsapp_template_config (
  template_key, 
  template_name, 
  authkey_template_id, 
  category, 
  description, 
  variable_count, 
  is_automatic, 
  trigger_event, 
  variable_mapping,
  template_body_en
) VALUES (
  'ORDER_CANCELLED_BY_RETAILER_to_seller',
  'Order Cancelled - Notify Seller',
  NULL,  -- Add your Authkey template ID here after approval
  'order',
  'Notify seller when retailer cancels - includes retailer name',
  5,
  TRUE,
  'order.cancelled.retailer',
  '{"1": "sellerName", "2": "orderNumber", "3": "customerName", "4": "paymentStatus", "5": "date"}',
  '❌ Order Cancelled

Dear {#1#},

Order #{#2#} has been cancelled by {#3#}.

Cancellation details:
• Payment status: {#4#}
• Date: {#5#}

No further action required.

- DukaaOn Team'
)
ON CONFLICT (template_key) DO UPDATE SET
  variable_count = 5,
  variable_mapping = '{"1": "sellerName", "2": "orderNumber", "3": "customerName", "4": "paymentStatus", "5": "date"}',
  description = 'Notify seller when retailer cancels - includes retailer name',
  updated_at = NOW();
