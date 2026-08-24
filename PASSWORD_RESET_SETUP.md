# Password Reset Setup Guide

## Problem Analysis

The password reset functionality was not working because the email mailer was not configured. The application code is correctly implemented, but it requires SMTP environment variables to send password reset emails.

## How Password Reset Works

1. User requests password reset with their email
2. System generates a secure reset token
3. System stores token hash in database with expiration (1 hour)
4. If mailer is configured: sends email with reset link
5. If mailer is NOT configured: returns reset URL directly (fallback mode)
6. User clicks link and resets password
7. System validates token and updates password

## Configuration Required

### Email Settings (Required for Email Delivery)

Add these environment variables to your `.env` file or production environment:

#### For Gmail (Recommended for Development)
```env
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=your-email@gmail.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
```

**Important for Gmail:**
- You cannot use your regular Gmail password
- You must create an App Password: https://support.google.com/accounts/answer/185833
- Go to Google Account → Security → 2-Step Verification → App Passwords
- Create a new app password and use it as `SMTP_PASS`

#### For Other Email Providers
```env
SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password
SMTP_FROM=noreply@yourdomain.com
SMTP_HOST=smtp.yourprovider.com
SMTP_PORT=587
```

### Legacy Variables (Still Supported)
The system also supports these legacy Gmail variables:
```env
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-app-password
```

## Testing Email Configuration

Run the mailer test to verify your configuration:

```bash
pnpm test:mailer
```

This will:
1. Check if environment variables are set
2. Attempt to connect to SMTP server
3. Report any connection issues

## Deployment Configuration

### Render.com
The `render.yaml` file has been updated to include SMTP environment variables. You'll need to configure these in your Render dashboard:

1. Go to your Render service dashboard
2. Add the following environment variables:
   - `SMTP_USER`: Your email username
   - `SMTP_PASS`: Your email password/app password
   - `SMTP_FROM`: From email address
   - `SMTP_HOST`: SMTP server host (optional)
   - `SMTP_PORT`: SMTP server port (optional, defaults to 465)

### Other Platforms
Add the same SMTP environment variables to your deployment platform's environment configuration.

## Fallback Mode

If email is not configured, the system will still work in fallback mode:
- Password reset requests will succeed
- The reset URL will be returned in the API response
- Users can manually copy and use the reset link
- This is useful for development/testing

## Security Considerations

1. **App Passwords**: Never use regular email passwords. Use app passwords or dedicated SMTP credentials.
2. **Environment Variables**: Never commit SMTP credentials to version control.
3. **Service Role Key**: Ensure `SUPABASE_SERVICE_ROLE_KEY` is set for backend operations.
4. **Token Expiration**: Reset tokens expire after 1 hour for security.
5. **One-Time Use**: Each reset token can only be used once.

## Troubleshooting

### Emails Not Sending

1. **Check Configuration**: Run `pnpm test:mailer` to verify SMTP settings
2. **Check Logs**: Look for `[Auth]` log messages in server logs
3. **Verify Credentials**: Ensure SMTP username and password are correct
4. **Gmail Specific**: 
   - Ensure 2-Step Verification is enabled
   - Use App Password, not regular password
   - Check if Google is blocking sign-in attempts

### Common Errors

**"Mailer is not configured"**
- Missing or empty SMTP_USER/SMTP_PASS environment variables
- Solution: Add SMTP credentials to environment

**"SMTP verification failed"**
- Incorrect SMTP credentials or server settings
- Firewall blocking SMTP ports
- Solution: Verify credentials and check network connectivity

**"Failed to send password-reset email"**
- SMTP connection issues during sending
- Email address format issues
- Solution: Check server logs for detailed error messages

## Development vs Production

### Development
- Use Gmail with App Password for easiest setup
- Test with `pnpm test:mailer` before running the app
- Fallback mode works if email isn't configured

### Production
- Use dedicated transactional email service (SendGrid, Mailgun, etc.)
- Configure proper SPF/DKIM records for deliverability
- Monitor email delivery rates and bounces
- Set up email delivery monitoring

## Email Template

The password reset email includes:
- Branded KSEMO styling
- Personalized greeting
- One-click reset button
- Fallback link for manual copying
- Security information about link expiration
- Professional HTML and plain text versions

## Current Status

✅ Password reset code is properly implemented
✅ SMTP configuration has been added to render.yaml
✅ Environment variable documentation updated
✅ Mailer test utility created
✅ Enhanced logging for debugging
⚠️ SMTP credentials need to be configured in your environment