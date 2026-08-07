# AI Stock Ordering System - Setup Guide

This guide will walk you through setting up the complete AI stock ordering system for Dukaaon, including n8n workflow automation, database configuration, and React Native integration.

## Prerequisites

### Required Services
- **PostgreSQL Database** (for product catalog and orders)
- **n8n Instance** (workflow automation)
- **OpenAI API** (for natural language processing)
- **Speech Recognition Service** (Azure Speech, Google Speech-to-Text, or device native)
- **WhatsApp Business API** (for wholesaler notifications)

### Required Packages
```bash
# React Native dependencies
npm install @react-native-voice/voice expo-av expo-linear-gradient

# Database
npm install pg @types/pg

# Optional: Text-to-Speech
npm install expo-speech
```

## Step 1: Database Setup

### 1.1 Run Database Migration
```bash
# Connect to your PostgreSQL database
psql -U your_username -d dukaaon_db

# Run the setup script
\i sql/ai_ordering_system_setup.sql
```

### 1.2 Verify Database Setup
```sql
-- Check if tables are created
\dt ai_*

-- Check sample products
SELECT COUNT(*) FROM products;

-- Test fuzzy search function
SELECT * FROM search_products_fuzzy('rice', 5);
```

## Step 2: n8n Setup

### 2.1 Install n8n

**Option A: Docker (Recommended)**
```bash
# Create n8n directory
mkdir n8n-data
cd n8n-data

# Run n8n with Docker
docker run -it --rm \
  --name n8n \
  -p 5678:5678 \
  -e WEBHOOK_URL=https://your-domain.com/ \
  -e N8N_BASIC_AUTH_ACTIVE=true \
  -e N8N_BASIC_AUTH_USER=admin \
  -e N8N_BASIC_AUTH_PASSWORD=your_secure_password \
  -v $(pwd):/home/node/.n8n \
  n8nio/n8n
```

**Option B: npm**
```bash
npm install n8n -g
n8n start
```

### 2.2 Configure n8n Environment

Create `.env` file in your n8n directory:
```env
# n8n Configuration
N8N_BASIC_AUTH_ACTIVE=true
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=your_secure_password
WEBHOOK_URL=https://your-n8n-domain.com/
N8N_HOST=0.0.0.0
N8N_PORT=5678
N8N_PROTOCOL=https

# Database Connection
DB_POSTGRESDB_HOST=your_db_host
DB_POSTGRESDB_PORT=5432
DB_POSTGRESDB_DATABASE=dukaaon_db
DB_POSTGRESDB_USER=your_db_user
DB_POSTGRESDB_PASSWORD=your_db_password

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key

# WhatsApp Configuration
WHATSAPP_API_KEY=your_whatsapp_api_key
WHATSAPP_PHONE_NUMBER=+918089668552
```

### 2.3 Import Workflow

1. Access n8n at `http://localhost:5678`
2. Login with your credentials
3. Click "Import from file"
4. Upload `n8n-workflows/ai-stock-ordering-workflow.json`
5. Configure the following nodes:

**PostgreSQL Node:**
- Host: Your database host
- Database: dukaaon_db
- User: Your database user
- Password: Your database password

**OpenAI Node:**
- API Key: Your OpenAI API key
- Model: gpt-4 (recommended) or gpt-3.5-turbo

**WhatsApp Node:**
- Configure your WhatsApp Business API credentials

### 2.4 Test Workflow

1. Activate the workflow
2. Note the webhook URL (e.g., `https://your-n8n-domain.com/webhook/voice-order`)
3. Test with curl:

```bash
curl -X POST https://your-n8n-domain.com/webhook/voice-order \
  -H "Content-Type: application/json" \
  -d '{
    "input": "I need 5 kg rice and 2 liters oil",
    "sessionId": "test-session-123",
    "currentOrder": {"items": [], "total": 0}
  }'
```

## Step 3: Dukaaon App Configuration

### 3.1 Environment Variables

