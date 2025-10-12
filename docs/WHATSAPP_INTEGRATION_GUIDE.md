# WhatsApp Business API Integration Guide

This guide provides comprehensive instructions for integrating WhatsApp Business API into the DukaaOn React Native application.

## Overview

The WhatsApp integration enables automated messaging for:
- Order notifications and updates
- Stock alerts for retailers
- Payment reminders
- Delivery updates
- Welcome messages for new users
- Out-of-stock notifications

## Architecture

### Components

1. **WhatsAppBusinessAPI.ts** - Core API service for sending messages
2. **WhatsAppService.ts** - High-level service with business logic
3. **NotificationService.ts** - Updated to include WhatsApp messaging
4. **webhookHandler.ts** - Handles incoming webhooks from WhatsApp
5. **Database Schema** - Tables for message logging and user preferences

### Integration Flow

```
App Event → NotificationService → WhatsAppService → WhatsAppBusinessAPI → Meta API
                ↓
         FCM Notification (fallback)
                ↓
         Database Logging
```

## Setup Instructions

### 1. WhatsApp Business API Setup

#### Option A: Meta Business API (Recommended)

1. **Create Meta Business Account**
   - Go to [Meta Business](https://business.facebook.com/)
   - Create or use existing business account
   - Verify your business

2. **Set up WhatsApp Business API**
   - Go to [Meta for Developers](https://developers.facebook.com/)
   - Create a new app or use existing
   - Add WhatsApp product to your app
   - Complete business verification

3. **Get API Credentials**
   - Phone Number ID
   - Access Token (permanent)
   - App Secret
   - Webhook Verify Token

#### Option B: Third-Party Providers

**Twilio**
```bash
npm install twilio
```

**360Dialog**
- Sign up at [360Dialog](https://www.360dialog.com/)
- Get API key and endpoint

**MessageBird**
```bash
npm install messagebird
```

### 2. Environment Configuration

Add to your `.env` file:

```env
# WhatsApp Business API Configuration
WHATSAPP_API_URL=https://graph.facebook.com/v18.0
WHATSAPP_ACCESS_TOKEN=your_permanent_access_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_APP_SECRET=your_app_secret
WHATSAPP_WEBHOOK_VERIFY_TOKEN=your_webhook_verify_token
WHATSAPP_WEBHOOK_URL=https://your-domain.com/api/whatsapp/webhook

# Optional: Third-party provider settings
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_WHATSAPP_NUMBER=whatsapp:+1234567890
```

### 3. Database Setup

Run the SQL migration:

```bash
# Execute the SQL file in your Supabase dashboard or CLI
psql -h your-db-host -U postgres -d your-db < sql/whatsapp_integration.sql
```

### 4. Install Dependencies

```bash
npm install axios
# For webhook handling (if using Express backend)
npm install express body-parser crypto
```

### 5. Initialize Services

Update your app initialization:

```typescript
// In your App.tsx or main initialization file
import { NotificationService } from './services/notifications/NotificationService';

// Initialize notification service (includes WhatsApp)
await NotificationService.initialize();
```

## Usage Examples

### 1. Send Order Notification

```typescript
import { NotificationService } from './services/notifications/NotificationService';

// Send order update with WhatsApp
await NotificationService.sendOrderNotification(
  {
    orderId: 'ORD-12345',
    status: 'confirmed',
    customerName: 'John Doe',
    items: ['Product A', 'Product B'],
    totalAmount: 1500
  },
  '+919876543210' // Customer's phone number
);
```

### 2. Send Stock Alert

```typescript
// Send stock alert to retailers
await NotificationService.sendStockAlertNotification(
  '+919876543210',
  {
    productName: 'iPhone 15',
    wholesalerName: 'Tech Wholesale Co.',
    price: 75000,
    quantity: 50,
    category: 'Electronics'
  }
);
```

### 3. Send Payment Reminder

```typescript
// Send payment reminder
await NotificationService.sendPaymentReminderNotification(
  '+919876543210',
  {
    orderId: 'ORD-12345',
    amount: 1500,
    dueDate: '2024-01-15',
    customerName: 'John Doe'
  }
);
```

### 4. Handle User Opt-in/Opt-out

```typescript
// Update user's WhatsApp preferences
const success = await NotificationService.updateWhatsAppOptIn(
  '+919876543210',
  true // opt-in status
);

// Get user preferences
const preferences = await NotificationService.getWhatsAppPreferences(
  '+919876543210'
);
```

## Message Templates

WhatsApp Business API requires pre-approved templates for certain message types. The following templates are included:

### 1. Order Update Template
```
Hi! Your order {{1}} has been {{2}}. Total amount: ₹{{3}}. Thank you for choosing DukaaOn!
```

### 2. Stock Alert Template
```
Stock Alert! {{1}} is now available from {{2}} at ₹{{3}}. Order now on DukaaOn!
```

### 3. Delivery Update Template
```
Your order {{1}} is out for delivery! Expected delivery: {{2}}. Track: {{3}}
```

### 4. Payment Reminder Template
```
Payment reminder for order {{1}}. Amount: ₹{{2}}. Please complete payment to avoid cancellation.
```

## Webhook Setup

### 1. Backend Endpoint (Express.js example)

```typescript
import express from 'express';
import { WhatsAppWebhookHandler } from './services/whatsapp/webhookHandler';

const app = express();

// Webhook verification
app.get('/api/whatsapp/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  
  const result = WhatsAppWebhookHandler.handleVerificationChallenge(
    mode,
    token,
    challenge,
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN
  );
  
  if (result) {
    res.status(200).send(result);
  } else {
    res.status(403).send('Forbidden');
  }
});

// Webhook events
app.post('/api/whatsapp/webhook', (req, res) => {
  const signature = req.headers['x-hub-signature-256'];
  const payload = JSON.stringify(req.body);
  
  // Verify signature
  const isValid = WhatsAppWebhookHandler.verifyWebhookSignature(
    payload,
    signature,
    process.env.WHATSAPP_APP_SECRET
  );
  
  if (!isValid) {
    return res.status(403).send('Forbidden');
  }
  
  // Process webhook
  WhatsAppWebhookHandler.handleWebhook(req.body)
    .then(() => res.status(200).send('OK'))
    .catch(error => {
      console.error('Webhook error:', error);
      res.status(500).send('Error');
    });
});
```

### 2. Configure Webhook in Meta Dashboard

1. Go to your WhatsApp Business API app
2. Navigate to WhatsApp > Configuration
3. Add webhook URL: `https://your-domain.com/api/whatsapp/webhook`
4. Add verify token (same as in .env)
5. Subscribe to `messages` field

## Testing

### 1. Test Message Sending

```typescript
// Test basic message
import WhatsAppService from './services/whatsapp/WhatsAppService';

const success = await WhatsAppService.sendTextMessage(
  '+919876543210',
  'Hello from DukaaOn! This is a test message.'
);

console.log('Message sent:', success);
```

### 2. Test Webhook

```bash
# Use ngrok for local testing
ngrok http 3000

# Update webhook URL in Meta dashboard to ngrok URL
# Send a message to your WhatsApp Business number
```

### 3. Monitor Service Health

```typescript
// Check service status
const health = await NotificationService.getServiceHealthStatus();
console.log('Service Health:', health);

// Get WhatsApp statistics
const stats = await WhatsAppService.getMessageStats(7); // Last 7 days
console.log('WhatsApp Stats:', stats);
```

## Error Handling

### Common Issues

1. **Template Not Approved**
   - Submit templates for approval in Meta Business Manager
   - Use fallback text messages for non-template content

2. **Rate Limiting**
   - Implement exponential backoff
   - Monitor API quotas

3. **Invalid Phone Numbers**
   - Validate phone numbers before sending
   - Handle international formats correctly

4. **Webhook Failures**
   - Implement retry mechanism
   - Monitor webhook event processing

### Monitoring

```typescript
// Monitor failed messages
const { data } = await supabase
  .from('whatsapp_messages')
  .select('*')
  .eq('status', 'failed')
  .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

console.log('Failed messages in last 24h:', data.length);
```

## Security Best Practices

1. **Secure Webhook Endpoints**
   - Always verify webhook signatures
   - Use HTTPS for webhook URLs
   - Implement rate limiting

2. **Protect API Credentials**
   - Store tokens securely
   - Rotate access tokens regularly
   - Use environment variables

3. **User Privacy**
   - Implement opt-in/opt-out mechanisms
   - Respect user preferences
   - Log minimal user data

4. **Message Content**
   - Avoid sending sensitive information
   - Use secure links for detailed information
   - Implement message encryption if needed

## Compliance

### WhatsApp Business Policy

1. **Message Categories**
   - Use appropriate template categories (UTILITY, MARKETING, AUTHENTICATION)
   - Follow 24-hour messaging window rules
   - Respect user opt-out requests

2. **Content Guidelines**
   - No spam or promotional content without consent
   - Provide clear opt-out instructions
   - Include business identification

### Data Protection

1. **GDPR Compliance**
   - Obtain explicit consent for messaging
   - Provide data deletion options
   - Maintain audit logs

2. **Local Regulations**
   - Follow local telecommunications laws
   - Implement required consent mechanisms
   - Respect do-not-call registries

## Troubleshooting

### Debug Mode

```typescript
// Enable debug logging
process.env.WHATSAPP_DEBUG = 'true';

// Check service initialization
const isAvailable = WhatsAppService.isAvailable();
console.log('WhatsApp Service Available:', isAvailable);
```

### Common Error Codes

- `100`: Invalid parameter
- `131000`: Generic user error
- `131005`: Message undeliverable
- `131008`: Message expired
- `131009`: Message not allowed

### Support Resources

- [Meta WhatsApp Business API Documentation](https://developers.facebook.com/docs/whatsapp)
- [WhatsApp Business Policy](https://www.whatsapp.com/legal/business-policy)
- [Template Guidelines](https://developers.facebook.com/docs/whatsapp/message-templates/guidelines)

## Migration from Basic WhatsApp Integration

If you're upgrading from the basic `wa.me` integration:

1. **Backup existing functionality**
2. **Update phone-order component** to use new service
3. **Migrate user preferences** to new schema
4. **Test thoroughly** before production deployment

```typescript
// Update existing wa.me usage
// OLD:
const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
Linking.openURL(whatsappUrl);

// NEW:
await WhatsAppService.sendTextMessage(phoneNumber, message);
```

This completes the WhatsApp Business API integration for DukaaOn. The system now supports automated messaging while maintaining fallback to FCM notifications and providing comprehensive monitoring and analytics capabilities.