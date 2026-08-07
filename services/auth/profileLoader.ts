import { supabase } from '../supabase/supabase';
import { Profile } from '../../types/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ProfileMonitor } from '../monitoring/profileMonitor';
import NetInfo from '@react-native-community/netinfo';
import { LoggingService } from '../logging';

// Create scoped logger for ProfileLoader
const logger = LoggingService.createScope('ProfileLoader');

interface ProfileLoadOptions {
  userId: string;
  timeout?: number;
  maxRetries?: number;
  useCache?: boolean;
}

interface ProfileLoadResult {
  profile: Profile | null;
  fromCache: boolean;
  loadTime: number;
}

/**
 * Progressive profile loader with caching and retry logic
 */
export class ProfileLoader {
  private static readonly CACHE_KEY_PREFIX = 'profile_cache_';
  private static readonly CACHE_EXPIRY_KEY_PREFIX = 'profile_cache_expiry_';
  private static readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours - use stale cache, don't delete
  private static readonly STALE_THRESHOLD = 5 * 60 * 1000; // 5 minutes - trigger background refresh after this

  /**
   * Load profile with progressive loading strategy
   */
  static async loadProfile(options: ProfileLoadOptions): Promise<ProfileLoadResult> {
    const startTime = Date.now();
    const {
      userId,
      timeout = 20000, // Increased from 15000ms to 20000ms for better cold start handling
      maxRetries = 3,
      useCache = true
    } = options;

    let retryCount = 0;
    let errorMessage: string | undefined;
    let networkStatus: 'good' | 'poor' | 'offline' = 'good';

    try {
      // Check network status
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        networkStatus = 'offline';
      } else if (netInfo.type === 'cellular' && netInfo.details?.cellularGeneration === '2g') {
        networkStatus = 'poor';
      }

      // Try to load from cache first
      if (useCache) {
        logger.debug('useCache=true, attempting cache load');
        const cachedProfile = await this.loadFromCache(userId);
        if (cachedProfile) {
          logger.info('Profile successfully loaded from cache');
          
          // Record successful cache hit
          await ProfileMonitor.recordFetch({
            userId,
            success: true,
            loadTime: Date.now() - startTime,
            fromCache: true,
            retryCount: 0,
            networkStatus
          });
          
          // Load additional details in background
          this.loadAdditionalDetailsInBackground(userId);
          return {
            profile: cachedProfile,
            fromCache: true,
            loadTime: Date.now() - startTime
          };
        } else {
          logger.debug('Cache miss, will fetch from database');
        }
      } else {
        logger.debug('useCache=false, skipping cache');
      }

      // Load essential profile data first
      logger.debug('Fetching essential profile from database');
      const essentialProfile = await this.loadEssentialProfile(userId, timeout, maxRetries);
      
      if (essentialProfile) {
        logger.info('Essential profile fetched successfully');
        // Cache the essential profile
        await this.saveToCache(userId, essentialProfile);
        
        // Record successful database fetch
        await ProfileMonitor.recordFetch({
          userId,
          success: true,
          loadTime: Date.now() - startTime,
          fromCache: false,
          retryCount,
          networkStatus
        });
        
        // Load additional details in background
        this.loadAdditionalDetailsInBackground(userId);
        
        return {
          profile: essentialProfile,
          fromCache: false,
          loadTime: Date.now() - startTime
        };
      }

      // If we reach here, profile loading failed
      logger.warn('Profile not found after all retries');
      errorMessage = 'Profile not found after all retries';
      
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Unknown error';
      // Log as debug for expected PGRST116 errors, otherwise as error
      if (error instanceof Error && error.message?.includes('PGRST116')) {
        logger.debug('Profile availability check completed - profile not found (expected for new users)');
      } else {
        logger.error('Profile loading error', error);
      }
    }

    // Record failed fetch
    await ProfileMonitor.recordFetch({
      userId,
      success: false,
      loadTime: Date.now() - startTime,
      fromCache: false,
      retryCount,
      errorMessage,
      networkStatus
    });

