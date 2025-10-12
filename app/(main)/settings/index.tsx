import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, List, Switch, Divider, Button, IconButton, Modal, Card, ActivityIndicator } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useEdgeToEdge, getSafeAreaStyles } from '../../../utils/android15EdgeToEdge';
import { supabase } from '../../../services/supabase/supabase';
import { useAuthStore } from '../../../store/auth';
import { useSettingsStore } from '../../../store/settings';
import { useLanguage } from '../../../contexts/LanguageContext';
import { translationService } from '../../../services/translationService';
export default function Settings() {

  const router = useRouter();
  const user = useAuthStore(state => state.user);
  const { insets } = useEdgeToEdge({ statusBarStyle: 'dark' });
  const { currentLanguage } = useLanguage();
  const [translations, setTranslations] = useState({});
  const { 
    notificationsEnabled, 
    orderUpdatesEnabled, 
    promotionsEnabled, 
    darkMode,
    fontFamily,
    fontSize,
    setNotifications, 
    setOrderUpdates, 
    setPromotions, 
    setDarkMode,
    checkNotificationPermissions,
    clearCache,
    backupData,
    restoreDefaults
  } = useSettingsStore();
  
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalContent, setModalContent] = useState<React.ReactNode | null>(null);
  const [fetchingData, setFetchingData] = useState(false);
  const [notificationLoading, setNotificationLoading] = useState(false);

  const originalTexts = {
    settings: 'Settings',
    accountSettings: 'Account Settings',
    personalInformation: 'Personal Information',
    personalInfoDescription: 'View and manage your personal details',
    businessDetails: 'Business Details',
    businessDetailsDescription: 'View and manage your business information',
    changePassword: 'Change Password',
    changePasswordDescription: 'Update your account password',
    notifications: 'Notifications',
    pushNotifications: 'Push Notifications',
    pushNotificationsDescription: 'Receive push notifications for important updates',
    orderUpdates: 'Order Updates',
    orderUpdatesDescription: 'Get notified about order status changes',
    promotionsOffers: 'Promotions & Offers',
    promotionsOffersDescription: 'Receive notifications about special offers and promotions',
    appPreferences: 'App Preferences',
    darkMode: 'Dark Mode',
    darkModeDescription: 'Switch between light and dark themes',
    fontSettings: 'Font Settings',
    language: 'Language',
    languageDescription: 'Choose your preferred language',
    dataStorage: 'Data & Storage',
    clearCache: 'Clear Cache',
    clearCacheDescription: 'Clear app cache and temporary files',
    backupData: 'Backup Data',
    backupDataDescription: 'Backup your app data to cloud storage',
    resetToDefaults: 'Reset to Defaults',
    resetToDefaultsDescription: 'Reset all settings to default values',
    about: 'About',
    appVersion: 'App Version',
    logout: 'Logout',
    logoutConfirmTitle: 'Logout',
    logoutConfirmMessage: 'Are you sure you want to logout?',
    cancel: 'Cancel',
    resetConfirmTitle: 'Reset to Defaults',
    resetConfirmMessage: 'Are you sure you want to reset all settings to default values? This action cannot be undone.',
    reset: 'Reset',
    success: 'Success',
    error: 'Error',
    cacheClearedSuccess: 'Cache cleared successfully',
    cacheClearError: 'Failed to clear cache',
    backupSuccess: 'Data backup completed successfully',
    backupError: 'Failed to backup data',
    resetSuccess: 'Settings reset to defaults successfully',
    loading: 'Loading...',
    close: 'Close',
    contactSupport: 'Please contact our support team for assistance:',
    failedToLoadPersonalInfo: 'Failed to load personal information',
    failedToLoadBusinessDetails: 'Failed to load business details'
  };

  // Translation loading effect
  useEffect(() => {
    const loadTranslations = async () => {
      try {
        if (!currentLanguage || currentLanguage === 'en') {
          setTranslations(originalTexts);
          return;
        }

        // Translate each text individually using translateText method (like loans screen)
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

  // Check notification permissions when screen loads - defer to avoid blocking navigation
  useEffect(() => {
    const timer = setTimeout(() => {
      checkNotificationPermissions();
    }, 100); // Small delay to allow navigation to complete first
    
    return () => clearTimeout(timer);
  }, [checkNotificationPermissions]);

  const handleClearCache = async () => {
    try {
      setLoading(true);
      await clearCache();
      Alert.alert(translations.success || 'Success', translations.cacheClearedSuccess || 'Cache cleared successfully');
    } catch (error) {
      Alert.alert(translations.error || 'Error', translations.cacheClearError || 'Failed to clear cache');
    } finally {
      setLoading(false);
    }
  };

  const handleBackupData = async () => {
    try {
      setLoading(true);
      const success = await backupData();
      if (success) {
        Alert.alert(translations.success || 'Success', translations.backupSuccess || 'Data backup completed successfully');
      } else {
        Alert.alert(translations.error || 'Error', translations.backupError || 'Failed to backup data');
      }
    } catch (error) {
      Alert.alert(translations.error || 'Error', translations.backupError || 'Failed to backup data');
    } finally {
      setLoading(false);
    }
  };

  const handleResetDefaults = () => {
    Alert.alert(
      translations.resetConfirmTitle || 'Reset to Defaults',
      translations.resetConfirmMessage || 'Are you sure you want to reset all settings to default values? This action cannot be undone.',
      [
        {
          text: translations.cancel || 'Cancel',
          style: 'cancel',
        },
        {
          text: translations.reset || 'Reset',
          style: 'destructive',
          onPress: async () => {
            await restoreDefaults();
            Alert.alert(translations.success || 'Success', translations.resetSuccess || 'Settings reset to defaults successfully');
          },
        },
      ]
    );
  };

  const fetchPersonalInfo = async () => {
    try {
      setFetchingData(true);
      setModalTitle(translations.personalInformation || 'Personal Information');
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user?.id)
        .single();
      
      if (error) throw error;
      
      // Display personal info in the modal
      setModalContent(
        <View>
          <List.Item
            title="Name"
            description={data?.full_name || user?.full_name || 'Not set'}
          />
          <Divider />
          <List.Item
            title="Phone Number"
            description={data?.phone_number || user?.phone_number || 'Not set'}
          />
          <Divider />
          <List.Item
            title="Email"
            description={data?.email || user?.email || 'Not set'}
          />
          <Divider />
          <List.Item
            title="Role"
            description={(data?.role || user?.role || 'User').toUpperCase()}
          />
          <Text style={styles.modalNote}>
            Personal information editing is disabled for security reasons. Please contact support to make changes.
          </Text>
        </View>
      );
      
      setModalVisible(true);
    } catch (error) {
      console.error('Error fetching personal info:', error);
      Alert.alert(translations.error || 'Error', translations.failedToLoadPersonalInfo || 'Failed to load personal information');
    } finally {
      setFetchingData(false);
    }
  };

  const fetchBusinessDetails = async () => {
    try {
      setFetchingData(true);
      setModalTitle(translations.businessDetails || 'Business Details');
      
      const { data, error } = await supabase
        .from('profiles')
        .select('business_details, shop_image')
        .eq('id', user?.id)
        .single();
      
      if (error) throw error;
      
      const businessDetails = data?.business_details || {};
      
      // Display business details in the modal
      setModalContent(
        <View>
          <List.Item
            title="Shop Name"
            description={businessDetails.shopName || 'Not set'}
          />
          <Divider />
          <List.Item
            title="Address"
            description={businessDetails.address || 'Not set'}
          />
          <Divider />
          <List.Item
            title="GSTIN"
            description={businessDetails.gstin || 'Not set'}
          />
          <Text style={styles.modalNote}>
            Business details editing is disabled for security reasons. Please contact support to make changes.
          </Text>
        </View>
      );
      
      setModalVisible(true);
    } catch (error) {
      console.error('Error fetching business details:', error);
      Alert.alert(translations.error || 'Error', translations.failedToLoadBusinessDetails || 'Failed to load business details');
    } finally {
      setFetchingData(false);
    }
  };

  const showPasswordChangeInfo = () => {
    setModalTitle(translations.changePassword || 'Change Password');
    setModalContent(
      <View>
        <Text style={styles.modalText}>
          For security reasons, password changes must be done through our secure portal.
        </Text>
        <Text style={styles.modalText}>
          {translations.contactSupport || 'Please contact our support team for assistance:'}
        </Text>
        <Text style={styles.modalText}>
          Email: support@dukaaon.com
        </Text>
        <Text style={styles.modalText}>
          Phone: +91 9876543210
        </Text>
      </View>
    );
    setModalVisible(true);
  };

  return (
    <View style={[styles.safeArea, getSafeAreaStyles(insets)]}>
      <View style={styles.header}>
        <IconButton 
          icon="arrow-left" 
          size={24}
          onPress={() => router.back()}
        />
        <Text style={styles.headerTitle}>{translations.settings || 'Settings'}</Text>
        <View style={{width: 40}} />
      </View>
      
      <ScrollView style={styles.container}>
        {/* Account Section */}
        <List.Section>
          <List.Subheader>{translations.accountSettings || 'Account Settings'}</List.Subheader>
          <List.Item
            title={translations.personalInformation || 'Personal Information'}
            description={translations.personalInfoDescription || 'View and manage your personal details'}
            left={props => <List.Icon {...props} icon="account" />}
            right={props => <List.Icon {...props} icon="chevron-right" />}
            onPress={fetchPersonalInfo}
          />
          <List.Item
            title={translations.businessDetails || 'Business Details'}
            description={translations.businessDetailsDescription || 'View and manage your business information'}
            left={props => <List.Icon {...props} icon="store" />}
            right={props => <List.Icon {...props} icon="chevron-right" />}
            onPress={fetchBusinessDetails}
          />
          <List.Item
            title={translations.changePassword || 'Change Password'}
            description={translations.changePasswordDescription || 'Update your account password'}
            left={props => <List.Icon {...props} icon="key" />}
            right={props => <List.Icon {...props} icon="chevron-right" />}
            onPress={showPasswordChangeInfo}
          />
        </List.Section>
        
        <Divider />
        
        {/* Notifications Section */}
        <List.Section>
          <List.Subheader>{translations.notifications || 'Notifications'}</List.Subheader>
          <List.Item
            title={translations.pushNotifications || 'Push Notifications'}
            description={translations.pushNotificationsDescription || 'Receive push notifications for important updates'}
            left={props => <List.Icon {...props} icon="bell" />}
            right={() => (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {notificationLoading && (
                  <ActivityIndicator size="small" style={{ marginRight: 8 }} />
                )}
                <Switch
                  value={notificationsEnabled}
                  onValueChange={async (value) => {
                    setNotificationLoading(true);
                    try {
                      await setNotifications(value);
                    } catch (error) {
                      console.error('Error toggling notifications:', error);
                    } finally {
                      setNotificationLoading(false);
                    }
                  }}
                  disabled={notificationLoading}
                  color="#FF7D00"
                />
              </View>
            )}
          />
          <List.Item
            title={translations.orderUpdates || 'Order Updates'}
            description={translations.orderUpdatesDescription || 'Get notified about order status changes'}
            left={props => <List.Icon {...props} icon="truck-delivery" />}
            right={() => (
              <Switch
                value={orderUpdatesEnabled}
                onValueChange={setOrderUpdates}
                disabled={!notificationsEnabled}
                color="#FF7D00"
              />
            )}
          />
          <List.Item
            title={translations.promotionsOffers || 'Promotions & Offers'}
            description={translations.promotionsOffersDescription || 'Receive notifications about special offers and promotions'}
            left={props => <List.Icon {...props} icon="tag" />}
            right={() => (
              <Switch
                value={promotionsEnabled}
                onValueChange={setPromotions}
                disabled={!notificationsEnabled}
                color="#FF7D00"
              />
            )}
          />
        </List.Section>
        
        <Divider />
        
        {/* App Preferences */}
        <List.Section>
          <List.Subheader>{translations.appPreferences || 'App Preferences'}</List.Subheader>
          <List.Item
            title={translations.darkMode || 'Dark Mode'}
            description={translations.darkModeDescription || 'Switch between light and dark themes'}
            left={props => <List.Icon {...props} icon="theme-light-dark" />}
            right={() => (
              <Switch
                value={darkMode}
                onValueChange={setDarkMode}
                color="#FF7D00"
              />
            )}
          />
          <List.Item
            title={translations.fontSettings || 'Font Settings'}
            description={`Font: ${fontFamily}, Size: ${fontSize}px`}
            left={props => <List.Icon {...props} icon="format-font" />}
            right={props => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => router.push('/(main)/settings/font')}
          />
          <List.Item
            title={translations.language || 'Language'}
            description={translations.languageDescription || 'Choose your preferred language'}
            left={props => <List.Icon {...props} icon="translate" />}
            right={props => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => router.push('/(main)/settings/language')}
          />
        </List.Section>
        
        <Divider />
        
        {/* Data & Storage */}
        <List.Section>
          <List.Subheader>{translations.dataStorage || 'Data & Storage'}</List.Subheader>
          <List.Item
            title={translations.clearCache || 'Clear Cache'}
            description={translations.clearCacheDescription || 'Clear app cache and temporary files'}
            left={props => <List.Icon {...props} icon="cached" />}
            onPress={handleClearCache}
          />
          <List.Item
            title={translations.backupData || 'Backup Data'}
            description={translations.backupDataDescription || 'Backup your app data to cloud storage'}
            left={props => <List.Icon {...props} icon="cloud-upload" />}
            onPress={handleBackupData}
          />
          <List.Item
            title={translations.resetToDefaults || 'Reset to Defaults'}
            description={translations.resetToDefaultsDescription || 'Reset all settings to default values'}
            left={props => <List.Icon {...props} icon="restore" />}
            onPress={handleResetDefaults}
          />
        </List.Section>
        
        <Divider />
        
        {/* About */}
        <List.Section>
          <List.Subheader>{translations.about || 'About'}</List.Subheader>
          <List.Item
            title={translations.appVersion || 'App Version'}
            description="1.0.0"
            left={props => <List.Icon {...props} icon="information" />}
          />
        </List.Section>
        
        <Button
          mode="outlined"
          icon="logout"
          onPress={() => {
            Alert.alert(
              translations.logoutConfirmTitle || 'Logout',
              translations.logoutConfirmMessage || 'Are you sure you want to logout?',
              [
                {
                  text: translations.cancel || 'Cancel',
                  style: 'cancel',
                },
                {
                  text: translations.logout || 'Logout',
                  onPress: async () => {
                    // Handle logout
                    await supabase.auth.signOut();
                    useAuthStore.getState().clearAuth();
                    router.replace('/(auth)/language');
                  },
                },
              ]
            );
          }}
          textColor="#ff4444"
          style={styles.logoutButton}
          loading={loading}
        >
          {translations.logout || 'Logout'}
        </Button>
        
        <View style={styles.bottomPadding} />
      </ScrollView>
      
      {/* Modal for displaying account information */}
      <Modal
        visible={modalVisible}
        onDismiss={() => setModalVisible(false)}
        contentContainerStyle={styles.modalContainer}
      >
        <Card>
          <Card.Title title={modalTitle} />
          <Card.Content>
            {fetchingData ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#FF7D00" />
                <Text style={styles.loadingText}>{translations.loading || 'Loading...'}</Text>
              </View>
            ) : (
              modalContent
            )}
          </Card.Content>
          <Card.Actions>
            <Button onPress={() => setModalVisible(false)}>{translations.close || 'Close'}</Button>
          </Card.Actions>
        </Card>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingHorizontal: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    flex: 1,
  },
  logoutButton: {
    margin: 16,
    marginTop: 8,
    borderRadius: 20,
    borderColor: '#ff4444',
  },
  bottomPadding: {
    height: 100,
  },
  modalContainer: {
    marginHorizontal: 16,
    borderRadius: 8,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
  },
  modalText: {
    marginBottom: 12,
  },
  modalNote: {
    marginTop: 16,
    fontStyle: 'italic',
    color: '#ff4444',
    fontSize: 12,
  },
});