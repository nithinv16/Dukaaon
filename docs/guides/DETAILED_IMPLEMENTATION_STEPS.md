# Detailed Step-by-Step Implementation Guide
# Supabase Webhooks → Azure Logic Apps → Azure AI Agents

This guide provides exact steps, commands, and configurations to implement the complete integration.

## 🎯 Prerequisites Checklist

- [ ] Azure subscription with Logic Apps enabled
- [ ] Supabase project with database access
- [ ] Azure AI Foundry account with AI agent created
- [ ] Basic understanding of REST APIs
- [ ] Text editor or Azure Portal access

---

## 📋 PHASE 1: Azure Logic App Creation

### Step 1.1: Create Logic App Resource

1. **Open Azure Portal**: https://portal.azure.com
2. **Click**: "Create a resource"
3. **Search**: "Logic App"
4. **Select**: "Logic App" by Microsoft
5. **Click**: "Create"

### Step 1.2: Configure Basic Settings

```
Subscription: [Your Azure Subscription]
Resource Group: [Create new] → "rg-supabase-ai-integration"
Logic App Name: "la-supabase-webhook-processor"
Region: "East US 2" (or closest to your users)
Plan Type: "Consumption"
Zone Redundancy: "Disabled" (for cost optimization)
```

6. **Click**: "Review + Create"
7. **Click**: "Create"
8. **Wait**: 2-3 minutes for deployment
9. **Click**: "Go to resource"

### Step 1.3: Design the Logic App Workflow

1. **Click**: "Logic app designer" (left sidebar)
2. **Select**: "Blank Logic App" template
3. **Search**: "HTTP" in connectors
4. **Select**: "When a HTTP request is received"

### Step 1.4: Configure HTTP Trigger

1. **HTTP Method**: Select "POST"
2. **Request Body JSON Schema**: Copy and paste this exact schema:

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
      "description": "Table name from Supabase"
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
        "content": {"type": "string"},
        "created_at": {"type": "string"},
        "updated_at": {"type": "string"}
      }
    },
    "old_record": {
      "type": "object",
      "description": "Previous record state for UPDATE events"
    },
    "schema": {
      "type": "string",
      "description": "Database schema, usually 'public'"
    }
  },
  "required": ["type", "table", "record"]
}
```

3. **Click**: "Save" (top toolbar)
4. **Copy**: The generated "HTTP POST URL" (you'll need this for Supabase)

**Example URL format**:
```
https://prod-04.eastus2.logic.azure.com/workflows/abc123.../triggers/When_a_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2F...&sv=1.0&sig=AZURE_SIGNATURE
```

---

## 📋 PHASE 2: Add AI Processing Logic

### Step 2.1: Add Condition to Check AI Orders

1. **Click**: "+ New step"
2. **Search**: "Condition"
3. **Select**: "Condition" (Control)
4. **Configure condition**:
   - **Left side**: Click "Add dynamic content" → "record is_ai_order"
   - **Operator**: "is equal to"
   - **Right side**: `true`

### Step 2.2: Add Azure AI Foundry Connector (True Branch)

1. **In "True" branch**: Click "Add an action"
2. **Search**: "Azure AI Foundry"
3. **Select**: "Azure AI Foundry"
4. **Choose**: "Create thread"
5. **Sign in**: Use your Azure credentials
6. **Configure Create Thread**:

```json
{
  "messages": [
    {
      "role": "user",
      "content": "Process this order: @{triggerBody()?['record']?['content']} with total amount @{triggerBody()?['record']?['total_amount']}"
    }
  ],
  "metadata": {
    "source": "supabase_webhook",
    "table": "@{triggerBody()?['table']}",
    "event_type": "@{triggerBody()?['type']}",
    "record_id": "@{triggerBody()?['record']?['id']}"
  }
}
```

### Step 2.3: Add Create Run Action

1. **Click**: "Add an action" (after Create thread)
2. **Search**: "Azure AI Foundry"
3. **Select**: "Create run"
4. **Configure Create Run**:

```
Thread ID: [Dynamic content] → "id" (from Create thread)
Assistant ID: "your-ai-agent-id-here"  // Get this from Azure AI Foundry
Instructions: "Analyze this order and provide processing recommendations. Focus on order validation, pricing analysis, and next steps."
```

### Step 2.4: Add Get Run Status

1. **Click**: "Add an action"
2. **Select**: "Get run" (Azure AI Foundry)
3. **Configure**:

```
Thread ID: [Dynamic content] → "id" (from Create thread)
Run ID: [Dynamic content] → "id" (from Create run)
```

### Step 2.5: Add Wait Loop for Completion

1. **Click**: "Add an action"
2. **Search**: "Until"
3. **Select**: "Until" (Control)
4. **Configure Until condition**:
   - **Left**: Dynamic content → "status" (from Get run)
   - **Operator**: "is equal to"
   - **Right**: `completed`

5. **Inside Until loop**: Add "Get run" action again
6. **Add delay**: "Delay" action with 2 seconds

### Step 2.6: Get AI Response

1. **After Until loop**: Click "Add an action"
2. **Select**: "List messages" (Azure AI Foundry)
3. **Configure**:

```
Thread ID: [Dynamic content] → "id" (from Create thread)
Limit: 10
Order: desc
```

### Step 2.7: Parse AI Response

1. **Click**: "Add an action"
2. **Search**: "Compose"
3. **Select**: "Compose" (Data Operations)
4. **Inputs**: Add this expression:

```json
{
  "ai_response": "@{first(body('List_messages')?['data'])?['content']?[0]?['text']?['value']}",
  "original_record_id": "@{triggerBody()?['record']?['id']}",
  "processing_status": "ai_completed",
  "timestamp": "@{utcNow()}",
  "thread_id": "@{body('Create_thread')?['id']}"
}
```

---

## 📋 PHASE 3: Add Response Actions

### Step 3.1: Update Supabase Record (Optional)

1. **Click**: "Add an action"
2. **Search**: "HTTP"
3. **Select**: "HTTP" (Premium)
4. **Configure HTTP Action**:

```
Method: PATCH
URI: https://YOUR_PROJECT.supabase.co/rest/v1/orders?id=eq.@{triggerBody()?['record']?['id']}

