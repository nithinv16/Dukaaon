import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { IconButton, Avatar } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { UserProfile } from './UserProfile';
import { supabase } from '../services/supabase/supabase';
import { useAuthStore } from '../store/auth';

interface SimpleHeaderProps {
  title?: string;
  subtitle?: string;
  onLocationPress?: () => void;
  location?: string;
  showUserProfile?: boolean;
}

export function SimpleHeader({ 
  title, 
  subtitle, 
  onLocationPress, 
  location,
  showUserProfile = true
}: SimpleHeaderProps) {
  const router = useRouter();
  const user = useAuthStore(state => state.user);
  const setUser = useAuthStore(state => state.setUser);
  const refreshUserData = useAuthStore(state => state.refreshUserData);
  const [shopName, setShopName] = useState<string>('');
  const [ownerName, setOwnerName] = useState<string>('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInitialData = async () => {
      if (user?.id && showUserProfile) {
        await fetchProfileData();
      } else if (!user?.id && showUserProfile) {
        await refreshUserData();
      }
    };

    fetchInitialData();
  }, [user?.id, showUserProfile, refreshUserData]);

  const fetchProfileData = async () => {
    if (!user || loading) return;
    
    try {
      setLoading(true);
      
      // Use RPC function to get profile data
      const { data, error } = await supabase.rpc('get_my_profile');
      
      if (error) {
        return;
      }
      
      if (data) {
        // Update stored profile data
        setUser(data);
        
        // Set business details for display
        const businessDetails = data.business_details || {};
        setShopName(businessDetails.shopName || 'Shop');
        setOwnerName(businessDetails.ownerName || 'Owner');
        
        // Set avatar URL from profile_image_url
        setAvatarUrl(data.profile_image_url || null);
      }
    } catch (error) {
      // Handle error silently
    } finally {
      setLoading(false);
    }
  };

  const goToCart = () => {
    router.push('/(main)/cart');
  };

  const goToProfile = () => {
    router.push('/(main)/profile');
  };

  // Display either the found shop/owner names or fallbacks
  const displayShopName = shopName || title || 'Your Shop';
  const displayOwnerName = ownerName || subtitle || 'Shop Owner';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.main}>
          {showUserProfile ? (
            <View style={styles.profileContainer}>
              <TouchableOpacity onPress={goToProfile} style={styles.avatarContainer}>
                <Avatar.Image 
                  size={40} 
                  source={
                    avatarUrl 
                      ? { uri: avatarUrl } 
                      : require('../assets/images/avatar.png')
                  }
                  style={styles.avatar}
                />
              </TouchableOpacity>
              <View style={styles.userInfoContainer}>
                <Text style={styles.shopName} numberOfLines={1}>
                  {displayShopName}
                </Text>
                <Text style={styles.ownerName} numberOfLines={1}>
                  {displayOwnerName}
                </Text>
              </View>
            </View>
          ) : (
            <TouchableOpacity onPress={goToProfile} style={styles.titleContainer}>
              <Text style={styles.title}>{title || 'Title'}</Text>
              {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
            </TouchableOpacity>
          )}

          {location && (
            <View style={styles.locationContainer}>
              <IconButton 
                icon="map-marker" 
                size={16} 
                onPress={onLocationPress} 
                style={styles.locationIcon}
              />
              <Text style={styles.locationText} numberOfLines={1}>
                {location}
              </Text>
            </View>
          )}
        </View>

        <TouchableOpacity onPress={goToCart} style={styles.cartButton}>
          <IconButton icon="cart" size={24} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
  },
  header: {
    backgroundColor: '#ffffff',
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  main: {
    flex: 1,
  },
  profileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  avatarContainer: {
    marginRight: 10,
  },
  avatar: {
    backgroundColor: '#f0f0f0',
  },
  userInfoContainer: {
    flex: 1,
  },
  shopName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  ownerName: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  titleContainer: {
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  locationIcon: {
    margin: 0,
    padding: 0,
  },
  locationText: {
    fontSize: 12,
    color: '#666',
    flex: 1,
  },
  cartButton: {
    marginLeft: 8,
  }
});