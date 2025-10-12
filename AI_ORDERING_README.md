# AI Stock Ordering System for Dukaaon

## Overview

The AI Stock Ordering System is an intelligent voice and text-enabled ordering solution that allows customers to place orders naturally using speech or text input. The system leverages AI to understand customer intent, search products, manage cart operations, and automatically notify wholesalers about new orders.

## 🎯 Key Features

### For Customers
- **Voice Ordering**: Speak naturally to place orders ("I need 5 kg rice and 2 liters oil")
- **Text Input**: Type orders when voice isn't convenient
- **Smart Product Search**: AI-powered fuzzy matching finds products even with variations
- **Real-time Cart Management**: Add, remove, or modify items with voice commands
- **Inventory Awareness**: Automatic detection of out-of-stock items
- **Order Confirmation**: Review and confirm orders before placement
- **Multi-language Support**: Supports English and Hindi (expandable)

### For Wholesalers
- **Instant Notifications**: WhatsApp and email alerts for new orders
- **Order Details**: Complete order summary with customer information
- **Quick Actions**: One-click order confirmation or modification
- **Analytics Dashboard**: Track popular products and order patterns

### Technical Features
- **n8n Workflow Automation**: Serverless order processing pipeline
- **AI-Powered NLP**: OpenAI GPT-4 for intent recognition and response generation
- **Fuzzy Product Matching**: PostgreSQL-based intelligent product search
- **Session Management**: Maintains conversation context across interactions
- **Error Handling**: Graceful handling of unclear input or system errors
- **Scalable Architecture**: Cloud-ready with horizontal scaling support

## 🏗️ System Architecture

```
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐
│   React Native  │    │     n8n      │    │   PostgreSQL    │
│   Voice Input   │◄──►│   Workflow   │◄──►│    Database     │
│   (Frontend)    │    │  Automation  │    │   (Products)    │
└─────────────────┘    └──────────────┘    └─────────────────┘
         │                       │                     │
         │                       ▼                     │
         │              ┌──────────────┐               │
         │              │   OpenAI     │               │
         │              │   GPT-4      │               │
         │              │   (NLP/AI)   │               │
         │              └──────────────┘               │
         │                       │                     │
         ▼                       ▼                     ▼
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐
│   Speech-to-    │    │  WhatsApp    │    │   Order         │
│   Text Service  │    │  Business    │    │   Management    │
│   (Azure/Google)│    │  API         │    │   System        │
└─────────────────┘    └──────────────┘    └─────────────────┘
```

## 📁 Project Structure

### Implementation Files

#### Documentation
- [`docs/AI_STOCK_ORDERING_AGENT_IMPLEMENTATION.md`](docs/AI_STOCK_ORDERING_AGENT_IMPLEMENTATION.md) - Complete technical implementation guide
- [`docs/AI_ORDERING_SETUP_GUIDE.md`](docs/AI_ORDERING_SETUP_GUIDE.md) - Step-by-step setup and deployment guide

#### Database
- [`sql/ai_ordering_system_setup.sql`](sql/ai_ordering_system_setup.sql) - Database schema and setup script

#### n8n Workflows
- [`n8n-workflows/ai-stock-ordering-workflow.json`](n8n-workflows/ai-stock-ordering-workflow.json) - Main ordering workflow configuration

#### Frontend Components
- [`app/(main)/ai-voice-order/index.tsx`](app/(main)/ai-voice-order/index.tsx) - React Native voice ordering interface

#### API Routes
- [`app/api/ai-voice-order/route.ts`](app/api/ai-voice-order/route.ts) - API endpoint for voice order processing

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 13+
- n8n instance (local or cloud)
- OpenAI API key
- WhatsApp Business API access

### 1. Database Setup
```bash
# Run the database setup script
psql -U your_username -d dukaaon_db -f sql/ai_ordering_system_setup.sql
```

