/**
 * CreditPaymentProcessor - Orchestrates the credit payment flow
 * 
 * Implements Requirements 4.6, 4.7:
 * - Create payment flow: mandate → payment → record
 * - Process payment to wholesaler
 * - Create credit record with repayment schedule
 * 
 * Property 16: Credit Payment Flow Integrity
 * For any confirmed credit payment, the system SHALL:
 * (1) create UPI mandate, (2) wait for mandate success, (3) process payment to wholesaler,
 * (4) create credit record - in that exact order.
 */

import { supabase } from '../supabase/supabase';
import {
  CreditService,
  CreditPayment,
  RepaymentPeriod,
  calculateInterest,
  calculateNextPaymentDate,
} from './CreditService';
import { KYCService } from './KYCService';
import { UPIMandateService, UPIMandate } from './UPIMandateService';

// ============================================================================
// Type Definitions
// ============================================================================

export type PaymentFlowStep = 
  | 'kyc_check'
  | 'credit_check'
  | 'create_payment'
  | 'create_mandate'
  | 'await_mandate'
  | 'process_payment'
  | 'complete';

export interface PaymentFlowState {
  step: PaymentFlowStep;
  creditPaymentId?: string;
  mandateId?: string;
  deepLink?: string;
  error?: string;
  isComplete: boolean;
}

export interface InitiatePaymentInput {
  retailer_id: string;
  wholesaler_id: string;
  amount: number;
  repayment_period: RepaymentPeriod;
  upi_id: string;
}

export interface PaymentFlowResult {
  success: boolean;
  state: PaymentFlowState;
  creditPayment?: CreditPayment;
  mandate?: UPIMandate;
}

export interface WholesalerPaymentResult {
  success: boolean;
  transaction_id?: string;
  error?: string;
}

// ============================================================================
// CreditPaymentProcessor Class
// ============================================================================

