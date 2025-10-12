/**
 * Utility to help manually link existing profiles by phone number to Firebase users
 * This script can be executed from anywhere in the app to force link a profile
 */

// Firebase imports removed - now using Supabase-only authentication
import { supabase } from '../supabase/supabase';
import { Alert } from 'react-native';

/**
 * Finds an existing profile by phone number and attempts to link it to the current Firebase user
 * @param {string} phoneNumber - The phone number to search for (must match the format in the database)
 * @returns {Promise<boolean>} - Whether the linking was successful
 */
export const findAndLinkProfileByPhone = async (phoneNumber: string): Promise<boolean> => {
  try {
    const { data: { user: supabaseUser } } = await supabase.auth.getUser();
    if (!supabaseUser) {
      Alert.alert('Error', 'No user is logged in');
      return false;
    }

    console.log(`Attempting to find and link profile with phone number: ${phoneNumber}`);
    
    // First check if profile is already linked
    const { data: existingLinkedProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', supabaseUser.id)
      .maybeSingle();
      
    if (existingLinkedProfile) {
      Alert.alert('Already Linked', 
        `Your account is already linked to profile ID: ${existingLinkedProfile.id}\n` +
        `Phone: ${existingLinkedProfile.phone_number}`
      );
      return true;
    }
    
    // Try to find profile by phone number
    const { data: profileByPhone } = await supabase
      .from('profiles')
      .select('*')
      .eq('phone_number', phoneNumber)
      .maybeSingle();
      
    if (!profileByPhone) {
      Alert.alert('Not Found', 
        `No profile found with phone number: ${phoneNumber}\n` +
        `Please check the number and try again.`
      );
      return false;
    }
    
    // Link profile using direct update first (may fail due to RLS)
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ user_id: supabaseUser.id })
        .eq('id', profileByPhone.id);
        
      if (!updateError) {
        Alert.alert('Success', 'Profile linked successfully!');
        return true;
      }
    } catch (error) {
      console.error('Direct update failed:', error);
    }
    
    // Try RPC as fallback
    try {
      const { data: rpcResult, error: rpcError } = await supabase.rpc('link_user_profile', {
        profile_id: profileByPhone.id,
        user_id: supabaseUser.id
      });
      
      if (rpcError) {
        console.error('RPC error:', rpcError);
        Alert.alert('Error', `Failed to link profile: ${rpcError.message}`);
        return false;
      }
      
      Alert.alert('Success', 'Profile linked successfully using RPC!');
      return true;
    } catch (error) {
      console.error('RPC error:', error);
      Alert.alert('Error', `Failed to link profile: ${error.message}`);
      return false;
    }
  } catch (error) {
    console.error('Error in findAndLinkProfileByPhone:', error);
    Alert.alert('Error', `Failed to link profile: ${error.message}`);
    return false;
  }
};

/**
 * Manually creates an RPC to link a profile by ID directly
 * Use this as a last resort when other methods fail
 */
export const forceProfileLinkById = async (profileId: string): Promise<boolean> => {
  try {
    const { data: { user: supabaseUser } } = await supabase.auth.getUser();
    if (!supabaseUser) {
      Alert.alert('Error', 'No user is logged in');
      return false;
    }
    
    console.log(`Force linking profile ID ${profileId} to Supabase user ID ${supabaseUser.id}`);
    
    // Try RPC as it's more likely to succeed
    const { data: rpcResult, error: rpcError } = await supabase.rpc('link_user_profile', {
      profile_id: profileId,
      user_id: supabaseUser.id
    });
    
    if (rpcError) {
      console.error('RPC error:', rpcError);
      
      // Try direct update as fallback
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ user_id: supabaseUser.id })
        .eq('id', profileId);
        
      if (updateError) {
        console.error('Direct update failed:', updateError);
        Alert.alert('Error', `Failed to link profile: ${updateError.message}`);
        return false;
      }
    }
    
    Alert.alert('Success', 'Profile linked successfully!');
    return true;
  } catch (error) {
    console.error('Error in forceProfileLinkById:', error);
    Alert.alert('Error', `Failed to link profile: ${error.message}`);
    return false;
  }
};

/**
 * Checks if a profile has all required fields
 * This is useful for identifying incomplete profiles that might be causing issues
 */
