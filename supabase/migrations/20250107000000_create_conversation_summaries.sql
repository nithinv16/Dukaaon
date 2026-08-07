-- Migration: Create conversation_summaries table
-- Purpose: Store AI-generated summaries of long conversations to manage token limits
-- Date: 2025-01-07

-- Create conversation_summaries table
CREATE TABLE IF NOT EXISTS public.conversation_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL,
    summary_text TEXT NOT NULL,
    message_range_start INTEGER NOT NULL DEFAULT 0,
    message_range_end INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Drop existing constraint if it exists, then add it
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'conversation_summaries_conversation_id_fkey'
    ) THEN
        ALTER TABLE public.conversation_summaries 
        DROP CONSTRAINT conversation_summaries_conversation_id_fkey;
    END IF;
END $$;

-- Add foreign key constraint
ALTER TABLE public.conversation_summaries
ADD CONSTRAINT conversation_summaries_conversation_id_fkey 
    FOREIGN KEY (conversation_id) 
    REFERENCES public.ai_conversations(id) 
    ON DELETE CASCADE;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_conversation_summaries_conv_id 
    ON public.conversation_summaries(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_summaries_range 
    ON public.conversation_summaries(conversation_id, message_range_end);

-- Enable Row Level Security
ALTER TABLE public.conversation_summaries ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view summaries for their own conversations
DROP POLICY IF EXISTS "Users can view their own conversation summaries" ON public.conversation_summaries;
CREATE POLICY "Users can view their own conversation summaries"
    ON public.conversation_summaries
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.ai_conversations
            WHERE ai_conversations.id = conversation_summaries.conversation_id
            AND ai_conversations.user_id = auth.uid()
        )
    );

-- System can insert summaries (via service role)
DROP POLICY IF EXISTS "Service can insert conversation summaries" ON public.conversation_summaries;
CREATE POLICY "Service can insert conversation summaries"
    ON public.conversation_summaries
    FOR INSERT
    WITH CHECK (true); -- Service role will handle this

-- Grant permissions
GRANT SELECT ON public.conversation_summaries TO authenticated;
GRANT INSERT ON public.conversation_summaries TO authenticated;

-- Add comment
COMMENT ON TABLE public.conversation_summaries IS 
    'Stores AI-generated summaries of conversation history to manage token limits in long conversations';