class CreditPaymentProcessorClass {
  /**
   * Initiate the credit payment flow
   * 
   * Flow order (Property 16):
   * 1. Check KYC status
   * 2. Check credit limit
   * 3. Create credit payment record
   * 4. Create UPI mandate
   * 5. Return deep link for user approval
   */
  async initiatePayment(input: InitiatePaymentInput): Promise<PaymentFlowResult> {
    const state: PaymentFlowState = {
      step: 'kyc_check',
      isComplete: false,
    };

    try {
      // Step 1: Check KYC status
      state.step = 'kyc_check';
      const kycResult = await KYCService.requiresKYC(input.retailer_id);
      if (kycResult.required) {
        return {
          success: false,
          state: {
            ...state,
            error: kycResult.reason,
          },
        };
      }

      // Step 2: Check credit limit
      state.step = 'credit_check';
      const creditCheck = await CreditService.checkCreditLimit(input.retailer_id, input.amount);
      if (!creditCheck.hasCredit) {
        return {
          success: false,
          state: {
            ...state,
            error: `Insufficient credit. Available: ₹${creditCheck.availableCredit.toLocaleString()}`,
          },
        };
      }

      // Step 3: Create credit payment record
      state.step = 'create_payment';
      const creditPayment = await CreditService.createCreditPayment(input.retailer_id, {
        wholesaler_id: input.wholesaler_id,
        amount: input.amount,
        repayment_period: input.repayment_period,
      });
      state.creditPaymentId = creditPayment.id;

      // Step 4: Create UPI mandate
      state.step = 'create_mandate';
      const calculation = calculateInterest(input.amount, input.repayment_period);
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + calculation.repaymentDays);

      const mandateResult = await UPIMandateService.createMandate({
        credit_payment_id: creditPayment.id,
        upi_id: input.upi_id,
        frequency: input.repayment_period,
        amount: calculation.emiAmount,
        start_date: startDate,
        end_date: endDate,
      });

      if (!mandateResult.success || !mandateResult.mandate) {
        // Rollback: Delete the credit payment
        await this.rollbackCreditPayment(creditPayment.id, input.retailer_id, input.amount);
        return {
          success: false,
          state: {
            ...state,
            error: mandateResult.error || 'Failed to create mandate',
          },
        };
      }

      state.mandateId = mandateResult.mandate.id;
      state.deepLink = mandateResult.deepLink;
      state.step = 'await_mandate';

      return {
        success: true,
        state,
        creditPayment,
        mandate: mandateResult.mandate,
      };
    } catch (error) {
      console.error('[CreditPaymentProcessor] Error in initiatePayment:', error);
      return {
        success: false,
        state: {
          ...state,
          error: error instanceof Error ? error.message : 'An unexpected error occurred',
        },
      };
    }
  }

  /**
   * Complete the payment flow after mandate approval
   * Called when mandate callback indicates success
   */
  async completePaymentFlow(creditPaymentId: string): Promise<PaymentFlowResult> {
    const state: PaymentFlowState = {
      step: 'process_payment',
      creditPaymentId,
      isComplete: false,
    };

    try {
      // Get credit payment
      const { data: creditPayment, error: fetchError } = await supabase
        .from('credit_payments')
        .select('*')
        .eq('id', creditPaymentId)
        .single();

      if (fetchError || !creditPayment) {
        return {
          success: false,
          state: {
            ...state,
            error: 'Credit payment not found',
          },
        };
      }

      // Verify mandate is active
      const mandate = await UPIMandateService.getMandateByPaymentId(creditPaymentId);
      if (!mandate || mandate.status !== 'active') {
        return {
          success: false,
          state: {
            ...state,
            error: 'Mandate is not active',
          },
        };
      }

      state.mandateId = mandate.id;

      // Step 5: Process payment to wholesaler
      const paymentResult = await this.processWholesalerPayment(creditPayment);
      if (!paymentResult.success) {
        return {
          success: false,
          state: {
            ...state,
            error: paymentResult.error || 'Failed to process payment to wholesaler',
          },
        };
      }

      // Update credit payment status to active
      await CreditService.updateCreditPaymentStatus(creditPaymentId, 'active');

      state.step = 'complete';
      state.isComplete = true;

      return {
        success: true,
        state,
        creditPayment: { ...creditPayment, status: 'active' },
        mandate,
      };
    } catch (error) {
      console.error('[CreditPaymentProcessor] Error in completePaymentFlow:', error);
      return {
        success: false,
        state: {
          ...state,
          error: error instanceof Error ? error.message : 'An unexpected error occurred',
        },
      };
    }
  }

  /**
   * Process payment to wholesaler
   * In production, this would integrate with actual payment gateway
   */
  private async processWholesalerPayment(
    creditPayment: CreditPayment
  ): Promise<WholesalerPaymentResult> {
    try {
      // In production, this would:
      // 1. Call payment gateway API to transfer funds
      // 2. Wait for confirmation
      // 3. Record transaction

      // For now, simulate successful payment
      const transactionId = `TXN_${Date.now()}_${creditPayment.id.substring(0, 8)}`;

      // Record the initial disbursement (not a repayment, just tracking)
      console.log(`[CreditPaymentProcessor] Processing payment of ₹${creditPayment.amount} to wholesaler ${creditPayment.wholesaler_id}`);

      // In production, you would call:
      // await paymentGateway.transfer({
      //   from: 'NBFC_ACCOUNT',
      //   to: wholesalerBankAccount,
      //   amount: creditPayment.amount,
      //   reference: creditPayment.id,
      // });

      return {
        success: true,
        transaction_id: transactionId,
      };
    } catch (error) {
      console.error('[CreditPaymentProcessor] Error processing wholesaler payment:', error);
      return {
        success: false,
        error: 'Failed to transfer funds to wholesaler',
      };
    }
  }

  /**
   * Rollback credit payment if mandate creation fails
   */
  private async rollbackCreditPayment(
    creditPaymentId: string,
    retailerId: string,
    amount: number
  ): Promise<void> {
    try {
      // Delete the credit payment
      await supabase
        .from('credit_payments')
        .delete()
        .eq('id', creditPaymentId);

      // Restore available credit
      const facility = await CreditService.getCreditFacility(retailerId);
      if (facility) {
        await supabase
          .from('credit_facilities')
          .update({
            available_credit: facility.available_credit + amount,
          })
          .eq('retailer_id', retailerId);
      }

      console.log('[CreditPaymentProcessor] Rolled back credit payment:', creditPaymentId);
    } catch (error) {
      console.error('[CreditPaymentProcessor] Error rolling back credit payment:', error);
    }
  }

  /**
   * Get payment flow status
   */
  async getPaymentFlowStatus(creditPaymentId: string): Promise<PaymentFlowState> {
    try {
      const { data: creditPayment } = await supabase
        .from('credit_payments')
        .select('*')
        .eq('id', creditPaymentId)
        .single();

      if (!creditPayment) {
        return {
          step: 'kyc_check',
          error: 'Payment not found',
          isComplete: false,
        };
      }

      const mandate = await UPIMandateService.getMandateByPaymentId(creditPaymentId);

      let step: PaymentFlowStep;
      let isComplete = false;

      switch (creditPayment.status) {
        case 'pending_mandate':
          step = mandate ? 'await_mandate' : 'create_mandate';
          break;
        case 'active':
          step = 'complete';
          isComplete = true;
          break;
        case 'completed':
          step = 'complete';
          isComplete = true;
          break;
        default:
          step = 'kyc_check';
      }

      return {
        step,
        creditPaymentId,
        mandateId: mandate?.id,
        isComplete,
      };
    } catch (error) {
      console.error('[CreditPaymentProcessor] Error getting flow status:', error);
      return {
        step: 'kyc_check',
        error: 'Failed to get payment status',
        isComplete: false,
      };
    }
  }

  /**
   * Cancel a pending payment flow
   */
  async cancelPaymentFlow(creditPaymentId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: creditPayment } = await supabase
        .from('credit_payments')
        .select('*')
        .eq('id', creditPaymentId)
        .single();

      if (!creditPayment) {
        return { success: false, error: 'Payment not found' };
      }

      if (creditPayment.status !== 'pending_mandate') {
        return { success: false, error: 'Can only cancel pending payments' };
      }

      // Cancel mandate if exists
      const mandate = await UPIMandateService.getMandateByPaymentId(creditPaymentId);
      if (mandate) {
        await UPIMandateService.cancelMandate(mandate.id);
      }

      // Rollback the credit payment
      await this.rollbackCreditPayment(
        creditPaymentId,
        creditPayment.retailer_id,
        creditPayment.amount
      );

      return { success: true };
    } catch (error) {
      console.error('[CreditPaymentProcessor] Error cancelling payment flow:', error);
      return { success: false, error: 'Failed to cancel payment' };
    }
  }

  /**
   * Get step display text
   */
  getStepDisplayText(step: PaymentFlowStep): string {
    const stepTexts: Record<PaymentFlowStep, string> = {
      kyc_check: 'Verifying KYC status...',
      credit_check: 'Checking credit limit...',
      create_payment: 'Creating payment record...',
      create_mandate: 'Setting up autopay...',
      await_mandate: 'Waiting for mandate approval...',
      process_payment: 'Processing payment to wholesaler...',
      complete: 'Payment complete!',
    };
    return stepTexts[step];
  }
}

// Export singleton instance
export const CreditPaymentProcessor = new CreditPaymentProcessorClass();

// Export class for testing
export { CreditPaymentProcessorClass };
