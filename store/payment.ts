import { create } from 'zustand';
import { PaymentMethod } from '../types/payment';
import { supabase } from '../services/supabase/supabase';
import { useAuthStore } from './auth';

interface PaymentState {
  paymentMethods: PaymentMethod[];
  defaultMethod: PaymentMethod | null;
  loading: boolean;
  fetchPaymentMethods: () => Promise<void>;
  addPaymentMethod: (method: Omit<PaymentMethod, 'id' | 'created_at'>) => Promise<void>;
  removePaymentMethod: (id: string) => Promise<void>;
  setDefaultMethod: (method: PaymentMethod | string) => Promise<void>;
}

export const usePaymentStore = create<PaymentState>((set) => ({
  paymentMethods: [],
  defaultMethod: null,
  loading: false,

  fetchPaymentMethods: async () => {
    try {
      set({ loading: true });
      const user = useAuthStore.getState().user;
      if (!user) throw new Error('No user found');

      const { data, error } = await supabase
        .from('payment_methods')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false });

      if (error) throw error;

      const methods = data as PaymentMethod[];
      const defaultMethod = methods.find(m => m.is_default) || null;

      set({ 
        paymentMethods: methods,
        defaultMethod,
        loading: false
      });
    } catch (error) {
      console.error('Error fetching payment methods:', error);
      set({ loading: false });
    }
  },

  addPaymentMethod: async (method) => {
    try {
      set({ loading: true });
      
      const user = useAuthStore.getState().user;
      if (!user) throw new Error('You must be logged in to add a payment method');

      // First check if we need to reset other default methods
      if (method.is_default) {
        await supabase
          .from('payment_methods')
          .update({ is_default: false })
          .eq('user_id', user.id);
      }

      // Add timestamp and add proper values
      const paymentData = {
        ...method,
        user_id: user.id,
        created_at: new Date().toISOString()
      };
      
      console.log('Inserting payment method with data:', paymentData);
      
      const { data, error } = await supabase
        .from('payment_methods')
        .insert(paymentData)
        .select()
        .single();

      if (error) {
        console.error('Database error:', error);
        throw error;
      }

      set(state => ({
        paymentMethods: [...state.paymentMethods, data],
        defaultMethod: method.is_default ? data : state.defaultMethod,
        loading: false
      }));
      
      return data;
    } catch (error) {
      console.error('Error adding payment method:', error);
      set({ loading: false });
      throw error;
    }
  },

  removePaymentMethod: async (id) => {
    try {
      set({ loading: true });
      
      const user = useAuthStore.getState().user;
      if (!user) throw new Error('No user found');
      
      const { error } = await supabase
        .from('payment_methods')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);  // Important: Add the user_id check

      if (error) throw error;

      set(state => ({
        paymentMethods: state.paymentMethods.filter(m => m.id !== id),
        defaultMethod: state.defaultMethod?.id === id ? null : state.defaultMethod,
        loading: false
      }));
    } catch (error) {
      console.error('Error removing payment method:', error);
      set({ loading: false });
      throw error;
    }
  },

  setDefaultMethod: async (methodOrId: PaymentMethod | string) => {
    if (typeof methodOrId === 'string' && methodOrId !== 'cod') {
      // Handle existing payment method
      try {
        set({ loading: true });
        
        const user = useAuthStore.getState().user;
        if (!user) throw new Error('No user found');

        // First, reset all payment methods to non-default
        const { error } = await supabase
          .from('payment_methods')
          .update({ is_default: false })
          .eq('user_id', user.id);

        if (error) throw error;

        // Then set the selected method as default
        const { error: error2 } = await supabase
          .from('payment_methods')
          .update({ is_default: true })
          .eq('id', methodOrId)
          .eq('user_id', user.id);

        if (error2) throw error2;

        set(state => ({
          paymentMethods: state.paymentMethods.map(m => ({
            ...m,
            is_default: m.id === methodOrId
          })),
          defaultMethod: state.paymentMethods.find(m => m.id === methodOrId) || null,
          loading: false
        }));
      } catch (error) {
        console.error('Error setting default method:', error);
        set({ loading: false });
        throw error;
      }
    } else {
      // Handle COD or new payment method
      set({ defaultMethod: methodOrId as PaymentMethod, loading: false });
    }
  },
})); 