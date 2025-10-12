-- AI Agent Database Schema Extension
-- This file creates tables and functions for AI agent functionality
-- including conversation history, voice interactions, and AI sessions

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create ai_conversations table for storing conversation history
CREATE TABLE IF NOT EXISTS public.ai_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    session_id TEXT NOT NULL,
    title TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    
    -- Add foreign key constraint if profiles table exists
    CONSTRAINT fk_ai_conversations_user_id 
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create ai_messages table for storing individual messages
CREATE TABLE IF NOT EXISTS public.ai_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'function')),
    content TEXT NOT NULL,
    function_call JSONB,
    function_response JSONB,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Index for efficient querying
    INDEX idx_ai_messages_conversation_id ON public.ai_messages(conversation_id),
    INDEX idx_ai_messages_created_at ON public.ai_messages(created_at)
);

-- Create ai_voice_sessions table for voice interaction tracking
CREATE TABLE IF NOT EXISTS public.ai_voice_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    session_type TEXT NOT NULL CHECK (session_type IN ('search', 'order', 'chat')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled', 'error')),
    language_code TEXT DEFAULT 'en-US',
    voice_id TEXT DEFAULT 'Joanna',
    
    -- Voice processing metadata
    audio_input_url TEXT,
    audio_output_url TEXT,
    transcript TEXT,
    confidence_score DECIMAL(3,2),
    processing_time_ms INTEGER,
    
    -- Session context
    context JSONB DEFAULT '{}',
    results JSONB DEFAULT '{}',
    error_details JSONB,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    
    -- Add foreign key constraint
    CONSTRAINT fk_ai_voice_sessions_user_id 
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create ai_function_calls table for tracking AI function executions
CREATE TABLE IF NOT EXISTS public.ai_function_calls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
    voice_session_id UUID REFERENCES public.ai_voice_sessions(id) ON DELETE CASCADE,
    function_name TEXT NOT NULL,
    parameters JSONB NOT NULL,
    response JSONB,
    execution_time_ms INTEGER,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'error')),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure at least one parent reference
    CONSTRAINT check_parent_reference 
        CHECK (conversation_id IS NOT NULL OR voice_session_id IS NOT NULL)
);

