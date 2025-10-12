-- Function to update KYC document URLs in profiles table
-- This function bypasses RLS policies using SECURITY DEFINER

CREATE OR REPLACE FUNCTION public.update_kyc_document(
    p_user_id UUID,
    p_document_type TEXT,
    p_document_url TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Validate document type
    IF p_document_type NOT IN ('id_proof', 'address_proof', 'business_proof') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Invalid document type. Must be id_proof, address_proof, or business_proof'
        );
    END IF;

    -- Update the specific document URL column
    IF p_document_type = 'id_proof' THEN
        UPDATE public.profiles 
        SET id_proof = p_document_url,
            updated_at = NOW()
        WHERE id = p_user_id;
    ELSIF p_document_type = 'address_proof' THEN
        UPDATE public.profiles 
        SET address_proof = p_document_url,
            updated_at = NOW()
        WHERE id = p_user_id;
    ELSIF p_document_type = 'business_proof' THEN
        UPDATE public.profiles 
        SET business_proof = p_document_url,
            updated_at = NOW()
        WHERE id = p_user_id;
    END IF;

    -- Check if update was successful
    IF FOUND THEN
        RETURN jsonb_build_object(
            'success', true,
            'message', 'Document URL updated successfully'
        );
    ELSE
        RETURN jsonb_build_object(
            'success', false,
            'error', 'User not found or update failed'
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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.update_kyc_document(UUID, TEXT, TEXT) TO authenticated;