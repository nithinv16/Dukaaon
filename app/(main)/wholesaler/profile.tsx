import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, BackHandler } from 'react-native';
import { Text, Card, Button, IconButton, Avatar, TextInput, Divider, Switch, List } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { SystemStatusBar } from '../../../components/SystemStatusBar';
import { useAuthStore } from '../../../store/auth';
import { supabase } from '../../../services/supabase/supabase';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { WHOLESALER_COLORS } from '../../../constants/colors';
import { decode } from 'base64-arraybuffer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguage } from '../../../contexts/LanguageContext';
import { translationService } from '../../../services/translationService';

interface WholesalerProfile {
  id: string;
  business_name: string;
  owner_name: string;
  phone_number: string;
  email: string;
  address: string;
  gst_number: string;
  business_license: string;
  profile_image_url: string;
  verified: boolean;
  created_at: string;
}

export default function WholesalerProfile() {
  const router = useRouter();
  const { user, clearAuth } = useAuthStore();
  const { currentLanguage } = useLanguage();
  const [translations, setTranslations] = useState({
    error: 'Error',
    success: 'Success',
    failedToLoad: 'Failed to load profile',
    permissionNeeded: 'Permission needed',
    cameraPermissionMessage: 'We need camera permission to update your profile picture',
    imageUpdatedSuccessfully: 'Profile image updated successfully',
    failedToUploadImage: 'Failed to upload image',
    unknownError: 'Unknown error',
    updatedSuccessfully: 'Profile updated successfully',
    failedToUpdate: 'Failed to update profile',
    confirmLogout: 'Confirm Logout',
    logoutConfirmation: 'Are you sure you want to logout?',
    cancel: 'Cancel',
    logout: 'Logout',
    failedToLogout: 'Failed to logout',
    locationPermissionRequired: 'Location permission is required',
    locationUpdatedSuccessfully: 'Location updated successfully',
    failedToUpdateLocation: 'Failed to update location',
    noAddressProvided: 'No address provided',
    addressFormatError: 'Address format error',
    myProfile: 'My Profile',
    yourBusiness: 'Your Business',
    verifiedWholesaler: 'Verified Wholesaler',
    businessInformation: 'Business Information',
    edit: 'Edit',
    businessName: 'Business Name',
    ownerName: 'Owner Name',
    phoneNumber: 'Phone Number',
    email: 'Email',
    address: 'Address',
    gstNumber: 'GST Number',
    saveChanges: 'Save Changes',
    notificationSettings: 'Notification Settings',
    orderUpdates: 'Order Updates',
    orderUpdatesDescription: 'Get notified about new orders and status changes',
    deliveryAlerts: 'Delivery Alerts',
    deliveryAlertsDescription: 'Receive alerts about delivery schedules and updates',
    promotionsOffers: 'Promotions & Offers',
    promotionsOffersDescription: 'Stay updated with special offers and promotions',
    appUpdates: 'App Updates',
    appUpdatesDescription: 'Get notified about new features and updates',
    account: 'Account',
    changePassword: 'Change Password',
    privacyPolicy: 'Privacy Policy',
    termsOfService: 'Terms of Service',
    helpSupport: 'Help & Support',
    appVersion: 'App Version 1.0.0'
  });

  useEffect(() => {
    const loadTranslations = async () => {
      try {
        const translatedTexts = await Promise.all([
          translationService.translateText('Error', currentLanguage),
          translationService.translateText('Success', currentLanguage),
          translationService.translateText('Failed to load profile', currentLanguage),
          translationService.translateText('Permission needed', currentLanguage),
          translationService.translateText('We need camera permission to update your profile picture', currentLanguage),
          translationService.translateText('Profile image updated successfully', currentLanguage),
          translationService.translateText('Failed to upload image', currentLanguage),
          translationService.translateText('Unknown error', currentLanguage),
          translationService.translateText('Profile updated successfully', currentLanguage),
          translationService.translateText('Failed to update profile', currentLanguage),
          translationService.translateText('Confirm Logout', currentLanguage),
          translationService.translateText('Are you sure you want to logout?', currentLanguage),
          translationService.translateText('Cancel', currentLanguage),
          translationService.translateText('Logout', currentLanguage),
          translationService.translateText('Failed to logout', currentLanguage),
          translationService.translateText('Location permission is required', currentLanguage),
          translationService.translateText('Location updated successfully', currentLanguage),
          translationService.translateText('Failed to update location', currentLanguage),
          translationService.translateText('No address provided', currentLanguage),
          translationService.translateText('Address format error', currentLanguage),
          translationService.translateText('My Profile', currentLanguage),
          translationService.translateText('Your Business', currentLanguage),
          translationService.translateText('Verified Wholesaler', currentLanguage),
          translationService.translateText('Business Information', currentLanguage),
          translationService.translateText('Edit', currentLanguage),
          translationService.translateText('Business Name', currentLanguage),
          translationService.translateText('Owner Name', currentLanguage),
          translationService.translateText('Phone Number', currentLanguage),
          translationService.translateText('Email', currentLanguage),
          translationService.translateText('Address', currentLanguage),
          translationService.translateText('GST Number', currentLanguage),
          translationService.translateText('Save Changes', currentLanguage),
          translationService.translateText('Notification Settings', currentLanguage),
          translationService.translateText('Order Updates', currentLanguage),
          translationService.translateText('Get notified about new orders and status changes', currentLanguage),
          translationService.translateText('Delivery Alerts', currentLanguage),
          translationService.translateText('Receive alerts about delivery schedules and updates', currentLanguage),
          translationService.translateText('Promotions & Offers', currentLanguage),
          translationService.translateText('Stay updated with special offers and promotions', currentLanguage),
          translationService.translateText('App Updates', currentLanguage),
          translationService.translateText('Get notified about new features and updates', currentLanguage),
          translationService.translateText('Account', currentLanguage),
          translationService.translateText('Change Password', currentLanguage),
          translationService.translateText('Privacy Policy', currentLanguage),
          translationService.translateText('Terms of Service', currentLanguage),
          translationService.translateText('Help & Support', currentLanguage),
          translationService.translateText('App Version 1.0.0', currentLanguage)
        ]);

        setTranslations({
          error: translatedTexts[0].translatedText,
          success: translatedTexts[1].translatedText,
          failedToLoad: translatedTexts[2].translatedText,
          permissionNeeded: translatedTexts[3].translatedText,
          cameraPermissionMessage: translatedTexts[4].translatedText,
          imageUpdatedSuccessfully: translatedTexts[5].translatedText,
          failedToUploadImage: translatedTexts[6].translatedText,
          unknownError: translatedTexts[7].translatedText,
          updatedSuccessfully: translatedTexts[8].translatedText,
          failedToUpdate: translatedTexts[9].translatedText,
          confirmLogout: translatedTexts[10].translatedText,
          logoutConfirmation: translatedTexts[11].translatedText,
          cancel: translatedTexts[12].translatedText,
          logout: translatedTexts[13].translatedText,
          failedToLogout: translatedTexts[14].translatedText,
          locationPermissionRequired: translatedTexts[15].translatedText,
          locationUpdatedSuccessfully: translatedTexts[16].translatedText,
          failedToUpdateLocation: translatedTexts[17].translatedText,
          noAddressProvided: translatedTexts[18].translatedText,
          addressFormatError: translatedTexts[19].translatedText,
          myProfile: translatedTexts[20].translatedText,
          yourBusiness: translatedTexts[21].translatedText,
          verifiedWholesaler: translatedTexts[22].translatedText,
          businessInformation: translatedTexts[23].translatedText,
          edit: translatedTexts[24].translatedText,
          businessName: translatedTexts[25].translatedText,
          ownerName: translatedTexts[26].translatedText,
          phoneNumber: translatedTexts[27].translatedText,
          email: translatedTexts[28].translatedText,
          address: translatedTexts[29].translatedText,
          gstNumber: translatedTexts[30].translatedText,
          saveChanges: translatedTexts[31].translatedText,
          notificationSettings: translatedTexts[32].translatedText,
          orderUpdates: translatedTexts[33].translatedText,
          orderUpdatesDescription: translatedTexts[34].translatedText,
          deliveryAlerts: translatedTexts[35].translatedText,
          deliveryAlertsDescription: translatedTexts[36].translatedText,
          promotionsOffers: translatedTexts[37].translatedText,
          promotionsOffersDescription: translatedTexts[38].translatedText,
          appUpdates: translatedTexts[39].translatedText,
          appUpdatesDescription: translatedTexts[40].translatedText,
          account: translatedTexts[41].translatedText,
          changePassword: translatedTexts[42].translatedText,
          privacyPolicy: translatedTexts[43].translatedText,
          termsOfService: translatedTexts[44].translatedText,
          helpSupport: translatedTexts[45].translatedText,
          appVersion: translatedTexts[46].translatedText
        });
      } catch (error) {
        console.error('Failed to load translations:', error);
      }
    };

    loadTranslations();
  }, [currentLanguage]);

  const [profile, setProfile] = useState<WholesalerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    business_name: '',
    owner_name: '',
    phone_number: '',
    address: '',
    gst_number: '',
  });
  const [notifications, setNotifications] = useState({
    orderUpdates: true,
    deliveryAlerts: true,
    promotions: false,
    appUpdates: true,
  });
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  // Handle back button navigation for profile screen
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // Navigate back to the previous screen instead of exiting the app
      if (router.canGoBack()) {
        router.back();
        return true; // Prevent default behavior
      } else {
        // If we can't go back, navigate to wholesaler home
        router.replace('/(main)/wholesaler');
        return true; // Prevent default behavior
      }
    });

    return () => backHandler.remove();
  }, [router]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      if (!user?.id) return;

      // Fetch seller details including image_url from seller_details table
      const { data: sellerData, error } = await supabase
        .from('seller_details')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;

      // Also fetch phone number from profiles table as fallback
      let profilePhone = '';
      try {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('phone_number')
          .eq('id', user.id)
          .single();
        
        if (!profileError && profileData) {
          profilePhone = profileData.phone_number || '';
          console.log('Profile - Fetched phone from profiles table:', profilePhone);
        }
      } catch (profileError) {
        console.log('Profile - Could not fetch phone from profiles table:', profileError);
      }

      if (sellerData) {
        console.log('Profile - Fetched seller details:', sellerData);
        console.log('Profile - Business name:', sellerData?.business_name);
        console.log('Profile - Owner name:', sellerData?.owner_name);
        console.log('Profile - Phone from seller_details:', sellerData?.phone_number);
        console.log('Profile - Phone from profiles table:', profilePhone);
        
        const profileImageUrl = sellerData.image_url || '';
        // Use phone from seller_details if available, otherwise use phone from profiles table
        const phoneNumber = sellerData.phone_number || profilePhone || '';
        console.log('Profile - Final phone number used:', phoneNumber);
        
        setProfile({
          id: sellerData.id,
          business_name: sellerData.business_name || '',
          owner_name: sellerData.owner_name || '',
          phone_number: phoneNumber,
          email: user.email || '',
          address: sellerData.address || '',
          gst_number: sellerData.gst_number || '',
          business_license: sellerData.business_license || '',
          profile_image_url: profileImageUrl,
          verified: sellerData.verified || false,
          created_at: sellerData.created_at,
        });

        setForm({
          business_name: sellerData.business_name || '',
          owner_name: sellerData.owner_name || '',
          phone_number: phoneNumber,
          address: sellerData.address || '',
          gst_number: sellerData.gst_number || '',
        });

        setAvatarUrl(profileImageUrl);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      Alert.alert(translations.error, translations.failedToLoad);
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(translations.permissionNeeded, translations.cameraPermissionMessage);
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setUploading(true);
        try {
          const asset = result.assets[0];
          
          // Resize image using ImageManipulator
          const manipulatedImage = await ImageManipulator.manipulateAsync(
            asset.uri,
            [{ resize: { width: 2000, height: 2000 } }],
            { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
          );
          
          // Convert to base64
          const response = await fetch(manipulatedImage.uri);
          const blob = await response.blob();
          const base64Image = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const result = reader.result as string;
              const base64Data = result.split(',')[1];
              resolve(base64Data);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          
          const filePath = `seller_${user?.id}/${Date.now()}.jpg`;
          
          const { error: uploadError } = await supabase.storage
            .from('profiles')
            .upload(filePath, decode(base64Image), {
              contentType: 'image/jpeg',
            });

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('profiles')
            .getPublicUrl(filePath);

          // Update the avatar URL in the seller_details table
          const { error: updateError } = await supabase
            .from('seller_details')
            .update({ image_url: publicUrl })
            .eq('user_id', user?.id);

          if (updateError) throw updateError;

          setAvatarUrl(publicUrl);
          setUploading(false);
          Alert.alert(translations.success, translations.imageUpdatedSuccessfully);
        } catch (error) {
          console.error('Error uploading image:', error);
          setUploading(false);
          Alert.alert(translations.error, translations.failedToUploadImage + ': ' + (error as any)?.message || translations.unknownError);
        }
      }
    } catch (error) {
      console.error('Error selecting image:', error);
      setUploading(false);
      Alert.alert(translations.error, translations.failedToUploadImage + ': ' + (error as any)?.message || translations.unknownError);
    }
  };

  const handleSaveProfile = async () => {
    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('seller_details')
        .update({
          business_name: form.business_name,
          owner_name: form.owner_name,
          phone_number: form.phone_number,
          address: form.address,
          gst_number: form.gst_number,
        })
        .eq('user_id', user?.id);

      if (error) throw error;
      
      // Update local state
      setProfile(prev => prev ? {
        ...prev,
        business_name: form.business_name,
        owner_name: form.owner_name,
        phone_number: form.phone_number,
        address: form.address,
        gst_number: form.gst_number,
      } : null);
      
      setEditing(false);
      Alert.alert(translations.success, translations.updatedSuccessfully);
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert(translations.error, translations.failedToUpdate);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      translations.confirmLogout,
      translations.logoutConfirmation,
      [
        { text: translations.cancel, style: 'cancel' },
        { 
          text: translations.logout, 
          style: 'destructive',
          onPress: async () => {
            try {
              // Clear AsyncStorage auth data first
              await AsyncStorage.multiRemove([
                'auth_verified',
                'user_phone',
                'user_role',
                'user_id',
                'profile_id',
                'verificationId'
              ]);
              
              // Sign out from Supabase
              await supabase.auth.signOut();
              
              // Clear auth state in the store
              clearAuth();
              
              // Navigate to language selection with replace to prevent back navigation
              router.replace('/(auth)/language');
            } catch (error) {
              console.error('Error during logout:', error);
              Alert.alert(translations.error, translations.failedToLogout);
            }
          }
        }
      ]
    );
  };

  const confirmLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        alert(translations.locationPermissionRequired);
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;

      const { error } = await supabase
        .from('profiles')
        .update({
          latitude,
          longitude,
          location_updated_at: new Date().toISOString(),
          is_location_public: true,
          location_verified: false,
          location_verification_status: 'pending',
        })
        .eq('id', user?.id);

      if (error) throw error;

      alert(translations.locationUpdatedSuccessfully);
    } catch (error) {
      console.error('Error confirming location:', error);
      alert(translations.failedToUpdateLocation);
    }
  };

  const formatAddress = (address: any) => {
    if (!address) return translations.noAddressProvided;
    
    try {
      if (typeof address === 'object') {
        const parts = [];
        if (address.street) parts.push(address.street);
        if (address.city) parts.push(address.city);
        if (address.state) parts.push(address.state);
        if (address.pincode) parts.push(address.pincode);
        
        return parts.join(', ') || translations.noAddressProvided;
      }
      
      return address.toString();
    } catch (error) {
      console.error('Error formatting address:', error);
      return translations.addressFormatError;
    }
  };

  const formatAddressForInput = (address: any) => {
    if (!address) return '';
    
    try {
      if (typeof address === 'object') {
        const parts = [];
        if (address.street) parts.push(address.street);
        if (address.city) parts.push(address.city);
        if (address.state) parts.push(address.state);
        if (address.pincode) parts.push(address.pincode);
        
        return parts.join(', ');
      }
      
      return address.toString();
    } catch (error) {
      console.error('Error formatting address for input:', error);
      return '';
    }
  };

  return (
    <View style={styles.container}>
      <SystemStatusBar style="dark" />
      
      <ScrollView style={styles.content}>
        <View style={styles.header}>
          <IconButton 
            icon="arrow-left" 
            onPress={() => router.back()} 
            color={WHOLESALER_COLORS.background}
            size={24}
          />
          <Text variant="titleLarge" style={styles.headerTitle}>{translations.myProfile}</Text>
          <View style={styles.headerRight} />
        </View>

        <View style={styles.profileHeader}>
          <View>
            <Avatar.Image 
              size={100} 
              source={avatarUrl ? { uri: avatarUrl } : require('../../../assets/images/avatar.png')} 
              style={styles.avatar}
            />
            <TouchableOpacity 
              style={styles.editAvatarButton}
              onPress={pickImage}
              disabled={uploading}
            >
              <MaterialCommunityIcons name="camera" size={16} color="white" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.profileInfo}>
            <Text variant="headlineSmall" style={styles.businessName}>
              {profile?.business_name || translations.yourBusiness}
            </Text>
            {profile?.verified && (
              <View style={styles.verifiedBadge}>
                <MaterialCommunityIcons name="check-decagram" size={16} color={WHOLESALER_COLORS.success} />
                <Text style={styles.verifiedText}>{translations.verifiedWholesaler}</Text>
              </View>
            )}
          </View>
        </View>

        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <Text variant="titleMedium" style={styles.sectionTitle}>{translations.businessInformation}</Text>
              {!editing ? (
                <Button 
                  mode="text" 
                  onPress={() => setEditing(true)}
                  icon="pencil"
                >
                  {translations.edit}
                </Button>
              ) : (
                <Button 
                  mode="text" 
                  onPress={() => setEditing(false)}
                  icon="close"
                >
                  {translations.cancel}
                </Button>
              )}
            </View>

            {!editing ? (
              <>
                <View style={styles.infoRow}>
                  <MaterialCommunityIcons name="store" size={24} color={WHOLESALER_COLORS.primary} />
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>{translations.businessName}</Text>
                    <Text style={styles.infoValue}>{profile?.business_name || 'Not provided'}</Text>
                  </View>
                </View>

                <View style={styles.infoRow}>
                  <MaterialCommunityIcons name="account" size={24} color={WHOLESALER_COLORS.primary} />
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>{translations.ownerName}</Text>
                    <Text style={styles.infoValue}>{profile?.owner_name || 'Not provided'}</Text>
                  </View>
                </View>

                <View style={styles.infoRow}>
                  <MaterialCommunityIcons name="phone" size={24} color={WHOLESALER_COLORS.primary} />
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>{translations.phoneNumber}</Text>
                    <Text style={styles.infoValue}>{profile?.phone_number || 'Not provided'}</Text>
                  </View>
                </View>

                <View style={styles.infoRow}>
                  <MaterialCommunityIcons name="email" size={24} color={WHOLESALER_COLORS.primary} />
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>{translations.email}</Text>
                    <Text style={styles.infoValue}>{profile?.email || 'Not provided'}</Text>
                  </View>
                </View>

                <View style={styles.infoRow}>
                  <MaterialCommunityIcons name="map-marker" size={24} color={WHOLESALER_COLORS.primary} />
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>{translations.address}</Text>
                    <Text style={styles.infoValue}>
                      {typeof profile?.address === 'object' 
                        ? formatAddress(profile?.address)
                        : profile?.address || 'No address provided'}
                    </Text>
                  </View>
                </View>

                <View style={styles.infoRow}>
                  <MaterialCommunityIcons name="file-document" size={24} color={WHOLESALER_COLORS.primary} />
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>{translations.gstNumber}</Text>
                    <Text style={styles.infoValue}>{profile?.gst_number || 'Not provided'}</Text>
                  </View>
                </View>
              </>
            ) : (
              <>
                <TextInput
                  label={translations.businessName}
                  value={form.business_name}
                  onChangeText={(text) => setForm({ ...form, business_name: text })}
                  style={styles.input}
                  mode="outlined"
                />
                
                <TextInput
                  label={translations.ownerName}
                  value={form.owner_name}
                  onChangeText={(text) => setForm({ ...form, owner_name: text })}
                  style={styles.input}
                  mode="outlined"
                />
                
                <TextInput
                  label={translations.phoneNumber}
                  value={form.phone_number}
                  onChangeText={(text) => setForm({ ...form, phone_number: text })}
                  style={styles.input}
                  mode="outlined"
                  keyboardType="phone-pad"
                />
                
                <TextInput
                  label={translations.address}
                  value={typeof form.address === 'object' 
                    ? formatAddressForInput(form.address) 
                    : form.address}
                  onChangeText={(text) => setForm({ ...form, address: text })}
                  style={styles.input}
                  mode="outlined"
                  multiline
                />
                
                <TextInput
                  label={translations.gstNumber}
                  value={form.gst_number}
                  onChangeText={(text) => setForm({ ...form, gst_number: text })}
                  style={styles.input}
                  mode="outlined"
                />
                
                <Button 
                  mode="contained" 
                  onPress={handleSaveProfile}
                  style={{ marginTop: 16 }}
                  loading={loading}
                  disabled={loading}
                >
                  {translations.saveChanges}
                </Button>
              </>
            )}
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>{translations.notificationSettings}</Text>
            
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>{translations.orderUpdates}</Text>
                <Text style={styles.settingDescription}>{translations.orderUpdatesDescription}</Text>
              </View>
              <Switch 
                value={notifications.orderUpdates} 
                onValueChange={(value) => setNotifications({ ...notifications, orderUpdates: value })}
                color={WHOLESALER_COLORS.primary}
              />
            </View>
            
            <Divider style={styles.divider} />
            
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>{translations.deliveryAlerts}</Text>
                <Text style={styles.settingDescription}>{translations.deliveryAlertsDescription}</Text>
              </View>
              <Switch 
                value={notifications.deliveryAlerts} 
                onValueChange={(value) => setNotifications({ ...notifications, deliveryAlerts: value })}
                color={WHOLESALER_COLORS.primary}
              />
            </View>
            
            <Divider style={styles.divider} />
            
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>{translations.promotionsOffers}</Text>
                <Text style={styles.settingDescription}>{translations.promotionsOffersDescription}</Text>
              </View>
              <Switch 
                value={notifications.promotions} 
                onValueChange={(value) => setNotifications({ ...notifications, promotions: value })}
                color={WHOLESALER_COLORS.primary}
              />
            </View>
            
            <Divider style={styles.divider} />
            
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>{translations.appUpdates}</Text>
                <Text style={styles.settingDescription}>{translations.appUpdatesDescription}</Text>
              </View>
              <Switch 
                value={notifications.appUpdates} 
                onValueChange={(value) => setNotifications({ ...notifications, appUpdates: value })}
                color={WHOLESALER_COLORS.primary}
              />
            </View>
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>{translations.account}</Text>
            
            <List.Item
              title={translations.changePassword}
              left={props => <List.Icon {...props} icon="lock" color={WHOLESALER_COLORS.primary} />}
              right={props => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => router.push('/(main)/wholesaler/change-password')}
              style={styles.listItem}
            />
            
            <List.Item
              title={translations.privacyPolicy}
              left={props => <List.Icon {...props} icon="shield-account" color={WHOLESALER_COLORS.primary} />}
              right={props => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => router.push('/(main)/wholesaler/privacy')}
              style={styles.listItem}
            />
            
            <List.Item
              title={translations.termsOfService}
              left={props => <List.Icon {...props} icon="file-document" color={WHOLESALER_COLORS.primary} />}
              right={props => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => router.push('/(main)/wholesaler/terms')}
              style={styles.listItem}
            />
            
            <List.Item
              title={translations.helpSupport}
              left={props => <List.Icon {...props} icon="help-circle" color={WHOLESALER_COLORS.primary} />}
              right={props => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => router.push('/(main)/wholesaler/help')}
              style={styles.listItem}
            />
            
            <List.Item
              title={translations.logout}
              left={props => <List.Icon {...props} icon="logout" color={WHOLESALER_COLORS.error} />}
              onPress={handleLogout}
              titleStyle={{ color: WHOLESALER_COLORS.error }}
              style={styles.listItem}
            />
          </Card.Content>
        </Card>
        
        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>{translations.appVersion}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: WHOLESALER_COLORS.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 0,
    backgroundColor: WHOLESALER_COLORS.headerBg,
    borderBottomWidth: 1,
    borderBottomColor: WHOLESALER_COLORS.lightGrey,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: WHOLESALER_COLORS.background,
  },
  headerRight: {
    width: 48,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    marginBottom: 12,
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 10,
    right: 0,
    backgroundColor: WHOLESALER_COLORS.primary,
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: WHOLESALER_COLORS.background,
  },
  profileInfo: {
    alignItems: 'center',
  },
  businessName: {
    fontWeight: '600',
    color: WHOLESALER_COLORS.darkGrey,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  verifiedText: {
    marginLeft: 4,
    color: WHOLESALER_COLORS.success,
    fontWeight: '500',
  },
  card: {
    marginBottom: 16,
    borderRadius: 8,
    backgroundColor: WHOLESALER_COLORS.background,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontWeight: '600',
    color: WHOLESALER_COLORS.darkGrey,
  },
  input: {
    marginBottom: 12,
    backgroundColor: WHOLESALER_COLORS.background,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  infoContent: {
    marginLeft: 12,
    flex: 1,
  },
  infoLabel: {
    color: WHOLESALER_COLORS.mediumGrey,
    fontSize: 12,
  },
  infoValue: {
    color: WHOLESALER_COLORS.darkGrey,
    fontWeight: '500',
    marginTop: 2,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontWeight: '500',
    color: WHOLESALER_COLORS.darkGrey,
  },
  settingDescription: {
    color: WHOLESALER_COLORS.mediumGrey,
    fontSize: 12,
    marginTop: 2,
  },
  divider: {
    marginVertical: 8,
  },
  listItem: {
    paddingLeft: 0,
  },
  versionContainer: {
    alignItems: 'center',
    marginVertical: 24,
  },
  versionText: {
    color: WHOLESALER_COLORS.mediumGrey,
    fontSize: 12,
  },
});
