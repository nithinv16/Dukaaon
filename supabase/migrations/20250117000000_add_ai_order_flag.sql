-- Add AI order flag to existing orders table
-- This migration adds a boolean column to track orders placed via AI agent

-- Add the is_ai_order column to the orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_ai_order BOOLEAN DEFAULT FALSE;

-- Add a comment to document the column purpose
COMMENT ON COLUMN orders.is_ai_order IS 'Flag to indicate if the order was placed using the AI ordering agent';

-- Create an index for better query performance when filtering AI orders
CREATE INDEX IF NOT EXISTS idx_orders_is_ai_order ON orders(is_ai_order);

-- Create a partial index for AI orders only (more efficient for AI order queries)
CREATE INDEX IF NOT EXISTS idx_orders_ai_only ON orders(created_at DESC) WHERE is_ai_order = TRUE;

-- Update any existing orders that might have been placed via AI (if needed)
-- This is commented out as we don't have existing AI orders yet
-- UPDATE orders SET is_ai_order = TRUE WHERE /* your criteria for identifying existing AI orders */;

-- Create a view for easy querying of AI orders
CREATE OR REPLACE VIEW ai_orders_view AS
SELECT 
    o.*,
    'AI Agent' as order_source
FROM orders o
WHERE o.is_ai_order = TRUE;

-- Create a view for manual orders
CREATE OR REPLACE VIEW manual_orders_view AS
SELECT 
    o.*,
    'Manual' as order_source
FROM orders o
WHERE o.is_ai_order = FALSE OR o.is_ai_order IS NULL;

-- Function to get order statistics by source
CREATE OR REPLACE FUNCTION get_order_stats_by_source()
RETURNS TABLE (
    order_source TEXT,
    total_orders BIGINT,
    total_amount NUMERIC,
    avg_order_value NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        CASE 
            WHEN o.is_ai_order = TRUE THEN 'AI Agent'
            ELSE 'Manual'
        END as order_source,
        COUNT(*) as total_orders,
        COALESCE(SUM(o.total_amount), 0) as total_amount,
        COALESCE(AVG(o.total_amount), 0) as avg_order_value
    FROM orders o
    GROUP BY 
        CASE 
            WHEN o.is_ai_order = TRUE THEN 'AI Agent'
            ELSE 'Manual'
        END;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions (adjust as needed for your setup)
-- GRANT SELECT, UPDATE ON orders TO your_app_user;
-- GRANT SELECT ON ai_orders_view TO your_app_user;
-- GRANT SELECT ON manual_orders_view TO your_app_user;

-- Display completion message
DO $$
BEGIN
    RAISE NOTICE 'AI order flag migration completed successfully!';
    RAISE NOTICE 'Added is_ai_order column to orders table';
    RAISE NOTICE 'Created indexes for better performance';
    RAISE NOTICE 'Created views: ai_orders_view, manual_orders_view';
    RAISE NOTICE 'Created function: get_order_stats_by_source()';
END $$;