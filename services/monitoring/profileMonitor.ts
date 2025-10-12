import AsyncStorage from '@react-native-async-storage/async-storage';

interface ProfileFetchMetrics {
  timestamp: number;
  userId: string;
  success: boolean;
  loadTime: number;
  fromCache: boolean;
  retryCount: number;
  errorMessage?: string;
  networkStatus: 'good' | 'poor' | 'offline';
}

interface ProfilePerformanceStats {
  totalFetches: number;
  successRate: number;
  averageLoadTime: number;
  cacheHitRate: number;
  commonErrors: { [key: string]: number };
  networkIssues: number;
}

/**
 * Monitor profile fetch performance and identify issues
 */
export class ProfileMonitor {
  private static readonly METRICS_KEY = 'profile_fetch_metrics';
  private static readonly MAX_METRICS = 100; // Keep last 100 metrics
  private static readonly PERFORMANCE_THRESHOLD = 5000; // 5 seconds

  /**
   * Record a profile fetch attempt
   */
  static async recordFetch(metrics: Omit<ProfileFetchMetrics, 'timestamp'>): Promise<void> {
    try {
      const timestamp = Date.now();
      const newMetric: ProfileFetchMetrics = {
        ...metrics,
        timestamp
      };

      // Get existing metrics
      const existingMetrics = await this.getMetrics();
      
      // Add new metric and keep only the latest ones
      const updatedMetrics = [newMetric, ...existingMetrics]
        .slice(0, this.MAX_METRICS);

      // Save updated metrics
      await AsyncStorage.setItem(
        this.METRICS_KEY,
        JSON.stringify(updatedMetrics)
      );

      // Log performance issues (but not for expected profile not found scenarios)
      if (!metrics.success || metrics.loadTime > this.PERFORMANCE_THRESHOLD) {
        // Don't log as warning if it's just a profile not found (PGRST116) - this is expected
        if (metrics.errorMessage?.includes('PGRST116') || metrics.errorMessage?.includes('Profile not found')) {
          console.debug('Profile availability check completed:', {
            success: metrics.success,
            loadTime: metrics.loadTime,
            networkStatus: metrics.networkStatus
          });
        } else {
          console.warn('Profile fetch performance issue:', {
            success: metrics.success,
            loadTime: metrics.loadTime,
            error: metrics.errorMessage,
            networkStatus: metrics.networkStatus
          });
        }
      }

      // Log successful cache hits
      if (metrics.success && metrics.fromCache) {
        console.log(`Profile cache hit - loaded in ${metrics.loadTime}ms`);
      }

    } catch (error) {
      console.warn('Error recording profile fetch metrics:', error);
    }
  }

  /**
   * Get performance statistics
   */
  static async getPerformanceStats(): Promise<ProfilePerformanceStats> {
    try {
      const metrics = await this.getMetrics();
      
      if (metrics.length === 0) {
        return {
          totalFetches: 0,
          successRate: 0,
          averageLoadTime: 0,
          cacheHitRate: 0,
          commonErrors: {},
          networkIssues: 0
        };
      }

      const totalFetches = metrics.length;
      const successfulFetches = metrics.filter(m => m.success).length;
      const cacheHits = metrics.filter(m => m.fromCache).length;
      const networkIssues = metrics.filter(m => m.networkStatus !== 'good').length;
      
      const successRate = (successfulFetches / totalFetches) * 100;
      const cacheHitRate = (cacheHits / totalFetches) * 100;
      
      const totalLoadTime = metrics.reduce((sum, m) => sum + m.loadTime, 0);
      const averageLoadTime = totalLoadTime / totalFetches;

      // Count common errors
      const commonErrors: { [key: string]: number } = {};
      metrics
        .filter(m => !m.success && m.errorMessage)
        .forEach(m => {
          const error = m.errorMessage!;
          commonErrors[error] = (commonErrors[error] || 0) + 1;
        });

      return {
        totalFetches,
        successRate: Math.round(successRate * 100) / 100,
        averageLoadTime: Math.round(averageLoadTime),
        cacheHitRate: Math.round(cacheHitRate * 100) / 100,
        commonErrors,
        networkIssues
      };

    } catch (error) {
      console.warn('Error getting performance stats:', error);
      return {
        totalFetches: 0,
        successRate: 0,
        averageLoadTime: 0,
        cacheHitRate: 0,
        commonErrors: {},
        networkIssues: 0
      };
    }
  }

