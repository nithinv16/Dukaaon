# Supabase Webhooks to Azure AI Agents Integration Guide

This guide shows how to integrate Supabase database webhooks with Azure AI agents using Azure Logic Apps for intelligent automation based on database events.

## 🏗️ Architecture Overview

```
Supabase Database → Webhook (POST) → Azure Logic App → Azure AI Agent → Response Processing
```

## 📋 Prerequisites

- Supabase project with database tables
- Azure subscription with Logic Apps enabled
- Azure AI Foundry with configured AI agents
- Basic understanding of webhooks and REST APIs

## 🔧 Step 1: Azure Logic App Setup

### 1.1 Create Logic App

1. **Azure Portal** → Create Resource → Logic App
2. **Plan Type**: Consumption (recommended for webhooks)
3. **Resource Group**: Select or create new
4. **Region**: Choose closest to your users

### 1.2 Configure HTTP Request Trigger

1. **Logic App Designer** → Add Trigger → "When a HTTP request is received"
2. **HTTP Method**: **POST** (critical - must match Supabase webhook)
3. **Request Body JSON Schema**:

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
      "description": "Table name"
    },
    "record": {
      "type": "object",
      "properties": {
        "id": {"type": "string"},
        "user_id": {"type": "string"},
        "content": {"type": "string"},
        "status": {"type": "string"},
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

4. **Save** and copy the generated **HTTP POST URL**

## 🔧 Step 2: Supabase Webhook Configuration

### 2.1 Create Database Webhook

1. **Supabase Dashboard** → Database → Webhooks
2. **Create Webhook** with these settings:
   - **Name**: `ai_agent_trigger`
   - **Table**: Select your target table (e.g., `orders`, `messages`)
   - **Events**: ✅ Insert, ✅ Update (select as needed)
   - **Type**: HTTP Request
   - **Method**: **POST** (must match Logic App)
   - **URL**: Paste the Logic App HTTP POST URL
   - **HTTP Headers**:
     ```
     Content-Type: application/json
     ```

### 2.2 Test Webhook

```sql
-- Test INSERT event
INSERT INTO your_table (user_id, content, status) 
VALUES ('test-user', 'Test message for AI processing', 'pending');
```

## 🔧 Step 3: Azure AI Agent Integration

### 3.1 Add AI Agent Connectors

In your Logic App, after the HTTP trigger, add:

1. **Azure AI Foundry** connector
2. **Create Thread** action (for new conversations)
3. **Create Run** action (to process with AI)
4. **Get Run** action (to retrieve results)
5. **List Messages** action (to get AI response)

### 3.2 Configure AI Agent Actions

#### Create Thread (Optional)
```json
{
  "messages": [
    {
      "role": "user",
      "content": "@{triggerBody()?['record']?['content']}"
    }
  ],
  "metadata": {
    "source": "supabase_webhook",
    "table": "@{triggerBody()?['table']}",
    "event_type": "@{triggerBody()?['type']}"
  }
}
```

#### Create Run
```json
{
  "thread_id": "@{body('Create_thread')?['id']}",
  "assistant_id": "your-ai-agent-id",
  "instructions": "Process this database event and provide appropriate response based on the content."
}
```

#### Get Run Status
```json
{
  "thread_id": "@{body('Create_thread')?['id']}",
  "run_id": "@{body('Create_run')?['id']}"
}
```

### 3.3 Add Response Processing

1. **Condition**: Check if AI processing completed successfully
2. **Parse JSON**: Extract AI response from messages
3. **Compose**: Format response for further processing

## 🔧 Step 4: Response Handling

### 4.1 Process AI Response

```json
{
  "ai_response": "@{first(body('List_messages')?['data'])?['content']?[0]?['text']?['value']}",
  "original_record_id": "@{triggerBody()?['record']?['id']}",
  "processing_status": "completed",
  "timestamp": "@{utcNow()}"
}
```

### 4.2 Update Supabase (Optional)

Add HTTP action to update the original record:

```json
{
  "method": "PATCH",
  "uri": "https://your-project.supabase.co/rest/v1/your_table?id=eq.@{triggerBody()?['record']?['id']}",
  "headers": {
    "apikey": "your-supabase-anon-key",
    "Authorization": "Bearer your-supabase-anon-key",
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
  },
  "body": {
    "ai_response": "@{variables('ai_response')}",
    "status": "processed"
  }
}
```

### 4.3 Return Response

Add **Response** action:

```json
{
  "statusCode": 200,
  "headers": {
    "Content-Type": "application/json"
  },
  "body": {
    "status": "success",
    "message": "AI processing completed",
    "record_id": "@{triggerBody()?['record']?['id']}",
    "ai_response": "@{variables('ai_response')}"
  }
}
```

## 🔧 Step 5: Register Logic App as Agent Action

### 5.1 Azure AI Foundry Portal

1. **Navigate to**: Agents → Your Agent → Actions
2. **Add Action** → Azure Logic Apps
3. **Configure**:
   - **Action Name**: `process_database_event`
   - **Description**: `Process Supabase database events with AI`
   - **Subscription**: Your Azure subscription
   - **Resource Group**: Logic App resource group
   - **Logic App**: Select your created Logic App

### 5.2 Workflow Validation

Ensure your workflow:
- ✅ Starts with HTTP Request trigger
- ✅ Ends with Response action
- ✅ Handles errors gracefully
- ✅ Returns proper HTTP status codes

## 🧪 Testing & Validation

### Test 1: Direct Logic App Test

```bash
# Use the test script
node scripts/test-webhook.js "YOUR_LOGIC_APP_URL" INSERT
```

### Test 2: End-to-End Test

```sql
-- Insert test record in Supabase
INSERT INTO orders (user_id, content, status, is_ai_order) 
VALUES ('test-user', 'Please process this order with AI analysis', 'pending', true);
```

### Test 3: Monitor Execution

1. **Supabase**: Database → Webhooks → View logs
2. **Azure**: Logic App → Overview → Runs history
3. **AI Foundry**: Monitor agent conversations

## 🚨 Important HTTP Method Configuration

### ❌ Wrong Configuration:
- **Logic App**: GET method
- **Supabase Webhook**: POST method
- **Result**: Data loss, webhook failures

### ✅ Correct Configuration:
- **Logic App**: POST method
- **Supabase Webhook**: POST method
- **Result**: Proper data transmission

**Why POST is Required:**
- Webhooks send data in request body
- GET requests don't support request bodies
- Supabase webhooks always use POST
- Logic App must match the incoming method

## 🔍 Troubleshooting

### Common Issues:

1. **401 Unauthorized**
   - Check Logic App URL signature
   - Verify webhook URL is complete

2. **400 Bad Request**
   - Validate JSON schema in Logic App
   - Check webhook payload format

3. **500 Internal Server Error**
   - Review Logic App execution history
   - Check AI agent configuration

4. **Webhook Not Triggering**
   - Verify table events are enabled
   - Check Supabase webhook logs
   - Test with manual database operations

### Monitoring:

- **Supabase**: Real-time webhook delivery status
- **Logic Apps**: Detailed execution logs
- **AI Foundry**: Agent conversation history
- **Azure Monitor**: Performance metrics

## 🎯 Use Cases

1. **Order Processing**: Auto-analyze orders with AI
2. **Content Moderation**: AI review of user-generated content
3. **Customer Support**: Auto-respond to support tickets
4. **Data Enrichment**: AI-powered data enhancement
5. **Workflow Automation**: Intelligent business process automation

## 🔐 Security Best Practices

1. **Use HTTPS** for all webhook URLs
2. **Validate webhook signatures** (if available)
3. **Implement rate limiting** in Logic Apps
4. **Store secrets** in Azure Key Vault
5. **Monitor webhook activity** for anomalies
6. **Use least privilege** for service connections

## 📈 Performance Optimization

1. **Async Processing**: Use Logic Apps for non-blocking operations
2. **Batch Processing**: Group multiple events when possible
3. **Caching**: Cache AI responses for similar requests
4. **Error Handling**: Implement retry logic with exponential backoff
5. **Monitoring**: Set up alerts for failed executions

This integration enables real-time, intelligent automation where database changes automatically trigger AI processing, creating powerful event-driven applications.