import { ProfileMonitor } from '../services/monitoring/profileMonitor';
import { ProfileLoader } from '../services/auth/profileLoader';
import { validateSupabaseConnection } from '../services/supabase/supabase';
import { supabase } from '../services/supabase/supabase';
import NetInfo from '@react-native-community/netinfo';

/**
 * Debug utilities for profile fetch issues
 */
export class ProfileDebug {
  /**
   * Run comprehensive profile fetch diagnostics
   */
  static async runDiagnostics(userId?: string): Promise<void> {
    console.log('\n=== Profile Fetch Diagnostics ===');
    
    try {
      // 1. Network connectivity test
      console.log('\n1. Testing network connectivity...');
      const netInfo = await NetInfo.fetch();
      console.log(`Network connected: ${netInfo.isConnected}`);
      console.log(`Network type: ${netInfo.type}`);
      if (netInfo.type === 'cellular' && netInfo.details) {
        console.log(`Cellular generation: ${netInfo.details.cellularGeneration}`);
      }
      
      // 2. Supabase connection test
      console.log('\n2. Testing Supabase connection...');
      const connectionTest = await validateSupabaseConnection();
      console.log(`Supabase connection: ${connectionTest.success ? 'SUCCESS' : 'FAILED'}`);
      console.log(`Message: ${connectionTest.message}`);
      if (connectionTest.serverTime) {
        console.log(`Server time: ${connectionTest.serverTime}`);
      }
      
      // 3. Database query test
      console.log('\n3. Testing database query performance...');
      const queryStart = Date.now();
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('count')
          .limit(1);
        
        const queryTime = Date.now() - queryStart;
        console.log(`Query time: ${queryTime}ms`);
        
        if (error) {
          console.log(`Query error: ${error.message}`);
        } else {
          console.log('Query successful');
        }
      } catch (error) {
        console.log(`Query exception: ${error}`);
      }
      
      // 4. Profile cache status
      console.log('\n4. Checking profile cache...');
      if (userId) {
        try {
          const cachedProfile = await ProfileLoader['loadFromCache'](userId);
          console.log(`Cache status: ${cachedProfile ? 'HIT' : 'MISS'}`);
          if (cachedProfile) {
            console.log(`Cached profile ID: ${cachedProfile.id}`);
            console.log(`Cached profile role: ${cachedProfile.role}`);
          }
        } catch (error) {
          console.log(`Cache check error: ${error}`);
        }
      } else {
        console.log('No user ID provided for cache check');
      }
      
      // 5. Performance metrics
      console.log('\n5. Performance metrics...');
      await ProfileMonitor.logPerformanceSummary();
      
      // 6. Diagnostics and recommendations
      console.log('\n6. Diagnostics and recommendations...');
      const diagnostics = await ProfileMonitor.getDiagnostics();
      
      console.log(`Performance issues: ${diagnostics.performanceIssues ? 'YES' : 'NO'}`);
      console.log(`Cache effectiveness: ${diagnostics.cacheEffectiveness}`);
      console.log(`Network stability: ${diagnostics.networkStability}`);
      
      if (diagnostics.recentErrors.length > 0) {
        console.log('Recent errors:');
        diagnostics.recentErrors.slice(0, 5).forEach((error, index) => {
          console.log(`  ${index + 1}. ${error}`);
        });
      }
      
      if (diagnostics.recommendations.length > 0) {
        console.log('Recommendations:');
        diagnostics.recommendations.forEach((rec, index) => {
          console.log(`  ${index + 1}. ${rec}`);
        });
      }
      
      console.log('\n=== Diagnostics Complete ===\n');
      
    } catch (error) {
      console.error('Error running diagnostics:', error);
    }
  }
  
  /**
   * Test profile fetch with specific user ID
   */
  static async testProfileFetch(userId: string): Promise<void> {
    console.log(`\n=== Testing Profile Fetch for User: ${userId} ===`);
    
    try {
      const startTime = Date.now();
      
      const result = await ProfileLoader.loadProfile({
        userId,
        timeout: 10000,
        maxRetries: 2,
        useCache: true
      });
      
      const totalTime = Date.now() - startTime;
      
      console.log(`\nResults:`);
      console.log(`Success: ${result.profile ? 'YES' : 'NO'}`);
      console.log(`From cache: ${result.fromCache ? 'YES' : 'NO'}`);
      console.log(`Load time: ${result.loadTime}ms`);
      console.log(`Total time: ${totalTime}ms`);
      
      if (result.profile) {
        console.log(`Profile ID: ${result.profile.id}`);
        console.log(`Phone: ${result.profile.phone_number}`);
        console.log(`Role: ${result.profile.role}`);
        console.log(`Status: ${result.profile.status}`);
      }
      
    } catch (error) {
      console.error('Profile fetch test failed:', error);
    }
    
    console.log('=== Test Complete ===\n');
  }
  
  /**
   * Clear all caches and metrics for fresh testing
   */
  static async resetForTesting(): Promise<void> {
    console.log('\n=== Resetting for Testing ===');
    
    try {
      await ProfileLoader.clearAllCaches();
      console.log('✓ Profile caches cleared');
      
      await ProfileMonitor.clearMetrics();
      console.log('✓ Performance metrics cleared');
      
      console.log('✓ Reset complete\n');
      
    } catch (error) {
      console.error('Error during reset:', error);
    }
  }
  
  /**
   * Monitor profile fetch in real-time
   */
  static async monitorProfileFetch(userId: string, duration: number = 30000): Promise<void> {
    console.log(`\n=== Monitoring Profile Fetch for ${duration/1000}s ===`);
    
    const startTime = Date.now();
    let attemptCount = 0;
    
    const monitor = setInterval(async () => {
      attemptCount++;
      console.log(`\nAttempt ${attemptCount} (${Date.now() - startTime}ms elapsed)`);
      
      try {
        const result = await ProfileLoader.loadProfile({
          userId,
          timeout: 5000,
          maxRetries: 1,
          useCache: false // Force fresh fetch for monitoring
        });
        
        console.log(`  Result: ${result.profile ? 'SUCCESS' : 'FAILED'}`);
        console.log(`  Load time: ${result.loadTime}ms`);
        
      } catch (error) {
        console.log(`  Error: ${error}`);
      }
    }, 5000); // Test every 5 seconds
    
    // Stop monitoring after specified duration
    setTimeout(() => {
      clearInterval(monitor);
      console.log(`\n=== Monitoring Complete (${attemptCount} attempts) ===\n`);
    }, duration);
  }
  
  /**
   * Quick health check
   */
  static async quickHealthCheck(): Promise<boolean> {
    try {
      console.log('Running quick health check...');
      
      // Test network
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        console.log('❌ No network connection');
        return false;
      }
      
      // Test Supabase
      const connectionTest = await validateSupabaseConnection();
      if (!connectionTest.success) {
        console.log('❌ Supabase connection failed');
        return false;
      }
      
      console.log('✅ Health check passed');
      return true;
      
    } catch (error) {
      console.log('❌ Health check failed:', error);
      return false;
    }
  }
}

// Export convenience functions for console debugging
export const debugProfile = ProfileDebug.runDiagnostics;
export const testProfile = ProfileDebug.testProfileFetch;
export const resetProfile = ProfileDebug.resetForTesting;
export const monitorProfile = ProfileDebug.monitorProfileFetch;
export const healthCheck = ProfileDebug.quickHealthCheck;