    return {
      profile: null,
      fromCache: false,
      loadTime: Date.now() - startTime
    };
  }

  /**
   * Load essential profile data only with exponential backoff retry
   * Retry delays: 1s, 2s, 4s (exponential backoff)
   * Falls back to cached profile after 3 failed attempts
   * 
   * Requirements: 1.4
   */
  private static async loadEssentialProfile(
    userId: string,
    timeout: number,
    maxRetries: number
  ): Promise<Profile | null> {
    let retryCount = 0;
    // Exponential backoff delays: 1s, 2s, 4s
    const RETRY_DELAYS = [1000, 2000, 4000];
    
    while (retryCount < maxRetries) {
      try {
        const profilePromise = supabase
          .from('profiles')
          .select(`
            id, 
            phone_number, 
            role, 
            status, 
            created_at, 
            updated_at, 
            business_details,
            seller_details:seller_details(*)
          `)
          .eq('id', userId)
          .single();
        
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Profile fetch timeout')), timeout)
        );
        
        const { data, error } = await Promise.race([profilePromise, timeoutPromise]) as any;
        
        if (error) {
          throw error;
        }
        
        logger.debug('Loaded essential profile', { hasBusiness: !!data?.business_details, hasSeller: !!data?.seller_details });
        return data;
      } catch (error: any) {
        retryCount++;
        // Log as debug since PGRST116 (no rows) is expected when checking profile availability
        if (error?.code === 'PGRST116') {
          logger.debug(`Essential profile fetch attempt ${retryCount}/${maxRetries} - profile not found (expected)`);
        } else {
          logger.debug(`Retry ${retryCount}/${maxRetries} failed`, { error: error?.message || error });
        }
        
        if (retryCount < maxRetries) {
          // Exponential backoff with explicit delays: 1s, 2s, 4s
          const delay = RETRY_DELAYS[retryCount - 1] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
          logger.debug(`Waiting ${delay}ms before retry ${retryCount + 1}`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          // After 3 failed attempts, try to fall back to cached data
          logger.debug('All retries exhausted, attempting cache fallback');
          const cachedProfile = await this.loadFromCache(userId);
          if (cachedProfile) {
            logger.info('Falling back to cached profile after failed retries');
            return cachedProfile;
          }
          // Log as debug since this is expected behavior when profile doesn't exist
          logger.debug('Profile not found after all retries - this is expected for new users');
          return null;
        }
      }
    }
    
    return null;
  }

  /**
   * Load additional profile details in background
   */
  private static async loadAdditionalDetailsInBackground(userId: string): Promise<void> {
    try {
      logger.debug('Loading additional profile details in background...');
      
      const { data, error } = await supabase
        .from('profiles')
        .select('business_details, profile_image_url, kyc_status, id_proof, address_proof, business_proof')
        .eq('id', userId)
        .single();
      
      if (error) {
        logger.warn('Failed to load additional profile details', { error });
        return;
      }
      
      // Update cache with additional details
      const cachedProfile = await this.loadFromCache(userId);
      if (cachedProfile && data) {
        const updatedProfile = { ...cachedProfile, ...data };
        await this.saveToCache(userId, updatedProfile);
        logger.debug('Updated cache with additional profile details');
      }
    } catch (error) {
      logger.warn('Error loading additional profile details', { error });
    }
  }

  /**
   * Load profile from cache with stale-while-revalidate pattern
   * Returns cached data immediately if available, triggers background refresh if stale
   * **Validates: Requirements 2.4**
   */
  private static async loadFromCache(userId: string): Promise<Profile | null> {
    try {
      const cacheKey = this.CACHE_KEY_PREFIX + userId;
      const expiryKey = this.CACHE_EXPIRY_KEY_PREFIX + userId;
      
      logger.debug('Checking cache for user', { userId });
      
      const [cachedData, expiryTime] = await Promise.all([
        AsyncStorage.getItem(cacheKey),
        AsyncStorage.getItem(expiryKey)
      ]);
      
      logger.debug('Cache check results', { hasData: !!cachedData, hasExpiry: !!expiryTime });
      
      if (!cachedData || !expiryTime) {
        logger.debug('No cached data or expiry time found');
        return null;
      }
      
      const expiryTimestamp = parseInt(expiryTime);
      const currentTime = Date.now();
      const cacheAge = currentTime - (expiryTimestamp - this.CACHE_DURATION);
      const isStale = cacheAge >= this.STALE_THRESHOLD;
      const isExpired = currentTime > expiryTimestamp;
      const timeUntilExpiry = expiryTimestamp - currentTime;
      
      logger.debug('Cache timing', { 
        ageSeconds: Math.round(cacheAge / 1000), 
        isStale, 
        isExpired, 
        timeUntilExpirySeconds: Math.round(timeUntilExpiry / 1000) 
      });
      
      const profile = JSON.parse(cachedData);
      
      // Stale-While-Revalidate: Use cache if available, trigger background refresh if stale
      if (isStale || isExpired) {
        logger.debug('Cache is stale/expired, returning stale profile for instant UX');
        
        // Trigger background refresh (non-blocking)
        this.refreshProfileInBackground(userId).catch(error => {
          logger.warn('Background refresh failed (non-critical)', { error });
        });
        
        return profile;
      }
      
      logger.debug('Fresh cache found', { role: profile?.role, hasBusiness: !!profile?.business_details, hasSeller: !!profile?.seller_details });
      return profile;
    } catch (error) {
      logger.error('Error loading from cache', error);
      return null;
    }
  }

  /**
   * Refresh profile in background (non-blocking)
   * Used by stale-while-revalidate pattern
   * 
   * This method:
   * 1. Fetches fresh profile data from database
   * 2. Updates the cache with fresh data
   * 3. Does NOT trigger coordinator (coordinator already triggered by initial profile load)
   * 
   * Requirements: 1.1, 1.2, 2.1
   */
  private static async refreshProfileInBackground(userId: string): Promise<void> {
    logger.debug('Starting background refresh', { userId });
    
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select(`
          id, 
          phone_number, 
          role, 
          status, 
          created_at, 
          updated_at, 
          business_details,
          seller_details:seller_details(*)
        `)
        .eq('id', userId)
        .single();
      
      if (error) {
        logger.warn('Background refresh query failed', { error });
        return;
      }
      
      if (profile) {
        logger.debug('Background refresh successful, updating cache');
        await this.saveToCache(userId, profile);
      }
    } catch (error) {
      logger.warn('Background refresh error', { error });
    }
  }

  /**
   * Save profile to cache
   */
  private static async saveToCache(userId: string, profile: Profile): Promise<void> {
    try {
      const cacheKey = this.CACHE_KEY_PREFIX + userId;
      const expiryKey = this.CACHE_EXPIRY_KEY_PREFIX + userId;
      const expiryTime = Date.now() + this.CACHE_DURATION;
      
      await Promise.all([
        AsyncStorage.setItem(cacheKey, JSON.stringify(profile)),
        AsyncStorage.setItem(expiryKey, expiryTime.toString())
      ]);
      
      logger.debug('Profile saved to cache');
    } catch (error) {
      logger.warn('Error saving profile to cache', { error });
    }
  }

  /**
   * Clear profile cache
   */
  static async clearCache(userId: string): Promise<void> {
    try {
      const cacheKey = this.CACHE_KEY_PREFIX + userId;
      const expiryKey = this.CACHE_EXPIRY_KEY_PREFIX + userId;
      
      await Promise.all([
        AsyncStorage.removeItem(cacheKey),
        AsyncStorage.removeItem(expiryKey)
      ]);
      
      logger.debug('Profile cache cleared');
    } catch (error) {
      logger.warn('Error clearing profile cache', { error });
    }
  }

  /**
   * Clear all profile caches
   */
  static async clearAllCaches(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => 
        key.startsWith(this.CACHE_KEY_PREFIX) || 
        key.startsWith(this.CACHE_EXPIRY_KEY_PREFIX)
      );
      
      if (cacheKeys.length > 0) {
        await AsyncStorage.multiRemove(cacheKeys);
        logger.debug(`Cleared ${cacheKeys.length} profile cache entries`);
      }
    } catch (error) {
      logger.warn('Error clearing all profile caches', { error });
    }
  }
}
