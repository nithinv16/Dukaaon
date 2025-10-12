-- Add some test wholesaler accounts
INSERT INTO profiles (
  id,
  role, 
  business_details, 
  latitude, 
  longitude, 
  is_active,
  image_url
)
VALUES 
  (
    gen_random_uuid(), 
    'wholesaler', 
    '{"shopName": "Best Wholesale Shop", "ownerName": "John Doe", "address": {"street": "123 Main St", "city": "New Delhi", "state": "Delhi", "pincode": "110001"}}',
    28.6139, 
    77.2090, 
    true,
    'seller-images/wholesale1.jpg'
  ),
  (
    gen_random_uuid(), 
    'wholesaler', 
    '{"shopName": "Super Grocery Wholesale", "ownerName": "Jane Smith", "address": {"street": "456 Market Ave", "city": "Mumbai", "state": "Maharashtra", "pincode": "400001"}}',
    19.0760, 
    72.8777, 
    true,
    'seller-images/wholesale2.jpg'
  ),
  (
    gen_random_uuid(), 
    'wholesaler', 
    '{"shopName": "Mega Distributors", "ownerName": "Rajesh Kumar", "address": {"street": "789 Distributor Lane", "city": "Bangalore", "state": "Karnataka", "pincode": "560001"}}',
    12.9716, 
    77.5946, 
    true,
    'seller-images/wholesale3.jpg'
  ),
  (
    gen_random_uuid(), 
    'wholesaler', 
    '{"shopName": "Value Wholesalers", "ownerName": "Priya Sharma", "address": {"street": "101 Value Road", "city": "Chennai", "state": "Tamil Nadu", "pincode": "600001"}}',
    13.0827, 
    80.2707, 
    true,
    'seller-images/wholesale4.jpg'
  ),
  (
    gen_random_uuid(), 
    'wholesaler', 
    '{"shopName": "City Distributors", "ownerName": "Amit Patel", "address": {"street": "202 City Center", "city": "Kolkata", "state": "West Bengal", "pincode": "700001"}}',
    22.5726, 
    88.3639, 
    true,
    'seller-images/wholesale5.jpg'
  );

-- Add some test manufacturer accounts
INSERT INTO profiles (
  id,
  role, 
  business_details, 
  latitude, 
  longitude, 
  is_active,
  image_url
)
VALUES 
  (
    gen_random_uuid(), 
    'manufacturer', 
    '{"shopName": "Quality Products Manufacturing", "ownerName": "Arun Singh", "address": {"street": "111 Factory Road", "city": "Pune", "state": "Maharashtra", "pincode": "411001"}}',
    18.5204, 
    73.8567, 
    true,
    'profile-images/manufacturer1.jpg'
  ),
  (
    gen_random_uuid(), 
    'manufacturer', 
    '{"shopName": "Innovative Goods", "ownerName": "Meera Joshi", "address": {"street": "222 Innovation Park", "city": "Hyderabad", "state": "Telangana", "pincode": "500001"}}',
    17.3850, 
    78.4867, 
    true,
    'profile-images/manufacturer2.jpg'
  ),
  (
    gen_random_uuid(), 
    'manufacturer', 
    '{"shopName": "Premier Manufacturing", "ownerName": "Suresh Reddy", "address": {"street": "333 Industrial Area", "city": "Ahmedabad", "state": "Gujarat", "pincode": "380001"}}',
    23.0225, 
    72.5714, 
    true,
    'profile-images/manufacturer3.jpg'
  ),
  (
    gen_random_uuid(), 
    'manufacturer', 
    '{"shopName": "Standard Producers", "ownerName": "Neha Gupta", "address": {"street": "444 Production Lane", "city": "Jaipur", "state": "Rajasthan", "pincode": "302001"}}',
    26.9124, 
    75.7873, 
    true,
    'profile-images/manufacturer4.jpg'
  ),
  (
    gen_random_uuid(), 
    'manufacturer', 
    '{"shopName": "Elite Manufacturing", "ownerName": "Vikram Malhotra", "address": {"street": "555 Elite Street", "city": "Lucknow", "state": "Uttar Pradesh", "pincode": "226001"}}',
    26.8467, 
    80.9462, 
    true,
    'profile-images/manufacturer5.jpg'
  );

-- Query to test nearby wholesalers function with a fixed location in Delhi
SELECT * FROM find_nearby_wholesalers(50, 28.6139, 77.2090);

-- Query to test nearby manufacturers function with a fixed location in Mumbai
SELECT * FROM find_nearby_manufacturers(50, 19.0760, 72.8777); 