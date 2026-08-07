# AI Stock Ordering Agent Implementation Guide

## Overview

This document outlines the implementation of an AI-powered stock ordering agent that allows users to verbally or textually input product names, automatically searches for items, manages cart operations, handles inventory checks, and facilitates order confirmation with wholesaler notifications.

## System Architecture

### Core Components

1. **Voice Interface Layer**
   - Speech-to-Text (STT) Engine
   - Text-to-Speech (TTS) Engine
   - Audio Input/Output Management

2. **Natural Language Processing (NLP) Layer**
   - Intent Recognition
   - Entity Extraction
   - Context Management
   - Product Name Normalization

3. **AI Agent Core**
   - Conversation Management
   - Order State Management
   - Decision Making Logic
   - Multi-turn Dialog Handling

4. **Product Search & Inventory**
   - Fuzzy Product Matching
   - Inventory Status Checking
   - Price Retrieval
   - Alternative Product Suggestions

5. **Cart Management**
   - Add/Remove Items
   - Quantity Management
   - Price Calculation
   - Order Summary Generation

6. **Notification System**
   - Wholesaler Notification
   - Order Confirmation
   - Status Updates

## Technology Stack

### AI & NLP Services
- **Speech Recognition**: Azure Speech Service, Google Speech-to-Text, or OpenAI Whisper
- **Language Models**: OpenAI GPT-4, Claude, or Mistral for conversation management
- **NLP Processing**: Custom entity extraction and intent classification

### Workflow Automation
- **n8n**: Primary workflow orchestration platform
- **Integration**: 500+ app integrations for seamless connectivity
- **MCP Servers**: Model Context Protocol for external system integration

### Backend Infrastructure
- **Database**: Product catalog, inventory, and order management
- **APIs**: RESTful services for product search and order processing
- **Real-time Communication**: WebSocket for live updates

## Implementation Plan

### Phase 1: Core Infrastructure Setup

#### 1.1 n8n Workflow Setup
```yaml
Workflow Components:
- Webhook Trigger: Receive voice/text input
- Speech-to-Text Node: Convert audio to text
- OpenAI/Claude Node: Process natural language
- Database Query Node: Search products
- HTTP Request Node: Update cart
- Notification Node: Alert wholesaler
```

#### 1.2 Database Schema
```sql
-- Products table
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2),
    stock_quantity INTEGER,
    category_id INTEGER,
    keywords TEXT[], -- For fuzzy search
    status ENUM('available', 'out_of_stock', 'discontinued')
);

-- Orders table
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    status ENUM('draft', 'confirmed', 'processing', 'completed'),
    total_amount DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Order items table
CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id),
    product_id INTEGER REFERENCES products(id),
    quantity INTEGER,
    unit_price DECIMAL(10,2)
);
```

### Phase 2: AI Agent Development

#### 2.1 Voice Interface Implementation

**Frontend Component (React Native)**
```typescript
// Voice Input Component
import { Audio } from 'expo-av';
import Voice from '@react-native-voice/voice';

const VoiceOrderingAgent = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [orderState, setOrderState] = useState({
    items: [],
    total: 0,
    status: 'listening'
  });

  const startListening = async () => {
    try {
      await Voice.start('en-US');
      setIsListening(true);
    } catch (error) {
      console.error('Voice recognition error:', error);
    }
  };

  const onSpeechResults = (event) => {
    const spokenText = event.value[0];
    setTranscript(spokenText);
    processVoiceInput(spokenText);
  };

  const processVoiceInput = async (text) => {
    // Send to n8n workflow
    const response = await fetch('/api/voice-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        input: text, 
        sessionId: sessionId,
        currentOrder: orderState 
      })
    });
    
    const result = await response.json();
    updateOrderState(result);
  };
};
```

#### 2.2 n8n Workflow Configuration