  /**
   * Get recent metrics
   */
  private static async getMetrics(): Promise<ProfileFetchMetrics[]> {
    try {
      const metricsData = await AsyncStorage.getItem(this.METRICS_KEY);
      return metricsData ? JSON.parse(metricsData) : [];
    } catch (error) {
      console.warn('Error loading profile metrics:', error);
      return [];
    }
  }

  /**
   * Clear all metrics
   */
  static async clearMetrics(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.METRICS_KEY);
      console.log('Profile metrics cleared');
    } catch (error) {
      console.warn('Error clearing profile metrics:', error);
    }
  }

  /**
   * Get diagnostic information
   */
  static async getDiagnostics(): Promise<{
    recentErrors: string[];
    performanceIssues: boolean;
    cacheEffectiveness: 'good' | 'poor' | 'unknown';
    networkStability: 'stable' | 'unstable' | 'unknown';
    recommendations: string[];
  }> {
    try {
      const stats = await this.getPerformanceStats();
      const metrics = await this.getMetrics();
      
      // Get recent errors (last 10)
      const recentErrors = metrics
        .filter(m => !m.success && m.errorMessage)
        .slice(0, 10)
        .map(m => m.errorMessage!);

      // Check performance issues
      const performanceIssues = stats.averageLoadTime > this.PERFORMANCE_THRESHOLD || 
                               stats.successRate < 90;

      // Assess cache effectiveness
      let cacheEffectiveness: 'good' | 'poor' | 'unknown' = 'unknown';
      if (stats.totalFetches > 10) {
        cacheEffectiveness = stats.cacheHitRate > 30 ? 'good' : 'poor';
      }

      // Assess network stability
      let networkStability: 'stable' | 'unstable' | 'unknown' = 'unknown';
      if (stats.totalFetches > 5) {
        const networkIssueRate = (stats.networkIssues / stats.totalFetches) * 100;
        networkStability = networkIssueRate < 20 ? 'stable' : 'unstable';
      }

      // Generate recommendations
      const recommendations: string[] = [];
      
      if (stats.successRate < 90) {
        recommendations.push('Consider increasing retry attempts or timeout duration');
      }
      
      if (stats.averageLoadTime > this.PERFORMANCE_THRESHOLD) {
        recommendations.push('Profile queries may need optimization');
      }
      
      if (cacheEffectiveness === 'poor') {
        recommendations.push('Cache hit rate is low - consider increasing cache duration');
      }
      
      if (networkStability === 'unstable') {
        recommendations.push('Network connectivity issues detected - implement offline mode');
      }
      
      if (Object.keys(stats.commonErrors).length > 0) {
        const mostCommonError = Object.entries(stats.commonErrors)
          .sort(([,a], [,b]) => b - a)[0][0];
        recommendations.push(`Address common error: ${mostCommonError}`);
      }

      return {
        recentErrors,
        performanceIssues,
        cacheEffectiveness,
        networkStability,
        recommendations
      };

    } catch (error) {
      console.warn('Error generating diagnostics:', error);
      return {
        recentErrors: [],
        performanceIssues: false,
        cacheEffectiveness: 'unknown',
        networkStability: 'unknown',
        recommendations: ['Error generating diagnostics - check logs']
      };
    }
  }

  /**
   * Log performance summary
   */
  static async logPerformanceSummary(): Promise<void> {
    try {
      const stats = await this.getPerformanceStats();
      const diagnostics = await this.getDiagnostics();
      
      console.log('=== Profile Fetch Performance Summary ===');
      console.log(`Total fetches: ${stats.totalFetches}`);
      console.log(`Success rate: ${stats.successRate}%`);
      console.log(`Average load time: ${stats.averageLoadTime}ms`);
      console.log(`Cache hit rate: ${stats.cacheHitRate}%`);
      console.log(`Network issues: ${stats.networkIssues}`);
      
      if (Object.keys(stats.commonErrors).length > 0) {
        console.log('Common errors:', stats.commonErrors);
      }
      
      if (diagnostics.recommendations.length > 0) {
        console.log('Recommendations:');
        diagnostics.recommendations.forEach(rec => console.log(`- ${rec}`));
      }
      
      console.log('==========================================');
      
    } catch (error) {
      console.warn('Error logging performance summary:', error);
    }
  }
}