# Database Schema Documentation

This document describes the database structure used by the DukaaOn Website, including both existing tables from the root app and the new table created specifically for the website.

## Overview

The DukaaOn Website uses the **same Supabase database** as the root mobile app. This means:
- ✅ All seller data already exists in the database
- ✅ No need to migrate or duplicate data
- ✅ Real-time updates when sellers are added/modified in the mobile app
- ✅ Only ONE new table needs to be created: `enquiry_messages`

## Existing Tables (From Root App)

### 1. profiles

The main user table that stores all users including retailers, wholesalers, and manufacturers.

**Key Fields:**
```sql
id                UUID PRIMARY KEY
fire_id           TEXT (Firebase UID)
phone_number      TEXT
role              TEXT ('retailer', 'wholesaler', 'manufacturer')
status            TEXT ('active', 'inactive', 'pending')
business_details  JSONB
created_at        TIMESTAMP
updated_at        TIMESTAMP
```

**business_details JSONB Structure:**
```json
{
  "shopName": "Business Name",
  "ownerName": "Owner Name",
  "address": "Full Address",
  "city": "City Name",
  "state": "State Name",
  "pincode": "123456",
  "latitude": "19.0760",
  "longitude": "72.8777",
  "categories": ["Electronics", "Groceries"]
}
```

**How the Website Uses This Table:**
- Query sellers by filtering `role IN ('wholesaler', 'manufacturer')`
- Extract business information from `business_details` JSONB field
- Use `latitude` and `longitude` for distance calculations
- Display `shopName` as business name on seller cards

**Example Query:**
```sql
SELECT 
    id,
    phone_number,
    role,
    business_details->>'shopName' as business_name,
    business_details->>'ownerName' as owner_name,
    business_details->>'address' as location_address,
    (business_details->>'latitude')::DECIMAL as latitude,
    (business_details->>'longitude')::DECIMAL as longitude,
    business_details->'categories' as categories
FROM profiles
WHERE role IN ('wholesaler', 'manufacturer')
AND status = 'active'
AND business_details->>'latitude' IS NOT NULL;
```

### 2. seller_details

Extended information table specifically for sellers (wholesalers and manufacturers).

**Key Fields:**
```sql
id                UUID PRIMARY KEY
user_id           UUID REFERENCES profiles(id)
seller_type       TEXT ('wholesaler', 'manufacturer')
business_name     TEXT
owner_name        TEXT
address           JSONB
location_address  TEXT
latitude          DECIMAL(10, 8)
longitude         DECIMAL(11, 8)
image_url         TEXT
is_active         BOOLEAN
created_at        TIMESTAMP
updated_at        TIMESTAMP
```

**How the Website Uses This Table:**
- Join with `profiles` to get complete seller information
- Use `image_url` for seller profile pictures
- Filter by `is_active = true` to show only active sellers
- Use `seller_type` to distinguish between wholesalers and manufacturers

**Example Query:**
```sql
SELECT 
    sd.id,
    sd.business_name,
    sd.seller_type,
    sd.location_address,
    sd.latitude,
    sd.longitude,
    sd.image_url,
    p.phone_number,
    p.business_details
FROM seller_details sd
JOIN profiles p ON sd.user_id = p.id
WHERE sd.is_active = true
AND p.status = 'active';
```

### 3. products / master_products

Product listings associated with sellers.

**Expected Fields:**
```sql
id              UUID PRIMARY KEY
seller_id       UUID REFERENCES profiles(id)
product_name    TEXT
category        TEXT
image_url       TEXT
description     TEXT
created_at      TIMESTAMP
```

**How the Website Uses This Table:**
- Display product images on seller profile pages
- Show product categories
- **Important:** Prices are NOT displayed on the website (as per requirements)

**Example Query:**
```sql
SELECT 
    id,
    product_name,
    category,
    image_url,
    description
FROM products
WHERE seller_id = 'SELLER_UUID_HERE'
ORDER BY created_at DESC
LIMIT 20;
```

