/**
 * CreditService - Service for managing credit facilities and payments
 * 
 * Implements Requirements 4.2, 4.3, 4.10:
 * - Display payment form with amount input, repayment period options, and calculated interest
 * - Show total repayment amount, interest rate, and EMI/daily payment breakdown
 * - Apply NBFC partner's rate structure based on repayment period
 */

import { supabase } from '../supabase/supabase';
import { ServiceError, ErrorCode, ErrorSeverity } from '../errors';
import { LoggingService } from '../logging/LoggingService';

const logger = LoggingService.createScope('CreditService');

// ============================================================================
// Type Definitions
// ============================================================================

export type RepaymentPeriod = 'daily' | 'weekly' | 'monthly';
export type KycStatus = 'pending' | 'verified' | 'rejected';
export type CreditPaymentStatus = 'pending_mandate' | 'active' | 'completed' | 'defaulted';

export interface CreditFacility {
  id: string;
  retailer_id: string;
  credit_limit: number;
  available_credit: number;
  kyc_status: KycStatus;
  kyc_rejection_reason?: string;
  kyc_verified_at?: string;
  nbfc_customer_id?: string;
  created_at: string;
  updated_at: string;
}

export interface CreditPayment {
  id: string;
  retailer_id: string;
  wholesaler_id: string;
  amount: number;
  repayment_period: RepaymentPeriod;
  repayment_days: number;
  interest_rate: number;
  processing_fee: number;
  total_repayment: number;
  emi_amount: number;
  outstanding_amount: number;
  next_payment_date?: string;
  status: CreditPaymentStatus;
  created_at: string;
  updated_at: string;
}

export interface CreditPaymentHistory {
  id: string;
  credit_payment_id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  transaction_id?: string;
  status: 'success' | 'failed' | 'pending';
  created_at: string;
}

export interface InterestCalculation {
  principal: number;
  interestRate: number;
  totalInterest: number;
  processingFee: number;
  totalRepayment: number;
  emiAmount: number;
  repaymentDays: number;
  numberOfPayments: number;
}

export interface CreateCreditPaymentInput {
  wholesaler_id: string;
  amount: number;
  repayment_period: RepaymentPeriod;
}

// ============================================================================
// Interest Rate Configuration
// ============================================================================

/**
 * NBFC partner interest rates based on repayment period
 * Shorter periods have higher rates (annualized)
 * Requirements 4.10: Apply NBFC partner's rate structure based on repayment period
 */
export const INTEREST_RATES: Record<RepaymentPeriod, number> = {
  daily: 24.0,    // 24% annual rate for daily repayment
  weekly: 18.0,   // 18% annual rate for weekly repayment
  monthly: 15.0,  // 15% annual rate for monthly repayment
};

/**
 * Default repayment durations in days
 */
export const DEFAULT_REPAYMENT_DAYS: Record<RepaymentPeriod, number> = {
  daily: 30,      // 30 days for daily repayment
  weekly: 56,     // 8 weeks (56 days) for weekly repayment
  monthly: 90,    // 3 months (90 days) for monthly repayment
};

/**
 * Processing fee percentage
 */
export const PROCESSING_FEE_PERCENT = 2.0;

// ============================================================================
// Interest Calculation Functions
// ============================================================================

/**
 * Calculate interest for a credit payment
 * Formula: totalInterest = (principal * rate * days) / (100 * 365)
 * 
 * Requirements 4.3, 4.10: Calculate and display interest based on repayment period
 * 
 * Property 14: Interest Calculation Accuracy
 * For any credit payment, the calculated interest SHALL match the formula:
 * totalInterest = (principal * rate * days) / (100 * 365)
 */