export const checkProfileCompleteness = async (profileId?: string): Promise<void> => {
  try {
    const { data: { user: supabaseUser } } = await supabase.auth.getUser();
    if (!supabaseUser && !profileId) {
      Alert.alert('Error', 'No user is logged in and no profile ID provided');
      return;
    }
    
    let profile;
    
    if (profileId) {
      // Try to get profile by specific ID
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', profileId)
        .maybeSingle();
        
      if (error) {
        console.error('Error fetching profile by ID:', error);
        Alert.alert('Error', `Failed to fetch profile: ${error.message}`);
        return;
      }
      
      profile = data;
    } else if (supabaseUser) {
      // Try to get profile by user_id
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', supabaseUser.id)
        .maybeSingle();
        
      if (error) {
        console.error('Error fetching profile by user_id:', error);
        Alert.alert('Error', `Failed to fetch profile: ${error.message}`);
        return;
      }
      
      profile = data;
    }
    
    if (!profile) {
      Alert.alert('Not Found', 'No profile found with the provided criteria');
      return;
    }
    
    // Check for required fields
    const missingFields = [];
    
    if (!profile.phone_number) missingFields.push('phone_number');
    if (!profile.role) missingFields.push('role');
    if (!profile.user_id) missingFields.push('user_id');
    
    // Check business_details structure
    if (!profile.business_details) {
      missingFields.push('business_details');
    } else {
      if (!profile.business_details.shopName) missingFields.push('business_details.shopName');
      if (!profile.business_details.address) missingFields.push('business_details.address');
    }
    
    // Show results
    if (missingFields.length === 0) {
      Alert.alert(
        'Profile Complete',
        `Profile ID: ${profile.id}\nAll required fields are present.`,
        [
          {
            text: 'Force Link',
            onPress: () => forceProfileLinkById(profile.id)
          },
          { text: 'OK' }
        ]
      );
    } else {
      Alert.alert(
        'Incomplete Profile',
        `Profile ID: ${profile.id}\nMissing fields: ${missingFields.join(', ')}`,
        [
          {
            text: 'Update Fields',
            onPress: () => updateMissingFields(profile.id, missingFields)
          },
          {
            text: 'Force Link Anyway',
            onPress: () => forceProfileLinkById(profile.id)
          },
          { text: 'Cancel' }
        ]
      );
    }
  } catch (error) {
    console.error('Error in checkProfileCompleteness:', error);
    Alert.alert('Error', `Failed to check profile: ${error.message}`);
  }
};

/**
 * Updates missing fields in a profile
 */
const updateMissingFields = async (profileId: string, missingFields: string[]): Promise<void> => {
  try {
    const { data: { user: supabaseUser } } = await supabase.auth.getUser();
    if (!supabaseUser) {
      Alert.alert('Error', 'No user is logged in');
      return;
    }
    
    const updates: any = {};
    
    // Add missing fields with reasonable defaults
    if (missingFields.includes('user_id')) {
      updates.user_id = supabaseUser.id;
    }
    
    if (missingFields.includes('phone_number') && supabaseUser.phone) {
      updates.phone_number = supabaseUser.phone;
    }
    
    if (missingFields.includes('role')) {
      updates.role = 'retailer'; // Default role
    }
    
    // Handle nested business_details
    if (missingFields.some(field => field.startsWith('business_details'))) {
      // Get existing business_details or create new object
      const { data } = await supabase
        .from('profiles')
        .select('business_details')
        .eq('id', profileId)
        .single();
        
      const businessDetails = data?.business_details || {};
      
      if (missingFields.includes('business_details.shopName')) {
        businessDetails.shopName = 'My Shop'; // Default shop name
      }
      
      if (missingFields.includes('business_details.address')) {
        businessDetails.address = {
          street: '',
          city: '',
          state: '',
          pincode: ''
        };
      }
      
      updates.business_details = businessDetails;
    }
    
    // Update the profile
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', profileId);
      
    if (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', `Failed to update profile: ${error.message}`);
      return;
    }
    
    Alert.alert('Success', 'Profile updated successfully!');
    
  } catch (error) {
    console.error('Error in updateMissingFields:', error);
    Alert.alert('Error', `Failed to update profile: ${error.message}`);
  }
};

/**
 * Shows a dialog with profile linking options
 */
export const showProfileLinkingDialog = (): void => {
  Alert.alert(
    'Link Existing Profile',
    'Choose a linking method:',
    [
      {
        text: 'Link by Phone',
        onPress: () => {
          Alert.prompt(
            'Enter Phone Number',
            'Enter the phone number associated with your profile',
            [
              {
                text: 'Cancel',
                style: 'cancel'
              },
              {
                text: 'Link',
                onPress: (phoneNumber) => findAndLinkProfileByPhone(phoneNumber)
              }
            ]
          );
        }
      },
      {
        text: 'Link by ID',
        onPress: () => {
          Alert.prompt(
            'Enter Profile ID',
            'Enter your exact profile ID',
            [
              {
                text: 'Cancel',
                style: 'cancel'
              },
              {
                text: 'Link',
                onPress: (profileId) => forceProfileLinkById(profileId)
              }
            ]
          );
        }
      },
      {
        text: 'Check Profile',
        onPress: () => {
          Alert.prompt(
            'Enter Profile ID',
            'Enter the profile ID to check (leave empty to use current user)',
            [
              {
                text: 'Cancel',
                style: 'cancel'
              },
              {
                text: 'Check',
                onPress: (profileId) => checkProfileCompleteness(profileId || undefined)
              }
            ]
          );
        }
      },
      {
        text: 'Cancel',
        style: 'cancel'
      }
    ]
  );
};
 