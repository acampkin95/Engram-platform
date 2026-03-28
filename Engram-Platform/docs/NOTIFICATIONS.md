# Engram Notifications System

Engram uses a dual-channel notification system to alert administrators about system events, errors, and maintenance. Notifications can be sent via email (Resend) and/or push notifications (ntfy.sh).

## Overview

The notification system provides:

- **Email channel** — Resend API for transactional email
- **Push channel** — ntfy.sh for real-time push notifications with optional authentication
- **Configurable routing** — choose email, push, or both per notification
- **Priority levels** — low, default, high, urgent (affects ntfy.sh behavior)
- **Tags** — categorize notifications for filtering (custom tags supported)

## Configuration

### Environment Variables

Add these to your `.env` file:

```bash
# Resend Email Configuration
# Get API key from https://resend.com/api-keys
RESEND_API_KEY=re_xxxxxxxxxxxx
EMAIL_FROM=alerts@velocitydigi.com

# ntfy.sh Push Notifications
# Optional: Get API key from https://ntfy.sh/account/api-keys (for auth)
NTFY_API_KEY=tk_xxxxxxxxxxxx
NTFY_TOPIC_URL=https://ntfy.sh/engram-alerts
```

**Minimal setup** — only email:

```bash
RESEND_API_KEY=re_xxxxxxxxxxxx
EMAIL_FROM=alerts@velocitydigi.com
```

**Minimal setup** — only push:

```bash
NTFY_TOPIC_URL=https://ntfy.sh/engram-alerts
```

**Important**: Rebuild the Docker container after environment changes:

```bash
docker compose up -d --build platform-frontend
```

## API Reference

### POST /api/system/notifications

Send a notification to configured channels.

**Authentication**: Requires admin access.

**Request body**:

```json
{
  "subject": "String",
  "text": "String",
  "to": ["email@example.com"],
  "channels": ["email", "ntfy"],
  "priority": "high",
  "tags": ["alert", "memory-api"]
}
```

**Parameters**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `subject` | string | Yes | Subject line (max 200 chars) |
| `text` | string | Yes | Message body (max 10,000 chars) |
| `to` | string[] | No | Email recipients. If omitted, defaults to configured EMAIL_FROM |
| `channels` | string[] | No | Delivery channels: `email`, `ntfy`. Default: both |
| `priority` | string | No | ntfy.sh priority: `low`, `default`, `high`, `urgent`. Default: `default` |
| `tags` | string[] | No | ntfy.sh tags for filtering (max 50 chars each). Default: `["engram"]` |

**Response**:

```json
{
  "email": {
    "success": true
  },
  "ntfy": {
    "success": true
  }
}
```

If a channel fails:

```json
{
  "email": {
    "success": false,
    "error": "RESEND_API_KEY or EMAIL_FROM not configured"
  },
  "ntfy": {
    "success": true
  }
}
```

**Example with curl**:

```bash
curl -X POST http://localhost:3002/api/system/notifications \
  -H "Content-Type: application/json" \
  -H "Cookie: __Secure-authjs.session-token=..." \
  -d '{
    "subject": "Memory API Error",
    "text": "Weaviate connection timeout detected.",
    "channels": ["email", "ntfy"],
    "priority": "urgent",
    "tags": ["alert", "weaviate"]
  }'
```

### GET /api/system/notifications/settings

Retrieve notification channel configuration status.

**Authentication**: Requires admin access.

**Response**:

```json
{
  "resend": {
    "configured": true,
    "from": "ale***@velocitydigi.com"
  },
  "ntfy": {
    "configured": true,
    "topicUrl": "https://ntfy.sh/***",
    "authenticated": true
  }
}
```

**Example with curl**:

```bash
curl -X GET http://localhost:3002/api/system/notifications/settings \
  -H "Cookie: __Secure-authjs.session-token=..."
```

### PUT /api/system/notifications/settings

Test a specific notification channel (sends a test message).

**Authentication**: Requires admin access.

**Request body**:

```json
{
  "channel": "email"
}
```

**Parameters**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `channel` | string | Yes | Channel to test: `email` or `ntfy` |

**Response**:

```json
{
  "email": {
    "success": true
  }
}
```

**Example with curl**:

```bash
curl -X PUT http://localhost:3002/api/system/notifications/settings \
  -H "Content-Type: application/json" \
  -H "Cookie: __Secure-authjs.session-token=..." \
  -d '{"channel": "email"}'
```

## Settings UI

The notification settings are accessible in the dashboard at:

```
/dashboard/system/settings
```

This page displays:

- **Channel Status**: Shows which channels are configured and partially masks credentials
- **Configuration Form**: Allows admins to set environment variables (if supported)
- **Test Channel**: One-click test button for each channel — sends a sample notification

## Architecture

### Dispatch Flow

