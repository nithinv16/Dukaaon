# Supabase Database Webhook Setup Guide

## Overview
This guide will help you configure a Supabase database webhook to trigger your Azure Logic App when new orders are created or updated.

## Current Configuration Analysis

Based on your screenshot, you have:
- **Webhook Name**: `ai_agent`
- **Table**: `orders` 
- **Events**: Insert, Update, Delete
- **Type**: HTTP Request
- **URL**: Your Azure Logic App endpoint

## Issue Identification

The authentication error you're seeing suggests the webhook configuration needs adjustment. Here's how to fix it:

## Step 1: Verify Your Azure Logic App URL

Your current URL:
```
https://prod-04.eastus2.logic.azure.com/workflows/1673d89d087346db855b2a9eb4ce7053/triggers/When_a_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_a_HTTP_request_is_received%2Frun&sv=1.0&sig=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjcHpubmtwamd5cnBidnBudml0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg2MTc3MjgsImV4cCI6MjA1NDE5MzcyOH0.1Gg97eXqRmNcZpmKYaBNDozfc_mXrgFv_uHj-br-u_k
```

**Problem**: The `sig` parameter appears to be a Supabase JWT token instead of an Azure Logic App signature.

## Step 2: Get the Correct Azure Logic App URL

1. **Go to Azure Portal** → Logic Apps → Your Logic App
2. **Click on "When a HTTP request is received" trigger**
3. **Copy the HTTP POST URL** (it should look different)
4. **The correct URL format should be**:
   ```
   https://prod-04.eastus2.logic.azure.com/workflows/{workflow-id}/triggers/When_a_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_a_HTTP_request_is_received%2Frun&sv=1.0&sig={actual-azure-signature}
   ```

## Step 3: Configure Supabase Webhook Properly

### In Supabase Dashboard:

1. **Go to Database → Webhooks**
2. **Create new webhook or edit existing `ai_agent` webhook**
3. **Configuration**:
   - **Name**: `ai_agent`
   - **Table**: `orders`
   - **Events**: ✅ Insert, ✅ Update (uncheck Delete if not needed)
   - **Type**: HTTP Request
   - **Method**: POST
   - **URL**: [Your correct Azure Logic App URL from Step 2]

4. **HTTP Headers** (click "Add a new parameter"):
   ```
   Content-Type: application/json
   ```

5. **HTTP Parameters**: Leave empty unless your Logic App requires specific parameters

## Step 4: Configure Your Azure Logic App

### Update Request Body JSON Schema:

In your Logic App's HTTP trigger, set the JSON schema to match Supabase webhook format:

```json
{
    "type": "object",
    "properties": {
        "type": {
            "type": "string"
        },
        "table": {
            "type": "string"
        },
        "record": {
            "type": "object",
            "properties": {
                "id": {"type": "string"},
                "user_id": {"type": "string"},
                "retailer_id": {"type": "string"},
                "seller_id": {"type": "string"},
                "status": {"type": "string"},
                "total_amount": {"type": "number"},
                "is_ai_order": {"type": "boolean"},
                "created_at": {"type": "string"},
                "updated_at": {"type": "string"}
            }
        },
        "old_record": {
            "type": "object"
        },
        "schema": {
            "type": "string"
        }
    }
}
```

### Add Logic App Steps:

1. **Condition**: Check if `is_ai_order` is true
   ```
   @equals(triggerBody()?['record']?['is_ai_order'], true)
   ```

2. **If True**: Process AI order
   - Call Azure AI Foundry
   - Update order status
   - Send notifications

3. **If False**: Handle manual order (optional)

## Step 5: Test the Webhook

### Test 1: Direct Logic App Test
```bash
curl -X POST "[YOUR_CORRECT_LOGIC_APP_URL]" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "INSERT",
    "table": "orders",
    "record": {
      "id": "test-123",
      "user_id": "user-456",
      "status": "pending",
      "total_amount": 100.50,
      "is_ai_order": true,
      "created_at": "2025-01-17T10:00:00Z"
    },
    "schema": "public"
  }'
```

### Test 2: Supabase Webhook Test
Insert a test order in Supabase:
```sql
INSERT INTO orders (user_id, retailer_id, status, total_amount, is_ai_order)
VALUES ('test-user', 'test-retailer', 'pending', 150.00, true);
```

## Step 6: Monitor and Debug

### Check Webhook Logs:
1. **Supabase**: Database → Webhooks → View logs
2. **Azure**: Logic App → Overview → Runs history

### Common Issues and Solutions:

| Error | Cause | Solution |
|-------|-------|----------|
| 502 Bad Gateway | Wrong URL or Logic App not running | Verify Logic App URL and status |
| 401 Unauthorized | Authentication issue | Check if Logic App requires auth |
| 400 Bad Request | Invalid JSON schema | Update Logic App schema |
| Timeout | Logic App takes too long | Optimize Logic App performance |

## Step 7: Production Considerations

1. **Security**: Consider adding authentication headers
2. **Error Handling**: Add retry logic in Logic App
3. **Monitoring**: Set up alerts for failed webhooks
4. **Rate Limiting**: Monitor webhook frequency

## Verification Checklist

- [ ] Correct Azure Logic App URL copied
- [ ] Webhook configured with proper URL
- [ ] JSON schema updated in Logic App
- [ ] Test order insertion triggers webhook
- [ ] Logic App processes AI orders correctly
- [ ] Error handling implemented
- [ ] Monitoring set up

## Next Steps

Once the webhook is working:
1. Integrate with your AI agent for order processing
2. Add more sophisticated order validation
3. Implement order status updates back to Supabase
4. Set up monitoring and alerting

## Support

If you continue to have issues:
1. Check the exact error message in Supabase webhook logs
2. Verify the Logic App is receiving requests
3. Test with a simple HTTP endpoint first
4. Ensure all required parameters are included