import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Stack as ExpoStack } from 'expo-router';

// Error fallback component
function ErrorFallback({ error }) {
  return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorText}>Something went wrong</Text>
      <Text style={styles.errorMessage}>{error?.message || 'An unexpected error occurred'}</Text>
    </View>
  );
}

// Error boundary component
class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    // Update state so next render shows fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error to console
    console.error('Profile section error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // Fallback UI when an error occurs
      return (
        <ErrorFallback error={this.state.error} />
      );
    }

    return this.props.children;
  }
}

/**
 * Layout for the profile section screens
 * This specifically disables gesture navigation for the index/main profile screen
 * while allowing it for other screens within this section
 */
export default function ProfileLayout() {
  const [isReady, setIsReady] = useState(false);

  // Give the navigation a moment to initialize fully
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 200);

    return () => clearTimeout(timer);
  }, []);

  if (!isReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF7D00" />
        <Text>Loading profile...</Text>
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <ExpoStack
        screenOptions={({ route }) => ({
          headerShown: false,
          // Only disable gesture for the index page (main profile screen)
          gestureEnabled: route.name !== 'index'
        })}
      />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  errorMessage: {
    color: 'red',
    textAlign: 'center',
  }
});