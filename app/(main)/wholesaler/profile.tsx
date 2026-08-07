import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  BackHandler,
  Animated,
  Dimensions,
  Platform
} from 'react-native';
import { Text, Button, Avatar, TextInput, Switch } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
// BlurView removed - using simple View styling instead
import * as Haptics from 'expo-haptics';
import { SystemStatusBar } from '../../../components/SystemStatusBar';
import { useAuthStore } from '../../../store/auth';
import { supabase } from '../../../services/supabase/supabase';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { decode } from 'base64-arraybuffer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguage } from '../../../contexts/LanguageContext';
import { translationService } from '../../../services/translationService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Premium color palette - refined and sophisticated
const PREMIUM_COLORS = {
  // Primary gradient colors
  gradientStart: '#1a1f38',
  gradientMid: '#242b4a',
  gradientEnd: '#2d3654',

  // Accent colors
  accent: '#6C63FF',
  accentLight: '#8B85FF',
  accentSoft: 'rgba(108, 99, 255, 0.15)',

  // Surface colors
  cardBg: 'rgba(255, 255, 255, 0.95)',
  cardBgDark: 'rgba(45, 54, 84, 0.9)',
  glassBg: 'rgba(255, 255, 255, 0.08)',

  // Text colors
  textPrimary: '#1A1A2E',
  textSecondary: '#6B7280',
  textLight: 'rgba(255, 255, 255, 0.9)',
  textMuted: 'rgba(255, 255, 255, 0.6)',

  // Status colors
  success: '#10B981',
  successLight: 'rgba(16, 185, 129, 0.1)',
  warning: '#F59E0B',
  error: '#EF4444',

  // Neutral colors
  border: 'rgba(0, 0, 0, 0.06)',
  divider: 'rgba(0, 0, 0, 0.04)',
  shadow: 'rgba(0, 0, 0, 0.08)',
};

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

  // Animation refs
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const cardAnimations = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

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
  const [loading, setLoading] = useState(false); // Start false - will be true only when fetching
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

  // Animate cards on mount
  useEffect(() => {
    Animated.stagger(100, [
      Animated.spring(cardAnimations[0], {
        toValue: 1,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.spring(cardAnimations[1], {
        toValue: 1,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.spring(cardAnimations[2], {
        toValue: 1,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    // CRITICAL: Don't fetch until we have a valid user ID
    if (!user?.id) {
      console.log('WholesalerProfile: Waiting for user ID...');
      setLoading(false); // Ensure not stuck in loading state
      return;
    }

    console.log('WholesalerProfile: User ID available, fetching profile');

    // IMMEDIATE: If user.seller_details is available, use it right away
    if (user.seller_details) {
      console.log('WholesalerProfile: Using seller_details from user object');
      const sellerData = user.seller_details;
      const profileImageUrl = sellerData.image_url || '';
      const phoneNumber = sellerData.phone_number || user.phone_number || '';

      setProfile({
        id: sellerData.id || '',
        business_name: sellerData.business_name || '',
        owner_name: sellerData.owner_name || '',
        phone_number: phoneNumber,
        email: user.email || '',
        address: sellerData.address || '',
        gst_number: sellerData.gst_number || '',
        business_license: sellerData.business_license || '',
        profile_image_url: profileImageUrl,
        verified: sellerData.verified || false,
        created_at: sellerData.created_at || '',
      });

      setForm({
        business_name: sellerData.business_name || '',
        owner_name: sellerData.owner_name || '',
        phone_number: phoneNumber,
        address: sellerData.address || '',
        gst_number: sellerData.gst_number || '',
      });

      setAvatarUrl(profileImageUrl);
      setLoading(false);
    }

    // Still fetch to get the latest data
    fetchProfile();
  }, [user?.id, user?.seller_details]);

  // Handle back button navigation for profile screen
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (router.canGoBack()) {
        router.back();
        return true;
      } else {
        router.replace('/(main)/wholesaler');
        return true;
      }
    });

    return () => backHandler.remove();
  }, [router]);

  const fetchProfile = async () => {
    // Guard: Don't fetch without user ID
    if (!user?.id) {
      console.log('fetchProfile: No user ID, skipping');
      return;
    }

    try {
      // Only show loading if we don't have any data yet
      if (!profile) {
        setLoading(true);
      }

      console.log('fetchProfile: Fetching from Supabase for user:', user.id);

      const { data: sellerData, error } = await supabase
        .from('seller_details')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('fetchProfile: Supabase error:', error);
        throw error;
      }

      console.log('fetchProfile: Got data:', sellerData?.business_name);

      let profilePhone = '';
      try {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('phone_number')
          .eq('id', user.id)
          .single();

        if (!profileError && profileData) {
          profilePhone = profileData.phone_number || '';
        }
      } catch (profileError) {
        console.log('Profile - Could not fetch phone from profiles table:', profileError);
      }

      if (sellerData) {
        const profileImageUrl = sellerData.image_url || '';
        const phoneNumber = sellerData.phone_number || profilePhone || '';

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
      // Only show error if we don't have fallback data
      if (!profile) {
        Alert.alert(translations.error, translations.failedToLoad);
      }
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    try {
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
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        try {
          const asset = result.assets[0];

          const manipulatedImage = await ImageManipulator.manipulateAsync(
            asset.uri,
            [{ resize: { width: 2000, height: 2000 } }],
            { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
          );

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

          const { error: updateError } = await supabase
            .from('seller_details')
            .update({ image_url: publicUrl })
            .eq('user_id', user?.id);

          if (updateError) throw updateError;

          setAvatarUrl(publicUrl);
          setUploading(false);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Build current values and requested changes objects
      const currentValues: Record<string, any> = {};
      const requestedChanges: Record<string, any> = {};

      // Check which fields have changed
      if (form.business_name !== profile?.business_name) {
        currentValues.business_name = profile?.business_name || '';
        requestedChanges.business_name = form.business_name;
      }
      if (form.owner_name !== profile?.owner_name) {
        currentValues.owner_name = profile?.owner_name || '';
        requestedChanges.owner_name = form.owner_name;
      }
      if (form.phone_number !== profile?.phone_number) {
        currentValues.phone_number = profile?.phone_number || '';
        requestedChanges.phone_number = form.phone_number;
      }
      if (form.gst_number !== profile?.gst_number) {
        currentValues.gst_number = profile?.gst_number || '';
        requestedChanges.gst_number = form.gst_number;
      }

      // Handle address comparison (could be object or string)
      const currentAddress = typeof profile?.address === 'object'
        ? JSON.stringify(profile?.address)
        : profile?.address || '';
      const newAddress = typeof form.address === 'object'
        ? JSON.stringify(form.address)
        : form.address || '';

      if (currentAddress !== newAddress) {
        currentValues.address = profile?.address || '';
        requestedChanges.address = form.address;
      }

      // If no changes, just close editing
      if (Object.keys(requestedChanges).length === 0) {
        setEditing(false);
        Alert.alert('No Changes', 'No changes were made to your profile.');
        return;
      }

      // Submit change request for approval
      const { error } = await supabase
        .from('profile_change_requests')
        .insert({
          user_id: user?.id,
          user_role: 'seller',
          current_values: currentValues,
          requested_changes: requestedChanges,
          status: 'pending'
        });

      if (error) throw error;

      // Reset form to current values (changes are pending)
      setForm({
        business_name: profile?.business_name || '',
        owner_name: profile?.owner_name || '',
        phone_number: profile?.phone_number || '',
        address: profile?.address || '',
        gst_number: profile?.gst_number || '',
      });

      setEditing(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Changes Submitted',
        'Your profile changes have been submitted for approval. You will be notified once they are reviewed.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error submitting profile changes:', error);
      Alert.alert(translations.error, translations.failedToUpdate);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
              await AsyncStorage.multiRemove([
                'auth_verified',
                'user_phone',
                'user_role',
                'user_id',
                'profile_id',
                'verificationId'
              ]);

              await supabase.auth.signOut();
              clearAuth();
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

      // Submit location change for approval
      const { error } = await supabase
        .from('profile_change_requests')
        .insert({
          user_id: user?.id,
          user_role: 'seller',
          current_values: {
            latitude: user?.latitude || null,
            longitude: user?.longitude || null
          },
          requested_changes: {
            latitude,
            longitude
          },
          status: 'pending'
        });

      if (error) throw error;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Location Update Submitted',
        'Your location update has been submitted for approval. You will be notified once it is reviewed.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error submitting location update:', error);
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

  const handleMenuItemPress = (route: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(route as any);
  };

  const handleToggleNotification = (key: keyof typeof notifications, value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setNotifications({ ...notifications, [key]: value });
  };

  // Render info row component
  const InfoRow = ({ icon, label, value }: { icon: string; label: string; value: string }) => (
    <View style={styles.infoRow}>
      <View style={styles.infoIconContainer}>
        <MaterialCommunityIcons name={icon as any} size={20} color={PREMIUM_COLORS.accent} />
      </View>
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value || 'Not provided'}</Text>
      </View>
    </View>
  );

  // Render menu item component
  const MenuItem = ({ icon, label, onPress, isDestructive = false }: {
    icon: string;
    label: string;
    onPress: () => void;
    isDestructive?: boolean;
  }) => (
    <TouchableOpacity
      style={styles.menuItem}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[
        styles.menuIconContainer,
        isDestructive && styles.menuIconDestructive
      ]}>
        <MaterialCommunityIcons
          name={icon as any}
          size={20}
          color={isDestructive ? PREMIUM_COLORS.error : PREMIUM_COLORS.accent}
        />
      </View>
      <Text style={[
        styles.menuLabel,
        isDestructive && styles.menuLabelDestructive
      ]}>
        {label}
      </Text>
      {!isDestructive && (
        <MaterialCommunityIcons
          name="chevron-right"
          size={20}
          color={PREMIUM_COLORS.textSecondary}
        />
      )}
    </TouchableOpacity>
  );

  // Render notification toggle component
  const NotificationToggle = ({
    label,
    description,
    value,
    onToggle
  }: {
    label: string;
    description: string;
    value: boolean;
    onToggle: (value: boolean) => void;
  }) => (
    <View style={styles.notificationRow}>
      <View style={styles.notificationInfo}>
        <Text style={styles.notificationLabel}>{label}</Text>
        <Text style={styles.notificationDescription}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        color={PREMIUM_COLORS.accent}
        style={styles.switch}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      <SystemStatusBar style="light" />

      {/* Header gradient background */}
      <LinearGradient
        colors={[PREMIUM_COLORS.gradientStart, PREMIUM_COLORS.gradientMid, PREMIUM_COLORS.gradientEnd]}
        style={styles.headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
      >
        {/* Header Section */}
        <View style={styles.headerSection}>
          {/* Back Button */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <View style={styles.backButtonInner}>
              <MaterialCommunityIcons name="arrow-left" size={22} color={PREMIUM_COLORS.textLight} />
            </View>
          </TouchableOpacity>

          <Text style={styles.headerTitle}>{translations.myProfile}</Text>

          {/* Profile Avatar Section */}
          <View style={styles.avatarSection}>
            <TouchableOpacity
              onPress={pickImage}
              disabled={uploading}
              activeOpacity={0.8}
            >
              <View style={styles.avatarWrapper}>
                <LinearGradient
                  colors={[PREMIUM_COLORS.accent, PREMIUM_COLORS.accentLight]}
                  style={styles.avatarGradientBorder}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <View style={styles.avatarInner}>
                    <Avatar.Image
                      size={100}
                      source={avatarUrl ? { uri: avatarUrl } : require('../../../assets/images/avatar.png')}
                    />
                  </View>
                </LinearGradient>

                {/* Camera button */}
                <TouchableOpacity
                  style={styles.cameraButton}
                  onPress={pickImage}
                  disabled={uploading}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={[PREMIUM_COLORS.accent, PREMIUM_COLORS.accentLight]}
                    style={styles.cameraButtonGradient}
                  >
                    <MaterialCommunityIcons
                      name={uploading ? "loading" : "camera"}
                      size={16}
                      color="#FFFFFF"
                    />
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>

            {/* Business Name */}
            <Text style={styles.businessName}>
              {profile?.business_name || translations.yourBusiness}
            </Text>

            {/* Verified Badge */}
            {profile?.verified && (
              <View style={styles.verifiedBadge}>
                <LinearGradient
                  colors={['rgba(16, 185, 129, 0.2)', 'rgba(16, 185, 129, 0.1)']}
                  style={styles.verifiedGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <MaterialCommunityIcons name="check-decagram" size={14} color={PREMIUM_COLORS.success} />
                  <Text style={styles.verifiedText}>{translations.verifiedWholesaler}</Text>
                </LinearGradient>
              </View>
            )}
          </View>
        </View>

        {/* Cards Container */}
        <View style={styles.cardsContainer}>
          {/* Business Information Card */}
          <Animated.View style={[
            styles.card,
            {
              opacity: cardAnimations[0],
              transform: [{
                translateY: cardAnimations[0].interpolate({
                  inputRange: [0, 1],
                  outputRange: [30, 0],
                })
              }]
            }
          ]}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleRow}>
                <View style={styles.cardIconContainer}>
                  <MaterialCommunityIcons name="store" size={18} color={PREMIUM_COLORS.accent} />
                </View>
                <Text style={styles.cardTitle}>{translations.businessInformation}</Text>
              </View>
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => setEditing(!editing)}
                activeOpacity={0.7}
              >
                <Text style={styles.editButtonText}>
                  {editing ? translations.cancel : translations.edit}
                </Text>
              </TouchableOpacity>
            </View>

            {!editing ? (
              <View style={styles.infoContainer}>
                <InfoRow icon="store" label={translations.businessName} value={profile?.business_name || ''} />
                <InfoRow icon="account" label={translations.ownerName} value={profile?.owner_name || ''} />
                <InfoRow icon="phone" label={translations.phoneNumber} value={profile?.phone_number || ''} />
                <InfoRow icon="email" label={translations.email} value={profile?.email || ''} />
                <InfoRow
                  icon="map-marker"
                  label={translations.address}
                  value={typeof profile?.address === 'object'
                    ? formatAddress(profile?.address)
                    : profile?.address || ''}
                />
                <InfoRow icon="file-document" label={translations.gstNumber} value={profile?.gst_number || ''} />
              </View>
            ) : (
              <View style={styles.editContainer}>
                <TextInput
                  label={translations.businessName}
                  value={form.business_name}
                  onChangeText={(text) => setForm({ ...form, business_name: text })}
                  style={styles.input}
                  mode="outlined"
                  outlineColor={PREMIUM_COLORS.border}
                  activeOutlineColor={PREMIUM_COLORS.accent}
                  theme={{ roundness: 12 }}
                />

                <TextInput
                  label={translations.ownerName}
                  value={form.owner_name}
                  onChangeText={(text) => setForm({ ...form, owner_name: text })}
                  style={styles.input}
                  mode="outlined"
                  outlineColor={PREMIUM_COLORS.border}
                  activeOutlineColor={PREMIUM_COLORS.accent}
                  theme={{ roundness: 12 }}
                />

                <TextInput
                  label={translations.phoneNumber}
                  value={form.phone_number}
                  onChangeText={(text) => setForm({ ...form, phone_number: text })}
                  style={styles.input}
                  mode="outlined"
                  keyboardType="phone-pad"
                  outlineColor={PREMIUM_COLORS.border}
                  activeOutlineColor={PREMIUM_COLORS.accent}
                  theme={{ roundness: 12 }}
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
                  outlineColor={PREMIUM_COLORS.border}
                  activeOutlineColor={PREMIUM_COLORS.accent}
                  theme={{ roundness: 12 }}
                />

                <TextInput
                  label={translations.gstNumber}
                  value={form.gst_number}
                  onChangeText={(text) => setForm({ ...form, gst_number: text })}
                  style={styles.input}
                  mode="outlined"
                  outlineColor={PREMIUM_COLORS.border}
                  activeOutlineColor={PREMIUM_COLORS.accent}
                  theme={{ roundness: 12 }}
                />

                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={handleSaveProfile}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={[PREMIUM_COLORS.accent, PREMIUM_COLORS.accentLight]}
                    style={styles.saveButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Text style={styles.saveButtonText}>{translations.saveChanges}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>

          {/* Notification Settings Card */}
          <Animated.View style={[
            styles.card,
            {
              opacity: cardAnimations[1],
              transform: [{
                translateY: cardAnimations[1].interpolate({
                  inputRange: [0, 1],
                  outputRange: [30, 0],
                })
              }]
            }
          ]}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleRow}>
                <View style={styles.cardIconContainer}>
                  <MaterialCommunityIcons name="bell-outline" size={18} color={PREMIUM_COLORS.accent} />
                </View>
                <Text style={styles.cardTitle}>{translations.notificationSettings}</Text>
              </View>
            </View>

            <View style={styles.notificationsContainer}>
              <NotificationToggle
                label={translations.orderUpdates}
                description={translations.orderUpdatesDescription}
                value={notifications.orderUpdates}
                onToggle={(value) => handleToggleNotification('orderUpdates', value)}
              />

              <View style={styles.divider} />

              <NotificationToggle
                label={translations.deliveryAlerts}
                description={translations.deliveryAlertsDescription}
                value={notifications.deliveryAlerts}
                onToggle={(value) => handleToggleNotification('deliveryAlerts', value)}
              />

              <View style={styles.divider} />

              <NotificationToggle
                label={translations.promotionsOffers}
                description={translations.promotionsOffersDescription}
                value={notifications.promotions}
                onToggle={(value) => handleToggleNotification('promotions', value)}
              />

              <View style={styles.divider} />

              <NotificationToggle
                label={translations.appUpdates}
                description={translations.appUpdatesDescription}
                value={notifications.appUpdates}
                onToggle={(value) => handleToggleNotification('appUpdates', value)}
              />
            </View>
          </Animated.View>

          {/* Account Card */}
          <Animated.View style={[
            styles.card,
            {
              opacity: cardAnimations[2],
              transform: [{
                translateY: cardAnimations[2].interpolate({
                  inputRange: [0, 1],
                  outputRange: [30, 0],
                })
              }]
            }
          ]}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleRow}>
                <View style={styles.cardIconContainer}>
                  <MaterialCommunityIcons name="account-cog-outline" size={18} color={PREMIUM_COLORS.accent} />
                </View>
                <Text style={styles.cardTitle}>{translations.account}</Text>
              </View>
            </View>

            <View style={styles.menuContainer}>
              <MenuItem
                icon="lock-outline"
                label={translations.changePassword}
                onPress={() => handleMenuItemPress('/(main)/wholesaler/change-password')}
              />

              <View style={styles.menuDivider} />

              <MenuItem
                icon="shield-check-outline"
                label={translations.privacyPolicy}
                onPress={() => handleMenuItemPress('/(main)/wholesaler/privacy')}
              />

              <View style={styles.menuDivider} />

              <MenuItem
                icon="file-document-outline"
                label={translations.termsOfService}
                onPress={() => handleMenuItemPress('/(main)/wholesaler/terms')}
              />

              <View style={styles.menuDivider} />

              <MenuItem
                icon="help-circle-outline"
                label={translations.helpSupport}
                onPress={() => handleMenuItemPress('/(main)/wholesaler/help')}
              />

              <View style={styles.menuDivider} />

              <MenuItem
                icon="web"
                label="Seller Web Portal"
                onPress={() => handleMenuItemPress('/(main)/wholesaler/seller-web-portal')}
              />

              <View style={styles.menuDivider} />

              <MenuItem
                icon="logout"
                label={translations.logout}
                onPress={handleLogout}
                isDestructive
              />
            </View>
          </Animated.View>

          {/* Version Footer */}
          <View style={styles.versionContainer}>
            <Text style={styles.versionText}>{translations.appVersion}</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FC',
  },
  headerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 320,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },

  // Header Section
  headerSection: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 20,
    zIndex: 10,
  },
  backButtonInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: PREMIUM_COLORS.textLight,
    textAlign: 'center',
    marginBottom: 24,
    letterSpacing: -0.5,
  },

  // Avatar Section
  avatarSection: {
    alignItems: 'center',
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 16,
  },
  avatarGradientBorder: {
    width: 112,
    height: 112,
    borderRadius: 56,
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInner: {
    width: 104,
    height: 104,
    borderRadius: 52,
    overflow: 'hidden',
    backgroundColor: PREMIUM_COLORS.cardBg,
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
  },
  cameraButtonGradient: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: PREMIUM_COLORS.gradientMid,
  },
  businessName: {
    fontSize: 22,
    fontWeight: '600',
    color: PREMIUM_COLORS.textLight,
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  verifiedBadge: {
    marginTop: 4,
  },
  verifiedGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  verifiedText: {
    fontSize: 13,
    fontWeight: '500',
    color: PREMIUM_COLORS.success,
  },

  // Cards Container
  cardsContainer: {
    paddingHorizontal: 16,
    marginTop: -20,
  },
  card: {
    backgroundColor: PREMIUM_COLORS.cardBg,
    borderRadius: 20,
    marginBottom: 16,
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: PREMIUM_COLORS.shadow,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 24,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: PREMIUM_COLORS.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: PREMIUM_COLORS.textPrimary,
    letterSpacing: -0.2,
  },
  editButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: PREMIUM_COLORS.accentSoft,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: PREMIUM_COLORS.accent,
  },

  // Info Section
  infoContainer: {
    gap: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: PREMIUM_COLORS.divider,
  },
  infoIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: PREMIUM_COLORS.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: PREMIUM_COLORS.textSecondary,
    marginBottom: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '500',
    color: PREMIUM_COLORS.textPrimary,
    letterSpacing: -0.2,
  },

  // Edit Mode
  editContainer: {
    gap: 12,
  },
  input: {
    backgroundColor: '#FFFFFF',
    fontSize: 15,
  },
  saveButton: {
    marginTop: 8,
    borderRadius: 14,
    overflow: 'hidden',
  },
  saveButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },

  // Notifications Section
  notificationsContainer: {
    gap: 0,
  },
  notificationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  notificationInfo: {
    flex: 1,
    marginRight: 16,
  },
  notificationLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: PREMIUM_COLORS.textPrimary,
    marginBottom: 3,
    letterSpacing: -0.2,
  },
  notificationDescription: {
    fontSize: 13,
    color: PREMIUM_COLORS.textSecondary,
    lineHeight: 18,
  },
  switch: {
    transform: [{ scaleX: 0.9 }, { scaleY: 0.9 }],
  },
  divider: {
    height: 1,
    backgroundColor: PREMIUM_COLORS.divider,
  },

  // Menu Section
  menuContainer: {
    gap: 0,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  menuIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: PREMIUM_COLORS.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  menuIconDestructive: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: PREMIUM_COLORS.textPrimary,
    letterSpacing: -0.2,
  },
  menuLabelDestructive: {
    color: PREMIUM_COLORS.error,
  },
  menuDivider: {
    height: 1,
    backgroundColor: PREMIUM_COLORS.divider,
    marginLeft: 50,
  },

  // Version
  versionContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  versionText: {
    fontSize: 13,
    color: PREMIUM_COLORS.textSecondary,
    fontWeight: '500',
  },
});
