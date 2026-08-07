SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('profiles', 'seller_details', 'customers', 'products', 'orders', 'order_items') 
ORDER BY table_name;