import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
// Firebase import removed - using Supabase auth only
import NetInfo from '@react-native-community/netinfo';
import { supabaseConfig, supabaseAuthStorageKey } from '../../config/secrets';
import { ServiceError, ErrorCode } from '../errors';
import { LoggingService } from '../logging/LoggingService';

// Fetch with timeout using AbortController
const fetchWithTimeout = (url: string, options: RequestInit, timeoutMs: number): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timeoutId));
};

const logger = LoggingService.createScope('Supabase');

// Supabase auth storage key
const SUPABASE_AUTH_KEY = supabaseAuthStorageKey;

// Safe storage adapter that wraps AsyncStorage with error handling
// This prevents unhandled exceptions during session restore
const safeStorageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      const value = await AsyncStorage.getItem(key);
      return value ?? null;
    } catch (error) {
      console.error('Supabase: AsyncStorage getItem failed', error);
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      console.error('Supabase: AsyncStorage setItem failed', error);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('Supabase: AsyncStorage removeItem failed', error);
    }
  },
};

// In-memory token cache for fast access (avoids async overhead on every request)
let cachedAccessToken: string | null = null;

// Function to update the cached token (called from index.tsx after refresh)
export const setCachedAccessToken = (token: string | null) => {
  cachedAccessToken = token;
  console.log('Supabase: Access token cache updated');
};

// Function to load token from AsyncStorage into cache
export const loadAccessTokenToCache = async () => {
  try {
    const sessionStr = await AsyncStorage.getItem(SUPABASE_AUTH_KEY);
    if (sessionStr) {
      const sessionData = JSON.parse(sessionStr);
      cachedAccessToken = sessionData?.access_token || null;
      console.log('Supabase: Loaded access token to cache');
    }
  } catch (err) {
    console.warn('Supabase: Error loading token to cache:', err);
  }
};

// Function to refresh token in background (non-blocking)
// Called when app resumes from background to ensure token is fresh
export const refreshTokenInBackground = async (): Promise<boolean> => {
  try {
    const sessionStr = await AsyncStorage.getItem(SUPABASE_AUTH_KEY);
    if (!sessionStr) {
      console.log('Supabase: No session to refresh');
      return false;
    }

    const sessionData = JSON.parse(sessionStr);
    if (!sessionData?.refresh_token) {
      console.log('Supabase: No refresh_token in session');
      return false;
    }

    // Check if token is about to expire (within 5 minutes)
    const expiresAt = sessionData.expires_at;
    const now = Math.floor(Date.now() / 1000);
    const fiveMinutes = 5 * 60;

    if (expiresAt && (expiresAt - now) > fiveMinutes) {
      console.log('Supabase: Token still valid, skipping refresh');
      return true;
    }

    console.log('Supabase: Token expired or expiring soon, refreshing...');

    // Refresh the token (8s timeout)
    const refreshResponse = await fetchWithTimeout(
      `${supabaseConfig.url}/auth/v1/token?grant_type=refresh_token`,
      {
        method: 'POST',
        headers: {
          'apikey': supabaseConfig.anonKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ refresh_token: sessionData.refresh_token })
      },
      8000
    );

    if (refreshResponse.ok) {
      const newSessionData = await refreshResponse.json();
      console.log('Supabase: Background token refresh successful');

      // Store new session
      await AsyncStorage.setItem(SUPABASE_AUTH_KEY, JSON.stringify(newSessionData));

      // Update in-memory cache
      cachedAccessToken = newSessionData.access_token;

      return true;
    } else {
      console.warn('Supabase: Background token refresh failed:', refreshResponse.status);
      return false;
    }
  } catch (err) {
    console.warn('Supabase: Error in background token refresh:', err);
    return false;
  }
};

