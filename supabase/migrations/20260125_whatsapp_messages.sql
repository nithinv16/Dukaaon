-- WhatsApp Automation Tables
-- Stores messages, conversations, and CONFIGURABLE template settings

-- ============================================================================
-- 1. WHATSAPP TEMPLATE CONFIGURATION (Dynamic - No Hardcoding!)
-- ============================================================================

CREATE TABLE IF NOT EXISTS whatsapp_template_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Template identification
  template_key TEXT NOT NULL UNIQUE,  -- e.g., 'NEW_ORDER_RECEIVED', 'ORDER_CONFIRMED'
  template_name TEXT NOT NULL,        -- Human readable name
  authkey_template_id TEXT,           -- Authkey.io template ID (update this when template changes)
  
  -- Template details
  category TEXT NOT NULL CHECK (category IN ('order', 'payment', 'delivery', 'marketing', 'support')),
  description TEXT,
  variable_count INTEGER DEFAULT 0,
  variable_mapping JSONB,             -- Maps variable positions to field names
  
  -- Template content (for reference - actual template is in Authkey)
  template_body_en TEXT,              -- English version
  template_body_hi TEXT,              -- Hindi version
  template_body_kn TEXT,              -- Kannada version
  template_body_ta TEXT,              -- Tamil version
  template_body_te TEXT,              -- Telugu version
  
  -- Auto-send configuration
  is_automatic BOOLEAN DEFAULT TRUE,  -- Auto-send or manual only
  is_enabled BOOLEAN DEFAULT TRUE,    -- Enable/disable template
  
  -- Trigger configuration (when to auto-send)
  trigger_event TEXT,                 -- e.g., 'order.created', 'order.confirmed', 'payment.due'
  trigger_conditions JSONB,           -- Additional conditions: {"days_before": 3, "min_amount": 1000}
  send_time_preference TEXT,          -- 'immediate', 'morning', 'evening', 'scheduled'
  scheduled_time TIME,                -- If send_time_preference is 'scheduled'
  
  -- Rate limiting
  cooldown_minutes INTEGER DEFAULT 0, -- Minimum time between sends to same user
  max_sends_per_day INTEGER,          -- Max sends per user per day
  
  -- Metadata
  priority INTEGER DEFAULT 5,         -- 1-10, higher = more important
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  updated_by UUID
);

CREATE INDEX idx_template_key ON whatsapp_template_config(template_key);
CREATE INDEX idx_template_trigger ON whatsapp_template_config(trigger_event);
CREATE INDEX idx_template_enabled ON whatsapp_template_config(is_enabled);

