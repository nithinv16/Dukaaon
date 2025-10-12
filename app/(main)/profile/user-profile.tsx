import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Divider, Button } from 'react-native-paper';
import { Stack } from 'expo-router';
import { UserProfile } from '../../../components/UserProfile';
import { supabase } from '../../../services/supabase/supabase';
import { useAuthStore } from '../../../store/auth';
import { useLanguage } from '../../../contexts/LanguageContext';
import { translationService } from '../../../services/translationService';

export default function UserProfileDemo() {
  const [loading, setLoading] = useState(false);
  const [nameLoading, setNameLoading] = useState(false);
  const user = useAuthStore(state => state.user);
  const setUser = useAuthStore(state => state.setUser);

  // Translation setup
  const { currentLanguage } = useLanguage();
  const [translations, setTranslations] = useState({
    error: 'Error',
    userIdNotAvailable: 'User ID not available',
    success: 'Success',
    profileUpdatedDirectly: 'Profile updated directly',
    profileUpdatedViaRpc: 'Profile updated via RPC',
    failedToUpdateProfile: 'Failed to update profile',
    failedToUpdateOwnerName: 'Failed to update owner name'
  });

  useEffect(() => {
    const loadTranslations = async () => {
      if (currentLanguage !== 'en') {
        const translatedTexts = await Promise.all([
          translationService.translateText('Error', currentLanguage),
          translationService.translateText('User ID not available', currentLanguage),
          translationService.translateText('Success', currentLanguage),
          translationService.translateText('Profile updated directly', currentLanguage),
          translationService.translateText('Profile updated via RPC', currentLanguage),
          translationService.translateText('Failed to update profile', currentLanguage),
          translationService.translateText('Failed to update owner name', currentLanguage)
        ]);

        setTranslations({
          error: translatedTexts[0],
          userIdNotAvailable: translatedTexts[1],
          success: translatedTexts[2],
          profileUpdatedDirectly: translatedTexts[3],
          profileUpdatedViaRpc: translatedTexts[4],
          failedToUpdateProfile: translatedTexts[5],
          failedToUpdateOwnerName: translatedTexts[6]
        });
      }
    };

    loadTranslations();
  }, [currentLanguage]);

  // Simple direct update function for testing
  const updateOwnerNameDirectly = async () => {
    if (!user?.id) {
      Alert.alert(translations.error, translations.userIdNotAvailable);
      return;
    }

    try {
      setLoading(true);
      
      // Get existing business_details or create new
      const businessDetails = user.business_details || {};
      
      // Add or update ownerName field
      businessDetails.ownerName = businessDetails.ownerName || 'Shop Owner';
      
      console.log('Updating business_details with ownerName:', businessDetails);
      
      // Direct SQL update query using Supabase - should bypass RLS
      const { data, error } = await supabase.rpc('update_profile_business_details', {
        profile_id: user.id,
        business_details: businessDetails
      });
      
      if (error) {
        console.error('RPC Error:', error);
        
        // Fallback to direct update if RPC fails
        const { data: updateData, error: updateError } = await supabase
          .from('profiles')
          .update({ business_details: businessDetails })
          .eq('id', user.id)
          .select()
          .single();
          
        if (updateError) {
          throw updateError;
        }
        
        if (updateData) {
          // Update local user state
          setUser({
            ...user,
            business_details: updateData.business_details
          });
          
          Alert.alert(translations.success, translations.profileUpdatedDirectly);
        }
      } else {
        // Success from RPC
        Alert.alert(translations.success, translations.profileUpdatedViaRpc);
        
        // Refresh the user state
        const { data: refreshedUser } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
          
        if (refreshedUser) {
          setUser({
            ...user,
            business_details: refreshedUser.business_details
          });
        }
      }
    } catch (err) {
      console.error('Error updating profile:', err);
      Alert.alert(translations.error, translations.failedToUpdateProfile);
    } finally {
      setLoading(false);
    }
  };

  // Update owner name only using the simpler RPC function
  const updateOwnerNameOnly = async () => {
    if (!user?.id) {
      Alert.alert(translations.error, translations.userIdNotAvailable);
      return;
    }

    try {
      setNameLoading(true);
      
      // Call the simpler RPC function
      const { data, error } = await supabase.rpc('update_profile_owner_name', {
        profile_id: user.id,
        owner_name: 'Shop Owner'  // You can customize this value
      });
      
      if (error) {
        console.error('RPC Error with update_profile_owner_name:', error);
        Alert.alert(translations.error, `${translations.failedToUpdateOwnerName}: ${error.message}`);
        return;
      }
      
      console.log('Owner name updated successfully:', data);
      
      // Refresh the user state
      const { data: refreshedUser } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
        
      if (refreshedUser) {
        setUser({
          ...user,
          business_details: refreshedUser.business_details
        });
        
        Alert.alert('Success', 'Owner name updated');
      }
    } catch (err) {
      console.error('Error updating owner name:', err);
      Alert.alert('Error', 'Failed to update owner name');
    } finally {
      setNameLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Stack.Screen 
        options={{
          title: 'User Profile',
        }} 
      />
      
      <View style={styles.section}>
        <Text variant="titleLarge" style={styles.sectionTitle}>Debug Tools</Text>
        <View style={styles.example}>
          <Text variant="labelMedium">Profile with debug</Text>
          <Text variant="bodySmall" style={styles.note}>
            Debug description
          </Text>
          <UserProfile size="medium" showDebugButtons={true} />
          
          <Divider style={[styles.divider, { marginVertical: 16 }]} />
          
          <Text variant="bodyMedium" style={styles.updateTitle}>Direct Update Functions</Text>
          
          <Text variant="bodySmall" style={styles.note}>
            Update business details
          </Text>
          <Button
            mode="contained"
            onPress={updateOwnerNameDirectly}
            loading={loading}
            style={styles.directUpdateButton}
          >
            Update Full Business
          </Button>
          
          <Text variant="bodySmall" style={[styles.note, { marginTop: 16 }]}>
            Update owner name simple
          </Text>
          <Button
            mode="contained"
            onPress={updateOwnerNameOnly}
            loading={nameLoading}
            style={styles.directUpdateButton}
          >
            Update Owner Name Only
          </Button>
        </View>
      </View>
      
      <Divider style={styles.divider} />
      
      <View style={styles.section}>
        <Text variant="titleLarge" style={styles.sectionTitle}>Different Sizes</Text>
        <View style={styles.example}>
          <Text variant="labelMedium">Small</Text>
          <UserProfile size="small" />
        </View>
        
        <View style={styles.example}>
          <Text variant="labelMedium">Medium (Default)</Text>
          <UserProfile size="medium" />
        </View>
        
        <View style={styles.example}>
          <Text variant="labelMedium">Large</Text>
          <UserProfile size="large" />
        </View>
      </View>
      
      <Divider style={styles.divider} />
      
      <View style={styles.section}>
        <Text variant="titleLarge" style={styles.sectionTitle}>Configuration Options</Text>
        
        <View style={styles.example}>
          <Text variant="labelMedium">Avatar Only</Text>
          <UserProfile showName={false} showOwnerName={false} />
        </View>
        
        <View style={styles.example}>
          <Text variant="labelMedium">Shop Name Only</Text>
          <UserProfile showOwnerName={false} />
        </View>
        
        <View style={styles.example}>
          <Text variant="labelMedium">Complete Profile (Default)</Text>
          <UserProfile />
        </View>
      </View>
      
      <Divider style={styles.divider} />
      
      <View style={styles.section}>
        <Text variant="titleLarge" style={styles.sectionTitle}>Custom Combinations</Text>
        
        <View style={styles.example}>
          <Text variant="labelMedium">Large Shop Name Only</Text>
          <UserProfile size="large" showOwnerName={false} />
        </View>
        
        <View style={styles.example}>
          <Text variant="labelMedium">Small Full Details</Text>
          <UserProfile size="small" />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    marginBottom: 16,
  },
  example: {
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#e0e0e0',
  },
  note: {
    fontStyle: 'italic',
    marginBottom: 12,
    opacity: 0.7,
  },
  directUpdateButton: {
    marginTop: 8,
  },
  updateTitle: {
    fontWeight: '600',
    marginBottom: 12,
  }
});