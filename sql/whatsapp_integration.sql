-- WhatsApp Business API Integration Schema
-- This script creates the necessary tables and functions for WhatsApp messaging

-- Create WhatsApp messages log table
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_phone VARCHAR(20) NOT NULL,
  message_type VARCHAR(50) NOT NULL, -- 'text', 'template', 'media'
  template_name VARCHAR(100), -- for template messages
  content TEXT,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'read', 'failed'
  whatsapp_message_id VARCHAR(100), -- ID returned by WhatsApp API
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  delivered_at TIMESTAMP WITH TIME ZONE,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add WhatsApp preferences to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS whatsapp_notifications BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS whatsapp_number VARCHAR(20),
ADD COLUMN IF NOT EXISTS whatsapp_opt_in BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS whatsapp_opt_in_date TIMESTAMP WITH TIME ZONE;

-- Create WhatsApp templates table for managing approved templates
CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  category VARCHAR(50) NOT NULL, -- 'UTILITY', 'MARKETING', 'AUTHENTICATION'
  language_code VARCHAR(10) NOT NULL DEFAULT 'en',
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  header_text TEXT,
  body_text TEXT NOT NULL,
  footer_text TEXT,
  button_text TEXT,
  variables JSONB, -- Array of variable names
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create WhatsApp webhook events table
CREATE TABLE IF NOT EXISTS whatsapp_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(50) NOT NULL, -- 'message_status', 'message_received'
  whatsapp_message_id VARCHAR(100),
  phone_number VARCHAR(20),
  status VARCHAR(20),
  timestamp_received BIGINT,
  raw_data JSONB,
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_recipient ON whatsapp_messages(recipient_phone);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_status ON whatsapp_messages(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_sent_at ON whatsapp_messages(sent_at);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_whatsapp_id ON whatsapp_messages(whatsapp_message_id);
CREATE INDEX IF NOT EXISTS idx_profiles_whatsapp_number ON profiles(whatsapp_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_webhook_events_message_id ON whatsapp_webhook_events(whatsapp_message_id);

-- Insert default WhatsApp templates
INSERT INTO whatsapp_templates (name, category, language_code, body_text, variables) VALUES
('order_update', 'UTILITY', 'en', 'Hi! Your order {{1}} has been {{2}}. Total amount: ₹{{3}}. Thank you for choosing DukaaOn!', '["order_id", "status", "amount"]'),
('stock_alert', 'UTILITY', 'en', 'Stock Alert! {{1}} is now available from {{2}} at ₹{{3}}. Order now on DukaaOn!', '["product_name", "wholesaler_name", "price"]'),
('delivery_update', 'UTILITY', 'en', 'Your order {{1}} is out for delivery! Expected delivery: {{2}}. Track: {{3}}', '["order_id", "delivery_time", "tracking_url"]'),
('payment_reminder', 'UTILITY', 'en', 'Payment reminder for order {{1}}. Amount: ₹{{2}}. Please complete payment to avoid cancellation.', '["order_id", "amount"]'),
('welcome_message', 'UTILITY', 'en', 'Welcome to DukaaOn, {{1}}! Your account has been verified. Start exploring wholesale products now!', '["customer_name"]'),
('seller_order_alert', 'UTILITY', 'en', 'New order #{{1}} received from {{2}}! Total: ₹{{3}}. {{4}} items ordered. Please confirm and prepare. Check DukaaOn app for details.', '["order_number", "retailer_name", "total_amount", "items_count"]')
ON CONFLICT (name) DO NOTHING;

-- Function to get user WhatsApp preferences
CREATE OR REPLACE FUNCTION get_whatsapp_preferences(user_phone VARCHAR)
RETURNS TABLE (
  whatsapp_notifications BOOLEAN,
  whatsapp_number VARCHAR,
  whatsapp_opt_in BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.whatsapp_notifications,
    p.whatsapp_number,
    p.whatsapp_opt_in
  FROM profiles p
  WHERE p.phone_number = user_phone;
END;
$$ LANGUAGE plpgsql;

-- Function to update WhatsApp opt-in status
CREATE OR REPLACE FUNCTION update_whatsapp_opt_in(
  user_phone VARCHAR,
  opt_in_status BOOLEAN
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE profiles 
  SET 
    whatsapp_opt_in = opt_in_status,
    whatsapp_opt_in_date = CASE WHEN opt_in_status THEN NOW() ELSE NULL END,
    updated_at = NOW()
  WHERE phone_number = user_phone;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to log WhatsApp message
CREATE OR REPLACE FUNCTION log_whatsapp_message(
  recipient VARCHAR,
  msg_type VARCHAR,
  content_text TEXT,
  template_name_param VARCHAR DEFAULT NULL,
  whatsapp_msg_id VARCHAR DEFAULT NULL,
  status_param VARCHAR DEFAULT 'pending'
)
RETURNS UUID AS $$
DECLARE
  message_id UUID;
BEGIN
  INSERT INTO whatsapp_messages (
    recipient_phone,
    message_type,
    template_name,
    content,
    whatsapp_message_id,
    status
  ) VALUES (
    recipient,
    msg_type,
    template_name_param,
    content_text,
    whatsapp_msg_id,
    status_param
  ) RETURNING id INTO message_id;
  
  RETURN message_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update message status
CREATE OR REPLACE FUNCTION update_whatsapp_message_status(
  whatsapp_msg_id VARCHAR,
  new_status VARCHAR,
  error_msg TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE whatsapp_messages 
  SET 
    status = new_status,
    error_message = error_msg,
    delivered_at = CASE WHEN new_status = 'delivered' THEN NOW() ELSE delivered_at END,
    read_at = CASE WHEN new_status = 'read' THEN NOW() ELSE read_at END,
    updated_at = NOW()
  WHERE whatsapp_message_id = whatsapp_msg_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to get WhatsApp message statistics
CREATE OR REPLACE FUNCTION get_whatsapp_stats(
  start_date TIMESTAMP DEFAULT NOW() - INTERVAL '30 days',
  end_date TIMESTAMP DEFAULT NOW()
)
RETURNS TABLE (
  total_messages BIGINT,
  sent_messages BIGINT,
  delivered_messages BIGINT,
  read_messages BIGINT,
  failed_messages BIGINT,
  delivery_rate NUMERIC,
  read_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_messages,
    COUNT(*) FILTER (WHERE status = 'sent') as sent_messages,
    COUNT(*) FILTER (WHERE status = 'delivered') as delivered_messages,
    COUNT(*) FILTER (WHERE status = 'read') as read_messages,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_messages,
    ROUND(
      (COUNT(*) FILTER (WHERE status = 'delivered')::NUMERIC / 
       NULLIF(COUNT(*) FILTER (WHERE status IN ('sent', 'delivered', 'read')), 0)) * 100, 2
    ) as delivery_rate,
    ROUND(
      (COUNT(*) FILTER (WHERE status = 'read')::NUMERIC / 
       NULLIF(COUNT(*) FILTER (WHERE status IN ('delivered', 'read')), 0)) * 100, 2
    ) as read_rate
  FROM whatsapp_messages
  WHERE sent_at BETWEEN start_date AND end_date;
END;
$$ LANGUAGE plpgsql;

-- Enable RLS (Row Level Security) for WhatsApp tables
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_webhook_events ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Allow service role to access all WhatsApp data
CREATE POLICY "Service role can access all whatsapp_messages" ON whatsapp_messages
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can access all whatsapp_templates" ON whatsapp_templates
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can access all whatsapp_webhook_events" ON whatsapp_webhook_events
  FOR ALL USING (auth.role() = 'service_role');

-- Allow authenticated users to view their own WhatsApp messages
CREATE POLICY "Users can view their own whatsapp messages" ON whatsapp_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.phone_number = whatsapp_messages.recipient_phone 
      AND profiles.user_id = auth.uid()
    )
  );

-- Allow users to view approved templates
CREATE POLICY "Users can view approved templates" ON whatsapp_templates
  FOR SELECT USING (status = 'approved');

-- Grant necessary permissions
GRANT ALL ON whatsapp_messages TO service_role;
GRANT ALL ON whatsapp_templates TO service_role;
GRANT ALL ON whatsapp_webhook_events TO service_role;

GRANT SELECT ON whatsapp_messages TO authenticated;
GRANT SELECT ON whatsapp_templates TO authenticated;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_whatsapp_messages_updated_at
  BEFORE UPDATE ON whatsapp_messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_whatsapp_templates_updated_at
  BEFORE UPDATE ON whatsapp_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE whatsapp_messages IS 'Log of all WhatsApp messages sent through Business API';
COMMENT ON TABLE whatsapp_templates IS 'Approved WhatsApp message templates';
COMMENT ON TABLE whatsapp_webhook_events IS 'WhatsApp webhook events for message status updates';
COMMENT ON COLUMN profiles.whatsapp_notifications IS 'User preference for receiving WhatsApp notifications';
COMMENT ON COLUMN profiles.whatsapp_number IS 'User WhatsApp number (may differ from login phone)';
COMMENT ON COLUMN profiles.whatsapp_opt_in IS 'User has explicitly opted in for WhatsApp messaging';