# Supabase Storage Usage Guide

This guide explains how to use the Supabase storage functionality in the DukaaOn app with the RLS policies we've implemented.

## Storage Structure

The app uses Supabase Storage with the following structure:

```
profiles/
├── user_id_1/
│   ├── avatar/
│   │   └── timestamp.jpg  # User avatar
│   └── shop/
│       └── timestamp.jpg  # Shop image
├── user_id_2/
│   ├── ...
└── public/
    └── ...               # Public images accessible to all
```

## Storage Helpers

The `dukaaon/lib/supabase/client.ts` file contains helper functions for storage operations:

```typescript
// Add helpers for standard storage operations
export const storage = {
  // Get URL for a file in the profiles bucket
  getProfileImageUrl: (userId: string, fileName: string) => {
    return supabase.storage.from('profiles').getPublicUrl(`${userId}/avatar/${fileName}`).data.publicUrl;
  },
  
  // Get URL for a shop image in the profiles bucket
  getShopImageUrl: (userId: string, fileName: string) => {
    return supabase.storage.from('profiles').getPublicUrl(`${userId}/shop/${fileName}`).data.publicUrl;
  },
  
  // Build a full path for an avatar
  buildAvatarPath: (userId: string) => {
    return `${userId}/avatar/${Date.now()}.jpg`;
  },
  
  // Build a full path for a shop image
  buildShopPath: (userId: string) => {
    return `${userId}/shop/${Date.now()}.jpg`;
  }
};
```

## Using Storage in Your Components

### Image Upload Process

For optimal image uploads, follow these best practices:

1. **Use blob uploads instead of base64**:
   Base64 encoding increases payload size significantly and can cause network failures.

2. **Optimize image size before upload**:
   Reduce image quality and dimensions to minimize upload size.

3. **Use the storage helpers**:
   The helper functions ensure consistent path building and URL retrieval.

### Example: Uploading a Profile Image

```typescript
const handleImageUpload = async () => {
  try {
    // Configure image picker options
    const options = {
      mediaType: 'photo' as MediaType,
      includeBase64: false,
      maxHeight: 2000,
      maxWidth: 2000,
      quality: 0.3, // Reduce quality to minimize size
    };

    // Pick image with react-native-image-picker
    launchImageLibrary(options, (response) => {
      if (response.didCancel || response.errorMessage) {
        return;
      }
      // Handle the selected image
      const asset = response.assets?.[0];
      if (asset) {
        // Process the image asset
      }
    });

    if (result.canceled || !result.assets || !result.assets[0] || !result.assets[0].uri) {
      return;
    }

    // Get the URI and user ID
    const imageUri = result.assets[0].uri;
    const userId = user?.id;
    
    if (!userId) {
      Alert.alert('Error', 'User ID not available. Please log in again.');
      return;
    }
    
    // Use the storage helper to build the path
    const filePath = storage.buildAvatarPath(userId);
    
    // Convert URI to blob for upload
    const response = await fetch(imageUri);
    const blob = await response.blob();
    
    // Upload the image
    const { data, error } = await supabase.storage
      .from('profiles')
      .upload(filePath, blob, {
        contentType: 'image/jpeg',
        upsert: true
      });

    if (error) {
      throw new Error(error.message);
    }

    // Get URL using the storage helper
    const publicUrl = storage.getProfileImageUrl(userId, filePath.split('/').pop() || '');
    
    // Update profile with new URL
    await supabase
      .from('profiles')
      .update({ profile_image_url: publicUrl })
      .eq('id', userId);
      
    // Success!
    Alert.alert('Success', 'Profile image updated successfully!');
    
  } catch (error) {
    console.error('Error in image upload:', error);
    Alert.alert('Error', `Failed to upload image: ${error.message}`);
  }
};
```

### Security Considerations

1. **User ID in Paths**:
   - Always use the authenticated user's ID for the first folder level
   - The RLS policies will reject uploads to other users' folders

2. **Public Folder**:
   - Only store non-sensitive images in the public folder
   - All users can access the public folder

3. **File Size Limits**:
   - Supabase has a default file size limit of 50MB
   - For better performance, keep images under 5MB by reducing quality

## Troubleshooting

### Common Issues

1. **Upload Failed: Network Error**
   - Check internet connection
   - Reduce image quality and dimensions
   - Try using a direct blob upload instead of base64

2. **Permission Denied**
   - Ensure the user is authenticated
   - Verify you're using the correct user ID in the path
   - Check that the first folder matches the user's ID

3. **Invalid Storage Path**
   - Use the storage helpers to build paths
   - Ensure the folder structure follows `userId/avatar/filename.jpg` pattern

### Getting Help

If you encounter issues with storage, check the Supabase logs in the dashboard or run the `check_storage_policies()` function to verify your RLS policies are correctly set up.