# DukaaOn Website API Routes

This directory contains the API routes for the DukaaOn website. All routes are implemented using Next.js 14 App Router API routes.

## Available Endpoints

### 1. GET /api/sellers

Query sellers based on location and filters.

**Query Parameters:**
- `latitude` (required): User's latitude coordinate
- `longitude` (required): User's longitude coordinate
- `radius` (optional): Search radius in kilometers (default: 100, max: 500)
- `businessType` (optional): Filter by 'wholesaler' or 'manufacturer'
- `category` (optional): Filter by product category
- `page` (optional): Page number for pagination (default: 1)
- `limit` (optional): Results per page (default: 20, max: 100)

**Response:**
```json
{
  "success": true,
  "data": {
    "sellers": [
      {
        "id": "uuid",
        "businessName": "ABC Wholesalers",
        "businessType": "wholesaler",
        "location": {
          "city": "Mumbai",
          "state": "Maharashtra",
          "coordinates": {
            "latitude": 19.0760,
            "longitude": 72.8777
          }
        },
        "categories": ["groceries", "beverages"],
        "thumbnailImage": "https://...",
        "description": "Leading wholesaler...",
        "distance": 5.2
      }
    ],
    "count": 10,
    "totalCount": 45,
    "page": 1,
    "limit": 20,
    "totalPages": 3
  }
}
```

**Features:**
- Haversine formula for accurate distance calculation
- Automatic sorting by distance (nearest first)
- Pagination support
- Filtering by business type and category
- Returns sellers within specified radius only

**Example Usage:**
```javascript
const response = await fetch(
  `/api/sellers?latitude=19.0760&longitude=72.8777&radius=50&businessType=wholesaler&page=1&limit=20`
);
const data = await response.json();
```

---

### 2. POST /api/enquiry

Submit an enquiry about a seller or general inquiry.

**Request Body:**
```json
{
  "visitorName": "John Doe",
  "email": "john@example.com",
  "phone": "+91-9876543210",
  "location": "Mumbai, Maharashtra",
  "message": "I am interested in your products...",
  "sellerId": "uuid-optional",
  "enquiryType": "seller",
  "stakeholderType": "retailer"
}
```

**Fields:**
- `visitorName` (required): Name of the visitor (min 2 characters)
- `email` (required): Valid email address
- `phone` (required): Valid phone number (Indian or international format)
- `location` (required): Visitor's location (min 2 characters)
- `message` (required): Enquiry message (10-1000 characters)
- `sellerId` (optional): UUID of seller (for seller-specific enquiries)
- `enquiryType` (required): 'seller', 'general', or 'contact'
- `stakeholderType` (optional): Required for 'contact' type - 'investor', 'retailer', 'wholesaler', 'manufacturer', 'fmcg', or 'other'

**Response:**
```json
{
  "success": true,
  "data": {
    "enquiryId": "uuid"
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Validation failed",
  "errors": [
    {
      "field": "email",
      "message": "Please enter a valid email address"
    }
  ]
}
```

**Features:**
- Input validation and sanitization
- Rate limiting (5 requests per minute per IP)
- XSS protection
- Stores enquiries in database
- Returns enquiry ID for tracking

**Rate Limiting:**
- 5 requests per minute per IP address
- Returns 429 status code when limit exceeded

**Example Usage:**
```javascript
const response = await fetch('/api/enquiry', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    visitorName: 'John Doe',
    email: 'john@example.com',
    phone: '+91-9876543210',
    location: 'Mumbai',
    message: 'I am interested in your products',
    sellerId: 'seller-uuid',
    enquiryType: 'seller',
  }),
});
const data = await response.json();
```

---

### 3. GET /api/geolocation

Get user's approximate location based on IP address (fallback when browser geolocation is denied).

**Query Parameters:** None

**Response:**
```json
{
  "success": true,
  "data": {
    "latitude": 19.0760,
    "longitude": 72.8777,
    "city": "Mumbai",
    "state": "Maharashtra",
    "country": "India"
  }
}
```

**Features:**
- Primary service: ip-api.com (45 requests/minute)
- Fallback service: ipapi.co (1000 requests/day)
- Default India location for local/unknown IPs
- Graceful error handling (always returns a location)
- Detects local/private IPs and returns default location

**Default Location:**
When IP-based geolocation fails or local IP is detected, returns approximate center of India:
```json
{
  "latitude": 20.5937,
  "longitude": 78.9629,
  "city": "India",
  "state": "Central India",
  "country": "India"
}
```

**Example Usage:**
```javascript
const response = await fetch('/api/geolocation');
const data = await response.json();
const { latitude, longitude } = data.data;
```

---

## Error Handling

All endpoints follow a consistent error response format:

```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `201` - Created (for POST requests)
- `400` - Bad Request (validation errors)
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error

## Security Features

1. **Input Validation**: All user inputs are validated before processing
2. **Input Sanitization**: XSS protection through input sanitization
3. **Rate Limiting**: Prevents spam and abuse
4. **SQL Injection Prevention**: Using Supabase parameterized queries
5. **CORS**: Configured for same-origin requests only

## Database Tables

### seller_details (existing)
Used by `/api/sellers` endpoint to query seller information.

### enquiry_messages (new)
Created specifically for the website to store all enquiries.

**Schema:**
```sql
CREATE TABLE enquiry_messages (
  id UUID PRIMARY KEY,
  seller_id UUID REFERENCES sellers(id),
  visitor_name VARCHAR(255) NOT NULL,
  visitor_email VARCHAR(255) NOT NULL,
  visitor_phone VARCHAR(20) NOT NULL,
  visitor_location VARCHAR(255),
  message TEXT NOT NULL,
  enquiry_type VARCHAR(50) DEFAULT 'seller',
  stakeholder_type VARCHAR(50),
  status VARCHAR(50) DEFAULT 'new',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Development

### Testing API Routes Locally

1. Start the development server:
```bash
npm run dev
```

2. Test endpoints using curl or Postman:

**Test Sellers Endpoint:**
```bash
curl "http://localhost:3000/api/sellers?latitude=19.0760&longitude=72.8777&radius=100"
```

**Test Enquiry Endpoint:**
```bash
curl -X POST http://localhost:3000/api/enquiry \
  -H "Content-Type: application/json" \
  -d '{
    "visitorName": "Test User",
    "email": "test@example.com",
    "phone": "+91-9876543210",
    "location": "Mumbai",
    "message": "This is a test enquiry",
    "enquiryType": "general"
  }'
```

**Test Geolocation Endpoint:**
```bash
curl http://localhost:3000/api/geolocation
```

### Environment Variables

Ensure these are set in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Production Considerations

1. **Rate Limiting**: Consider using Redis for distributed rate limiting in production
2. **Caching**: Implement caching for seller queries to reduce database load
3. **Monitoring**: Add logging and monitoring for API performance
4. **Email Notifications**: Implement email notifications for new enquiries (currently TODO)
5. **Geolocation API Keys**: Consider using paid geolocation services for higher rate limits

## Future Enhancements

- [ ] Email notifications for new enquiries
- [ ] Admin dashboard to manage enquiries
- [ ] Advanced filtering (price range, ratings, etc.)
- [ ] Search by business name
- [ ] Seller recommendations based on user behavior
- [ ] Analytics tracking for API usage
