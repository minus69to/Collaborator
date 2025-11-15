# Testing Chat Messages API

## Prerequisites
1. ✅ Run the SQL migration in Supabase:
   ```sql
   -- Execute the contents of scripts/create_chat_messages.sql
   ```
2. ✅ Start your Next.js dev server: `npm run dev`
3. ✅ Make sure you're logged in and have a meeting ID

## Method 1: Browser Console Testing (Recommended)

### Step 1: Get a Meeting ID
1. Navigate to `/meetings` or `/dashboard`
2. Create a meeting or use an existing meeting ID

### Step 2: Open Browser DevTools Console
1. Open your browser's Developer Tools (F12)
2. Go to the Console tab
3. Make sure you're on a page where you're authenticated (e.g., `/meetings`)

### Step 3: Test GET Messages
```javascript
// Replace MEETING_ID with your actual meeting ID
const meetingId = 'YOUR_MEETING_ID_HERE';

// Fetch messages
fetch(`/api/messages?meetingId=${meetingId}`)
  .then(res => res.json())
  .then(data => {
    console.log('✅ Messages:', data);
    console.log('Count:', data.messages?.length || 0);
  })
  .catch(err => console.error('❌ Error:', err));
```

### Step 4: Test POST Message
```javascript
// Send a test message
fetch('/api/messages', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    meetingId: meetingId,
    message: 'Hello from browser console!',
    displayName: 'Test User',
  }),
})
  .then(res => res.json())
  .then(data => {
    console.log('✅ Message sent:', data);
  })
  .catch(err => console.error('❌ Error:', err));
```

### Step 5: Verify the Message
Run the GET request again to see your new message:
```javascript
fetch(`/api/messages?meetingId=${meetingId}`)
  .then(res => res.json())
  .then(data => {
    console.log('✅ All messages:', data.messages);
  });
```

## Method 2: Using the Test Script

```bash
# Run the test script (requires Node.js)
node scripts/test-messages-api.js <MEETING_ID> [SESSION_TOKEN]
```

Note: The session token is optional if you're testing locally, but may be needed for authentication.

## Method 3: Using curl (Command Line)

### GET Messages
```bash
curl -X GET "http://localhost:3000/api/messages?meetingId=YOUR_MEETING_ID" \
  -H "Cookie: YOUR_SUPABASE_SESSION_COOKIE"
```

### POST Message
```bash
curl -X POST "http://localhost:3000/api/messages" \
  -H "Content-Type: application/json" \
  -H "Cookie: YOUR_SUPABASE_SESSION_COOKIE" \
  -d '{
    "meetingId": "YOUR_MEETING_ID",
    "message": "Hello from curl!",
    "displayName": "Test User"
  }'
```

## Expected Results

### ✅ Success Response (GET)
```json
{
  "ok": true,
  "messages": [
    {
      "id": "uuid",
      "meeting_id": "uuid",
      "user_id": "uuid",
      "display_name": "Test User",
      "message": "Hello!",
      "created_at": "2024-01-01T12:00:00Z"
    }
  ]
}
```

### ✅ Success Response (POST)
```json
{
  "ok": true,
  "message": {
    "id": "uuid",
    "meeting_id": "uuid",
    "user_id": "uuid",
    "display_name": "Test User",
    "message": "Hello!",
    "created_at": "2024-01-01T12:00:00Z"
  }
}
```

### ❌ Error Response (400 - Bad Request)
```json
{
  "ok": false,
  "error": "meetingId, message, and displayName are required"
}
```

### ❌ Error Response (401 - Unauthorized)
```json
{
  "ok": false,
  "error": "Unauthorized"
}
```

## Testing Validation

### Test Empty Message
```javascript
fetch('/api/messages', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    meetingId: meetingId,
    message: '',
    displayName: 'Test User',
  }),
})
  .then(res => res.json())
  .then(data => console.log('Expected 400:', data));
```

### Test Missing Fields
```javascript
fetch('/api/messages', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    meetingId: meetingId,
    // Missing message and displayName
  }),
})
  .then(res => res.json())
  .then(data => console.log('Expected 400:', data));
```

### Test Long Message (>2000 chars)
```javascript
const longMessage = 'A'.repeat(2001);
fetch('/api/messages', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    meetingId: meetingId,
    message: longMessage,
    displayName: 'Test User',
  }),
})
  .then(res => res.json())
  .then(data => console.log('Expected 400:', data));
```

## Troubleshooting

- **401 Unauthorized**: Make sure you're logged in and the session cookie is being sent
- **400 Bad Request**: Check that all required fields are present and valid
- **500 Internal Server Error**: Check server logs and ensure the database table exists
- **Table doesn't exist**: Run the SQL migration in Supabase SQL Editor

