-- SQL script to create a function for atomic profile creation
CREATE OR REPLACE FUNCTION public.create_profile_if_not_exists(
  p_user_id TEXT,
  p_phone TEXT,
  p_role TEXT,
  p_language TEXT DEFAULT 'en',
  p_status TEXT DEFAULT 'pending'
)
RETURNS SETOF profiles AS $$
BEGIN
  -- First check if profile exists
  RETURN QUERY
  WITH inserted AS (
    INSERT INTO public.profiles (
      user_id,
      phone_number,
      role,
      language,
      status,
      created_at,
      updated_at
    )
    VALUES (
      p_user_id,
      p_phone,
      p_role,
      p_language,
      p_status,
      NOW(),
      NOW()
    )
    ON CONFLICT (user_id) DO NOTHING
    RETURNING *
  )
  SELECT *
  FROM inserted
  UNION ALL
  SELECT *
  FROM public.profiles
  WHERE user_id = p_user_id
  AND NOT EXISTS (SELECT 1 FROM inserted);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;