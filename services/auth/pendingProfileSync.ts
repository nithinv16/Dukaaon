/**
 * Functions to synchronize pending profiles with Supabase
 * when network connectivity is restored
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, validateSupabaseConnection } from '../supabase/supabase';
import { useAuthStore } from '../../store/auth';

/**
 * Checks for pending profile data and synchronizes with Supabase if found
 * @returns Promise<boolean> true if a profile was synced, false otherwise
 */
export const syncPendingProfile = async (): Promise<boolean> => {
  try {
    // Check if we have pending profile data
    const pendingUserId = await AsyncStorage.getItem('pending_user_id');
    const pendingPhone = await AsyncStorage.getItem('pending_phone');
    const pendingRole = await AsyncStorage.getItem('pending_role');
    
    // If no pending data, return early
    if (!pendingUserId || !pendingPhone) {
      return false;
    }
    
    console.log('Found pending profile data, attempting to sync...');
    
    // Check if we have connection to Supabase
    const connectionStatus = await validateSupabaseConnection();
    if (!connectionStatus.success) {
      console.log('Cannot sync pending profile: No database connection');
      return false;
    }
    
    // Normalize role to valid type
    const role = (pendingRole || 'retailer') as 'retailer' | 'seller' | 'wholesaler' | 'manufacturer';
    
    // First try to use the RPC function
    try {
      console.log('Attempting to sync pending profile using RPC...');
      const { data: linkResult, error: linkError } = await supabase.rpc(
        'link_user_to_profile',
        {
          user_id: pendingUserId,
          phone_number: pendingPhone.replace('+91', ''),
          user_role: role
        }
      );
      
      if (!linkError && linkResult?.profile) {
        console.log('Successfully synced pending profile using RPC');
        
        // Store profile ID and cleanup pending data
        await AsyncStorage.setItem('profile_id', linkResult.profile.id);
        await AsyncStorage.removeItem('pending_user_id');
        await AsyncStorage.removeItem('pending_phone');
        await AsyncStorage.removeItem('pending_role');
        
        // Set user in app state
        useAuthStore.getState().setUser(linkResult.profile);
        
        return true;
      }
      
      // If RPC failed, fall back to direct insertion
      console.warn('RPC sync failed, falling back to direct insertion');
    } catch (rpcError) {
      console.error('Error in RPC sync:', rpcError);
    }
    
    // Direct insertion fallback
    try {
      console.log('Creating profile directly...');
      
      const { data: newProfile, error: insertError } = await supabase
        .from('profiles')
        .insert({
          user_id: pendingUserId,
          phone_number: pendingPhone,
          role: role,
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
        
      if (insertError) {
        console.error('Error creating profile directly:', insertError);
        return false;
      }
      
      console.log('Successfully created profile directly:', newProfile);
      
      // Store profile ID and cleanup pending data
      await AsyncStorage.setItem('profile_id', newProfile.id);
      await AsyncStorage.removeItem('pending_user_id');
      await AsyncStorage.removeItem('pending_phone');
      await AsyncStorage.removeItem('pending_role');
      
      // Set user in app state
      useAuthStore.getState().setUser(newProfile);
      
      return true;
    } catch (directError) {
      console.error('All profile creation methods failed:', directError);
      return false;
    }
    
  } catch (error) {
    console.error('Error in syncPendingProfile:', error);
    return false;
  }
};