// Custom fetch that adds auth headers - uses cached token for speed
const customFetch = async (url: RequestInfo | URL, options?: RequestInit): Promise<Response> => {
  // Use cached token first (fast path)
  let token = cachedAccessToken;

  // If no cached token, try to load from AsyncStorage
  if (!token) {
    try {
      const sessionStr = await AsyncStorage.getItem(SUPABASE_AUTH_KEY);
      if (sessionStr) {
        const sessionData = JSON.parse(sessionStr);
        token = sessionData?.access_token || null;
        cachedAccessToken = token; // Cache for next time
      }
    } catch (err) {
      console.warn('Supabase customFetch: Error getting auth token:', err);
    }
  }

  // Add auth header if we have a token
  if (token) {
    const headers = new Headers(options?.headers);
    if (!headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    options = { ...options, headers };
  }

  return fetch(url, options);
};

// Flag to track if session is initialized
let sessionInitialized = false;
let sessionInitPromise: Promise<void> | null = null;

// Use configuration from secrets
// FIX: Using safe storage adapter and proper React Native configuration
// as recommended by Supabase docs to prevent session restore deadlocks
export const supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey, {
  auth: {
    // Use safe storage adapter on mobile platforms
    ...(Platform.OS !== 'web' ? { storage: safeStorageAdapter } : {}),
    autoRefreshToken: true,   // ENABLED - with safe storage this should work
    persistSession: true,     // Keep session in AsyncStorage for login persistence
    detectSessionInUrl: false,
  },
  global: {
    headers: {
      'X-Client-Info': `DukaaOn-App/${Platform.OS}`
    },
    fetch: customFetch,  // Still use customFetch as a backup for auth headers
  }
});

/**
 * Initialize the Supabase session from AsyncStorage.
 * This should be called once when the app starts.
 * It ensures the Supabase client has the session loaded before any queries.
 */
export const initializeSupabaseSession = async (): Promise<boolean> => {
  if (sessionInitialized) {
    console.log('Supabase: Session already initialized');
    return true;
  }

  if (sessionInitPromise) {
    await sessionInitPromise;
    return sessionInitialized;
  }

  sessionInitPromise = (async () => {
    try {
      console.log('Supabase: Initializing session from AsyncStorage...');

      // Load the session from AsyncStorage
      const sessionStr = await AsyncStorage.getItem(SUPABASE_AUTH_KEY);

      if (!sessionStr) {
        console.log('Supabase: No stored session found');
        sessionInitialized = true;
        return;
      }

      const sessionData = JSON.parse(sessionStr);

      if (!sessionData?.access_token || !sessionData?.refresh_token) {
        console.log('Supabase: Invalid session data');
        sessionInitialized = true;
        return;
      }

      // Check if token is expired
      const expiresAt = sessionData.expires_at;
      const now = Math.floor(Date.now() / 1000);

      if (expiresAt && expiresAt < now) {
        console.log('Supabase: Token expired, refreshing...');

        // Refresh the token directly via REST API (10s timeout)
        const refreshResponse = await fetchWithTimeout(
          `${supabaseConfig.url}/auth/v1/token?grant_type=refresh_token`,
          {
            method: 'POST',
            headers: {
              'apikey': supabaseConfig.anonKey,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ refresh_token: sessionData.refresh_token })
          },
          10000
        );

        if (refreshResponse.ok) {
          const newSessionData = await refreshResponse.json();
          console.log('Supabase: Token refreshed successfully');

          // Save new session to AsyncStorage
          await AsyncStorage.setItem(SUPABASE_AUTH_KEY, JSON.stringify(newSessionData));

          // Update cached token - this is what customFetch uses!
          cachedAccessToken = newSessionData.access_token;
          console.log('Supabase: Token cached for customFetch');
          // NOTE: We do NOT call setSession - it hangs on React Native!
          sessionInitialized = true;
        } else {
          console.warn('Supabase: Token refresh failed, user may need to re-login');
          sessionInitialized = true;
        }
      } else {
        // Token still valid, cache it for customFetch
        console.log('Supabase: Token still valid, caching for customFetch...');
        cachedAccessToken = sessionData.access_token;
        console.log('Supabase: Token cached');
        // NOTE: We do NOT call setSession - it hangs on React Native!
        sessionInitialized = true;
      }
    } catch (err) {
      console.error('Supabase: Error initializing session:', err);
      sessionInitialized = true; // Mark as initialized even on error to prevent blocking
    }
  })();

  await sessionInitPromise;
  return sessionInitialized;
};

// Auto-initialize session when this module is loaded
// This runs in the background and doesn't block imports
initializeSupabaseSession().then(() => {
  console.log('Supabase: Background session initialization complete');
});

// Export auth key for direct fetch services
export const SUPABASE_AUTH_KEY_EXPORT = SUPABASE_AUTH_KEY;

/**
 * Reliable query wrapper that uses direct fetch API when Supabase client hangs.
 * This bypasses the session management issues in the Supabase client.
 */