**Main Ordering Workflow**
```json
{
  "name": "AI Stock Ordering Agent",
  "nodes": [
    {
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "parameters": {
        "path": "voice-order",
        "httpMethod": "POST"
      }
    },
    {
      "name": "Speech to Text",
      "type": "n8n-nodes-base.openAi",
      "parameters": {
        "resource": "audio",
        "operation": "transcribe",
        "model": "whisper-1"
      }
    },
    {
      "name": "Intent Analysis",
      "type": "n8n-nodes-base.openAi",
      "parameters": {
        "resource": "chat",
        "model": "gpt-4",
        "messages": [
          {
            "role": "system",
            "content": "You are an AI assistant for stock ordering. Analyze the user input and extract: 1) Intent (add_item, remove_item, confirm_order, check_status) 2) Product names 3) Quantities 4) Any special instructions. Respond in JSON format."
          }
        ]
      }
    },
    {
      "name": "Product Search",
      "type": "n8n-nodes-base.postgres",
      "parameters": {
        "query": "SELECT * FROM products WHERE name ILIKE '%{{$json.product_name}}%' OR '{{$json.product_name}}' = ANY(keywords) ORDER BY similarity(name, '{{$json.product_name}}') DESC LIMIT 5"
      }
    },
    {
      "name": "Inventory Check",
      "type": "n8n-nodes-base.function",
      "parameters": {
        "functionCode": "// Check stock availability and generate response\nconst products = $input.all();\nconst availableProducts = [];\nconst unavailableProducts = [];\n\nproducts.forEach(product => {\n  if (product.json.stock_quantity > 0) {\n    availableProducts.push(product.json);\n  } else {\n    unavailableProducts.push(product.json);\n  }\n});\n\nreturn [{\n  json: {\n    available: availableProducts,\n    unavailable: unavailableProducts,\n    response: generateResponse(availableProducts, unavailableProducts)\n  }\n}];"
      }
    },
    {
      "name": "Update Cart",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "url": "{{$env.API_BASE_URL}}/cart/update",
        "method": "POST",
        "body": {
          "sessionId": "{{$json.sessionId}}",
          "items": "{{$json.available}}"
        }
      }
    },
    {
      "name": "Generate Response",
      "type": "n8n-nodes-base.openAi",
      "parameters": {
        "resource": "chat",
        "model": "gpt-4",
        "messages": [
          {
            "role": "system",
            "content": "Generate a natural, conversational response for the stock ordering agent. Include: 1) Confirmation of added items 2) Mention of unavailable items 3) Current cart summary 4) Ask if they want to add more items or confirm order."
          }
        ]
      }
    },
    {
      "name": "Text to Speech",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "url": "https://api.elevenlabs.io/v1/text-to-speech",
        "method": "POST",
        "headers": {
          "xi-api-key": "{{$env.ELEVENLABS_API_KEY}}"
        }
      }
    }
  ]
}
```

### Phase 3: Advanced Features

#### 3.1 Fuzzy Product Matching
```sql
-- Enable fuzzy string matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;

-- Create index for faster searches
CREATE INDEX products_name_gin_idx ON products USING gin (name gin_trgm_ops);
CREATE INDEX products_keywords_gin_idx ON products USING gin (keywords);

-- Fuzzy search query
SELECT 
    p.*,
    similarity(p.name, $1) as name_similarity,
    CASE 
        WHEN $1 = ANY(p.keywords) THEN 1.0
        ELSE 0.0
    END as keyword_match
FROM products p
WHERE 
    similarity(p.name, $1) > 0.3
    OR $1 = ANY(p.keywords)
    OR p.name ILIKE '%' || $1 || '%'
ORDER BY 
    keyword_match DESC,
    name_similarity DESC,
    p.name
LIMIT 10;
```

#### 3.2 Context Management
```typescript
// Session state management
interface OrderSession {
  sessionId: string;
  userId: string;
  currentOrder: {
    items: OrderItem[];
    total: number;
    status: 'building' | 'confirming' | 'confirmed';
  };
  conversationHistory: ConversationTurn[];
  lastActivity: Date;
}

class OrderSessionManager {
  private sessions = new Map<string, OrderSession>();

  getSession(sessionId: string): OrderSession {
    return this.sessions.get(sessionId) || this.createNewSession(sessionId);
  }

  updateSession(sessionId: string, updates: Partial<OrderSession>): void {
    const session = this.getSession(sessionId);
    this.sessions.set(sessionId, { ...session, ...updates, lastActivity: new Date() });
  }

  addToCart(sessionId: string, product: Product, quantity: number): void {
    const session = this.getSession(sessionId);
    const existingItem = session.currentOrder.items.find(item => item.productId === product.id);
    
    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      session.currentOrder.items.push({
        productId: product.id,
        name: product.name,
        quantity,
        unitPrice: product.price
      });
    }
    
    session.currentOrder.total = this.calculateTotal(session.currentOrder.items);
    this.updateSession(sessionId, session);
  }
}
```

### Phase 4: Wholesaler Notification System

