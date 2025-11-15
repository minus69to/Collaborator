/**
 * Test script for chat messages API endpoints
 * 
 * Usage:
 * 1. Start your Next.js dev server: npm run dev
 * 2. Make sure you're logged in and have a meeting ID
 * 3. Run this script with: node scripts/test-messages-api.js <meetingId> <sessionToken>
 * 
 * Or use the manual testing instructions in TEST_INSTRUCTIONS.md
 */

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const MEETING_ID = process.argv[2];
const SESSION_TOKEN = process.argv[3]; // Get from browser localStorage.getItem('sb-auth-token') or cookies

if (!MEETING_ID) {
  console.error('❌ Error: Meeting ID is required');
  console.log('\nUsage: node scripts/test-messages-api.js <meetingId> [sessionToken]');
  console.log('\nTo get your session token:');
  console.log('1. Open browser DevTools -> Application -> Cookies');
  console.log('2. Find the Supabase auth token cookie');
  console.log('3. Or check localStorage for Supabase session');
  process.exit(1);
}

async function testGetMessages(meetingId) {
  console.log('\n📥 Testing GET /api/messages?meetingId=' + meetingId);
  
  try {
    const url = `${BASE_URL}/api/messages?meetingId=${meetingId}`;
    const headers = {};
    
    if (SESSION_TOKEN) {
      headers['Cookie'] = `sb-auth-token=${SESSION_TOKEN}`;
      headers['Authorization'] = `Bearer ${SESSION_TOKEN}`;
    }
    
    const response = await fetch(url, {
      method: 'GET',
      headers,
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ GET Messages: Success');
      console.log(`   Messages count: ${data.messages?.length || 0}`);
      if (data.messages && data.messages.length > 0) {
        console.log(`   Latest message: "${data.messages[data.messages.length - 1].message.substring(0, 50)}..."`);
      }
      return data;
    } else {
      console.log('❌ GET Messages: Failed');
      console.log(`   Status: ${response.status}`);
      console.log(`   Error: ${JSON.stringify(data, null, 2)}`);
      return null;
    }
  } catch (error) {
    console.log('❌ GET Messages: Error');
    console.log(`   ${error.message}`);
    return null;
  }
}

async function testPostMessage(meetingId, displayName = 'Test User') {
  console.log('\n📤 Testing POST /api/messages');
  
  try {
    const testMessage = `Test message at ${new Date().toISOString()}`;
    const url = `${BASE_URL}/api/messages`;
    const headers = {
      'Content-Type': 'application/json',
    };
    
    if (SESSION_TOKEN) {
      headers['Cookie'] = `sb-auth-token=${SESSION_TOKEN}`;
      headers['Authorization'] = `Bearer ${SESSION_TOKEN}`;
    }
    
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        meetingId,
        message: testMessage,
        displayName,
      }),
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ POST Message: Success');
      console.log(`   Message ID: ${data.message?.id}`);
      console.log(`   Message: "${data.message?.message}"`);
      return data.message;
    } else {
      console.log('❌ POST Message: Failed');
      console.log(`   Status: ${response.status}`);
      console.log(`   Error: ${JSON.stringify(data, null, 2)}`);
      return null;
    }
  } catch (error) {
    console.log('❌ POST Message: Error');
    console.log(`   ${error.message}`);
    return null;
  }
}

async function testValidationErrors(meetingId) {
  console.log('\n🔍 Testing validation errors...');
  
  // Test empty message
  console.log('\n   Testing: Empty message');
  try {
    const response = await fetch(`${BASE_URL}/api/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        meetingId,
        message: '',
        displayName: 'Test User',
      }),
    });
    const data = await response.json();
    if (response.status === 400) {
      console.log('   ✅ Correctly rejected empty message');
    } else {
      console.log('   ⚠️  Unexpected response:', response.status);
    }
  } catch (error) {
    console.log('   ❌ Error:', error.message);
  }
  
  // Test missing meetingId
  console.log('\n   Testing: Missing meetingId');
  try {
    const response = await fetch(`${BASE_URL}/api/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Test',
        displayName: 'Test User',
      }),
    });
    const data = await response.json();
    if (response.status === 400) {
      console.log('   ✅ Correctly rejected missing meetingId');
    } else {
      console.log('   ⚠️  Unexpected response:', response.status);
    }
  } catch (error) {
    console.log('   ❌ Error:', error.message);
  }
}

async function runTests() {
  console.log('🧪 Testing Chat Messages API');
  console.log('=' .repeat(50));
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Meeting ID: ${MEETING_ID}`);
  
  // Test GET messages (should work even if empty)
  await testGetMessages(MEETING_ID);
  
  // Test POST message
  const newMessage = await testPostMessage(MEETING_ID, 'API Tester');
  
  // Wait a bit, then test GET again to see the new message
  if (newMessage) {
    console.log('\n⏳ Waiting 1 second...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    await testGetMessages(MEETING_ID);
  }
  
  // Test validation errors (without auth, will fail but that's expected)
  // await testValidationErrors(MEETING_ID);
  
  console.log('\n' + '='.repeat(50));
  console.log('✅ Tests completed!');
  console.log('\n💡 Note: If you see authentication errors, make sure you:');
  console.log('   1. Are logged in to the app');
  console.log('   2. Have the correct session token');
  console.log('   3. The meeting ID exists and you have access to it');
}

runTests().catch(console.error);