export const reliableQuery = async <T = any>(
  queryFn: () => Promise<{ data: T | null; error: any }>,
  directFetchFn?: () => Promise<{ data: T | null; error: any }>,
  timeoutMs: number = 8000
): Promise<{ data: T | null; error: any }> => {
  try {
    // Try the Supabase client query first with a timeout
    const timeoutPromise = new Promise<{ data: null; error: any }>((_, reject) =>
      setTimeout(() => reject(new Error('Query timeout')), timeoutMs)
    );

    const result = await Promise.race([queryFn(), timeoutPromise]);
    return result;
  } catch (err: any) {
    console.warn('reliableQuery: Supabase client query failed/timed out, trying direct fetch...');

    // If we have a direct fetch fallback, try it
    if (directFetchFn) {
      try {
        return await directFetchFn();
      } catch (directErr: any) {
        console.error('reliableQuery: Direct fetch also failed:', directErr?.message);
        return { data: null, error: { message: directErr?.message || 'Query failed' } };
      }
    }

    return { data: null, error: { message: err?.message || 'Query failed' } };
  }
};

/**
 * Direct fetch helper that can be used when Supabase client hangs.
 * This is a simpler alternative to the reliableQuery wrapper.
 * Now includes automatic token refresh on JWT expiration.
 */
export const directFetch = async <T = any>(
  table: string,
  options: {
    select?: string;
    eq?: Record<string, any>;
    in?: Record<string, any[]>;
    order?: { column: string; ascending?: boolean };
    limit?: number;
  } = {},
  retryCount: number = 0
): Promise<{ data: T[] | null; error: any }> => {
  try {
    // Get access token
    let token = cachedAccessToken;
    if (!token) {
      const sessionStr = await AsyncStorage.getItem(SUPABASE_AUTH_KEY);
      if (sessionStr) {
        const sessionData = JSON.parse(sessionStr);
        token = sessionData?.access_token || null;
        cachedAccessToken = token;
      }
    }

    if (!token) {
      return { data: null, error: { message: 'No access token' } };
    }

    // Build URL
    let url = `${supabaseConfig.url}/rest/v1/${table}`;
    const params: string[] = [];

    if (options.select) {
      params.push(`select=${encodeURIComponent(options.select)}`);
    }

    if (options.eq) {
      Object.entries(options.eq).forEach(([key, value]) => {
        params.push(`${key}=eq.${encodeURIComponent(String(value))}`);
      });
    }

    if (options.in) {
      Object.entries(options.in).forEach(([key, values]) => {
        params.push(`${key}=in.(${values.map(v => encodeURIComponent(String(v))).join(',')})`);
      });
    }

    if (options.order) {
      params.push(`order=${options.order.column}.${options.order.ascending ? 'asc' : 'desc'}`);
    }

    if (options.limit) {
      params.push(`limit=${options.limit}`);
    }

    if (params.length > 0) {
      url += '?' + params.join('&');
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();

      // Check for JWT expired error
      if ((response.status === 401 || errorText.includes('JWT expired') || errorText.includes('PGRST301')) && retryCount === 0) {
        console.log('[directFetch] JWT expired, attempting token refresh...');

        // Clear cached token
        cachedAccessToken = null;

        // Try to refresh session
        try {
          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();

          if (refreshError) {
            console.error('[directFetch] Session refresh failed:', refreshError.message);
            return { data: null, error: { message: 'Session expired. Please log in again.', code: 'JWT_EXPIRED' } };
          }

          if (refreshData?.session) {
            // Update cached token
            cachedAccessToken = refreshData.session.access_token;
            console.log('[directFetch] Session refreshed successfully, retrying request...');

            // Retry the request with new token
            return directFetch<T>(table, options, retryCount + 1);
          }
        } catch (refreshErr) {
          console.error('[directFetch] Error during session refresh:', refreshErr);
        }

        return { data: null, error: { message: 'Session expired. Please log in again.', code: 'JWT_EXPIRED' } };
      }

      return { data: null, error: { message: errorText, status: response.status } };
    }

    const data = await response.json();
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: { message: err?.message || 'Fetch failed' } };
  }
};

// Firebase auth integration removed - using Supabase auth only
// All authentication is now handled through Supabase Auth hooks