#### 4.1 Order Confirmation Workflow
```json
{
  "name": "Order Confirmation & Notification",
  "nodes": [
    {
      "name": "Order Confirmed Trigger",
      "type": "n8n-nodes-base.webhook",
      "parameters": {
        "path": "order-confirmed"
      }
    },
    {
      "name": "Save Order to Database",
      "type": "n8n-nodes-base.postgres",
      "parameters": {
        "query": "INSERT INTO orders (user_id, status, total_amount) VALUES ($1, 'confirmed', $2) RETURNING id"
      }
    },
    {
      "name": "Generate Order Summary",
      "type": "n8n-nodes-base.function",
      "parameters": {
        "functionCode": "const order = $input.first().json;\nconst summary = {\n  orderId: order.id,\n  customerInfo: order.customer,\n  items: order.items,\n  total: order.total,\n  timestamp: new Date().toISOString()\n};\nreturn [{ json: summary }];"
      }
    },
    {
      "name": "Notify Wholesaler via WhatsApp",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "url": "https://api.whatsapp.com/send",
        "method": "POST",
        "body": {
          "phone": "+918089668552",
          "message": "New Order Received!\n\nOrder ID: {{$json.orderId}}\nCustomer: {{$json.customerInfo.name}}\nItems: {{$json.items.length}}\nTotal: ₹{{$json.total}}\n\nPlease confirm this order."
        }
      }
    },
    {
      "name": "Send Email Notification",
      "type": "n8n-nodes-base.emailSend",
      "parameters": {
        "to": "wholesaler@dukaaon.com",
        "subject": "New Stock Order - Order #{{$json.orderId}}",
        "html": "<h2>New Order Received</h2><p>Order Details:</p><ul>{{#each items}}<li>{{name}} - Qty: {{quantity}} - ₹{{unitPrice}}</li>{{/each}}</ul><p><strong>Total: ₹{{total}}</strong></p>"
      }
    }
  ]
}
```

## Integration with Existing Dukaaon App

### 4.1 API Endpoints
```typescript
// Add to existing API routes
// app/api/voice-order/route.ts
export async function POST(request: Request) {
  const { input, sessionId, currentOrder } = await request.json();
  
  // Trigger n8n workflow
  const response = await fetch(`${process.env.N8N_WEBHOOK_URL}/voice-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input, sessionId, currentOrder })
  });
  
  return Response.json(await response.json());
}

// app/api/cart/update/route.ts
export async function POST(request: Request) {
  const { sessionId, items } = await request.json();
  
  // Update cart in database
  const updatedCart = await updateCartItems(sessionId, items);
  
  return Response.json(updatedCart);
}
```

### 4.2 Voice Ordering Screen
```typescript
// app/(main)/voice-order/index.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Voice from '@react-native-voice/voice';
import { Audio } from 'expo-av';

