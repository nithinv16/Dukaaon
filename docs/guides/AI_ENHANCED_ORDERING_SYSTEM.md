# Enhanced AI Stock Ordering System with Advanced Communication Features

## Overview

This document extends the existing AI Stock Ordering System with advanced features for automated wholesaler follow-up and bidirectional retailer communication. The enhanced system includes intelligent escalation workflows, phone call automation, and comprehensive database integration.

## 🚀 New Enhanced Features

### 1. Automated Wholesaler Follow-up System

#### 1.1 Multi-Stage Escalation Workflow
- **Stage 1**: Initial order notification (WhatsApp + Email)
- **Stage 2**: 10-minute reminder (WhatsApp message)
- **Stage 3**: 20-minute escalation (Automated phone call)
- **Stage 4**: AI-powered order confirmation via phone

#### 1.2 Communication Timeline
```
0 min:  Order placed → WhatsApp + Email notification
10 min: No response → WhatsApp reminder
20 min: Still no response → Automated phone call
25 min: AI agent discusses order details
30 min: Order confirmed/rejected via phone or timeout
```

### 2. Bidirectional Retailer Communication

#### 2.1 Inbound Call Handling
- **Voice Recognition**: Multi-language support (English, Hindi, regional languages)
- **Order Placement**: Complete order processing via phone
- **Inventory Queries**: Real-time stock availability
- **Price Calculations**: Dynamic pricing with delivery costs
- **Order Tracking**: Status updates and delivery information

#### 2.2 Intelligent Conversation Management
- **Context Awareness**: Maintains conversation state across interactions
- **Product Recommendations**: AI-powered suggestions based on history
- **Error Handling**: Graceful handling of unclear requests
- **Multi-turn Dialogs**: Complex order modifications and confirmations

## 🏗️ Enhanced System Architecture

### Core Components (Extended)

1. **Enhanced Voice Interface Layer**
   - Bidirectional Speech Processing
   - Multi-language Support
   - Phone Call Integration
   - Real-time Audio Streaming

2. **Advanced Communication Engine**
   - WhatsApp Business API Integration
   - Voice Call Automation (Twilio/Azure Communication Services)
   - SMS Fallback System
   - Email Notification System

3. **Intelligent Escalation Manager**
   - Time-based Triggers
   - Response Tracking
   - Escalation Decision Logic
   - Communication Channel Selection

4. **Enhanced AI Agent Core**
   - Phone Call Conversation Management
   - Database Write/Read Operations
   - Real-time Inventory Checking
   - Dynamic Pricing Calculations

5. **Advanced Database Integration**
   - Real-time Order Status Updates
   - Communication Log Tracking
   - Performance Analytics
   - Audit Trail Management

## 📊 Enhanced Database Schema

### 1. Communication Tracking Tables

```sql
-- Communication logs table
CREATE TABLE communication_logs (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id),
    communication_type ENUM('whatsapp', 'email', 'phone_call', 'sms'),
    recipient_type ENUM('wholesaler', 'retailer'),
    recipient_id VARCHAR(255),
    message_content TEXT,
    status ENUM('sent', 'delivered', 'read', 'responded', 'failed'),
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMP,
    response_content TEXT,
    escalation_level INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Escalation tracking table
CREATE TABLE order_escalations (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id),
    current_stage INTEGER DEFAULT 1,
    next_escalation_at TIMESTAMP,
    escalation_history JSONB,
    is_resolved BOOLEAN DEFAULT FALSE,
    resolution_method ENUM('whatsapp', 'email', 'phone_call', 'timeout', 'manual'),
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Phone call sessions table
CREATE TABLE phone_call_sessions (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id),
    caller_type ENUM('retailer', 'wholesaler'),
    caller_phone VARCHAR(20),
    call_duration INTEGER, -- in seconds
    call_status ENUM('initiated', 'connected', 'completed', 'failed', 'no_answer'),
    conversation_transcript TEXT,
    ai_actions_taken JSONB, -- JSON array of actions performed
    order_modified BOOLEAN DEFAULT FALSE,
    call_recording_url VARCHAR(500),
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP
);

-- Enhanced order status tracking
ALTER TABLE orders ADD COLUMN IF NOT EXISTS confirmation_method ENUM('manual', 'whatsapp', 'email', 'phone_call', 'ai_agent');
ALTER TABLE orders ADD COLUMN IF NOT EXISTS last_communication_at TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS communication_attempts INTEGER DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS escalation_level INTEGER DEFAULT 0;
```