```
sendNotification(input)
  |
  +--- channels.includes('email')? ---> sendViaResend(input)
  |                                      |
  |                                      +-- fetch('https://api.resend.com/emails')
  |                                      +-- return { success, error? }
  |
  +--- channels.includes('ntfy')? ----> sendViaNtfy(input)
                                        |
                                        +-- fetch(NTFY_TOPIC_URL, {
                                        |     method: 'POST',
                                        |     headers: {
                                        |       Title: subject,
                                        |       Priority: priority,
                                        |       Tags: tags.join(','),
                                        |       Authorization: 'Bearer ' + NTFY_API_KEY
                                        |     },
                                        |     body: text
                                        |   })
                                        +-- return { success, error? }
```

### Error Handling

Both channels fail gracefully. If a channel is not configured, it returns `{ success: false, error: "..." }`. The API endpoint returns results for all channels, allowing the client to see which ones succeeded and which failed.

**Common errors**:

- `RESEND_API_KEY or EMAIL_FROM not configured` — missing email credentials
- `No email recipients specified` — `to` array is empty and no EMAIL_FROM fallback
- `NTFY_TOPIC_URL not configured` — missing ntfy topic URL
- `Resend: 401` — invalid RESEND_API_KEY
- `ntfy: 401` — invalid NTFY_API_KEY or topic access denied

### Backward Compatibility

The deprecated function `sendAdminNotification()` wraps `sendNotification()` and throws an error if all channels fail. New code should use `sendNotification()` directly.

```typescript
// Deprecated
await sendAdminNotification({
  to: ['admin@example.com'],
  subject: 'Alert',
  text: 'System error detected.'
});

// Preferred
const results = await sendNotification({
  to: ['admin@example.com'],
  subject: 'Alert',
  text: 'System error detected.',
  channels: ['email', 'ntfy']
});
```

## ntfy.sh Setup

### Create a Topic

ntfy.sh topics are created on first use — no signup required.

```bash
# Send a test message to create the topic
curl -X POST https://ntfy.sh/your-topic-name \
  -H "Title: Test" \
  -d "Testing ntfy.sh"
```

The topic URL is:

```
https://ntfy.sh/your-topic-name
```

### Optional: Protect with Authentication

For private topics, create an API token in your ntfy.sh account:

1. Visit https://ntfy.sh/account/api-keys
2. Create a new token
3. Set `NTFY_API_KEY=tk_...` in your `.env`

With authentication, the Engram system will include the token in all requests.

### Priority Levels

Priority controls notification urgency in ntfy.sh apps:

| Priority | ntfy.sh Level | Use Case |
|----------|---|---|
| `low` | 1 | Informational, non-urgent |
| `default` | 2 | Standard alerts |
| `high` | 3 | Urgent issues |
| `urgent` | 4 | Critical system failures |

## Troubleshooting

### Notifications Not Sending

**Check channel configuration**:

```bash
curl http://localhost:3002/api/system/notifications/settings
```

If a channel shows `configured: false`, set its environment variables.

**Verify email**:

- `RESEND_API_KEY` must be a valid Resend API key (starts with `re_`)
- `EMAIL_FROM` must be a verified sender in your Resend account

**Verify ntfy.sh**:

- `NTFY_TOPIC_URL` must be a valid ntfy.sh topic (e.g., `https://ntfy.sh/engram-alerts`)
- If using authentication, `NTFY_API_KEY` must match the topic's access control

**Test channels**:

```bash
curl -X PUT http://localhost:3002/api/system/notifications/settings \
  -H "Content-Type: application/json" \
  -d '{"channel": "email"}' \
  -H "Cookie: __Secure-authjs.session-token=..."
```

### Docker Container Not Picking Up Changes

After updating `.env`, rebuild the container:

```bash
docker compose up -d --build platform-frontend
```

Verify the new variables are loaded:

```bash
docker exec platform-frontend env | grep -E 'RESEND|NTFY|EMAIL'
```

### Resend Email Delivery Issues

- Verify email recipients are valid (schema validates email format)
- Check Resend dashboard for bounce/blocked notifications
- Confirm `EMAIL_FROM` is a verified sender

### ntfy.sh Not Receiving Notifications

- Test ntfy.sh connectivity: `curl -I https://ntfy.sh/your-topic`
- Check topic URL in `.env` (no trailing slashes)
- If authenticated, verify `NTFY_API_KEY` has topic access
- Check browser console on ntfy.sh web client for errors

## File Locations

| File | Purpose |
|------|---------|
| `/frontend/src/server/system-admin.ts` | Core notification functions (sendNotification, sendViaResend, sendViaNtfy) |
| `/frontend/app/api/system/notifications/route.ts` | POST endpoint |
| `/frontend/app/api/system/notifications/settings/route.ts` | GET/PUT endpoints |
| `/docs/NOTIFICATIONS.md` | This file |

## Integration Example

Send a notification from any server function:

```typescript
import { sendNotification } from '@/src/server/system-admin';

// In a system task or API handler
const result = await sendNotification({
  subject: 'Memory API Health Warning',
  text: 'Weaviate response time exceeded 5s threshold.',
  channels: ['email', 'ntfy'],
  priority: 'high',
  tags: ['health', 'memory-api'],
  to: ['ops@example.com']
});

if (!result.email.success) {
  console.error('Email failed:', result.email.error);
}
```
