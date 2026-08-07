import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Platform, Dimensions, Pressable } from 'react-native';
import { Text, Button, TextInput, HelperText, SegmentedButtons, Surface } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { SystemStatusBar } from '../../components/SystemStatusBar';
import { DocumentUpload } from '../../components/kyc/DocumentUpload';
import { BusinessForm } from '../../components/kyc/BusinessForm';
import { supabase } from '../../services/supabase/supabase';
import { useAuthStore } from '../../store/auth';
import { useLanguage } from '../../contexts/LanguageContext';
import { translationService } from '../../services/translationService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WHOLESALER_COLORS } from '../../constants/colors';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SimpleAuthLoader } from '../../services/auth/SimpleAuthLoader';

type SellerType = 'wholesaler' | 'manufacturer';

interface SellerKYCForm {
  businessName: string;
  ownerName: string;
  sellerType: SellerType;
  yearsInBusiness: string;
  registrationNumber: string;
  gstNumber: string;
  description: string;
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
    businessDescription: 'Business Description',
    businessDescriptionPlaceholder: 'Brief description of what your business specializes in',
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

  const [translations, setTranslations] = useState<any>(originalTexts);

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
    description: '',
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

  // Handle role change - update database and navigate to login
  const handleChangeRole = async () => {
    try {
      if (user?.id) {
        console.log('Changing role for user:', user.id);

        // Delete any existing seller_details for this user first
        const { error: sellerError } = await supabase
          .from('seller_details')
          .delete()
          .eq('user_id', user.id);

        if (sellerError) {
          console.log('No seller_details to delete or error:', sellerError);
        } else {
          console.log('Seller details deleted successfully');
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
        description: form.description,
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
    <View style={styles.container}>
      <SystemStatusBar style="light" backgroundColor={WHOLESALER_COLORS.headerBg} />

      <View style={styles.headerContainer}>
        <LinearGradient
          colors={[WHOLESALER_COLORS.headerBg, '#1E2738']}
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
                <MaterialCommunityIcons name="store" size={14} color={WHOLESALER_COLORS.secondary} />
                <Text style={styles.roleBannerText}>SELLER</Text>
              </View>
            </View>

            <View style={styles.headerContent}>
              <View style={styles.iconContainer}>
                <MaterialCommunityIcons name="store-cog" size={32} color={WHOLESALER_COLORS.secondary} />
              </View>
              <View>
                <Text variant="headlineSmall" style={styles.title}>
                  {translations.businessDetails}
                </Text>
                <Text variant="bodyMedium" style={styles.subtitle}>
                  {translations.provideWholesaleDetails}
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
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{translations.businessName}</Text>
          </View>

          <TextInput
            mode="outlined"
            label={translations.businessName}
            value={form.businessName}
            onChangeText={(value) => setForm({ ...form, businessName: value })}
            error={!!errors.businessName}
            style={styles.input}
            outlineStyle={styles.inputOutline}
            activeOutlineColor={WHOLESALER_COLORS.primary}
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
            outlineStyle={styles.inputOutline}
            activeOutlineColor={WHOLESALER_COLORS.primary}
            left={<TextInput.Icon icon="account" color={WHOLESALER_COLORS.mediumGrey} />}
          />
          {errors.ownerName && (
            <HelperText type="error">{errors.ownerName}</HelperText>
          )}

          <Text style={styles.label}>{translations.typeOfSeller}</Text>
          <SegmentedButtons
            value={form.sellerType}
            onValueChange={(value) => setForm({ ...form, sellerType: value as SellerType })}
            buttons={[
              {
                value: 'wholesaler',
                label: translations.wholesaler,
                icon: 'warehouse',
                style: form.sellerType === 'wholesaler' ? { backgroundColor: WHOLESALER_COLORS.selected } : {}
              },
              {
                value: 'manufacturer',
                label: translations.manufacturer,
                icon: 'factory',
                style: form.sellerType === 'manufacturer' ? { backgroundColor: WHOLESALER_COLORS.selected } : {}
              },
            ]}
            style={styles.sellerType}
            density="medium"
          />

          <View style={styles.row}>
            <View style={styles.halfInput}>
              <TextInput
                mode="outlined"
                label={translations.yearsInBusiness}
                value={form.yearsInBusiness}
                onChangeText={(value) => setForm({ ...form, yearsInBusiness: value.replace(/[^0-9]/g, '') })}
                keyboardType="number-pad"
                error={!!errors.yearsInBusiness}
                style={styles.input}
                outlineStyle={styles.inputOutline}
                activeOutlineColor={WHOLESALER_COLORS.primary}
              />
              {errors.yearsInBusiness && (
                <HelperText type="error">{errors.yearsInBusiness}</HelperText>
              )}
            </View>
          </View>

          <TextInput
            mode="outlined"
            label={translations.registrationNumber}
            value={form.registrationNumber}
            onChangeText={(value) => setForm({ ...form, registrationNumber: value })}
            error={!!errors.registrationNumber}
            style={styles.input}
            outlineStyle={styles.inputOutline}
            activeOutlineColor={WHOLESALER_COLORS.primary}
            left={<TextInput.Icon icon="file-certificate" color={WHOLESALER_COLORS.mediumGrey} />}
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
            outlineStyle={styles.inputOutline}
            activeOutlineColor={WHOLESALER_COLORS.primary}
            left={<TextInput.Icon icon="bank" color={WHOLESALER_COLORS.mediumGrey} />}
          />
          {errors.gstNumber && (
            <HelperText type="error">{errors.gstNumber}</HelperText>
          )}

          <TextInput
            mode="outlined"
            label={translations.businessDescription}
            value={form.description}
            onChangeText={(value) => setForm({ ...form, description: value })}
            placeholder={translations.businessDescriptionPlaceholder}
            multiline
            numberOfLines={3}
            style={[styles.input, styles.textArea]}
            outlineStyle={styles.inputOutline}
            activeOutlineColor={WHOLESALER_COLORS.primary}
          />
        </Surface>

        <Surface style={styles.formCard} elevation={2}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{translations.businessAddress}</Text>
          </View>

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
            outlineStyle={styles.inputOutline}
            activeOutlineColor={WHOLESALER_COLORS.primary}
            left={<TextInput.Icon icon="map-marker" color={WHOLESALER_COLORS.mediumGrey} />}
          />

          <View style={styles.row}>
            <View style={styles.halfInput}>
              <TextInput
                mode="outlined"
                label={translations.city}
                value={form.address.city}
                onChangeText={(value) => setForm({
                  ...form,
                  address: { ...form.address, city: value }
                })}
                style={styles.input}
                outlineStyle={styles.inputOutline}
                activeOutlineColor={WHOLESALER_COLORS.primary}
              />
            </View>
            <View style={styles.halfInput}>
              <TextInput
                mode="outlined"
                label={translations.state}
                value={form.address.state}
                onChangeText={(value) => setForm({
                  ...form,
                  address: { ...form.address, state: value }
                })}
                style={styles.input}
                outlineStyle={styles.inputOutline}
                activeOutlineColor={WHOLESALER_COLORS.primary}
              />
            </View>
          </View>

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
            outlineStyle={styles.inputOutline}
            activeOutlineColor={WHOLESALER_COLORS.primary}
            left={<TextInput.Icon icon="pin" color={WHOLESALER_COLORS.mediumGrey} />}
          />
          {errors.address && (
            <HelperText type="error">{errors.address}</HelperText>
          )}
        </Surface>

        <Surface style={styles.formCard} elevation={2}>
          <DocumentUpload
            type="shop_photo"
            title={translations.shopPhoto}
            description={translations.shopPhotoDescription}
            takePhotoText={translations.takePhoto}
            chooseFileText={translations.chooseFile}
            required
            style={styles.documentUpload}
            onUpload={async (doc) => {
              try {
                console.log('Document uploaded:', doc);
                setForm(prev => ({
                  ...prev,
                  imageUrl: doc.uri
                }));
                setImageUploaded(true);
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
        </Surface>

        <Button
          mode="contained"
          onPress={handleSubmit}
          loading={loading}
          disabled={loading}
          style={styles.submitButton}
          contentStyle={styles.submitButtonContent}
          labelStyle={styles.submitButtonLabel}
          buttonColor={WHOLESALER_COLORS.primary}
        >
          {translations.submit}
        </Button>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: WHOLESALER_COLORS.surface,
  },
  headerContainer: {
    backgroundColor: WHOLESALER_COLORS.headerBg,
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
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    color: '#fff',
    fontWeight: 'bold',
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
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
  sectionHeader: {
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: WHOLESALER_COLORS.primary,
  },
  input: {
    marginBottom: 12,
    backgroundColor: '#fff',
    fontSize: 15,
  },
  textArea: {
    minHeight: 80,
  },
  inputOutline: {
    borderRadius: 8,
    borderColor: '#E0E0E0',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginTop: 8,
    marginBottom: 8,
  },
  sellerType: {
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  documentUpload: {
    marginTop: 0,
  },
  submitButton: {
    marginTop: 8,
    marginBottom: 20,
    borderRadius: 12,
    elevation: 4,
  },
  submitButtonContent: {
    height: 50,
  },
  submitButtonLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
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
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
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