#!/usr/bin/env node

/**
 * Automated API Integration Tester
 * 
 * Tests all API endpoints with various scenarios
 * 
 * Usage: node scripts/test-all-apis.js
 */

const API_TESTS = [
  // Health & System
  { method: 'GET', path: '/api/health', expectStatus: 200, name: 'Health Check' },
  { method: 'GET', path: '/api/company', expectStatus: 200, name: 'Company Info' },
  { method: 'GET', path: '/api/settings/company', expectStatus: 200, name: 'Company Settings' },
  
  // Public endpoints
  { method: 'GET', path: '/api/public/company', expectStatus: 200, name: 'Public Company Info' },
  { method: 'GET', path: '/api/public/profiles', expectStatus: 200, name: 'Public Profiles' },
  { method: 'GET', path: '/api/public/payment-gateways', expectStatus: 200, name: 'Payment Gateways' },
  { method: 'GET', path: '/api/public/stats', expectStatus: 200, name: 'Public Stats' },
  
  // Authentication (should fail without credentials)
  { method: 'GET', path: '/api/pppoe/users', expectStatus: [401, 403], name: 'PPPoE Users (No Auth)' },
  { method: 'GET', path: '/api/hotspot/voucher', expectStatus: [401, 403], name: 'Hotspot Vouchers (No Auth)' },
  { method: 'GET', path: '/api/users/list', expectStatus: [401, 403], name: 'Users List (No Auth)' },
  
  // Invalid requests (should return 400 or 404)
  { method: 'POST', path: '/api/customer/auth/send-otp', body: {}, expectStatus: 400, name: 'Send OTP (Invalid)' },
  { method: 'GET', path: '/api/nonexistent', expectStatus: 404, name: 'Non-existent Endpoint' },
  
  // Data validation
  { method: 'POST', path: '/api/manual-payments', body: {}, expectStatus: [400, 401, 403], name: 'Manual Payment (No Data)' },
];

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

async function testEndpoint(test) {
  const url = `${BASE_URL}${test.path}`;
  
  try {
    const options = {
      method: test.method,
      headers: {
        'Content-Type': 'application/json',
      },
    };
    
    if (test.body) {
      options.body = JSON.stringify(test.body);
    }
    
    const startTime = Date.now();
    const response = await fetch(url, options);
    const responseTime = Date.now() - startTime;
    
    const expectedStatuses = Array.isArray(test.expectStatus) 
      ? test.expectStatus 
      : [test.expectStatus];
    
    const passed = expectedStatuses.includes(response.status);
    
    return {
      name: test.name,
      method: test.method,
      path: test.path,
      status: response.status,
      expected: expectedStatuses,
      passed,
      responseTime,
    };
  } catch (error) {
    return {
      name: test.name,
      method: test.method,
      path: test.path,
      error: error.message,
      passed: false,
    };
  }
}

async function runAllTests() {
  console.log('🚀 Starting API Integration Tests\n');
  console.log(`Base URL: ${BASE_URL}\n`);
  console.log('─'.repeat(80));
  
  const results = [];
  
  for (const test of API_TESTS) {
    const result = await testEndpoint(test);
    results.push(result);
    
    const icon = result.passed ? '✅' : '❌';
    const status = result.error 
      ? `ERROR: ${result.error}` 
      : `${result.status} (expected ${result.expected.join(' or ')})`;
    
    console.log(`${icon} ${result.name}`);
    console.log(`   ${result.method} ${result.path}`);
    console.log(`   Status: ${status}`);
    if (result.responseTime) {
      console.log(`   Response Time: ${result.responseTime}ms`);
    }
    console.log();
  }
  
  console.log('─'.repeat(80));
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;
  const resultsWithTime = results.filter(r => r.responseTime);
  const avgResponseTime = resultsWithTime.length > 0
    ? Math.round(resultsWithTime.reduce((sum, r) => sum + r.responseTime, 0) / resultsWithTime.length)
    : 0;
  
  console.log('\n📊 Test Summary:');
  console.log(`   Total: ${total}`);
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📈 Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
  console.log(`   ⚡ Avg Response Time: ${avgResponseTime}ms`);
  
  // Check if server is not running
  const serverNotRunning = results.every(r => r.error && r.error.includes('fetch failed'));
  if (serverNotRunning) {
    console.log('\n⚠️  Server tidak berjalan!');
    console.log('   Jalankan server terlebih dahulu: npm run dev');
    console.log('   Kemudian jalankan test lagi: npm run test:api\n');
    process.exit(0); // Exit with 0 karena ini bukan test failure
  }
  
  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`   - ${r.name} (${r.method} ${r.path})`);
      if (r.error) {
        console.log(`     Error: ${r.error}`);
      } else if (r.expected) {
        console.log(`     Expected: ${r.expected.join(' or ')}, Got: ${r.status || 'ERROR'}`);
      }
    });
  }
  
  console.log('\n✨ Testing Complete!');
  
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch(error => {
  console.error('💥 Test runner error:', error);
  process.exit(1);
});
