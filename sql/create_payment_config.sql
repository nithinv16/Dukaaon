-- Create payment configuration table to store recipient details
-- This replaces hardcoded UPI ID and bank details in the application

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

-- Create unique index to ensure only one active config per type
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_config_active_type 
ON public.payment_config (config_type) 
WHERE is_active = true;

-- Function to get active payment configuration
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

-- Function to update payment configuration
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
BEGIN
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

-- Grant permissions
GRANT SELECT ON public.payment_config TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_payment_config(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_payment_config(TEXT, JSONB) TO authenticated;

-- Insert default UPI configuration (replace with your actual details)
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

-- Create RLS policies
ALTER TABLE public.payment_config ENABLE ROW LEVEL SECURITY;

-- Policy for reading payment config (all authenticated users can read)
CREATE POLICY "Allow authenticated users to read payment config"
ON public.payment_config
FOR SELECT
TO authenticated
USING (true);

-- Policy for updating payment config (only admin users - you can modify this based on your admin logic)
CREATE POLICY "Allow admin users to manage payment config"
ON public.payment_config
FOR ALL
TO authenticated
USING (auth.jwt() ->> 'role' = 'admin');

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_payment_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payment_config_updated_at
    BEFORE UPDATE ON public.payment_config
    FOR EACH ROW
    EXECUTE FUNCTION public.update_payment_config_updated_at();