### 2. n8n Configuration
```bash
# Install n8n
npm install n8n -g

# Start n8n
n8n start

# Import workflow at http://localhost:5678
# Upload: n8n-workflows/ai-stock-ordering-workflow.json
```

### 3. Environment Setup
```bash
# Add to your .env.local
N8N_WEBHOOK_URL=https://your-n8n-domain.com/webhook/voice-order
OPENAI_API_KEY=your_openai_api_key
DATABASE_URL=postgresql://user:password@host:port/dukaaon_db
```

### 4. Install Dependencies
```bash
# React Native voice dependencies
npm install @react-native-voice/voice expo-av expo-linear-gradient

# Database
npm install pg @types/pg
```

### 5. Test the System
```bash
# Test API endpoint
curl -X POST http://localhost:3000/api/ai-voice-order \
  -H "Content-Type: application/json" \
  -d '{"input": "I need 5 kg rice", "sessionId": "test-123"}'
```

## 🎮 Usage Examples

### Voice Commands

**Adding Products:**
- "I need 5 kg rice"
- "Add 2 liters oil to my cart"
- "I want 1 kg sugar and 500 grams salt"

**Cart Management:**
- "What's in my cart?"
- "Remove rice from my order"
- "Change oil quantity to 3 liters"
- "Clear my cart"

**Order Operations:**
- "Confirm my order"
- "Place the order"
- "I'm ready to checkout"

**Information Queries:**
- "Do you have basmati rice?"
- "What's the price of cooking oil?"
- "Show me available products"

### Text Input
All voice commands also work as text input for situations where voice isn't convenient.

## 🔧 Configuration

### Speech Recognition
```typescript
// Configure in app.config.js
speechRecognition: {
  provider: 'native', // 'native', 'azure', 'google'
  language: 'en-IN',
  timeout: 10000,
  partialResults: true
}
```

### AI Model Settings
```json
// n8n OpenAI node configuration
{
  "model": "gpt-4",
  "temperature": 0.3,
  "max_tokens": 500,
  "system_prompt": "You are a helpful ordering assistant..."
}
```

### Product Search
```sql
-- Adjust similarity threshold in database
SELECT * FROM search_products_fuzzy('rice', 5, 0.3); -- 0.3 = 30% similarity
```

## 📊 Analytics and Monitoring

### Key Metrics
- **Order Completion Rate**: Percentage of started orders that are completed
- **Speech Recognition Accuracy**: Success rate of voice-to-text conversion
- **Product Match Rate**: How often products are found vs. not found
- **Average Order Value**: Mean value of AI-placed orders
- **Response Time**: Time from voice input to AI response

### Monitoring Dashboard
Access analytics through the database views:
```sql
-- Order analytics
SELECT * FROM ai_order_analytics;

-- Popular products
SELECT * FROM popular_products_view;

-- Session statistics
SELECT 
  DATE(created_at) as date,
  COUNT(*) as sessions,
  AVG(EXTRACT(EPOCH FROM (last_activity - created_at))) as avg_duration
FROM ai_sessions 
GROUP BY DATE(created_at);
```

## 🔒 Security Features

- **Input Validation**: All voice and text inputs are sanitized
- **Rate Limiting**: Prevents abuse of the API endpoints
- **Session Management**: Secure session handling with automatic cleanup
- **Data Encryption**: Voice data encrypted in transit
- **No Voice Storage**: Voice recordings are not stored permanently
- **API Authentication**: Secure API keys for all external services

## 🌐 Scalability

### Horizontal Scaling
- **n8n Clustering**: Multiple n8n instances with load balancing
- **Database Sharding**: Partition data across multiple databases
- **CDN Integration**: Cache static responses and product data
- **Queue System**: Redis-based queue for high-volume processing

### Performance Optimization
- **Database Indexing**: Optimized indexes for product search
- **Caching Layer**: Redis cache for frequent queries
- **Connection Pooling**: Efficient database connection management
- **Lazy Loading**: Load product data on demand