Headers:
apikey: YOUR_SUPABASE_ANON_KEY
Authorization: Bearer YOUR_SUPABASE_ANON_KEY
Content-Type: application/json
Prefer: return=minimal

Body:
{
  "ai_response": "@{outputs('Compose')?['ai_response']}",
  "status": "ai_processed",
  "updated_at": "@{utcNow()}"
}
```

### Step 3.2: Add Response Action

1. **Click**: "Add an action"
2. **Search**: "Response"
3. **Select**: "Response" (Request)
4. **Configure Response**:

```
Status Code: 200

Headers:
Content-Type: application/json

Body:
{
  "status": "success",
  "message": "AI processing completed",
  "record_id": "@{triggerBody()?['record']?['id']}",
  "ai_response": "@{outputs('Compose')?['ai_response']}",
  "thread_id": "@{body('Create_thread')?['id']}"
}
```

### Step 3.3: Handle False Branch (Non-AI Orders)

1. **In "False" branch**: Click "Add an action"
2. **Select**: "Response"
3. **Configure**:

```
Status Code: 200
Body:
{
  "status": "skipped",
  "message": "Non-AI order, no processing needed",
  "record_id": "@{triggerBody()?['record']?['id']}"
}
```

### Step 3.4: Save Logic App

1. **Click**: "Save" (top toolbar)
2. **Wait**: For save confirmation
3. **Copy**: The HTTP POST URL again (if changed)

---

## 📋 PHASE 4: Supabase Webhook Configuration

### Step 4.1: Access Supabase Dashboard

1. **Open**: https://supabase.com/dashboard
2. **Select**: Your project
3. **Navigate**: Database → Webhooks (left sidebar)

### Step 4.2: Create New Webhook

1. **Click**: "Create a new hook"
2. **Configure webhook**:

```
Name: ai_order_processor
Table: orders (or your target table)
Events: ☑️ Insert, ☑️ Update
Type: HTTP Request
Method: POST
URL: [Paste your Logic App HTTP POST URL here]
```

### Step 4.3: Add HTTP Headers

```
Content-Type: application/json
User-Agent: Supabase-Webhook/1.0
```

### Step 4.4: Save Webhook

1. **Click**: "Create webhook"
2. **Verify**: Webhook appears in the list
3. **Status**: Should show "Active"

---

## 📋 PHASE 5: Testing & Validation

### Step 5.1: Test Logic App Directly

1. **Create test file**: `test-logic-app.json`

```json
{
  "type": "INSERT",
  "table": "orders",
  "record": {
    "id": "test-123",
    "user_id": "user-456",
    "retailer_id": "retailer-789",
    "status": "pending",
    "total_amount": 99.99,
    "is_ai_order": true,
    "content": "Test order for AI processing",
    "created_at": "2024-01-15T10:30:00Z"
  },
  "schema": "public"
}
```

2. **Test with curl**:

```bash
curl -X POST "YOUR_LOGIC_APP_URL" \
  -H "Content-Type: application/json" \
  -d @test-logic-app.json
