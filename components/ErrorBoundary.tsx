import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button } from 'react-native-paper';
import * as Sentry from '@sentry/react-native';


interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    
    // Check if it's an AsyncStorage or auth-related error
    const isAsyncStorageError = error.message?.includes?.('AsyncStorage') ||
                               error.message?.includes?.('auth') ||
                               error.message?.includes?.('Session timeout') ||
                               error.message?.includes?.('Profile fetch timeout');
    
    if (isAsyncStorageError) {
      console.log('AsyncStorage/auth error detected, attempting recovery...');
      
      // Try to clear problematic auth state
      setTimeout(async () => {
        try {
          const AsyncStorage = require('@react-native-async-storage/async-storage').default;
          await AsyncStorage.multiRemove([
            'auth_verified',
            'user_phone', 
            'user_role',
            'user_id',
            'profile_id'
          ]);
          console.log('Cleared auth state after error');
          
          // Reset error boundary state
          this.setState({ hasError: false, error: undefined });
        } catch (clearError) {
          console.error('Failed to clear auth state:', clearError);
        }
      }, 1000);
    }
    
    // Report error to Sentry (but not for AsyncStorage errors to avoid spam)
    if (!isAsyncStorageError) {
      Sentry.withScope((scope) => {
        scope.setTag('component', 'ErrorBoundary');
        scope.setExtra('componentStack', errorInfo.componentStack);
        Sentry.captureException(error);
      });
    }
  }

  handleRecovery = async () => {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      
      // Clear all auth-related storage
      await AsyncStorage.multiRemove([
        'auth_verified',
        'user_phone', 
        'user_role',
        'user_id',
        'profile_id'
      ]);
      
      console.log('Recovery: Cleared auth storage');
      
      // Reset error state
      this.setState({ hasError: false, error: undefined });
      
      // Force app to restart auth flow
      setTimeout(() => {
        const { useAuthStore } = require('../store/auth');
        useAuthStore.getState().clearAuth();
      }, 100);
      
    } catch (error) {
      console.error('Recovery failed:', error);
      // Just reset the error state if recovery fails
      this.setState({ hasError: false, error: undefined });
    }
  };

  render() {
    if (this.state.hasError) {
      const isAsyncStorageError = this.state.error?.message?.includes?.('AsyncStorage') ||
                                 this.state.error?.message?.includes?.('auth') ||
                                 this.state.error?.message?.includes?.('Session timeout') ||
                                 this.state.error?.message?.includes?.('Profile fetch timeout');
      
      return (
        <View style={styles.container}>
          <Text variant="headlineMedium" style={styles.title}>Something went wrong</Text>
          <Text style={styles.error}>{this.state.error?.message || 'An unexpected error occurred'}</Text>
          
          {isAsyncStorageError ? (
            <>
              <Text style={styles.recoveryText}>This appears to be an authentication issue. Try clearing app data:</Text>
              <Button 
                mode="contained" 
                onPress={this.handleRecovery}
                style={[styles.button, styles.recoveryButton]}
              >
                Clear Data & Restart
              </Button>
            </>
          ) : (
            <Button 
              mode="contained" 
              onPress={() => this.setState({ hasError: false })}
              style={styles.button}
            >
              Try Again
            </Button>
          )}
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    marginBottom: 16,
  },
  error: {
    marginBottom: 24,
    textAlign: 'center',
    opacity: 0.7,
  },
  button: {
    minWidth: 120,
  },
  recoveryText: {
    marginBottom: 16,
    textAlign: 'center',
    opacity: 0.8,
    fontSize: 14,
  },
  recoveryButton: {
    backgroundColor: '#ff6b35',
  },
});

// Also export as default for better compatibility
export default ErrorBoundary;