## New Table (Website-Specific)

### enquiry_messages

This is the **ONLY new table** that needs to be created for the website. It stores all enquiries from website visitors.

**Schema:**
```sql
CREATE TABLE enquiry_messages (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seller_id         UUID REFERENCES sellers(id) ON DELETE CASCADE,
  visitor_name      VARCHAR(255) NOT NULL,
  visitor_email     VARCHAR(255) NOT NULL,
  visitor_phone     VARCHAR(20) NOT NULL,
  visitor_location  VARCHAR(255),
  message           TEXT NOT NULL,
  enquiry_type      VARCHAR(50) DEFAULT 'seller' 
                    CHECK (enquiry_type IN ('seller', 'general', 'contact')),
  status            VARCHAR(50) DEFAULT 'new' 
                    CHECK (status IN ('new', 'read', 'responded', 'closed')),
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Indexes:**
```sql
CREATE INDEX idx_enquiry_messages_seller_id ON enquiry_messages(seller_id);
CREATE INDEX idx_enquiry_messages_status ON enquiry_messages(status);
CREATE INDEX idx_enquiry_messages_enquiry_type ON enquiry_messages(enquiry_type);
CREATE INDEX idx_enquiry_messages_created_at ON enquiry_messages(created_at DESC);
```

**RLS Policies:**
- **Public Insert**: Allows anyone to submit enquiries (website visitors)
- **Authenticated Read**: Allows authenticated users to view enquiries (admin dashboard)
- **Authenticated Update**: Allows authenticated users to update status (admin)

**Enquiry Types:**
- `seller`: Enquiry about a specific seller
- `general`: General enquiry about DukaaOn
- `contact`: Contact form submission

**Status Values:**
- `new`: Just submitted, not yet viewed
- `read`: Admin has viewed the enquiry
- `responded`: Admin has responded to the visitor
- `closed`: Enquiry is resolved/closed

## Distance Calculation

The website uses the **Haversine formula** to calculate distances between the visitor's location and sellers.

**Formula:**
```sql
6371 * acos(
    cos(radians(user_latitude)) * 
    cos(radians(seller_latitude)) * 
    cos(radians(seller_longitude) - radians(user_longitude)) + 
    sin(radians(user_latitude)) * 
    sin(radians(seller_latitude))
)
```

**Complete Query Example:**
```sql
-- Find sellers within 100km of user location
WITH user_location AS (
    SELECT 19.0760 as lat, 72.8777 as lng, 100 as radius_km
)
SELECT 
    p.id,
    p.business_details->>'shopName' as business_name,
    p.role as business_type,
    (p.business_details->>'latitude')::DECIMAL as latitude,
    (p.business_details->>'longitude')::DECIMAL as longitude,
    ROUND(
        (6371 * acos(
            cos(radians(ul.lat)) * 
            cos(radians((p.business_details->>'latitude')::DECIMAL)) * 
            cos(radians((p.business_details->>'longitude')::DECIMAL) - radians(ul.lng)) + 
            sin(radians(ul.lat)) * 
            sin(radians((p.business_details->>'latitude')::DECIMAL))
        ))::NUMERIC, 2
    ) as distance_km
FROM profiles p, user_location ul
WHERE 
    p.role IN ('wholesaler', 'manufacturer')
    AND p.status = 'active'
    AND p.business_details->>'latitude' IS NOT NULL
    AND p.business_details->>'longitude' IS NOT NULL
    AND (
        6371 * acos(
            cos(radians(ul.lat)) * 
            cos(radians((p.business_details->>'latitude')::DECIMAL)) * 
            cos(radians((p.business_details->>'longitude')::DECIMAL) - radians(ul.lng)) + 
            sin(radians(ul.lat)) * 
            sin(radians((p.business_details->>'latitude')::DECIMAL))
        )
    ) <= ul.radius_km
