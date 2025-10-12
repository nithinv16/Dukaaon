# FCM Database Error Fix

This document explains the fixes applied to resolve the FCM token update database error.

## Error Description

The application was encountering the following error:
```
ERROR FCM: Error updating token in database: {"code": "42703", "details": null, "hint": null, "message": "column profiles.phone does not exist"}
```

## Root Cause

The FCM service was using incorrect column names when interacting with the database:

1. **FCM Token Update**: The service was trying to update the `profiles` table using `.eq('phone', userPhone)` but the actual column name is `phone_number`.

2. **Notifications Insert**: The service was trying to insert notifications with a `user_phone` field, but the `notifications` table expects a `user_id` (UUID) field that references `profiles(id)`.

## Fixes Applied

### 1. Fixed FCM Token Update Query

**File**: `services/firebase/messaging.ts`

**Before**:
```typescript
const { error } = await supabase
  .from('profiles')
  .update({ fcm_token: token })
  .eq('phone', userPhone); // ❌ Wrong column name
```

**After**:
```typescript
const { error } = await supabase
  .from('profiles')
  .update({ fcm_token: token })
  .eq('phone_number', userPhone); // ✅ Correct column name
```

### 2. Fixed Notifications Database Insert

**File**: `services/firebase/messaging.ts`

**Before**:
```typescript
private async saveNotificationToDatabase(notification: any) {
  try {
    const userPhone = await AsyncStorage.getItem('user_phone');
    if (!userPhone) return;

    const { error } = await supabase
      .from('notifications')
      .insert({
        ...notification,
        user_phone: userPhone // ❌ Wrong field, table expects user_id
      });
  }
}
```

**After**:
```typescript
private async saveNotificationToDatabase(notification: any) {
  try {
    // Get current user session
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log('FCM: No authenticated user, skipping notification save');
      return;
    }

    const { error } = await supabase
      .from('notifications')
      .insert({
        ...notification,
        user_id: user.id // ✅ Correct field using UUID
      });
  }
}
```

## Database Schema Reference

### Profiles Table
- ✅ Uses `phone_number` column (not `phone`)
- ✅ Has `fcm_token` column for storing FCM tokens

### Notifications Table
- ✅ Uses `user_id UUID` that references `profiles(id)`
- ✅ Has proper RLS policies for user access control
- ✅ Includes fields: `id`, `user_id`, `title`, `message`, `type`, `data`, `read`, `created_at`

## Testing

After applying these fixes:

1. **FCM Token Updates**: Should now successfully update the `fcm_token` field in the `profiles` table
2. **Notification Storage**: Should now properly save notifications to the `notifications` table with correct user association
3. **Error Resolution**: The `column profiles.phone does not exist` error should be resolved

## Additional Recommendations

1. **Consistent Column Naming**: Ensure all database queries use the correct column names (`phone_number` not `phone`)
2. **Type Safety**: Consider adding TypeScript interfaces for database schema to prevent such errors
3. **Error Handling**: The current error handling is good, but consider adding retry logic for network-related failures
4. **User Session Management**: The notification save now properly uses the authenticated user's ID, which is more secure and reliable

## Files Modified

- ✅ `services/firebase/messaging.ts` - Fixed both FCM token update and notification save methods

The FCM service should now work correctly without database column errors.