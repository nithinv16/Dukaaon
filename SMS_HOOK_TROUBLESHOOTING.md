# SMS Hook Troubleshooting Guide
## Issue: OTP Not Received Despite "OTP sent successfully" Log

### Root Cause Identified

The issue was caused by **conflicting SMS hook implementations**:
1. **Wrong Implementation**: `/supabase/functions/sms-hook/index.ts` was using incorrect payload structure and API endpoint
2. **Correct Implementation**: `/sms-hook/index.ts` had the working AuthKey API integration
3. **Configuration**: Supabase was pointing to the wrong implementation

### Solution Implemented

1. **Updated SMS Hook Edge Function**: Fixed `/supabase/functions/sms-hook/index.ts` to:
   - Handle proper Supabase Auth Hook payload structure (`data.user.phone`, `data.sms.otp`)
   - Use correct AuthKey API endpoint: `https://console.authkey.io/restapi/requestjson.php`
   - Include webhook signature verification
   - Use working request format with DLT template ID

2. **Key Changes Made**:
   - Added webhook verification with `standardwebhooks` library
   - Fixed payload parsing to handle `data.user.phone` and `data.sms.otp`
   - Updated to use `console.authkey.io` endpoint instead of `api.authkey.io`
   - Added proper Authorization header with Basic auth
   - Used working message template and DLT template ID (24603)

### Deployment Steps

1. **Deploy the Updated SMS Hook Function**:
   ```bash
   supabase functions deploy sms-hook
   ```

2. **Push Configuration Changes**:
   ```bash
   supabase db push
   ```

3. **Or use the deployment script**:
   ```bash
   deploy-updated-sms-hook.bat
   ```

### Verification Steps

#### 1. Check Edge Function Deployment
- Go to Supabase Dashboard > Edge Functions
- Verify `sms-hook` function is listed and active
- Check function logs for any deployment errors

#### 2. Verify Auth Hook Configuration
- Go to Supabase Dashboard > Authentication > Hooks
- Verify "Send SMS" hook is enabled
- Confirm URL points to: `https://xcpznnkpjgyrpbvpnvit.supabase.co/functions/v1/sms-hook`
- Check that HTTP method is POST
- Ensure any required secrets are configured

#### 3. Monitor Function Logs
- In Supabase Dashboard > Edge Functions > sms-hook
- Click "Logs" to see real-time execution
- Look for the correct log sequence (see below)

#### 4. Test OTP Flow
1. Clear app cache and restart
2. Enter phone number: +918089668552
3. Check logs in order:
   - App log: "OTP sent successfully via Supabase Auth Hook"
   - Edge Function log: "SMS Hook Function Started"
   - Edge Function log: "Supabase Auth Hook triggered for phone: +91xxxxxxxxxx"
   - Edge Function log: "Making API call to: https://console.authkey.io/restapi/requestjson.php"
   - Edge Function log: "AuthKey API response: [success response]"
   - Edge Function log: "SMS sent successfully"
   - SMS received on phone

### Expected Log Output

**Successful SMS Hook Execution:**
```
SMS Hook Function Started
Supabase Auth Hook triggered for phone: +918089668552, type: signup
Making API call to: https://console.authkey.io/restapi/requestjson.php
Request body: {"mobile":"8089668552","country_code":"91","sender":"AUTHKY","sid":"24603","otp":"123456","company":"DukaaOn"}
AuthKey API response: {"status":"success","message":"SMS sent successfully"}
SMS sent successfully
```

### Common Issues & Solutions

#### Issue 1: Function Not Found (404)
**Cause**: Edge function not deployed or incorrect URL
**Solution**: 
- Redeploy function: `supabase functions deploy sms-hook`
- Check URL in config.toml matches your project

#### Issue 2: Webhook Verification Failed
**Cause**: Missing or incorrect webhook secret
**Solution**:
- Set environment variable: `SEND_SMS_HOOK_SECRETS=your_secret`
- Or remove webhook verification for testing

#### Issue 3: AuthKey API Error
**Cause**: Incorrect API key or request format
**Solution**:
- Verify AuthKey API key: `904251f34754cedc`
- Check DLT template ID: `24603`
- Ensure sender ID: `AUTHKY`

#### Issue 4: Payload Structure Error
**Cause**: Supabase sending different payload format
**Solution**: Function now handles both formats:
- Supabase Auth Hook: `data.user.phone`, `data.sms.otp`
- Direct API: `data.phone`, `data.token`

### Environment Variables

Optional environment variables for the Edge Function:
```bash
# AuthKey API Key (fallback to hardcoded if not set)
supabase secrets set AUTHKEY=904251f34754cedc

# Webhook secret for signature verification
supabase secrets set SEND_SMS_HOOK_SECRETS=your_webhook_secret
```

### Monitoring & Debugging

#### Real-time Monitoring
```bash
# Watch Edge Function logs
supabase functions logs sms-hook --follow
```

#### Test Direct API Call
```bash
curl -X POST https://xcpznnkpjgyrpbvpnvit.supabase.co/functions/v1/sms-hook \
  -H "Content-Type: application/json" \
  -d '{"phone":"+918089668552","token":"123456","type":"signup"}'
```

### Key Differences Between Implementations

| Aspect | Old (Broken) | New (Fixed) |
|--------|-------------|-------------|
| API Endpoint | `api.authkey.io/request` | `console.authkey.io/restapi/requestjson.php` |
| Payload Structure | Simple JSON | Supabase Auth Hook format |
| Authorization | `authkey` field | `Authorization: Basic` header |
| Message Format | Custom message | DLT template with OTP |
| Webhook Verification | None | StandardWebhooks library |
| Error Handling | Generic | Specific AuthKey responses |

### Support

If issues persist:
1. Check Supabase status page
2. Verify AuthKey API status
3. Review Edge Function logs for detailed errors
4. Test with different phone numbers
5. Contact Supabase support if Edge Function deployment fails

### Next Steps After Fix

1. **Deploy the updated function** using the deployment script
2. **Test thoroughly** with multiple phone numbers
3. **Monitor logs** for any remaining issues
4. **Document** any additional customizations needed
5. **Set up monitoring** for production use

The SMS hook should now correctly receive Supabase Auth Hook payloads and successfully send OTPs via the AuthKey API.