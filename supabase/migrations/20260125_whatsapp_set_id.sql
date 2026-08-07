-- FIX: Set a valid template ID for the seller cancellation notification
-- Replace '24468' with your actual new template ID from Authkey.io
-- Currently setting to '24468' (New Order template) just for testing/verification

UPDATE whatsapp_template_config 
SET 
  authkey_template_id = '24468', -- TEMPORARY: using existing ID for testing
  is_enabled = true,
  is_automatic = true,
  updated_at = NOW()
WHERE template_key = 'ORDER_CANCELLED_BY_RETAILER_to_seller';
