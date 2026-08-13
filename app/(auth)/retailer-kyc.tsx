import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Image, Platform, Alert, Linking, Dimensions, Pressable } from 'react-native';
import { Text, Button, TextInput, HelperText, Surface } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { SystemStatusBar } from '../../components/SystemStatusBar';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Location from 'expo-location';
import { supabase, authenticatedRequest } from '../../services/supabase/supabase';
import { useAuthStore } from '../../store/auth';
import { useLanguage } from '../../contexts/LanguageContext';
import { DocumentUpload } from '../../components/kyc/DocumentUpload';
import { decode } from 'base64-arraybuffer';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translationService } from '../../services/translationService';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SimpleAuthLoader } from '../../services/auth/SimpleAuthLoader';

const RETAILER_COLORS = {
  primary: '#FF7D00',       // Vibrant Orange (App Theme)
  secondary: '#1A1A1A',     // Almost Black (App Theme)
  headerBg: '#FF7D00',      // Orange
  surface: '#FFF3E0',       // Soft Orange
  background: '#F8F9FA',    // Cool White/Grey (App Theme)
  text: '#333333',          // App Theme
  error: '#D32F2F',         // Red 700
  lightGrey: '#E0E0E0',     // Light Grey
  mediumGrey: '#9E9E9E',    // Medium Grey
  white: '#FFFFFF',
};

interface RetailerKYCForm {
  shopName: string;
  ownerName: string;
  address: string;
  pincode: string;
  gstNumber?: string;
  shopImage?: {
    uri: string;
    base64: string;
  };
  shopLocation?: {
    latitude: number;
    longitude: number;
    address: string;
  };
}

