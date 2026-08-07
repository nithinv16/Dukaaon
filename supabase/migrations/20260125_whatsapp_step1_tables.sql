-- ============================================================================
-- WhatsApp Automation Tables - Clean standalone migration
-- Run this in Supabase SQL Editor
-- ============================================================================

-- 1. WHATSAPP TEMPLATE CONFIGURATION
CREATE TABLE IF NOT EXISTS whatsapp_template_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT NOT NULL UNIQUE,
  template_name TEXT NOT NULL,
  authkey_template_id TEXT,
  category TEXT NOT NULL CHECK (category IN ('order', 'payment', 'delivery', 'marketing', 'support')),
  description TEXT,
  variable_count INTEGER DEFAULT 0,
  variable_mapping JSONB,
  template_body_en TEXT,
  template_body_hi TEXT,
  is_automatic BOOLEAN DEFAULT TRUE,
  is_enabled BOOLEAN DEFAULT TRUE,
  trigger_event TEXT,
  trigger_conditions JSONB,
  send_time_preference TEXT,
  scheduled_time TIME,
  cooldown_minutes INTEGER DEFAULT 0,
  max_sends_per_day INTEGER,
  priority INTEGER DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  updated_by UUID
);

CREATE INDEX IF NOT EXISTS idx_template_key ON whatsapp_template_config(template_key);
CREATE INDEX IF NOT EXISTS idx_template_trigger ON whatsapp_template_config(trigger_event);
CREATE INDEX IF NOT EXISTS idx_template_enabled ON whatsapp_template_config(is_enabled);

-- 2. WHATSAPP MESSAGES TABLE
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message_type TEXT CHECK (message_type IN ('text', 'template', 'media', 'ai_response')),
  content TEXT,
  template_key TEXT,
  template_variables JSONB,
  related_order_id UUID,
  related_user_id UUID,
  ai_intent TEXT,
  ai_confidence DECIMAL(5,4),
  ai_response TEXT,
  ai_tool_calls JSONB,
  conversation_id UUID,
  parent_message_id UUID,
  language TEXT DEFAULT 'en',
  detected_language TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed', 'processed')),
  error_message TEXT,
  authkey_message_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_phone ON whatsapp_messages(phone_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_order ON whatsapp_messages(related_order_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_user ON whatsapp_messages(related_user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversation ON whatsapp_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_status ON whatsapp_messages(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_created ON whatsapp_messages(created_at DESC);

-- 3. WHATSAPP CONVERSATIONS TABLE
CREATE TABLE IF NOT EXISTS whatsapp_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL UNIQUE,
  user_id UUID,
  user_role TEXT,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_content TEXT,
  last_message_direction TEXT,
  context JSONB DEFAULT '{}',
  pending_action TEXT,
  pending_order_id UUID,
  total_messages INTEGER DEFAULT 0,
  ai_interactions INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wa_conv_phone ON whatsapp_conversations(phone_number);
CREATE INDEX IF NOT EXISTS idx_wa_conv_user ON whatsapp_conversations(user_id);

-- 4. ORDER RESPONSES TABLE
CREATE TABLE IF NOT EXISTS whatsapp_order_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  seller_id UUID NOT NULL,
  phone_number TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN (
    'confirm', 'reject', 'partial', 'out_of_stock', 
    'ready', 'delay', 'cancel', 'modify'
  )),
  reason TEXT,
  items_affected JSONB,
  new_eta TIMESTAMPTZ,
  message_id UUID,
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wa_order_resp_order ON whatsapp_order_responses(order_id);
CREATE INDEX IF NOT EXISTS idx_wa_order_resp_seller ON whatsapp_order_responses(seller_id);

-- 5. TEMPLATE SEND HISTORY
CREATE TABLE IF NOT EXISTS whatsapp_template_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  user_id UUID,
  related_order_id UUID,
  variables_used JSONB,
  language_used TEXT DEFAULT 'en',
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read', 'failed')),
  authkey_response JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_template_sends_phone ON whatsapp_template_sends(phone_number);
CREATE INDEX IF NOT EXISTS idx_template_sends_template ON whatsapp_template_sends(template_key);
CREATE INDEX IF NOT EXISTS idx_template_sends_date ON whatsapp_template_sends(created_at DESC);