## 🔮 Future Enhancements

### Planned Features
- **Multi-language Support**: Hindi, Tamil, Telugu voice recognition
- **Visual Product Search**: Image-based product identification
- **Predictive Ordering**: AI suggests products based on history
- **Voice Biometrics**: Customer identification through voice
- **Offline Mode**: Basic ordering when internet is unavailable
- **Integration Expansion**: Connect with more wholesaler systems

### Advanced AI Features
- **Sentiment Analysis**: Detect customer satisfaction in voice
- **Personalization**: Tailored product recommendations
- **Conversation Memory**: Remember preferences across sessions
- **Multi-turn Conversations**: Handle complex, multi-step orders

## 🐛 Troubleshooting

### Common Issues

**Speech Recognition Not Working**
```bash
# Check permissions
# Android: RECORD_AUDIO permission
# iOS: NSMicrophoneUsageDescription in Info.plist
```

**n8n Workflow Failures**
```bash
# Check n8n logs
docker logs n8n

# Test individual nodes
# Use n8n's test execution feature
```

**Poor Product Matching**
```sql
-- Update product keywords
UPDATE products SET 
  search_keywords = search_keywords || ', new_keyword'
WHERE id = product_id;

-- Rebuild search index
REINDEX INDEX idx_products_search;
```

### Debug Commands
```bash
# Test API health
curl -X GET http://localhost:3000/api/ai-voice-order

# Check database connection
psql -U user -d dukaaon_db -c "SELECT COUNT(*) FROM products;"

# Verify n8n webhook
curl -X POST https://your-n8n-domain.com/webhook/voice-order \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

## 💰 Cost Estimation

### Monthly Costs (1000 orders)
- **OpenAI API**: ~$50-100 (depending on usage)
- **n8n Cloud**: $20-50 (or free if self-hosted)
- **Speech Recognition**: $10-30 (Azure/Google)
- **WhatsApp Business API**: $5-15
- **Database Hosting**: $20-50
- **Total**: ~$105-245/month

### Cost Optimization
- Use device-native speech recognition when possible
- Implement caching to reduce API calls
- Optimize AI prompts to reduce token usage
- Use n8n self-hosting for smaller volumes

## 📞 Support

### Documentation
- [Complete Implementation Guide](docs/AI_STOCK_ORDERING_AGENT_IMPLEMENTATION.md)
- [Setup and Deployment Guide](docs/AI_ORDERING_SETUP_GUIDE.md)

### External Resources
- [n8n Documentation](https://docs.n8n.io/)
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [React Native Voice](https://github.com/react-native-voice/voice)
- [PostgreSQL Full-Text Search](https://www.postgresql.org/docs/current/textsearch.html)

### Getting Help
For technical support or feature requests:
1. Check the troubleshooting section above
2. Review the implementation documentation
3. Test individual components in isolation
4. Contact the development team with specific error messages

---

## 🎉 Conclusion

The AI Stock Ordering System represents a significant advancement in e-commerce ordering technology, providing customers with a natural, intuitive way to place orders while automating the entire fulfillment pipeline. The system is designed to be production-ready, scalable, and easily maintainable.

**Key Benefits:**
- 🚀 **Improved User Experience**: Natural voice and text ordering
- ⚡ **Increased Efficiency**: Automated order processing and notifications
- 📈 **Better Analytics**: Detailed insights into ordering patterns
- 🔧 **Easy Maintenance**: Modular architecture with clear separation of concerns
- 💰 **Cost Effective**: Optimized for minimal operational costs

Start with the [Setup Guide](docs/AI_ORDERING_SETUP_GUIDE.md) to begin implementation, or refer to the [Technical Implementation](docs/AI_STOCK_ORDERING_AGENT_IMPLEMENTATION.md) for detailed architecture information.

**Happy Ordering! 🛒🎤**