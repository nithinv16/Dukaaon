# Authentication Workflow Documentation

## Overview

This document explains how the Dukaaon Rider App implements user authentication using Supabase Auth with proper integration between `auth.users` and the `delivery_partners` table.

## Authentication Flow

### 1. User Registration/Login Process

#### Step 1: Phone Number Verification
- User enters their phone number
- App calls `SupabaseAuthService.sendOTP(phoneNumber)`
- Supabase Auth sends SMS OTP to the user
- User enters the OTP code

#### Step 2: OTP Verification
- App calls `SupabaseAuthService.verifyOTP(phoneNumber, code)`
- Supabase Auth verifies the OTP
- **User is automatically created/authenticated in `auth.users` table**
- User ID from `auth.users` is stored in AsyncStorage

#### Step 3: Profile Creation/Update
- App checks if user has a profile in `delivery_partners` using `ensureUserProfileExists()`
- If profile exists: Update existing profile with new information
- If no profile: Create new profile in `delivery_partners` with foreign key to `auth.users.id`

### 2. Database Schema

#### auth.users (Managed by Supabase Auth)
```sql
-- This table is automatically managed by Supabase Auth
CREATE TABLE auth.users (
  id UUID PRIMARY KEY,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  -- Other Supabase Auth fields...
);
```

#### delivery_partners (Custom Profile Table)
```sql
CREATE TABLE public.delivery_partners (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone_number TEXT UNIQUE NOT NULL,
  vehicle_type TEXT NOT NULL,
  vehicle_number TEXT NOT NULL,
  id_number BIGINT NOT NULL,
  profile_image_url TEXT,
  id_image_url TEXT,
  vehicle_image_url TEXT,
  is_verified BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3. Required RLS Policies

#### For delivery_partners table:
```sql
-- Enable RLS
ALTER TABLE public.delivery_partners ENABLE ROW LEVEL SECURITY;

-- Policy for users to read their own profile
CREATE POLICY "Users can view own profile" ON public.delivery_partners
  FOR SELECT USING (auth.uid() = id);

-- Policy for users to insert their own profile
CREATE POLICY "Users can insert own profile" ON public.delivery_partners
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Policy for users to update their own profile
CREATE POLICY "Users can update own profile" ON public.delivery_partners
  FOR UPDATE USING (auth.uid() = id);
```

#### For storage (images):
```sql
-- Policy for users to upload images to their folder
CREATE POLICY "Users can upload own images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'delivery_partners' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Policy for users to view images
CREATE POLICY "Users can view images" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'delivery_partners'
  );
```

### 4. Key Functions

#### SupabaseAuthService.createUserProfile(profileData)
- Gets current authenticated user from `auth.users`
- Creates profile in `delivery_partners` with foreign key reference
- Handles constraint violations (duplicate phone numbers, existing profiles)

#### SupabaseAuthService.ensureUserProfileExists(userId)
- Checks if user exists in `auth.users`
- Checks if profile exists in `delivery_partners`
- Returns existing profile or null if none exists

#### SupabaseAuthService.getCurrentUser()
- Gets authenticated user from Supabase Auth session
- Syncs AsyncStorage with auth session
- Clears local storage if auth session is invalid

### 5. Error Handling

#### Common Error Scenarios:
1. **Phone number already registered**: User with this phone exists in `delivery_partners`
2. **Profile already exists**: User already has a profile (duplicate creation attempt)
3. **Auth session missing**: User needs to re-authenticate
4. **RLS policy violation**: User trying to access/modify unauthorized data

### 6. Security Benefits

1. **Proper Authentication**: Users are authenticated through Supabase Auth
2. **Foreign Key Integrity**: Profiles are linked to authenticated users
3. **Row Level Security**: Users can only access their own data
4. **Session Management**: Proper session handling with automatic cleanup
5. **Data Consistency**: Phone numbers from auth match profile data

### 7. Migration from Previous System

If migrating from a system that didn't use `auth.users`:

1. Existing users will need to re-authenticate via OTP
2. Their profiles will be linked to new `auth.users` entries
3. Phone number matching can help identify existing profiles
4. Consider data migration scripts for seamless transition

### 8. Testing the Workflow

1. **New User Registration**:
   - Send OTP to new phone number
   - Verify OTP (creates user in `auth.users`)
   - Complete profile setup (creates profile in `delivery_partners`)

2. **Existing User Login**:
   - Send OTP to existing phone number
   - Verify OTP (authenticates existing user)
   - Profile setup screen updates existing profile

3. **Session Management**:
   - App restart should maintain authentication if session is valid
   - Invalid sessions should redirect to login

### 9. Troubleshooting

#### Images not uploading:
- Check storage RLS policies
- Verify bucket exists and is public
- Check user authentication status

#### Profile updates failing:
- Check delivery_partners RLS policies
- Verify user is authenticated in auth.users
- Check for constraint violations

#### Authentication issues:
- Clear AsyncStorage and restart authentication flow
- Check Supabase Auth configuration
- Verify phone number format