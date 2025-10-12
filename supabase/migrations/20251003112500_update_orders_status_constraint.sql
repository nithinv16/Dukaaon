-- Update orders.status constraint to include all statuses used by the application flows

BEGIN;

-- Drop existing status check constraint if present
ALTER TABLE public.orders
DROP CONSTRAINT IF EXISTS orders_status_check;

-- Recreate status check constraint with expanded set
ALTER TABLE public.orders
ADD CONSTRAINT orders_status_check CHECK (
  status IN (
    'draft',
    'pending',
    'confirmed',
    'preparing',
    'ready',
    'accepted',
    'processing',
    'picked_up',
    'in_transit',
    'out_for_delivery',
    'shipped',
    'delivered',
    'cancelled',
    'completed',
    'rejected'
  )
);

COMMIT;