Add to your `.env.local` file:
```env
# AI Ordering Configuration
N8N_WEBHOOK_URL=https://your-n8n-domain.com/webhook/voice-order
N8N_API_KEY=your_n8n_api_key_if_required

# OpenAI (if using direct integration)
OPENAI_API_KEY=your_openai_api_key

# Speech Services (optional)
AZURE_SPEECH_KEY=your_azure_speech_key
AZURE_SPEECH_REGION=your_azure_region
GOOGLE_SPEECH_API_KEY=your_google_speech_key

# Database
DATABASE_URL=postgresql://user:password@host:port/dukaaon_db
```

### 3.2 Update App Configuration

Add to `app.config.js`:
```javascript
export default {
  expo: {
    // ... existing configuration
    extra: {
      // ... existing extra config
      aiOrdering: {
        enabled: true,
        n8nWebhookUrl: process.env.N8N_WEBHOOK_URL,
        speechRecognition: {
          provider: 'native', // 'native', 'azure', 'google'
          language: 'en-IN'
        }
      }
    }
  }
};
```

### 3.3 Add Navigation Route

Update your navigation to include the AI voice ordering screen:

```typescript
// In your main navigation file
import AIVoiceOrderScreen from '../(main)/ai-voice-order';

// Add to your stack navigator
<Stack.Screen 
  name="ai-voice-order" 
  component={AIVoiceOrderScreen}
  options={{
    title: "AI Voice Ordering",
    headerShown: false
  }}
/>
```

### 3.4 Add Menu Item

Add a menu item to access AI ordering:

```typescript
// In your main menu component
<TouchableOpacity 
  style={styles.menuItem}
  onPress={() => router.push('/(main)/ai-voice-order')}
>
  <Ionicons name="mic" size={24} color="#667eea" />
  <Text style={styles.menuText}>AI Voice Ordering</Text>
  <Text style={styles.menuSubtext}>Order by speaking</Text>
</TouchableOpacity>
```

## Step 4: Permissions Setup

### 4.1 Android Permissions

Add to `android/app/src/main/AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

### 4.2 iOS Permissions

Add to `ios/YourApp/Info.plist`:
```xml
<key>NSMicrophoneUsageDescription</key>
<string>This app needs access to microphone for voice ordering</string>
<key>NSSpeechRecognitionUsageDescription</key>
<string>This app needs speech recognition for voice ordering</string>
```

## Step 5: Testing

### 5.1 Unit Tests

Create test file `__tests__/ai-voice-order.test.ts`:
```typescript
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import AIVoiceOrderScreen from '../app/(main)/ai-voice-order';

describe('AI Voice Order Screen', () => {
  it('renders correctly', () => {
    const { getByText } = render(<AIVoiceOrderScreen />);
    expect(getByText('AI Voice Ordering')).toBeTruthy();
  });

  it('starts listening when mic button is pressed', async () => {
    const { getByTestId } = render(<AIVoiceOrderScreen />);
    const micButton = getByTestId('mic-button');
    
    fireEvent.press(micButton);
    
    await waitFor(() => {
      expect(getByTestId('listening-indicator')).toBeTruthy();
    });
  });
});
```

### 5.2 Integration Tests

```bash
# Test API endpoint
curl -X GET http://localhost:3000/api/ai-voice-order

# Test voice order processing
curl -X POST http://localhost:3000/api/ai-voice-order \
  -H "Content-Type: application/json" \
  -d '{
    "input": "I want 10 kg rice",
    "sessionId": "test-123",
    "currentOrder": {"items": [], "total": 0}
  }'
```

### 5.3 Manual Testing Scenarios

1. **Basic Voice Ordering**
   - "I need 5 kg rice"
   - "Add 2 liters oil to my cart"
   - "I want 1 kg sugar and 500g salt"

2. **Cart Management**
   - "What's in my cart?"
   - "Remove rice from my order"
   - "Change oil quantity to 3 liters"

3. **Order Confirmation**
   - "Confirm my order"
   - "Place the order"
   - "I'm ready to checkout"

4. **Error Handling**
   - Unclear speech input
   - Non-existent products
   - Out of stock items

## Step 6: Production Deployment

### 6.1 n8n Production Setup

**Using Docker Compose:**
```yaml
# docker-compose.yml
version: '3.8'
services:
  n8n:
    image: n8nio/n8n
    restart: always
    ports:
      - "5678:5678"
    environment:
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=${N8N_USER}
      - N8N_BASIC_AUTH_PASSWORD=${N8N_PASSWORD}
      - WEBHOOK_URL=${WEBHOOK_URL}
      - GENERIC_TIMEZONE=${TIMEZONE}
    volumes:
      - n8n_data:/home/node/.n8n
    depends_on:
      - postgres

  postgres:
    image: postgres:13
    restart: always
    environment:
      - POSTGRES_DB=${POSTGRES_DB}
      - POSTGRES_USER=${POSTGRES_USER}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  n8n_data:
  postgres_data:
```

### 6.2 SSL Configuration

For production, ensure SSL is configured:
```nginx
# nginx configuration
server {
    listen 443 ssl;
    server_name your-n8n-domain.com;
    
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    
    location / {
        proxy_pass http://localhost:5678;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 6.3 Monitoring

Set up monitoring for:
- n8n workflow execution status
- API response times
- Database performance
- Speech recognition accuracy
- Order completion rates

## Step 7: Optimization

### 7.1 Performance Optimization

1. **Database Indexing**
   ```sql
   -- Additional indexes for better performance
   CREATE INDEX CONCURRENTLY idx_products_search 
   ON products USING gin(to_tsvector('english', name || ' ' || coalesce(description, '')));
   ```

2. **Caching**
   - Implement Redis for session caching
   - Cache frequently searched products
   - Cache AI responses for common queries

3. **Speech Recognition**
   - Use device-native speech recognition when possible
   - Implement fallback to cloud services
   - Optimize audio quality settings

### 7.2 Scalability

1. **n8n Scaling**
   - Use n8n cloud for automatic scaling
   - Implement queue-based processing for high volume
   - Set up multiple n8n instances with load balancing

2. **Database Scaling**
   - Implement read replicas
   - Partition large tables
   - Use connection pooling

## Troubleshooting

### Common Issues

1. **Speech Recognition Not Working**
   - Check microphone permissions
   - Verify device compatibility
   - Test with different speech recognition providers

2. **n8n Workflow Failures**
   - Check n8n logs: `docker logs n8n`
   - Verify database connections
   - Test individual nodes

3. **API Timeouts**
   - Increase timeout values
   - Optimize database queries
   - Check network connectivity

4. **Poor Product Matching**
   - Update product keywords
   - Adjust similarity thresholds
   - Train with more product variations

### Debug Commands

```bash
# Check n8n status
curl -X GET https://your-n8n-domain.com/healthz

# Test database connection
psql -U user -d dukaaon_db -c "SELECT 1;"

# Check API health
curl -X GET http://localhost:3000/api/ai-voice-order

# View n8n logs
docker logs -f n8n
```

## Security Considerations

1. **API Security**
   - Implement rate limiting
   - Use API keys for authentication
   - Validate all inputs
   - Sanitize speech-to-text output

2. **Data Privacy**
   - Encrypt voice data in transit
   - Don't store voice recordings
   - Implement session expiration
   - Follow GDPR/privacy regulations

3. **n8n Security**
   - Use strong authentication
   - Enable HTTPS
   - Regularly update n8n
   - Restrict network access

## Support and Maintenance

### Regular Maintenance Tasks

1. **Weekly**
   - Monitor order completion rates
   - Check speech recognition accuracy
   - Review error logs

2. **Monthly**
   - Update product keywords
   - Optimize database performance
   - Review and update AI prompts

3. **Quarterly**
   - Update dependencies
   - Performance testing
   - Security audit

### Getting Help

- **n8n Documentation**: https://docs.n8n.io/
- **OpenAI API Docs**: https://platform.openai.com/docs
- **React Native Voice**: https://github.com/react-native-voice/voice
- **Expo Audio**: https://docs.expo.dev/versions/latest/sdk/audio/

---

## Conclusion

This AI stock ordering system provides a modern, voice-enabled ordering experience for your customers while automating the entire workflow from speech recognition to wholesaler notification. The system is designed to be scalable, maintainable, and easily extensible for future enhancements.

For additional support or customization, refer to the individual component documentation or contact the development team.