### 2. AI Session Management

```sql
-- AI conversation sessions
CREATE TABLE ai_conversation_sessions (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) UNIQUE,
    user_id INTEGER,
    user_type ENUM('retailer', 'wholesaler'),
    communication_channel ENUM('voice_call', 'whatsapp', 'web_interface'),
    phone_number VARCHAR(20),
    conversation_state JSONB, -- Current conversation context
    current_order_id INTEGER REFERENCES orders(id),
    language_preference VARCHAR(10) DEFAULT 'en',
    session_status ENUM('active', 'completed', 'timeout', 'error'),
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP
);

-- Conversation turns for detailed tracking
CREATE TABLE conversation_turns (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) REFERENCES ai_conversation_sessions(session_id),
    turn_number INTEGER,
    speaker ENUM('user', 'ai_agent'),
    message_type ENUM('text', 'voice', 'action'),
    content TEXT,
    intent_detected VARCHAR(100),
    entities_extracted JSONB,
    ai_response TEXT,
    actions_performed JSONB,
    confidence_score DECIMAL(3,2),
    processing_time_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 🔄 Enhanced n8n Workflows

### 1. Wholesaler Escalation Workflow

```json
{
  "name": "Wholesaler Order Escalation",
  "nodes": [
    {
      "name": "Order Created Trigger",
      "type": "n8n-nodes-base.webhook",
      "parameters": {
        "path": "order-created",
        "httpMethod": "POST"
      }
    },
    {
      "name": "Send Initial Notification",
      "type": "n8n-nodes-base.function",
      "parameters": {
        "functionCode": "// Send WhatsApp and Email notification\nconst orderData = $input.first().json;\n\n// WhatsApp notification\nconst whatsappMessage = {\n  to: orderData.wholesaler_phone,\n  message: `New Order #${orderData.order_id}\\n\\nRetailer: ${orderData.retailer_name}\\nItems: ${orderData.items.map(item => `${item.quantity}x ${item.product_name}`).join(', ')}\\nTotal: ₹${orderData.total_amount}\\n\\nPlease confirm within 10 minutes.\\nReply 'CONFIRM' to accept or 'REJECT' to decline.`,\n  order_id: orderData.order_id\n};\n\nreturn [{ json: whatsappMessage }];"
      }
    },
    {
      "name": "WhatsApp Send",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "url": "https://api.whatsapp.com/send",
        "method": "POST",
        "headers": {
          "Authorization": "Bearer {{$env.WHATSAPP_TOKEN}}"
        }
      }
    },
    {
      "name": "Schedule 10min Reminder",
      "type": "n8n-nodes-base.schedule",
      "parameters": {
        "rule": {
          "interval": [{
            "field": "minutes",
            "value": 10
          }]
        }
      }
    },
    {
      "name": "Check Response Status",
      "type": "n8n-nodes-base.postgres",
      "parameters": {
        "query": "SELECT status, communication_attempts FROM orders WHERE id = {{$json.order_id}}"
      }
    },
    {
      "name": "Send WhatsApp Reminder",
      "type": "n8n-nodes-base.if",
      "parameters": {
        "conditions": {
          "string": [
            {
              "value1": "{{$json.status}}",
              "operation": "equal",
              "value2": "pending"
            }
          ]
        }
      }
    },
    {
      "name": "Schedule Phone Call",
      "type": "n8n-nodes-base.schedule",
      "parameters": {
        "rule": {
          "interval": [{
            "field": "minutes",
            "value": 10
          }]
        }
      }
    },
    {
      "name": "Initiate AI Phone Call",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "url": "{{$env.AI_PHONE_SERVICE_URL}}/initiate-call",
        "method": "POST",
        "body": {
          "phone_number": "{{$json.wholesaler_phone}}",
          "order_id": "{{$json.order_id}}",
          "call_type": "order_confirmation",
          "language": "{{$json.language_preference || 'en'}}"
        }
      }
    }
  ]
}
```

### 2. Retailer Inbound Call Workflow

```json
{
  "name": "Retailer Inbound Call Handler",
  "nodes": [
    {
      "name": "Incoming Call Webhook",
      "type": "n8n-nodes-base.webhook",
      "parameters": {
        "path": "incoming-call",
        "httpMethod": "POST"
      }
    },
    {
      "name": "Initialize AI Session",
      "type": "n8n-nodes-base.function",
      "parameters": {
        "functionCode": "// Create new AI conversation session\nconst callData = $input.first().json;\nconst sessionId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;\n\nreturn [{\n  json: {\n    session_id: sessionId,\n    phone_number: callData.from,\n    call_sid: callData.call_sid,\n    user_type: 'retailer',\n    communication_channel: 'voice_call',\n    language_preference: 'auto_detect'\n  }\n}];"
      }
    },
    {
      "name": "Create Session Record",
      "type": "n8n-nodes-base.postgres",
      "parameters": {
        "query": "INSERT INTO ai_conversation_sessions (session_id, phone_number, user_type, communication_channel, session_status) VALUES ('{{$json.session_id}}', '{{$json.phone_number}}', '{{$json.user_type}}', '{{$json.communication_channel}}', 'active')"
      }
    },
    {
      "name": "Start AI Conversation",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "url": "{{$env.AI_VOICE_SERVICE_URL}}/start-conversation",
        "method": "POST",
        "body": {
          "session_id": "{{$json.session_id}}",
          "call_sid": "{{$json.call_sid}}",
          "initial_message": "Hello! Welcome to Dukaaon. I'm your AI assistant. How can I help you place an order today?"
        }
      }
    }
  ]
}
```

## 🤖 Enhanced AI Agent Implementation

### 1. Phone Call AI Agent Service

```typescript
// services/aiAgent/phoneCallAgent.ts
import { AzureFoundryService } from '../azureAI/azureFoundryService';
import { supabase } from '../supabase/client';

