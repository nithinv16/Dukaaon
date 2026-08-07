/**
 * UPIMandateService - Service for managing UPI autopay mandates
 * 
 * Implements Requirements 4.6:
 * - Initiate UPI autopay mandate setup for chosen repayment schedule
 * - Handle mandate status callbacks
 */

import { supabase } from '../supabase/supabase';
import { RepaymentPeriod } from './CreditService';

// ============================================================================
// Type Definitions
// ============================================================================

export type MandateStatus = 'pending' | 'active' | 'paused' | 'cancelled' | 'expired';

export interface UPIMandate {
  id: string;
  credit_payment_id: string;
  mandate_urn?: string;
  upi_id: string;
  frequency: RepaymentPeriod;
  amount: number;
  start_date: string;
  end_date: string;
  status: MandateStatus;
  created_at: string;
  updated_at: string;
}

export interface CreateMandateInput {
  credit_payment_id: string;
  upi_id: string;
  frequency: RepaymentPeriod;
  amount: number;
  start_date: Date;
  end_date: Date;
}

export interface MandateCallbackPayload {
  mandate_urn: string;
  status: 'success' | 'failed' | 'pending';
  error_code?: string;
  error_message?: string;
  timestamp: string;
}

export interface MandateCreationResult {
  success: boolean;
  mandate?: UPIMandate;
  deepLink?: string;
  error?: string;
}

// ============================================================================
// UPI Provider Configuration (Mock for development)
// ============================================================================

const UPI_PROVIDER_CONFIG = {
  baseUrl: process.env.UPI_PROVIDER_URL || 'https://api.upi-provider.example.com',
  merchantId: process.env.UPI_MERCHANT_ID || 'DUKAAON_MERCHANT',
  callbackUrl: process.env.UPI_CALLBACK_URL || 'https://api.dukaaon.com/webhooks/upi-mandate',
};

// ============================================================================
// UPIMandateService Class
// ============================================================================

class UPIMandateServiceClass {
  /**
   * Create a new UPI autopay mandate
   * Requirements 4.6: Initiate UPI autopay mandate setup
   */
  async createMandate(input: CreateMandateInput): Promise<MandateCreationResult> {
    try {
      // Validate UPI ID format
      if (!this.isValidUpiId(input.upi_id)) {
        return {
          success: false,
          error: 'Invalid UPI ID format. Please enter a valid UPI ID (e.g., name@upi)',
        };
      }

      // Create mandate record in database
      const { data: mandate, error: dbError } = await supabase
        .from('upi_mandates')
        .insert({
          credit_payment_id: input.credit_payment_id,
          upi_id: input.upi_id,
          frequency: input.frequency,
          amount: input.amount,
          start_date: input.start_date.toISOString().split('T')[0],
          end_date: input.end_date.toISOString().split('T')[0],
          status: 'pending',
        })
        .select()
        .single();

      if (dbError) {
        console.error('[UPIMandateService] Error creating mandate:', dbError);
        return {
          success: false,
          error: 'Failed to create mandate. Please try again.',
        };
      }

      // Generate UPI deep link for mandate approval
      const deepLink = this.generateMandateDeepLink(mandate);

      return {
        success: true,
        mandate,
        deepLink,
      };
    } catch (error) {
      console.error('[UPIMandateService] Error in createMandate:', error);
      return {
        success: false,
        error: 'An unexpected error occurred. Please try again.',
      };
    }
  }

  /**
   * Generate UPI deep link for mandate approval
   * This would integrate with actual UPI provider in production
   */
  private generateMandateDeepLink(mandate: UPIMandate): string {
    // In production, this would call the UPI provider API
    // For now, generate a mock deep link
    const params = new URLSearchParams({
      pa: UPI_PROVIDER_CONFIG.merchantId,
      pn: 'DukaaOn Credit',
      mc: '5411', // Merchant category code for grocery stores
      tid: mandate.id,
      tr: mandate.id,
      tn: `Credit Payment Mandate - ${mandate.frequency}`,
      am: mandate.amount.toString(),
      cu: 'INR',
      mode: '04', // Recurring payment
      purpose: '14', // Subscription
      orgid: 'DUKAAON',
      sign: this.generateSignature(mandate),
    });

    return `upi://mandate?${params.toString()}`;
  }

  /**
   * Generate signature for mandate (mock implementation)
   */
  private generateSignature(mandate: UPIMandate): string {
    // In production, this would use proper cryptographic signing
    return Buffer.from(`${mandate.id}:${mandate.amount}:${mandate.frequency}`).toString('base64');
  }

  /**
   * Validate UPI ID format
   */
  isValidUpiId(upiId: string): boolean {
    // UPI ID format: username@provider
    const upiRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/;
    return upiRegex.test(upiId);
  }

