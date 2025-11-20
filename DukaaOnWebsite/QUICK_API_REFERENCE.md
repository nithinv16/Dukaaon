# Quick API Reference

## 🚀 Quick Start

### 1. Get Nearby Sellers

```typescript
// Get sellers within 50km of Mumbai
const response = await fetch(
  '/api/sellers?latitude=19.0760&longitude=72.8777&radius=50'
);
const { data } = await response.json();
console.log(`Found ${data.totalCount} sellers`);
```

### 2. Submit an Enquiry

```typescript
// Submit a seller enquiry
const response = await fetch('/api/enquiry', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    visitorName: 'John Doe',
    email: 'john@example.com',
    phone: '+91-9876543210',
    location: 'Mumbai',
    message: 'Interested in your products',
    sellerId: 'seller-uuid',
    enquiryType: 'seller',
  }),
});
const { data } = await response.json();
console.log(`Enquiry ID: ${data.enquiryId}`);
```

### 3. Get User Location (Fallback)

```typescript
// Get location from IP when browser permission denied
const response = await fetch('/api/geolocation');
const { data } = await response.json();
console.log(`Location: ${data.city}, ${data.state}`);
```

---

## 📋 Common Use Cases

### Filter Sellers by Type

```typescript
// Get only wholesalers
const response = await fetch(
  '/api/sellers?latitude=19.0760&longitude=72.8777&businessType=wholesaler'
);
```

### Filter by Category

```typescript
// Get sellers in groceries category
const response = await fetch(
  '/api/sellers?latitude=19.0760&longitude=72.8777&category=groceries'
);
```

### Pagination

```typescript
// Get page 2 with 10 results per page
const response = await fetch(
  '/api/sellers?latitude=19.0760&longitude=72.8777&page=2&limit=10'
);
```

### Contact Form Submission

```typescript
// Submit contact form with stakeholder type
const response = await fetch('/api/enquiry', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    visitorName: 'Jane Smith',
    email: 'jane@example.com',
    phone: '+91-9876543210',
    location: 'Delhi',
    message: 'Interested in partnership',
    enquiryType: 'contact',
    stakeholderType: 'investor',
  }),
});
```

---

## 🔧 Using with React Hooks

### Example: Fetch Sellers Hook

```typescript
import { useState, useEffect } from 'react';

function useSellers(latitude: number, longitude: number, radius = 100) {
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchSellers() {
      try {
        const response = await fetch(
          `/api/sellers?latitude=${latitude}&longitude=${longitude}&radius=${radius}`
        );
        const data = await response.json();
        
        if (data.success) {
          setSellers(data.data.sellers);
        } else {
          setError(data.error);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchSellers();
  }, [latitude, longitude, radius]);

  return { sellers, loading, error };
}
```

### Example: Submit Enquiry Hook

```typescript
import { useState } from 'react';

function useEnquirySubmission() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const submitEnquiry = async (data) => {
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to submit enquiry');
      }

      return result.data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  return { submitEnquiry, submitting, error };
}
```

---

## ⚠️ Error Handling

### Handle Validation Errors

```typescript
const response = await fetch('/api/enquiry', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(invalidData),
});

const result = await response.json();

if (!result.success && result.errors) {
  // Field-specific errors
  result.errors.forEach(error => {
    console.log(`${error.field}: ${error.message}`);
  });
}
```

### Handle Rate Limiting

```typescript
const response = await fetch('/api/enquiry', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
});

if (response.status === 429) {
  console.log('Too many requests. Please try again later.');
}
```

---

## 🧪 Testing

### Test with curl

```bash
# Test sellers endpoint
curl "http://localhost:3000/api/sellers?latitude=19.0760&longitude=72.8777&radius=100"

# Test enquiry endpoint
curl -X POST http://localhost:3000/api/enquiry \
  -H "Content-Type: application/json" \
  -d '{
    "visitorName": "Test User",
    "email": "test@example.com",
    "phone": "+91-9876543210",
    "location": "Mumbai",
    "message": "Test enquiry message",
    "enquiryType": "general"
  }'

# Test geolocation endpoint
curl http://localhost:3000/api/geolocation
```

### Run Test Script

```bash
# Start dev server
npm run dev

# In another terminal, run tests
npx tsx scripts/test-api-routes.ts
```

---

## 📚 Full Documentation

For complete API documentation, see:
- `DukaaOnWebsite/app/api/README.md` - Comprehensive API documentation
- `DukaaOnWebsite/API_IMPLEMENTATION_SUMMARY.md` - Implementation details

---

## 🔐 Security Notes

1. **Rate Limiting**: Enquiry endpoint limited to 5 requests/minute per IP
2. **Input Validation**: All inputs validated before processing
3. **XSS Protection**: Inputs sanitized to prevent XSS attacks
4. **SQL Injection**: Using parameterized queries via Supabase

---

## 🌐 Environment Variables

Required in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

---

## 📞 Support

For issues or questions:
- Check the full API documentation in `app/api/README.md`
- Review implementation summary in `API_IMPLEMENTATION_SUMMARY.md`
- Run the test script to verify endpoints are working
