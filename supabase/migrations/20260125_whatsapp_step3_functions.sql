-- ============================================================================
-- WhatsApp Step 3: Functions and triggers (optional)
-- Run this after Step 2 succeeds
-- ============================================================================

-- Function to update conversation on new message
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

-- Function: Check rate limit before sending
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
    RETURN FALSE;
  END IF;
  
  -- Check cooldown
  IF v_config.cooldown_minutes > 0 THEN
    SELECT MAX(created_at) INTO v_last_send
    FROM whatsapp_template_sends
    WHERE phone_number = p_phone_number AND template_key = p_template_key;
    
    IF v_last_send IS NOT NULL AND 
       v_last_send > NOW() - (v_config.cooldown_minutes * INTERVAL '1 minute') THEN
      RETURN FALSE;
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
      RETURN FALSE;
    END IF;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Enable RLS (optional - all policies allow full access)
ALTER TABLE whatsapp_template_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_order_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_template_sends ENABLE ROW LEVEL SECURITY;

-- Simple policies - allow all (adjust as needed for security)
DROP POLICY IF EXISTS "Allow all on templates" ON whatsapp_template_config;
CREATE POLICY "Allow all on templates" ON whatsapp_template_config FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all on messages" ON whatsapp_messages;
CREATE POLICY "Allow all on messages" ON whatsapp_messages FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all on conversations" ON whatsapp_conversations;
CREATE POLICY "Allow all on conversations" ON whatsapp_conversations FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all on order_responses" ON whatsapp_order_responses;
CREATE POLICY "Allow all on order_responses" ON whatsapp_order_responses FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all on template_sends" ON whatsapp_template_sends;
CREATE POLICY "Allow all on template_sends" ON whatsapp_template_sends FOR ALL USING (true);