// Helper function to make authenticated requests with Supabase session
export const authenticatedRequest = async (requestFn: Function) => {
  try {
    // Get current Supabase session
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
      logger.error('Error getting Supabase session', error);
      throw new ServiceError({
        code: ErrorCode.AUTH_SESSION_EXPIRED,
        message: `Session error: ${error.message}`,
        originalError: error,
        context: { service: 'supabase', operation: 'authenticatedRequest' },
      });
    }

    if (!session) {
      throw new ServiceError({
        code: ErrorCode.AUTH_NOT_AUTHENTICATED,
        message: 'No active Supabase session found',
        userMessage: 'Please log in to continue.',
        context: { service: 'supabase', operation: 'authenticatedRequest' },
      });
    }

    // Execute the request function with active session
    return await requestFn();
  } catch (error) {
    if (ServiceError.isServiceError(error)) {
      throw error;
    }
    throw ServiceError.fromUnknown(error, {
      code: ErrorCode.NETWORK_REQUEST_FAILED,
      context: { service: 'supabase', operation: 'authenticatedRequest' },
    });
  }
};

// Add helpers for standard storage operations
export const storage = {
  // Get URL for a file in the profiles bucket
  getProfileImageUrl: (userId: string) => {
    return supabase.storage.from('profiles').getPublicUrl(`${userId}/profile_latest.jpg`).data.publicUrl;
  },

  // Build a full path for a profile image
  buildProfilePath: (userId: string) => {
    return `${userId}/profile_${Date.now()}.jpg`;
  },

  // Build a full path for a product image
  buildProductPath: (userId: string, productId?: string) => {
    const fileName = productId ? `${productId}_${Date.now()}.jpg` : `${Date.now()}.jpg`;
    return `${userId}/${fileName}`;
  },

  // Get URL for an ID image in the id_verification bucket
  getIdImageUrl: (userId: string, idType: string) => {
    return supabase.storage.from('id_verification').getPublicUrl(`${userId}/${idType}_latest.jpg`).data.publicUrl;
  },

  // Build a full path for an ID image
  buildIdPath: (userId: string, idType: string) => {
    return `${userId}/${idType}_${Date.now()}.jpg`;
  }
};

// Helper function to convert image URI to base64
const getBase64FromURI = async (uri: string): Promise<string> => {
  const response = await fetch(uri);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64data = reader.result as string;
      // Extract base64 data part (remove data:image/jpeg;base64, prefix)
      const base64EncodedData = base64data.split(',')[1];
      resolve(base64EncodedData);
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(blob);
  });
};

/**
 * Uploads a product image to storage
 * @param userId The user ID
 * @param imageUri The image URI
 * @param productId Optional product ID
 * @param base64Data Optional base64 data (if already converted)
 * @returns Upload result with success status and public URL
 */
export const uploadProductImage = async (
  userId: string,
  imageUri: string,
  productId: string | null = null,
  base64Data: string | null = null
): Promise<{ success: boolean; publicUrl: string | null; error: string | null }> => {
  try {
    if ((!imageUri || typeof imageUri !== 'string') && !base64Data) {
      return { success: false, publicUrl: null, error: 'Invalid image URI or base64 data provided' };
    }

    const mimeType = 'image/jpeg';
    const filePath = storage.buildProductPath(userId, productId || undefined);

    let base64EncodedData: string;

    if (base64Data) {
      base64EncodedData = base64Data;
    } else {
      base64EncodedData = await getBase64FromURI(imageUri);
    }

    const { decode } = require('base64-arraybuffer');

    const { data, error } = await supabase.storage
      .from('product-images')
      .upload(filePath, decode(base64EncodedData), {
        contentType: mimeType,
        upsert: true,
      });

    if (error) {
      throw new ServiceError({
        code: ErrorCode.STORAGE_UPLOAD_FAILED,
        message: `Storage upload failed: ${error.message}`,
        originalError: error,
        context: { service: 'supabase', operation: 'uploadProductImage', userId, productId },
      });
    }

    const fileName = filePath.split('/').pop() || '';
    const publicUrl = supabase.storage.from('product-images').getPublicUrl(`${userId}/${fileName}`).data.publicUrl;

    return { success: true, publicUrl, error: null };
  } catch (error: unknown) {
    const serviceError = ServiceError.fromUnknown(error, {
      code: ErrorCode.STORAGE_UPLOAD_FAILED,
      context: { service: 'supabase', operation: 'uploadProductImage', userId },
    });
    return { success: false, publicUrl: null, error: serviceError.userMessage };
  }
};

/**
 * Get detailed order information by ID
 * @param orderId The order ID
 * @returns Order details or null
 */
