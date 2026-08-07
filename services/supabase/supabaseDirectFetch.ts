/**
 * Supabase Direct Fetch Service
 * 
 * This service provides direct fetch API calls to Supabase REST API,
 * bypassing the Supabase client which can hang due to session issues.
 * 
 * Use this when the Supabase client queries hang.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabaseConfig } from '../../config/secrets';

// Get the auth key dynamically
const getSupabaseAuthKey = () => {
    return `sb-${supabaseConfig.url.split('//')[1].split('.')[0]}-auth-token`;
};

// Get access token from AsyncStorage
export const getAccessToken = async (): Promise<string | null> => {
    try {
        const sessionStr = await AsyncStorage.getItem(getSupabaseAuthKey());
        if (sessionStr) {
            const sessionData = JSON.parse(sessionStr);
            return sessionData?.access_token || null;
        }
        return null;
    } catch (err) {
        console.warn('supabaseDirectFetch: Error getting access token:', err);
        return null;
    }
};

// Build headers for Supabase requests
const buildHeaders = (accessToken: string): HeadersInit => ({
    'apikey': supabaseConfig.anonKey,
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
});

// Interface for query options
interface QueryOptions {
    select?: string;
    eq?: Record<string, any>;
    in?: Record<string, any[]>;
    order?: { column: string; ascending?: boolean };
    limit?: number;
    single?: boolean;
}

// Build URL with query parameters
const buildUrl = (table: string, options: QueryOptions): string => {
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

    return url;
};

// Main fetch function for SELECT queries
export const directSelect = async <T = any>(
    table: string,
    options: QueryOptions = {}
): Promise<{ data: T[] | null; error: any }> => {
    try {
        const accessToken = await getAccessToken();

        if (!accessToken) {
            console.warn('directSelect: No access token available');
            return { data: null, error: { message: 'No access token' } };
        }

        const url = buildUrl(table, options);
        console.log(`directSelect: Fetching from ${table}...`);

        const response = await fetch(url, {
            method: 'GET',
            headers: buildHeaders(accessToken)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`directSelect: Error from ${table}:`, response.status, errorText);
            return { data: null, error: { message: errorText, status: response.status } };
        }

        const data = await response.json();
        console.log(`directSelect: Got ${data?.length || 0} rows from ${table}`);

        if (options.single && data && data.length > 0) {
            return { data: data[0], error: null };
        }

        return { data, error: null };
    } catch (err: any) {
        console.error(`directSelect: Exception for ${table}:`, err?.message);
        return { data: null, error: { message: err?.message || 'Unknown error' } };
    }
};

// Function for INSERT queries
export const directInsert = async <T = any>(
    table: string,
    data: Record<string, any> | Record<string, any>[]
): Promise<{ data: T | null; error: any }> => {
    try {
        const accessToken = await getAccessToken();

        if (!accessToken) {
            console.warn('directInsert: No access token available');
            return { data: null, error: { message: 'No access token' } };
        }

        const url = `${supabaseConfig.url}/rest/v1/${table}`;
        console.log(`directInsert: Inserting into ${table}...`);

        const response = await fetch(url, {
            method: 'POST',
            headers: buildHeaders(accessToken),
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`directInsert: Error for ${table}:`, response.status, errorText);
            return { data: null, error: { message: errorText, status: response.status } };
        }

        const result = await response.json();
        console.log(`directInsert: Success for ${table}`);
        return { data: result, error: null };
    } catch (err: any) {
        console.error(`directInsert: Exception for ${table}:`, err?.message);
        return { data: null, error: { message: err?.message || 'Unknown error' } };
    }
};

// Function for UPDATE queries
export const directUpdate = async <T = any>(
    table: string,
    data: Record<string, any>,
    match: Record<string, any>
): Promise<{ data: T | null; error: any }> => {
    try {
        const accessToken = await getAccessToken();

        if (!accessToken) {
            console.warn('directUpdate: No access token available');
            return { data: null, error: { message: 'No access token' } };
        }

        // Build URL with match conditions
        let url = `${supabaseConfig.url}/rest/v1/${table}`;
        const params: string[] = [];
        Object.entries(match).forEach(([key, value]) => {
            params.push(`${key}=eq.${encodeURIComponent(String(value))}`);
        });
        if (params.length > 0) {
            url += '?' + params.join('&');
        }

        console.log(`directUpdate: Updating ${table}...`);

        const response = await fetch(url, {
            method: 'PATCH',
            headers: buildHeaders(accessToken),
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`directUpdate: Error for ${table}:`, response.status, errorText);
            return { data: null, error: { message: errorText, status: response.status } };
        }

        const result = await response.json();
        console.log(`directUpdate: Success for ${table}`);
        return { data: result, error: null };
    } catch (err: any) {
        console.error(`directUpdate: Exception for ${table}:`, err?.message);
        return { data: null, error: { message: err?.message || 'Unknown error' } };
    }
};

// Function for DELETE queries
export const directDelete = async (
    table: string,
    match: Record<string, any>
): Promise<{ error: any }> => {
    try {
        const accessToken = await getAccessToken();

        if (!accessToken) {
            console.warn('directDelete: No access token available');
            return { error: { message: 'No access token' } };
        }

        // Build URL with match conditions
        let url = `${supabaseConfig.url}/rest/v1/${table}`;
        const params: string[] = [];
        Object.entries(match).forEach(([key, value]) => {
            params.push(`${key}=eq.${encodeURIComponent(String(value))}`);
        });
        if (params.length > 0) {
            url += '?' + params.join('&');
        }

        console.log(`directDelete: Deleting from ${table}...`);

        const response = await fetch(url, {
            method: 'DELETE',
            headers: buildHeaders(accessToken)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`directDelete: Error for ${table}:`, response.status, errorText);
            return { error: { message: errorText, status: response.status } };
        }

        console.log(`directDelete: Success for ${table}`);
        return { error: null };
    } catch (err: any) {
        console.error(`directDelete: Exception for ${table}:`, err?.message);
        return { error: { message: err?.message || 'Unknown error' } };
    }
};

// Function for RPC calls
export const directRpc = async <T = any>(
    functionName: string,
    params: Record<string, any> = {}
): Promise<{ data: T | null; error: any }> => {
    try {
        const accessToken = await getAccessToken();

        if (!accessToken) {
            console.warn('directRpc: No access token available');
            return { data: null, error: { message: 'No access token' } };
        }

        const url = `${supabaseConfig.url}/rest/v1/rpc/${functionName}`;
        console.log(`directRpc: Calling ${functionName}...`);

        const response = await fetch(url, {
            method: 'POST',
            headers: buildHeaders(accessToken),
            body: JSON.stringify(params)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`directRpc: Error for ${functionName}:`, response.status, errorText);
            return { data: null, error: { message: errorText, status: response.status } };
        }

        const result = await response.json();
        console.log(`directRpc: Success for ${functionName}`);
        return { data: result, error: null };
    } catch (err: any) {
        console.error(`directRpc: Exception for ${functionName}:`, err?.message);
        return { data: null, error: { message: err?.message || 'Unknown error' } };
    }
};