  /**
   * Handle mandate callback from UPI provider
   * Requirements 4.6: Handle mandate status callbacks
   */
  async handleMandateCallback(payload: MandateCallbackPayload): Promise<{
    success: boolean;
    mandateId?: string;
  }> {
    try {
      // Find mandate by URN
      const { data: mandate, error: findError } = await supabase
        .from('upi_mandates')
        .select('*')
        .eq('mandate_urn', payload.mandate_urn)
        .single();

      if (findError || !mandate) {
        // Try finding by pending status if URN not set yet
        console.error('[UPIMandateService] Mandate not found for URN:', payload.mandate_urn);
        return { success: false };
      }

      // Update mandate status based on callback
      let newStatus: MandateStatus;
      switch (payload.status) {
        case 'success':
          newStatus = 'active';
          break;
        case 'failed':
          newStatus = 'cancelled';
          break;
        case 'pending':
        default:
          newStatus = 'pending';
      }

      const { error: updateError } = await supabase
        .from('upi_mandates')
        .update({
          status: newStatus,
          mandate_urn: payload.mandate_urn,
        })
        .eq('id', mandate.id);

      if (updateError) {
        console.error('[UPIMandateService] Error updating mandate:', updateError);
        return { success: false };
      }

      // If mandate is active, update credit payment status
      if (newStatus === 'active') {
        await this.activateCreditPayment(mandate.credit_payment_id);
      }

      return {
        success: true,
        mandateId: mandate.id,
      };
    } catch (error) {
      console.error('[UPIMandateService] Error in handleMandateCallback:', error);
      return { success: false };
    }
  }

  /**
   * Activate credit payment after mandate approval
   */
  private async activateCreditPayment(creditPaymentId: string): Promise<void> {
    const { error } = await supabase
      .from('credit_payments')
      .update({ status: 'active' })
      .eq('id', creditPaymentId);

    if (error) {
      console.error('[UPIMandateService] Error activating credit payment:', error);
    }
  }

  /**
   * Get mandate by credit payment ID
   */
  async getMandateByPaymentId(creditPaymentId: string): Promise<UPIMandate | null> {
    const { data, error } = await supabase
      .from('upi_mandates')
      .select('*')
      .eq('credit_payment_id', creditPaymentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      console.error('[UPIMandateService] Error fetching mandate:', error);
      throw error;
    }

    return data;
  }

  /**
   * Get mandate by ID
   */
  async getMandate(mandateId: string): Promise<UPIMandate | null> {
    const { data, error } = await supabase
      .from('upi_mandates')
      .select('*')
      .eq('id', mandateId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      console.error('[UPIMandateService] Error fetching mandate:', error);
      throw error;
    }

    return data;
  }

  /**
   * Cancel a mandate
   */
  async cancelMandate(mandateId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const mandate = await this.getMandate(mandateId);
      if (!mandate) {
        return { success: false, error: 'Mandate not found' };
      }

      if (mandate.status === 'cancelled' || mandate.status === 'expired') {
        return { success: false, error: 'Mandate is already cancelled or expired' };
      }

      // In production, this would call the UPI provider to cancel the mandate
      const { error } = await supabase
        .from('upi_mandates')
        .update({ status: 'cancelled' })
        .eq('id', mandateId);

      if (error) {
        console.error('[UPIMandateService] Error cancelling mandate:', error);
        return { success: false, error: 'Failed to cancel mandate' };
      }

      return { success: true };
    } catch (error) {
      console.error('[UPIMandateService] Error in cancelMandate:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  /**
   * Pause a mandate
   */
  async pauseMandate(mandateId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const mandate = await this.getMandate(mandateId);
      if (!mandate) {
        return { success: false, error: 'Mandate not found' };
      }

      if (mandate.status !== 'active') {
        return { success: false, error: 'Only active mandates can be paused' };
      }

      const { error } = await supabase
        .from('upi_mandates')
        .update({ status: 'paused' })
        .eq('id', mandateId);

      if (error) {
        console.error('[UPIMandateService] Error pausing mandate:', error);
        return { success: false, error: 'Failed to pause mandate' };
      }

      return { success: true };
    } catch (error) {
      console.error('[UPIMandateService] Error in pauseMandate:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  /**
   * Resume a paused mandate
   */
  async resumeMandate(mandateId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const mandate = await this.getMandate(mandateId);
      if (!mandate) {
        return { success: false, error: 'Mandate not found' };
      }

      if (mandate.status !== 'paused') {
        return { success: false, error: 'Only paused mandates can be resumed' };
      }

      const { error } = await supabase
        .from('upi_mandates')
        .update({ status: 'active' })
        .eq('id', mandateId);

      if (error) {
        console.error('[UPIMandateService] Error resuming mandate:', error);
        return { success: false, error: 'Failed to resume mandate' };
      }

      return { success: true };
    } catch (error) {
      console.error('[UPIMandateService] Error in resumeMandate:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  /**
   * Check if mandate is active and valid for payment
   */
  async isMandateValidForPayment(creditPaymentId: string): Promise<boolean> {
    const mandate = await this.getMandateByPaymentId(creditPaymentId);
    if (!mandate) return false;

    // Check status
    if (mandate.status !== 'active') return false;

    // Check date range
    const today = new Date();
    const startDate = new Date(mandate.start_date);
    const endDate = new Date(mandate.end_date);

    return today >= startDate && today <= endDate;
  }

  /**
   * Get mandate status display text
   */
  getMandateStatusText(status: MandateStatus): string {
    const statusTexts: Record<MandateStatus, string> = {
      pending: 'Awaiting Approval',
      active: 'Active',
      paused: 'Paused',
      cancelled: 'Cancelled',
      expired: 'Expired',
    };
    return statusTexts[status];
  }
}

// Export singleton instance
export const UPIMandateService = new UPIMandateServiceClass();

// Export class for testing
export { UPIMandateServiceClass };