export interface PhoneCallSession {
  sessionId: string;
  callSid: string;
  phoneNumber: string;
  userType: 'retailer' | 'wholesaler';
  currentOrderId?: string;
  conversationState: {
    intent: string;
    entities: Record<string, any>;
    currentStep: string;
    orderItems: OrderItem[];
    totalAmount: number;
  };
}

export class PhoneCallAIAgent {
  private azureFoundry: AzureFoundryService;
  private activeSessions: Map<string, PhoneCallSession> = new Map();

  constructor() {
    this.azureFoundry = new AzureFoundryService();
  }

  async handleIncomingCall(callData: {
    callSid: string;
    from: string;
    to: string;
  }): Promise<{ sessionId: string; initialResponse: string }> {
    const sessionId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create session record
    const { error } = await supabase
      .from('ai_conversation_sessions')
      .insert({
        session_id: sessionId,
        phone_number: callData.from,
        user_type: 'retailer',
        communication_channel: 'voice_call',
        session_status: 'active'
      });

    if (error) {
      throw new Error(`Failed to create session: ${error.message}`);
    }

    // Initialize conversation state
    const session: PhoneCallSession = {
      sessionId,
      callSid: callData.callSid,
      phoneNumber: callData.from,
      userType: 'retailer',
      conversationState: {
        intent: 'greeting',
        entities: {},
        currentStep: 'welcome',
        orderItems: [],
        totalAmount: 0
      }
    };

    this.activeSessions.set(sessionId, session);

    const initialResponse = "Hello! Welcome to Dukaaon. I'm your AI assistant. How can I help you place an order today?";
    
    return { sessionId, initialResponse };
  }

  async processVoiceInput(sessionId: string, transcript: string): Promise<{
    response: string;
    actions: string[];
    orderUpdated: boolean;
  }> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Log conversation turn
    await this.logConversationTurn(sessionId, 'user', transcript);

    // Process with Azure AI
    const aiResponse = await this.azureFoundry.sendMessage(
      sessionId,
      this.buildContextualPrompt(session, transcript)
    );

    // Extract intent and entities
    const analysis = await this.analyzeIntent(transcript, session.conversationState);
    
    // Perform actions based on intent
    const actions = await this.performActions(session, analysis);
    
    // Generate natural response
    const response = await this.generateResponse(session, analysis, actions);
    
