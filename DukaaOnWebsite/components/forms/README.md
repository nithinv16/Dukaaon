# Forms Components

This directory contains form components for the DukaaOn website.

## Components

### EnquiryForm

A comprehensive form component for submitting enquiries about sellers or general contact.

**Features:**
- Real-time validation with field-level error messages
- Character count for message field (max 1000 characters)
- Loading states during submission
- Success/error message display
- Automatic form clearing after successful submission
- Support for seller enquiries, general enquiries, and contact forms
- Indian phone number validation
- Email format validation
- Responsive design

**Usage:**

```tsx
import { EnquiryForm } from '@/components/forms';

// For seller enquiry
<EnquiryForm
  sellerId="seller-123"
  sellerName="ABC Wholesalers"
  enquiryType="seller"
  onSuccess={() => console.log('Enquiry submitted')}
  onCancel={() => console.log('Cancelled')}
  showCancelButton={true}
/>

// For general contact
<EnquiryForm
  enquiryType="contact"
  onSuccess={() => console.log('Contact form submitted')}
/>
```

**Props:**
- `sellerId` (optional): ID of the seller being enquired about
- `sellerName` (optional): Name of the seller for display
- `enquiryType` (optional): Type of enquiry - 'seller', 'general', or 'contact' (default: 'seller')
- `onSuccess` (optional): Callback function called after successful submission
- `onCancel` (optional): Callback function called when cancel button is clicked
- `showCancelButton` (optional): Whether to show the cancel button (default: false)

**Validation:**
- Name: Minimum 2 characters
- Email: Valid email format
- Phone: Valid Indian phone number format (10 digits, +91 prefix supported)
- Location: Minimum 2 characters
- Message: Minimum 10 characters, maximum 1000 characters

**States:**
- `idle`: Initial state
- `submitting`: Form is being submitted
- `success`: Form submitted successfully
- `error`: Submission failed
