import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Image, Platform, Alert } from 'react-native';
import { Text, Button, TextInput, HelperText } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { SystemStatusBar } from '../../components/SystemStatusBar';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase, authenticatedRequest } from '../../services/supabase/supabase';
import { useAuthStore } from '../../store/auth';
import { useLanguage } from '../../contexts/LanguageContext';
import { DocumentUpload } from '../../components/kyc/DocumentUpload';
import { decode } from 'base64-arraybuffer';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PermissionsAndroid } from 'react-native';
import { translationService } from '../../services/translationService';

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
}

export default function RetailerKYC() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
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

  // Original English text (never changes)
  const originalTexts = {
    permissionRequired: 'Permission Required',
    permissionToAccessCameraRollIsRequired: 'Permission to access camera roll is required!',
    completeProfile: 'Complete Profile',
    enterShopDetails: 'Enter your shop details to complete your profile',
    shopName: 'Shop Name',
    ownerName: 'Owner Name',
    shopAddress: 'Shop Address',
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
          const fileName = `shop_images/${user.id}_${Date.now()}.jpg`;
          
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
      
      const { data: directResult, error: directError } = await supabase
        .from('profiles')
        .update({
          business_details: businessDetails,
          shop_image: finalShopImageUrl,
          status: 'active' as 'pending' | 'active' | 'suspended'
        })
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
      
      // Last resort - update only business_details field
      console.log('Direct update failed, trying business_details only update...');
      const { data: bdResult, error: bdError } = await supabase
        .from('profiles')
        .update({ business_details: businessDetails })
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

  const validateForm = () => {
    const newErrors: Partial<RetailerKYCForm> = {};
    
    if (!form.shopName) newErrors.shopName = 'Shop name is required';
    if (!form.ownerName) newErrors.ownerName = 'Owner name is required';
    if (!form.address) newErrors.address = 'Address is required';
    if (!form.pincode) newErrors.pincode = 'Pincode is required';
    if (form.pincode && form.pincode.length !== 6) {
      newErrors.pincode = 'Enter valid 6-digit pincode';
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

  const requestPermissions = async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.CAMERA,
          PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
        ]);
        
        return (
          granted[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED &&
          granted[PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES] === PermissionsAndroid.RESULTS.GRANTED
        );
      } catch (err) {
        console.warn('Permission request error:', err);
        return false;
      }
    }
    return true; // iOS permissions are handled by the library
  };

  const handleShopImageUpload = async () => {
    try {
      console.log('=== SHOP IMAGE UPLOAD DEBUG START ===');
      console.log('User object:', JSON.stringify(user, null, 2));
      console.log('User ID:', user?.id);
      console.log('Current shop_image:', user?.shop_image);
      
      // Request permissions first
      console.log('=== STEP 1: REQUESTING PERMISSIONS ===');
      const hasPermissions = await requestPermissions();
      if (!hasPermissions) {
        console.log('❌ Permissions not granted');
        Alert.alert(
          'Permissions Required',
          'Camera and storage permissions are required to upload images. Please grant permissions in your device settings.',
          [{ text: 'OK' }]
        );
        return;
      }
      console.log('✅ Permissions granted');

      // Request permission to access media library
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.granted === false) {
        console.log('❌ Media library permission denied');
        Alert.alert(translations.permissionRequired, translations.permissionToAccessCameraRollIsRequired);
        return;
      }
      console.log('✅ Media library permission granted');

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
        const fileName = `shop_images/${user?.id || 'temp'}_${Date.now()}.jpg`;
        console.log('Upload file name:', fileName);
          
        const { error: uploadError } = await supabase.storage
          .from('shop-images')
          .upload(fileName, decode(base64FileData), {
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
    <SafeAreaView style={styles.safeArea}>
      <SystemStatusBar style="dark" />
      
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text variant="headlineMedium" style={styles.title}>
          {translations.completeProfile}
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          {translations.enterShopDetails}
        </Text>
        </View>

        <View style={styles.form}>
          <TextInput
            label={translations.shopName}
            value={form.shopName}
            onChangeText={(text) => setForm({ ...form, shopName: text })}
            style={styles.input}
            error={!!errors.shopName}
          />
          <HelperText type="error" visible={!!errors.shopName}>
            {errors.shopName}
          </HelperText>

          <TextInput
            label={translations.ownerName}
            value={form.ownerName}
            onChangeText={(text) => setForm({ ...form, ownerName: text })}
            style={styles.input}
            error={!!errors.ownerName}
          />
          <HelperText type="error" visible={!!errors.ownerName}>
            {errors.ownerName}
          </HelperText>

          <TextInput
            label={translations.shopAddress}
            value={form.address}
            onChangeText={(text) => setForm({ ...form, address: text })}
            style={styles.input}
            multiline
            numberOfLines={3}
            error={!!errors.address}
          />
          <HelperText type="error" visible={!!errors.address}>
            {errors.address}
          </HelperText>

          <TextInput
            label={translations.pincode}
            value={form.pincode}
            onChangeText={(text) => setForm({ ...form, pincode: text })}
            style={styles.input}
            keyboardType="numeric"
            error={!!errors.pincode}
          />
          <HelperText type="error" visible={!!errors.pincode}>
            {errors.pincode}
          </HelperText>

          <TextInput
            label={translations.gstNumberOptional}
            value={form.gstNumber}
            onChangeText={(text) => setForm({ ...form, gstNumber: text })}
            style={styles.input}
            error={!!errors.gstNumber}
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
            
            <View style={styles.imagePreview}>
              {form.shopImage ? (
                <Image source={{ uri: form.shopImage.uri }} style={styles.previewImage} />
              ) : (
                <View style={styles.placeholderImage}>
                  <Text>{translations.noImageSelected}</Text>
                </View>
              )}
            </View>
            
            <Button 
              mode="contained" 
              onPress={handleShopImageUpload}
              style={styles.uploadButton}
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
          >
            {translations.submit}
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
  },
  title: {
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    textAlign: 'center',
    opacity: 0.7,
  },
  form: {
    padding: 20,
  },
  input: {
    marginTop: 12,
  },
  submitButton: {
    marginTop: 24,
    marginBottom: 40,
    borderRadius: 20,
  },
  shopImageSection: {
    marginTop: 24,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  imagePreview: {
    width: '100%',
    height: 180,
    marginBottom: 16,
    borderRadius: 8,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    borderStyle: 'dashed',
  },
  uploadButton: {
    borderRadius: 8,
  },
});