export function calculateInterest(
  principal: number,
  repaymentPeriod: RepaymentPeriod,
  customDays?: number
): InterestCalculation {
  const rate = INTEREST_RATES[repaymentPeriod];
  const days = customDays ?? DEFAULT_REPAYMENT_DAYS[repaymentPeriod];
  
  // Calculate interest using the formula from design doc
  // totalInterest = (principal * rate * days) / (100 * 365)
  const totalInterest = (principal * rate * days) / (100 * 365);
  
  // Calculate processing fee
  const processingFee = (principal * PROCESSING_FEE_PERCENT) / 100;
  
  // Total repayment = principal + interest + processing fee
  const totalRepayment = principal + totalInterest + processingFee;
  
  // Calculate number of payments based on period
  let numberOfPayments: number;
  switch (repaymentPeriod) {
    case 'daily':
      numberOfPayments = days;
      break;
    case 'weekly':
      numberOfPayments = Math.ceil(days / 7);
      break;
    case 'monthly':
      numberOfPayments = Math.ceil(days / 30);
      break;
  }
  
  // EMI amount = total repayment / number of payments
  const emiAmount = totalRepayment / numberOfPayments;
  
  return {
    principal,
    interestRate: rate,
    totalInterest: Math.round(totalInterest * 100) / 100,
    processingFee: Math.round(processingFee * 100) / 100,
    totalRepayment: Math.round(totalRepayment * 100) / 100,
    emiAmount: Math.round(emiAmount * 100) / 100,
    repaymentDays: days,
    numberOfPayments,
  };
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Get repayment period display name
 */
export function getRepaymentPeriodLabel(period: RepaymentPeriod): string {
  const labels: Record<RepaymentPeriod, string> = {
    daily: 'Daily',
    weekly: 'Weekly',
    monthly: 'Monthly',
  };
  return labels[period];
}

/**
 * Calculate next payment date based on period
 */
export function calculateNextPaymentDate(
  startDate: Date,
  period: RepaymentPeriod
): Date {
  const nextDate = new Date(startDate);
  
  switch (period) {
    case 'daily':
      nextDate.setDate(nextDate.getDate() + 1);
      break;
    case 'weekly':
      nextDate.setDate(nextDate.getDate() + 7);
      break;
    case 'monthly':
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;
  }
  
  return nextDate;
}

// ============================================================================
// CreditService Class
// ============================================================================

class CreditServiceClass {
  /**
   * Get credit facility for a retailer
   * Requirements 4.1: Display available credit limit
   */
  async getCreditFacility(retailerId: string): Promise<CreditFacility | null> {
    const { data, error } = await supabase
      .from('credit_facilities')
      .select('*')
      .eq('retailer_id', retailerId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      logger.error('Error fetching credit facility', error, { retailerId });
      throw new ServiceError({
        code: ErrorCode.DATA_NOT_FOUND,
        message: `Failed to fetch credit facility: ${error.message}`,
        originalError: error,
        context: { service: 'CreditService', operation: 'getCreditFacility', retailerId },
      });
    }

    return data;
  }

  /**
   * Create or get credit facility for a retailer
   */
  async getOrCreateCreditFacility(retailerId: string): Promise<CreditFacility> {
    // Try to get existing facility
    const existing = await this.getCreditFacility(retailerId);
    if (existing) {
      return existing;
    }

    // Create new facility with pending KYC
    const { data, error } = await supabase
      .from('credit_facilities')
      .insert({
        retailer_id: retailerId,
        credit_limit: 0,
        available_credit: 0,
        kyc_status: 'pending',
      })
      .select()
      .single();

    if (error) {
      // If duplicate key error, try to fetch again (race condition)
      if (error.code === '23505') {
        const existing = await this.getCreditFacility(retailerId);
        if (existing) {
          return existing;
        }
      }
      logger.error('Error creating credit facility', error, { retailerId });
      throw new ServiceError({
        code: ErrorCode.DATA_DUPLICATE,
        message: `Failed to create credit facility: ${error.message}`,
        originalError: error,
        context: { service: 'CreditService', operation: 'getOrCreateCreditFacility', retailerId },
      });
    }

    return data;
  }

  /**
   * Check if retailer has sufficient credit
   * Requirements 4.2: Check credit limit before payment
   */
  async checkCreditLimit(retailerId: string, amount: number): Promise<{
    hasCredit: boolean;
    availableCredit: number;
    shortfall: number;
  }> {
    const facility = await this.getCreditFacility(retailerId);
    
    if (!facility) {
      return {
        hasCredit: false,
        availableCredit: 0,
        shortfall: amount,
      };
    }

    const hasCredit = facility.available_credit >= amount;
    const shortfall = hasCredit ? 0 : amount - facility.available_credit;

    return {
      hasCredit,
      availableCredit: facility.available_credit,
      shortfall,
    };
  }

  /**
   * Get KYC status for a retailer
   * Requirements 4.4, 4.9: Check KYC status and display rejection reasons
   */
  async getKycStatus(retailerId: string): Promise<{
    status: KycStatus;
    rejectionReason?: string;
    verifiedAt?: string;
  }> {
    const facility = await this.getCreditFacility(retailerId);
    
    if (!facility) {
      return { status: 'pending' };
    }

    return {
      status: facility.kyc_status,
      rejectionReason: facility.kyc_rejection_reason,
      verifiedAt: facility.kyc_verified_at,
    };
  }

  /**
   * Check if KYC is verified
   * Property 15: KYC Gate Enforcement
   */
  isKycVerified(facility: CreditFacility | null): boolean {
    return facility?.kyc_status === 'verified';
  }

  /**
   * Calculate interest for a payment
   * Requirements 4.3, 4.10: Calculate interest based on repayment period
   */
  calculatePaymentInterest(
    amount: number,
    repaymentPeriod: RepaymentPeriod,
    customDays?: number
  ): InterestCalculation {
    return calculateInterest(amount, repaymentPeriod, customDays);
  }

  /**
   * Create a credit payment
   * Requirements 4.6, 4.7: Create credit record with repayment schedule
   */
  async createCreditPayment(
    retailerId: string,
    input: CreateCreditPaymentInput
  ): Promise<CreditPayment> {
    // Check KYC status first
    const facility = await this.getCreditFacility(retailerId);
    if (!facility || facility.kyc_status !== 'verified') {
      throw new ServiceError({
        code: ErrorCode.CREDIT_KYC_REQUIRED,
        message: 'KYC not verified for credit payment',
        userMessage: 'KYC verification required before creating credit payment.',
        severity: ErrorSeverity.MEDIUM,
        context: { service: 'CreditService', operation: 'createCreditPayment', retailerId },
      });
    }

    // Check credit limit
    const creditCheck = await this.checkCreditLimit(retailerId, input.amount);
    if (!creditCheck.hasCredit) {
      throw new ServiceError({
        code: ErrorCode.CREDIT_INSUFFICIENT,
        message: `Insufficient credit: requested ${input.amount}, available ${creditCheck.availableCredit}`,
        userMessage: `Insufficient credit. Available: ${formatCurrency(creditCheck.availableCredit)}`,
        severity: ErrorSeverity.LOW,
        context: { 
          service: 'CreditService', 
          operation: 'createCreditPayment', 
          retailerId,
          requestedAmount: input.amount,
          availableCredit: creditCheck.availableCredit,
        },
      });
    }

    // Calculate interest
    const calculation = calculateInterest(input.amount, input.repayment_period);
    
    // Calculate next payment date
    const nextPaymentDate = calculateNextPaymentDate(new Date(), input.repayment_period);

    // Create credit payment record
    const { data, error } = await supabase
      .from('credit_payments')
      .insert({
        retailer_id: retailerId,
        wholesaler_id: input.wholesaler_id,
        amount: input.amount,
        repayment_period: input.repayment_period,
        repayment_days: calculation.repaymentDays,
        interest_rate: calculation.interestRate,
        processing_fee: calculation.processingFee,
        total_repayment: calculation.totalRepayment,
        emi_amount: calculation.emiAmount,
        outstanding_amount: calculation.totalRepayment,
        next_payment_date: nextPaymentDate.toISOString().split('T')[0],
        status: 'pending_mandate',
      })
      .select()
      .single();

    if (error) {
      logger.error('Error creating credit payment', error, { retailerId, amount: input.amount });
      throw new ServiceError({
        code: ErrorCode.PAYMENT_FAILED,
        message: `Failed to create credit payment: ${error.message}`,
        originalError: error,
        context: { service: 'CreditService', operation: 'createCreditPayment', retailerId },
      });
    }

    // Update available credit
    await this.updateAvailableCredit(retailerId, -input.amount);

    return data;
  }

  /**
   * Get active credit payments for a retailer
   * Requirements 4.8: Display active credits with outstanding balance
   */
  async getActiveCreditPayments(retailerId: string): Promise<CreditPayment[]> {
    const { data, error } = await supabase
      .from('credit_payments')
      .select('*')
      .eq('retailer_id', retailerId)
      .in('status', ['pending_mandate', 'active'])
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Error fetching active payments', error, { retailerId });
      throw new ServiceError({
        code: ErrorCode.DATA_NOT_FOUND,
        message: `Failed to fetch active payments: ${error.message}`,
        originalError: error,
        context: { service: 'CreditService', operation: 'getActiveCreditPayments', retailerId },
      });
    }

    return data || [];
  }

  /**
   * Get all credit payments for a retailer
   */
  async getAllCreditPayments(retailerId: string): Promise<CreditPayment[]> {
    const { data, error } = await supabase
      .from('credit_payments')
      .select('*')
      .eq('retailer_id', retailerId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Error fetching all payments', error, { retailerId });
      throw new ServiceError({
        code: ErrorCode.DATA_NOT_FOUND,
        message: `Failed to fetch all payments: ${error.message}`,
        originalError: error,
        context: { service: 'CreditService', operation: 'getAllCreditPayments', retailerId },
      });
    }

    return data || [];
  }

  /**
   * Get payment history for a credit payment
   * Requirements 4.8: Show payment history
   */
  async getPaymentHistory(creditPaymentId: string): Promise<CreditPaymentHistory[]> {
    const { data, error } = await supabase
      .from('credit_payment_history')
      .select('*')
      .eq('credit_payment_id', creditPaymentId)
      .order('payment_date', { ascending: false });

    if (error) {
      logger.error('Error fetching payment history', error, { creditPaymentId });
      throw new ServiceError({
        code: ErrorCode.DATA_NOT_FOUND,
        message: `Failed to fetch payment history: ${error.message}`,
        originalError: error,
        context: { service: 'CreditService', operation: 'getPaymentHistory', creditPaymentId },
      });
    }

    return data || [];
  }

  /**
   * Update credit payment status
   */
  async updateCreditPaymentStatus(
    paymentId: string,
    status: CreditPaymentStatus
  ): Promise<void> {
    const { error } = await supabase
      .from('credit_payments')
      .update({ status })
      .eq('id', paymentId);

    if (error) {
      logger.error('Error updating payment status', error, { paymentId, status });
      throw new ServiceError({
        code: ErrorCode.PAYMENT_FAILED,
        message: `Failed to update payment status: ${error.message}`,
        originalError: error,
        context: { service: 'CreditService', operation: 'updateCreditPaymentStatus', paymentId },
      });
    }
  }

  /**
   * Record a payment in history
   */
  async recordPayment(
    creditPaymentId: string,
    amount: number,
    transactionId?: string
  ): Promise<CreditPaymentHistory> {
    const { data, error } = await supabase
      .from('credit_payment_history')
      .insert({
        credit_payment_id: creditPaymentId,
        amount,
        payment_method: 'upi_mandate',
        transaction_id: transactionId,
        status: 'success',
      })
      .select()
      .single();

    if (error) {
      logger.error('Error recording payment', error, { creditPaymentId, amount });
      throw new ServiceError({
        code: ErrorCode.PAYMENT_FAILED,
        message: `Failed to record payment: ${error.message}`,
        originalError: error,
        context: { service: 'CreditService', operation: 'recordPayment', creditPaymentId },
      });
    }

    return data;
  }

  /**
   * Make a prepayment
   * Requirements 4.8: Add prepayment option
   */
  async makePrepayment(
    creditPaymentId: string,
    amount: number,
    transactionId?: string
  ): Promise<{ success: boolean; remainingBalance: number }> {
    // Get current payment
    const { data: payment, error: fetchError } = await supabase
      .from('credit_payments')
      .select('*')
      .eq('id', creditPaymentId)
      .single();

    if (fetchError || !payment) {
      throw new ServiceError({
        code: ErrorCode.DATA_NOT_FOUND,
        message: `Credit payment not found: ${creditPaymentId}`,
        userMessage: 'Credit payment not found.',
        originalError: fetchError,
        context: { service: 'CreditService', operation: 'makePrepayment', creditPaymentId },
      });
    }

    if (amount > payment.outstanding_amount) {
      throw new ServiceError({
        code: ErrorCode.CREDIT_LIMIT_EXCEEDED,
        message: `Prepayment ${amount} exceeds outstanding ${payment.outstanding_amount}`,
        userMessage: 'Prepayment amount exceeds outstanding balance.',
        severity: ErrorSeverity.LOW,
        context: { 
          service: 'CreditService', 
          operation: 'makePrepayment', 
          creditPaymentId,
          prepaymentAmount: amount,
          outstandingAmount: payment.outstanding_amount,
        },
      });
    }

    // Record the payment
    await this.recordPayment(creditPaymentId, amount, transactionId);

    // The trigger will update outstanding_amount automatically
    // Fetch updated payment to get new balance
    const { data: updatedPayment } = await supabase
      .from('credit_payments')
      .select('outstanding_amount')
      .eq('id', creditPaymentId)
      .single();

    return {
      success: true,
      remainingBalance: updatedPayment?.outstanding_amount ?? 0,
    };
  }

  /**
   * Get available wholesalers for credit payments
   * Requirements 4.1: Show list of wholesalers for credit payments
   * Note: Retailers can pay any active wholesaler, not just ones they've ordered from
   */
  async getConnectedWholesalers(retailerId: string): Promise<Array<{
    id: string;
    business_name: string;
    phone: string;
  }>> {
    // Fetch all active wholesalers from seller_details joined with profiles
    const { data: sellers, error: sellersError } = await supabase
      .from('seller_details')
      .select(`
        user_id,
        business_name,
        profiles!seller_details_user_id_fkey (
          id,
          phone_number
        )
      `)
      .eq('status', 'active')
      .eq('seller_type', 'wholesaler')
      .order('business_name', { ascending: true });

    if (sellersError) {
      logger.error('Error fetching wholesalers', sellersError, { retailerId });
      throw new ServiceError({
        code: ErrorCode.DATA_NOT_FOUND,
        message: `Failed to fetch wholesalers: ${sellersError.message}`,
        originalError: sellersError,
        context: { service: 'CreditService', operation: 'getConnectedWholesalers', retailerId },
      });
    }

    // Format the results
    return (sellers || [])
      .filter(seller => seller.business_name) // Only include sellers with business names
      .map(seller => {
        const profile = seller.profiles as any;
        return {
          id: seller.user_id,
          business_name: seller.business_name || 'Unknown',
          phone: profile?.phone_number || '',
        };
      });
  }

  /**
   * Update available credit after payment creation or completion
   */
  private async updateAvailableCredit(
    retailerId: string,
    amountChange: number
  ): Promise<void> {
    const { error } = await supabase.rpc('update_available_credit', {
      p_retailer_id: retailerId,
      p_amount_change: amountChange,
    });

    // If RPC doesn't exist, do manual update
    if (error && error.code === '42883') {
      const facility = await this.getCreditFacility(retailerId);
      if (facility) {
        await supabase
          .from('credit_facilities')
          .update({
            available_credit: Math.max(0, facility.available_credit + amountChange),
          })
          .eq('retailer_id', retailerId);
      }
    } else if (error) {
      logger.warn('Error updating available credit', { retailerId, amountChange, error: error.message });
    }
  }

  /**
   * Get total outstanding amount for a retailer
   */
  async getTotalOutstanding(retailerId: string): Promise<number> {
    const { data, error } = await supabase
      .from('credit_payments')
      .select('outstanding_amount')
      .eq('retailer_id', retailerId)
      .in('status', ['active', 'pending_mandate']);

    if (error) {
      logger.error('Error fetching total outstanding', error, { retailerId });
      throw new ServiceError({
        code: ErrorCode.DATA_NOT_FOUND,
        message: `Failed to fetch total outstanding: ${error.message}`,
        originalError: error,
        context: { service: 'CreditService', operation: 'getTotalOutstanding', retailerId },
      });
    }

    return (data || []).reduce((sum, p) => sum + (p.outstanding_amount || 0), 0);
  }
}

// Export singleton instance
export const CreditService = new CreditServiceClass();

// Export class for testing
export { CreditServiceClass };
