import { create } from 'zustand';
import { supabase } from '../services/supabase/supabase';

interface UpiConfig {
  upi_id: string;
  merchant_name: string;
  description?: string;
}

interface BankConfig {
  account_number: string;
  ifsc_code: string;
  bank_name: string;
  account_holder_name: string;
  description?: string;
}

interface PaymentConfigState {
  upiConfig: UpiConfig | null;
  bankConfig: BankConfig | null;
  loading: boolean;
  error: string | null;
  fetchUpiConfig: () => Promise<void>;
  fetchBankConfig: () => Promise<void>;
  updateUpiConfig: (config: UpiConfig) => Promise<void>;
  updateBankConfig: (config: BankConfig) => Promise<void>;
}

export const usePaymentConfigStore = create<PaymentConfigState>((set, get) => ({
  upiConfig: null,
  bankConfig: null,
  loading: false,
  error: null,

  fetchUpiConfig: async () => {
    try {
      set({ loading: true, error: null });
      
      const { data, error } = await supabase.rpc('get_payment_config', {
        p_config_type: 'upi'
      });

      if (error) throw error;

      if (data.success) {
        set({ 
          upiConfig: data.data,
          loading: false 
        });
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Error fetching UPI config:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch UPI configuration',
        loading: false 
      });
    }
  },

  fetchBankConfig: async () => {
    try {
      set({ loading: true, error: null });
      
      const { data, error } = await supabase.rpc('get_payment_config', {
        p_config_type: 'bank_account'
      });

      if (error) throw error;

      if (data.success) {
        set({ 
          bankConfig: data.data,
          loading: false 
        });
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Error fetching bank config:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch bank configuration',
        loading: false 
      });
    }
  },

  updateUpiConfig: async (config: UpiConfig) => {
    try {
      set({ loading: true, error: null });
      
      const { data, error } = await supabase.rpc('update_payment_config', {
        p_config_type: 'upi',
        p_config_data: config
      });

      if (error) throw error;

      if (data.success) {
        set({ 
          upiConfig: config,
          loading: false 
        });
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Error updating UPI config:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Failed to update UPI configuration',
        loading: false 
      });
      throw error;
    }
  },

  updateBankConfig: async (config: BankConfig) => {
    try {
      set({ loading: true, error: null });
      
      const { data, error } = await supabase.rpc('update_payment_config', {
        p_config_type: 'bank_account',
        p_config_data: config
      });

      if (error) throw error;

      if (data.success) {
        set({ 
          bankConfig: config,
          loading: false 
        });
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Error updating bank config:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Failed to update bank configuration',
        loading: false 
      });
      throw error;
    }
  },
}));

// Export types for use in components
export type { UpiConfig, BankConfig };