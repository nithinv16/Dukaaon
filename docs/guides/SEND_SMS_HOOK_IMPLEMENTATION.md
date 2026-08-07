# Send SMS Hook Implementation Guide

This document explains the implementation and usage of the custom Send SMS hook for DukaaOn's authentication system.

## Overview

The Send SMS hook provides enhanced control over SMS delivery for OTP authentication, including:
- Custom message formatting
- Rate limiting protection
- SMS type-based customization
- Audit logging
- Error handling and fallback

## Files Created

### 1. `sql_functions/send_sms_hook.sql`
The main Postgres function that handles SMS processing.

### 2. `deploy_send_sms_hook.sql`
Deployment script with permissions and testing.

### 3. `supabase/config.toml` (Updated)
Configuration to enable the SMS hook.

## Features

### 1. Custom Message Formatting
Messages are customized based on SMS type:
- **Signup**: "Welcome to DukaaOn! Your verification code is: [CODE]"
- **Recovery**: "DukaaOn account recovery code: [CODE]"
- **Email Change**: "DukaaOn email change verification: [CODE]"
- **Phone Change**: "DukaaOn phone change verification: [CODE]"
- **Default**: "DukaaOn verification code: [CODE]"

All messages include expiry information: "(Valid for 10 minutes)"

### 2. Rate Limiting
- Prevents SMS spam by limiting to 1 SMS per phone number per minute
- Returns HTTP 429 error with user-friendly message when rate limited
- Uses `auth.audit_log_entries` for tracking

### 3. Audit Logging
Tracks all SMS attempts with:
- Phone number
- SMS type
- Message length
- Timestamp
- Success/failure status

### 4. Error Handling
- Graceful error handling with user-friendly messages
- Fallback responses for service unavailability
- Detailed logging for debugging

## Integration with Existing OTP System

### How It Works
1. When your app requests an OTP via Firebase/Supabase
2. Supabase Auth triggers the `send_sms_hook` before sending SMS
3. The hook processes the request:
   - Checks rate limits
   - Customizes the message
   - Logs the attempt
   - Returns formatted message or error
4. Supabase sends the SMS with the custom message

### Compatibility
The hook is fully compatible with your existing:
- Firebase authentication flow
- OTP verification in `app/(auth)/otp.tsx`
- Custom access token hook
- Environment-based configuration

## Deployment Instructions

### Step 1: Deploy the Function
```bash
# Run the SMS hook creation script
supabase db push

# Or manually run in Supabase SQL Editor:
# 1. Run sql_functions/send_sms_hook.sql
# 2. Run deploy_send_sms_hook.sql
```

### Step 2: Verify Configuration
The hook is already configured in `supabase/config.toml`:
```toml
[auth.hook.send_sms]
enabled = true
uri = "pg-functions://postgres/public/send_sms_hook"
```

### Step 3: Test the Implementation
1. Deploy to Supabase
2. Test OTP flow in your app
3. Check Supabase logs for hook execution
4. Verify custom messages are being sent

## Benefits for Your OTP Issues

### 1. Reduced "OTP Expired" Errors
- Rate limiting prevents rapid-fire OTP requests
- Clear expiry messaging sets user expectations
- Better error messages guide users

### 2. Improved User Experience
- Branded messages with "DukaaOn" name
- Context-specific messages (signup vs recovery)
- Clear expiry information

### 3. Better Monitoring
- Audit trail of all SMS attempts
- Rate limiting metrics
- Error tracking and debugging

### 4. Production Stability
- Prevents SMS abuse
- Graceful error handling
- Fallback mechanisms

## Monitoring and Debugging

### Check Hook Status
```sql
-- Verify hook function exists
SELECT proname, prosrc 
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND p.proname = 'send_sms_hook';

-- Check permissions
SELECT has_function_privilege('supabase_auth_admin', 'public.send_sms_hook', 'execute');
```

### View SMS Audit Logs
```sql
-- Recent SMS attempts
SELECT 
  created_at,
  payload->>'phone' as phone,
  payload->>'sms_type' as sms_type,
  payload->>'action' as action
FROM auth.audit_log_entries
WHERE payload->>'action' = 'sms_sent'
ORDER BY created_at DESC
LIMIT 10;
```

### Test the Hook
```sql
-- Test with sample data
SELECT public.send_sms_hook(
  jsonb_build_object(
    'phone', '+1234567890',
    'message', 'Test message',
    'sms_type', 'signup',
    'token', '123456',
    'user_id', 'test-user'
  )
);
```

## Customization Options

### 1. Adjust Rate Limiting
Modify the `rate_limit_seconds` variable in the function:
```sql
rate_limit_seconds integer := 60; -- Change to desired seconds
```

### 2. Custom Message Templates
Modify the CASE statement in the function to change message formats.

### 3. Additional SMS Types
Add new cases to handle custom SMS types for your app.

### 4. Enhanced Logging
Add more fields to the audit log payload for detailed tracking.

## Troubleshooting

### Common Issues

1. **Hook not triggering**
   - Verify function exists and has correct permissions
   - Check `supabase/config.toml` configuration
   - Ensure Supabase project is updated

2. **Rate limiting too aggressive**
   - Adjust `rate_limit_seconds` in the function
   - Clear old audit log entries if needed

3. **Custom messages not appearing**
   - Check if SMS provider supports custom messages
   - Verify hook is returning correct format
   - Test with Supabase logs

### Debug Steps
1. Check Supabase function logs
2. Test hook function directly in SQL editor
3. Verify audit log entries are being created
4. Check SMS provider integration

## Next Steps

After implementing the Send SMS hook, consider:
1. Implementing the MFA Verification hook for additional security
2. Adding SMS provider failover logic
3. Implementing SMS analytics and reporting
4. Adding internationalization for messages

## Security Considerations

- The function uses `SECURITY DEFINER` for necessary permissions
- Permissions are restricted to `supabase_auth_admin` only
- Rate limiting prevents abuse
- Audit logging provides security trail
- Error messages don't expose sensitive information

This implementation enhances your existing OTP system while maintaining compatibility with your current Firebase + Supabase architecture.