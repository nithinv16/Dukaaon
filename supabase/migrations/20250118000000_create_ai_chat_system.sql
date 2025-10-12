-- AI Chat System Migration
-- Creates tables and functions for AI chat history and enhanced profile access

-- 1. Create AI conversations table
CREATE TABLE IF NOT EXISTS public.ai_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    thread_id TEXT UNIQUE NOT NULL, -- Azure AI thread ID
    title TEXT DEFAULT 'New Conversation',
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create AI messages table
CREATE TABLE IF NOT EXISTS public.ai_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    function_calls JSONB DEFAULT '[]', -- Store function calls made by assistant
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_id ON public.ai_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_thread_id ON public.ai_conversations(thread_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_status ON public.ai_conversations(status);
CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_id ON public.ai_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_created_at ON public.ai_messages(created_at);

-- 4. Enable RLS on both tables
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies for ai_conversations
DROP POLICY IF EXISTS "Users can view their own conversations" ON public.ai_conversations;
CREATE POLICY "Users can view their own conversations" ON public.ai_conversations
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own conversations" ON public.ai_conversations;
CREATE POLICY "Users can create their own conversations" ON public.ai_conversations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own conversations" ON public.ai_conversations;
CREATE POLICY "Users can update their own conversations" ON public.ai_conversations
    FOR UPDATE USING (auth.uid() = user_id);

-- 6. Create RLS policies for ai_messages
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.ai_messages;
CREATE POLICY "Users can view messages in their conversations" ON public.ai_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.ai_conversations 
            WHERE id = conversation_id AND user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can create messages in their conversations" ON public.ai_messages;
CREATE POLICY "Users can create messages in their conversations" ON public.ai_messages
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.ai_conversations 
            WHERE id = conversation_id AND user_id = auth.uid()
        )
    );

-- 7. Create function to get or create conversation
CREATE OR REPLACE FUNCTION public.get_or_create_ai_conversation(
    p_user_id UUID,
    p_thread_id TEXT,
    p_title TEXT DEFAULT 'New Conversation'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    conversation_id UUID;
BEGIN
    -- Try to find existing conversation
    SELECT id INTO conversation_id
    FROM public.ai_conversations
    WHERE user_id = p_user_id AND thread_id = p_thread_id;
    
    -- If not found, create new conversation
    IF conversation_id IS NULL THEN
        INSERT INTO public.ai_conversations (user_id, thread_id, title)
        VALUES (p_user_id, p_thread_id, p_title)
        RETURNING id INTO conversation_id;
    END IF;
    
    RETURN conversation_id;
END;
$$;

-- 8. Create function to save AI message
CREATE OR REPLACE FUNCTION public.save_ai_message(
    p_conversation_id UUID,
    p_role TEXT,
    p_content TEXT,
    p_function_calls JSONB DEFAULT '[]',
    p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    message_id UUID;
BEGIN
    INSERT INTO public.ai_messages (
        conversation_id,
        role,
        content,
        function_calls,
        metadata
    )
    VALUES (
        p_conversation_id,
        p_role,
        p_content,
        p_function_calls,
        p_metadata
    )
    RETURNING id INTO message_id;
    
    -- Update conversation timestamp
    UPDATE public.ai_conversations
    SET updated_at = NOW()
    WHERE id = p_conversation_id;
    
    RETURN message_id;
END;
$$;

-- 9. Create function to get conversation history
CREATE OR REPLACE FUNCTION public.get_ai_conversation_history(
    p_user_id UUID,
    p_thread_id TEXT,
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    message_id UUID,
    role TEXT,
    content TEXT,
    function_calls JSONB,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.id,
        m.role,
        m.content,
        m.function_calls,
        m.metadata,
        m.created_at
    FROM public.ai_messages m
    JOIN public.ai_conversations c ON m.conversation_id = c.id
    WHERE c.user_id = p_user_id AND c.thread_id = p_thread_id
    ORDER BY m.created_at ASC
    LIMIT p_limit;
END;
$$;

-- 10. Create function to get user conversations list
CREATE OR REPLACE FUNCTION public.get_user_ai_conversations(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
    conversation_id UUID,
    thread_id TEXT,
    title TEXT,
    status TEXT,
    last_message TEXT,
    message_count BIGINT,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.thread_id,
        c.title,
        c.status,
        (
            SELECT m.content 
            FROM public.ai_messages m 
            WHERE m.conversation_id = c.id 
            ORDER BY m.created_at DESC 
            LIMIT 1
        ) as last_message,
        (
            SELECT COUNT(*) 
            FROM public.ai_messages m 
            WHERE m.conversation_id = c.id
        ) as message_count,
        c.created_at,
        c.updated_at
    FROM public.ai_conversations c
    WHERE c.user_id = p_user_id AND c.status = 'active'
    ORDER BY c.updated_at DESC
    LIMIT p_limit;
END;
$$;

-- 11. Create function to get enhanced user profile for AI
CREATE OR REPLACE FUNCTION public.get_ai_user_profile(
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    profile_data JSONB;
BEGIN
    SELECT jsonb_build_object(
        'id', p.id,
        'phone_number', p.phone_number,
        'role', p.role,
        'status', p.status,
        'business_details', p.business_details,
        'location', jsonb_build_object(
            'latitude', p.latitude,
            'longitude', p.longitude,
            'address', p.location_address
        ),
        'language', p.language,
        'shop_image_url', p.shop_image_url,
        'kyc_document_urls', p.kyc_document_urls,
        'created_at', p.created_at,
        'updated_at', p.updated_at,
        'seller_details', CASE 
            WHEN p.role = 'seller' THEN jsonb_build_object(
                'shop_name', p.business_details->>'shopName',
                'shop_address', p.business_details->>'address',
                'shop_type', p.business_details->>'shopType',
                'gst_number', p.business_details->>'gstNumber',
                'pan_number', p.business_details->>'panNumber'
            )
            ELSE NULL
        END,
        'retailer_details', CASE 
            WHEN p.role = 'retailer' THEN jsonb_build_object(
                'shop_name', p.business_details->>'shopName',
                'shop_address', p.business_details->>'address',
                'preferred_categories', p.business_details->>'preferredCategories'
            )
            ELSE NULL
        END
    ) INTO profile_data
    FROM public.profiles p
    WHERE p.id = p_user_id;
    
    RETURN COALESCE(profile_data, '{}'::jsonb);
END;
$$;

-- 12. Create trigger to update conversation timestamp
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.ai_conversations
    SET updated_at = NOW()
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_conversation_timestamp ON public.ai_messages;
CREATE TRIGGER trigger_update_conversation_timestamp
    AFTER INSERT ON public.ai_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_timestamp();

-- 13. Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.ai_conversations TO authenticated;
GRANT ALL ON public.ai_messages TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_ai_conversation TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_ai_message TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ai_conversation_history TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_ai_conversations TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ai_user_profile TO authenticated;

-- 14. Insert sample data for testing (optional)
-- This will be commented out in production
/*
INSERT INTO public.ai_conversations (user_id, thread_id, title) 
SELECT id, 'sample_thread_' || id::text, 'Sample Conversation'
FROM auth.users 
LIMIT 1;
*/

COMMIT;