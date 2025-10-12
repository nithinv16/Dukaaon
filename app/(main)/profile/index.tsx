import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Share, Linking, ActivityIndicator, Pressable, Image, Alert, Platform } from 'react-native';
import { useEdgeToEdge, getSafeAreaStyles } from '../../../utils/android15EdgeToEdge';
import { SystemStatusBar } from '../../../components/SystemStatusBar';
import { Text, Card, Button, Avatar, List, Divider, IconButton } from 'react-native-paper';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuthStore } from '../../../store/auth';
import { supabase, storage } from '../../../services/supabase/supabase';
import { useWishlistStore } from '../../../store/wishlist';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { decode } from 'base64-arraybuffer';
import { OrderTracking } from '../../../components/orders/OrderTracking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguage } from '../../../contexts/LanguageContext';
import { translationService } from '../../../services/translationService';
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
    myWishlist: 'My Wishlist',
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
  const [recentOrders, setRecentOrders] = useState([]);
  const [imageUploadInProgress, setImageUploadInProgress] = useState(false);

  // Fetch user profile data
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        await fetchUserProfile();
        await fetchRecentOrders();
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

  const referralCode = user?.id ? ('DUK' + user.id.substring(0, 6).toUpperCase()) : 'DUKAREF';

  const handleShare = async () => {
    try {
      const result = await Share.share({
        message: `Join dukaaOn with my referral code: ${referralCode}\nDownload the app now!`,
        title: 'Share dukaaOn App',
      });
    } catch (error) {
      console.error('Error sharing:', error);
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

  const handleImageUpload = async (base64Image: string) => {
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
      
      // Sign out from Supabase
      await supabase.auth.signOut();
      
      // Firebase sign out removed - using Supabase auth only
      
      // Clear auth state in the store
      clearAuth();
      
      // Navigate to language selection
      router.replace('/(auth)/language');
    } catch (error) {
      console.error('Error logging out:', error);
      Alert.alert(getTranslatedText('error'), getTranslatedText('logoutFailed'));
    } finally {
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
            <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
              <View style={styles.header}>
                {/* Header without settings icon */}
              </View>

              {/* Cover Photo Section */}
              <View style={styles.coverContainer}>
                {user?.shop_image ? (
                  <Image
                    source={{ uri: user.shop_image }}
                    style={styles.coverImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.coverPlaceholder}>
                      <Text style={styles.coverPlaceholderText}>
                        {translations.addCoverPhoto}
                      </Text>
                    </View>
                )}
                
                {/* Profile Info - Positioned over the cover photo */}
                <View style={styles.profileOverlay}>
                  <Pressable onPress={pickImage} style={styles.avatarContainer}>
                    <Avatar.Image
                      size={90}
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
                        size={16}
                        style={styles.editIcon}
                      />
                    </View>
                  </Pressable>
                  <View style={styles.profileInfo}>
                    <Text variant="titleLarge" style={styles.shopName}>{user?.business_details?.shopName || getTranslatedText('yourShop')}</Text>
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

              {/* Orders & Tracking Section */}
              <Card style={styles.card}>
                  <Card.Content>
                    <List.Section>
                    <List.Subheader>{getTranslatedText('myOrders')}</List.Subheader>
                     <List.Item
                       title={getTranslatedText('trackOrders')}
                       description={getTranslatedText('viewAndTrackOrderStatus')}
                      left={props => <List.Icon {...props} icon="package-variant" />}
                      right={props => <List.Icon {...props} icon="chevron-right" />}
                      onPress={() => router.push('/(main)/orders')}
                    />
                  </List.Section>
                </Card.Content>
              </Card>

              {/* Recent Orders Section */}
              <Card style={styles.card}>
                <Card.Title
                   title={getTranslatedText('recentOrders')}
                  right={(props) => (
                    <IconButton
                      {...props}
                      icon="chevron-right"
                      onPress={() => router.push('/(main)/orders')}
                    />
                  )}
                />
                <Card.Content>
                  {!recentOrders || recentOrders.length === 0 ? (
                     <Text variant="bodyMedium">{getTranslatedText('noRecentOrders')}</Text>
                  ) : (
                    recentOrders.map((order) => (
                      <Pressable
                        key={order.id}
                        style={styles.orderItem}
                        onPress={() => router.push(`/(main)/orders/${order.id}`)}
                      >
                        <View style={styles.orderInfo}>
                          <Text variant="titleSmall">{getTranslatedText('orderHash')}{order.order_number || order.id}</Text>
                          <Text variant="bodySmall" style={styles.orderDate}>
                            {new Date(order.created_at).toLocaleDateString()}
                          </Text>
                        </View>
                        <View style={styles.orderStatus}>
                          <Text
                            variant="bodySmall"
                            style={[
                              styles.statusText,
                              {
                                backgroundColor:
                                  order.status === 'delivered'
                                    ? '#4CAF50'
                                    : order.status === 'processing'
                                    ? '#FF9800'
                                    : order.status === 'shipped'
                                    ? '#2196F3'
                                    : '#9E9E9E',
                              },
                            ]}
                          >
                            {getTranslatedText(order.status)}
                          </Text>
                          <IconButton icon="chevron-right" size={20} />
                        </View>
                      </Pressable>
                    ))
                  )}
                </Card.Content>
              </Card>

              {/* KYC Section */}
              <Card style={styles.card} onPress={handleKYCPress}>
                <Card.Content>
                  <View style={styles.kycHeader}>
                     <Text variant="titleMedium">{getTranslatedText('kycVerification')}</Text>
                     <View style={[
                       styles.kycStatus,
                       { backgroundColor: kycStatus.isVerified ? '#4CAF50' : kycStatus.isSubmitted ? '#FFA000' : '#F44336' }
                     ]}>
                       <Text style={styles.kycStatusText}>
                         {kycStatus.isVerified ? getTranslatedText('kycVerified') : kycStatus.isSubmitted ? getTranslatedText('kycSubmitted') : getTranslatedText('kycNotSubmitted')}
                       </Text>
                     </View>
                   </View>
 
                   {!kycStatus.isVerified && (
                     <>
                       <Text style={styles.sectionDescription}>
                         {kycStatus.isSubmitted 
                           ? getTranslatedText('kycUnderReview')
                           : getTranslatedText('completeKycToVerify')
                         }
                       </Text>
                       <Button
                         mode="contained"
                         onPress={handleKYCPress}
                         style={{ marginTop: 16 }}
                       >
                         {kycStatus.isSubmitted ? getTranslatedText('viewStatus') : getTranslatedText('completeKyc')}
                       </Button>
                     </>
                   )}
 
                   {kycStatus.isVerified && (
                     <View style={styles.verifiedActions}>
                       <Button
                         mode="contained"
                         onPress={handleCheckCreditScore}
                         style={{ marginTop: 16, marginBottom: 8 }}
                       >
                         {getTranslatedText('checkCreditScore')}
                       </Button>
                       <Button
                         mode="outlined"
                         onPress={handleViewEligibility}
                         style={{ marginBottom: 8 }}
                       >
                         {getTranslatedText('viewEligibility')}
                       </Button>
                     </View>
                   )}
                </Card.Content>
              </Card>

              {/* Referral Section */}
              <Card style={styles.card}>
                <Card.Content>
                   <Text variant="titleMedium">{translations.referAndEarn}</Text>
                   <Text style={styles.sectionDescription}>
                     {translations.referFriendsEarnRewards}
                   </Text>
                   <View style={styles.referralContainer}>
                     <Text variant="headlineSmall" style={styles.referralCode}>
                       {referralCode}
                     </Text>
                     <Button
                       mode="contained"
                       onPress={handleShare}
                       icon="share-variant"
                       style={styles.shareButton}
                     >
                       {translations.share}
                     </Button>
                   </View>
                 </Card.Content>
              </Card>

              {/* Wishlist Section with Defensive Rendering */}
              <Card style={styles.sectionCard}>
                <Card.Title
                  title={translations.myWishlist}
                  right={(props) => (
                    <IconButton
                      {...props}
                      icon="chevron-right"
                      onPress={() => {
                        try {
                          console.log('Navigating to wishlist screen');
                          router.push('/(main)/retailer/wishlist');
                        } catch (error) {
                          console.error('Navigation error:', error);
                        }
                      }}
                    />
                  )}
                />
                <Card.Content>
                  {(() => {
                    try {
                      // Ensure we have a valid array
                      const safeItems = Array.isArray(wishlistItems) ? wishlistItems : [];
                      
                      if (safeItems.length === 0) {
                        return <Text variant="bodyMedium">{translations.noItemsInWishlist}</Text>;
                      }
                      
                      return (
                        <View>
                          <Text variant="bodyMedium">{safeItems.length} {translations.itemsSaved}</Text>
                          <ScrollView 
                            horizontal 
                            showsHorizontalScrollIndicator={false} 
                            style={styles.wishlistScroll}
                          >
                            {safeItems.slice(0, 3).map((item, index) => (
                              <Pressable 
                                key={item?.id || `wishlist-item-${index}`}
                                onPress={() => {
                                  try {
                                    router.push('/(main)/retailer/wishlist');
                                  } catch (error) {
                                    console.error('Error navigating:', error);
                                  }
                                }}
                                style={styles.wishlistItem}
                              >
                                <Card style={styles.wishlistCard}>
                                  <Card.Cover 
                                    source={{ 
                                      uri: (item?.image_url) ? 
                                        item.image_url : 'https://via.placeholder.com/100' 
                                    }} 
                                    style={styles.wishlistImage} 
                                  />
                                  <Card.Content>
                                    <Text variant="bodySmall" numberOfLines={1}>
                                      {item?.name ? item.name : translations.product}
                                    </Text>
                                    <Text variant="labelLarge" style={styles.price}>
                                      ₹{item?.price ? item.price : '0'}
                                    </Text>
                                  </Card.Content>
                                </Card>
                              </Pressable>
                            ))}
                            {safeItems.length > 3 && (
                              <Pressable 
                                onPress={() => {
                                  try {
                                    router.push('/(main)/retailer/wishlist');
                                  } catch (error) {
                                    console.error('Error navigating:', error);
                                  }
                                }}
                                style={styles.viewMoreCard}
                              >
                                <Text style={styles.viewMoreText}>
                                  +{safeItems.length - 3} {translations.more}
                                </Text>
                              </Pressable>
                            )}
                          </ScrollView>
                        </View>
                      );
                    } catch (error) {
                      console.error('Error rendering wishlist:', error);
                      return <Text variant="bodyMedium">{translations.unableToDisplayWishlist}</Text>;
                    }
                  })()}
                </Card.Content>
              </Card>

              {/* Help & Support Section */}
              <Card style={styles.sectionCard} onPress={() => handleNavigation('help')}>
                <Card.Content>
                  <View style={styles.sectionHeader}>
                    <View style={styles.sectionLeft}>
                      <IconButton icon="help-circle" size={24} />
                      <View>
                        <Text variant="titleMedium">{translations.helpAndSupport}</Text>
                        <Text variant="bodyMedium" style={styles.sectionDescription}>
                          {translations.getHelpAndSupport}
                        </Text>
                      </View>
                    </View>
                    <IconButton icon="chevron-right" size={24} />
                  </View>
                </Card.Content>
              </Card>

              {/* About Us Section */}
              <Card style={styles.sectionCard} onPress={() => handleNavigation('about')}>
                <Card.Content>
                  <View style={styles.sectionHeader}>
                    <View style={styles.sectionLeft}>
                      <IconButton icon="information" size={24} />
                      <View>
                        <Text variant="titleMedium">{translations.aboutUs}</Text>
                        <Text variant="bodyMedium" style={styles.sectionDescription}>
                          {translations.learnMoreAboutUs}
                        </Text>
                      </View>
                    </View>
                    <IconButton icon="chevron-right" size={24} />
                  </View>
                </Card.Content>
              </Card>

              {/* Add Settings Button above Logout Button */}
              <Button
                mode="outlined"
                icon="cog"
                onPress={() => handleNavigation('settings')}
                style={styles.settingsButton}
              >
                {translations.settings}
              </Button>
              
              {/* Logout Button */}
              <Button
                mode="outlined"
                icon="logout"
                onPress={handleLogout}
                textColor="#ff4444"
                style={styles.logoutButton}
              >
                {translations.logout}
              </Button>
              
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
    backgroundColor: '#fff',
    paddingBottom: 60,
  },
  header: {
    paddingTop: 16,
  },
  settingsButton: {
    margin: 16,
    marginBottom: 8,
    borderRadius: 20,
    borderColor: '#2196F3',
  },
  coverContainer: {
    position: 'relative',
    height: 200,
  },
  coverImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  coverPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  coverPlaceholderText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  profileOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
    marginBottom: -20, // Make avatar overlap the card below
  },
  avatar: {
    borderWidth: 4,
    borderColor: '#fff',
    elevation: 4,
  },
  editIconContainer: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    backgroundColor: '#FF7D00',
    borderRadius: 15,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  editIcon: {
    margin: 0,
    padding: 0,
  },
  profileInfo: {
    flex: 1,
    marginLeft: 0,
  },
  shopName: {
    fontWeight: 'bold',
    fontSize: 18,
    color: '#333',
  },
  phone: {
    marginTop: 2,
    fontSize: 14,
  },
  address: {
    fontSize: 12,
    opacity: 0.8,
  },
  sectionCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    elevation: 2,
  },
  kycHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  kycStatus: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  kycStatusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  verifiedActions: {
    marginTop: 8,
  },
  referralContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  referralCode: {
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  shareButton: {
    borderRadius: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionDescription: {
    color: '#666',
    marginTop: 4,
  },
  bottomPadding: {
    height: 100, // Add padding at the bottom for better scrolling
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewAllButton: {
    marginTop: 8,
  },
  wishlistScroll: {
    marginTop: 12,
  },
  wishlistItem: {
    width: 120,
    marginRight: 8,
  },
  wishlistCard: {
    elevation: 2,
  },
  wishlistImage: {
    height: 100,
  },
  price: {
    color: '#2196F3',
    marginTop: 4,
  },
  viewMoreCard: {
    width: 120,
    height: 160,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewMoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  logoutButton: {
    margin: 16,
    marginTop: 8,
    borderRadius: 20,
    borderColor: '#ff4444',
  },
  card: {
    margin: 16,
    elevation: 2,
  },
  uploadShopButton: {
    marginTop: 16,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  retryButton: {
    marginTop: 16,
  },
  orderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  orderInfo: {
    flex: 1,
  },
  orderDate: {
    color: '#666',
    marginTop: 4,
  },
  orderStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
});
