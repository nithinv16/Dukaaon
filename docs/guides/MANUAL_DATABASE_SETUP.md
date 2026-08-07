# Manual Database Setup for user_settings Table

The seller console settings page requires a `user_settings` table that doesn't currently exist in the database. Follow these steps to create it:

## Option 1: Execute SQL in Supabase Dashboard

1. Go to your Supabase project dashboard: https://supabase.com/dashboard/project/xcpznnkpjgyrpbvpnvit
2. Navigate to the SQL Editor
3. Execute the following SQL:

```sql
-- Create user_settings table for seller console settings
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
```

## Option 2: Use Migration File

The migration file has been created at:
`supabase/migrations/20250115120000_create_user_settings_table.sql`

To apply it:
1. Ensure Supabase CLI is properly configured
2. Run: `npx supabase db push`

## Current Status

- ✅ Settings page has been updated with error handling
- ✅ Default settings are shown when table doesn't exist
- ✅ Helpful error messages guide users to contact administrator
- ⚠️ Database table needs to be created manually

## After Creating the Table

Once the table is created:
1. The settings page will automatically work
2. Users can save and load their preferences
3. New users will automatically get default settings
4. All settings are properly secured with RLS policies

## Table Schema

The `user_settings` table includes:
- `notifications_enabled`: Master toggle for all notifications
- `order_updates_enabled`: Enable notifications for order updates
- `promotions_enabled`: Enable promotional notifications
- `dark_mode`: Enable dark mode theme
- `language`: User preferred language code (en, hi, te, ta, kn, ml)
- `email_notifications`: Enable email notifications