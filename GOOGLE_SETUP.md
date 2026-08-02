# Google API Integration Setup Guide

## Completed Integrations

All plugins now use real Google APIs instead of localStorage:

✅ **Email Plugin** → Gmail API
✅ **Calendar Plugin** → Google Calendar API
✅ **Tasks Plugin** → Google Tasks API
✅ **Web Search Plugin** → Google Custom Search API

> **Note:** The **Notes plugin** does not use Google Keep. Google Keep has no
> public API, so Notes stores data locally in your browser — it works without
> any account or extra setup. Do **not** add a `keep` OAuth scope: it is not a
> valid Google scope and will make the whole sign-in popup fail.

## Setup Instructions

### 1. Environment Variables

Copy `.env.example` to `.env` and add your credentials:

```bash
cp .env.example .env
```

Add your Google credentials to `.env` (use placeholders — never commit real values):
```
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
VITE_GOOGLE_CLIENT_SECRET=your-client-secret
VITE_GMAIL_USER=your-gmail@gmail.com
VITE_GMAIL_APP_PASSWORD=your-gmail-app-password
```

### 2. Google Cloud Console Configuration

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to **APIs & Services** → **OAuth consent screen**
4. Configure your consent screen with:
   - App name: KSEMO
   - User type: External
   - Add your email as developer contact
5. Navigate to **APIs & Services** → **Credentials**
6. Edit your OAuth 2.0 client ID
7. Add the following **Authorized redirect URI**:
   ```
   http://localhost:5173/oauth/callback
   ```
   (Replace `5173` with your Vite port if different)

### 3. Enable Required APIs

In Google Cloud Console, enable these APIs:
- Gmail API
- Google Calendar API
- Google Tasks API

### 4. Google Custom Search (Optional for Web Search)

If you want web search functionality:

1. Go to [Google Custom Search](https://programmablesearchengine.google.com/)
2. Create a new search engine
3. Get your **Search Engine ID (CX)**
4. Go to [Google Cloud Console](https://console.cloud.google.com/)
5. Navigate to **APIs & Services** → **Credentials**
6. Create an API key
7. Add to your `.env`:
   ```
   VITE_GOOGLE_SEARCH_API_KEY=your_api_key_here
   VITE_GOOGLE_SEARCH_CX=your_cx_here
   ```

## Usage

### Voice Commands

Once configured, you can use these voice commands:

**Email:**
- "Compose email to john@example.com with subject Meeting tomorrow"
- "Send email to john@example.com with subject Hello and body How are you?"
- "Read emails"
- "Reply with I'll be there"

**Calendar:**
- "Create event Team meeting tomorrow at 2pm"
- "Show events"
- "Am I free tomorrow?"
- "Delete event Team meeting"

**Tasks:**
- "Add task Call mom"
- "Show tasks"
- "Complete task Call mom"
- "Delete task Buy groceries"

**Notes:**
- "Create note Meeting notes: discuss project timeline"
- "Show notes"
- "Search notes for project"
- "Delete note Meeting notes"
- (Notes are saved locally in your browser — no Google account required)

**Web Search:**
- "Search for latest AI news"
- "Look up weather in London"

## Authentication Flow

1. First time using a Google API, you'll be prompted to authenticate
2. A popup window will open for Google OAuth
3. Grant permissions to access your Gmail, Calendar, Tasks, and Keep
4. Access token is stored and reused for subsequent requests
5. Token expires after 1 hour (can be refreshed)

## Troubleshooting

**"OAuth popup was closed"**
- Make sure popup blockers are disabled for your app
- Check that the redirect URI matches exactly in Google Cloud Console

**"Popup was blocked..."**
- Allow popups for this site in your browser and try again

**"Could not connect"**
- If you had an older `.env`, remove the invalid `https://www.googleapis.com/auth/keep` scope — it breaks Google sign-in
- Verify the OAuth consent screen has your email as a test user (apps in "Testing" mode only let listed accounts sign in)
- Make sure the redirect URI `http://localhost:5173/oauth/callback` is registered in Google Cloud Console

**"Gmail API error"**
- Verify Gmail API is enabled in Google Cloud Console
- Check that your OAuth scopes include Gmail permissions

**"Calendar API error"**
- Verify Google Calendar API is enabled
- Check that your OAuth scopes include Calendar permissions

**"Keep API error"**
- The Notes plugin no longer uses Google Keep (no public API exists). It now stores notes locally in your browser, so this error should no longer appear.

**"Custom Search API error"**
- Make sure you've added the API key and CX to `.env`
- Verify the Custom Search API is enabled

## Security Notes

- Your credentials are stored in `.env` (not committed to git)
- OAuth tokens are stored in memory only (session-based)
- App passwords are used for Gmail (recommended for apps)
- Never commit `.env` to version control

## Next Steps

1. Copy `.env.example` to `.env` with your credentials
2. Configure Google Cloud Console OAuth settings
3. Enable required APIs in Google Cloud Console
4. (Optional) Set up Google Custom Search for web search
5. Test the voice commands in the premium voice chat
