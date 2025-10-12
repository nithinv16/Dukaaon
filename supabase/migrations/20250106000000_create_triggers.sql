-- Create triggers that depend on multiple tables being created
-- This migration should run after all base tables are created

-- Create trigger to automatically update customer stats when orders change
DROP TRIGGER IF EXISTS trigger_update_customer_stats ON orders;
CREATE TRIGGER trigger_update_customer_stats
    AFTER INSERT OR UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_customer_stats();

-- Log the trigger creation
DO $$
BEGIN
    RAISE NOTICE 'Database triggers created successfully';
END $$;