```

3. **Expected Response**:

```json
{
  "status": "success",
  "message": "AI processing completed",
  "record_id": "test-123",
  "ai_response": "[AI generated response]",
  "thread_id": "thread_abc123"
}
```

### Step 5.2: Test End-to-End with Supabase

1. **Open Supabase SQL Editor**
2. **Run test INSERT**:

```sql
INSERT INTO orders (
  user_id, 
  retailer_id, 
  seller_id, 
  status, 
  total_amount, 
  is_ai_order,
  content
) VALUES (
  'test-user-001',
  'retailer-001', 
  'seller-001',
  'pending',
  149.99,
  true,
  'Customer wants bulk discount on electronics. Please analyze pricing and suggest best offer.'
);
```

3. **Check webhook logs**:
   - **Supabase**: Database → Webhooks → View logs
   - **Azure**: Logic App → Overview → Runs history

### Step 5.3: Verify AI Processing

1. **Azure AI Foundry**: Check conversation history
2. **Logic App Runs**: Verify successful execution
3. **Supabase Table**: Check if record was updated

---

## 📋 PHASE 6: Monitoring & Troubleshooting

### Step 6.1: Set Up Monitoring

1. **Azure Monitor**:
   - Logic App → Monitoring → Metrics
   - Create alerts for failed runs

2. **Supabase Monitoring**:
   - Database → Webhooks → Logs
   - Monitor delivery success rates

### Step 6.2: Common Issues & Solutions

#### Issue: 401 Unauthorized
**Solution**:
1. Verify Logic App URL is complete with signature
2. Check if Logic App is enabled
3. Regenerate trigger URL if needed

#### Issue: 400 Bad Request
**Solution**:
1. Validate JSON schema in Logic App
2. Check Supabase webhook payload format
3. Ensure all required fields are present

#### Issue: AI Agent Not Responding
**Solution**:
1. Verify Assistant ID in Logic App
2. Check Azure AI Foundry agent status
3. Review agent instructions and capabilities

#### Issue: Webhook Not Triggering
**Solution**:
1. Check Supabase webhook status (Active/Inactive)
2. Verify table events are enabled
3. Test with manual database operations

### Step 6.3: Performance Optimization

1. **Add error handling**: Use "Configure run after" settings
2. **Implement retry logic**: Add "Retry Policy" to actions
3. **Add timeouts**: Set appropriate timeout values
4. **Monitor costs**: Track Logic App consumption units

---

## 📋 PHASE 7: Production Deployment

### Step 7.1: Security Hardening

1. **Enable Logic App authentication**:
   - Add API key validation
   - Implement IP restrictions if needed

2. **Secure Supabase connection**:
   - Use service role key for updates
   - Implement row-level security

3. **Store secrets securely**:
   - Use Azure Key Vault for sensitive data
   - Avoid hardcoding credentials

### Step 7.2: Scale Configuration

1. **Logic App settings**:
   - Configure concurrency limits
   - Set up auto-scaling if needed

2. **Supabase optimization**:
   - Monitor webhook delivery rates
   - Implement rate limiting if necessary

### Step 7.3: Documentation

1. **Create runbook** for operations team
2. **Document troubleshooting** procedures
3. **Set up alerting** for critical failures

---

## ✅ Success Checklist

- [ ] Logic App created and configured
- [ ] HTTP trigger accepts POST requests
- [ ] AI agent integration working
- [ ] Supabase webhook configured
- [ ] End-to-end test successful
- [ ] Monitoring set up
- [ ] Error handling implemented
- [ ] Security measures in place
- [ ] Documentation completed

## 🎯 Next Steps

1. **Extend AI capabilities**: Add more sophisticated AI processing
2. **Add more triggers**: Support additional database tables
3. **Implement batching**: Process multiple records efficiently
4. **Add notifications**: Send alerts for important events
5. **Create dashboard**: Monitor system health and performance

This completes the detailed implementation guide for integrating Supabase webhooks with Azure AI agents through Logic Apps.