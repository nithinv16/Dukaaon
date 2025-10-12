import { supabase } from '../supabase/supabase';
import { Profile } from '../../types/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ProfileMonitor } from '../monitoring/profileMonitor';
import NetInfo from '@react-native-community/netinfo';

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
  private static readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  /**
   * Load profile with progressive loading strategy
   */
  static async loadProfile(options: ProfileLoadOptions): Promise<ProfileLoadResult> {
    const startTime = Date.now();
    const {
      userId,
      timeout = 15000,
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
        console.log('ProfileLoader: useCache=true, attempting cache load');
        const cachedProfile = await this.loadFromCache(userId);
        if (cachedProfile) {
          console.log('ProfileLoader: ✅ Profile successfully loaded from cache');
          
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
          console.log('ProfileLoader: ⚠️ Cache miss, will fetch from database');
        }
      } else {
        console.log('ProfileLoader: useCache=false, skipping cache');
      }

      // Load essential profile data first
      console.log('ProfileLoader: Fetching essential profile from database');
      const essentialProfile = await this.loadEssentialProfile(userId, timeout, maxRetries);
      
      if (essentialProfile) {
        console.log('ProfileLoader: ✅ Essential profile fetched successfully');
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
      console.error('ProfileLoader: ❌ Profile not found after all retries');
      errorMessage = 'Profile not found after all retries';
      
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Unknown error';
      // Log as debug for expected PGRST116 errors, otherwise as error
      if (error instanceof Error && error.message?.includes('PGRST116')) {
        console.debug('Profile availability check completed - profile not found (expected for new users):', error);
      } else {
        console.error('Profile loading error:', error);
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
   * Load essential profile data only
   */
  private static async loadEssentialProfile(
    userId: string,
    timeout: number,
    maxRetries: number
  ): Promise<Profile | null> {
    let retryCount = 0;
    
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
        
        console.log('ProfileLoader: Loaded essential profile - business_details:', !!data?.business_details, 'seller_details:', !!data?.seller_details);
        return data;
      } catch (error: any) {
        retryCount++;
        // Log as debug since PGRST116 (no rows) is expected when checking profile availability
        if (error?.code === 'PGRST116') {
          console.debug(`Essential profile fetch attempt ${retryCount}/${maxRetries} - profile not found (expected):`, error);
        } else {
          console.log(`Essential profile fetch attempt ${retryCount}/${maxRetries} failed:`, error);
        }
        
        if (retryCount < maxRetries) {
          // Exponential backoff
          const delay = Math.pow(2, retryCount - 1) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          // Log as debug since this is expected behavior when profile doesn't exist
          console.debug('Profile not found after all retries - this is expected for new users');
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
      console.log('Loading additional profile details in background...');
      
      const { data, error } = await supabase
        .from('profiles')
        .select('business_details, profile_image_url, kyc_status, id_proof, address_proof, business_proof')
        .eq('id', userId)
        .single();
      
      if (error) {
        console.warn('Failed to load additional profile details:', error);
        return;
      }
      
      // Update cache with additional details
      const cachedProfile = await this.loadFromCache(userId);
      if (cachedProfile && data) {
        const updatedProfile = { ...cachedProfile, ...data };
        await this.saveToCache(userId, updatedProfile);
        console.log('Updated cache with additional profile details');
      }
    } catch (error) {
      console.warn('Error loading additional profile details:', error);
    }
  }

  /**
   * Load profile from cache
   */
  private static async loadFromCache(userId: string): Promise<Profile | null> {
    try {
      const cacheKey = this.CACHE_KEY_PREFIX + userId;
      const expiryKey = this.CACHE_EXPIRY_KEY_PREFIX + userId;
      
      console.log('ProfileLoader: Checking cache for user:', userId);
      console.log('ProfileLoader: Cache keys -', cacheKey, expiryKey);
      
      const [cachedData, expiryTime] = await Promise.all([
        AsyncStorage.getItem(cacheKey),
        AsyncStorage.getItem(expiryKey)
      ]);
      
      console.log('ProfileLoader: Cache check results - hasData:', !!cachedData, 'hasExpiry:', !!expiryTime);
      
      if (!cachedData || !expiryTime) {
        console.log('ProfileLoader: ❌ No cached data or expiry time found');
        return null;
      }
      
      const expiryTimestamp = parseInt(expiryTime);
      const currentTime = Date.now();
      const isExpired = currentTime > expiryTimestamp;
      const timeUntilExpiry = expiryTimestamp - currentTime;
      
      console.log('ProfileLoader: Cache timing - expired:', isExpired, 'timeUntilExpiry:', Math.round(timeUntilExpiry / 1000), 'seconds');
      
      // Check if cache is expired
      if (isExpired) {
        console.log('ProfileLoader: ⚠️ Cache expired, clearing...');
        await this.clearCache(userId);
        return null;
      }
      
      const profile = JSON.parse(cachedData);
      console.log('ProfileLoader: ✅ Valid cache found - role:', profile?.role, 'hasBusiness:', !!profile?.business_details, 'hasSeller:', !!profile?.seller_details);
      return profile;
    } catch (error) {
      console.error('ProfileLoader: ❌ Error loading from cache:', error);
      return null;
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
      
      console.log('Profile saved to cache');
    } catch (error) {
      console.warn('Error saving profile to cache:', error);
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
      
      console.log('Profile cache cleared');
    } catch (error) {
      console.warn('Error clearing profile cache:', error);
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
        console.log(`Cleared ${cacheKeys.length} profile cache entries`);
      }
    } catch (error) {
      console.warn('Error clearing all profile caches:', error);
    }
  }
}
