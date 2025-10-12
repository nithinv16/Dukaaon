// Test script to verify listSellers method functionality
import { BedrockAIService } from './services/aiAgent/bedrockAIService.ts';

async function testListSellers() {
  console.log('Testing listSellers method...');
  
  const aiService = new BedrockAIService();
  
  try {
    // Test 1: List all sellers
    console.log('\n=== Test 1: List all sellers ===');
    const allSellers = await aiService.listSellers({});
    console.log('All sellers result:', JSON.stringify(allSellers, null, 2));
    
    // Test 2: List sellers by role
    console.log('\n=== Test 2: List sellers by role (seller) ===');
    const sellersByRole = await aiService.listSellers({ role: 'seller' });
    console.log('Sellers by role result:', JSON.stringify(sellersByRole, null, 2));
    
    // Test 3: List sellers by category
    console.log('\n=== Test 3: List sellers by category (electronics) ===');
    const sellersByCategory = await aiService.listSellers({ category: 'electronics' });
    console.log('Sellers by category result:', JSON.stringify(sellersByCategory, null, 2));
    
    // Test 4: List sellers by location
    console.log('\n=== Test 4: List sellers by location (Mumbai) ===');
    const sellersByLocation = await aiService.listSellers({ location: 'Mumbai' });
    console.log('Sellers by location result:', JSON.stringify(sellersByLocation, null, 2));
    
    // Test 5: Test with limit
    console.log('\n=== Test 5: List sellers with limit (5) ===');
    const sellersWithLimit = await aiService.listSellers({ limit: 5 });
    console.log('Sellers with limit result:', JSON.stringify(sellersWithLimit, null, 2));
    
  } catch (error) {
    console.error('Error testing listSellers:', error);
    console.error('Error stack:', error.stack);
  }
}

// Run the test
testListSellers().then(() => {
  console.log('\nTest completed');
  process.exit(0);
}).catch((error) => {
  console.error('Test failed:', error);
  process.exit(1);
});