const VoiceOrderScreen = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [agentResponse, setAgentResponse] = useState('');
  const [cart, setCart] = useState([]);

  useEffect(() => {
    Voice.onSpeechResults = onSpeechResults;
    Voice.onSpeechError = onSpeechError;
    
    return () => {
      Voice.destroy().then(Voice.removeAllListeners);
    };
  }, []);

  const onSpeechResults = (event) => {
    const spokenText = event.value[0];
    setTranscript(spokenText);
    processVoiceInput(spokenText);
  };

  const processVoiceInput = async (text) => {
    try {
      const response = await fetch('/api/voice-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          input: text, 
          sessionId: 'user-session-123',
          currentOrder: cart 
        })
      });
      
      const result = await response.json();
      setAgentResponse(result.response);
      setCart(result.cart);
      
      // Play audio response
      if (result.audioUrl) {
        const { sound } = await Audio.Sound.createAsync({ uri: result.audioUrl });
        await sound.playAsync();
      }
    } catch (error) {
      console.error('Error processing voice input:', error);
    }
  };

  const startListening = async () => {
    try {
      await Voice.start('en-US');
      setIsListening(true);
    } catch (error) {
      console.error('Voice start error:', error);
    }
  };

  const stopListening = async () => {
    try {
      await Voice.stop();
      setIsListening(false);
    } catch (error) {
      console.error('Voice stop error:', error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Voice Stock Ordering</Text>
      
      <View style={styles.transcriptContainer}>
        <Text style={styles.label}>You said:</Text>
        <Text style={styles.transcript}>{transcript}</Text>
      </View>
      
      <View style={styles.responseContainer}>
        <Text style={styles.label}>Agent response:</Text>
        <Text style={styles.response}>{agentResponse}</Text>
      </View>
      
      <TouchableOpacity 
        style={[styles.micButton, isListening && styles.micButtonActive]}
        onPress={isListening ? stopListening : startListening}
      >
        <Text style={styles.micButtonText}>
          {isListening ? '🛑 Stop' : '🎤 Start Ordering'}
        </Text>
      </TouchableOpacity>
      
      <View style={styles.cartContainer}>
        <Text style={styles.cartTitle}>Current Cart:</Text>
        {cart.map((item, index) => (
          <Text key={index} style={styles.cartItem}>
            {item.name} - Qty: {item.quantity} - ₹{item.price}
          </Text>
        ))}
      </View>
    </View>
  );
};

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
    marginBottom: 30
  },
  transcriptContainer: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15
  },
  responseContainer: {
    backgroundColor: '#e3f2fd',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20
  },
  label: {
    fontWeight: 'bold',
    marginBottom: 5
  },
  transcript: {
    fontSize: 16,
    color: '#333'
  },
  response: {
    fontSize: 16,
    color: '#1976d2'
  },
  micButton: {
    backgroundColor: '#4caf50',
    padding: 20,
    borderRadius: 50,
    alignItems: 'center',
    marginBottom: 20
  },
  micButtonActive: {
    backgroundColor: '#f44336'
  },
  micButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold'
  },
  cartContainer: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10
  },
  cartTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10
  },
  cartItem: {
    fontSize: 14,
    marginBottom: 5,
    paddingLeft: 10
  }
});

export default VoiceOrderScreen;
```

## Deployment & Configuration

### 5.1 Environment Variables
```env
# n8n Configuration
N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook
N8N_API_KEY=your-n8n-api-key

# AI Services
OPENAI_API_KEY=your-openai-key
ELEVENLABS_API_KEY=your-elevenlabs-key
AZURE_SPEECH_KEY=your-azure-speech-key

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/dukaaon

# Notifications
WHATSAPP_API_KEY=your-whatsapp-api-key
SMTP_CONFIG=your-email-config
```

### 5.2 n8n Self-Hosting Setup
```bash
# Install n8n using Docker
docker run -it --rm \
  --name n8n \
  -p 5678:5678 \
  -e WEBHOOK_URL=https://your-domain.com/ \
  -v ~/.n8n:/home/node/.n8n \
  n8nio/n8n

# Or using npm
npm install n8n -g
n8n start
```

## Testing & Validation

### 6.1 Test Scenarios
1. **Basic Voice Ordering**
   - "I need 10 kg rice and 5 kg wheat"
   - "Add 2 bottles of oil to my cart"
   - "Remove the wheat from my order"

2. **Complex Orders**
   - "I want 5 kg basmati rice, 2 kg sugar, and 1 liter mustard oil"
   - "Change the rice quantity to 10 kg"
   - "What's in my cart right now?"

3. **Error Handling**
   - Product not found scenarios
   - Out of stock situations
   - Unclear voice input

### 6.2 Performance Metrics
- Speech recognition accuracy: >95%
- Product matching accuracy: >90%
- Response time: <3 seconds
- Order completion rate: >85%

## Future Enhancements

1. **Multi-language Support**
   - Hindi, Tamil, Telugu voice recognition
   - Regional language product names

2. **Advanced AI Features**
   - Predictive ordering based on history
   - Seasonal product recommendations
   - Bulk order optimization

3. **Integration Expansions**
   - WhatsApp Business API for ordering
   - Telegram bot integration
   - Voice calls through Twilio

4. **Analytics & Insights**
   - Order pattern analysis
   - Voice interaction analytics
   - Customer preference learning

## Cost Estimation

### Monthly Operational Costs
- **OpenAI API**: $50-200 (based on usage)
- **Speech Services**: $30-100
- **n8n Cloud**: $20-50 (or free if self-hosted)
- **Database Hosting**: $25-50
- **Total**: $125-400/month

## Conclusion

This AI stock ordering agent will revolutionize the ordering experience for Dukaaon users by providing:
- Natural voice interaction
- Intelligent product search
- Automated inventory management
- Seamless wholesaler communication
- Enhanced user experience

The implementation leverages modern AI technologies with n8n's powerful workflow automation to create a scalable, efficient, and user-friendly ordering system.