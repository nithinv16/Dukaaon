import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useAuthStore } from '../../store/auth';
import { ProfileMonitor } from '../../services/monitoring/profileMonitor';
import { healthCheck } from '../../utils/profileDebug';

/**
 * Development-only debug panel for profile fetch diagnostics
 * Only renders in development mode (__DEV__ === true)
 */
export const ProfileDebugPanel: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [lastResult, setLastResult] = useState<string>('');
  
  const { debugProfileFetch, testProfileFetch, resetProfileDebug, user } = useAuthStore();
  
  // Only render in development
  if (!__DEV__) {
    return null;
  }
  
  const runDiagnostics = async () => {
    setIsRunning(true);
    setLastResult('Running diagnostics...');
    
    try {
      await debugProfileFetch();
      setLastResult('Diagnostics completed. Check console for details.');
    } catch (error) {
      setLastResult(`Error: ${error}`);
    } finally {
      setIsRunning(false);
    }
  };
  
  const runTest = async () => {
    setIsRunning(true);
    setLastResult('Testing profile fetch...');
    
    try {
      await testProfileFetch();
      setLastResult('Test completed. Check console for results.');
    } catch (error) {
      setLastResult(`Error: ${error}`);
    } finally {
      setIsRunning(false);
    }
  };
  
  const runHealthCheck = async () => {
    setIsRunning(true);
    setLastResult('Running health check...');
    
    try {
      const isHealthy = await healthCheck();
      setLastResult(`Health check: ${isHealthy ? '✅ PASSED' : '❌ FAILED'}`);
    } catch (error) {
      setLastResult(`Error: ${error}`);
    } finally {
      setIsRunning(false);
    }
  };
  
  const resetDebug = async () => {
    setIsRunning(true);
    setLastResult('Resetting debug data...');
    
    try {
      await resetProfileDebug();
      await ProfileMonitor.clearMetrics();
      setLastResult('Debug data reset completed.');
    } catch (error) {
      setLastResult(`Error: ${error}`);
    } finally {
      setIsRunning(false);
    }
  };
  
  const getStats = async () => {
    setIsRunning(true);
    setLastResult('Getting performance stats...');
    
    try {
      const stats = await ProfileMonitor.getStats();
      const statsText = `
Performance Stats:
• Total attempts: ${stats.totalAttempts}
• Success rate: ${(stats.successRate * 100).toFixed(1)}%
• Average time: ${stats.averageFetchTime}ms
• Cache hit rate: ${(stats.cacheHitRate * 100).toFixed(1)}%`;
      setLastResult(statsText);
    } catch (error) {
      setLastResult(`Error: ${error}`);
    } finally {
      setIsRunning(false);
    }
  };
  
  if (!isVisible) {
    return (
      <TouchableOpacity 
        style={styles.toggleButton}
        onPress={() => setIsVisible(true)}
      >
        <Text style={styles.toggleButtonText}>🔧 Debug</Text>
      </TouchableOpacity>
    );
  }
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Profile Debug Panel</Text>
        <TouchableOpacity 
          style={styles.closeButton}
          onPress={() => setIsVisible(false)}
        >
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView style={styles.content}>
        <Text style={styles.userInfo}>
          User: {user?.email || 'Not logged in'}
        </Text>
        
        <View style={styles.buttonGroup}>
          <TouchableOpacity 
            style={[styles.button, isRunning && styles.buttonDisabled]}
            onPress={runHealthCheck}
            disabled={isRunning}
          >
            <Text style={styles.buttonText}>Health Check</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.button, isRunning && styles.buttonDisabled]}
            onPress={runDiagnostics}
            disabled={isRunning}
          >
            <Text style={styles.buttonText}>Run Diagnostics</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.button, isRunning && styles.buttonDisabled]}
            onPress={runTest}
            disabled={isRunning}
          >
            <Text style={styles.buttonText}>Test Profile Fetch</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.button, isRunning && styles.buttonDisabled]}
            onPress={getStats}
            disabled={isRunning}
          >
            <Text style={styles.buttonText}>Get Stats</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.button, styles.resetButton, isRunning && styles.buttonDisabled]}
            onPress={resetDebug}
            disabled={isRunning}
          >
            <Text style={styles.buttonText}>Reset Debug Data</Text>
          </TouchableOpacity>
        </View>
        
        {lastResult ? (
          <View style={styles.resultContainer}>
            <Text style={styles.resultTitle}>Last Result:</Text>
            <Text style={styles.resultText}>{lastResult}</Text>
          </View>
        ) : null}
        
        <Text style={styles.note}>
          💡 Check the console for detailed output from debug operations.
        </Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  toggleButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    zIndex: 1000,
  },
  toggleButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  container: {
    position: 'absolute',
    top: 100,
    left: 20,
    right: 20,
    backgroundColor: 'white',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 1000,
    maxHeight: '70%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 5,
  },
  closeButtonText: {
    fontSize: 18,
    color: '#666',
  },
  content: {
    padding: 15,
  },
  userInfo: {
    fontSize: 12,
    color: '#666',
    marginBottom: 15,
  },
  buttonGroup: {
    gap: 10,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#CCC',
  },
  resetButton: {
    backgroundColor: '#FF3B30',
  },
  buttonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  resultContainer: {
    marginTop: 15,
    padding: 10,
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
  },
  resultTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  resultText: {
    fontSize: 11,
    color: '#666',
    fontFamily: 'monospace',
  },
  note: {
    fontSize: 11,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 15,
    textAlign: 'center',
  },
});