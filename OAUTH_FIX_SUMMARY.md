# OAuth Cookie Fix Summary

## Problem
The "invalid oauth state" error occurred because the `google_oauth_state` cookie was not being sent back from the browser to the Render server during the OAuth callback. This was due to incorrect cookie configuration for production deployments.

## Root Causes
1. **Missing domain configuration**: The cookie domain setting was commented out in `cookies.ts`, causing cookies to not be properly scoped in production
2. **Inconsistent cookie settings**: The Google OAuth cookie and session cookie had different configurations
3. **Missing environment variables**: No clear documentation of required environment variables for Render deployment

## Changes Made

### 1. Fixed Cookie Configuration (`server/_core/cookies.ts`)
- Uncommented and fixed the domain configuration logic
- Added proper domain handling for production environments
- Ensures cookies are set with the correct domain (e.g., `.your-app.onrender.com`)

### 2. Fixed Google OAuth Cookie (`server/_core/googleOAuth.ts`)
- Added domain configuration to match session cookie settings
- Ensured cookie clearing uses the same domain settings
- Maintains consistency between cookie setting and clearing

### 3. Fixed Client-side OAuth Cookie (`client/src/const.ts`)
- Adjusted Secure and SameSite settings for `__Host-` prefix cookie
- The `__Host-` prefix requires Secure flag even in localhost
- Properly handles local vs production environments

### 4. Added Environment Configuration
- Created `.env.example` with required environment variables
- Created `render.yaml` for Render deployment configuration
- Documented the `GOOGLE_OAUTH_REDIRECT_URI` requirement

## Required Steps for Render Deployment

### 1. Set Environment Variables in Render
Go to your Render dashboard and set these environment variables:

```
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret  
GOOGLE_OAUTH_REDIRECT_URI=https://YOUR-SERVICE-NAME.onrender.com/api/auth/google/callback
NODE_ENV=production
PORT=3000
```

**IMPORTANT**: Replace `YOUR-SERVICE-NAME` with your actual Render service name.

### 2. Update Google OAuth Console
Make sure your Google OAuth Console has the correct redirect URI:
- Add: `https://YOUR-SERVICE-NAME.onrender.com/api/auth/google/callback`
- Remove or keep localhost URIs for local development

### 3. Deploy Changes
Push these changes to GitHub and Render will automatically redeploy:
```bash
git add .
git commit -m "Fix OAuth cookie configuration for production deployment"
git push
```

### 4. Test the Deployment
After deployment:
1. Clear your browser cookies for your app domain
2. Navigate to your Render app URL
3. Try logging in with Google
4. The login should now work without the "invalid oauth state" error

## Why This Fixes the Issue

The main issue was that cookies weren't being properly scoped for the production domain. When you set a cookie without a domain attribute on `your-app.onrender.com`, browsers may not send it back correctly, especially with cross-origin OAuth flows.

By setting the domain to `.your-app.onrender.com` (with the leading dot), the cookie is properly scoped and will be sent back to both the main domain and subdomains.

## Additional Notes

- The `__Host-` prefix in `OAUTH_STATE_COOKIE` has strict security requirements (Secure, Path=/, no Domain)
- This is why we couldn't set a domain for that specific cookie
- The Google OAuth state cookie (`google_oauth_state`) doesn't use the `__Host-` prefix, so we can set its domain
- Session cookies now also get proper domain configuration for production

## Troubleshooting

If you still experience issues after deployment:

1. **Check browser console**: Look for cookie-related errors
2. **Verify environment variables**: Ensure all required variables are set in Render
3. **Check Google Console**: Make sure the redirect URI exactly matches your Render URL
4. **Clear cookies**: Clear all cookies for your app domain and try again
5. **Check Render logs**: Look for the debug output showing the expected vs received state