-- Create ai_recommendations table for storing AI-generated recommendations
CREATE TABLE IF NOT EXISTS public.ai_recommendations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    recommendation_type TEXT NOT NULL CHECK (recommendation_type IN ('personalized', 'similar', 'trending', 'category', 'cart_based')),
    context JSONB NOT NULL DEFAULT '{}',
    recommendations JSONB NOT NULL,
    confidence_score DECIMAL(3,2),
    reasoning TEXT,
    metadata JSONB DEFAULT '{}',
    
    -- Tracking
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
    view_count INTEGER DEFAULT 0,
    click_count INTEGER DEFAULT 0,
    conversion_count INTEGER DEFAULT 0,
    
    -- Add foreign key constraint
    CONSTRAINT fk_ai_recommendations_user_id 
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create ai_analytics table for tracking AI system performance
CREATE TABLE IF NOT EXISTS public.ai_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type TEXT NOT NULL,
    user_id UUID,
    session_id TEXT,
    
    -- Event data
    event_data JSONB NOT NULL,
    response_time_ms INTEGER,
    tokens_used INTEGER,
    cost_estimate DECIMAL(10,6),
    
    -- Context
    user_agent TEXT,
    ip_address INET,
    location JSONB,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Indexes for analytics queries
    INDEX idx_ai_analytics_event_type ON public.ai_analytics(event_type),
    INDEX idx_ai_analytics_created_at ON public.ai_analytics(created_at),
    INDEX idx_ai_analytics_user_id ON public.ai_analytics(user_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_id ON public.ai_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_session_id ON public.ai_conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_created_at ON public.ai_conversations(created_at);

CREATE INDEX IF NOT EXISTS idx_ai_voice_sessions_user_id ON public.ai_voice_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_voice_sessions_status ON public.ai_voice_sessions(status);
CREATE INDEX IF NOT EXISTS idx_ai_voice_sessions_created_at ON public.ai_voice_sessions(created_at);

CREATE INDEX IF NOT EXISTS idx_ai_function_calls_conversation_id ON public.ai_function_calls(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_function_calls_voice_session_id ON public.ai_function_calls(voice_session_id);
CREATE INDEX IF NOT EXISTS idx_ai_function_calls_function_name ON public.ai_function_calls(function_name);

CREATE INDEX IF NOT EXISTS idx_ai_recommendations_user_id ON public.ai_recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_type ON public.ai_recommendations(recommendation_type);
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_expires_at ON public.ai_recommendations(expires_at);

-- Create functions for AI operations

-- Function to create a new conversation
CREATE OR REPLACE FUNCTION public.create_ai_conversation(
    p_user_id UUID,
    p_session_id TEXT,
    p_title TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    conversation_id UUID;
BEGIN
    INSERT INTO public.ai_conversations (user_id, session_id, title, metadata)
    VALUES (p_user_id, p_session_id, p_title, p_metadata)
    RETURNING id INTO conversation_id;
    
    RETURN conversation_id;
END;
$$;

-- Function to add message to conversation
CREATE OR REPLACE FUNCTION public.add_ai_message(
    p_conversation_id UUID,
    p_role TEXT,
    p_content TEXT,
    p_function_call JSONB DEFAULT NULL,
    p_function_response JSONB DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    message_id UUID;
BEGIN
    INSERT INTO public.ai_messages (
        conversation_id, role, content, function_call, function_response, metadata
    )
    VALUES (
        p_conversation_id, p_role, p_content, p_function_call, p_function_response, p_metadata
    )
    RETURNING id INTO message_id;
    
    -- Update conversation timestamp
    UPDATE public.ai_conversations 
    SET updated_at = NOW() 
    WHERE id = p_conversation_id;
    
    RETURN message_id;
END;
$$;

-- Function to create voice session
CREATE OR REPLACE FUNCTION public.create_voice_session(
    p_user_id UUID,
    p_session_type TEXT,
    p_language_code TEXT DEFAULT 'en-US',
    p_voice_id TEXT DEFAULT 'Joanna',
    p_context JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    session_id UUID;
BEGIN
    INSERT INTO public.ai_voice_sessions (
        user_id, session_type, language_code, voice_id, context
    )
    VALUES (
        p_user_id, p_session_type, p_language_code, p_voice_id, p_context
    )
    RETURNING id INTO session_id;
    
    RETURN session_id;
END;
$$;

-- Function to update voice session
CREATE OR REPLACE FUNCTION public.update_voice_session(
    p_session_id UUID,
    p_status TEXT DEFAULT NULL,
    p_transcript TEXT DEFAULT NULL,
    p_confidence_score DECIMAL DEFAULT NULL,
    p_results JSONB DEFAULT NULL,
    p_error_details JSONB DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.ai_voice_sessions 
    SET 
        status = COALESCE(p_status, status),
        transcript = COALESCE(p_transcript, transcript),
        confidence_score = COALESCE(p_confidence_score, confidence_score),
        results = COALESCE(p_results, results),
        error_details = COALESCE(p_error_details, error_details),
        updated_at = NOW(),
        completed_at = CASE WHEN p_status IN ('completed', 'cancelled', 'error') THEN NOW() ELSE completed_at END
    WHERE id = p_session_id;
    
    RETURN FOUND;
END;
$$;

-- Function to log AI analytics
CREATE OR REPLACE FUNCTION public.log_ai_analytics(
    p_event_type TEXT,
    p_user_id UUID DEFAULT NULL,
    p_session_id TEXT DEFAULT NULL,
    p_event_data JSONB DEFAULT '{}',
    p_response_time_ms INTEGER DEFAULT NULL,
    p_tokens_used INTEGER DEFAULT NULL,
    p_cost_estimate DECIMAL DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    analytics_id UUID;
BEGIN
    INSERT INTO public.ai_analytics (
        event_type, user_id, session_id, event_data, 
        response_time_ms, tokens_used, cost_estimate
    )
    VALUES (
        p_event_type, p_user_id, p_session_id, p_event_data,
        p_response_time_ms, p_tokens_used, p_cost_estimate
    )
    RETURNING id INTO analytics_id;
    
    RETURN analytics_id;
END;
$$;

-- Function to clean up expired recommendations
CREATE OR REPLACE FUNCTION public.cleanup_expired_recommendations()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.ai_recommendations 
    WHERE expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

-- Create trigger to update conversation timestamp when messages are added
CREATE OR REPLACE FUNCTION public.update_conversation_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE public.ai_conversations 
    SET updated_at = NOW() 
    WHERE id = NEW.conversation_id;
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_conversation_timestamp
    AFTER INSERT ON public.ai_messages
    FOR EACH ROW
    EXECUTE FUNCTION public.update_conversation_timestamp();

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_voice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_function_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_analytics ENABLE ROW LEVEL SECURITY;

-- Create RLS policies

-- AI Conversations policies
CREATE POLICY "Users can view own conversations" ON public.ai_conversations
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own conversations" ON public.ai_conversations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversations" ON public.ai_conversations
    FOR UPDATE USING (auth.uid() = user_id);

-- AI Messages policies
CREATE POLICY "Users can view messages from own conversations" ON public.ai_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.ai_conversations 
            WHERE id = conversation_id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create messages in own conversations" ON public.ai_messages
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.ai_conversations 
            WHERE id = conversation_id AND user_id = auth.uid()
        )
    );

-- AI Voice Sessions policies
CREATE POLICY "Users can view own voice sessions" ON public.ai_voice_sessions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own voice sessions" ON public.ai_voice_sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own voice sessions" ON public.ai_voice_sessions
    FOR UPDATE USING (auth.uid() = user_id);

-- AI Function Calls policies
CREATE POLICY "Users can view function calls from own sessions" ON public.ai_function_calls
    FOR SELECT USING (
        (conversation_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.ai_conversations 
            WHERE id = conversation_id AND user_id = auth.uid()
        )) OR
        (voice_session_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.ai_voice_sessions 
            WHERE id = voice_session_id AND user_id = auth.uid()
        ))
    );

CREATE POLICY "Users can create function calls in own sessions" ON public.ai_function_calls
    FOR INSERT WITH CHECK (
        (conversation_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.ai_conversations 
            WHERE id = conversation_id AND user_id = auth.uid()
        )) OR
        (voice_session_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.ai_voice_sessions 
            WHERE id = voice_session_id AND user_id = auth.uid()
        ))
    );

-- AI Recommendations policies
CREATE POLICY "Users can view own recommendations" ON public.ai_recommendations
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own recommendations" ON public.ai_recommendations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own recommendations" ON public.ai_recommendations
    FOR UPDATE USING (auth.uid() = user_id);

-- AI Analytics policies (more restrictive - only service role can write)
CREATE POLICY "Service role can manage analytics" ON public.ai_analytics
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can view own analytics" ON public.ai_analytics
    FOR SELECT USING (auth.uid() = user_id);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.ai_conversations TO authenticated;
GRANT SELECT, INSERT ON public.ai_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.ai_voice_sessions TO authenticated;
GRANT SELECT, INSERT ON public.ai_function_calls TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.ai_recommendations TO authenticated;
GRANT SELECT ON public.ai_analytics TO authenticated;
GRANT ALL ON public.ai_analytics TO service_role;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION public.create_ai_conversation TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_ai_message TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_voice_session TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_voice_session TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_ai_analytics TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_recommendations TO service_role;

-- Create a scheduled job to clean up expired recommendations (if pg_cron is available)
-- This would typically be set up separately in the Supabase dashboard
-- SELECT cron.schedule('cleanup-expired-recommendations', '0 2 * * *', 'SELECT public.cleanup_expired_recommendations();');

-- Insert initial test data (optional)
-- This can be removed in production
/*
INSERT INTO public.ai_conversations (user_id, session_id, title) 
VALUES 
    ('00000000-0000-0000-0000-000000000000', 'test-session-1', 'Test Conversation')
ON CONFLICT DO NOTHING;
*/

-- Create views for common queries

-- View for conversation summaries
CREATE OR REPLACE VIEW public.ai_conversation_summaries AS
SELECT 
    c.id,
    c.user_id,
    c.session_id,
    c.title,
    c.created_at,
    c.updated_at,
    COUNT(m.id) as message_count,
    MAX(m.created_at) as last_message_at
FROM public.ai_conversations c
LEFT JOIN public.ai_messages m ON c.id = m.conversation_id
GROUP BY c.id, c.user_id, c.session_id, c.title, c.created_at, c.updated_at;

-- View for voice session summaries
CREATE OR REPLACE VIEW public.ai_voice_session_summaries AS
SELECT 
    vs.id,
    vs.user_id,
    vs.session_type,
    vs.status,
    vs.language_code,
    vs.created_at,
    vs.completed_at,
    vs.processing_time_ms,
    vs.confidence_score,
    COUNT(fc.id) as function_calls_count
FROM public.ai_voice_sessions vs
LEFT JOIN public.ai_function_calls fc ON vs.id = fc.voice_session_id
GROUP BY vs.id, vs.user_id, vs.session_type, vs.status, vs.language_code, 
         vs.created_at, vs.completed_at, vs.processing_time_ms, vs.confidence_score;

-- Grant permissions on views
GRANT SELECT ON public.ai_conversation_summaries TO authenticated;
GRANT SELECT ON public.ai_voice_session_summaries TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE public.ai_conversations IS 'Stores AI conversation sessions with users';
COMMENT ON TABLE public.ai_messages IS 'Stores individual messages within AI conversations';
COMMENT ON TABLE public.ai_voice_sessions IS 'Tracks voice interaction sessions for search and ordering';
COMMENT ON TABLE public.ai_function_calls IS 'Logs AI function calls and their results';
COMMENT ON TABLE public.ai_recommendations IS 'Stores AI-generated product recommendations';
COMMENT ON TABLE public.ai_analytics IS 'Tracks AI system usage and performance metrics';

COMMENT ON FUNCTION public.create_ai_conversation IS 'Creates a new AI conversation session';
COMMENT ON FUNCTION public.add_ai_message IS 'Adds a message to an existing conversation';
COMMENT ON FUNCTION public.create_voice_session IS 'Creates a new voice interaction session';
COMMENT ON FUNCTION public.update_voice_session IS 'Updates voice session status and results';
COMMENT ON FUNCTION public.log_ai_analytics IS 'Logs AI system analytics events';
COMMENT ON FUNCTION public.cleanup_expired_recommendations IS 'Removes expired recommendation records';

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'AI Agent database schema has been successfully created!';
    RAISE NOTICE 'Tables created: ai_conversations, ai_messages, ai_voice_sessions, ai_function_calls, ai_recommendations, ai_analytics';
    RAISE NOTICE 'Functions created: create_ai_conversation, add_ai_message, create_voice_session, update_voice_session, log_ai_analytics, cleanup_expired_recommendations';
    RAISE NOTICE 'Views created: ai_conversation_summaries, ai_voice_session_summaries';
    RAISE NOTICE 'RLS policies and permissions have been configured.';
END $$;