    // Log AI response
    await this.logConversationTurn(sessionId, 'ai_agent', response);
    
    return {
      response,
      actions,
      orderUpdated: actions.includes('order_updated')
    };
  }

  private async analyzeIntent(transcript: string, currentState: any): Promise<{
    intent: string;
    entities: Record<string, any>;
    confidence: number;
  }> {
    const prompt = `
      Analyze this customer input for ordering intent:
      Input: "${transcript}"
      Current order state: ${JSON.stringify(currentState)}
      
      Extract:
      1. Intent (add_item, remove_item, modify_quantity, check_price, confirm_order, check_stock, get_total)
      2. Product names mentioned
      3. Quantities
      4. Any specific requirements
      
      Respond in JSON format with intent, entities, and confidence score.
    `;

    const response = await this.azureFoundry.sendMessage('analysis', prompt);
    return JSON.parse(response.content);
  }

  private async performActions(session: PhoneCallSession, analysis: any): Promise<string[]> {
    const actions: string[] = [];
    
    switch (analysis.intent) {
      case 'add_item':
        await this.addItemToOrder(session, analysis.entities);
        actions.push('item_added', 'order_updated');
        break;
        
      case 'check_stock':
        await this.checkInventory(session, analysis.entities.product_name);
        actions.push('stock_checked');
        break;
        
      case 'confirm_order':
        await this.confirmOrder(session);
        actions.push('order_confirmed');
        break;
        
      case 'get_total':
        await this.calculateTotal(session);
        actions.push('total_calculated');
        break;
    }
    
    return actions;
  }

  private async addItemToOrder(session: PhoneCallSession, entities: any): Promise<void> {
    // Search for product
    const { data: products } = await supabase
      .from('products')
      .select('*')
      .or(`name.ilike.%${entities.product_name}%,keywords.cs.{${entities.product_name}}`);
    
    if (products && products.length > 0) {
      const product = products[0];
      const quantity = entities.quantity || 1;
      
      // Check stock
      if (product.stock_quantity >= quantity) {
        session.conversationState.orderItems.push({
          product_id: product.id,
          product_name: product.name,
          quantity,
          unit_price: product.price,
          total_price: product.price * quantity
        });
        
        session.conversationState.totalAmount += product.price * quantity;
      } else {
        // Handle out of stock
        session.conversationState.entities.out_of_stock = product.name;
      }
    }
  }

  private async confirmOrder(session: PhoneCallSession): Promise<void> {
    if (session.conversationState.orderItems.length === 0) {
      return;
    }

    // Create order in database
    const { data: order, error } = await supabase
      .from('orders')
      .insert({
        user_id: await this.getUserIdByPhone(session.phoneNumber),
        status: 'confirmed',
        total_amount: session.conversationState.totalAmount,
        is_ai_order: true,
        confirmation_method: 'phone_call'
      })
      .select()
      .single();

    if (!error && order) {
      // Add order items
      const orderItems = session.conversationState.orderItems.map(item => ({
        order_id: order.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price
      }));

      await supabase.from('order_items').insert(orderItems);
      
      session.currentOrderId = order.id;
      session.conversationState.currentStep = 'order_confirmed';
    }
  }

  private async logConversationTurn(
    sessionId: string, 
    speaker: 'user' | 'ai_agent', 
    content: string
  ): Promise<void> {
    await supabase.from('conversation_turns').insert({
      session_id: sessionId,
      speaker,
      content,
      created_at: new Date().toISOString()
    });
  }
}
```

### 2. WhatsApp Integration Service

```typescript
// services/communication/whatsappService.ts
export class WhatsAppService {
  private apiUrl = 'https://graph.facebook.com/v18.0';
  private accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  private phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  async sendOrderNotification(orderData: {
    wholesaler_phone: string;
    order_id: string;
    retailer_name: string;
    items: Array<{ quantity: number; product_name: string }>;
    total_amount: number;
  }): Promise<{ success: boolean; message_id?: string; error?: string }> {
    const message = {
      messaging_product: 'whatsapp',
      to: orderData.wholesaler_phone,
      type: 'template',
      template: {
        name: 'order_notification',
        language: { code: 'en' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: orderData.order_id },
              { type: 'text', text: orderData.retailer_name },
              { type: 'text', text: orderData.items.map(item => `${item.quantity}x ${item.product_name}`).join(', ') },
              { type: 'text', text: `₹${orderData.total_amount}` }
            ]
          }
        ]
      }
    };

    try {
      const response = await fetch(`${this.apiUrl}/${this.phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(message)
      });

      const result = await response.json();
      
      if (response.ok) {
        // Log communication
        await supabase.from('communication_logs').insert({
          order_id: orderData.order_id,
          communication_type: 'whatsapp',
          recipient_type: 'wholesaler',
          recipient_id: orderData.wholesaler_phone,
          message_content: JSON.stringify(message),
          status: 'sent'
        });
        
        return { success: true, message_id: result.messages[0].id };
      } else {
        return { success: false, error: result.error?.message || 'Unknown error' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async sendReminder(orderData: {
    wholesaler_phone: string;
    order_id: string;
    minutes_elapsed: number;
  }): Promise<{ success: boolean; error?: string }> {
    const message = {
      messaging_product: 'whatsapp',
      to: orderData.wholesaler_phone,
      type: 'text',
      text: {
        body: `⏰ REMINDER: Order #${orderData.order_id} is still pending confirmation.\n\nIt's been ${orderData.minutes_elapsed} minutes since the order was placed.\n\nPlease reply:\n✅ 'CONFIRM' to accept\n❌ 'REJECT' to decline\n\nIf no response in 10 minutes, we'll call you directly.`
      }
    };

    try {
      const response = await fetch(`${this.apiUrl}/${this.phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(message)
      });

      if (response.ok) {
        // Update communication log
        await supabase.from('communication_logs').insert({
          order_id: orderData.order_id,
          communication_type: 'whatsapp',
          recipient_type: 'wholesaler',
          recipient_id: orderData.wholesaler_phone,
          message_content: message.text.body,
          status: 'sent',
          escalation_level: 2
        });
        
        return { success: true };
      } else {
        const result = await response.json();
        return { success: false, error: result.error?.message };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async handleIncomingMessage(webhookData: any): Promise<void> {
    const message = webhookData.entry[0]?.changes[0]?.value?.messages[0];
    if (!message) return;

    const from = message.from;
    const text = message.text?.body?.toUpperCase();
    const messageId = message.id;

    // Find pending order for this wholesaler
    const { data: orders } = await supabase
      .from('orders')
      .select('*')
      .eq('wholesaler_phone', from)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1);

    if (orders && orders.length > 0) {
      const order = orders[0];
      
      if (text === 'CONFIRM') {
        // Update order status
        await supabase
          .from('orders')
          .update({ 
            status: 'confirmed',
            confirmation_method: 'whatsapp',
            last_communication_at: new Date().toISOString()
          })
          .eq('id', order.id);
          
        // Log response
        await supabase.from('communication_logs').insert({
          order_id: order.id,
          communication_type: 'whatsapp',
          recipient_type: 'wholesaler',
          recipient_id: from,
          message_content: text,
          status: 'responded',
          responded_at: new Date().toISOString()
        });
        
      } else if (text === 'REJECT') {
        // Update order status
        await supabase
          .from('orders')
          .update({ 
            status: 'rejected',
            confirmation_method: 'whatsapp',
            last_communication_at: new Date().toISOString()
          })
          .eq('id', order.id);
      }
    }
  }
}
```

## 📱 Enhanced Frontend Components

### 1. Enhanced AI Voice Order Interface

```typescript
// app/(main)/ai-voice-order/index.tsx (Enhanced)
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import Voice from '@react-native-voice/voice';
import { PhoneCallAIAgent } from '../../../services/aiAgent/phoneCallAgent';

interface EnhancedVoiceOrderProps {
  userType: 'retailer' | 'wholesaler';
  phoneNumber?: string;
}

export default function EnhancedVoiceOrder({ userType, phoneNumber }: EnhancedVoiceOrderProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [currentOrder, setCurrentOrder] = useState({
    items: [],
    total: 0,
    status: 'building'
  });
  const [sessionId, setSessionId] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const phoneAgent = new PhoneCallAIAgent();

  useEffect(() => {
    Voice.onSpeechStart = onSpeechStart;
    Voice.onSpeechRecognized = onSpeechRecognized;
    Voice.onSpeechEnd = onSpeechEnd;
    Voice.onSpeechError = onSpeechError;
    Voice.onSpeechResults = onSpeechResults;

    return () => {
      Voice.destroy().then(Voice.removeAllListeners);
    };
  }, []);

  const onSpeechStart = () => {
    setIsListening(true);
  };

  const onSpeechRecognized = () => {
    console.log('Speech recognized');
  };

  const onSpeechEnd = () => {
    setIsListening(false);
  };

  const onSpeechError = (error: any) => {
    console.error('Speech error:', error);
    setIsListening(false);
    Alert.alert('Speech Error', 'Could not recognize speech. Please try again.');
  };

  const onSpeechResults = async (event: any) => {
    const spokenText = event.value[0];
    setTranscript(spokenText);
    await processVoiceInput(spokenText);
  };

  const startListening = async () => {
    try {
      await Voice.start('en-US');
    } catch (error) {
      console.error('Error starting voice recognition:', error);
      Alert.alert('Error', 'Could not start voice recognition');
    }
  };

  const stopListening = async () => {
    try {
      await Voice.stop();
    } catch (error) {
      console.error('Error stopping voice recognition:', error);
    }
  };

  const processVoiceInput = async (text: string) => {
    setIsProcessing(true);
    
    try {
      // If no session, create one
      if (!sessionId) {
        const session = await phoneAgent.handleIncomingCall({
          callSid: `web_${Date.now()}`,
          from: phoneNumber || 'web_user',
          to: 'dukaaon_ai'
        });
        setSessionId(session.sessionId);
        setAiResponse(session.initialResponse);
      } else {
        // Process the voice input
        const result = await phoneAgent.processVoiceInput(sessionId, text);
        setAiResponse(result.response);
        
        if (result.orderUpdated) {
          // Refresh order state
          await refreshOrderState();
        }
      }
    } catch (error) {
      console.error('Error processing voice input:', error);
      setAiResponse('Sorry, I encountered an error. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const refreshOrderState = async () => {
    // Fetch current order state from the AI agent
    // This would be implemented based on your session management
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>AI Voice Ordering</Text>
      
      <View style={styles.orderSummary}>
        <Text style={styles.orderTitle}>Current Order</Text>
        {currentOrder.items.map((item, index) => (
          <Text key={index} style={styles.orderItem}>
            {item.quantity}x {item.product_name} - ₹{item.total_price}
          </Text>
        ))}
        <Text style={styles.orderTotal}>Total: ₹{currentOrder.total}</Text>
      </View>

      <View style={styles.conversationArea}>
        <Text style={styles.transcriptLabel}>You said:</Text>
        <Text style={styles.transcript}>{transcript}</Text>
        
        <Text style={styles.responseLabel}>AI Response:</Text>
        <Text style={styles.aiResponse}>{aiResponse}</Text>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.button, isListening ? styles.listeningButton : styles.idleButton]}
          onPress={isListening ? stopListening : startListening}
          disabled={isProcessing}
        >
          <Text style={styles.buttonText}>
            {isProcessing ? 'Processing...' : isListening ? 'Stop Listening' : 'Start Speaking'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5'
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20
  },
  orderSummary: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20
  },
  orderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10
  },
  orderItem: {
    fontSize: 14,
    marginBottom: 5
  },
  orderTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 10
  },
  conversationArea: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    minHeight: 200
  },
  transcriptLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666'
  },
  transcript: {
    fontSize: 16,
    marginBottom: 15,
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 5
  },
  responseLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666'
  },
  aiResponse: {
    fontSize: 16,
    padding: 10,
    backgroundColor: '#e3f2fd',
    borderRadius: 5
  },
  controls: {
    alignItems: 'center'
  },
  button: {
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    minWidth: 200
  },
  idleButton: {
    backgroundColor: '#4CAF50'
  },
  listeningButton: {
    backgroundColor: '#f44336'
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center'
  }
});
```

## 🚀 Implementation Roadmap

### Phase 1: Enhanced Communication Infrastructure (Weeks 1-2)
1. **Database Schema Updates**
   - Implement communication tracking tables
   - Add escalation management tables
   - Create phone call session tracking

2. **WhatsApp Integration**
   - Set up WhatsApp Business API
   - Implement message templates
   - Create webhook handlers for responses

3. **Basic Escalation Workflow**
   - Implement time-based triggers
   - Create n8n escalation workflow
   - Test WhatsApp notifications

### Phase 2: Phone Call Integration (Weeks 3-4)
1. **Voice Call Infrastructure**
   - Integrate Twilio/Azure Communication Services
   - Implement call routing and handling
   - Set up call recording and transcription

2. **AI Phone Agent**
   - Develop phone call AI agent service
   - Implement conversation management
   - Create database integration for real-time updates

3. **Bidirectional Communication**
   - Enable inbound call handling
   - Implement retailer order placement via phone
   - Add inventory checking and price calculation

### Phase 3: Advanced Features (Weeks 5-6)
1. **Multi-language Support**
   - Implement language detection
   - Add regional language support
   - Create localized responses

2. **Analytics and Monitoring**
   - Build communication analytics dashboard
   - Implement performance tracking
   - Create escalation success metrics

3. **Testing and Optimization**
   - Comprehensive testing of all workflows
   - Performance optimization
   - User acceptance testing

## 📊 Success Metrics

### Communication Effectiveness
- **Response Rate**: Percentage of wholesalers responding within 10 minutes
- **Escalation Success**: Orders confirmed via phone calls after WhatsApp timeout
- **First Contact Resolution**: Orders confirmed without escalation

### AI Agent Performance
- **Call Completion Rate**: Successful order placements via phone
- **Speech Recognition Accuracy**: Correct interpretation of voice inputs
- **Order Accuracy**: Correct product identification and pricing

### Business Impact
- **Order Processing Time**: Reduction in manual order processing
- **Customer Satisfaction**: Improved ordering experience ratings
- **Operational Efficiency**: Reduced manual intervention requirements

## 🔒 Security and Compliance

### Data Protection
- **Call Recording Encryption**: All voice data encrypted in transit and at rest
- **PII Protection**: Personal information handling compliance
- **Access Controls**: Role-based access to sensitive data

### Communication Security
- **WhatsApp Encryption**: End-to-end encrypted messaging
- **Phone Call Security**: Secure voice transmission protocols
- **API Security**: OAuth 2.0 and API key management

### Audit and Compliance
- **Communication Logs**: Complete audit trail of all interactions
- **Consent Management**: User consent for voice recording and processing
- **Data Retention**: Configurable data retention policies

## 💰 Cost Estimation (Enhanced System)

### Monthly Costs (1000 orders with escalation)
- **OpenAI API**: $75-150 (increased usage for phone calls)
- **WhatsApp Business API**: $15-30 (template messages + conversations)
- **Voice Call Services (Twilio)**: $50-100 (based on call duration)
- **n8n Cloud**: $50-100 (increased workflow complexity)
- **Database Hosting**: $30-60 (additional storage for logs)
- **Speech Recognition**: $20-40 (Azure/Google Speech Services)
- **Total**: $240-480/month

### ROI Calculation
- **Time Savings**: 80% reduction in manual order processing
- **Improved Response Rates**: 60% faster order confirmations
- **Reduced Support Calls**: 70% fewer manual interventions
- **Estimated Monthly Savings**: $1000-2000 in operational costs

## 🎯 Conclusion

The Enhanced AI Stock Ordering System with advanced communication features represents a comprehensive solution for automated order management. The system provides:

### Key Benefits
- **Automated Escalation**: Intelligent follow-up ensures no orders are missed
- **Bidirectional Communication**: Retailers can place orders via phone calls
- **Real-time Database Integration**: Live inventory and pricing information
- **Multi-channel Support**: WhatsApp, phone calls, and web interface
- **Comprehensive Tracking**: Complete audit trail of all communications

### Competitive Advantages
- **24/7 Availability**: AI agents available round the clock
- **Multi-language Support**: Serves diverse customer base
- **Intelligent Escalation**: Reduces manual intervention
- **Real-time Processing**: Instant order updates and confirmations
- **Scalable Architecture**: Handles growing order volumes efficiently

This enhanced system positions Dukaaon as a leader in AI-powered B2B commerce, providing unmatched ordering convenience and operational efficiency.

---

**Ready to revolutionize your ordering process! 🚀📞🤖**