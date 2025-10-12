import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Button, TextInput, HelperText, SegmentedButtons } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { SystemStatusBar } from '../../components/SystemStatusBar';
import { DocumentUpload } from '../../components/kyc/DocumentUpload';
import { BusinessForm } from '../../components/kyc/BusinessForm';
import { supabase } from '../../services/supabase/supabase';
import { useAuthStore } from '../../store/auth';
import { useLanguage } from '../../contexts/LanguageContext';
import { translationService } from '../../services/translationService';
import AsyncStorage from '@react-native-async-storage/async-storage';

type SellerType = 'wholesaler' | 'manufacturer';

interface SellerKYCForm {
  businessName: string;
  ownerName: string;
  sellerType: SellerType;
  yearsInBusiness: string;
  registrationNumber: string;
  gstNumber: string;
  address: {
    street: string;
    city: string;
    state: string;
    pincode: string;
  };
  imageUrl?: string;
}

export default function SellerKYC() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const { currentLanguage } = useLanguage();
  const setUser = useAuthStore((state) => state.setUser);
  const setSession = useAuthStore((state) => state.setSession);
  
  const [translations, setTranslations] = useState({});
  
  const originalTexts = {
    businessDetails: 'Business Details',
    provideWholesaleDetails: 'Provide your wholesale business details',
    businessName: 'Business Name',
    ownerName: 'Owner Name',
    typeOfSeller: 'Type of Seller',
    wholesaler: 'Wholesaler',
    manufacturer: 'Manufacturer',
    yearsInBusiness: 'Years in Business',
    registrationNumber: 'Registration Number',
    gstNumber: 'GST Number',
    businessAddress: 'Business Address',
    streetAddress: 'Street Address',
    city: 'City',
    state: 'State',
    pincode: 'Pincode',
    shopPhoto: 'Shop Photo',
    shopPhotoDescription: 'Upload a clear photo of your shop\'s front',
    takePhoto: 'Take Photo',
    chooseFile: 'Choose File',
    submit: 'Submit',
    businessNameRequired: 'Business name is required',
    ownerNameRequired: 'Owner name is required',
    yearsInBusinessRequired: 'Years in business is required',
    registrationNumberRequired: 'Registration number is required',
    gstNumberRequired: 'GST number is required',
    validGstNumber: 'Enter a valid GST number',
    allAddressFieldsRequired: 'All address fields are required',
    validPincode: 'Enter a valid 6-digit pincode',
    shopPhotoRequired: 'Shop photo is required',
    submitKycError: 'Failed to submit KYC details. Please try again.'
  };

  useEffect(() => {
    const loadTranslations = async () => {
      try {
        if (!currentLanguage || currentLanguage === 'en') {
          setTranslations(originalTexts);
          return;
        }

        // Translate each text individually using translateText method
        const translationPromises = Object.entries(originalTexts).map(async ([key, value]) => {
          const translated = await translationService.translateText(value, currentLanguage);
          return [key, translated.translatedText];
        });
        
        const translatedEntries = await Promise.all(translationPromises);
        const newTranslations = Object.fromEntries(translatedEntries);
        setTranslations(newTranslations);
      } catch (error) {
        console.error('Error loading translations:', error);
        setTranslations(originalTexts); // Fallback to original texts
      }
    };

    loadTranslations();
  }, [currentLanguage]);
  
  const [form, setForm] = useState<SellerKYCForm>({
    businessName: '',
    ownerName: '',
    sellerType: 'wholesaler',
    yearsInBusiness: '',
    registrationNumber: '',
    gstNumber: '',
    address: {
      street: '',
      city: '',
      state: '',
      pincode: '',
    },
    imageUrl: ''
  });

  const [errors, setErrors] = useState<Partial<Record<keyof SellerKYCForm | 'address', string>>>({});
  const [loading, setLoading] = useState(false);
  const [imageUploaded, setImageUploaded] = useState(false);

  const validateForm = () => {
    const newErrors: typeof errors = {};

    if (!form.businessName) newErrors.businessName = translations.businessNameRequired;
    if (!form.ownerName) newErrors.ownerName = translations.ownerNameRequired;
    if (!form.yearsInBusiness) newErrors.yearsInBusiness = translations.yearsInBusinessRequired;
    if (!form.registrationNumber) newErrors.registrationNumber = translations.registrationNumberRequired;
    if (!form.gstNumber) {
      newErrors.gstNumber = translations.gstNumberRequired;
    } else if (!/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$/.test(form.gstNumber)) {
      newErrors.gstNumber = translations.validGstNumber;
    }
    
    // Validate address
    if (!form.address.street || !form.address.city || 
        !form.address.state || !form.address.pincode) {
      newErrors.address = translations.allAddressFieldsRequired;
    } else if (form.address.pincode.length !== 6) {
      newErrors.address = translations.validPincode;
    }

    // Validate shop image - rely primarily on form.imageUrl as it's more reliable
    if (!form.imageUrl || form.imageUrl.trim() === '') {
      newErrors.imageUrl = translations.shopPhotoRequired;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    setLoading(true);
    try {
      console.log('Current user:', user);

      if (!user?.id) {
        throw new Error('User ID is missing. Please log in again.');
      }

      // Create seller details with image URL
      const insertData = {
          user_id: user.id,
          business_name: form.businessName,
          owner_name: form.ownerName,
          seller_type: form.sellerType,
          years_in_business: parseInt(form.yearsInBusiness),
          registration_number: form.registrationNumber,
          gst_number: form.gstNumber,
          address: form.address,
          image_url: form.imageUrl,
          status: 'pending'
      };
      
      console.log('Upserting seller details:', insertData);
      
      // Use upsert to handle existing records
      const { error: upsertError } = await supabase
        .from('seller_details')
        .upsert(insertData, {
          onConflict: 'user_id',
          ignoreDuplicates: false
        });

      if (upsertError) {
        console.error('Seller details upsert error:', upsertError);
        throw upsertError;
      }

      console.log('Seller details created/updated successfully');

      // Update profile status - split into separate update and fetch operations
      try {
        // First, just update the profile status
        const { error: updateError } = await supabase
        .from('profiles')
        .update({ status: 'active' })
          .eq('id', user.id);
  
        if (updateError) {
          console.warn('Warning: Failed to update profile status:', updateError);
          // Continue anyway, since the seller details were created successfully
        } else {
          console.log('Profile status updated to active');

          // Then fetch the updated profile separately
          const { data: updatedProfile, error: fetchError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();
            
          if (fetchError) {
            console.warn('Warning: Failed to fetch updated profile:', fetchError);
          } else if (updatedProfile) {
      // Update local state
            setUser(updatedProfile);
            console.log('Updated user state with latest profile data');
          }
        }
      } catch (profileError) {
        console.warn('Warning: Error in profile update process:', profileError);
        // Continue anyway - the important part (seller details) was successful
      }

      // Try to update the session state
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          console.warn('Warning: Failed to get updated session:', sessionError);
        } else if (session) {
      await setSession(session);
          console.log('Session state updated');
        }
      } catch (sessionError) {
        console.warn('Warning: Error updating session state:', sessionError);
        // Continue anyway
      }

      // Set auth_verified flag for persistent login
      await AsyncStorage.setItem('auth_verified', 'true');
      console.log('Set auth_verified flag after successful seller KYC');
      
      // Always redirect, even if some of the updates failed
      console.log('KYC submission was successful, redirecting to wholesaler home');
      router.replace('/(main)/wholesaler');

    } catch (error) {
      console.error('Error in seller KYC:', error);
      setErrors({ businessName: translations.submitKycError });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <SystemStatusBar style="dark" />
      
      <View style={styles.header}>
        <Text variant="headlineMedium" style={styles.title}>
          {translations.businessDetails}
        </Text>
        <Text variant="bodyLarge" style={styles.subtitle}>
          {translations.provideWholesaleDetails}
        </Text>
      </View>

      <View style={styles.form}>
        <TextInput
          mode="outlined"
          label={translations.businessName}
          value={form.businessName}
          onChangeText={(value) => setForm({ ...form, businessName: value })}
          error={!!errors.businessName}
        />
        {errors.businessName && (
          <HelperText type="error">{errors.businessName}</HelperText>
        )}
        
        <TextInput
          mode="outlined"
          label={translations.ownerName}
          value={form.ownerName}
          onChangeText={(value) => setForm({ ...form, ownerName: value })}
          error={!!errors.ownerName}
          style={styles.input}
        />
        {errors.ownerName && (
          <HelperText type="error">{errors.ownerName}</HelperText>
        )}

        <Text style={styles.label}>{translations.typeOfSeller}</Text>
        <SegmentedButtons
          value={form.sellerType}
          onValueChange={(value) => setForm({ ...form, sellerType: value as SellerType })}
          buttons={[
            { value: 'wholesaler', label: translations.wholesaler },
            { value: 'manufacturer', label: translations.manufacturer },
          ]}
          style={styles.sellerType}
        />

        <TextInput
          mode="outlined"
          label={translations.yearsInBusiness}
          value={form.yearsInBusiness}
          onChangeText={(value) => setForm({ ...form, yearsInBusiness: value.replace(/[^0-9]/g, '') })}
          keyboardType="number-pad"
          error={!!errors.yearsInBusiness}
          style={styles.input}
        />
        {errors.yearsInBusiness && (
          <HelperText type="error">{errors.yearsInBusiness}</HelperText>
        )}

        <TextInput
          mode="outlined"
          label={translations.registrationNumber}
          value={form.registrationNumber}
          onChangeText={(value) => setForm({ ...form, registrationNumber: value })}
          error={!!errors.registrationNumber}
          style={styles.input}
        />
        {errors.registrationNumber && (
          <HelperText type="error">{errors.registrationNumber}</HelperText>
        )}

        <TextInput
          mode="outlined"
          label={translations.gstNumber}
          value={form.gstNumber}
          onChangeText={(value) => setForm({ ...form, gstNumber: value.toUpperCase() })}
          error={!!errors.gstNumber}
          autoCapitalize="characters"
          style={styles.input}
        />
        {errors.gstNumber && (
          <HelperText type="error">{errors.gstNumber}</HelperText>
        )}

        <Text style={[styles.label, styles.addressLabel]}>{translations.businessAddress}</Text>
        
        <TextInput
          mode="outlined"
          label={translations.streetAddress}
          value={form.address.street}
          onChangeText={(value) => setForm({ 
            ...form, 
            address: { ...form.address, street: value }
          })}
          multiline
          numberOfLines={2}
          style={styles.input}
        />

        <TextInput
          mode="outlined"
          label={translations.city}
          value={form.address.city}
          onChangeText={(value) => setForm({ 
            ...form, 
            address: { ...form.address, city: value }
          })}
          style={styles.input}
        />

        <TextInput
          mode="outlined"
          label={translations.state}
          value={form.address.state}
          onChangeText={(value) => setForm({ 
            ...form, 
            address: { ...form.address, state: value }
          })}
          style={styles.input}
        />

        <TextInput
          mode="outlined"
          label={translations.pincode}
          value={form.address.pincode}
          onChangeText={(value) => setForm({ 
            ...form, 
            address: { ...form.address, pincode: value.replace(/[^0-9]/g, '') }
          })}
          keyboardType="number-pad"
          maxLength={6}
          style={styles.input}
        />
        {errors.address && (
          <HelperText type="error">{errors.address}</HelperText>
        )}

        <DocumentUpload
          type="shop_photo"
          title={translations.shopPhoto}
          description={translations.shopPhotoDescription}
          takePhotoText={translations.takePhoto}
          chooseFileText={translations.chooseFile}
          required
          style={styles.documentUpload}
          onUpload={async (doc) => {
            // Store the image URL in form state
            try {
              console.log('Document uploaded:', doc);
              setForm(prev => ({
                ...prev,
                imageUrl: doc.uri
              }));
              setImageUploaded(true);
              // Clear any existing image error when upload succeeds
              setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors.imageUrl;
                return newErrors;
              });
            } catch (err) {
              console.error('Error updating image URL in form:', err);
            }
          }}
        />
        {errors.imageUrl && (
          <HelperText type="error">{errors.imageUrl}</HelperText>
        )}

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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    padding: 20,
    paddingTop: 60,
  },
  title: {
    textAlign: 'center',
    marginBottom: 20,
  },
  form: {
    padding: 20,
  },
  input: {
    marginTop: 12,
  },
  label: {
    marginTop: 16,
    marginBottom: 8,
    opacity: 0.7,
  },
  addressLabel: {
    marginTop: 24,
  },
  sellerType: {
    marginBottom: 16,
  },
  documentUpload: {
    marginTop: 24,
  },
  submitButton: {
    marginTop: 32,
    marginBottom: 40,
    borderRadius: 20,
  },
});