import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, SafeAreaView } from 'react-native';
import { Text, Button, Card, Divider } from 'react-native-paper';
import { supabase } from '../../services/supabase/supabase';
import { useAuthStore } from '../../store/auth';

export default function DatabaseCheck() {
  const [loading, setLoading] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<any>(null);
  const [profileCheck, setProfileCheck] = useState<any>(null);
  const [directQueryResult, setDirectQueryResult] = useState<any>(null);
  const [updateResult, setUpdateResult] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const user = useAuthStore(state => state.user);
  const setUser = useAuthStore(state => state.setUser);

  useEffect(() => {
    runInitialChecks();
  }, []);

  const runInitialChecks = async () => {
    setLoading(true);
    setErrorMessage(null);
    
    try {
      await checkProfileAccess();
      await runDiagnostics();
      await queryProfileDirectly();
    } catch (error: any) {
      console.error('Error in initial checks:', error);
      setErrorMessage(`Initial checks error: ${error?.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const checkProfileAccess = async () => {
    try {
      // Check user object first
      console.log('Current user object:', JSON.stringify(user));
      
      if (!user?.id) {
        setErrorMessage('No user ID available in auth store');
        setProfileCheck({ error: 'No user ID available' });
        return;
      }
      
      // Try a simple check of profile access
      const { data, error } = await supabase
        .from('profiles')
        .select('id, created_at')
        .limit(1);
      
      if (error) {
        setProfileCheck({ error: error.message });
        return;
      }
      
      setProfileCheck({
        success: true,
        message: 'Successfully queried profiles table',
        sample: data
      });
    } catch (error: any) {
      console.error('Error checking profile access:', error);
      setProfileCheck({ error: error?.message || 'Unknown error' });
    }
  };

  const runDiagnostics = async () => {
    try {
      const { data, error } = await supabase.rpc('diagnose_profile_access');
      
      if (error) {
        console.error('Diagnostic function error:', error);
        setDiagnosticResult({ error: error.message });
        return;
      }
      
      setDiagnosticResult(data);
    } catch (error: any) {
      console.error('Error running diagnostics:', error);
      setDiagnosticResult({ error: error?.message || 'Unknown error' });
    }
  };

  const queryProfileDirectly = async () => {
    if (!user?.id) return;
    
    try {
      // Direct query for the specific profile
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (error) {
        setDirectQueryResult({ error: error.message });
        return;
      }
      
      setDirectQueryResult(data);
    } catch (error: any) {
      console.error('Error in direct query:', error);
      setDirectQueryResult({ error: error?.message || 'Unknown error' });
    }
  };

  const forceUpdateProfile = async () => {
    if (!user?.id) {
      setErrorMessage('No user ID available');
      return;
    }
    
    setLoading(true);
    setErrorMessage(null);
    
    try {
      // First try using the SQL function
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        'force_update_profile_business_details',
        { p_id: user.id }
      );
      
      if (rpcError) {
        console.error('RPC update error:', rpcError);
        // Fall back to direct update
        const businessDetails = {
          shopName: 'DB Check Shop Name',
          ownerName: 'DB Check Owner Name',
          address: '',
          pincode: '',
          created_at: new Date().toISOString()
        };
        
        const { data, error } = await supabase
          .from('profiles')
          .update({ business_details: businessDetails })
          .eq('id', user.id)
          .select()
          .single();
        
        if (error) {
          setUpdateResult({ error: error.message });
          setErrorMessage(`Direct update failed: ${error.message}`);
          return;
        }
        
        setUpdateResult({
          success: true,
          method: 'direct_update',
          data: data
        });
        
        // Update auth store
        setUser({
          ...user,
          business_details: businessDetails
        });
      } else {
        // RPC update succeeded
        setUpdateResult({
          success: true,
          method: 'rpc_update',
          data: rpcData
        });
        
        // Update auth store
        setUser({
          ...user,
          business_details: {
            shopName: 'SQL Updated Shop Name',
            ownerName: 'SQL Updated Owner Name',
            address: '',
            pincode: '',
            created_at: new Date().toISOString()
          }
        });
      }
      
      // Re-run checks after update
      await queryProfileDirectly();
      await runDiagnostics();
      
    } catch (error: any) {
      console.error('Error in force update:', error);
      setUpdateResult({ error: error?.message || 'Unknown error' });
      setErrorMessage(`Force update failed: ${error?.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text variant="headlineMedium">Database Check</Text>
          {errorMessage && (
            <Text style={styles.errorText}>{errorMessage || 'An error occurred'}</Text>
          )}
          <Button 
            mode="contained" 
            onPress={runInitialChecks}
            loading={loading}
            style={styles.button}
          >
            Run Checks
          </Button>
          <Button 
            mode="contained" 
            onPress={forceUpdateProfile}
            loading={loading}
            style={[styles.button, styles.updateButton]}
          >
            Force Update Profile
          </Button>
        </View>
        
        <Card style={styles.card}>
          <Card.Title title="User Info" />
          <Card.Content>
            <Text>User ID: {user?.id || 'Not available'}</Text>
            <Text>User Fire ID: {user?.fire_id || 'Not available'}</Text>
            <Divider style={styles.divider} />
            <Text style={styles.jsonTitle}>Full User Object:</Text>
            <ScrollView horizontal>
              <Text style={styles.json}>
                {JSON.stringify(user, null, 2)}
              </Text>
            </ScrollView>
          </Card.Content>
        </Card>
        
        <Card style={styles.card}>
          <Card.Title title="Profile Access Check" />
          <Card.Content>
            {profileCheck ? (
              <>
                {profileCheck.error ? (
                  <Text style={styles.errorText}>Error: {profileCheck.error}</Text>
                ) : (
                  <>
                    <Text style={styles.successText}>{profileCheck.message || 'Success'}</Text>
                    {profileCheck.sample && (
                      <ScrollView horizontal>
                        <Text style={styles.json}>
                          {JSON.stringify(profileCheck.sample, null, 2)}
                        </Text>
                      </ScrollView>
                    )}
                  </>
                )}
              </>
            ) : (
              <Text>No profile check data available</Text>
            )}
          </Card.Content>
        </Card>
        
        <Card style={styles.card}>
          <Card.Title title="Diagnostic Function Result" />
          <Card.Content>
            {diagnosticResult ? (
              <>
                {diagnosticResult.error ? (
                  <Text style={styles.errorText}>Error: {diagnosticResult.error}</Text>
                ) : (
                  <ScrollView horizontal>
                    <Text style={styles.json}>
                      {JSON.stringify(diagnosticResult, null, 2)}
                    </Text>
                  </ScrollView>
                )}
              </>
            ) : (
              <Text>No diagnostic data available</Text>
            )}
          </Card.Content>
        </Card>
        
        <Card style={styles.card}>
          <Card.Title title="Direct Query Result" />
          <Card.Content>
            {directQueryResult ? (
              <>
                {directQueryResult.error ? (
                  <Text style={styles.errorText}>Error: {directQueryResult.error}</Text>
                ) : (
                  <>
                    <Text>Profile ID: {directQueryResult.id}</Text>
                    <Text>Created: {directQueryResult.created_at}</Text>
                    <Divider style={styles.divider} />
                    <Text style={styles.jsonTitle}>business_details:</Text>
                    <ScrollView horizontal>
                      <Text style={styles.json}>
                        {JSON.stringify(directQueryResult.business_details, null, 2)}
                      </Text>
                    </ScrollView>
                    <Divider style={styles.divider} />
                    <Text style={styles.jsonTitle}>Full Result:</Text>
                    <ScrollView horizontal>
                      <Text style={styles.json}>
                        {JSON.stringify(directQueryResult, null, 2)}
                      </Text>
                    </ScrollView>
                  </>
                )}
              </>
            ) : (
              <Text>No direct query data available</Text>
            )}
          </Card.Content>
        </Card>
        
        <Card style={styles.card}>
          <Card.Title title="Update Result" />
          <Card.Content>
            {updateResult ? (
              <>
                {updateResult.error ? (
                  <Text style={styles.errorText}>Error: {updateResult.error}</Text>
                ) : (
                  <>
                    <Text style={styles.successText}>
                      Update Successful via {updateResult.method}
                    </Text>
                    <ScrollView horizontal>
                      <Text style={styles.json}>
                        {JSON.stringify(updateResult.data, null, 2)}
                      </Text>
                    </ScrollView>
                  </>
                )}
              </>
            ) : (
              <Text>No update has been performed</Text>
            )}
          </Card.Content>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    alignItems: 'center',
  },
  button: {
    marginTop: 10,
    width: '100%',
  },
  updateButton: {
    backgroundColor: '#4a6da7',
  },
  card: {
    margin: 10,
  },
  divider: {
    marginVertical: 10,
  },
  json: {
    fontFamily: 'monospace',
    fontSize: 12,
  },
  jsonTitle: {
    fontWeight: 'bold',
    marginBottom: 5,
  },
  errorText: {
    color: 'red',
    marginVertical: 10,
  },
  successText: {
    color: 'green',
    marginVertical: 10,
  },
});