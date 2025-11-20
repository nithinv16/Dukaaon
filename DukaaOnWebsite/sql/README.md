# Database Setup Instructions

This directory contains SQL migration scripts for the DukaaOn Website.

## Prerequisites

- Access to Supabase project dashboard
- The root app's Supabase database (where sellers and products tables already exist)

## Setup Instructions

### 1. Create enquiry_messages Table

1. Open your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Create a new query
4. Copy and paste the contents of `create_enquiry_messages_table.sql`
5. Click **Run** to execute the migration

This will:
- Create the `enquiry_messages` table with all required columns
- Add indexes for optimal query performance
- Set up Row Level Security (RLS) policies
- Configure automatic timestamp updates

### 2. Verify Table Creation

1. In the SQL Editor, create a new query
2. Copy and paste the contents of `test_enquiry_messages.sql`
3. Run the verification queries one by one or all at once
4. Check the results to ensure:
   - Table structure is correct
   - Indexes are created
   - RLS policies are active
   - Insert/update operations work

### 3. Verify Existing Tables

1. In the SQL Editor, create a new query
2. Copy and paste the contents of `verify_existing_tables.sql`
3. Run the entire script to verify:
   - Profiles table structure (where sellers are stored)
   - Seller_details table structure
   - Products/master_products table structure
   - Distance calculation functionality
   - Available seller count

**Important:** Sellers are stored in the `profiles` table with `role IN ('wholesaler', 'manufacturer')`, not in a separate `sellers` table.

Quick verification queries:
```sql
-- Check profiles table (main user table)
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles';

-- Check seller_details table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'seller_details';

-- Count available sellers
SELECT role, COUNT(*) 
FROM profiles 
WHERE role IN ('wholesaler', 'manufacturer') 
AND status = 'active'
GROUP BY role;
```

## Table Schema

### enquiry_messages

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| seller_id | UUID | Foreign key to sellers table (nullable) |
| visitor_name | VARCHAR(255) | Name of visitor |
| visitor_email | VARCHAR(255) | Email address |
| visitor_phone | VARCHAR(20) | Phone number |
| visitor_location | VARCHAR(255) | Visitor's location |
| message | TEXT | Enquiry message |
| enquiry_type | VARCHAR(50) | Type: 'seller', 'general', or 'contact' |
| status | VARCHAR(50) | Status: 'new', 'read', 'responded', or 'closed' |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |

### Indexes

- `idx_enquiry_messages_seller_id` - For filtering by seller
- `idx_enquiry_messages_status` - For filtering by status
- `idx_enquiry_messages_enquiry_type` - For filtering by type
- `idx_enquiry_messages_created_at` - For sorting by date

### RLS Policies

- **Public Insert**: Allows anyone to submit enquiries (for website visitors)
- **Authenticated Read**: Allows authenticated users to view all enquiries (for admin)
- **Authenticated Update**: Allows authenticated users to update enquiries (for status changes)

## Troubleshooting

### Error: relation "sellers" does not exist

This means the sellers table from the root app is not accessible. Ensure you're using the same Supabase project as the root app.

### Error: permission denied

Check that RLS policies are correctly configured. The public should be able to insert, and authenticated users should be able to read/update.

### Error: uuid_generate_v4() function does not exist

Run this to enable the UUID extension:

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

## Next Steps

After setting up the database:

1. Update your `.env.local` file with Supabase credentials
2. Test the API endpoints that interact with this table
3. Verify the enquiry form submission works end-to-end
