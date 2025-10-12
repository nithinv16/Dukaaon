-- Create extensions required for UUID generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================
-- Payment Configuration (UPI/Bank)
-- =============================

CREATE TABLE IF NOT EXISTS public.payment_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_type TEXT NOT NULL CHECK (config_type IN ('upi', 'bank_account')),
    is_active BOOLEAN DEFAULT true,
    
    -- UPI Configuration
    upi_id TEXT,
    merchant_name TEXT,
    
    -- Bank Account Configuration
    account_number TEXT,
    ifsc_code TEXT,
    bank_name TEXT,
    account_holder_name TEXT,
    
    -- Common fields
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_upi_config CHECK (
        (config_type = 'upi' AND upi_id IS NOT NULL AND merchant_name IS NOT NULL) OR
        config_type != 'upi'
    ),
    CONSTRAINT valid_bank_config CHECK (
        (config_type = 'bank_account' AND account_number IS NOT NULL AND ifsc_code IS NOT NULL AND bank_name IS NOT NULL AND account_holder_name IS NOT NULL) OR
        config_type != 'bank_account'
    )
);

-- Ensure only one active config per type
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_config_active_type 
ON public.payment_config (config_type) 
WHERE is_active = true;

-- Function: get_payment_config(p_config_type TEXT) -> JSONB
CREATE OR REPLACE FUNCTION public.get_payment_config(p_config_type TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    config_record RECORD;
BEGIN
    -- Validate config type
    IF p_config_type NOT IN ('upi', 'bank_account') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Invalid config type. Must be upi or bank_account'
        );
    END IF;

    -- Get active configuration
    SELECT * INTO config_record
    FROM public.payment_config
    WHERE config_type = p_config_type AND is_active = true
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'No active configuration found for type: ' || p_config_type
        );
    END IF;

    -- Return configuration based on type
    IF p_config_type = 'upi' THEN
        RETURN jsonb_build_object(
            'success', true,
            'data', jsonb_build_object(
                'upi_id', config_record.upi_id,
                'merchant_name', config_record.merchant_name,
                'description', config_record.description
            )
        );
    ELSIF p_config_type = 'bank_account' THEN
        RETURN jsonb_build_object(
            'success', true,
            'data', jsonb_build_object(
                'account_number', config_record.account_number,
                'ifsc_code', config_record.ifsc_code,
                'bank_name', config_record.bank_name,
                'account_holder_name', config_record.account_holder_name,
                'description', config_record.description
            )
        );
    END IF;

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$;

-- Function: update_payment_config(p_config_type TEXT, p_config_data JSONB) -> JSONB
CREATE OR REPLACE FUNCTION public.update_payment_config(
    p_config_type TEXT,
    p_config_data JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    config_id UUID;
    is_admin BOOLEAN;
BEGIN
    -- Require admin role to update
    is_admin := COALESCE(auth.jwt() ->> 'role', '') = 'admin';
    IF NOT is_admin THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Not authorized to update payment configuration'
        );
    END IF;

    -- Validate config type
    IF p_config_type NOT IN ('upi', 'bank_account') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Invalid config type. Must be upi or bank_account'
        );
    END IF;

    -- Deactivate existing active configuration
    UPDATE public.payment_config
    SET is_active = false, updated_at = NOW()
    WHERE config_type = p_config_type AND is_active = true;

    -- Insert new configuration
    IF p_config_type = 'upi' THEN
        INSERT INTO public.payment_config (
            config_type, upi_id, merchant_name, description, is_active
        ) VALUES (
            'upi',
            p_config_data->>'upi_id',
            p_config_data->>'merchant_name',
            p_config_data->>'description',
            true
        ) RETURNING id INTO config_id;
    ELSIF p_config_type = 'bank_account' THEN
        INSERT INTO public.payment_config (
            config_type, account_number, ifsc_code, bank_name, account_holder_name, description, is_active
        ) VALUES (
            'bank_account',
            p_config_data->>'account_number',
            p_config_data->>'ifsc_code',
            p_config_data->>'bank_name',
            p_config_data->>'account_holder_name',
            p_config_data->>'description',
            true
        ) RETURNING id INTO config_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Payment configuration updated successfully',
        'config_id', config_id
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$;

-- Grants
GRANT SELECT ON public.payment_config TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_payment_config(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_payment_config(TEXT, JSONB) TO authenticated;

-- Seed default UPI configuration (optional)
INSERT INTO public.payment_config (
    config_type,
    upi_id,
    merchant_name,
    description,
    is_active
) VALUES (
    'upi',
    'nithinvthomas96-1@okaxis',
    'DukaaOn',
    'Default UPI configuration for DukaaOn platform',
    true
) ON CONFLICT DO NOTHING;

-- RLS for payment_config
ALTER TABLE public.payment_config ENABLE ROW LEVEL SECURITY;

-- Read policy: all authenticated users can read
CREATE POLICY IF NOT EXISTS "Allow authenticated users to read payment config"
ON public.payment_config
FOR SELECT
TO authenticated
USING (true);

-- Admin policy: only admin can modify rows directly
CREATE POLICY IF NOT EXISTS "Allow admin users to manage payment config"
ON public.payment_config
FOR ALL
TO authenticated
USING (auth.jwt() ->> 'role' = 'admin')
WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_payment_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS payment_config_updated_at ON public.payment_config;
CREATE TRIGGER payment_config_updated_at
    BEFORE UPDATE ON public.payment_config
    FOR EACH ROW
    EXECUTE FUNCTION public.update_payment_config_updated_at();


-- =============================
-- User Payment Methods (per user)
-- =============================

CREATE TABLE IF NOT EXISTS public.payment_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('upi', 'card', 'netbanking', 'cod')),
    title TEXT NOT NULL,
    is_default BOOLEAN DEFAULT false,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_payment_methods_user_id ON public.payment_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_is_default ON public.payment_methods(is_default);

-- Ensure only one default method per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_methods_user_default
ON public.payment_methods(user_id)
WHERE is_default = true;

-- RLS for payment_methods
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

-- Policies: users manage their own methods
CREATE POLICY IF NOT EXISTS "Users can view their own payment methods" ON public.payment_methods
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can insert their own payment methods" ON public.payment_methods
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can update their own payment methods" ON public.payment_methods
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can delete their own payment methods" ON public.payment_methods
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);