export const getOrderById = async (orderId: string): Promise<any | null> => {
  try {
    const { data: order, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (error) {
      logger.warn('Failed to fetch order', { orderId, error: error.message });
      return null;
    }

    if (!order) {
      return null;
    }

    // Process the order data
    const processedOrder = {
      ...order,
      id: order.id,
      orderNumber: order.order_number,
      status: order.status,
      timestamp: order.created_at,
      paymentStatus: order.payment_status,
    };

    // Parse and format delivery address
    if (order.delivery_address) {
      try {
        let deliveryAddr = order.delivery_address;
        if (typeof deliveryAddr === 'string') {
          try {
            deliveryAddr = JSON.parse(deliveryAddr);
          } catch (e) {
            // Keep as string if not valid JSON
          }
        }

        processedOrder.retailer = {
          name: order.retailer_name || 'Customer',
          address: typeof deliveryAddr === 'string' ? deliveryAddr : formatAddress(deliveryAddr),
          location: order.retailer_location,
          latitude: deliveryAddr?.latitude,
          longitude: deliveryAddr?.longitude
        };
      } catch (e) {
        processedOrder.retailer = {
          name: 'Customer',
          address: 'Address unavailable'
        };
      }
    } else {
      processedOrder.retailer = {
        name: 'Customer',
        address: 'Address unavailable'
      };
    }

    // Fetch seller details - try multiple strategies
    let sellerFetched = false;

    // Helper function to get phone from profiles
    const getSellerPhone = async (sellerId: string): Promise<string | undefined> => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('phone_number')
          .eq('id', sellerId)
          .single();
        return data?.phone_number;
      } catch {
        return undefined;
      }
    };

    // Strategy 1: Use seller_id directly if it exists
    if (order.seller_id) {
      logger.debug('Fetching seller using order.seller_id', { sellerId: order.seller_id });
      try {
        const { data: sellerData, error: sellerError } = await supabase
          .from('seller_details')
          .select('business_name, address')
          .eq('user_id', order.seller_id)
          .single();

        if (sellerError) {
          logger.warn('Error fetching seller details', { sellerId: order.seller_id, error: sellerError.message });
        } else if (sellerData) {
          const phone = await getSellerPhone(order.seller_id);
          processedOrder.seller = {
            id: order.seller_id,
            name: sellerData.business_name || 'Unknown Seller',
            address: typeof sellerData.address === 'string'
              ? sellerData.address
              : formatAddress(sellerData.address),
            phone
          };
          sellerFetched = true;
          logger.debug('Seller details fetched successfully', { seller: processedOrder.seller });
        }
      } catch (sellerError) {
        logger.warn('Exception fetching seller details', { sellerId: order.seller_id, error: sellerError });
      }
    }

    // Strategy 2: Check items for seller_id if not found above
    if (!sellerFetched && Array.isArray(order.items) && order.items.length > 0) {
      // Get unique seller IDs from items - check multiple possible field names
      const sellerIds = [...new Set(order.items.map((item: any) =>
        item.seller_id || item.sellerId || item.seller?.id
      ).filter(Boolean))];

      logger.debug('Looking for seller IDs in items', { sellerIds, itemCount: order.items.length });

      if (sellerIds.length > 0) {
        try {
          const { data: sellers, error: sellersError } = await supabase
            .from('seller_details')
            .select('user_id, business_name, address')
            .in('user_id', sellerIds as string[]);

          if (sellersError) {
            logger.warn('Error fetching sellers from items', { sellerIds, error: sellersError.message });
          } else if (sellers && sellers.length > 0) {
            const primarySeller = sellers[0];
            const phone = await getSellerPhone(primarySeller.user_id);
            processedOrder.seller = {
              id: primarySeller.user_id,
              name: primarySeller.business_name || 'Unknown Seller',
              address: typeof primarySeller.address === 'string'
                ? primarySeller.address
                : formatAddress(primarySeller.address),
              phone
            };
            sellerFetched = true;
            logger.debug('Seller details fetched from items', { seller: processedOrder.seller });

            if (sellers.length > 1) {
              processedOrder.multipleSellers = true;
              processedOrder.allSellers = await Promise.all(sellers.map(async s => ({
                id: s.user_id,
                name: s.business_name || 'Unknown Seller',
                address: typeof s.address === 'string' ? s.address : formatAddress(s.address),
                phone: await getSellerPhone(s.user_id)
              })));
            }
          }
        } catch (sellerError) {
          logger.warn('Exception fetching sellers from items', { sellerIds, error: sellerError });
        }
      }
    }

    // Strategy 3: If still no seller, try to get seller from wholesaler_id or similar fields
    if (!sellerFetched) {
      const possibleSellerIds = [
        order.wholesaler_id,
        order.vendor_id,
        order.shop_id
      ].filter(Boolean);

      for (const sellerId of possibleSellerIds) {
        if (sellerFetched) break;
        logger.debug('Trying alternative seller ID', { sellerId });

        try {
          const { data: sellerData } = await supabase
            .from('seller_details')
            .select('user_id, business_name, address')
            .eq('user_id', sellerId)
            .single();

          if (sellerData) {
            const phone = await getSellerPhone(sellerData.user_id);
            processedOrder.seller = {
              id: sellerData.user_id,
              name: sellerData.business_name || 'Unknown Seller',
              address: typeof sellerData.address === 'string'
                ? sellerData.address
                : formatAddress(sellerData.address),
              phone
            };
            sellerFetched = true;
            logger.debug('Seller details fetched using alternative ID', { seller: processedOrder.seller });
          }
        } catch (e) {
          logger.debug('Alternative seller ID not found', { sellerId });
        }
      }
    }

    if (!sellerFetched) {
      logger.info('No seller details found for order', { orderId, seller_id: order.seller_id });
    }

    return processedOrder;
  } catch (error) {
    logger.error('Exception in processing order', error, { orderId });
    return null;
  }
};

