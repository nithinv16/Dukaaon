/**
 * Remote Configuration Service
 * 
 * This service manages app-level configurations and feature flags
 * that can be changed remotely without requiring app updates.
 * 
 * Features:
 * - Fetch app configurations from database
 * - Check feature flags
 * - Cache configurations locally
 * - Automatic cache invalidation
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabase/supabase';

interface AppConfig {
  key: string;
  value: any;
}

interface FeatureFlag {
  feature_key: string;
  is_enabled: boolean;
  rollout_percentage: number;
  target_user_types: string[];
  config: any;
}

class RemoteConfigService {
  private cache: Map<string, any> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private STORAGE_PREFIX = '@remote_config:';

  /**
   * Get a single configuration value by key
   */
  async getConfig(key: string, defaultValue?: any): Promise<any> {
    try {
      // Check memory cache first
      if (this.isCached(key)) {
        return this.cache.get(key);
      }

      // Try local storage cache
      const cachedValue = await this.getFromStorage(key);
      if (cachedValue !== null) {
        this.cache.set(key, cachedValue);
        this.cacheExpiry.set(key, Date.now() + this.CACHE_DURATION);
        return cachedValue;
      }

      // Fetch from database
      const { data, error } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', key)
        .eq('is_active', true)
        .single();

      if (error) {
        console.warn(`Config key "${key}" not found, using default:`, defaultValue);
        return defaultValue;
      }

      const value = data?.value || defaultValue;
      
      // Cache in memory and storage
      this.cache.set(key, value);
      this.cacheExpiry.set(key, Date.now() + this.CACHE_DURATION);
      await this.saveToStorage(key, value);
      
      return value;
    } catch (error) {
      console.error('Error fetching config:', error);
      return defaultValue;
    }
  }

  /**
   * Get multiple configuration values at once
   */
  async getBulkConfig(keys: string[]): Promise<Record<string, any>> {
    try {
      const { data, error } = await supabase
        .from('app_config')
        .select('key, value')
        .in('key', keys)
        .eq('is_active', true);

      if (error) throw error;

      const config: Record<string, any> = {};
      
      if (data) {
        for (const item of data) {
          config[item.key] = item.value;
          this.cache.set(item.key, item.value);
          this.cacheExpiry.set(item.key, Date.now() + this.CACHE_DURATION);
          await this.saveToStorage(item.key, item.value);
        }
      }

      return config;
    } catch (error) {
      console.error('Error fetching bulk config:', error);
      return {};
    }
  }

  /**
   * Get all configurations
   */
  async getAllConfigs(): Promise<Record<string, any>> {
    try {
      const { data, error } = await supabase
        .from('app_config')
        .select('key, value')
        .eq('is_active', true);

      if (error) throw error;

      const config: Record<string, any> = {};
      
      if (data) {
        for (const item of data) {
          config[item.key] = item.value;
          this.cache.set(item.key, item.value);
          this.cacheExpiry.set(item.key, Date.now() + this.CACHE_DURATION);
        }
      }

      return config;
    } catch (error) {
      console.error('Error fetching all configs:', error);
      return {};
    }
  }

  /**
   * Check if a feature is enabled
   */
  async isFeatureEnabled(featureKey: string, userType?: string): Promise<boolean> {
    try {
      // Check cache first
      const cacheKey = `feature:${featureKey}`;
      if (this.isCached(cacheKey)) {
        return this.cache.get(cacheKey);
      }

      const { data, error } = await supabase
        .from('feature_flags')
        .select('is_enabled, rollout_percentage, target_user_types')
        .eq('feature_key', featureKey)
        .single();

      if (error || !data) {
        console.warn(`Feature flag "${featureKey}" not found, defaulting to disabled`);
        return false;
      }

      // Check if feature is globally disabled
      if (!data.is_enabled) {
        this.cache.set(cacheKey, false);
        this.cacheExpiry.set(cacheKey, Date.now() + this.CACHE_DURATION);
        return false;
      }

      // Check user type targeting
      if (userType && data.target_user_types && data.target_user_types.length > 0) {
        if (!data.target_user_types.includes(userType) && !data.target_user_types.includes('all')) {
          return false;
        }
      }

      // Check rollout percentage (for gradual rollouts)
      if (data.rollout_percentage < 100) {
        const random = Math.random() * 100;
        const enabled = random <= data.rollout_percentage;
        // Don't cache partial rollouts to allow dynamic changes
        return enabled;
      }

      // Feature is fully enabled
      this.cache.set(cacheKey, true);
      this.cacheExpiry.set(cacheKey, Date.now() + this.CACHE_DURATION);
      return true;
    } catch (error) {
      console.error('Error checking feature flag:', error);
      return false;
    }
  }

  /**
   * Get feature configuration
   */
  async getFeatureConfig(featureKey: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('feature_flags')
        .select('config')
        .eq('feature_key', featureKey)
        .eq('is_enabled', true)
        .single();

      if (error || !data) {
        return null;
      }

      return data.config;
    } catch (error) {
      console.error('Error fetching feature config:', error);
      return null;
    }
  }

  /**
   * Get all enabled features for a user type
   */
  async getEnabledFeatures(userType?: string): Promise<string[]> {
    try {
      let query = supabase
        .from('feature_flags')
        .select('feature_key')
        .eq('is_enabled', true);

      const { data, error } = await query;

      if (error) throw error;

      const features: string[] = [];
      
      if (data) {
        for (const item of data) {
          // Additional check with user type if provided
          const enabled = await this.isFeatureEnabled(item.feature_key, userType);
          if (enabled) {
            features.push(item.feature_key);
          }
        }
      }

      return features;
    } catch (error) {
      console.error('Error fetching enabled features:', error);
      return [];
    }
  }

  /**
   * Preload common configurations (call on app start)
   */
  async preloadConfigs(): Promise<void> {
    try {
      const commonKeys = [
        'min_order_amount',
        'delivery_radius_km',
        'maintenance_mode',
        'featured_categories',
        'payment_methods',
        'app_version',
        'delivery_charges',
        'customer_support'
      ];

      await this.getBulkConfig(commonKeys);
      console.log('✅ Remote configs preloaded successfully');
    } catch (error) {
      console.error('Error preloading configs:', error);
    }
  }

  /**
   * Check if app is in maintenance mode
   */
  async isMaintenanceMode(): Promise<{ enabled: boolean; message: string }> {
    const config = await this.getConfig('maintenance_mode', { enabled: false, message: '' });
    return config;
  }

  /**
   * Check if app version is supported
   */
  async checkAppVersion(currentVersion: string): Promise<{
    isSupported: boolean;
    forceUpdate: boolean;
    message?: string;
  }> {
    try {
      const config = await this.getConfig('app_version', {
        min_version: '1.0.0',
        recommended_version: '1.0.0',
        force_update: false
      });

      const isSupported = this.compareVersions(currentVersion, config.min_version) >= 0;
      const forceUpdate = config.force_update && !isSupported;

      return {
        isSupported,
        forceUpdate,
        message: forceUpdate 
          ? 'Please update to the latest version to continue using the app.'
          : undefined
      };
    } catch (error) {
      console.error('Error checking app version:', error);
      return { isSupported: true, forceUpdate: false };
    }
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheExpiry.clear();
  }

  /**
   * Refresh specific config
   */
  async refreshConfig(key: string): Promise<void> {
    this.cache.delete(key);
    this.cacheExpiry.delete(key);
    await AsyncStorage.removeItem(`${this.STORAGE_PREFIX}${key}`);
    await this.getConfig(key);
  }

  /**
   * Refresh all configs
   */
  async refreshAllConfigs(): Promise<void> {
    this.clearCache();
    await this.preloadConfigs();
  }

  // ============ Private Helper Methods ============

  private isCached(key: string): boolean {
    const expiry = this.cacheExpiry.get(key);
    if (!expiry) return false;
    
    if (Date.now() > expiry) {
      this.cache.delete(key);
      this.cacheExpiry.delete(key);
      return false;
    }
    
    return this.cache.has(key);
  }

  private async saveToStorage(key: string, value: any): Promise<void> {
    try {
      await AsyncStorage.setItem(
        `${this.STORAGE_PREFIX}${key}`,
        JSON.stringify(value)
      );
    } catch (error) {
      console.warn('Error saving to storage:', error);
    }
  }

  private async getFromStorage(key: string): Promise<any> {
    try {
      const value = await AsyncStorage.getItem(`${this.STORAGE_PREFIX}${key}`);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      return null;
    }
  }

  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const part1 = parts1[i] || 0;
      const part2 = parts2[i] || 0;
      
      if (part1 > part2) return 1;
      if (part1 < part2) return -1;
    }
    
    return 0;
  }
}

// Export singleton instance
export const remoteConfigService = new RemoteConfigService();

// Convenience export for specific configs
export const getAppConfig = (key: string, defaultValue?: any) => 
  remoteConfigService.getConfig(key, defaultValue);

export const isFeatureEnabled = (featureKey: string, userType?: string) => 
  remoteConfigService.isFeatureEnabled(featureKey, userType);