-- ============================================================================
-- 2. WHATSAPP MESSAGES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Message identification
  phone_number TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message_type TEXT CHECK (message_type IN ('text', 'template', 'media', 'ai_response')),
  
  -- Message content
  content TEXT,
  template_key TEXT REFERENCES whatsapp_template_config(template_key),
  template_variables JSONB,
  
  -- Relations
  related_order_id UUID,
  related_user_id UUID,
  
  -- AI processing
  ai_intent TEXT,
  ai_confidence DECIMAL(5,4),
  ai_response TEXT,
  ai_tool_calls JSONB,
  
  -- Conversation tracking
  conversation_id UUID,
  parent_message_id UUID REFERENCES whatsapp_messages(id),
  
  -- Language and localization
  language TEXT DEFAULT 'en',
  detected_language TEXT,
  
  -- Status tracking
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed', 'processed')),
  error_message TEXT,
  authkey_message_id TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_whatsapp_phone ON whatsapp_messages(phone_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_order ON whatsapp_messages(related_order_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_user ON whatsapp_messages(related_user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversation ON whatsapp_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_status ON whatsapp_messages(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_created ON whatsapp_messages(created_at DESC);

-- ============================================================================
-- 3. WHATSAPP CONVERSATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS whatsapp_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL UNIQUE,
  user_id UUID,
  user_role TEXT,
  
  -- Conversation state
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_content TEXT,
  last_message_direction TEXT,
  
  -- Context for AI
  context JSONB DEFAULT '{}',
  pending_action TEXT,
  pending_order_id UUID,
  
  -- Stats
  total_messages INTEGER DEFAULT 0,
  ai_interactions INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wa_conv_phone ON whatsapp_conversations(phone_number);
CREATE INDEX IF NOT EXISTS idx_wa_conv_user ON whatsapp_conversations(user_id);

-- ============================================================================
-- 4. ORDER RESPONSES TABLE (for quick actions via WhatsApp)
-- ============================================================================

CREATE TABLE IF NOT EXISTS whatsapp_order_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  seller_id UUID NOT NULL,
  phone_number TEXT NOT NULL,
  
  -- Response details
  action TEXT NOT NULL CHECK (action IN (
    'confirm', 'reject', 'partial', 'out_of_stock', 
    'ready', 'delay', 'cancel', 'modify'
  )),
  reason TEXT,
  items_affected JSONB,
  new_eta TIMESTAMPTZ,
  
  -- Source message
  message_id UUID REFERENCES whatsapp_messages(id),
  
  -- Processing
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wa_order_resp_order ON whatsapp_order_responses(order_id);
CREATE INDEX IF NOT EXISTS idx_wa_order_resp_seller ON whatsapp_order_responses(seller_id);

-- ============================================================================
-- 5. TEMPLATE SEND HISTORY (For rate limiting and analytics)
-- ============================================================================

CREATE TABLE IF NOT EXISTS whatsapp_template_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT NOT NULL REFERENCES whatsapp_template_config(template_key),
  phone_number TEXT NOT NULL,
  user_id UUID,
  related_order_id UUID,
  
  -- Send details
  variables_used JSONB,
  language_used TEXT DEFAULT 'en',
  
  -- Status
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read', 'failed')),
  authkey_response JSONB,
  error_message TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_template_sends_phone ON whatsapp_template_sends(phone_number);
CREATE INDEX IF NOT EXISTS idx_template_sends_template ON whatsapp_template_sends(template_key);
CREATE INDEX IF NOT EXISTS idx_template_sends_date ON whatsapp_template_sends(created_at DESC);

-- Rate limiting index: sends per user per template per day
CREATE INDEX IF NOT EXISTS idx_template_sends_rate_limit ON whatsapp_template_sends(phone_number, template_key, created_at);

-- ============================================================================
-- 6. FUNCTION: Update conversation on new message
-- ============================================================================

CREATE OR REPLACE FUNCTION update_whatsapp_conversation()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO whatsapp_conversations (
    phone_number,
    user_id,
    last_message_at,
    last_message_content,
    last_message_direction,
    total_messages
  )
  VALUES (
    NEW.phone_number,
    NEW.related_user_id,
    NEW.created_at,
    LEFT(NEW.content, 200),
    NEW.direction,
    1
  )
  ON CONFLICT (phone_number) DO UPDATE SET
    user_id = COALESCE(NEW.related_user_id, whatsapp_conversations.user_id),
    last_message_at = NEW.created_at,
    last_message_content = LEFT(NEW.content, 200),
    last_message_direction = NEW.direction,
    total_messages = whatsapp_conversations.total_messages + 1,
    ai_interactions = CASE 
      WHEN NEW.ai_response IS NOT NULL 
      THEN whatsapp_conversations.ai_interactions + 1 
      ELSE whatsapp_conversations.ai_interactions 
    END,
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_whatsapp_conversation ON whatsapp_messages;
CREATE TRIGGER trg_update_whatsapp_conversation
  AFTER INSERT ON whatsapp_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_whatsapp_conversation();

-- ============================================================================
-- 7. FUNCTION: Check rate limit before sending
-- ============================================================================

CREATE OR REPLACE FUNCTION check_whatsapp_rate_limit(
  p_phone_number TEXT,
  p_template_key TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_config whatsapp_template_config%ROWTYPE;
  v_recent_sends INTEGER;
  v_last_send TIMESTAMPTZ;
BEGIN
  -- Get template config
  SELECT * INTO v_config FROM whatsapp_template_config WHERE template_key = p_template_key;
  
  IF NOT FOUND THEN
    RETURN FALSE; -- Template not found
  END IF;
  
  -- Check cooldown
  IF v_config.cooldown_minutes > 0 THEN
    SELECT MAX(created_at) INTO v_last_send
    FROM whatsapp_template_sends
    WHERE phone_number = p_phone_number AND template_key = p_template_key;
    
    IF v_last_send IS NOT NULL AND 
       v_last_send > NOW() - (v_config.cooldown_minutes * INTERVAL '1 minute') THEN
      RETURN FALSE; -- Still in cooldown
    END IF;
  END IF;
  
  -- Check daily limit
  IF v_config.max_sends_per_day IS NOT NULL THEN
    SELECT COUNT(*) INTO v_recent_sends
    FROM whatsapp_template_sends
    WHERE phone_number = p_phone_number 
      AND template_key = p_template_key
      AND created_at > CURRENT_DATE;
    
    IF v_recent_sends >= v_config.max_sends_per_day THEN
      RETURN FALSE; -- Daily limit reached
    END IF;
  END IF;
  
  RETURN TRUE; -- OK to send
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 8. INSERT DEFAULT TEMPLATE CONFIGURATIONS
-- ============================================================================

INSERT INTO whatsapp_template_config (template_key, template_name, authkey_template_id, category, description, variable_count, is_automatic, trigger_event, variable_mapping) VALUES

-- Order Management Templates
('NEW_ORDER_RECEIVED', 'New Order Received', '24468', 'order', 'Notify seller of new order', 4, TRUE, 'order.created', 
 '{"1": "orderNumber", "2": "customerName", "3": "totalAmount", "4": "items"}'),
 
('ORDER_CONFIRMED', 'Order Confirmed', NULL, 'order', 'Confirm order to retailer', 4, TRUE, 'order.confirmed',
 '{"1": "customerName", "2": "orderNumber", "3": "sellerName", "4": "eta"}'),
 
('ORDER_REJECTED', 'Order Rejected', NULL, 'order', 'Notify retailer of rejection', 3, TRUE, 'order.rejected',
 '{"1": "customerName", "2": "orderNumber", "3": "reason"}'),
 
('ORDER_PARTIALLY_AVAILABLE', 'Order Partially Available', NULL, 'order', 'Some items out of stock', 5, TRUE, 'order.partial',
 '{"1": "orderNumber", "2": "availableItems", "3": "unavailableItems", "4": "newTotal"}'),
 
('ORDER_READY_FOR_PICKUP', 'Order Ready for Pickup', NULL, 'order', 'Order ready for delivery pickup', 4, TRUE, 'order.ready',
 '{"1": "sellerName", "2": "orderNumber", "3": "pickupLocation", "4": "readyTime"}'),
 
('ORDER_CANCELLED_BY_SELLER', 'Order Cancelled by Seller', NULL, 'order', 'Seller cancelled order', 4, TRUE, 'order.cancelled.seller',
 '{"1": "customerName", "2": "orderNumber", "3": "reason", "4": "refundInfo"}'),
 
('ORDER_CANCELLED_BY_RETAILER', 'Order Cancelled by Retailer', NULL, 'order', 'Retailer cancellation confirmed', 4, TRUE, 'order.cancelled.retailer',
 '{"1": "customerName", "2": "orderNumber", "3": "refundInfo", "4": "refundDate"}'),
 
('ORDER_SUMMARY_DAILY', 'Daily Order Summary', NULL, 'order', 'Daily order summary for seller', 6, TRUE, 'schedule.daily',
 '{"1": "sellerName", "2": "date", "3": "totalOrders", "4": "totalAmount", "5": "completed", "6": "pending"}'),

-- Payment Templates
('PAYMENT_RECEIVED', 'Payment Received', NULL, 'payment', 'Payment confirmation', 4, TRUE, 'payment.received',
 '{"1": "customerName", "2": "amount", "3": "orderNumber", "4": "remainingBalance"}'),
 
('PAYMENT_REMINDER', 'Payment Reminder', NULL, 'payment', 'Upcoming payment due', 4, TRUE, 'payment.reminder',
 '{"1": "customerName", "2": "amount", "3": "dueDate", "4": "daysLeft"}'),
 
('PAYMENT_OVERDUE', 'Payment Overdue', NULL, 'payment', 'Payment past due', 5, TRUE, 'payment.overdue',
 '{"1": "customerName", "2": "amount", "3": "daysPastDue", "4": "lateFee", "5": "totalDue"}'),
 
('PAYMENT_PARTIAL', 'Partial Payment Received', NULL, 'payment', 'Partial payment received', 5, TRUE, 'payment.partial',
 '{"1": "customerName", "2": "paidAmount", "3": "orderNumber", "4": "remainingBalance", "5": "dueDate"}'),
 
('CREDIT_LIMIT_REACHED', 'Credit Limit Alert', NULL, 'payment', 'Credit limit warning', 4, TRUE, 'credit.limit_warning',
 '{"1": "customerName", "2": "creditLimit", "3": "usedAmount", "4": "available"}'),

-- Delivery Templates
('DELIVERY_ASSIGNED', 'Delivery Partner Assigned', NULL, 'delivery', 'Delivery partner assigned', 4, TRUE, 'delivery.assigned',
 '{"1": "orderNumber", "2": "driverName", "3": "driverPhone", "4": "eta"}'),
 
('DELIVERY_STARTED', 'Delivery Started', NULL, 'delivery', 'Driver picked up order', 4, TRUE, 'delivery.started',
 '{"1": "orderNumber", "2": "driverName", "3": "eta", "4": "trackingLink"}'),
 
('DELIVERY_ARRIVING', 'Delivery Arriving', NULL, 'delivery', 'Driver nearby', 4, TRUE, 'delivery.arriving',
 '{"1": "orderNumber", "2": "minutesAway", "3": "driverName", "4": "driverPhone"}'),
 
('DELIVERY_COMPLETED', 'Delivery Completed', NULL, 'delivery', 'Order delivered', 4, TRUE, 'delivery.completed',
 '{"1": "orderNumber", "2": "totalAmount", "3": "items", "4": "feedbackLink"}'),
 
('DELIVERY_DELAYED', 'Delivery Delayed', NULL, 'delivery', 'Delay notification', 3, TRUE, 'delivery.delayed',
 '{"1": "orderNumber", "2": "newEta", "3": "reason"}'),

-- Marketing Templates
('REORDER_REMINDER', 'Reorder Reminder', NULL, 'marketing', 'Weekly stock purchase reminder', 4, TRUE, 'schedule.weekly_reorder',
 '{"1": "productList", "2": "lastOrderDate", "3": "message", "4": "link"}'),
 
('LOW_STOCK_ALERT', 'Low Stock Alert', NULL, 'marketing', 'Items running low based on patterns', 3, TRUE, 'analytics.low_stock',
 '{"1": "items", "2": "estimatedDaysLeft", "3": "link"}'),
 
('WELCOME_MESSAGE', 'Welcome Message', NULL, 'marketing', 'New user onboarding', 2, TRUE, 'user.registered',
 '{"1": "userName", "2": "welcomeOffer"}'),
 
('INACTIVE_USER', 'Inactive User', NULL, 'marketing', 'Win back inactive users', 4, TRUE, 'schedule.inactive_check',
 '{"1": "userName", "2": "daysSinceOrder", "3": "specialOffer", "4": "link"}'),

-- Support Templates
('SUPPORT_TICKET_CREATED', 'Support Ticket Created', NULL, 'support', 'Complaint registered', 4, TRUE, 'support.created',
 '{"1": "ticketId", "2": "issue", "3": "expectedResolution", "4": "contactInfo"}'),
 
('SUPPORT_TICKET_RESOLVED', 'Support Ticket Resolved', NULL, 'support', 'Issue resolved', 4, TRUE, 'support.resolved',
 '{"1": "ticketId", "2": "resolution", "3": "feedbackLink", "4": "message"}'),
 
('GENERAL_RESPONSE', 'General Response', NULL, 'support', 'Custom support response', 2, FALSE, NULL,
 '{"1": "userName", "2": "message"}')

ON CONFLICT (template_key) DO NOTHING;

-- ============================================================================
-- 9. RLS POLICIES (Using service role for most operations)
-- ============================================================================

ALTER TABLE whatsapp_template_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_order_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_template_sends ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY "Service role full access on templates" ON whatsapp_template_config
  FOR ALL USING (true);

CREATE POLICY "Service role full access on messages" ON whatsapp_messages
  FOR ALL USING (true);

CREATE POLICY "Service role full access on conversations" ON whatsapp_conversations
  FOR ALL USING (true);

CREATE POLICY "Service role full access on order responses" ON whatsapp_order_responses
  FOR ALL USING (true);

CREATE POLICY "Service role full access on template sends" ON whatsapp_template_sends
  FOR ALL USING (true);

-- ============================================================================
-- 10. COMMENTS
-- ============================================================================

COMMENT ON TABLE whatsapp_template_config IS 'Dynamic template configuration - update template IDs here without code changes';
COMMENT ON COLUMN whatsapp_template_config.authkey_template_id IS 'Update this when template ID changes in Authkey.io';
COMMENT ON COLUMN whatsapp_template_config.trigger_event IS 'Event that triggers auto-send, e.g., order.created, payment.due';
COMMENT ON COLUMN whatsapp_template_config.trigger_conditions IS 'JSON conditions for triggering, e.g., {"min_amount": 1000}';