// Helper function to format address from JSON to string
const formatAddress = (addressObj: any): string => {
  try {
    if (!addressObj) return 'Address unavailable';
    if (typeof addressObj === 'string') return addressObj;

    const parts: string[] = [];

    if (addressObj.street) parts.push(addressObj.street);
    if (addressObj.line1) parts.push(addressObj.line1);
    if (addressObj.line2) parts.push(addressObj.line2);
    if (addressObj.area) parts.push(addressObj.area);
    if (addressObj.landmark) parts.push(addressObj.landmark);
    if (addressObj.city) parts.push(addressObj.city);
    if (addressObj.state) parts.push(addressObj.state);
    if (addressObj.pincode || addressObj.zip || addressObj.postal_code) {
      parts.push(addressObj.pincode || addressObj.zip || addressObj.postal_code);
    }

    if (parts.length === 0) {
      if (addressObj.address) return typeof addressObj.address === 'string' ? addressObj.address : 'Address unavailable';
      if (addressObj.formatted_address) return addressObj.formatted_address;
      if (addressObj.full_address) return addressObj.full_address;
    }

    return parts.join(', ') || 'Address unavailable';
  } catch (e) {
    return 'Address unavailable';
  }
};

// Function to test Supabase connectivity
export const validateSupabaseConnection = async (): Promise<{
  success: boolean;
  message: string;
  serverTime?: string;
}> => {
  try {
    // First check internet connectivity
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      return {
        success: false,
        message: 'No internet connection. Please check your network settings.'
      };
    }

    // Perform a simple query to test database connectivity
    logger.debug('Testing Supabase connectivity...');
    const startTime = Date.now();

    const { data, error } = await supabase
      .from('_connectivity_test')
      .select('*')
      .limit(1)
      .maybeSingle();

    // If the table doesn't exist, we'll get an error but the connection worked
    if (error && error.code === '42P01') { // "undefined_table" PostgreSQL error
      const pingTime = Date.now() - startTime;
      return {
        success: true,
        message: `Connected to Supabase (${pingTime}ms), but test table doesn't exist`,
        serverTime: new Date().toISOString()
      };
    }

    if (error) {
      logger.warn('Supabase connection test error', { error: error.message });
      return {
        success: false,
        message: `Database error: ${error.message}`
      };
    }

    const pingTime = Date.now() - startTime;
    return {
      success: true,
      message: `Successfully connected to Supabase (${pingTime}ms)`,
      serverTime: data?.server_time || new Date().toISOString()
    };

  } catch (error: unknown) {
    const serviceError = ServiceError.fromUnknown(error, {
      code: ErrorCode.NETWORK_OFFLINE,
      context: { service: 'supabase', operation: 'validateSupabaseConnection' },
    });
    logger.error('Failed to validate Supabase connection', error);
    return {
      success: false,
      message: serviceError.userMessage
    };
  }
};