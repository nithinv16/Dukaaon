/**
 * Webhook Testing Script
 * This script helps test your Azure Logic App webhook endpoint
 */

const https = require('https');
const http = require('http');

// Test data that mimics Supabase webhook payload
const testPayload = {
  type: 'INSERT',
  table: 'orders',
  record: {
    id: 'test-order-' + Date.now(),
    user_id: 'test-user-123',
    retailer_id: 'test-retailer-456',
    seller_id: 'test-seller-789',
    status: 'pending',
    total_amount: 125.50,
    is_ai_order: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  old_record: null,
  schema: 'public'
};

/**
 * Test Azure Logic App endpoint
 * @param {string} logicAppUrl - Your Azure Logic App webhook URL
 */
function testLogicApp(logicAppUrl) {
  console.log('🧪 Testing Azure Logic App webhook...');
  console.log('📍 URL:', logicAppUrl);
  console.log('📦 Payload:', JSON.stringify(testPayload, null, 2));
  
  const url = new URL(logicAppUrl);
  const isHttps = url.protocol === 'https:';
  const client = isHttps ? https : http;
  
  const postData = JSON.stringify(testPayload);
  
  const options = {
    hostname: url.hostname,
    port: url.port || (isHttps ? 443 : 80),
    path: url.pathname + url.search,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
      'User-Agent': 'Supabase-Webhook-Test/1.0'
    }
  };
  
  const req = client.request(options, (res) => {
    console.log('\n✅ Response received:');
    console.log('📊 Status Code:', res.statusCode);
    console.log('📋 Headers:', res.headers);
    
    let responseBody = '';
    res.on('data', (chunk) => {
      responseBody += chunk;
    });
    
    res.on('end', () => {
      console.log('📄 Response Body:', responseBody || '(empty)');
      
      if (res.statusCode >= 200 && res.statusCode < 300) {
        console.log('\n🎉 SUCCESS: Logic App webhook is working!');
      } else {
        console.log('\n❌ ERROR: Logic App returned error status');
      }
    });
  });
  
  req.on('error', (error) => {
    console.error('\n❌ REQUEST ERROR:', error.message);
    console.log('\n🔍 Troubleshooting tips:');
    console.log('1. Verify the Logic App URL is correct');
    console.log('2. Check if the Logic App is running');
    console.log('3. Ensure the URL includes all required parameters');
    console.log('4. Test with a simple HTTP client first');
  });
  
  req.on('timeout', () => {
    console.error('\n⏰ REQUEST TIMEOUT: Logic App took too long to respond');
    req.destroy();
  });
  
  // Set timeout to 30 seconds
  req.setTimeout(30000);
  
  // Send the request
  req.write(postData);
  req.end();
}

/**
 * Validate Logic App URL format
 * @param {string} url - URL to validate
 */
function validateLogicAppUrl(url) {
  console.log('🔍 Validating Logic App URL...');
  
  if (!url) {
    console.error('❌ ERROR: No URL provided');
    return false;
  }
  
  if (!url.startsWith('https://')) {
    console.error('❌ ERROR: Logic App URL must use HTTPS');
    return false;
  }
  
  if (!url.includes('logic.azure.com')) {
    console.error('❌ ERROR: URL does not appear to be an Azure Logic App');
    return false;
  }
  
  if (!url.includes('api-version=')) {
    console.error('❌ ERROR: URL missing api-version parameter');
    return false;
  }
  
  if (!url.includes('sig=')) {
    console.error('❌ ERROR: URL missing signature parameter');
    return false;
  }
  
  console.log('✅ URL format looks correct');
  return true;
}

/**
 * Main function
 */
function main() {
  console.log('🚀 Azure Logic App Webhook Tester');
  console.log('=' .repeat(50));
  
  // Get URL from command line argument or use the one from your screenshot
  const logicAppUrl = process.argv[2] || 
    'https://prod-04.eastus2.logic.azure.com/workflows/1673d89d087346db855b2a9eb4ce7053/triggers/When_a_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_a_HTTP_request_is_received%2Frun&sv=1.0&sig=YOUR_ACTUAL_SIGNATURE_HERE';
  
  if (!validateLogicAppUrl(logicAppUrl)) {
    console.log('\n📝 Usage:');
    console.log('node test-webhook.js "<your-logic-app-url>"');
    console.log('\n💡 Get your Logic App URL from:');
    console.log('Azure Portal → Logic Apps → Your App → HTTP Trigger → Copy URL');
    return;
  }
  
  testLogicApp(logicAppUrl);
}

// Run the test
if (require.main === module) {
  main();
}

module.exports = { testLogicApp, validateLogicAppUrl };