export default function RetailerKYC() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const { currentLanguage } = useLanguage();

  // Debug logging for initial state
  console.log('RetailerKYC - Component mounted with user:', user?.id);
  console.log('RetailerKYC - User role:', user?.role);
  console.log('RetailerKYC - User status:', user?.status);
  console.log('RetailerKYC - Business details:', JSON.stringify(user?.business_details || {}, null, 2));

  const [form, setForm] = useState<RetailerKYCForm>({
    shopName: '',
    ownerName: '',
    address: '',
    pincode: '',
    gstNumber: '',
  });
  const [errors, setErrors] = useState<Partial<RetailerKYCForm>>({});
  const [loading, setLoading] = useState(false);
  const [shopImageUrl, setShopImageUrl] = useState<string | null>(null);
  const [fetchingLocation, setFetchingLocation] = useState(false);

  // Handle role change - update database and navigate to login
  const handleChangeRole = async () => {
    try {
      if (user?.id) {
        console.log('Changing role for user:', user.id);

        // Clear business_details so user can re-enter KYC info
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            business_details: null,
            status: 'pending'
          })
          .eq('id', user.id);

        if (profileError) {
          console.error('Error clearing business_details in profile:', profileError);
        } else {
          console.log('Business_details cleared in profile successfully');
        }

        // Note: We don't update the role in database since user will select new role on login
        // The login flow will update the role when user proceeds
      }

      // CRITICAL: Sign out from Supabase to clear their persistent session
      // Without this, Supabase will restore the session on app restart
      console.log('Signing out from Supabase...');
      await supabase.auth.signOut();
      console.log('Supabase sign out complete');

      // Clear ALL cached auth data (this is the key fix for app restart issue)
      await SimpleAuthLoader.clearCachedAuth();
      console.log('SimpleAuthLoader cache cleared');

      // Clear role from AsyncStorage so login screen shows role selection
      await AsyncStorage.removeItem('user_role');

      // Clear user from store
      setUser(null);

      // Navigate to login
      router.replace('/(auth)/login');
    } catch (error) {
      console.error('Error during role change:', error);
      // Navigate anyway
      router.replace('/(auth)/login');
    }
  };

  // Original English text (never changes)
  const originalTexts = {
    permissionRequired: 'Permission Required',
    permissionToAccessCameraRollIsRequired: 'Permission to access camera roll is required!',
    completeProfile: 'Complete Profile',
    enterShopDetails: 'Enter your shop details to complete your profile',
    shopName: 'Shop Name',
    ownerName: 'Owner Name',
    shopAddress: 'Shop Address',
    shopLocation: 'Shop Location',
    fetchLocation: 'Fetch Shop Location',
    fetchingLocation: 'Fetching location...',
    locationNotice: 'Important: The location should be of your shop. Orders will be delivered to this address. Only fetch location when you are at your shop location.',
    pincode: 'Pincode',
    gstNumberOptional: 'GST Number (Optional)',
    uploadShopPhoto: 'Upload Shop Photo',
    shopPhotoDescription: 'Upload a clear photo of your shop\'s front',
    noImageSelected: 'No image selected',
    changeShopPhoto: 'Change Shop Photo',
    submit: 'Submit'
  };

  // Dynamic translations state
  const [translations, setTranslations] = useState(originalTexts);

  // Load translations when language changes
  useEffect(() => {
    const loadTranslations = async () => {
      if (currentLanguage === 'en') {
        setTranslations(originalTexts);
        return;
      }

      try {
        const translationPromises = Object.entries(originalTexts).map(async ([key, value]) => {
          const translated = await translationService.translateText(value, currentLanguage);
          return [key, translated.translatedText];
        });

        const translatedEntries = await Promise.all(translationPromises);
        const newTranslations = Object.fromEntries(translatedEntries);
        setTranslations(newTranslations);
      } catch (error) {
        console.error('Retailer KYC translation error:', error);
        setTranslations(originalTexts);
      }
    };

    loadTranslations();
  }, [currentLanguage]);

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);
    console.log('Starting KYC submission');

    try {
      // First, ensure we have the user data
      if (!user || !user.id) {
        console.error('User data is missing');
        setErrors({ shopName: 'User data is missing. Please log in again.' });
        setLoading(false);
        return;
      }

      console.log('Processing KYC submission for user ID:', user.id);

      // Upload shop image if available
      let finalShopImageUrl = shopImageUrl;

      if (form.shopImage?.base64) {
        try {
          console.log('Uploading shop image');
          const fileName = `${user.id}/shop_${Date.now()}.jpg`;

          const { error: uploadError } = await supabase.storage
            .from('shop-images')
            .upload(fileName, decode(form.shopImage.base64), {
              contentType: 'image/jpeg',
              upsert: true
            });

          if (uploadError) {
            console.error('Error uploading image:', uploadError);
            throw uploadError;
          }

          // Get public URL
          const { data: { publicUrl } } = supabase.storage
            .from('shop-images')
            .getPublicUrl(fileName);

          console.log('Image uploaded successfully. Public URL:', publicUrl);
          finalShopImageUrl = publicUrl;

          // Update shop_image field separately for better compatibility
          const { error: shopImageUpdateError } = await supabase
            .from('profiles')
            .update({ shop_image: publicUrl })
            .eq('id', user.id);

          if (shopImageUpdateError) {
            console.error('Error updating shop_image:', shopImageUpdateError);
          } else {
            console.log('Shop image URL updated successfully in profiles table');
          }
        } catch (imageError) {
          console.error('Error handling shop image:', imageError);
          // Continue without image if there's an error
        }
      }

      // Create business details data structure with proper formatting
      const businessDetails = prepareBusinessDetails(form, finalShopImageUrl);
      console.log('Prepared business_details for update:', JSON.stringify(businessDetails));

      // First execute the SQL file to create the function if it doesn't exist
      console.log('Creating/updating SQL function...');
      try {
        // Read the SQL file
        const sqlFile = `
        CREATE OR REPLACE FUNCTION public.update_profile_business_details(
          p_user_id UUID,
          p_shop_name TEXT,
          p_owner_name TEXT,
          p_address TEXT,
          p_pincode TEXT,
          p_gst_number TEXT DEFAULT NULL
        ) RETURNS JSONB AS $$
        DECLARE
          updated_user_id UUID;
          current_details JSONB;
          updated_details JSONB;
          result JSONB;
        BEGIN
          -- First, get current business_details if available
          SELECT id, business_details INTO updated_user_id, current_details
          FROM profiles
          WHERE id = p_user_id;
          
          IF updated_user_id IS NULL THEN
            RETURN jsonb_build_object(
              'success', false,
              'error', 'User not found'
            );
          END IF;
          
          -- Handle null business_details by creating an empty object
          IF current_details IS NULL THEN
            current_details := '{}'::jsonb;
          END IF;
          
          -- Create updated business_details JSON
          updated_details := jsonb_build_object(
            'shopName', p_shop_name,
            'ownerName', p_owner_name,
            'address', p_address,
            'pincode', p_pincode,
            'created_at', CURRENT_TIMESTAMP
          );
          
          -- Add GST number if provided
          IF p_gst_number IS NOT NULL THEN
            updated_details := updated_details || jsonb_build_object('gstNumber', p_gst_number);
          ELSE
            updated_details := updated_details || jsonb_build_object('gstNumber', null);
          END IF;
          
          -- Update the user profile
          UPDATE profiles
          SET 
            business_details = updated_details,
            status = 'active',
            updated_at = CURRENT_TIMESTAMP
          WHERE id = p_user_id
          RETURNING business_details INTO result;
          
          -- Return success result
          RETURN jsonb_build_object(
            'success', true,
            'business_details', result
          );
        EXCEPTION
          WHEN OTHERS THEN
            RETURN jsonb_build_object(
              'success', false,
              'error', SQLERRM,
              'details', 'SQL error occurred while updating business_details'
            );
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
        `;

        // Try to execute the SQL directly
        const { data: execResult, error: execError } = await supabase.rpc(
          'execute_sql_admin',
          { sql: sqlFile }
        );

        console.log('SQL function creation result:', execResult);
        if (execError) {
          console.log('SQL function creation error:', execError);
          // Continue anyway, the function might already exist
        }
      } catch (sqlError) {
        console.error('Error creating SQL function:', sqlError);
        // Continue anyway, as the function might already exist
      }

      // Now use our custom function to update the business_details
      console.log('Using custom function to update business_details...');

      const { data: updateResult, error: updateError } = await supabase.rpc(
        'update_profile_business_details',
        {
          p_user_id: user.id,
          p_shop_name: form.shopName,
          p_owner_name: form.ownerName,
          p_address: form.address,
          p_pincode: form.pincode,
          p_gst_number: form.gstNumber || null
        }
      );

      console.log('Custom function result:', updateResult);
      console.log('Custom function error:', updateError);

      if (!updateError && updateResult && updateResult.success) {
        console.log('Successfully updated business_details with custom function!');

        // Update shop location if provided
        if (form.shopLocation) {
          const { error: locationError } = await supabase
            .from('profiles')
            .update({
              latitude: form.shopLocation.latitude,
              longitude: form.shopLocation.longitude,
              location_address: form.shopLocation.address
            })
            .eq('id', user.id);

          if (locationError) {
            console.error('Error updating shop location:', locationError);
          } else {
            console.log('Shop location updated successfully');
          }
        }

        // Get the updated profile
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (!profileError && profileData) {
          // Update user in store
          useAuthStore.getState().setUser(profileData);
        } else {
          // Fallback to local state update
          useAuthStore.getState().setUser({
            ...user,
            status: 'active' as 'pending' | 'active' | 'suspended',
            business_details: businessDetails,
            shop_image: finalShopImageUrl
          });
        }

        // Set auth_verified flag for persistent login
        await AsyncStorage.setItem('auth_verified', 'true');
        console.log('Set auth_verified flag after successful KYC');

        // Redirect to home
        console.log('KYC submitted successfully, redirecting to home');
        router.replace('/(main)/home/');
        return;
      }

      // If the custom function failed, try other methods
      // Fallback to direct update
      console.log('Custom function failed, trying direct update...');

      // Prepare update data with location if available
      const updateData: any = {
          business_details: businessDetails,
          shop_image: finalShopImageUrl,
          status: 'active' as 'pending' | 'active' | 'suspended'
      };

      // Add shop location if provided
      if (form.shopLocation) {
        updateData.latitude = form.shopLocation.latitude;
        updateData.longitude = form.shopLocation.longitude;
        updateData.location_address = form.shopLocation.address;
      }

      const { data: directResult, error: directError } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user.id)
        .select('*');

      console.log('Direct update result:', directResult);
      console.log('Direct update error:', directError);

      if (!directError && directResult && directResult.length > 0) {
        console.log('Successfully updated profile with direct update!');

        // Update user in store
        useAuthStore.getState().setUser(directResult[0]);

        // Set auth_verified flag for persistent login
        await AsyncStorage.setItem('auth_verified', 'true');
        console.log('Set auth_verified flag after successful KYC (direct update)');

        // Redirect to home
        console.log('KYC submitted successfully with direct update, redirecting to home');
        router.replace('/(main)/home/');
        return;
      }

      // Last resort - update only business_details field and location
      console.log('Direct update failed, trying business_details only update...');
      const bdUpdateData: any = { business_details: businessDetails };
      if (form.shopLocation) {
        bdUpdateData.latitude = form.shopLocation.latitude;
        bdUpdateData.longitude = form.shopLocation.longitude;
        bdUpdateData.location_address = form.shopLocation.address;
      }
      const { data: bdResult, error: bdError } = await supabase
        .from('profiles')
        .update(bdUpdateData)
        .eq('id', user.id)
        .select('*');

      console.log('Business details only update result:', bdResult);
      console.log('Business details only update error:', bdError);

      if (!bdError && bdResult && bdResult.length > 0) {
        console.log('Successfully updated business_details only!');

        // Update user in store
        useAuthStore.getState().setUser(bdResult[0]);

        // Set auth_verified flag for persistent login
        await AsyncStorage.setItem('auth_verified', 'true');
        console.log('Set auth_verified flag after successful KYC (business_details only)');

        // Redirect to home
        console.log('KYC submitted successfully with business_details only, redirecting to home');
        router.replace('/(main)/home/');
        return;
      }

      // If all methods failed, notify the user and stay on the page
      console.error('All update methods failed!');
      setErrors({
        shopName: 'We had trouble updating your business details. Please try again or contact support.'
      });

      // Update local state only for testing but don't redirect
      useAuthStore.getState().setUser({
        ...user,
        status: 'active' as 'pending' | 'active' | 'suspended',
        business_details: businessDetails,
        shop_image: finalShopImageUrl
      });

    } catch (error) {
      console.error('Error submitting KYC:', error);
      setErrors({ shopName: 'Failed to submit KYC. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleFetchShopLocation = async () => {
    try {
      setFetchingLocation(true);
      
      // Request location permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          translations.permissionRequired,
          'Location permission is required to set your shop location.',
          [{ text: 'OK' }]
        );
        setFetchingLocation(false);
        return;
      }

      // Get current location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });

      // Reverse geocode to get address
      const reverseGeocode = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      });

      let formattedAddress = 'Address not found';
      if (reverseGeocode && reverseGeocode.length > 0) {
        const address = reverseGeocode[0];
        const addressParts = [
          address.name,
          address.street,
          address.city,
          address.region,
          address.postalCode,
          address.country
        ].filter(Boolean);
        formattedAddress = addressParts.join(', ');
      }

      // Update form with location
      setForm({
        ...form,
        shopLocation: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          address: formattedAddress
        }
      });

      setFetchingLocation(false);
    } catch (error) {
      console.error('Error fetching shop location:', error);
      Alert.alert('Error', 'Failed to fetch location. Please try again.');
      setFetchingLocation(false);
    }
  };

  const validateForm = () => {
    const newErrors: Partial<RetailerKYCForm> = {};

    if (!form.shopName) newErrors.shopName = 'Shop name is required';
    if (!form.ownerName) newErrors.ownerName = 'Owner name is required';
    if (!form.address) newErrors.address = 'Address is required';
    if (!form.pincode) newErrors.pincode = 'Pincode is required';
    if (form.pincode && form.pincode.length !== 6) {
      newErrors.pincode = 'Enter valid 6-digit pincode';
    }
    if (!form.shopLocation) {
      newErrors.shopLocation = 'Shop location is required. Please fetch your shop location.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const prepareBusinessDetails = (formData: RetailerKYCForm, imageUrl: string | null) => {
    // Create properly formatted business_details object with exact structure
    const businessDetails = {
      address: formData.address,
      pincode: formData.pincode,
      shopName: formData.shopName,
      gstNumber: formData.gstNumber || null,
      ownerName: formData.ownerName,
      created_at: new Date().toISOString()
    };

    // Check that business_details is properly formatted
    console.log('Business details object type:', typeof businessDetails);
    console.log('Business details stringified:', JSON.stringify(businessDetails));

    return businessDetails;
  };

  const logBusinessDetailsUpdate = async (userId: string, businessDetails: any) => {
    console.log('Attempting to directly log/verify business_details update...');
    try {
      // Check if the update worked by fetching the profile
      const { data: checkProfile, error: checkError } = await supabase
        .from('profiles')
        .select('business_details')
        .eq('id', userId)
        .single();

      if (checkError) {
        console.error('Error checking profile:', checkError);
      } else {
        console.log('Current business_details in database:', checkProfile?.business_details);
        console.log('Does it match what we want?',
          JSON.stringify(checkProfile?.business_details) === JSON.stringify(businessDetails));
      }
    } catch (e) {
      console.error('Error during verification check:', e);
    }
  };

  const handleShopImageUpload = async () => {
    try {
      console.log('=== SHOP IMAGE UPLOAD DEBUG START ===');
      console.log('User object:', JSON.stringify(user, null, 2));
      console.log('User ID:', user?.id);
      console.log('Current shop_image:', user?.shop_image);

      // First, check current permission status
      console.log('=== STEP 1: CHECKING MEDIA LIBRARY PERMISSIONS ===');
      const currentPermission = await ImagePicker.getMediaLibraryPermissionsAsync();
      console.log('Current permission status:', currentPermission);

      let permissionResult;

      // If permission is already granted, use it
      if (currentPermission.granted) {
        console.log('✅ Permission already granted');
        permissionResult = currentPermission;
      } else {
        // Request permission - this will show the popup if canAskAgain is true
        console.log('=== STEP 1.1: REQUESTING MEDIA LIBRARY PERMISSIONS ===');
        permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        console.log('Permission request result:', permissionResult);
      }

      if (permissionResult.granted === false) {
        console.log('❌ Media library permission denied');
        console.log('Can ask again:', permissionResult.canAskAgain);

        // If we can't ask again, user needs to go to settings
        if (permissionResult.canAskAgain === false) {
          Alert.alert(
            translations.permissionRequired,
            translations.permissionToAccessCameraRollIsRequired + '\n\nPlease enable the permission from Settings.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Open Settings',
                onPress: async () => {
                  try {
                    await Linking.openSettings();
                  } catch (error) {
                    console.error('Error opening settings:', error);
                    Alert.alert(
                      'Open Settings',
                      'Please go to Settings > Apps > [Your App] > Permissions and enable Storage/Photos permission.',
                      [{ text: 'OK' }]
                    );
                  }
                }
              }
            ]
          );
        } else {
          // Permission was just denied, show alert
          Alert.alert(
            translations.permissionRequired,
            translations.permissionToAccessCameraRollIsRequired,
            [{ text: 'OK' }]
          );
        }
        return;
      }
      console.log('✅ Media library permission granted');

      // For Android, also check camera permission if needed (for taking photos)
      if (Platform.OS === 'android') {
        try {
          const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
          if (!cameraPermission.granted) {
            console.log('⚠️ Camera permission not granted, but media library access is available');
          }
        } catch (err) {
          console.warn('Camera permission check error:', err);
          // Continue anyway as we can still pick from gallery
        }
      }

      console.log('=== STEP 2: LAUNCHING IMAGE PICKER ===');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      console.log('Image picker result:', JSON.stringify(result, null, 2));

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        console.log('✅ Image selected:', asset.uri);

        console.log('=== STEP 3: RESIZING IMAGE ===');
        // Resize the image
        const manipulatedImage = await ImageManipulator.manipulateAsync(
          asset.uri,
          [{ resize: { width: 2000, height: 2000 } }],
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );

        console.log('✅ Image resized successfully');
        console.log('Manipulated image URI:', manipulatedImage.uri);
        console.log('Base64 length:', manipulatedImage.base64?.length || 0);

        setForm({
          ...form,
          shopImage: {
            uri: manipulatedImage.uri,
            base64: manipulatedImage.base64 || ''
          }
        });

        console.log('=== STEP 4: UPLOADING TO STORAGE ===');
        // Upload immediately to get URL
        const base64FileData = manipulatedImage.base64;
        const fileName = `${user?.id || 'temp'}/shop_${Date.now()}.jpg`;
        console.log('Upload file name:', fileName);

        const { error: uploadError } = await supabase.storage
          .from('shop-images')
          .upload(fileName, decode(base64FileData || ''), {
            contentType: 'image/jpeg',
            upsert: true
          });

        if (uploadError) {
          console.error('❌ Error uploading shop image:', uploadError);
          console.error('Upload error details:', JSON.stringify(uploadError, null, 2));
        } else {
          console.log('✅ Image uploaded to storage successfully');

          console.log('=== STEP 5: GENERATING PUBLIC URL ===');
          // Get public URL
          const { data: { publicUrl } } = supabase.storage
            .from('shop-images')
            .getPublicUrl(fileName);

          console.log('✅ Generated public URL:', publicUrl);

          console.log('=== STEP 6: UPDATING DATABASE ===');
          // Update profile shop_image field directly 
          if (user?.id) {
            console.log('Updating shop_image in profiles table...');
            console.log('Parameters:', { id: user.id, shop_image: publicUrl });

            const { error: updateError } = await supabase
              .from('profiles')
              .update({ shop_image: publicUrl })
              .eq('id', user.id);

            if (updateError) {
              console.error('❌ Error updating shop_image in profile:', updateError);
              console.error('Update error details:', JSON.stringify(updateError, null, 2));
            } else {
              console.log('✅ Shop image URL updated successfully in profiles table');

              console.log('=== STEP 7: VERIFYING DATABASE UPDATE ===');
              // Verify the update by fetching the profile again
              const { data: verifyProfile, error: verifyError } = await supabase
                .from('profiles')
                .select('shop_image')
                .eq('id', user.id)
                .single();

              console.log('Verification query result:', verifyProfile);
              console.log('Verification error:', verifyError);

              if (verifyProfile) {
                console.log('✅ Database verification - shop_image:', verifyProfile.shop_image);
                if (verifyProfile.shop_image === publicUrl) {
                  console.log('✅ Database update CONFIRMED - URLs match!');
                } else {
                  console.log('❌ Database update FAILED - URLs do not match!');
                  console.log('Expected:', publicUrl);
                  console.log('Actual:', verifyProfile.shop_image);
                }
              }
            }
          } else {
            console.error('❌ User ID is missing, cannot update database');
          }
        }

        console.log('=== STEP 8: UPDATING LOCAL STATE ===');
        // Show user their image was uploaded successfully
        setShopImageUrl(manipulatedImage.uri);
        console.log('✅ Local state updated with image URI');
        console.log('=== SHOP IMAGE UPLOAD DEBUG END ===');
      } else {
        console.log('❌ Image selection was canceled or failed');
        console.log('=== SHOP IMAGE UPLOAD DEBUG END (CANCELED) ===');
      }
    } catch (error) {
      console.error('❌ Error selecting shop image:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      console.log('=== SHOP IMAGE UPLOAD DEBUG END (WITH ERROR) ===');
    }
  };

  return (
    <View style={styles.container}>
      <SystemStatusBar style="light" backgroundColor={RETAILER_COLORS.headerBg} />

      <View style={styles.headerContainer}>
        <LinearGradient
          colors={[RETAILER_COLORS.headerBg, '#E65100']}
          style={styles.headerGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <SafeAreaView edges={['top', 'left', 'right']}>
            {/* Back Button Row */}
            <View style={styles.backButtonRow}>
              <Pressable
                style={styles.backButton}
                onPress={handleChangeRole}
              >
                <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
                <Text style={styles.backButtonText}>Change Role</Text>
              </Pressable>
              <View style={styles.roleBanner}>
                <MaterialCommunityIcons name="cart" size={14} color={RETAILER_COLORS.primary} />
                <Text style={styles.roleBannerText}>RETAILER</Text>
              </View>
            </View>

            <View style={styles.headerContent}>
              <View style={styles.iconContainer}>
                <MaterialCommunityIcons name="store-plus" size={32} color={RETAILER_COLORS.white} />
              </View>
              <View>
                <Text variant="headlineSmall" style={styles.headerTitle}>
                  {translations.completeProfile}
                </Text>
                <Text variant="bodyMedium" style={styles.headerSubtitle}>
                  {translations.enterShopDetails}
                </Text>
              </View>
            </View>
          </SafeAreaView>
        </LinearGradient>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Surface style={styles.formCard} elevation={2}>
          <Text style={styles.sectionTitle}>{translations.shopName}</Text>
          <TextInput
            mode="outlined"
            label={translations.shopName}
            value={form.shopName}
            onChangeText={(text) => setForm({ ...form, shopName: text })}
            style={styles.input}
            error={!!errors.shopName}
            outlineStyle={styles.inputOutline}
            activeOutlineColor={RETAILER_COLORS.primary}
            left={<TextInput.Icon icon="store" color={RETAILER_COLORS.mediumGrey} />}
          />
          <HelperText type="error" visible={!!errors.shopName}>
            {errors.shopName}
          </HelperText>

          <TextInput
            mode="outlined"
            label={translations.ownerName}
            value={form.ownerName}
            onChangeText={(text) => setForm({ ...form, ownerName: text })}
            style={styles.input}
            error={!!errors.ownerName}
            outlineStyle={styles.inputOutline}
            activeOutlineColor={RETAILER_COLORS.primary}
            left={<TextInput.Icon icon="account" color={RETAILER_COLORS.mediumGrey} />}
          />
          <HelperText type="error" visible={!!errors.ownerName}>
            {errors.ownerName}
          </HelperText>

          <Text style={styles.label}>{translations.shopAddress}</Text>
          <TextInput
            mode="outlined"
            label={translations.shopAddress}
            value={form.address}
            onChangeText={(text) => setForm({ ...form, address: text })}
            style={styles.input}
            multiline
            numberOfLines={3}
            error={!!errors.address}
            outlineStyle={styles.inputOutline}
            activeOutlineColor={RETAILER_COLORS.primary}
            left={<TextInput.Icon icon="map-marker" color={RETAILER_COLORS.mediumGrey} />}
          />
          <HelperText type="error" visible={!!errors.address}>
            {errors.address}
          </HelperText>

          {/* Shop Location Section */}
          <Text style={styles.sectionTitle}>{translations.shopLocation}</Text>
          <View style={styles.locationNotice}>
            <MaterialCommunityIcons name="information" size={16} color={RETAILER_COLORS.primary} style={styles.noticeIcon} />
            <Text style={styles.noticeText}>{translations.locationNotice}</Text>
          </View>
          <View style={styles.locationContainer}>
            <TextInput
              mode="outlined"
              label={translations.shopLocation}
              value={form.shopLocation?.address || ''}
              editable={false}
              style={styles.input}
              error={!!errors.shopLocation}
              outlineStyle={styles.inputOutline}
              activeOutlineColor={RETAILER_COLORS.primary}
              left={<TextInput.Icon icon="map-marker" color={RETAILER_COLORS.mediumGrey} />}
            />
            <Button
              mode="contained"
              onPress={handleFetchShopLocation}
              loading={fetchingLocation}
              disabled={fetchingLocation}
              style={styles.fetchLocationButton}
              buttonColor={RETAILER_COLORS.primary}
              icon="crosshairs-gps"
            >
              {fetchingLocation ? translations.fetchingLocation : translations.fetchLocation}
            </Button>
          </View>
          <HelperText type="error" visible={!!errors.shopLocation}>
            {errors.shopLocation}
          </HelperText>

          <TextInput
            mode="outlined"
            label={translations.pincode}
            value={form.pincode}
            onChangeText={(text) => setForm({ ...form, pincode: text })}
            style={styles.input}
            keyboardType="numeric"
            maxLength={6}
            error={!!errors.pincode}
            outlineStyle={styles.inputOutline}
            activeOutlineColor={RETAILER_COLORS.primary}
            left={<TextInput.Icon icon="pin" color={RETAILER_COLORS.mediumGrey} />}
          />
          <HelperText type="error" visible={!!errors.pincode}>
            {errors.pincode}
          </HelperText>

          <TextInput
            mode="outlined"
            label={translations.gstNumberOptional}
            value={form.gstNumber}
            onChangeText={(text) => setForm({ ...form, gstNumber: text })}
            style={styles.input}
            error={!!errors.gstNumber}
            outlineStyle={styles.inputOutline}
            activeOutlineColor={RETAILER_COLORS.primary}
            left={<TextInput.Icon icon="file-document" color={RETAILER_COLORS.mediumGrey} />}
          />
          <HelperText type="error" visible={!!errors.gstNumber}>
            {errors.gstNumber}
          </HelperText>

          {/* Shop Image Upload */}
          <View style={styles.shopImageSection}>
            <Text style={styles.sectionTitle}>{translations.uploadShopPhoto}</Text>
            <Text style={styles.description}>
              {translations.shopPhotoDescription}
            </Text>

            <View style={styles.imagePreviewContainer}>
              {form.shopImage ? (
                <View style={styles.uploadedImageContainer}>
                  <Image source={{ uri: form.shopImage.uri }} style={styles.previewImage} />
                  <View style={styles.successBadge}>
                    <MaterialCommunityIcons name="check-circle" size={24} color={RETAILER_COLORS.primary} />
                  </View>
                </View>
              ) : (
                <View style={styles.placeholderImage}>
                  <MaterialCommunityIcons name="camera-plus" size={40} color={RETAILER_COLORS.mediumGrey} />
                  <Text style={styles.placeholderText}>{translations.noImageSelected}</Text>
                </View>
              )}
            </View>

            <Button
              mode="outlined"
              onPress={handleShopImageUpload}
              style={styles.uploadButton}
              icon="camera"
              textColor={RETAILER_COLORS.primary}
              contentStyle={{ height: 45 }}
            >
              {form.shopImage ? translations.changeShopPhoto : translations.uploadShopPhoto}
            </Button>
          </View>

          <Button
            mode="contained"
            onPress={handleSubmit}
            loading={loading}
            disabled={loading}
            style={styles.submitButton}
            contentStyle={{ height: 50 }}
            buttonColor={RETAILER_COLORS.primary}
          >
            {translations.submit}
          </Button>
        </Surface>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: RETAILER_COLORS.background,
  },
  headerContainer: {
    backgroundColor: RETAILER_COLORS.headerBg,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    zIndex: 1,
  },
  headerGradient: {
    paddingBottom: 24,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 10 : 0,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 10,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: 'rgba(255, 255, 255, 0.85)',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: RETAILER_COLORS.primary,
    marginBottom: 8,
    marginTop: 8,
  },
  input: {
    backgroundColor: '#fff',
    marginBottom: 4,
  },
  inputOutline: {
    borderRadius: 8,
    borderColor: RETAILER_COLORS.lightGrey,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginTop: 8,
    marginBottom: 8,
  },
  shopImageSection: {
    marginTop: 24,
    marginBottom: 16,
    backgroundColor: RETAILER_COLORS.background,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: RETAILER_COLORS.lightGrey,
    borderStyle: 'dashed',
  },
  description: {
    color: '#666',
    fontSize: 13,
    marginBottom: 16,
  },
  imagePreviewContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  uploadedImageContainer: {
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    resizeMode: 'cover',
    aspectRatio: 16 / 9,
  },
  successBadge: {
    position: 'absolute',
    top: -10,
    right: -10,
    backgroundColor: '#fff',
    borderRadius: 15,
  },
  placeholderImage: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    marginTop: 8,
    color: '#666',
  },
  uploadButton: {
    borderColor: RETAILER_COLORS.primary,
    borderWidth: 1,
  },
  locationNotice: {
    flexDirection: 'row',
    backgroundColor: RETAILER_COLORS.surface,
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: RETAILER_COLORS.primary,
  },
  noticeIcon: {
    marginRight: 8,
    marginTop: 2,
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
    color: RETAILER_COLORS.text,
    lineHeight: 18,
  },
  locationContainer: {
    marginBottom: 4,
  },
  fetchLocationButton: {
    marginTop: 8,
    borderRadius: 8,
  },
  submitButton: {
    marginTop: 24,
    marginBottom: 20,
    borderRadius: 12,
    elevation: 4,
  },
  backButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  roleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  roleBannerText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
});