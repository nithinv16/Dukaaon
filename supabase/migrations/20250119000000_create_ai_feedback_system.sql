-- =====================================================
-- AI Feedback System Migration
-- Creates tables and functions for collecting and analyzing
-- user feedback on AI responses to improve the model
-- =====================================================

-- 1. Create AI Feedback Table
CREATE TABLE IF NOT EXISTS public.ai_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id TEXT NOT NULL,
    conversation_id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    rating TEXT NOT NULL CHECK (rating IN ('positive', 'negative')),
    feedback_text TEXT,
    feedback_category TEXT, -- 'wrong_product', 'irrelevant', 'helpful', 'accurate', 'other'
    response_content TEXT NOT NULL,
    user_query TEXT, -- The user's original query that led to this response
    function_calls JSONB DEFAULT '[]',
    search_results_count INTEGER DEFAULT 0,
    order_items_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_ai_feedback_user_id ON public.ai_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_conversation_id ON public.ai_feedback(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_rating ON public.ai_feedback(rating);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_created_at ON public.ai_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_category ON public.ai_feedback(feedback_category);

-- Enable RLS
ALTER TABLE public.ai_feedback ENABLE ROW LEVEL SECURITY;

-- Users can insert their own feedback
CREATE POLICY "Users can insert own feedback"
    ON public.ai_feedback
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Users can view their own feedback
CREATE POLICY "Users can view own feedback"
    ON public.ai_feedback
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- 2. Create AI Feedback Analytics View (for admin use)
CREATE OR REPLACE VIEW public.ai_feedback_analytics AS
SELECT 
    DATE_TRUNC('day', created_at) as date,
    rating,
    feedback_category,
    COUNT(*) as count,
    AVG(search_results_count) as avg_search_results,
    AVG(order_items_count) as avg_order_items
FROM public.ai_feedback
GROUP BY DATE_TRUNC('day', created_at), rating, feedback_category
ORDER BY date DESC;

-- 3. Create function to save AI feedback
CREATE OR REPLACE FUNCTION public.save_ai_feedback(
    p_message_id TEXT,
    p_conversation_id TEXT,
    p_user_id UUID,
    p_rating TEXT,
    p_feedback_text TEXT DEFAULT NULL,
    p_feedback_category TEXT DEFAULT NULL,
    p_response_content TEXT DEFAULT '',
    p_user_query TEXT DEFAULT NULL,
    p_function_calls JSONB DEFAULT '[]',
    p_search_results_count INTEGER DEFAULT 0,
    p_order_items_count INTEGER DEFAULT 0,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_feedback_id UUID;
BEGIN
    INSERT INTO public.ai_feedback (
        message_id,
        conversation_id,
        user_id,
        rating,
        feedback_text,
        feedback_category,
        response_content,
        user_query,
        function_calls,
        search_results_count,
        order_items_count,
        metadata
    ) VALUES (
        p_message_id,
        p_conversation_id,
        p_user_id,
        p_rating,
        p_feedback_text,
        p_feedback_category,
        p_response_content,
        p_user_query,
        p_function_calls,
        p_search_results_count,
        p_order_items_count,
        p_metadata
    )
    RETURNING id INTO v_feedback_id;
    
    RETURN v_feedback_id;
END;
$$;

-- 4. Create function to get feedback summary for a user
CREATE OR REPLACE FUNCTION public.get_user_feedback_summary(p_user_id UUID)
RETURNS TABLE (
    total_feedback BIGINT,
    positive_count BIGINT,
    negative_count BIGINT,
    positive_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT as total_feedback,
        COUNT(*) FILTER (WHERE rating = 'positive')::BIGINT as positive_count,
        COUNT(*) FILTER (WHERE rating = 'negative')::BIGINT as negative_count,
        CASE 
            WHEN COUNT(*) > 0 THEN 
                ROUND((COUNT(*) FILTER (WHERE rating = 'positive')::NUMERIC / COUNT(*)::NUMERIC) * 100, 2)
            ELSE 0
        END as positive_rate
    FROM public.ai_feedback
    WHERE user_id = p_user_id;
END;
$$;

-- 5. Create function to get common negative feedback patterns
CREATE OR REPLACE FUNCTION public.get_negative_feedback_patterns(
    p_limit INTEGER DEFAULT 10,
    p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
    feedback_category TEXT,
    count BIGINT,
    sample_queries TEXT[],
    sample_responses TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH ranked_categories AS (
        SELECT 
            f.feedback_category,
            COUNT(*)::BIGINT as category_count
        FROM public.ai_feedback f
        WHERE f.rating = 'negative'
        AND f.created_at > NOW() - (p_days || ' days')::INTERVAL
        AND f.feedback_category IS NOT NULL
        GROUP BY f.feedback_category
        ORDER BY COUNT(*) DESC
        LIMIT p_limit
    )
    SELECT 
        rc.feedback_category,
        rc.category_count,
        COALESCE(
            (SELECT ARRAY(
                SELECT DISTINCT LEFT(f2.user_query, 100)
                FROM public.ai_feedback f2
                WHERE f2.feedback_category = rc.feedback_category
                AND f2.rating = 'negative'
                AND f2.created_at > NOW() - (p_days || ' days')::INTERVAL
                AND f2.user_query IS NOT NULL
                LIMIT 5
            )),
            ARRAY[]::TEXT[]
        ) as sample_queries,
        COALESCE(
            (SELECT ARRAY(
                SELECT DISTINCT LEFT(f3.response_content, 200)
                FROM public.ai_feedback f3
                WHERE f3.feedback_category = rc.feedback_category
                AND f3.rating = 'negative'
                AND f3.created_at > NOW() - (p_days || ' days')::INTERVAL
                LIMIT 3
            )),
            ARRAY[]::TEXT[]
        ) as sample_responses
    FROM ranked_categories rc
    ORDER BY rc.category_count DESC;
END;
$$;

-- 6. Create AI Improvement Suggestions table (for storing actionable insights)
CREATE TABLE IF NOT EXISTS public.ai_improvement_suggestions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    suggestion_type TEXT NOT NULL, -- 'prompt_update', 'category_mapping', 'search_improvement'
    description TEXT NOT NULL,
    based_on_feedback_count INTEGER DEFAULT 0,
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'implemented', 'rejected')),
    implementation_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.save_ai_feedback TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_feedback_summary TO authenticated;

COMMENT ON TABLE public.ai_feedback IS 'Stores user feedback on AI responses for analysis and improvement';
COMMENT ON TABLE public.ai_improvement_suggestions IS 'Tracks suggestions for AI improvements based on feedback patterns';

