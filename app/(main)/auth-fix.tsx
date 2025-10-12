import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Button, Card, Divider, TextInput } from 'react-native-paper';
import { SystemStatusBar } from '../../components/SystemStatusBar';
import { Stack } from 'expo-router';
import { supabase } from '../../services/supabase/supabase';
import { useAuthStore } from '../../store/auth';
import { useLanguage } from '../../contexts/LanguageContext';
import { translationService } from '../../services/translationService';

export default function AuthFixPage() {
  const user = useAuthStore(state => state.user);
  const setUser = useAuthStore(state => state.setUser);
  const { currentLanguage } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [profileData, setProfileData] = useState<any>(null);
  const [testResults, setTestResults] = useState<any>({});
  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');

  // Original English text (never changes)
  const originalTexts = {
    error: 'Error',
    success: 'Success',
    profileCreatedOrFoundSuccessfully: 'Profile created or found successfully',
    businessDetailsUpdatedSuccessfully: 'Business details updated successfully',
    pleaseEnterBothShopNameAndOwnerName: 'Please enter both shop name and owner name'
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
        console.error('Auth fix translation error:', error);
        setTranslations(originalTexts);
      }
    };

    loadTranslations();
  }, [currentLanguage]);

  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    if (profileData?.business_details) {
      setShopName(profileData.business_details.shopName || '');
      setOwnerName(profileData.business_details.ownerName || '');
    }
  }, [profileData]);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      // Use the secure RPC function
      const { data, error } = await supabase
        .rpc('get_my_profile')
        .single();
      
      if (error) {
        console.error('Error fetching profile:', error);
        Alert.alert(translations.error, error.message);
      } else {
        setProfileData(data);
        console.log('Profile data:', data);
      }
    } catch (error) {
      console.error('Exception:', error);
      Alert.alert(translations.error, error.message);
    } finally {
      setLoading(false);
    }
  };

  const ensureProfile = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .rpc('ensure_my_profile')
        .single();
      
      if (error) {
        console.error('Error ensuring profile:', error);
        Alert.alert(translations.error, error.message);
      } else {
        setProfileData(data);
        setUser(data);
        Alert.alert(translations.success, translations.profileCreatedOrFoundSuccessfully);
      }
    } catch (error) {
      console.error('Exception:', error);
      Alert.alert(translations.error, error.message);
    } finally {
      setLoading(false);
    }
  };

  const updateBusinessDetails = async () => {
    if (!shopName.trim() || !ownerName.trim()) {
      Alert.alert(translations.error, translations.pleaseEnterBothShopNameAndOwnerName);
      return;
    }
    
    setLoading(true);
    try {
      const businessDetails = {
        shopName: shopName.trim(),
        ownerName: ownerName.trim(),
        address: profileData?.business_details?.address || '',
        pincode: profileData?.business_details?.pincode || '',
        updated_at: new Date().toISOString()
      };
      
      const { data, error } = await supabase
        .rpc('update_my_business_details', { new_details: businessDetails })
        .single();
      
      if (error) {
        console.error('Error updating profile:', error);
        Alert.alert(translations.error, error.message);
      } else {
        setProfileData(data);
        setUser({
          ...user,
          business_details: businessDetails
        });
        Alert.alert(translations.success, translations.businessDetailsUpdatedSuccessfully);
      }
    } catch (error) {
      console.error('Exception:', error);
      Alert.alert(translations.error, error.message);
    } finally {
      setLoading(false);
    }
  };

  const testAuthPolicies = async () => {
    setLoading(true);
    const results = {};
    
    try {
      // Test 1: Get auth.uid
      const { data: authUidData, error: authUidError } = await supabase
        .rpc('get_auth_uid');
      
      results['auth.uid'] = {
        success: !authUidError,
        data: authUidData,
        error: authUidError?.message
      };
      
      // Test 2: Safely compare UUID
      if (profileData?.id) {
        const { data: compareData, error: compareError } = await supabase
          .rpc('safely_compare_auth_uid_with_id', { profile_id: profileData.id });
        
        results['safely_compare_uuid'] = {
          success: !compareError,
          data: compareData,
          error: compareError?.message
        };
      }
      
      // Test 3: Direct select query
      const { data: selectData, error: selectError } = await supabase
        .from('profiles')
        .select('id, fire_id, email')
        .eq('id', user?.id)
        .single();
      
      results['direct_select'] = {
        success: !selectError,
        data: selectData ? 'Query succeeded' : 'No data found',
        error: selectError?.message
      };
      
      setTestResults(results);
    } catch (error) {
      console.error('Exception:', error);
      Alert.alert(translations.error, error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <SystemStatusBar style="dark" />
      <Stack.Screen
        options={{
          title: 'Auth ID Fix',
          headerShown: true,
        }}
      />
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Card style={styles.card}>
          <Card.Title title="Authenticated ID Column" />
          <Card.Content>
            <Text style={styles.description}>
              This page helps test and verify the authenticated ID column functionality.
              It uses secure RPC functions to access and update your profile data.
            </Text>
            
            <Divider style={styles.divider} />
            
            <Text style={styles.sectionTitle}>Profile Information</Text>
            {profileData ? (
              <>
                <Text><Text style={styles.label}>ID:</Text> {profileData.id}</Text>
                <Text><Text style={styles.label}>Fire ID:</Text> {profileData.fire_id || 'None'}</Text>
                <Text><Text style={styles.label}>Email:</Text> {profileData.email || 'None'}</Text>
                <Text><Text style={styles.label}>Phone:</Text> {profileData.phone_number || 'None'}</Text>
                <Text><Text style={styles.label}>Role:</Text> {profileData.role || 'None'}</Text>
                <Text><Text style={styles.label}>Status:</Text> {profileData.status || 'None'}</Text>
              </>
            ) : (
              <Text>No profile data available</Text>
            )}
            
            <Button
              mode="contained"
              onPress={fetchProfile}
              loading={loading}
              style={styles.button}
            >
              Refresh Profile
            </Button>
            
            <Button
              mode="outlined"
              onPress={ensureProfile}
              loading={loading}
              style={styles.button}
            >
              Ensure Profile Exists
            </Button>
            
            <Divider style={styles.divider} />
            
            <Text style={styles.sectionTitle}>Update Business Details</Text>
            <TextInput
              label="Shop Name"
              value={shopName}
              onChangeText={setShopName}
              style={styles.input}
            />
            <TextInput
              label="Owner Name"
              value={ownerName}
              onChangeText={setOwnerName}
              style={styles.input}
            />
            <Button
              mode="contained"
              onPress={updateBusinessDetails}
              loading={loading}
              style={styles.button}
              disabled={loading || !shopName.trim() || !ownerName.trim()}
            >
              Update Details
            </Button>
            
            <Divider style={styles.divider} />
            
            <Text style={styles.sectionTitle}>Test Authentication Policies</Text>
            <Button
              mode="contained"
              onPress={testAuthPolicies}
              loading={loading}
              style={styles.button}
            >
              Run Tests
            </Button>
            
            {Object.keys(testResults).length > 0 && (
              <View style={styles.testResults}>
                {Object.entries(testResults).map(([test, result]: [string, any]) => (
                  <View key={test} style={styles.testResult}>
                    <Text style={styles.testName}>{test}:</Text>
                    <Text style={[
                      styles.testStatus,
                      result.success ? styles.success : styles.error
                    ]}>
                      {result.success ? 'Success' : 'Failed'}
                    </Text>
                    {result.data && <Text>Data: {JSON.stringify(result.data)}</Text>}
                    {result.error && <Text style={styles.error}>Error: {result.error}</Text>}
                  </View>
                ))}
              </View>
            )}
          </Card.Content>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    padding: 16,
  },
  card: {
    marginBottom: 16,
  },
  description: {
    marginBottom: 16,
    lineHeight: 20,
  },
  divider: {
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  button: {
    marginTop: 8,
  },
  input: {
    marginBottom: 8,
  },
  label: {
    fontWeight: 'bold',
  },
  testResults: {
    marginTop: 16,
  },
  testResult: {
    marginBottom: 8,
    padding: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
  },
  testName: {
    fontWeight: 'bold',
  },
  testStatus: {
    fontWeight: 'bold',
  },
  success: {
    color: 'green',
  },
  error: {
    color: 'red',
  },
});