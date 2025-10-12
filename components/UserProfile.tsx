import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Avatar, Text, Button } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { supabase } from '../services/supabase/supabase';
import { useAuthStore } from '../store/auth';

interface UserProfileProps {
  size?: 'small' | 'medium' | 'large';
  showName?: boolean;
  showOwnerName?: boolean;
  onPress?: () => void;
  showDebugButtons?: boolean;
}

export function UserProfile({ 
  size = 'medium', 
  showName = true, 
  showOwnerName = true,
  onPress,
  showDebugButtons = false
}: UserProfileProps) {
  const router = useRouter();
  const user = useAuthStore(state => state.user);
  const setUser = useAuthStore(state => state.setUser);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [shopName, setShopName] = useState<string>('');
  const [ownerName, setOwnerName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingProfile, setUpdatingProfile] = useState(false);

  // Set avatar size based on the size prop
  const getAvatarSize = () => {
    switch(size) {
      case 'small': return 40;
      case 'large': return 80;
      default: return 60;
    }
  };

  useEffect(() => {
    fetchProfileData();
  }, [user?.id]);

  // Attempt to fetch profile data from Supabase
  const fetchProfileData = async () => {
    if (!user?.id) {
      console.log('UserProfile: No user ID available');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      console.log(`UserProfile: Fetching profile data for user ID ${user.id}`);
      
      // Try a simple, direct select to fetch all profile data
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (error) {
        console.error('UserProfile: Error fetching profile data:', error.message);
        setError(error.message);
        
        // Try direct RPC call if regular query fails
        try {
          console.log('UserProfile: Attempting direct RPC query');
          const { data: rpcData, error: rpcError } = await supabase.rpc('get_profile_by_id', {
            profile_id: user.id
          });
          
          if (rpcError) {
            console.error('UserProfile: RPC Error:', rpcError.message);
            throw rpcError;
          }
          
          if (rpcData) {
            console.log('UserProfile: RPC data received:', rpcData);
            // Handle data the same way as regular query
            setAvatarUrl(rpcData.profile_image_url || null);
            
            if (rpcData.business_details) {
              console.log('UserProfile: RPC business details:', rpcData.business_details);
              setShopName(rpcData.business_details.shopName || '');
              setOwnerName(rpcData.business_details.ownerName || '');
            }
            return;
          }
        } catch (rpcErr) {
          console.error('UserProfile: RPC fetch failed:', rpcErr);
          // Continue to fallback
        }
      } else {
        console.log('UserProfile: Profile data received:', data);
        
        if (data) {
          setAvatarUrl(data.profile_image_url || null);
          
          // Extract shop name and owner name from business_details
          if (data.business_details) {
            console.log('UserProfile: Business details:', data.business_details);
            setShopName(data.business_details.shopName || '');
            setOwnerName(data.business_details.ownerName || '');
          } else {
            console.log('UserProfile: No business_details found in profile data');
          }
        } else {
          console.log('UserProfile: No profile data returned');
        }
      }
    } catch (err) {
      console.error('UserProfile: Error in fetchProfileData:', err);
    } finally {
      setLoading(false);
    }
  };

  // Update the business_details to include ownerName
  const updateBusinessDetails = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'User ID not available');
      return;
    }

    try {
      setUpdatingProfile(true);
      
      // Get existing business_details or initialize new object
      const businessDetails = user.business_details || {};
      
      // Add ownerName if not present
      if (!businessDetails.ownerName) {
        businessDetails.ownerName = 'Shop Owner';
      }
      
      console.log('Updating business_details:', businessDetails);
      
      // Try RPC method first to bypass RLS
      try {
        const { data, error } = await supabase.rpc('update_profile_business_details', {
          profile_id: user.id,
          business_details: businessDetails
        });
        
        if (error) {
          console.error('RPC Error:', error);
          throw error; // Forward to fallback
        }
        
        console.log('Profile updated successfully via RPC:', data);
        
        // Refresh local state
        setShopName(businessDetails.shopName || '');
        setOwnerName(businessDetails.ownerName || '');
        
        // Update the user object in the auth store
        if (user) {
          setUser({
            ...user,
            business_details: businessDetails
          });
        }
        
        Alert.alert('Success', 'Profile updated successfully via RPC');
        return;
      } catch (rpcError) {
        console.error('RPC method failed, trying direct update:', rpcError);
      }
      
      // Fallback to direct update if RPC fails
      const { data, error } = await supabase
        .from('profiles')
        .update({
          business_details: businessDetails,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)
        .select()
        .single();
      
      if (error) {
        console.error('Error updating profile:', error);
        Alert.alert('Error', `Failed to update profile: ${error.message}`);
        return;
      }
      
      console.log('Profile updated successfully via direct update:', data);
      
      // Update the user in store with the new data
      if (data) {
        setUser({
          ...user,
          business_details: data.business_details
        });
        
        // Update local state
        if (data.business_details) {
          setShopName(data.business_details.shopName || '');
          setOwnerName(data.business_details.ownerName || '');
        }
        
        Alert.alert('Success', 'Profile updated successfully via direct update');
      }
    } catch (err) {
      console.error('Error in updateBusinessDetails:', err);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push('/(main)/profile');
    }
  };

  // Use these values directly from the user store if not available from the profiles query
  const fallbackShopName = user?.business_details?.shopName || 'Your Shop';
  const fallbackOwnerName = user?.business_details?.ownerName || 'Shop Owner';

  // The shop name to display - try data from query first, then fall back to user object
  const displayShopName = shopName || fallbackShopName;
  
  // The owner name to display - try data from query first, then fall back to user object
  const displayOwnerName = ownerName || fallbackOwnerName;

  return (
    <View>
      <TouchableOpacity 
        style={styles.container} 
        onPress={handlePress}
        disabled={!onPress && !showName}
      >
        <Avatar.Image
          size={getAvatarSize()}
          source={
            avatarUrl 
              ? { uri: avatarUrl } 
              : require('../assets/images/avatar.png')
          }
          style={styles.avatar}
        />
        
        {showName && (
          <View style={styles.textContainer}>
            <Text 
              variant={size === 'large' ? 'titleLarge' : 'titleMedium'} 
              style={styles.shopName}
              numberOfLines={1}
            >
              {displayShopName}
            </Text>
            
            {showOwnerName && (
              <Text 
                variant="bodySmall" 
                style={styles.ownerName}
                numberOfLines={1}
              >
                {displayOwnerName}
              </Text>
            )}
            
            {__DEV__ && error && (
              <Text
                variant="bodySmall"
                style={styles.errorText}
                numberOfLines={1}
              >
                Error: {error}
              </Text>
            )}
          </View>
        )}
      </TouchableOpacity>

      {/* Debug buttons - only shown in dev mode and when enabled */}
      {__DEV__ && showDebugButtons && (
        <View style={styles.debugButtons}>
          <Text variant="bodySmall" style={styles.debugText}>
            Shop Name: {displayShopName} (from {shopName ? 'query' : 'fallback'})
          </Text>
          <Text variant="bodySmall" style={styles.debugText}>
            Owner Name: {displayOwnerName} (from {ownerName ? 'query' : 'fallback'})
          </Text>
          <Button 
            mode="outlined" 
            onPress={fetchProfileData}
            loading={loading}
            style={styles.debugButton}
          >
            Refresh Data
          </Button>
          <Button 
            mode="contained" 
            onPress={updateBusinessDetails}
            loading={updatingProfile}
            style={styles.debugButton}
          >
            Update Business Details
          </Button>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
  },
  avatar: {
    backgroundColor: '#f0f0f0',
  },
  textContainer: { 
    marginLeft: 12,
    flex: 1,
  },
  shopName: {
    fontWeight: '600',
  },
  ownerName: {
    marginTop: 2,
    opacity: 0.7,
  },
  errorText: {
    color: 'red',
    fontSize: 10,
    marginTop: 2,
  },
  debugButtons: {
    flexDirection: 'column',
    marginTop: 8, 
    padding: 4,
    backgroundColor: '#f5f5f5',
    borderRadius: 4,
  },
  debugButton: {
    marginBottom: 8,
    marginTop: 4,
  },
  debugText: {
    fontSize: 10,
    opacity: 0.7,
    marginBottom: 2,
  }
});