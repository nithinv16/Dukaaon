import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Share, Linking, ActivityIndicator, Pressable, Image, Alert, Platform } from 'react-native';
import { useEdgeToEdge, getSafeAreaStyles } from '../../../utils/android15EdgeToEdge';
import { SystemStatusBar } from '../../../components/SystemStatusBar';
import { Text, Card, Button, Avatar, List, Divider, IconButton } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useAuthStore } from '../../../store/auth';
import { supabase, storage } from '../../../services/supabase/supabase';
import { useWishlistStore } from '../../../store/wishlist';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { LinearGradient } from 'expo-linear-gradient';
import { decode } from 'base64-arraybuffer';
import { OrderTracking } from '../../../components/orders/OrderTracking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguage } from '../../../contexts/LanguageContext';
import { translationService } from '../../../services/translationService';
import { referralService, ReferralStats, ReferralSettings } from '../../../services/referralService';
// Firebase import removed - using Supabase auth only


interface KYCStatus {
  isSubmitted: boolean;
  isVerified: boolean;
  documents: {
    idProof: boolean;
    addressProof: boolean;
    businessProof: boolean;
  };
}

interface Order {
  id: string;
  order_number: string;
  created_at: string;
  status: string;
  total_amount: number;
  items: any[];
}

const ACTIVE_STATUSES = ['placed', 'pending', 'confirmed', 'accepted', 'processing', 'picked_up', 'in_transit', 'out_for_delivery', 'shipped'];

// Tracking Step Component
const TrackingStep = ({ status, currentStatus, isLast, icon }: { status: string, currentStatus: string, isLast: boolean, icon: string }) => {
  // Define granular milestones
  const steps = ['placed', 'confirmed', 'picked_up', 'in_transit', 'delivered'];

  // Map incoming order status to a specific progress index (0 to 4)
  const getStepIndex = (s: string) => {
    const status = s?.toLowerCase()?.trim();
    // 0: Placed (placed, pending, draft)
    if (['placed', 'pending', 'draft'].includes(status)) return 0;
    // 1: Confirmed (confirmed, accepted, preparing, ready)
    if (['confirmed', 'accepted', 'preparing', 'ready'].includes(status)) return 1;
    // 2: Picked Up (processing, picked_up)
    if (['processing', 'picked_up'].includes(status)) return 2;
    // 3: In Transit (shipped, in_transit, out_for_delivery, intransit)
    if (['shipped', 'in_transit', 'out_for_delivery', 'intransit'].includes(status)) return 3;
    // 4: Delivered (delivered, completed)
    if (['delivered', 'completed'].includes(status)) return 4;
    return 0; // Default to start
  };

  const currentIndex = getStepIndex(currentStatus);
  const stepIndex = steps.indexOf(status);

  // A step is active if we passed it or are currently on it
  const isActive = stepIndex <= currentIndex;
  // A step is the *current* one if it matches the index exactly
  const isCurrent = stepIndex === currentIndex;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', flex: isLast ? 0 : 1 }}>
      {/* Icon + Dot Container */}
      <View style={{ alignItems: 'center' }}>
        {isActive ? (
          <View style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            backgroundColor: '#FF7D00',
            justifyContent: 'center',
            alignItems: 'center',
            elevation: isCurrent ? 4 : 2,
            shadowColor: '#FF7D00',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.3,
            shadowRadius: 4,
          }}>
            <IconButton icon={icon} size={14} iconColor="#FFF" style={{ margin: 0 }} />
          </View>
        ) : (
          <View style={{
            width: 12,
            height: 12,
            borderRadius: 6,
            backgroundColor: '#E0E0E0',
          }} />
        )}
      </View>

      {/* Line */}
      {!isLast && (
        <View style={{
          flex: 1,
          height: 2,
          backgroundColor: stepIndex < currentIndex ? '#FF7D00' : '#E0E0E0',
          marginHorizontal: 4,
        }} />
      )}
    </View>
  );
};

