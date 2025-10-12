import { create } from 'zustand';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabase/supabase';
import { AuthState, Profile } from '../types/auth';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { ProfileLoader } from '../services/auth/profileLoader';
import { ProfileDebug } from '../utils/profileDebug';

// Extended AuthState interface with debugging methods
interface ExtendedAuthState extends AuthState {
  debugProfileFetch: (userId?: string) => Promise<void>;
  testProfileFetch: (userId?: string) => Promise<void>;
  resetProfileDebug: () => Promise<void>;
}

export const useAuthStore = create<ExtendedAuthState>((set, get) => ({
  session: null,
  user: null,
  loading: true,
  role: null,
  setSession: async (session) => {
    try {
      if (!session?.user) {
        set({ session: null, user: null, loading: false });
        // Clear AsyncStorage when session is null with error handling
        try {
          await Promise.all([
            AsyncStorage.removeItem('auth_verified'),
            AsyncStorage.removeItem('user_phone'),
            AsyncStorage.removeItem('user_role'),
            AsyncStorage.removeItem('user_id'),
            AsyncStorage.removeItem('profile_id')
          ]);
        } catch (storageError) {
          console.error('Error clearing AsyncStorage in setSession:', storageError);
        }
        return;
      }

      // Use ProfileLoader for optimized profile fetching
      const { validateSupabaseConnection } = await import('../services/supabase/supabase');
      const connectionTest = await validateSupabaseConnection();
      
      const profileResult = await ProfileLoader.loadProfile({
        userId: session.user.id,
        timeout: connectionTest.success ? 15000 : 8000,
        maxRetries: connectionTest.success ? 3 : 1,
        useCache: true
      });
      
      const profile = profileResult.profile;
      
      if (profileResult.fromCache) {
        console.log(`Profile loaded from cache in ${profileResult.loadTime}ms`);
      } else {
        console.log(`Profile loaded from database in ${profileResult.loadTime}ms`);
      }
      
      if (!connectionTest.success && !profile) {
        console.warn('Network connectivity issue and no cached profile available:', connectionTest.message);
      }

      if (profile) {
        // Sync AsyncStorage with valid session and profile with error handling
        try {
          const storageOperations = [
            AsyncStorage.setItem('auth_verified', 'true'),
            AsyncStorage.setItem('user_id', profile.id),
            AsyncStorage.setItem('profile_id', profile.id)
          ];
          
          if (profile.phone_number) {
            storageOperations.push(AsyncStorage.setItem('user_phone', profile.phone_number));
          }
          if (profile.role) {
            storageOperations.push(AsyncStorage.setItem('user_role', profile.role));
          }
          
          await Promise.all(storageOperations);
        } catch (storageError) {
          console.error('Error saving to AsyncStorage in setSession:', storageError);
          // Continue with state update even if storage fails
        }
      }

      set({ 
        session, 
        user: profile || null,
        loading: false 
      });
    } catch (error) {
      console.error('Error in setSession:', error);
      set({ session: null, user: null, loading: false });
    }
  },
  clearAuth: async () => {
    // Clear AsyncStorage with error handling
    try {
      await Promise.all([
        AsyncStorage.removeItem('auth_verified'),
        AsyncStorage.removeItem('user_phone'),
        AsyncStorage.removeItem('user_role'),
        AsyncStorage.removeItem('user_id'),
        AsyncStorage.removeItem('profile_id')
      ]);
      
      // Clear profile cache
      await ProfileLoader.clearAllCaches();
    } catch (storageError) {
      console.error('Error clearing AsyncStorage in clearAuth:', storageError);
      // Continue with state clearing even if storage fails
    }
    
    set({ 
      session: null, 
      user: null, 
      loading: false
    });
  },
  setUser: (user: Profile | null) => set({ user }),
  createProfileDirectly: async (phoneNumber: string, role: string = 'retailer') => {
    try {
      console.log('Creating profile directly with phone:', phoneNumber, 'role:', role);
      
      // Normalize phone number by removing '+91' prefix if present
      const normalizedPhone = phoneNumber.startsWith('+91') 
        ? phoneNumber.substring(3) 
        : phoneNumber;
      
      // First check if profile exists with this phone number
      const { data: existingProfile, error: findError } = await supabase
        .from('profiles')
        .select('*')
        .eq('phone_number', normalizedPhone)
        .maybeSingle();
      
      if (findError) {
        console.error('Error finding existing profile:', findError);
      }
      
      // If profile exists, return it
      if (existingProfile) {
        console.log('Found existing profile:', existingProfile.id);
        set({ user: existingProfile });
        return existingProfile;
      }
      
      // Otherwise, create a new profile
      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert({
          phone_number: normalizedPhone,
          role: role,
          status: 'pending',
          business_details: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (createError) {
        console.error('Error creating new profile:', createError);
        return null;
      }
      
      console.log('Created new profile:', newProfile.id);
      set({ user: newProfile });
      return newProfile;
    } catch (error) {
      console.error('Exception in createProfileDirectly:', error);
      return null;
    }
  },
  
  // Development-only debugging methods
  debugProfileFetch: async (userId?: string) => {
    if (__DEV__) {
      const currentUser = useAuthStore.getState().user;
      const targetUserId = userId || currentUser?.id;
      
      if (!targetUserId) {
        console.log('No user ID available for debugging');
        return;
      }
      
      await ProfileDebug.runDiagnostics(targetUserId);
    }
  },
  
  testProfileFetch: async (userId?: string) => {
    if (__DEV__) {
      const currentUser = useAuthStore.getState().user;
      const targetUserId = userId || currentUser?.id;
      
      if (!targetUserId) {
        console.log('No user ID available for testing');
        return;
      }
      
      await ProfileDebug.testProfileFetch(targetUserId);
    }
  },
  
  resetProfileDebug: async () => {
    if (__DEV__) {
      await ProfileDebug.resetForTesting();
    }
  }
}));

// Initialize session on app load with proper error handling
let isInitialized = false;

const initializeAuth = async () => {
  if (isInitialized) return;
  
  try {
    isInitialized = true;
    console.log('Auth Store: Starting initialization');
    
    // First check if we have cached auth data to avoid unnecessary network calls
    const cachedAuthData = await Promise.all([
      AsyncStorage.getItem('auth_verified'),
      AsyncStorage.getItem('user_id'),
      AsyncStorage.getItem('profile_id'),
      AsyncStorage.getItem('user_phone'),
      AsyncStorage.getItem('user_role')
    ]);
    
    const [authVerified, userId, profileId, userPhone, userRole] = cachedAuthData;
    const hasCachedAuth = authVerified === 'true' && userId;
    
    if (hasCachedAuth) {
      console.log('Auth Store: Found cached auth data for user:', userId);
      
      // Try to load cached profile first for faster UI response
      try {
        console.log('Auth Store: Attempting to load profile via ProfileLoader for user:', userId);
        const loadStartTime = Date.now();
        
        const cachedProfile = await ProfileLoader.loadProfile({
          userId,
          timeout: 3000,
          maxRetries: 1,
          useCache: true
        });
        
        const loadDuration = Date.now() - loadStartTime;
        console.log(`Auth Store: ProfileLoader completed in ${loadDuration}ms - fromCache:`, cachedProfile.fromCache, 'hasProfile:', !!cachedProfile.profile);
        
        if (cachedProfile.profile) {
          console.log('Auth Store: ✅ Successfully restored user from ProfileLoader, role:', cachedProfile.profile.role);
          // Set user state immediately from cache with a minimal session object
          useAuthStore.setState({ 
            user: cachedProfile.profile,
            session: { user: { id: userId } } as any, // Minimal session for cached auth
            loading: false 
          });
          
          // Continue with session verification in background
          console.log('Auth Store: User restored from cache, will verify session in background');
          
          // Do background session check without blocking
          supabase.auth.getSession().then(({ data }) => {
            if (data.session) {
              console.log('Auth Store: Background session verification successful, updating session');
              useAuthStore.getState().setSession(data.session);
            } else {
              console.log('Auth Store: No active session in background check, but keeping cached user');
            }
          }).catch(error => {
            console.log('Auth Store: Background session check failed, keeping cached user:', error);
          });
          
          // Return early to skip further session fetching
          return;
        } else {
          console.log('Auth Store: ⚠️ ProfileLoader returned null - fromCache:', cachedProfile.fromCache, 'loadTime:', cachedProfile.loadTime);
          console.log('Auth Store: Attempting direct database fetch as fallback');
          
          // ProfileLoader failed - fetch directly from database
          try {
            const dbFetchStart = Date.now();
            const { data: profileData, error: profileError } = await supabase
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
            
            const dbFetchDuration = Date.now() - dbFetchStart;
            console.log(`Auth Store: Direct DB fetch completed in ${dbFetchDuration}ms - hasData:`, !!profileData, 'error:', profileError?.message);
            
            if (profileData && !profileError) {
              console.log('Auth Store: ✅ Successfully fetched profile from database, role:', profileData.role);
              console.log('Auth Store: Profile has business_details:', !!profileData.business_details, 'seller_details:', !!profileData.seller_details);
              
              // Set user state immediately
              useAuthStore.setState({ 
                user: profileData,
                session: { user: { id: userId } } as any,
                loading: false 
              });
              
              console.log('Auth Store: User state set, updating ProfileLoader cache in background');
              
              // Update ProfileLoader cache in background (don't await)
              ProfileLoader.loadProfile({
                userId,
                timeout: 5000,
                maxRetries: 1,
                useCache: false
              }).then(() => {
                console.log('Auth Store: ProfileLoader cache updated');
              }).catch(err => {
                console.log('Auth Store: Failed to update ProfileLoader cache:', err);
              });
              
              // Verify session in background
              supabase.auth.getSession().then(({ data }) => {
                if (data.session) {
                  console.log('Auth Store: Background session verification successful');
                  useAuthStore.getState().setSession(data.session);
                }
              }).catch(error => {
                console.log('Auth Store: Background session check failed:', error);
              });
              
              return;
            } else {
              console.error('Auth Store: ❌ Failed to fetch profile from database - error:', profileError);
              console.log('Auth Store: DB fetch failed but cached auth exists, setting loading false and keeping cached state');
              useAuthStore.setState({ loading: false });
              return; // Don't continue if DB fetch failed but we have cached auth
            }
          } catch (dbError) {
            console.error('Auth Store: ❌ Exception during direct database fetch:', dbError);
            console.log('Auth Store: DB fetch exception but cached auth exists, setting loading false and keeping cached state');
            useAuthStore.setState({ loading: false });
            return; // Don't continue if DB fetch threw exception but we have cached auth
          }
        }
      } catch (cacheError) {
        console.error('Auth Store: ❌ Exception during ProfileLoader attempt:', cacheError);
        console.log('Auth Store: ProfileLoader exception but cached auth exists, setting loading false and keeping cached state');
        useAuthStore.setState({ loading: false });
        return; // Don't continue if ProfileLoader threw exception but we have cached auth
      }
    } else {
      console.log('Auth Store: No cached auth data found');
    }
    
    // Check network connectivity before session initialization
    const { validateSupabaseConnection } = await import('../services/supabase/supabase');
    const connectionTest = await validateSupabaseConnection();
    
    if (!connectionTest.success) {
      console.warn('Auth Store: Network issue during initialization:', connectionTest.message);
      
      // If we have cached auth and no network, keep using cached data
      if (hasCachedAuth) {
        console.log('Auth Store: Using cached auth data due to network issues');
        const currentState = useAuthStore.getState();
        
        // If we already set user from cache above, we're good
        if (currentState.user) {
          console.log('Auth Store: User already restored from cache, skipping session check');
          return;
        }
        
        // Otherwise try to load from cache
        try {
          const cachedProfile = await ProfileLoader.loadProfile({
            userId,
            timeout: 1000,
            maxRetries: 1,
            useCache: true
          });
          
          if (cachedProfile.profile) {
            useAuthStore.setState({ 
              user: cachedProfile.profile, 
              loading: false,
              session: { user: { id: userId } } as any // Minimal session object
            });
            console.log('Auth Store: Successfully using cached profile due to network issues');
            return;
          }
        } catch (error) {
          console.log('Auth Store: Failed to load cached profile:', error);
        }
      }
    }
    
    // Check if we already have user from cache (this should have been handled above)
    const currentState = useAuthStore.getState();
    if (currentState.user) {
      console.log('Auth Store: User already set, skipping session fetch');
      return;
    }
    
    // Get initial session with extended timeout and retry logic
    let session = null;
    let retryCount = 0;
    const maxRetries = connectionTest.success ? 3 : 1; // Reduced retries for poor connection
    const timeoutDuration = connectionTest.success ? 10000 : 3000; // Reduced timeout for poor connection
    
    console.log('Auth Store: Fetching session from Supabase');
    
    while (retryCount < maxRetries && !session) {
      try {
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Session timeout')), timeoutDuration)
        );
        
        const { data, error: sessionError } = await Promise.race([sessionPromise, timeoutPromise]) as any;
        
        // Check for invalid refresh token error
        if (sessionError && (sessionError.message?.includes('Invalid Refresh Token') || sessionError.message?.includes('Refresh Token Not Found'))) {
          console.error('Auth Store: Invalid or expired refresh token detected, clearing cached auth');
          await useAuthStore.getState().clearAuth();
          return;
        }
        
        session = data.session;
        
        if (session) {
          console.log('Auth Store: Session retrieved successfully on attempt', retryCount + 1);
          break;
        }
      } catch (error: any) {
        // Check if error is about invalid refresh token
        if (error?.message?.includes('Invalid Refresh Token') || error?.message?.includes('Refresh Token Not Found')) {
          console.error('Auth Store: Invalid or expired refresh token detected in catch, clearing cached auth');
          await useAuthStore.getState().clearAuth();
          return;
        }
        
        retryCount++;
        console.log(`Auth Store: Session fetch attempt ${retryCount}/${maxRetries} failed:`, error);
        
        if (retryCount < maxRetries) {
          // Exponential backoff for retries
          const delay = Math.min(1000 * Math.pow(2, retryCount - 1), 2000);
          console.log(`Auth Store: Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          console.log('Auth Store: All session fetch attempts failed');
          
          // If we have cached auth data but session fetch failed, keep the cached data
          if (hasCachedAuth) {
            console.log('Auth Store: Session fetch failed but cached auth exists, keeping cached state');
            return; // Don't clear auth if we have valid cached data
          }
          
          throw error;
        }
      }
    }
    
    if (session) {
      console.log('Auth Store: Valid session found, updating session state');
      await useAuthStore.getState().setSession(session);
    } else if (!hasCachedAuth) {
      // Only clear auth if we don't have cached data
      console.log('Auth Store: No session found and no cached auth, clearing auth state');
      await useAuthStore.getState().clearAuth();
    } else {
      console.log('Auth Store: No session found but cached auth exists, keeping current state');
    }
  } catch (error) {
    console.error('Error getting initial session:', error);
    
    // Check if we have cached auth data before clearing
    try {
      const authVerified = await AsyncStorage.getItem('auth_verified');
      const userId = await AsyncStorage.getItem('user_id');
      
      if (authVerified === 'true' && userId) {
        console.log('Error occurred but cached auth exists, keeping cached state');
        useAuthStore.setState({ loading: false });
        return;
      }
    } catch (storageError) {
      console.error('Error checking cached auth:', storageError);
    }
    
    try {
      await useAuthStore.getState().clearAuth();
    } catch (clearError) {
      console.error('Error clearing auth after session error:', clearError);
      // Set loading to false as fallback
      useAuthStore.setState({ loading: false });
    }
  }
};

// Initialize with delay to ensure AsyncStorage is ready
setTimeout(() => {
  initializeAuth();
}, 100); // Reduced delay from 200ms to 100ms for faster initialization

// Listen for auth changes with error handling
supabase.auth.onAuthStateChange(async (event, session) => {
  try {
    console.log('Auth state changed:', event, !!session);
    if (session) {
      await useAuthStore.getState().setSession(session);
    } else {
      // Check if this is due to invalid/expired refresh token
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_OUT') {
        console.log('Session ended or invalid, clearing all auth data');
        await useAuthStore.getState().clearAuth();
      }
      
      // If this is a sign out event, ensure we navigate to language screen
      if (event === 'SIGNED_OUT') {
        console.log('User signed out, should navigate to language screen');
        // The navigation will be handled by the layout based on session state
      }
    }
  } catch (error) {
    console.error('Error in auth state change:', error);
    // Ensure loading state is cleared even on error
    useAuthStore.setState({ loading: false });
  }
});
