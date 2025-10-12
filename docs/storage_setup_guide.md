# Storage Setup Guide

This guide explains how to set up Supabase storage buckets for the Dukaaon app and troubleshoot common upload issues.

## Required Storage Buckets

The app requires the following storage buckets:

1. **profiles** - For user avatar images
2. **product-images** - For product photos
3. **id_verification** - For KYC document uploads
4. **shop-images** - For shop/business photos

## Setup Instructions

### Option 1: Run All Setup Scripts

```sql
-- Run this in your Supabase SQL editor
\i sql/setup_all_storage_buckets.sql
```

### Option 2: Run Individual Scripts

Run these scripts in your Supabase SQL editor in any order:

```sql
\i sql/create_profiles_bucket.sql
\i sql/create_product_images_bucket.sql
\i sql/create_id_verification_bucket.sql
\i sql/create_shop_images_bucket.sql
```

### Option 3: Manual Setup via Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to Storage > Buckets
3. Create each bucket with the following settings:
   - **Name**: Use the exact names listed above
   - **Public**: Set to `false` (private)
   - **File size limit**: 50MB (recommended)
   - **Allowed MIME types**: `image/*` (for image uploads)

## Bucket Policies

Each bucket has specific Row Level Security (RLS) policies:

### Profiles Bucket
- Users can upload to their own folder (`user_id/avatar/`)
- Public read access for profile images
- Users can update/delete their own images

### Product Images Bucket
- Authenticated users can upload product images
- Public read access
- Users can manage their own uploads

### ID Verification Bucket
- Users can upload to their own folder
- Restricted read access (users can only see their own files)
- Admin access for verification purposes

### Shop Images Bucket
- Authenticated users can upload shop images
- Public read access
- Users can manage their uploads

## Troubleshooting Upload Issues

### "Network request failed" Error

This error typically occurs when:

1. **Missing Bucket**: The target bucket doesn't exist
   - **Solution**: Run the setup scripts above

2. **Environment Variables**: Incorrect Supabase configuration
   - **Check**: Ensure `.env` has correct `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - **Verify**: Values match your Supabase project settings

3. **RLS Policies**: Missing or incorrect storage policies
   - **Solution**: Re-run the bucket creation scripts

4. **Network Issues**: Poor connectivity or timeouts
   - **Solution**: The app includes retry logic with exponential backoff

### Verification Steps

1. **Check Buckets Exist**:
   ```sql
   SELECT id, name, public FROM storage.buckets;
   ```

2. **Check Policies**:
   ```sql
   SELECT policyname, cmd FROM pg_policies 
   WHERE tablename = 'objects' AND schemaname = 'storage';
   ```

3. **Test Upload Manually**:
   - Use Supabase dashboard to upload a test file
   - Verify the file appears in the correct bucket

### Common Issues and Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| "Bucket not found" | Missing bucket | Run setup scripts |
| "Permission denied" | Missing RLS policy | Re-run bucket creation script |
| "Invalid file path" | Incorrect path format | Check file path construction in code |
| "File too large" | Exceeds size limit | Compress image or increase bucket limit |
| "Network timeout" | Slow connection | App has built-in retry logic |

## File Path Conventions

- **Profiles**: `{user_id}/avatar/{timestamp}.jpg`
- **Products**: `{user_id}/products/{product_id}/{timestamp}.jpg`
- **ID Verification**: `{user_id}/documents/{document_type}_{timestamp}.jpg`
- **Shop Images**: `{user_id}/shop/{timestamp}.jpg`

## Security Considerations

1. **File Size Limits**: Set appropriate limits to prevent abuse
2. **MIME Type Validation**: Restrict to image types only
3. **User Isolation**: Users can only access their own files (except public buckets)
4. **Admin Access**: Implement proper admin roles for sensitive buckets

## Monitoring and Maintenance

- Monitor storage usage in Supabase dashboard
- Regularly clean up unused files
- Review and update policies as needed
- Monitor upload success rates and error logs

## Support

If you continue to experience issues:

1. Check the app logs for detailed error messages
2. Verify your Supabase project settings
3. Test with a minimal upload example
4. Contact the development team with specific error details