ORDER BY distance_km ASC;
```

## API Endpoint Queries

### GET /api/sellers

**Purpose:** Fetch sellers near user location with filtering

**Query Parameters:**
- `latitude`: User's latitude (required)
- `longitude`: User's longitude (required)
- `radius`: Search radius in km (default: 100)
- `businessType`: Filter by 'wholesaler' or 'manufacturer' (optional)
- `category`: Filter by product category (optional)

**SQL Query:**
```sql
SELECT 
    p.id,
    p.business_details->>'shopName' as business_name,
    p.role as business_type,
    p.business_details->>'address' as location_address,
    p.business_details->>'city' as city,
    p.business_details->>'state' as state,
    (p.business_details->>'latitude')::DECIMAL as latitude,
    (p.business_details->>'longitude')::DECIMAL as longitude,
    p.business_details->'categories' as categories,
    sd.image_url,
    ROUND(
        (6371 * acos(
            cos(radians($1)) * 
            cos(radians((p.business_details->>'latitude')::DECIMAL)) * 
            cos(radians((p.business_details->>'longitude')::DECIMAL) - radians($2)) + 
            sin(radians($1)) * 
            sin(radians((p.business_details->>'latitude')::DECIMAL))
        ))::NUMERIC, 2
    ) as distance_km
FROM profiles p
LEFT JOIN seller_details sd ON sd.user_id = p.id
WHERE 
    p.role IN ('wholesaler', 'manufacturer')
    AND p.status = 'active'
    AND p.business_details->>'latitude' IS NOT NULL
    AND p.business_details->>'longitude' IS NOT NULL
    AND (
        6371 * acos(
            cos(radians($1)) * 
            cos(radians((p.business_details->>'latitude')::DECIMAL)) * 
            cos(radians((p.business_details->>'longitude')::DECIMAL) - radians($2)) + 
            sin(radians($1)) * 
            sin(radians((p.business_details->>'latitude')::DECIMAL))
        )
    ) <= $3
ORDER BY distance_km ASC;
```

### POST /api/enquiry

**Purpose:** Submit an enquiry from a visitor

**Request Body:**
```typescript
{
  sellerId?: string;        // Optional - only for seller enquiries
  visitorName: string;
  visitorEmail: string;
  visitorPhone: string;
  visitorLocation: string;
  message: string;
  enquiryType: 'seller' | 'general' | 'contact';
}
```

**SQL Query:**
```sql
INSERT INTO enquiry_messages (
    seller_id,
    visitor_name,
    visitor_email,
    visitor_phone,
    visitor_location,
    message,
    enquiry_type
) VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING id;
```

## Setup Checklist

- [ ] Verify access to root app's Supabase database
- [ ] Run `verify_existing_tables.sql` to confirm existing structure
- [ ] Run `create_enquiry_messages_table.sql` to create new table
- [ ] Run `test_enquiry_messages.sql` to verify table creation
- [ ] Test distance calculation query with real coordinates
- [ ] Verify RLS policies allow public inserts
- [ ] Test API endpoints with Postman or similar tool

## Important Notes

1. **No Data Migration Needed**: The website uses existing data from the root app
2. **Single New Table**: Only `enquiry_messages` needs to be created
3. **Real-Time Updates**: Changes in the mobile app reflect immediately on the website
4. **Same Database**: Use the same Supabase project URL and keys as the root app
5. **RLS Policies**: Ensure public can insert enquiries but only authenticated users can read them
6. **Distance Calculation**: Always filter by radius to avoid performance issues
7. **No Prices**: Product prices should NOT be displayed on the website

## Troubleshooting

### Issue: Cannot find sellers table
**Solution**: Sellers are stored in the `profiles` table with `role IN ('wholesaler', 'manufacturer')`

### Issue: Missing location data
**Solution**: Check that `business_details->>'latitude'` and `business_details->>'longitude'` are not null

### Issue: Distance calculation returns no results
**Solution**: Verify coordinates are in decimal degrees format (not DMS) and radius is reasonable (e.g., 100km)

### Issue: Cannot insert enquiries
**Solution**: Check RLS policies allow public insert access on `enquiry_messages` table
