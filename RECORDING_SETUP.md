# Recording Setup Guide

## 100ms Recording Permissions

The 403 "user does not have required permission" error indicates that your 100ms account needs recording permissions enabled.

### Steps to Enable Recording:

1. **Log into 100ms Dashboard**: https://dashboard.100ms.live/

2. **Check Account/Project Settings**:
   - Go to your project settings
   - Navigate to "Features" or "Settings"
   - Ensure "Recording" is enabled

3. **Verify API Credentials**:
   - Check that your `HMS_ACCOUNT_ID` and `HMS_SECRET` have recording permissions
   - You may need to regenerate API keys with recording permissions

4. **Check Room Template**:
   - Ensure your room template allows recording
   - Some templates may have recording disabled by default

5. **100ms Support**:
   - If recording is still not working, contact 100ms support to enable recording on your account
   - They may need to enable it at the account level

## Configure Meeting URL for Video Recordings

100ms composite recordings require a fully qualified **meeting URL** (their hosted preview UI) so video tiles can render.  
Set the following environment variables and restart the Next.js server:

```
HMS_RECORDING_MEETING_URL="https://<your-subdomain>.app.100ms.live/preview"
HMS_TEMPLATE_ID="<your-template-id>"
```

- `HMS_RECORDING_MEETING_URL` must include the `https://` protocol and usually ends with `/preview`.
- `HMS_TEMPLATE_ID` is optional but recommended so the recorder always loads the correct layout.
- The server automatically adds `skip_preview=true`, `auto_join=true`, and `ui_mode=recorder` query params, so you don't need to include them.

Without these environment variables, 100ms may only produce audio tracks.

### Testing Recording:

1. Verify room exists: `GET /api/recordings/test?meetingId={meetingId}`
2. Start recording: `POST /api/recordings/test` with `{ "meetingId": "...", "action": "start" }`
3. Stop recording: `POST /api/recordings/test` with `{ "meetingId": "...", "action": "stop" }`

### Common Issues:

- **403 Forbidden**: Recording not enabled on account or API credentials don't have permission
- **Room not found**: Ensure the meeting has an `hms_room_id` in the database
- **Recording already in progress**: Check if a recording is already active for the room

