-- Create user_settings table for seller console settings
-- This table stores user preferences for the seller console application

CREATE TABLE IF NOT EXISTS public.user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  notifications_enabled BOOLEAN DEFAULT TRUE,
  order_updates_enabled BOOLEAN DEFAULT TRUE,
  promotions_enabled BOOLEAN DEFAULT FALSE,
  dark_mode BOOLEAN DEFAULT FALSE,
  language VARCHAR(10) DEFAULT 'en',
  email_notifications BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create unique index on user_id to ensure one settings record per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_settings_user_id ON public.user_settings(user_id);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_user_settings_updated_at ON public.user_settings(updated_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_settings
CREATE POLICY "Users can view their own settings" ON public.user_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own settings" ON public.user_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings" ON public.user_settings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own settings" ON public.user_settings
  FOR DELETE USING (auth.uid() = user_id);

-- Create function to automatically create user settings for new users
CREATE OR REPLACE FUNCTION public.create_user_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically create user settings when a new profile is created
DROP TRIGGER IF EXISTS trigger_create_user_settings ON public.profiles;
CREATE TRIGGER trigger_create_user_settings
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.create_user_settings();

-- Create function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_user_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update the updated_at timestamp
DROP TRIGGER IF EXISTS trigger_update_user_settings_timestamp ON public.user_settings;
CREATE TRIGGER trigger_update_user_settings_timestamp
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_settings_timestamp();

-- Add comments for documentation
COMMENT ON TABLE public.user_settings IS 'User preferences and settings for the seller console';
COMMENT ON COLUMN public.user_settings.user_id IS 'Reference to the user profile';
COMMENT ON COLUMN public.user_settings.notifications_enabled IS 'Master toggle for all notifications';
COMMENT ON COLUMN public.user_settings.order_updates_enabled IS 'Enable notifications for order updates';
COMMENT ON COLUMN public.user_settings.promotions_enabled IS 'Enable promotional notifications';
COMMENT ON COLUMN public.user_settings.dark_mode IS 'Enable dark mode theme';
COMMENT ON COLUMN public.user_settings.language IS 'User preferred language code (e.g., en, hi, te, ta, kn, ml)';
COMMENT ON COLUMN public.user_settings.email_notifications IS 'Enable email notifications';