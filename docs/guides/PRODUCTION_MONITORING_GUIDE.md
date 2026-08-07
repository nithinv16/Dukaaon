# Production Monitoring Guide - Profile Creation Fix

## 🎯 Monitoring Objectives

After deploying the profile creation fix to production, monitor these key areas to ensure the fix is working correctly and no new issues are introduced.

## 📊 Key Metrics to Monitor

### 1. Profile Creation Success Rate
**Target**: 100% success rate for new user registrations

**Monitoring Query**:
```sql
-- Check profile creation success rate (last 24 hours)
SELECT 
    COUNT(*) as total_attempts,
    COUNT(CASE WHEN created_at IS NOT NULL AND updated_at IS NOT NULL THEN 1 END) as successful_creations,
    ROUND(
        (COUNT(CASE WHEN created_at IS NOT NULL AND updated_at IS NOT NULL THEN 1 END) * 100.0 / COUNT(*)), 2
    ) as success_rate_percent
FROM public.profiles 
WHERE created_at >= NOW() - INTERVAL '24 hours';
```

### 2. OTP Verification Errors
**Target**: Zero "Profile creation failed" errors

**Check Supabase Logs**:
- Navigate to Supabase Dashboard → Logs
- Filter for errors containing "Profile creation failed"
- Monitor authentication errors

### 3. New User Registration Flow
**Target**: Smooth end-to-end registration

**Daily Checks**:
```sql
-- New registrations today
SELECT COUNT(*) as new_users_today
FROM public.profiles 
WHERE DATE(created_at) = CURRENT_DATE;

-- Check for incomplete profiles (missing timestamps)
SELECT COUNT(*) as incomplete_profiles
FROM public.profiles 
WHERE created_at IS NULL OR updated_at IS NULL;
```

## 🔍 Monitoring Schedule

### Immediate (First 24 Hours)
- **Every 2 hours**: Check error logs
- **Every 4 hours**: Verify new user registrations
- **Every 6 hours**: Run success rate queries

### Short-term (First Week)
- **Daily**: Review registration metrics
- **Daily**: Check for any new error patterns
- **Every 2 days**: Validate seller KYC completion rates

### Long-term (Ongoing)
- **Weekly**: Overall registration health check
- **Monthly**: Performance and success rate trends

## 🚨 Alert Conditions

### Critical Alerts (Immediate Action Required)
1. **Profile creation success rate drops below 95%**
2. **Any "Profile creation failed" errors appear in logs**
3. **New user registrations drop to zero for >2 hours**
4. **Database connection errors related to profiles table**

### Warning Alerts (Monitor Closely)
1. **Success rate drops below 98%**
2. **Unusual spike in OTP verification failures**
3. **Incomplete profile records (missing timestamps)**

## 📈 Monitoring Tools & Dashboards

### Supabase Dashboard
1. **Database → Tables → profiles**
   - Monitor row count growth
   - Check data quality (timestamps present)

2. **Authentication → Users**
   - Monitor new user creation rate
   - Check for authentication errors

3. **Logs → Database**
   - Filter for profile-related errors
   - Monitor RPC function calls

### Custom Monitoring Queries

#### Health Check Query
```sql
-- Comprehensive health check
SELECT 
    'Total Profiles' as metric,
    COUNT(*) as value
FROM public.profiles
UNION ALL
SELECT 
    'Profiles with Timestamps' as metric,
    COUNT(*) as value
FROM public.profiles 
WHERE created_at IS NOT NULL AND updated_at IS NOT NULL
UNION ALL
SELECT 
    'New Profiles Today' as metric,
    COUNT(*) as value
FROM public.profiles 
WHERE DATE(created_at) = CURRENT_DATE
UNION ALL
SELECT 
    'Seller Profiles' as metric,
    COUNT(*) as value
FROM public.profiles 
WHERE role = 'seller';
```

#### Error Detection Query
```sql
-- Find potential issues
SELECT 
    'Profiles Missing Timestamps' as issue_type,
    COUNT(*) as count,
    'Check create_profile_unified function' as action
FROM public.profiles 
WHERE created_at IS NULL OR updated_at IS NULL
HAVING COUNT(*) > 0

UNION ALL

SELECT 
    'Orphaned Auth Users' as issue_type,
    COUNT(*) as count,
    'Check profile creation process' as action
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE p.id IS NULL AND au.created_at >= NOW() - INTERVAL '24 hours'
HAVING COUNT(*) > 0;
```

## 📋 Daily Monitoring Checklist

### Morning Check (9 AM)
- [ ] Run health check query
- [ ] Check overnight registration count
- [ ] Review error logs from past 12 hours
- [ ] Verify no critical alerts triggered

### Afternoon Check (2 PM)
- [ ] Monitor real-time registration activity
- [ ] Check for any user-reported issues
- [ ] Validate seller KYC completion rates

### Evening Check (6 PM)
- [ ] Daily success rate calculation
- [ ] Review any warning alerts
- [ ] Prepare summary for stakeholders

## 🎯 Success Indicators

### Week 1 Targets
- ✅ Zero "Profile creation failed" errors
- ✅ 100% profile creation success rate
- ✅ Normal new user registration volume
- ✅ No increase in support tickets

### Month 1 Targets
- ✅ Sustained high success rates (>99%)
- ✅ Improved user onboarding metrics
- ✅ Reduced authentication-related support requests
- ✅ Stable database performance

## 🛠️ Troubleshooting Guide

### If Profile Creation Fails
1. **Check the migration deployment**:
   ```sql
   SELECT * FROM supabase_migrations.schema_migrations 
   WHERE version = '20250117000000';
   ```

2. **Verify function exists**:
   ```sql
   SELECT proname FROM pg_proc WHERE proname = 'create_profile_unified';
   ```

3. **Test function manually**:
   ```sql
   SELECT create_profile_unified('+91TEST123456', 'seller');
   ```

### If Success Rate Drops
1. Check database connectivity
2. Verify Supabase service status
3. Review recent code deployments
4. Check for database locks or performance issues

### If New Registrations Stop
1. Verify SMS service (OTP delivery)
2. Check authentication service status
3. Review app deployment status
4. Validate network connectivity

## 📞 Escalation Contacts

### Technical Issues
- **Database**: DBA team
- **Authentication**: Backend team
- **Mobile App**: Frontend team

### Business Impact
- **Product Manager**: Registration flow issues
- **Customer Support**: User-reported problems
- **DevOps**: Infrastructure concerns

## 📊 Reporting Template

### Daily Status Report
```
Date: [DATE]
Profile Creation Fix - Daily Status

✅ Metrics:
- New registrations: [COUNT]
- Success rate: [PERCENTAGE]%
- Error count: [COUNT]

🔍 Issues Found:
- [NONE/LIST ISSUES]

📈 Trends:
- [OBSERVATIONS]

🎯 Action Items:
- [NONE/LIST ACTIONS]

Status: 🟢 Healthy / 🟡 Warning / 🔴 Critical
```

---

**Monitoring Start Date**: [TO BE FILLED]
**Next Review**: [TO BE SCHEDULED]
**Status**: 🟢 Active Monitoring