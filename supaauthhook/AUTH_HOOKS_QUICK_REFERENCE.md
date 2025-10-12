# Auth Hooks Quick Reference

## ✅ What's Already Done

### App Code
- ✅ LoginScreen.js updated with Auth Hook logging
- ✅ Environment variables added to .env.example
- ✅ Error handling improved for hook failures
- ✅ No changes needed to core OTP logic (Supabase handles it)

### Current OTP Flow
```javascript
// This code remains unchanged - Supabase handles the hook automatically
const { error } = await supabase.auth.signInWithOtp({
  phone: formatted,
});
```

## 🔧 Manual Configuration Required

### Supabase Dashboard Setup
1. **Go to**: Supabase Dashboard → Authentication → Hooks
2. **Enable**: OTP Send Hook (Beta)
3. **Configure**:
   - **Endpoint**: `https://authkey-otp-api-production.up.railway.app/send-otp`
   - **Method**: `POST`
   - **Secret Header**: `secret: your-secret-key`

### Environment Setup
1. Copy `.env.example` to `.env`
2. Add your actual secret key:
   ```env
   AUTH_HOOK_SECRET=your-actual-secret-key
   ```

## 🔍 Testing Checklist

- [ ] Railway API is running and accessible
- [ ] Supabase Auth Hook is enabled and configured
- [ ] Secret key matches between Supabase and Railway API
- [ ] Test OTP sending in app
- [ ] Check Supabase logs for hook execution
- [ ] Verify SMS delivery via AuthKey

## 🚨 Troubleshooting

### Current Issue: 404 Error from Hook
**Problem**: `Unexpected status code returned from hook: 404`

**Root Cause**: The Supabase Auth Hook configuration is incorrect.

**Solution Steps**:
1. **Verify Endpoint URL** in Supabase Dashboard:
   - Should be: `https://authkey-otp-api-production.up.railway.app/send-otp`
   - Check for typos or extra characters

2. **Check Secret Header Configuration**:
   - Header Name: `secret` (case-sensitive)
   - Header Value: Use the actual secret from your Railway API
   - Format: `your-actual-secret-key` (not the webhook format)

3. Test hook endpoint manually:
   ```bash
   curl -X POST "https://authkey-otp-api-production.up.railway.app/send-otp" \
     -H "Content-Type: application/json" \
     -H "secret: your_actual_secret" \
     -d '{"phone":"+1234567890","token":"123456"}'
   ```
   - Should return success, not "Unauthorized"

### If OTP doesn't arrive:
1. Check Supabase Auth logs
2. Verify Railway API logs
3. Confirm AuthKey API credentials

### Common Error Messages:
- `404 from hook` → Incorrect endpoint URL or method in Supabase
- `Unauthorized` → Wrong secret key
- `Hook execution failed` → Network or timeout issue
- `503 Service Unavailable` → Supabase or Railway downtime

## 📱 App Behavior

- **Before Hook**: Supabase sends OTP directly
- **After Hook**: Supabase → Your Railway API → AuthKey → SMS
- **User Experience**: Identical (no changes visible to users)
- **Error Handling**: Enhanced with specific hook error messages

## 🔗 Useful Links

- [Supabase Auth Hooks Documentation](https://supabase.com/docs/guides/auth/auth-hooks)
- [Railway Deployment Dashboard](https://railway.app/dashboard)
- [AuthKey API Documentation](https://authkey.io/docs)

---

**Next Steps**: Configure the Supabase Dashboard settings and test the integration!