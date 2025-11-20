/**
 * Manual test script for API routes
 * Run this after starting the dev server: npm run dev
 * Then execute: npx tsx scripts/test-api-routes.ts
 */

const BASE_URL = 'http://localhost:3000';

interface TestResult {
  endpoint: string;
  method: string;
  status: 'PASS' | 'FAIL';
  statusCode?: number;
  error?: string;
  data?: any;
}

const results: TestResult[] = [];

async function testSellersEndpoint() {
  console.log('\n🧪 Testing GET /api/sellers...');
  
  try {
    // Test with Mumbai coordinates
    const response = await fetch(
      `${BASE_URL}/api/sellers?latitude=19.0760&longitude=72.8777&radius=100&page=1&limit=10`
    );
    
    const data = await response.json();
    
    if (response.ok && data.success) {
      console.log('✅ Sellers endpoint working');
      console.log(`   Found ${data.data.totalCount} sellers within 100km`);
      console.log(`   Returned ${data.data.count} sellers on page ${data.data.page}`);
      
      results.push({
        endpoint: '/api/sellers',
        method: 'GET',
        status: 'PASS',
        statusCode: response.status,
        data: {
          totalCount: data.data.totalCount,
          count: data.data.count,
        },
      });
    } else {
      throw new Error(data.error || 'Unknown error');
    }
  } catch (error) {
    console.log('❌ Sellers endpoint failed');
    console.error('   Error:', error);
    
    results.push({
      endpoint: '/api/sellers',
      method: 'GET',
      status: 'FAIL',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function testSellersValidation() {
  console.log('\n🧪 Testing GET /api/sellers validation...');
  
  try {
    // Test without required parameters
    const response = await fetch(`${BASE_URL}/api/sellers`);
    const data = await response.json();
    
    if (response.status === 400 && !data.success) {
      console.log('✅ Validation working correctly');
      console.log(`   Error message: ${data.error}`);
      
      results.push({
        endpoint: '/api/sellers (validation)',
        method: 'GET',
        status: 'PASS',
        statusCode: response.status,
      });
    } else {
      throw new Error('Expected validation error but got success');
    }
  } catch (error) {
    console.log('❌ Validation test failed');
    console.error('   Error:', error);
    
    results.push({
      endpoint: '/api/sellers (validation)',
      method: 'GET',
      status: 'FAIL',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function testEnquiryEndpoint() {
  console.log('\n🧪 Testing POST /api/enquiry...');
  
  try {
    const testData = {
      visitorName: 'Test User',
      email: 'test@example.com',
      phone: '+91-9876543210',
      location: 'Mumbai, Maharashtra',
      message: 'This is a test enquiry message for API testing purposes.',
      enquiryType: 'general',
    };
    
    const response = await fetch(`${BASE_URL}/api/enquiry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData),
    });
    
    const data = await response.json();
    
    if (response.ok && data.success) {
      console.log('✅ Enquiry endpoint working');
      console.log(`   Enquiry ID: ${data.data.enquiryId}`);
      
      results.push({
        endpoint: '/api/enquiry',
        method: 'POST',
        status: 'PASS',
        statusCode: response.status,
        data: {
          enquiryId: data.data.enquiryId,
        },
      });
    } else {
      throw new Error(data.error || 'Unknown error');
    }
  } catch (error) {
    console.log('❌ Enquiry endpoint failed');
    console.error('   Error:', error);
    
    results.push({
      endpoint: '/api/enquiry',
      method: 'POST',
      status: 'FAIL',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function testEnquiryValidation() {
  console.log('\n🧪 Testing POST /api/enquiry validation...');
  
  try {
    // Test with invalid data
    const invalidData = {
      visitorName: 'T', // Too short
      email: 'invalid-email', // Invalid format
      phone: '123', // Invalid phone
      location: 'M', // Too short
      message: 'Short', // Too short
      enquiryType: 'general',
    };
    
    const response = await fetch(`${BASE_URL}/api/enquiry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(invalidData),
    });
    
    const data = await response.json();
    
    if (response.status === 400 && !data.success && data.errors) {
      console.log('✅ Validation working correctly');
      console.log(`   Found ${data.errors.length} validation errors`);
      
      results.push({
        endpoint: '/api/enquiry (validation)',
        method: 'POST',
        status: 'PASS',
        statusCode: response.status,
      });
    } else {
      throw new Error('Expected validation errors but got success');
    }
  } catch (error) {
    console.log('❌ Validation test failed');
    console.error('   Error:', error);
    
    results.push({
      endpoint: '/api/enquiry (validation)',
      method: 'POST',
      status: 'FAIL',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function testGeolocationEndpoint() {
  console.log('\n🧪 Testing GET /api/geolocation...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/geolocation`);
    const data = await response.json();
    
    if (response.ok && data.success && data.data) {
      console.log('✅ Geolocation endpoint working');
      console.log(`   Location: ${data.data.city}, ${data.data.state}`);
      console.log(`   Coordinates: ${data.data.latitude}, ${data.data.longitude}`);
      
      results.push({
        endpoint: '/api/geolocation',
        method: 'GET',
        status: 'PASS',
        statusCode: response.status,
        data: {
          city: data.data.city,
          state: data.data.state,
        },
      });
    } else {
      throw new Error(data.error || 'Unknown error');
    }
  } catch (error) {
    console.log('❌ Geolocation endpoint failed');
    console.error('   Error:', error);
    
    results.push({
      endpoint: '/api/geolocation',
      method: 'GET',
      status: 'FAIL',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function runTests() {
  console.log('🚀 Starting API Routes Tests');
  console.log('================================');
  console.log(`Base URL: ${BASE_URL}`);
  console.log('Make sure the dev server is running: npm run dev\n');
  
  // Run all tests
  await testSellersEndpoint();
  await testSellersValidation();
  await testEnquiryEndpoint();
  await testEnquiryValidation();
  await testGeolocationEndpoint();
  
  // Print summary
  console.log('\n================================');
  console.log('📊 Test Summary');
  console.log('================================\n');
  
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  
  results.forEach(result => {
    const icon = result.status === 'PASS' ? '✅' : '❌';
    console.log(`${icon} ${result.method} ${result.endpoint} - ${result.status}`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });
  
  console.log(`\nTotal: ${results.length} tests`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed!');
  } else {
    console.log('\n⚠️  Some tests failed. Please check the errors above.');
  }
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error running tests:', error);
  process.exit(1);
});
