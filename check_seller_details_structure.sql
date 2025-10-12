-- Check the current structure of seller_details table
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM 
    information_schema.columns
WHERE 
    table_name = 'seller_details'
    AND table_schema = 'public'
ORDER BY 
    ordinal_position;