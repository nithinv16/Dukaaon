import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, Button, Icon } from 'react-native-paper';

interface Props {
  children: React.ReactNode;
  componentName?: string;
  fallbackMessage?: string;
  onRetry?: () => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * HomeComponentErrorBoundary - A lightweight error boundary for home screen sections
 * 
 * This error boundary is designed to:
 * 1. Catch errors in individual home screen components (NearbyWholesalers, NearbyManufacturers, etc.)
 * 2. Display a fallback UI without crashing the entire home screen
 * 3. Log errors for debugging
 * 4. Provide retry functionality
 * 
 * **Feature: fix-home-loading-state, Property 9: Graceful component degradation**
 * **Validates: Requirements 4.3**
 */
export class HomeComponentErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render shows the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log the error for debugging without crashing the app
    console.error(
      `[HomeComponentErrorBoundary] Error in ${this.props.componentName || 'component'}:`,
      error.message
    );
    console.error('[HomeComponentErrorBoundary] Component stack:', errorInfo.componentStack);
    
    // In production, you might want to send this to an error tracking service
    // but we don't want to import Sentry here to keep this component lightweight
  }

  handleRetry = () => {
    // Reset error state to attempt re-render
    this.setState({ hasError: false, error: undefined });
    
    // Call optional retry callback
    if (this.props.onRetry) {
      this.props.onRetry();
    }
  };

  render() {
    if (this.state.hasError) {
      const { componentName, fallbackMessage } = this.props;
      
      return (
        <View style={styles.errorContainer}>
          <View style={styles.errorContent}>
            <Icon source="alert-circle-outline" size={32} color="#999" />
            <Text style={styles.errorTitle}>
              {componentName ? `${componentName} unavailable` : 'Section unavailable'}
            </Text>
            <Text style={styles.errorMessage}>
              {fallbackMessage || 'This section failed to load. Please try again.'}
            </Text>
            <TouchableOpacity onPress={this.handleRetry} style={styles.retryButton}>
              <Text style={styles.retryText}>Tap to retry</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  errorContainer: {
    marginVertical: 8,
    marginHorizontal: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
    overflow: 'hidden',
  },
  errorContent: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  retryButton: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#FF7D00',
    borderRadius: 20,
  },
  retryText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default HomeComponentErrorBoundary;