export default React.memo(function Profile() {
  const router = useRouter();
  const user = useAuthStore(state => state.user);
  const setUser = useAuthStore(state => state.setUser);
  const insets = useEdgeToEdge({ statusBarStyle: 'dark' });
  const { currentLanguage } = useLanguage();

  // Define original texts for translation
  const originalTexts = {
    error: 'Error',
    userIdNotFound: 'User ID not found. Please try logging in again.',
    permissionsRequired: 'Permissions Required',
    mediaPermissionsMessage: 'Media library permissions are required to select images. Please grant permissions in your device settings.',
    ok: 'OK',
    orderHash: 'Order #',
    delivered: 'delivered',
    processing: 'processing',
    shipped: 'shipped',
    uploadShopImage: 'Upload Shop Image',
    retry: 'Retry',
    loading: 'Loading',
    unableToLoadProfile: 'Unable to load profile',
    addCoverPhoto: 'Add a cover photo',
    noShopImage: 'No shop image',
    yourShop: 'Your Shop',
    kycVerification: 'KYC Verification',
    kycVerified: 'KYC Verified',
    kycSubmitted: 'KYC Submitted',
    kycNotSubmitted: 'KYC Not Submitted',
    kycUnderReview: 'KYC Under Review',
    completeKycToVerify: 'Complete KYC to verify your account',
    viewStatus: 'View Status',
    completeKyc: 'Complete KYC',
    checkCreditScore: 'Check Credit Score',
    viewEligibility: 'View Eligibility',
    myOrders: 'My Orders',
    trackOrders: 'Track Orders',
    recentOrders: 'Recent Orders',
    noRecentOrders: 'No recent orders',
    viewAndTrackOrderStatus: 'View and track your order status',
    viewAllOrders: 'View all orders',
    myWishlist: 'My Wishlist',
    viewAllWishlist: 'View all wishlist items',
    helpSupport: 'Help & Support',
    getHelpAndSupport: 'Get help and support',
    aboutUs: 'About Us',
    learnMoreAboutUs: 'Learn more about us',
    settings: 'Settings',
    logout: 'Logout',
    anErrorOccurred: 'An error occurred',
    loadingProfile: 'Loading profile...',
    referAndEarn: 'Refer & Earn',
    referFriendsEarnRewards: 'Refer friends and earn rewards',
    share: 'Share',
    noItemsInWishlist: 'No items in wishlist',
    // Alert messages
    navigationError: 'Navigation Error',
    couldNotNavigateToKyc: 'Could not navigate to KYC screen',
    creditScore: 'Credit Score',
    notAvailableRightNow: 'Not available right now',
    eligibility: 'Eligibility',
    couldNotNavigateToScreen: 'Could not navigate to screen',
    imageSelectionFailed: 'Image selection failed',
    success: 'Success',
    imageUploadedSuccessfully: 'Image uploaded successfully',
    imageUploadError: 'Image upload error',
    unknownError: 'Unknown error',
    logoutFailed: 'Logout failed. Please try again.',
    itemsSaved: 'items saved',
    product: 'Product',
    more: 'more',
    unableToDisplayWishlist: 'Unable to display wishlist',
    helpAndSupport: 'Help & Support'
  };

  // State for translations
  const [translations, setTranslations] = useState(originalTexts);

  // Load translations when language changes
  useEffect(() => {
    const loadTranslations = async () => {
      try {
        if (!currentLanguage || currentLanguage === 'en') {
          setTranslations(originalTexts);
          return;
        }

        // Translate each text individually using translateText method (like stock screen)
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

  // Translation function
  const getTranslatedText = (key: string) => {
    return translations[key as keyof typeof translations] || key;
  };

  const [loading, setLoading] = useState(true);
  const [kycStatus, setKycStatus] = useState<KYCStatus>({
    isSubmitted: false,
    isVerified: false,
    documents: {
      idProof: false,
      addressProof: false,
      businessProof: false,
    }
  });
  const wishlistItems = useWishlistStore(state => state.items);
  const loadWishlist = useWishlistStore(state => state.loadWishlist);
  const clearAuth = useAuthStore(state => state.clearAuth);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [imageUploadInProgress, setImageUploadInProgress] = useState(false);

  // Referral state
  const [referralStats, setReferralStats] = useState<ReferralStats | null>(null);
  const [referralSettings, setReferralSettings] = useState<ReferralSettings | null>(null);
  const [referralLoading, setReferralLoading] = useState(false);

  // Fetch referral data
  const fetchReferralData = async () => {
    if (!user?.id) return;
    try {
      setReferralLoading(true);
      const [stats, settings] = await Promise.all([
        referralService.getUserReferralStats(user.id),
        referralService.getReferralSettings(),
      ]);
      setReferralStats(stats);
      setReferralSettings(settings);
    } catch (error) {
      console.error('Error fetching referral data:', error);
    } finally {
      setReferralLoading(false);
    }
  };

  // Fetch user profile data
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        await fetchUserProfile();
        await fetchActiveOrders();
        await fetchRecentOrders();
        await fetchReferralData();
        try {
          await loadWishlist();
        } catch (wishlistError) {
          console.error('Error loading wishlist:', wishlistError);
        }
      } catch (error) {
        console.error('Error loading initial profile data:', error);
      }
    };

    loadInitialData();
  }, []);

  const fetchUserProfile = async () => {
    try {
      if (!user?.id) {
        console.log('No user ID available when fetching profile');
        setLoading(false);
        return;
      }

      console.log('Fetching profile for user ID:', user.id);
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        return;
      }

      if (profile) {
        setUser(profile);
        // Update KYC status based on profile data
        // Check if all three documents are uploaded
        const hasIdProof = !!profile.id_proof;
        const hasAddressProof = !!profile.address_proof;
        const hasBusinessProof = !!profile.business_proof;
        const allDocumentsSubmitted = hasIdProof && hasAddressProof && hasBusinessProof;

        setKycStatus({
          isSubmitted: allDocumentsSubmitted,
          isVerified: profile.kyc_status === true,
          documents: {
            idProof: hasIdProof,
            addressProof: hasAddressProof,
            businessProof: hasBusinessProof,
          }
        });
      }
    } catch (error) {
      console.error('Error in fetchUserProfile:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveOrders = async () => {
    try {
      if (!user?.id) return;

      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ACTIVE_STATUSES)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching active orders:', error);
        return;
      }

      // Filter out failed/abandoned online payment orders (same logic as orders screen)
      // Always show COD/cash orders and placed orders
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const filteredOrders = (data || []).filter(order => {
        const status = order.status?.toLowerCase()?.trim();
        const paymentMethod = order.payment_method?.toLowerCase()?.trim();

        // Orders with 'placed' status are confirmed orders - always show them
        if (status === 'placed') {
          return true;
        }

        // Always show COD/cash/online orders (including null/undefined which defaults to COD)
        // COD can be stored as 'cod', 'cash', or not set at all
        if (!paymentMethod || paymentMethod === 'cod' || paymentMethod === 'cash' || paymentMethod === 'online') {
          return true;
        }

        // Show non-pending payment orders (completed payments)
        if (order.payment_status !== 'pending') {
          return true;
        }

        // Show pending online payment orders created within last 5 minutes
        // (User might still be completing payment)
        const orderDate = new Date(order.created_at);
        if (orderDate > fiveMinutesAgo) {
          return true;
        }

        // Filter out old pending online payment orders (abandoned/failed payments)
        return false;
      });

      setActiveOrders(filteredOrders);
    } catch (error) {
      console.error('Error in fetchActiveOrders:', error);
    }
  };

  const fetchRecentOrders = async () => {
    try {
      if (!user?.id) {
        console.log('No user ID available when fetching recent orders');
        return;
      }

      console.log('Fetching recent orders for user ID:', user.id);
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(3);

      if (error) {
        console.error('Error fetching recent orders:', error);
        return;
      }

      setRecentOrders(data || []);
    } catch (error) {
      console.error('Error fetching recent orders:', error);
      setRecentOrders([]);
    }
  };

  // Use referral code from stats (fetched from DB) or generate fallback
  const referralCode = referralStats?.referral_code || (user?.id ? ('DUK' + user.id.substring(0, 6).toUpperCase()) : 'DUKAREF');

  // Get reward amount from settings
  const referralRewardAmount = referralSettings?.referrer_reward?.amount || 100;
  const refereeRewardAmount = referralSettings?.referee_reward?.amount || 50;

  // Get dynamic UI content from settings (with language support)
  const getBannerTitle = () => {
    return referralSettings?.ui_banner_title?.[currentLanguage] ||
      referralSettings?.ui_banner_title?.['en'] ||
      translations.referAndEarn;
  };

  const getBannerSubtitle = () => {
    return referralSettings?.ui_banner_subtitle?.[currentLanguage] ||
      referralSettings?.ui_banner_subtitle?.['en'] ||
      referralSettings?.referrer_reward?.description ||
      `Get ₹${referralRewardAmount} when your friend places their first order`;
  };

  // Get banner colors from settings
  const bannerColors = referralSettings?.ui_banner_colors || {
    gradient_start: '#FF9800',
    gradient_end: '#F57C00',
    text_color: '#FFFFFF',
    code_bg_color: '#FFFFFF',
    code_text_color: '#2575FC',
  };

  const handleShare = async () => {
    try {
      const { message } = await referralService.generateShareMessage(referralCode, currentLanguage);
      const result = await Share.share({
        message,
        title: 'Share dukaaOn App',
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleCopyCode = async () => {
    try {
      // Use Share API as a fallback since it's more reliable
      await Share.share({
        message: referralCode,
      });
    } catch (error) {
      console.error('Error copying code:', error);
      Alert.alert('Your Code', referralCode);
    }
  };

  const handleKYCPress = () => {
    try {
      router.push('/kyc');
    } catch (error) {
      console.error('Error navigating to KYC:', error);
      Alert.alert(getTranslatedText('navigationError'), getTranslatedText('couldNotNavigateToKyc'));
    }
  };

  const handleCheckCreditScore = () => {
    Alert.alert(getTranslatedText('creditScore'), getTranslatedText('notAvailableRightNow'));
  };

  const handleViewEligibility = () => {
    Alert.alert(getTranslatedText('eligibility'), getTranslatedText('notAvailableRightNow'));
  };

  const handleNavigation = (route: string) => {
    try {
      // Add proper navigation paths for each route
      switch (route) {
        case 'settings':
          router.push('/(main)/settings');
          break;
        case 'help':
          router.push('/(main)/help');
          break;
        case 'about':
          router.push('/(main)/about');
          break;
        default:
          router.push(`/(main)/${route}`);
      }
    } catch (error) {
      console.error(`Error navigating to ${route}:`, error);
      Alert.alert(getTranslatedText('navigationError'), `${getTranslatedText('couldNotNavigateToScreen')} ${route}`);
    }
  };

  const requestPermissions = async (): Promise<boolean> => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      return status === 'granted';
    } catch (err) {
      console.warn('Permission request error:', err);
      return false;
    }
  };

  const pickImage = async () => {
    try {
      console.log('Starting image upload process...');
      console.log('Current user ID:', user?.id);

      if (!user?.id) {
        Alert.alert(getTranslatedText('error'), getTranslatedText('userIdNotFound'));
        return;
      }

      // Request permissions first
      const hasPermissions = await requestPermissions();
      if (!hasPermissions) {
        Alert.alert(
          getTranslatedText('permissionsRequired'),
          getTranslatedText('mediaPermissionsMessage'),
          [{ text: getTranslatedText('ok') }]
        );
        return;
      }

      console.log('Launching image library...');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        console.log('Image selected successfully, processing...');
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
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            const base64Data = result.split(',')[1];
            resolve(base64Data);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        handleImageUpload(base64);
      } else {
        console.log('Image selection was canceled');
      }
    } catch (error) {
      console.error('Error selecting image:', error);
      Alert.alert(getTranslatedText('error'), getTranslatedText('imageSelectionFailed'));
      setImageUploadInProgress(false);
    }
  };

  const pickCoverImage = async () => {
    try {
      console.log('Starting cover image upload process...');
      console.log('Current user ID:', user?.id);

      if (!user?.id) {
        Alert.alert(getTranslatedText('error'), getTranslatedText('userIdNotFound'));
        return;
      }

      // Request permissions first
      const hasPermissions = await requestPermissions();
      if (!hasPermissions) {
        Alert.alert(
          getTranslatedText('permissionsRequired'),
          getTranslatedText('mediaPermissionsMessage'),
          [{ text: getTranslatedText('ok') }]
        );
        return;
      }

      console.log('Launching image library for cover image...');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9], // Cover photo aspect ratio
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        console.log('Cover image selected successfully, processing...');
        const asset = result.assets[0];

        // Resize image for cover photo (wider aspect ratio)
        const manipulatedImage = await ImageManipulator.manipulateAsync(
          asset.uri,
          [{ resize: { width: 1920, height: 1080 } }],
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
        );

        // Convert to base64
        const response = await fetch(manipulatedImage.uri);
        const blob = await response.blob();
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            const base64Data = result.split(',')[1];
            resolve(base64Data);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        handleCoverImageUpload(base64);
      } else {
        console.log('Cover image selection was canceled');
      }
    } catch (error) {
      console.error('Error selecting cover image:', error);
      Alert.alert(getTranslatedText('error'), getTranslatedText('imageSelectionFailed'));
      setImageUploadInProgress(false);
    }
  };

  const handleCoverImageUpload = async (base64Image: string) => {
    try {
      setImageUploadInProgress(true);
      console.log('Cover image selected, starting upload...');
      console.log('User ID:', user?.id);

      const fileName = `cover_${user?.id}_${Date.now()}.jpg`;
      const filePath = `profiles/${fileName}`;
      console.log('Upload file path:', filePath);

      console.log('=== STEP 1: UPLOADING COVER IMAGE TO STORAGE ===');
      const { error: uploadError } = await supabase.storage
        .from('profiles')
        .upload(filePath, decode(base64Image), {
          contentType: 'image/jpeg',
        });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        throw uploadError;
      }

      console.log('✅ Cover image uploaded to storage successfully');

      console.log('=== STEP 2: GENERATING PUBLIC URL ===');
      const { data: { publicUrl } } = supabase.storage
        .from('profiles')
        .getPublicUrl(filePath);

      console.log('✅ Generated public URL:', publicUrl);

      console.log('=== STEP 3: UPDATING DATABASE ===');
      // Update shop_image in profiles table
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ shop_image: publicUrl })
        .eq('id', user?.id);

      if (updateError) {
        console.error('❌ Database update error:', updateError);
        throw updateError;
      }

      console.log('✅ Database updated successfully');

      // Update local user state
      if (user && setUser) {
        setUser({
          ...user,
          shop_image: publicUrl,
        });
      }

      console.log('✅ Cover image upload complete');
      setImageUploadInProgress(false);
    } catch (error: any) {
      console.error('Error uploading cover image:', error);
      Alert.alert(
        getTranslatedText('error'),
        error.message || 'Failed to upload cover image. Please try again.'
      );
      setImageUploadInProgress(false);
    }
  };

  const handleImageUpload = async (base64Image: string) => {
    if (!user) {
      Alert.alert(getTranslatedText('error'), getTranslatedText('userIdNotFound'));
      setImageUploadInProgress(false);
      return;
    }

    try {
      setImageUploadInProgress(true);
      console.log('=== PROFILE IMAGE UPLOAD DEBUG START ===');
      console.log('Image selected, starting upload...');
      console.log('User object:', JSON.stringify(user, null, 2));
      console.log('User ID:', user.id);
      console.log('Current profile_image_url:', user.profile_image_url);

      const fileName = `profile_${user.id}_${Date.now()}.jpg`;
      const filePath = `profiles/${fileName}`;
      console.log('Upload file path:', filePath);

      console.log('=== STEP 1: UPLOADING TO STORAGE ===');
      const { error: uploadError } = await supabase.storage
        .from('profiles')
        .upload(filePath, decode(base64Image), {
          contentType: 'image/jpeg',
        });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        throw uploadError;
      }

      console.log('✅ Image uploaded to storage successfully');

      console.log('=== STEP 2: GENERATING PUBLIC URL ===');
      const { data: { publicUrl } } = supabase.storage
        .from('profiles')
        .getPublicUrl(filePath);

      console.log('✅ Generated public URL:', publicUrl);

      console.log('=== STEP 3: UPDATING DATABASE ===');
      // Update profile_image_url in database using RPC to bypass RLS
      console.log('Calling update_profile_image_url RPC function...');
      console.log('Parameters:', { p_user_id: user.id, p_image_url: publicUrl });

      const { data: updateResult, error: updateError } = await supabase
        .rpc('update_profile_image_url', {
          p_user_id: user.id,
          p_image_url: publicUrl
        });

      console.log('RPC call completed');
      console.log('Update result:', JSON.stringify(updateResult, null, 2));
      console.log('Update error:', updateError);

      if (updateError) {
        console.error('❌ Database update error:', updateError);
        console.error('Error details:', JSON.stringify(updateError, null, 2));
        throw updateError;
      }

      console.log('✅ Database RPC call successful');

      // Check if the update was actually successful
      if (updateResult && !updateResult.success) {
        console.error('❌ RPC function returned error:', updateResult);
        throw new Error(updateResult.message || 'Failed to update profile image URL');
      }

      console.log('=== STEP 4: VERIFYING DATABASE UPDATE ===');
      // Let's verify the update by fetching the profile again
      const { data: verifyProfile, error: verifyError } = await supabase
        .from('profiles')
        .select('profile_image_url')
        .eq('user_id', user.id)
        .single();

      console.log('Verification query result:', verifyProfile);
      console.log('Verification error:', verifyError);

      if (verifyProfile) {
        console.log('✅ Database verification - profile_image_url:', verifyProfile.profile_image_url);
        if (verifyProfile.profile_image_url === publicUrl) {
          console.log('✅ Database update CONFIRMED - URLs match!');
        } else {
          console.log('❌ Database update FAILED - URLs do not match!');
          console.log('Expected:', publicUrl);
          console.log('Actual:', verifyProfile.profile_image_url);
        }
      }

      console.log('=== STEP 5: UPDATING LOCAL STATE ===');
      // Update local state with new profile image URL
      if (user) {
        const updatedUser = {
          ...user,
          profile_image_url: publicUrl
        };
        console.log('Updating local user state with new profile image URL');
        console.log('Updated user object:', JSON.stringify(updatedUser, null, 2));
        setUser(updatedUser);
      }

      console.log('=== STEP 6: REFRESHING PROFILE DATA ===');
      // Refresh user profile to ensure all components get the updated data
      console.log('Refreshing user profile data...');
      await fetchUserProfile();

      console.log('=== STEP 7: FINAL VERIFICATION ===');
      // Check the user state after refresh
      console.log('User state after refresh:', JSON.stringify(user, null, 2));

      setImageUploadInProgress(false);
      Alert.alert(getTranslatedText('success'), getTranslatedText('imageUploadedSuccessfully'));
      console.log('✅ Image upload process completed successfully');
      console.log('=== PROFILE IMAGE UPLOAD DEBUG END ===');
    } catch (error) {
      console.error('❌ Error uploading image:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      console.log('=== PROFILE IMAGE UPLOAD DEBUG END (WITH ERROR) ===');
      setImageUploadInProgress(false);
      Alert.alert(getTranslatedText('error'), getTranslatedText('imageUploadError') + ': ' + ((error as any)?.message || getTranslatedText('unknownError')));
    }
  };



  const handleLogout = async () => {
    try {
      setLoading(true);

      // Clear AsyncStorage auth data first
      await AsyncStorage.multiRemove([
        'auth_verified',
        'user_phone',
        'user_role',
        'user_id',
        'profile_id',
        'verificationId'
      ]);

      // Clear auth state in the store first (before signOut to prevent listener conflicts)
      await clearAuth();

      // Sign out from Supabase (this triggers onAuthStateChange)
      await supabase.auth.signOut();

      // Use setTimeout to ensure Root Layout is mounted before navigating
      // This prevents "Attempted to navigate before mounting the Root Layout" error
      setTimeout(() => {
        try {
          router.replace('/(auth)/language');
        } catch (navError) {
          console.warn('Navigation after logout delayed, retrying...', navError);
          // Retry navigation after a longer delay if first attempt fails
          setTimeout(() => {
            try {
              router.replace('/(auth)/language');
            } catch (retryError) {
              console.error('Navigation retry failed:', retryError);
            }
          }, 500);
        }
      }, 100);
    } catch (error) {
      console.error('Error logging out:', error);
      Alert.alert(getTranslatedText('error'), getTranslatedText('logoutFailed'));
      setLoading(false);
    }
  };

  // Removed hardwareBackPress handler to allow natural navigation flow

  // Add this at the top of the component, right after all the useState calls
  // This will handle safe rendering of all sections that depend on user data
  const isDataLoaded = !loading && user && user.id;

  // Add initialization for wishlist store
  // At the beginning of the component, after useState declarations
  useEffect(() => {
    // Initialize wishlist store to empty array if it's null or undefined
    if (!wishlistItems) {
      console.log('Initializing empty wishlist');
      useWishlistStore.setState({ items: [] });
    }

    // Also ensure the loadWishlist function handles errors gracefully
    const safeLoadWishlist = async () => {
      try {
        await loadWishlist();
      } catch (error) {
        console.error('Error loading wishlist:', error);
        // Ensure we always have a valid array even if loading fails
        if (!useWishlistStore.getState().items) {
          useWishlistStore.setState({ items: [] });
        }
      }
    };

    safeLoadWishlist();
  }, []);

  // Enhanced useFocusEffect with proper cleanup
  useFocusEffect(
    useCallback(() => {
      console.log('Profile screen focused - preparing to load wishlist');
      let isMounted = true;

      const safeLoadWishlist = async () => {
        try {
          console.log('Loading wishlist in profile screen');
          if (isMounted) {
            await loadWishlist();
            console.log('Wishlist loaded successfully');

            // Double check wishlist is valid after loading
            if (!useWishlistStore.getState().items) {
              console.log('Setting empty wishlist array - items was null after loading');
              useWishlistStore.setState({ items: [] });
            }
          }
        } catch (error) {
          console.error('Error in focus effect while loading wishlist:', error);
          // Ensure store has valid items array even if loading fails
          if (isMounted && !useWishlistStore.getState().items) {
            console.log('Setting empty wishlist array after error');
            useWishlistStore.setState({ items: [] });
          }
        }
      };

      // Start loading wishlist
      safeLoadWishlist();

      // Return cleanup function to prevent state updates on unmounted component
      return () => {
        console.log('Profile screen unfocused - cleaning up');
        isMounted = false;
      };
    }, [])
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  // Render profile content safely
  try {
    return (
      <View style={[styles.safeArea, getSafeAreaStyles(insets)]}>
        <SystemStatusBar style="dark" />

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FF7D00" />
            <Text>{translations.loadingProfile}</Text>
          </View>
        ) : !user ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{translations.unableToLoadProfile}</Text>
            <Button mode="contained" onPress={fetchUserProfile} style={styles.retryButton}>
              {translations.retry}
            </Button>
          </View>
        ) : (
          <>
            <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={styles.contentContainer}>
              {/* Header Section */}
              <View style={styles.headerContainer}>
                <Pressable onPress={pickCoverImage} style={styles.coverContainer}>
                  {user?.shop_image ? (
                    <Image
                      source={{ uri: user.shop_image }}
                      style={styles.coverImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <LinearGradient
                      colors={['#FFAD42', '#FF7D00']}
                      style={styles.coverPlaceholder}
                    >
                      <IconButton
                        icon="camera-plus"
                        size={32}
                        iconColor="#fff"
                        style={styles.addCoverIcon}
                      />
                      <Text style={styles.coverPlaceholderText}>
                        {translations.addCoverPhoto}
                      </Text>
                    </LinearGradient>
                  )}
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.6)']}
                    style={styles.coverGradient}
                  />

                  <View style={styles.coverButtonOverlay}>
                    <IconButton
                      icon="camera"
                      size={18}
                      iconColor="#fff"
                      style={styles.coverButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        pickCoverImage();
                      }}
                    />
                  </View>
                </Pressable>

                <View style={styles.profileSection}>
                  <Pressable onPress={pickImage} style={styles.avatarWrapper}>
                    <Avatar.Image
                      size={100}
                      source={
                        user?.profile_image_url
                          ? { uri: user.profile_image_url }
                          : require('../../../assets/images/avatar.png')
                      }
                      style={styles.avatar}
                    />
                    <View style={styles.editIconContainer}>
                      <IconButton
                        icon="camera"
                        size={14}
                        iconColor="#fff"
                        style={styles.editIcon}
                      />
                    </View>
                  </Pressable>

                  <View style={styles.profileDetails}>
                    <Text variant="headlineSmall" style={styles.shopName}>{user?.business_details?.shopName || getTranslatedText('yourShop')}</Text>
                    <Text variant="bodyMedium" style={styles.phone}>
                      {user?.phone_number || 'No phone number'}
                    </Text>
                    {user?.business_details?.address && (
                      <Text variant="bodySmall" style={styles.address}>
                        {user.business_details.address}
                      </Text>
                    )}
                  </View>
                </View>
              </View>

              {/* Quick Actions Grid */}
              <View style={styles.quickActionsContainer}>
                <Pressable style={styles.actionItem} onPress={() => router.push('/(main)/orders')}>
                  <View style={[styles.actionIconProfile, { backgroundColor: '#E3F2FD' }]}>
                    <IconButton icon="package-variant" iconColor="#2196F3" size={24} style={{ margin: 0 }} />
                  </View>
                  <Text style={styles.actionLabel}>{getTranslatedText('myOrders')}</Text>
                </Pressable>

                <Pressable style={styles.actionItem} onPress={() => {
                  try {
                    router.push('/(main)/retailer/wishlist');
                  } catch (error) { console.error(error); }
                }}>
                  <View style={[styles.actionIconProfile, { backgroundColor: '#FFEBEE' }]}>
                    <IconButton icon="heart" iconColor="#F44336" size={24} style={{ margin: 0 }} />
                  </View>
                  <Text style={styles.actionLabel}>{getTranslatedText('myWishlist')}</Text>
                </Pressable>

                <Pressable style={styles.actionItem} onPress={() => handleNavigation('help')}>
                  <View style={[styles.actionIconProfile, { backgroundColor: '#E0F2F1' }]}>
                    <IconButton icon="help-circle" iconColor="#009688" size={24} style={{ margin: 0 }} />
                  </View>
                  <Text style={styles.actionLabel}>{getTranslatedText('helpSupport')}</Text>
                </Pressable>

                <Pressable style={styles.actionItem} onPress={() => handleNavigation('settings')}>
                  <View style={[styles.actionIconProfile, { backgroundColor: '#F3E5F5' }]}>
                    <IconButton icon="cog" iconColor="#9C27B0" size={24} style={{ margin: 0 }} />
                  </View>
                  <Text style={styles.actionLabel}>{getTranslatedText('settings')}</Text>
                </Pressable>
              </View>

              {/* KYC Status Card */}
              <Pressable onPress={handleKYCPress}>
                <LinearGradient
                  colors={kycStatus.isVerified ? ['#66BB6A', '#43A047'] : kycStatus.isSubmitted ? ['#FFA726', '#FB8C00'] : ['#FF7043', '#F4511E']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.kycCard}
                >
                  <View style={styles.kycContent}>
                    <View>
                      <Text style={styles.kycTitle}>{getTranslatedText('kycVerification')}</Text>
                      <Text style={styles.kycSubtitle}>
                        {kycStatus.isVerified ? getTranslatedText('kycVerified') : kycStatus.isSubmitted ? getTranslatedText('kycUnderReview') : getTranslatedText('completeKycToVerify')}
                      </Text>
                    </View>
                    <View style={styles.kycIconBadge}>
                      <IconButton icon={kycStatus.isVerified ? "check-decagram" : "shield-alert"} iconColor={kycStatus.isVerified ? "#43A047" : "#F4511E"} size={24} style={{ margin: 0 }} />
                    </View>
                  </View>

                  {!kycStatus.isVerified && (
                    <View style={styles.kycButton}>
                      <Text style={styles.kycButtonText}>{kycStatus.isSubmitted ? getTranslatedText('viewStatus') : getTranslatedText('completeKyc')}</Text>
                      <IconButton icon="arrow-right" size={16} iconColor="#fff" style={{ margin: 0, padding: 0, width: 20, height: 20 }} />
                    </View>
                  )}

                  {kycStatus.isVerified && (
                    <View style={styles.kycActionsRow}>
                      <Pressable onPress={handleCheckCreditScore} style={styles.kycActionButton}>
                        <Text style={styles.kycActionText}>{getTranslatedText('checkCreditScore')}</Text>
                      </Pressable>
                      <Pressable onPress={handleViewEligibility} style={styles.kycActionButton}>
                        <Text style={styles.kycActionText}>{getTranslatedText('viewEligibility')}</Text>
                      </Pressable>
                    </View>
                  )}
                </LinearGradient>
              </Pressable>


              {/* Live Tracking Section */}
              {activeOrders.length > 0 && (
                <View style={[styles.sectionContainer, { marginBottom: 16 }]}>
                  <View style={styles.sectionHeaderRow}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>{translations.trackOrders || 'Live Tracking'}</Text>
                    <Pressable onPress={() => router.push('/(main)/orders')}>
                      <Text style={styles.seeAllText}>{translations.viewAllOrders}</Text>
                    </Pressable>
                  </View>

                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.activeOrdersScroll}>
                    {activeOrders.map((order) => {
                      const getStatusLabel = (s: string) => {
                        const status = s?.toLowerCase();
                        if (status === 'placed' || status === 'pending') return 'Order Placed';
                        if (status === 'confirmed') return 'Confirmed';
                        if (status === 'processing') return 'Processing';
                        if (status === 'shipped' || status === 'out_for_delivery') return 'On the Way';
                        return status;
                      };

                      return (
                        <Pressable
                          key={order.id}
                          style={styles.trackingCard}
                          onPress={() => router.push(`/(main)/orders/${order.id}`)}
                        >
                          <View style={styles.trackingHeader}>
                            <View>
                              <Text style={styles.trackingOrderNum}>Order #{order.order_number?.toString().slice(-6) || '...'}</Text>
                              <Text style={styles.trackingAmount}>₹{order.total_amount?.toFixed(0)}</Text>
                            </View>
                            <View style={[styles.trackingStatusBadge, { backgroundColor: '#FFF3E0' }]}>
                              <Text style={[styles.trackingStatusText, { color: '#E65100' }]}>
                                {getStatusLabel(order.status)}
                              </Text>
                            </View>
                          </View>

                          <View style={styles.trackingProgress}>
                            <TrackingStep status="placed" currentStatus={order.status} isLast={false} icon="clipboard-text-outline" />
                            <TrackingStep status="confirmed" currentStatus={order.status} isLast={false} icon="check" />
                            <TrackingStep status="picked_up" currentStatus={order.status} isLast={false} icon="package-variant" />
                            <TrackingStep status="in_transit" currentStatus={order.status} isLast={false} icon="truck-delivery" />
                            <TrackingStep status="delivered" currentStatus={order.status} isLast={true} icon="home" />
                          </View>

                          <View style={styles.trackingLabels}>
                            <Text style={[styles.stepLabel, { flex: 1, textAlign: 'left', fontSize: 9 }]}>Placed</Text>
                            <Text style={[styles.stepLabel, { flex: 1, textAlign: 'center', fontSize: 9 }]}>Confirm</Text>
                            <Text style={[styles.stepLabel, { flex: 1, textAlign: 'center', fontSize: 9 }]}>Picked</Text>
                            <Text style={[styles.stepLabel, { flex: 1, textAlign: 'center', fontSize: 9 }]}>Transit</Text>
                            <Text style={[styles.stepLabel, { width: 'auto', textAlign: 'right', fontSize: 9 }]}>Delivered</Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {/* Recent Orders Section */}
              <View style={styles.sectionContainer}>
                <View style={styles.ordersBox}>
                  <View style={styles.sectionHeaderRow}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>{getTranslatedText('recentOrders')}</Text>
                    <Pressable onPress={() => router.push('/(main)/orders')}>
                      <Text style={styles.seeAllText}>{getTranslatedText('viewAllOrders')}</Text>
                    </Pressable>
                  </View>

                  <Divider style={styles.sectionDivider} />

                  {!recentOrders || recentOrders.length === 0 ? (
                    <View style={styles.emptyState}>
                      <IconButton icon="package-variant-closed" size={40} iconColor="#ccc" />
                      <Text variant="bodyMedium" style={{ color: '#999' }}>{getTranslatedText('noRecentOrders')}</Text>
                    </View>
                  ) : (
                    recentOrders.map((order, index) => (
                      <View key={order.id}>
                        <Pressable
                          style={styles.orderItemRow}
                          onPress={() => router.push(`/(main)/orders/${order.id}`)}
                        >
                          <View style={styles.orderIconBox}>
                            <IconButton icon="package-variant" iconColor="#FF7D00" size={20} style={{ margin: 0 }} />
                          </View>

                          <View style={styles.orderInfo}>
                            <Text variant="titleSmall" style={styles.orderId}>{getTranslatedText('orderHash')}{order.order_number || order.id}</Text>
                            <Text variant="bodySmall" style={styles.orderDate}>
                              {new Date(order.created_at).toLocaleDateString()}
                            </Text>
                          </View>

                          <View style={[
                            styles.statusBadge,
                            {
                              backgroundColor:
                                order.status === 'delivered'
                                  ? '#E8F5E9'
                                  : order.status === 'processing'
                                    ? '#FFF3E0'
                                    : order.status === 'shipped'
                                      ? '#E3F2FD'
                                      : '#F5F5F5',
                            },
                          ]}>
                            <Text
                              style={[
                                styles.statusText,
                                {
                                  color:
                                    order.status === 'delivered'
                                      ? '#2E7D32'
                                      : order.status === 'processing'
                                        ? '#EF6C00'
                                        : order.status === 'shipped'
                                          ? '#1565C0'
                                          : '#757575',
                                },
                              ]}
                            >
                              {getTranslatedText(order.status)}
                            </Text>
                          </View>
                          <IconButton icon="chevron-right" size={20} iconColor="#ccc" style={{ margin: 0, marginLeft: 4 }} />
                        </Pressable>
                        {index < recentOrders.length - 1 && <Divider style={styles.itemDivider} />}
                      </View>
                    ))
                  )}
                </View>
              </View>

              {/* Referral Section banner - Colors and text from Supabase */}
              <LinearGradient
                colors={[bannerColors.gradient_start, bannerColors.gradient_end]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.referralBanner}
              >
                <View style={styles.referralContent}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.referralTitle, { color: bannerColors.text_color }]}>
                      {getBannerTitle()}
                    </Text>
                    <Text style={[styles.referralDesc, { color: bannerColors.text_color }]}>
                      {getBannerSubtitle()}
                    </Text>
                    <Pressable
                      style={[styles.codeContainer, { backgroundColor: bannerColors.code_bg_color }]}
                      onPress={handleCopyCode}
                    >
                      <Text style={[styles.referralCode, { color: bannerColors.code_text_color }]}>
                        {referralCode}
                      </Text>
                      <IconButton
                        icon="content-copy"
                        size={16}
                        iconColor={bannerColors.code_text_color}
                        style={{ margin: 0 }}
                      />
                    </Pressable>
                    {referralStats && (referralStats.total_referrals > 0 || referralStats.total_earnings > 0) && (
                      <View style={styles.referralStatsRow}>
                        <Text style={[styles.referralStatText, { color: bannerColors.text_color }]}>
                          {referralStats.total_referrals} referrals • ₹{referralStats.total_earnings} earned
                        </Text>
                      </View>
                    )}
                    {/* Show current offer if available and within date range */}
                    {(() => {
                      const offer = referralSettings?.current_offer;
                      if (!offer?.enabled) return null;

                      // Check if offer is within valid date range
                      const now = new Date();
                      const startDate = offer.start_date ? new Date(offer.start_date) : null;
                      const endDate = offer.end_date ? new Date(offer.end_date) : null;

                      if (startDate && now < startDate) return null; // Offer hasn't started
                      if (endDate && now > endDate) return null; // Offer has expired

                      return (
                        <View style={styles.currentOfferBadge}>
                          <Text style={styles.currentOfferText}>
                            🎁 {offer.description || offer.title || 'Special offer available!'}
                          </Text>
                        </View>
                      );
                    })()}
                  </View>
                  <IconButton
                    icon="share-variant"
                    mode="contained"
                    containerColor={bannerColors.code_bg_color}
                    iconColor={bannerColors.gradient_end}
                    size={24}
                    onPress={handleShare}
                  />
                </View>
              </LinearGradient>

              {/* Menu List */}
              <View style={styles.menuContainer}>
                <Pressable style={styles.menuItem} onPress={() => handleNavigation('about')}>
                  <View style={styles.menuIconBox}><IconButton icon="information" size={20} iconColor="#555" /></View>
                  <Text style={styles.menuText}>{translations.aboutUs}</Text>
                  <IconButton icon="chevron-right" size={20} iconColor="#ccc" />
                </Pressable>
                <Divider style={styles.menuDivider} />
                <Pressable style={styles.menuItem} onPress={handleLogout}>
                  <View style={[styles.menuIconBox, { backgroundColor: '#FFEBEE' }]}><IconButton icon="logout" size={20} iconColor="#D32F2F" /></View>
                  <Text style={[styles.menuText, { color: '#D32F2F' }]}>{translations.logout}</Text>
                </Pressable>
              </View>

              <View style={styles.bottomPadding} />
            </ScrollView>
          </>
        )}
      </View>
    );
  } catch (error) {
    console.error('Error rendering profile:', error);
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <Text style={styles.errorText}>{translations.anErrorOccurred}</Text>
      </View>
    );
  }
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },
  contentContainer: {
    paddingBottom: 40,
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  headerContainer: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    paddingBottom: 24,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  coverContainer: {
    height: 180,
    width: '100%',
    position: 'relative',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    overflow: 'hidden',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverPlaceholderText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    fontWeight: '600',
  },
  coverGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 80,
  },
  addCoverIcon: {
    margin: 0,
  },
  coverButtonOverlay: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 20,

  },
  coverButton: {
    margin: 0,
  },
  profileSection: {
    alignItems: 'center',
    marginTop: -50,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 12,
  },
  avatar: {
    borderWidth: 4,
    borderColor: '#fff',
  },
  editIconContainer: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    backgroundColor: '#FF7D00',
    borderRadius: 15,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    elevation: 2,
  },
  editIcon: {
    margin: 0,
  },
  profileDetails: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  shopName: {
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
    textAlign: 'center',
  },
  phone: {
    color: '#666',
    marginBottom: 2,
  },
  address: {
    color: '#888',
    textAlign: 'center',
    marginTop: 2,
  },
  quickActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  actionItem: {
    alignItems: 'center',
    flex: 1,
  },
  actionIconProfile: {
    width: 56,
    height: 56,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 12,
    color: '#444',
    fontWeight: '500',
  },
  kycCard: {
    marginHorizontal: 16,
    borderRadius: 24,
    padding: 20,
    marginBottom: 24,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  kycContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  kycTitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  kycSubtitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  kycIconBadge: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 12,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  kycButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  kycButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginRight: 4,
  },
  kycActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  kycActionButton: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  kycActionText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  sectionContainer: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  seeAllText: {
    color: '#FF7D00',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyState: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#eee',
    borderStyle: 'dashed',
  },
  orderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  orderIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF3E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  orderInfo: {
    flex: 1,
  },
  orderId: {
    fontWeight: '600',
    color: '#333',
    fontSize: 15,
  },
  orderDate: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  referralBanner: {
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    elevation: 3,
  },
  referralContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  referralTitle: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
    marginBottom: 4,
  },
  referralDesc: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    marginBottom: 12,
    paddingRight: 16,
  },
  codeContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    alignItems: 'center',
  },
  referralCode: {
    fontWeight: '700',
    color: '#2575FC',
    marginRight: 4,
  },
  referralStatsRow: {
    marginTop: 8,
  },
  referralStatText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.9,
  },
  currentOfferBadge: {
    marginTop: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  currentOfferText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  menuContainer: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 20,
    paddingVertical: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  menuIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F5F5F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  menuDivider: {
    marginLeft: 68,
    backgroundColor: '#F0F0F0',
  },
  logoutButton: {
    margin: 16,
    marginTop: 8,
  },
  retryButton: {
    marginTop: 16,
  },
  errorText: {
    color: '#D32F2F',
    fontSize: 16,
    fontWeight: '600',
  },
  ordersBox: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  sectionDivider: {
    backgroundColor: '#F0F0F0',
    marginVertical: 12,
  },
  orderItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  orderIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#FFF3E0', // Light orange background
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  itemDivider: {
    backgroundColor: '#F5F5F7',
    marginLeft: 64, // Align with text start
    marginVertical: 4,
  },
  bottomPadding: {
    height: 30,
  },

  // Live Tracking Styles
  activeOrdersScroll: {
    paddingRight: 16,
    paddingBottom: 8,
  },
  trackingCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginRight: 16,
    width: 300,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  trackingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  trackingOrderNum: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  trackingAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FF7D00',
  },
  trackingStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  trackingStatusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  trackingProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  trackingLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 0,
  },
  stepLabel: {
    fontSize: 10,
    color: '#8E8E93',
    fontWeight: '500',
  },
});
