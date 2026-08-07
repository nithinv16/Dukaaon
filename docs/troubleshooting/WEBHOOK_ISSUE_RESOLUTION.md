# Webhook Issue Resolution Guide

## 🔍 Issue Identified

**Status**: ❌ **401 Unauthorized - Authentication Failed**

**Root Cause**: The signature (`sig`) parameter in your Azure Logic App URL contains a Supabase JWT token instead of the actual Azure Logic App signature.

**Current URL Problem**:
```
sig=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjcHpubmtwamd5cnBidnBudml0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg2MTc3MjgsImV4cCI6MjA1NDE5MzcyOH0.1Gg97eXqRmNcZpmKYaBNDozfc_mXrgFv_uHj-br-u_k
```

This is clearly a Supabase JWT token (you can see `"iss":"supabase"` when decoded), not an Azure signature.

## 🛠️ Solution Steps

### Step 1: Get the Correct Azure Logic App URL

1. **Open Azure Portal** (https://portal.azure.com)
2. **Navigate to**: Resource Groups → Your Resource Group → Logic Apps
3. **Select your Logic App**: `1673d89d087346db855b2a9eb4ce7053`
4. **Go to**: Logic app designer
5. **Click on the first step**: "When a HTTP request is received"
6. **Copy the HTTP POST URL** - This should be different from what you have

**The correct URL should look like**:
```
https://prod-04.eastus2.logic.azure.com/workflows/1673d89d087346db855b2a9eb4ce7053/triggers/When_a_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_a_HTTP_request_is_received%2Frun&sv=1.0&sig=ACTUAL_AZURE_SIGNATURE_HERE
```

### Step 2: Update Supabase Webhook Configuration

1. **Go to Supabase Dashboard** → Database → Webhooks
2. **Edit the `ai_agent` webhook**
3. **Replace the URL** with the correct one from Step 1
4. **Ensure these settings**:
   - **Name**: `ai_agent`
   - **Table**: `orders`
   - **Events**: ✅ Insert, ✅ Update
   - **Type**: HTTP Request
   - **Method**: POST
   - **URL**: [Correct Azure Logic App URL]
   - **HTTP Headers**:
     ```
     Content-Type: application/json
     ```

### Step 3: Configure Logic App Request Schema

In your Azure Logic App, update the "When a HTTP request is received" trigger with this JSON schema:

```json
{
    "type": "object",
    "properties": {
        "type": {
            "type": "string",
            "description": "INSERT, UPDATE, or DELETE"
        },
        "table": {
            "type": "string",
            "description": "Table name (orders)"
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
            "type": "object",
            "description": "Previous record state (for UPDATE events)"
        },
        "schema": {
            "type": "string",
            "description": "Database schema (usually 'public')"
        }
    }
}
```

### Step 4: Add Logic App Processing Logic

After the HTTP trigger, add these steps:

1. **Condition**: Check if it's an AI order
   ```
   @equals(triggerBody()?['record']?['is_ai_order'], true)
   ```

2. **If True Branch**: Process AI order
   - Parse order details
   - Call Azure AI Foundry (if needed)
   - Update order status
   - Send notifications

3. **Response**: Return success status
   ```json
   {
     "status": "success",
     "message": "Order processed",
     "order_id": "@{triggerBody()?['record']?['id']}"
   }
   ```

### Step 5: Test the Fixed Configuration

#### Test 1: Direct Logic App Test
```bash
# Replace YOUR_CORRECT_URL with the actual URL from Azure Portal
node scripts/test-webhook.js "YOUR_CORRECT_URL"
```

#### Test 2: Supabase Database Test
```sql
-- Run this in Supabase SQL Editor
INSERT INTO orders (
    user_id, retailer_id, seller_id, status, total_amount, is_ai_order
) VALUES (
    'webhook-test-user', 'test-retailer', 'test-seller', 'pending', 99.99, true
);
```

## 🔧 Troubleshooting

### If you still get 401 errors:
1. **Verify the URL** is copied exactly from Azure Portal
2. **Check Logic App status** - ensure it's enabled and running
3. **Try regenerating** the Logic App trigger URL

### If you get 400 errors:
1. **Check JSON schema** in Logic App matches Supabase format
2. **Verify webhook payload** structure

### If you get 502 errors:
1. **Check Logic App logic** for infinite loops or errors
2. **Ensure response** is returned within timeout

## 📊 Monitoring

### Supabase Webhook Logs
- **Location**: Database → Webhooks → View logs
- **Check for**: HTTP status codes, response times, error messages

### Azure Logic App Logs
- **Location**: Logic App → Overview → Runs history
- **Check for**: Trigger events, step execution, errors

## ✅ Success Indicators

You'll know it's working when:
1. ✅ Test script returns 200 status code
2. ✅ Supabase webhook logs show successful deliveries
3. ✅ Azure Logic App runs history shows successful executions
4. ✅ New orders in Supabase trigger the webhook

## 🚀 Next Steps

Once the webhook is working:
1. **Integrate AI processing** in the Logic App
2. **Add error handling** and retry logic
3. **Set up monitoring** and alerts
4. **Test with real order scenarios**
5. **Document the final workflow**

## 📞 Support

If you need help:
1. **Share the exact error message** from webhook logs
2. **Provide the Logic App run history** details
3. **Test with the provided scripts** and share results