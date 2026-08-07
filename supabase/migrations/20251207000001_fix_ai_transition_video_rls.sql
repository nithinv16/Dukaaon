-- Fix RLS policy for ai_transition_video table
-- This table should be readable by all users (authenticated and anonymous)
-- as it contains configuration data needed by the app

-- First, check if table exists and enable RLS if not already enabled
DO $$
BEGIN
    -- Enable RLS on the table if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'ai_transition_video'
    ) THEN
        ALTER TABLE public.ai_transition_video ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Allow public read access to ai_transition_video" ON public.ai_transition_video;

-- Create policy to allow all users (authenticated and anonymous) to read from the table
CREATE POLICY "Allow public read access to ai_transition_video" 
ON public.ai_transition_video
FOR SELECT
USING (true);

-- Grant SELECT permission to authenticated and anonymous users
GRANT SELECT ON public.ai_transition_video TO anon, authenticated;

