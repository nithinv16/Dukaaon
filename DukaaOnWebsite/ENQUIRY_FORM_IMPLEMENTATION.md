# Enquiry Form Implementation

## Overview

Task 9 has been successfully completed. The enquiry form system is now fully implemented with comprehensive validation, error handling, and submission logic.

## What Was Implemented

### 1. EnquiryForm Component (`components/forms/EnquiryForm.tsx`)

A fully-featured form component with:

**Features:**
- ✅ All required fields (name, email, phone, location, message)
- ✅ Real-time validation with field-level error messages
- ✅ Character count for message field (max 1000 characters)
- ✅ Loading states during submission
- ✅ Success/error message display
- ✅ Automatic form clearing after successful submission
- ✅ Support for seller enquiries, general enquiries, and contact forms
- ✅ Responsive design for mobile and desktop
- ✅ Accessibility features (ARIA labels, keyboard navigation)

**Validation:**
- Name: Minimum 2 characters
- Email: Valid email format (RFC 5322 compliant)
- Phone: Valid Indian phone number format (supports +91, 91, or 10-digit formats)
- Location: Minimum 2 characters
- Message: Minimum 10 characters, maximum 1000 characters

**States:**
- `idle`: Initial state
- `submitting`: Form is being submitted
- `success`: Form submitted successfully (shows success message)
- `error`: Submission failed (shows error message)

### 2. API Endpoint (`app/api/enquiry/route.ts`)

A secure API endpoint for handling enquiry submissions:

**Features:**
- ✅ POST endpoint for submitting enquiries
- ✅ Request validation using validation library
- ✅ Input sanitization to prevent XSS attacks
- ✅ Rate limiting (5 requests per minute per IP)
- ✅ Database insertion into `enquiry_messages` table
- ✅ Proper error handling and status codes
- ✅ Success response with enquiry ID

**Security:**
- Rate limiting to prevent spam
- Input sanitization
- SQL injection prevention (Supabase parameterized queries)
- Proper error messages without exposing sensitive information

### 3. Integration

The form has been integrated into:

**Seller Profile Page (`app/seller/[id]/page.tsx`):**
- Opens in a modal when "Enquire Details" button is clicked
- Pre-fills seller ID and name
- Shows success message and auto-closes after 2.5 seconds
- Includes cancel button

**Contact Page (`app/contact/page.tsx`):**
- Complete contact page with company information
- Email: support@dukaaon.in
- Phone: +91-8086142552
- Business hours display
- Integrated enquiry form for general contact

## Files Created/Modified

### Created:
1. `DukaaOnWebsite/components/forms/EnquiryForm.tsx` - Main form component
2. `DukaaOnWebsite/components/forms/index.ts` - Export file
3. `DukaaOnWebsite/components/forms/README.md` - Documentation
4. `DukaaOnWebsite/app/api/enquiry/route.ts` - API endpoint
5. `DukaaOnWebsite/ENQUIRY_FORM_IMPLEMENTATION.md` - This file

### Modified:
1. `DukaaOnWebsite/app/seller/[id]/page.tsx` - Integrated form in modal
2. `DukaaOnWebsite/app/contact/page.tsx` - Complete contact page with form
3. `DukaaOnWebsite/components/seller/ProductGallery.tsx` - Fixed linting error

## Usage Examples

### Seller Enquiry (in Modal)
```tsx
import { EnquiryForm } from '@/components/forms';

<EnquiryForm
  sellerId="seller-123"
  sellerName="ABC Wholesalers"
  enquiryType="seller"
  onSuccess={() => console.log('Enquiry submitted')}
  onCancel={() => setShowModal(false)}
  showCancelButton={true}
/>
```

### General Contact Form
```tsx
import { EnquiryForm } from '@/components/forms';

<EnquiryForm
  enquiryType="contact"
  onSuccess={() => console.log('Contact form submitted')}
/>
```

## Database Schema

The form submits data to the `enquiry_messages` table with the following structure:

```sql
CREATE TABLE enquiry_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seller_id UUID REFERENCES sellers(id) ON DELETE CASCADE,
  visitor_name VARCHAR(255) NOT NULL,
  visitor_email VARCHAR(255) NOT NULL,
  visitor_phone VARCHAR(20) NOT NULL,
  visitor_location VARCHAR(255),
  message TEXT NOT NULL,
  enquiry_type VARCHAR(50) DEFAULT 'seller',
  status VARCHAR(50) DEFAULT 'new',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## API Endpoint

### POST /api/enquiry

**Request Body:**
```json
{
  "visitorName": "John Doe",
  "email": "john@example.com",
  "phone": "+91 98765 43210",
  "location": "Mumbai, Maharashtra",
  "message": "I am interested in your products...",
  "sellerId": "uuid-here",
  "enquiryType": "seller"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "enquiryId": "uuid-here"
  }
}
```

**Error Response (400/500):**
```json
{
  "success": false,
  "error": "Error message here",
  "errors": [
    {
      "field": "email",
      "message": "Please enter a valid email address"
    }
  ]
}
```

## Testing

To test the implementation:

1. **Start the development server:**
   ```bash
   cd DukaaOnWebsite
   npm run dev
   ```

2. **Test Seller Enquiry:**
   - Navigate to any seller profile page
   - Click "Enquire Details" button
   - Fill out the form and submit
   - Verify success message appears
   - Check database for new entry

3. **Test Contact Form:**
   - Navigate to `/contact` page
   - Fill out the contact form
   - Submit and verify success message
   - Check database for new entry

4. **Test Validation:**
   - Try submitting with empty fields
   - Try invalid email format
   - Try invalid phone number
   - Try message less than 10 characters
   - Try message more than 1000 characters
   - Verify appropriate error messages appear

5. **Test Rate Limiting:**
   - Submit 6 enquiries rapidly
   - Verify 6th request is blocked with 429 status

## Requirements Satisfied

✅ **Requirement 5.1:** Enquiry form displays when "Enquire Details" is clicked
✅ **Requirement 5.2:** Form collects all required fields with validation
✅ **Requirement 5.3:** Inquiry data is stored in database
✅ **Requirement 5.4:** Confirmation message displayed on success
✅ **Requirement 5.5:** (Optional) Email notification can be added later
✅ **Requirement 10.1:** Contact form implemented with company information
✅ **Requirement 10.2:** Contact form validation matches enquiry form
✅ **Requirement 10.3:** Contact submissions stored in database
✅ **Requirement 10.4:** Success message displayed after contact submission

## Next Steps

1. **Email Notifications (Optional):**
   - Implement email notifications to admin when enquiry is submitted
   - Can use Supabase Edge Functions or SendGrid

2. **Admin Dashboard (Future):**
   - Create admin interface to view and manage enquiries
   - Add status updates (new, read, responded, closed)
   - Add response functionality

3. **Analytics:**
   - Track enquiry submission rates
   - Monitor conversion from seller view to enquiry
   - Analyze popular sellers by enquiry count

## Notes

- The form uses the existing validation library (`lib/validation.ts`)
- The form uses the existing Supabase client (`lib/supabase.ts`)
- The form integrates with the existing design system
- Rate limiting is implemented in-memory (use Redis in production)
- All inputs are sanitized to prevent XSS attacks
- The API endpoint follows REST best practices
