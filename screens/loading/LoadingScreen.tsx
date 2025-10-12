import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import useAuthStore from '../../store/auth';
import { colors } from '../../theme/colors';
import { forceAuthSync } from '../../services/auth/firebaseSupabaseSync';
import { getCurrentUser } from '../../services/auth/authService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MAX_RETRIES = 3;

const LoadingScreen = () => {
  const navigation = useNavigation();
  const { user, loading, error, retryProfileLoad, logout, clearError, cleanupAuthState, createProfileDirectly } = useAuthStore();
  const [retryCount, setRetryCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [manualRetry, setManualRetry] = useState(false);

  useEffect(() => {
    const checkAuthAndLoadProfile = async () => {
      // Check if we already have a user
      if (user) {
        navigateToAppropriateScreen();
        return;
      }

      // Check if we have a Supabase user but no profile
      const supabaseUser = await getCurrentUser();
      if (!supabaseUser) {
      // No Supabase user, check if we have phone number in storage for direct profile creation
      const checkStorageAndCreateProfile = async () => {
        const phoneNumber = await AsyncStorage.getItem('user_phone');
        if (phoneNumber) {
          console.log('No Supabase user but found phone in storage, attempting direct profile creation');
          const profile = await createProfileDirectly(phoneNumber);
          if (profile) {
            navigateToAppropriateScreen();
          } else {
            // If direct creation fails, go to login
            navigation.reset({
              index: 0,
              routes: [{ name: 'Login' }],
            });
          }
        } else {
          // No phone number either, send to login
          navigation.reset({
            index: 0,
            routes: [{ name: 'Login' }],
          });
        }
      };
      
      await checkStorageAndCreateProfile();
      return;
    }

    // We have Supabase user but no profile - try to load it
    const loadProfile = async () => {
      try {
        const success = await retryProfileLoad();
        if (success) {
          navigateToAppropriateScreen();
        } else if (retryCount < MAX_RETRIES) {
          // Increment retry count and try again after a delay
          setRetryCount(prev => prev + 1);
          setTimeout(() => {
            setManualRetry(false);
            loadProfile();
          }, 2000);
        } else {
          setErrorMessage('Unable to load your profile after multiple attempts. Please try again or contact support.');
        }
      } catch (err) {
        console.error('Error in LoadingScreen profile load:', err);
        setErrorMessage(`Error loading profile: ${err.message}`);
      }
    };

      if (!loading && !manualRetry) {
        await loadProfile();
      }
    };

    checkAuthAndLoadProfile();
  }, [user, loading, manualRetry]);

  const navigateToAppropriateScreen = () => {
    if (!user) return;

    if (user.status === 'pending_verification') {
      navigation.reset({
        index: 0,
        routes: [{ name: 'BusinessVerification' }],
      });
    } else {
      navigation.reset({
        index: 0,
        routes: [{ name: 'Main' }],
      });
    }
  };

  const handleRetry = () => {
    setErrorMessage(null);
    clearError();
    setManualRetry(true);
    setRetryCount(0);
  };

  const handleLogout = async () => {
    await logout();
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  };

  const handleForceSyncAndRetry = async () => {
    setErrorMessage(null);
    setManualRetry(true);
    
    try {
      const success = await forceAuthSync();
      if (success) {
        navigateToAppropriateScreen();
      } else {
        setErrorMessage('Force sync failed. Please try logging in again.');
      }
    } catch (err) {
      console.error('Force sync error:', err);
      setErrorMessage(`Force sync error: ${err.message}`);
    } finally {
      setManualRetry(false);
    }
  };

  const handleResetAuth = () => {
    Alert.alert(
      "Reset Authentication",
      "This will sign you out and clear all authentication data. You'll need to sign in again. Continue?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            try {
              await cleanupAuthState();
              navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }],
              });
            } catch (err) {
              console.error('Error in auth reset:', err);
              setErrorMessage(`Auth reset failed: ${err.message}`);
            }
          }
        }
      ]
    );
  };

  const handleTryPhoneOnly = async () => {
    try {
      setErrorMessage(null);
      setManualRetry(true);
      
      // Get phone from AsyncStorage
      const phoneNumber = await AsyncStorage.getItem('user_phone');
      if (!phoneNumber) {
        setErrorMessage("No phone number stored. Please sign in again.");
        setManualRetry(false);
        return;
      }
      
      // Try creating profile directly with phone number
      const profile = await createProfileDirectly(phoneNumber);
      if (profile) {
        navigateToAppropriateScreen();
      } else {
        setErrorMessage("Failed to create profile with stored phone number.");
      }
    } catch (err) {
      console.error('Error in phone-only login:', err);
      setErrorMessage(`Phone-only login failed: ${err.message}`);
    } finally {
      setManualRetry(false);
    }
  };

  const displayError = errorMessage || error;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>DukaaON</Text>
      
      {!displayError ? (
        <>
          <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
          <Text style={styles.loadingText}>Loading your profile...</Text>
          {retryCount > 0 && (
            <Text style={styles.retryText}>Attempt {retryCount}/{MAX_RETRIES}</Text>
          )}
          
          <TouchableOpacity 
            style={[styles.button, styles.buttonOutline, { marginTop: 20 }]} 
            onPress={handleTryPhoneOnly}
          >
            <Text style={[styles.buttonText, styles.buttonTextOutline]}>Try With Phone Only</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.button, styles.buttonDanger, { marginTop: 10 }]} 
            onPress={handleResetAuth}
          >
            <Text style={styles.buttonText}>Reset Authentication</Text>
          </TouchableOpacity>
        </>
      ) : (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Error</Text>
          <Text style={styles.errorMessage}>{displayError || 'An error occurred'}</Text>
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.button} onPress={handleRetry}>
              <Text style={styles.buttonText}>Retry</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.button, styles.buttonOutline]} onPress={handleForceSyncAndRetry}>
              <Text style={[styles.buttonText, styles.buttonTextOutline]}>Force Sync</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.button, styles.buttonOutline]} onPress={handleTryPhoneOnly}>
              <Text style={[styles.buttonText, styles.buttonTextOutline]}>Try With Phone Only</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.button, styles.buttonDanger]} onPress={handleLogout}>
              <Text style={styles.buttonText}>Logout</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.button, styles.buttonDanger, { marginTop: 10 }]} onPress={handleResetAuth}>
              <Text style={styles.buttonText}>Reset Authentication</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 30,
  },
  loader: {
    marginBottom: 20,
  },
  loadingText: {
    fontSize: 18,
    color: colors.text,
    marginBottom: 10,
  },
  retryText: {
    fontSize: 14,
    color: colors.secondary,
  },
  errorContainer: {
    width: '100%',
    padding: 20,
    backgroundColor: colors.cardBackground,
    borderRadius: 10,
    alignItems: 'center',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.error,
    marginBottom: 10,
  },
  errorMessage: {
    fontSize: 16,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 20,
  },
  buttonContainer: {
    flexDirection: 'column',
    width: '100%',
    gap: 10,
  },
  button: {
    backgroundColor: colors.primary,
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    width: '100%',
  },
  buttonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  buttonDanger: {
    backgroundColor: colors.error,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  buttonTextOutline: {
    color: colors.primary,
  },
});

export default LoadingScreen;