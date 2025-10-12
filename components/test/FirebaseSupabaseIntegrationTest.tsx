import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import auth from '@react-native-firebase/auth';
import { supabase } from '../../services/supabase/supabase';
import { FirebaseRoleManager } from '../../services/auth/firebaseRoleManager';

interface IntegrationStatus {
  firebaseUser: boolean;
  hasRole: boolean;
  supabaseAuth: boolean;
  success: boolean;
  error?: string;
}

interface TokenInfo {
  token: string | null;
  claims: Record<string, any> | null;
  expirationTime: string | null;
}

const FirebaseSupabaseIntegrationTest: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [integrationStatus, setIntegrationStatus] = useState<IntegrationStatus | null>(null);
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [userClaims, setUserClaims] = useState<Record<string, any> | null>(null);
  const [supabaseProfile, setSupabaseProfile] = useState<any>(null);
  const [testResults, setTestResults] = useState<string[]>([]);

  useEffect(() => {
    // Auto-run basic checks when component mounts
    checkIntegrationStatus();
  }, []);

  const addTestResult = (result: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${result}`]);
  };

  const checkIntegrationStatus = async () => {
    setLoading(true);
    try {
      addTestResult('Checking integration status...');
      const status = await FirebaseRoleManager.verifyIntegration();
      setIntegrationStatus(status);
      
      if (status.success) {
        addTestResult('✅ Integration status: SUCCESS');
      } else {
        addTestResult(`❌ Integration status: FAILED - ${status.error || 'Unknown error'}`);
      }
    } catch (error) {
      addTestResult(`❌ Error checking integration: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const checkUserClaims = async () => {
    setLoading(true);
    try {
      addTestResult('Checking user claims...');
      const claims = await FirebaseRoleManager.getUserClaims();
      setUserClaims(claims);
      
      if (claims?.role === 'authenticated') {
        addTestResult('✅ User has authenticated role');
      } else {
        addTestResult(`❌ User missing authenticated role. Claims: ${JSON.stringify(claims)}`);
      }
    } catch (error) {
      addTestResult(`❌ Error checking claims: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const assignUserRole = async () => {
    setLoading(true);
    try {
      addTestResult('Assigning user role...');
      const result = await FirebaseRoleManager.assignUserRole();
      
      if (result.success) {
        addTestResult('✅ User role assigned successfully');
      } else {
        addTestResult(`❌ Failed to assign user role: ${result.error}`);
      }
    } catch (error) {
      addTestResult(`❌ Error assigning role: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const getTokenInfo = async () => {
    setLoading(true);
    try {
      addTestResult('Getting token information...');
      const info = await FirebaseRoleManager.getIdTokenWithClaims();
      setTokenInfo(info);
      
      if (info.token) {
        addTestResult('✅ Firebase ID token retrieved');
        addTestResult(`Token expires: ${info.expirationTime}`);
      } else {
        addTestResult('❌ Failed to get Firebase ID token');
      }
    } catch (error) {
      addTestResult(`❌ Error getting token: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const testSupabaseConnection = async () => {
    setLoading(true);
    try {
      addTestResult('Testing Supabase connection...');
      
      // Test with Firebase-integrated client
      const { data: user, error } = await supabase.auth.getUser();
      
      if (error) {
        addTestResult(`❌ Supabase auth error: ${error.message}`);
      } else if (user) {
        addTestResult('✅ Supabase user authenticated');
        addTestResult(`User ID: ${user.id}`);
        addTestResult(`Email: ${user.email}`);
      } else {
        addTestResult('❌ No Supabase user found');
      }
    } catch (error) {
      addTestResult(`❌ Supabase connection error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const testSupabaseQuery = async () => {
    setLoading(true);
    try {
      addTestResult('Testing Supabase query...');
      
      // Try to fetch user profile
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .limit(1)
        .single();
      
      if (error) {
        addTestResult(`❌ Profile query error: ${error.message}`);
      } else {
        addTestResult('✅ Profile query successful');
        setSupabaseProfile(data);
      }
    } catch (error) {
      addTestResult(`❌ Query error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const refreshToken = async () => {
    setLoading(true);
    try {
      addTestResult('Refreshing Firebase token...');
      const token = await FirebaseRoleManager.refreshToken();
      
      if (token) {
        addTestResult('✅ Token refreshed successfully');
        // Re-check integration after refresh
        await checkIntegrationStatus();
      } else {
        addTestResult('❌ Failed to refresh token');
      }
    } catch (error) {
      addTestResult(`❌ Token refresh error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const waitForClaims = async () => {
    setLoading(true);
    try {
      addTestResult('Waiting for claims to be available...');
      const success = await FirebaseRoleManager.waitForClaims(5, 2000);
      
      if (success) {
        addTestResult('✅ Claims are now available');
        await checkUserClaims();
      } else {
        addTestResult('❌ Claims not available after waiting');
      }
    } catch (error) {
      addTestResult(`❌ Error waiting for claims: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const runFullTest = async () => {
    setTestResults([]);
    addTestResult('🚀 Starting full integration test...');
    
    await checkIntegrationStatus();
    await checkUserClaims();
    await getTokenInfo();
    await testSupabaseConnection();
    await testSupabaseQuery();
    
    addTestResult('🏁 Full test completed');
  };

  const debugAuthState = async () => {
    setLoading(true);
    try {
      addTestResult('Running debug auth state...');
      await FirebaseRoleManager.debugAuthState();
      addTestResult('✅ Debug completed - check console logs');
    } catch (error) {
      addTestResult(`❌ Debug error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const clearResults = () => {
    setTestResults([]);
    setIntegrationStatus(null);
    setTokenInfo(null);
    setUserClaims(null);
    setSupabaseProfile(null);
  };

  const currentUser = auth().currentUser;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Firebase-Supabase Integration Test</Text>
      
      {/* Current User Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Current User</Text>
        <Text style={styles.info}>
          Firebase User: {currentUser ? `${currentUser.email} (${currentUser.uid})` : 'Not signed in'}
        </Text>
      </View>

      {/* Integration Status */}
      {integrationStatus && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Integration Status</Text>
          <Text style={[styles.status, integrationStatus.success ? styles.success : styles.error]}>
            {integrationStatus.success ? '✅ SUCCESS' : '❌ FAILED'}
          </Text>
          <Text style={styles.info}>Firebase User: {integrationStatus.firebaseUser ? '✅' : '❌'}</Text>
          <Text style={styles.info}>Has Role: {integrationStatus.hasRole ? '✅' : '❌'}</Text>
          <Text style={styles.info}>Supabase Auth: {integrationStatus.supabaseAuth ? '✅' : '❌'}</Text>
          {integrationStatus.error && (
            <Text style={styles.error}>Error: {integrationStatus.error}</Text>
          )}
        </View>
      )}

      {/* User Claims */}
      {userClaims && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>User Claims</Text>
          <Text style={styles.info}>{JSON.stringify(userClaims, null, 2)}</Text>
        </View>
      )}

      {/* Token Info */}
      {tokenInfo && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Token Info</Text>
          <Text style={styles.info}>Has Token: {tokenInfo.token ? '✅' : '❌'}</Text>
          <Text style={styles.info}>Expires: {tokenInfo.expirationTime}</Text>
        </View>
      )}

      {/* Supabase Profile */}
      {supabaseProfile && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Supabase Profile</Text>
          <Text style={styles.info}>{JSON.stringify(supabaseProfile, null, 2)}</Text>
        </View>
      )}

      {/* Test Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={[styles.button, styles.primaryButton]} 
          onPress={runFullTest}
          disabled={loading}
        >
          <Text style={styles.buttonText}>Run Full Test</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.button} 
          onPress={checkIntegrationStatus}
          disabled={loading}
        >
          <Text style={styles.buttonText}>Check Integration</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.button} 
          onPress={checkUserClaims}
          disabled={loading}
        >
          <Text style={styles.buttonText}>Check Claims</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.button} 
          onPress={assignUserRole}
          disabled={loading}
        >
          <Text style={styles.buttonText}>Assign User Role</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.button} 
          onPress={getTokenInfo}
          disabled={loading}
        >
          <Text style={styles.buttonText}>Get Token Info</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.button} 
          onPress={testSupabaseConnection}
          disabled={loading}
        >
          <Text style={styles.buttonText}>Test Supabase</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.button} 
          onPress={refreshToken}
          disabled={loading}
        >
          <Text style={styles.buttonText}>Refresh Token</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.button} 
          onPress={waitForClaims}
          disabled={loading}
        >
          <Text style={styles.buttonText}>Wait for Claims</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.button} 
          onPress={debugAuthState}
          disabled={loading}
        >
          <Text style={styles.buttonText}>Debug Auth State</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, styles.clearButton]} 
          onPress={clearResults}
          disabled={loading}
        >
          <Text style={styles.buttonText}>Clear Results</Text>
        </TouchableOpacity>
      </View>

      {/* Loading Indicator */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Running test...</Text>
        </View>
      )}

      {/* Test Results */}
      {testResults.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Test Results</Text>
          <ScrollView style={styles.resultsContainer}>
            {testResults.map((result, index) => (
              <Text key={index} style={styles.resultText}>
                {result}
              </Text>
            ))}
          </ScrollView>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  section: {
    backgroundColor: 'white',
    padding: 16,
    marginBottom: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  info: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
    fontFamily: 'monospace',
  },
  status: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  success: {
    color: '#4CAF50',
  },
  error: {
    color: '#F44336',
  },
  buttonContainer: {
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#4CAF50',
  },
  clearButton: {
    backgroundColor: '#FF9800',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 16,
    color: '#666',
  },
  resultsContainer: {
    maxHeight: 300,
    backgroundColor: '#f8f8f8',
    padding: 8,
    borderRadius: 4,
  },
  resultText: {
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 2,
    color: '#333',
  },
});

export default FirebaseSupabaseIntegrationTest;