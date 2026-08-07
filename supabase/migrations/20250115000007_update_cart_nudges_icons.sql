-- Update existing cart nudges with invalid icon names to valid Material Community Icons
UPDATE public.cart_nudges
SET icon = 'alert-circle'
WHERE icon = 'alert-circle-outline' OR icon = 'information-circle-outline';

UPDATE public.cart_nudges
SET icon = 'cash'
WHERE icon = 'cash-outline';

-- Update any nudges with invalid icon names to use default icons based on type
UPDATE public.cart_nudges
SET icon = CASE 
    WHEN type = 'warning' THEN 'alert-circle'
    WHEN type = 'error' THEN 'close-circle'
    WHEN type = 'success' THEN 'check-circle'
    WHEN type = 'info' THEN 'information'
    ELSE 'information'
END
WHERE icon IN (
    'alert-circle-outline',
    'information-circle-outline',
    'checkmark-circle-outline',
    'close-circle-outline',
    'cash-outline'
);

DO $$
BEGIN
    RAISE NOTICE 'Updated cart nudges with valid Material Community Icons';
END $$;
