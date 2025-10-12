import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../../store/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { forceAuthSync } from '../../../services/auth/firebaseSupabaseSync';
import { getCurrentUser } from '../../../services/auth/authService';

const MAX_RETRIES = 3;

export default function LoadingScreen() {
  const router = useRouter();
  const { user, loading } = useAuthStore();
  const { createProfileDirectly, clearAuth } = useAuthStore();
  
  const [retryCount, setRetryCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [manualRetry, setManualRetry] = useState(false);
  const [retryTimeout, setRetryTimeout] = useState<NodeJS.Timeout | null>(null);

  // Clear any timeouts when component unmounts
  useEffect(() => {
    return () => {
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
    };
  }, [retryTimeout]);

  useEffect(() => {
    const checkAuthAndLoadProfile = async () => {
      console.log('LoadingScreen mounted - checking auth state');
      
      // Check if we already have a user and navigate if we do
      if (user) {
        console.log('User already loaded, navigating to home');
        navigateToHome();
        return;
      }

      // First check if we have a Supabase user
      const supabaseUser = await getCurrentUser();
      
      if (!supabaseUser) {
        console.log('No Supabase user, checking for phone number in storage');
        // No Supabase user, check if we have phone number in storage for direct profile creation
        const checkStorageAndCreateProfile = async () => {
          const phoneNumber = await AsyncStorage.getItem('user_phone');
          if (phoneNumber) {
            console.log('Found phone in storage, attempting direct profile creation');
            try {
              const profile = await createProfileDirectly(phoneNumber);
              if (profile) {
                console.log('Direct profile creation successful, navigating to home');
                navigateToHome();
              } else {
                console.log('Direct profile creation failed');
                setErrorMessage('Failed to create profile with your phone number. Try logging in again.');
              }
            } catch (error) {
              console.error('Error creating profile directly:', error);
              setErrorMessage(`Error: ${error.message}`);
            }
          } else {
            console.log('No phone number found in storage');
            setErrorMessage('No login information found. Please log in again.');
          }
        };
        
        await checkStorageAndCreateProfile();
        return;
      }

      console.log('Supabase user exists but no profile loaded, attempting to recover');
      
      // We have Supabase user but no profile - try to load it
      const loadProfile = async () => {
        try {
          console.log(`Attempt ${retryCount + 1}/${MAX_RETRIES} to load profile`);
          // Since retryProfileLoad is not available, we'll try to get the current user and set session
          const currentUser = await getCurrentUser();
          
          if (currentUser) {
            console.log('Profile load successful');
            navigateToHome();
          } else if (retryCount < MAX_RETRIES) {
            // Increment retry count and try again after a delay
            console.log('Profile load failed, retrying in 2 seconds');
            setRetryCount(prev => prev + 1);
            
            const timeout = setTimeout(() => {
              setManualRetry(false);
              loadProfile();
            }, 2000);
            
            setRetryTimeout(timeout);
          } else {
            console.log('Max retries reached, showing error');
            setErrorMessage('Unable to load your profile after multiple attempts. Please try one of the recovery options below.');
          }
        } catch (err: any) {
          console.error('Error in LoadingScreen profile load:', err);
          setErrorMessage(`Error loading profile: ${err?.message || 'Unknown error'}`);
        }
      };

      if (!loading && !manualRetry) {
        await loadProfile();
      }
    };

    checkAuthAndLoadProfile();
  }, [user, loading, manualRetry, retryCount]);

  const navigateToHome = () => {
    console.log('Navigating to home screen');
    router.replace('/(main)/home/');
  };

  const handleRetry = () => {
    console.log('Manual retry requested');
    setErrorMessage(null);
    setManualRetry(true);
    setRetryCount(0);
    
    // Clear the retry state after a short delay to trigger the useEffect
    setTimeout(() => {
      setManualRetry(false);
    }, 300);
  };

  const handleTryPhoneOnly = async () => {
    console.log('Try with phone only requested');
    setErrorMessage(null);
    setManualRetry(true);
    
    try {
      // Get phone from AsyncStorage
      const phoneNumber = await AsyncStorage.getItem('user_phone');
      if (!phoneNumber) {
        console.log('No phone number found in storage');
        setErrorMessage("No phone number stored. Please sign in again.");
        setManualRetry(false);
        return;
      }
      
      console.log('Found phone number, attempting direct profile creation');
      // Try creating profile directly with phone number
      const profile = await createProfileDirectly(phoneNumber);
      if (profile) {
        console.log('Direct profile creation successful');
        navigateToHome();
      } else {
        console.log('Direct profile creation failed');
        setErrorMessage("Failed to create profile with stored phone number.");
      }
    } catch (err) {
      console.error('Error in phone-only login:', err);
      setErrorMessage(`Phone-only login failed: ${err.message}`);
    } finally {
      setManualRetry(false);
    }
  };

  const handleForceSyncAndRetry = async () => {
    console.log('Force sync requested');
    setErrorMessage(null);
    setManualRetry(true);
    
    try {
      console.log('Attempting full auth sync');
      const success = await forceAuthSync();
      if (success) {
        console.log('Force sync successful');
        navigateToHome();
      } else {
        console.log('Force sync failed');
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
    console.log('Reset auth requested');
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
              console.log('Executing auth state cleanup');
              await clearAuth();
              console.log('Auth state cleanup complete, navigating to login');
              router.replace('/(auth)/login');
            } catch (err: any) {
              console.error('Error in auth reset:', err);
              setErrorMessage(`Auth reset failed: ${err?.message || 'Unknown error'}`);
            }
          }
        }
      ]
    );
  };

  const displayError = errorMessage;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>DukaaON</Text>
      
      {!displayError ? (
        <>
          <ActivityIndicator size="large" color="#FF7D00" style={styles.loader} />
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
          <Text style={styles.errorTitle}>Authentication Issue</Text>
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
            
            <TouchableOpacity 
              style={[styles.button, styles.buttonDanger, { marginTop: 10 }]} 
              onPress={() => router.replace('/(auth)/login')}
            >
              <Text style={styles.buttonText}>Back to Login</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.button, styles.buttonDanger, { marginTop: 10 }]} onPress={handleResetAuth}>
              <Text style={styles.buttonText}>Reset Authentication</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FF7D00',
    marginBottom: 30,
  },
  loader: {
    marginBottom: 20,
  },
  loadingText: {
    fontSize: 18,
    color: '#333',
    marginBottom: 10,
  },
  retryText: {
    fontSize: 14,
    color: '#666',
  },
  errorContainer: {
    width: '100%',
    padding: 20,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    alignItems: 'center',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FF0000',
    marginBottom: 10,
  },
  errorMessage: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
  },
  buttonContainer: {
    flexDirection: 'column',
    width: '100%',
    gap: 10,
  },
  button: {
    backgroundColor: '#FF7D00',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    width: '100%',
  },
  buttonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#FF7D00',
  },
  buttonDanger: {
    backgroundColor: '#FF0000',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  buttonTextOutline: {
    color: '#FF7D00',
  },
});