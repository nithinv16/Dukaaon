# Payment Configuration System

This document explains how to use the new dynamic payment configuration system that replaces hardcoded UPI IDs and bank account details.

## Overview

The payment configuration system allows you to:
- Store UPI and bank account details in Supabase database
- Dynamically fetch payment recipient information
- Update payment configurations without code changes
- Maintain security and flexibility

## Setup Instructions

### 1. Database Setup

Run the SQL script to create the payment configuration table and functions:

```bash
# Execute the SQL file in your Supabase dashboard or using psql
psql -h your-supabase-host -U postgres -d postgres -f sql/create_payment_config.sql
```

Or copy and paste the contents of `sql/create_payment_config.sql` into your Supabase SQL editor.

### 2. Initial Configuration

The SQL script automatically inserts a default UPI configuration with the existing hardcoded values:
- UPI ID: `nithinvthomas96-1@okaxis`
- Merchant Name: `DukaaOn`

You can update these values using the admin interface or directly in the database.

### 3. Admin Access

To access the payment configuration admin panel:

1. Navigate to `/admin/payment-config` in your app
2. Update UPI and bank account details as needed
3. Save the configurations

**Note**: Currently, the admin panel is accessible to all authenticated users. You should implement proper admin role checking based on your authentication system.

## Database Schema

### payment_config Table

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| config_type | TEXT | 'upi' or 'bank_account' |
| is_active | BOOLEAN | Whether this config is active |
| upi_id | TEXT | UPI ID (for UPI configs) |
| merchant_name | TEXT | Merchant name (for UPI configs) |
| account_number | TEXT | Bank account number |
| ifsc_code | TEXT | Bank IFSC code |
| bank_name | TEXT | Bank name |
| account_holder_name | TEXT | Account holder name |
| description | TEXT | Optional description |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |

### Functions

#### get_payment_config(config_type)

Retrieves the active payment configuration for a given type.

```sql
SELECT public.get_payment_config('upi');
SELECT public.get_payment_config('bank_account');
```

#### update_payment_config(config_type, config_data)

Updates the payment configuration for a given type.

```sql
SELECT public.update_payment_config('upi', '{
  "upi_id": "new-upi@bank",
  "merchant_name": "New Merchant",
  "description": "Updated UPI config"
}');
```

## Code Integration

### Store Usage

The `usePaymentConfigStore` provides the following methods:

```typescript
import { usePaymentConfigStore } from '../store/paymentConfig';

const {
  upiConfig,
  bankConfig,
  loading,
  error,
  fetchUpiConfig,
  fetchBankConfig,
  updateUpiConfig,
  updateBankConfig
} = usePaymentConfigStore();

// Fetch configurations
await fetchUpiConfig();
await fetchBankConfig();

// Update configurations
await updateUpiConfig({
  upi_id: 'new-upi@bank',
  merchant_name: 'New Merchant',
  description: 'Updated config'
});
```

### Payment Methods Integration

The payment methods screen now automatically fetches UPI configuration:

```typescript
// Before (hardcoded)
const merchantName = "DukaaOn";
const upiId = "nithinvthomas96-1@okaxis";

// After (dynamic)
if (!upiConfig) {
  Alert.alert('Configuration Error', 'UPI payment configuration is not available.');
  return;
}

const merchantName = upiConfig.merchant_name;
const upiId = upiConfig.upi_id;
```

## Security Considerations

### Row Level Security (RLS)

The payment_config table has RLS enabled with the following policies:

1. **Read Access**: All authenticated users can read payment configurations
2. **Write Access**: Only admin users can modify configurations (requires `auth.jwt() ->> 'role' = 'admin'`)

### Admin Role Setup

To implement proper admin access, update user metadata in Supabase Auth:

```sql
-- Update user role in auth.users metadata
UPDATE auth.users 
SET raw_user_meta_data = raw_user_meta_data || '{"role": "admin"}'
WHERE email = 'admin@yourdomain.com';
```

Or use the Supabase dashboard to add custom claims to user JWT tokens.

## Migration from Hardcoded Values

### Before
```typescript
// Hardcoded in payment/methods.tsx
const merchantName = "DukaaOn";
const upiId = "nithinvthomas96-1@okaxis";
```

### After
```typescript
// Dynamic from Supabase
const { upiConfig } = usePaymentConfigStore();
const merchantName = upiConfig?.merchant_name;
const upiId = upiConfig?.upi_id;
```

## Benefits

1. **Flexibility**: Update payment details without code deployment
2. **Security**: Sensitive information stored securely in database
3. **Scalability**: Support multiple payment configurations
4. **Maintainability**: Centralized payment configuration management
5. **Audit Trail**: Track changes with timestamps

## Troubleshooting

### Common Issues

1. **Configuration not loading**
   - Check if the SQL script was executed successfully
   - Verify RLS policies are correctly set
   - Ensure user has proper authentication

2. **Admin access denied**
   - Check if user has admin role in JWT token
   - Verify RLS policy for write access
   - Update user metadata with admin role

3. **UPI payments failing**
   - Ensure UPI configuration is fetched before payment
   - Check if upiConfig is not null
   - Verify UPI ID format is correct

### Debug Steps

1. Check store state:
```typescript
console.log('UPI Config:', upiConfig);
console.log('Loading:', loading);
console.log('Error:', error);
```

2. Test database functions:
```sql
-- Test in Supabase SQL editor
SELECT public.get_payment_config('upi');
```

3. Verify RLS policies:
```sql
-- Check if policies exist
SELECT * FROM pg_policies WHERE tablename = 'payment_config';
```

## Future Enhancements

1. **Multiple Recipients**: Support multiple UPI IDs for different purposes
2. **Regional Configuration**: Different payment details for different regions
3. **Payment Gateway Integration**: Store API keys and configuration for payment gateways
4. **Audit Logging**: Track all configuration changes with user information
5. **Backup/Restore**: Export and import payment configurations

## Support

For issues or questions regarding the payment configuration system:

1. Check this documentation
2. Review the SQL functions and RLS policies
3. Test with the admin interface
4. Check application logs for errors

---

**Note**: Always test payment configurations in a development environment before deploying to production.