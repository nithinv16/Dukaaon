/**
 * CreditPaymentForm - Component for credit payment form UI
 * 
 * Implements Requirements 4.2, 4.3:
 * - Display payment form with amount input, repayment period options, and calculated interest
 * - Show total repayment amount, interest rate, and EMI/daily payment breakdown
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  CreditService,
  CreditFacility,
  RepaymentPeriod,
  InterestCalculation,
  calculateInterest,
  formatCurrency,
  getRepaymentPeriodLabel,
  INTEREST_RATES,
  DEFAULT_REPAYMENT_DAYS,
} from '../../services/credit/CreditService';

// ============================================================================
// Type Definitions
// ============================================================================

interface Wholesaler {
  id: string;
  business_name: string;
  phone: string;
}

interface CreditPaymentFormProps {
  wholesaler: Wholesaler;
  creditFacility: CreditFacility;
  onSubmit: (data: CreditPaymentFormData) => Promise<void>;
  onCancel: () => void;
}

export interface CreditPaymentFormData {
  wholesaler_id: string;
  amount: number;
  repayment_period: RepaymentPeriod;
  calculation: InterestCalculation;
}

// ============================================================================
// Repayment Period Options
// ============================================================================

const REPAYMENT_PERIOD_OPTIONS: Array<{
  value: RepaymentPeriod;
  label: string;
  description: string;
}> = [
  {
    value: 'daily',
    label: 'Daily',
    description: '30 days repayment',
  },
  {
    value: 'weekly',
    label: 'Weekly',
    description: '8 weeks repayment',
  },
  {
    value: 'monthly',
    label: 'Monthly',
    description: '3 months repayment',
  },
];

// ============================================================================
// Component
// ============================================================================

export const CreditPaymentForm: React.FC<CreditPaymentFormProps> = ({
  wholesaler,
  creditFacility,
  onSubmit,
  onCancel,
}) => {
  const [amount, setAmount] = useState<string>('');
  const [repaymentPeriod, setRepaymentPeriod] = useState<RepaymentPeriod>('weekly');
  const [calculation, setCalculation] = useState<InterestCalculation | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate interest whenever amount or period changes
  useEffect(() => {
    const numericAmount = parseFloat(amount);
    if (!isNaN(numericAmount) && numericAmount > 0) {
      const calc = calculateInterest(numericAmount, repaymentPeriod);
      setCalculation(calc);
      setError(null);
    } else {
      setCalculation(null);
    }
  }, [amount, repaymentPeriod]);

  const handleAmountChange = (text: string) => {
    // Only allow numbers and decimal point
    const cleaned = text.replace(/[^0-9.]/g, '');
    // Prevent multiple decimal points
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      return;
    }
    // Limit decimal places to 2
    if (parts[1] && parts[1].length > 2) {
      return;
    }
    setAmount(cleaned);
  };

  const validateForm = (): boolean => {
    const numericAmount = parseFloat(amount);
    
    if (!amount || isNaN(numericAmount)) {
      setError('Please enter a valid amount');
      return false;
    }

    if (numericAmount <= 0) {
      setError('Amount must be greater than zero');
      return false;
    }

    if (numericAmount > creditFacility.available_credit) {
      setError(`Amount exceeds available credit (${formatCurrency(creditFacility.available_credit)})`);
      return false;
    }

    if (numericAmount < 100) {
      setError('Minimum payment amount is ₹100');
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm() || !calculation) {
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        wholesaler_id: wholesaler.id,
        amount: parseFloat(amount),
        repayment_period: repaymentPeriod,
        calculation,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to process payment');
    } finally {
      setSubmitting(false);
    }
  };

  const renderRepaymentPeriodSelector = () => (
    <View style={styles.periodSelectorContainer}>
      <Text style={styles.sectionLabel}>Repayment Period</Text>
      <View style={styles.periodOptions}>
        {REPAYMENT_PERIOD_OPTIONS.map((option) => {
          const isSelected = repaymentPeriod === option.value;
          const rate = INTEREST_RATES[option.value];
          
          return (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.periodOption,
                isSelected && styles.periodOptionSelected,
              ]}
              onPress={() => setRepaymentPeriod(option.value)}
            >
              <View style={styles.periodOptionHeader}>
                <Text style={[
                  styles.periodOptionLabel,
                  isSelected && styles.periodOptionLabelSelected,
                ]}>
                  {option.label}
                </Text>
                <View style={[
                  styles.radioOuter,
                  isSelected && styles.radioOuterSelected,
                ]}>
                  {isSelected && <View style={styles.radioInner} />}
                </View>
              </View>
              <Text style={[
                styles.periodOptionDescription,
                isSelected && styles.periodOptionDescriptionSelected,
              ]}>
                {option.description}
              </Text>
              <Text style={[
                styles.periodOptionRate,
                isSelected && styles.periodOptionRateSelected,
              ]}>
                {rate}% p.a.
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const renderCalculationBreakdown = () => {
    if (!calculation) return null;

    return (
      <View style={styles.breakdownContainer}>
        <Text style={styles.sectionLabel}>Payment Breakdown</Text>
        
        <View style={styles.breakdownCard}>
          {/* Principal */}
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Principal Amount</Text>
            <Text style={styles.breakdownValue}>{formatCurrency(calculation.principal)}</Text>
          </View>

          {/* Interest */}
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>
              Interest ({calculation.interestRate}% p.a. for {calculation.repaymentDays} days)
            </Text>
            <Text style={styles.breakdownValue}>+ {formatCurrency(calculation.totalInterest)}</Text>
          </View>

          {/* Processing Fee */}
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Processing Fee (2%)</Text>
            <Text style={styles.breakdownValue}>+ {formatCurrency(calculation.processingFee)}</Text>
          </View>

          {/* Divider */}
          <View style={styles.breakdownDivider} />

          {/* Total Repayment */}
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabelTotal}>Total Repayment</Text>
            <Text style={styles.breakdownValueTotal}>{formatCurrency(calculation.totalRepayment)}</Text>
          </View>

          {/* EMI/Payment Amount */}
          <View style={styles.emiContainer}>
            <Text style={styles.emiLabel}>
              {repaymentPeriod === 'daily' ? 'Daily Payment' : 
               repaymentPeriod === 'weekly' ? 'Weekly Payment' : 'Monthly EMI'}
            </Text>
            <Text style={styles.emiValue}>{formatCurrency(calculation.emiAmount)}</Text>
            <Text style={styles.emiSubtext}>
              × {calculation.numberOfPayments} payments
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Pay to Wholesaler</Text>
      </View>

      {/* Wholesaler Info */}
      <View style={styles.wholesalerCard}>
        <View style={styles.wholesalerAvatar}>
          <Text style={styles.wholesalerAvatarText}>
            {wholesaler.business_name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.wholesalerInfo}>
          <Text style={styles.wholesalerName}>{wholesaler.business_name}</Text>
          <Text style={styles.wholesalerPhone}>{wholesaler.phone}</Text>
        </View>
      </View>

      {/* Available Credit */}
      <View style={styles.creditInfoCard}>
        <Text style={styles.creditInfoLabel}>Available Credit</Text>
        <Text style={styles.creditInfoValue}>
          {formatCurrency(creditFacility.available_credit)}
        </Text>
      </View>

      {/* Amount Input */}
      <View style={styles.amountContainer}>
        <Text style={styles.sectionLabel}>Payment Amount</Text>
        <View style={styles.amountInputContainer}>
          <Text style={styles.currencySymbol}>₹</Text>
          <TextInput
            style={styles.amountInput}
            value={amount}
            onChangeText={handleAmountChange}
            placeholder="0.00"
            placeholderTextColor="#999"
            keyboardType="decimal-pad"
            maxLength={10}
          />
        </View>
        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>

      {/* Quick Amount Buttons */}
      <View style={styles.quickAmountContainer}>
        {[1000, 5000, 10000, 25000].map((quickAmount) => (
          <TouchableOpacity
            key={quickAmount}
            style={[
              styles.quickAmountButton,
              quickAmount > creditFacility.available_credit && styles.quickAmountButtonDisabled,
            ]}
            onPress={() => {
              if (quickAmount <= creditFacility.available_credit) {
                setAmount(quickAmount.toString());
              }
            }}
            disabled={quickAmount > creditFacility.available_credit}
          >
            <Text style={[
              styles.quickAmountText,
              quickAmount > creditFacility.available_credit && styles.quickAmountTextDisabled,
            ]}>
              ₹{quickAmount.toLocaleString()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Repayment Period Selector */}
      {renderRepaymentPeriodSelector()}

      {/* Calculation Breakdown */}
      {renderCalculationBreakdown()}

      {/* Submit Button */}
      <TouchableOpacity
        style={[
          styles.submitButton,
          (!calculation || submitting) && styles.submitButtonDisabled,
        ]}
        onPress={handleSubmit}
        disabled={!calculation || submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.submitButtonText}>
            Proceed to UPI Mandate Setup
          </Text>
        )}
      </TouchableOpacity>

      {/* Terms */}
      <Text style={styles.termsText}>
        By proceeding, you agree to set up a UPI autopay mandate for the repayment schedule.
        The mandate will be used to automatically deduct payments on due dates.
      </Text>

      {/* Bottom Spacing */}
      <View style={styles.bottomSpacing} />
    </ScrollView>
  );
};

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    marginBottom: 8,
  },
  backButtonText: {
    color: '#FF6B35',
    fontSize: 16,
    fontWeight: '500',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  wholesalerCard: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginTop: 8,
  },
  wholesalerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  wholesalerAvatarText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  wholesalerInfo: {
    flex: 1,
  },
  wholesalerName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  wholesalerPhone: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  creditInfoCard: {
    backgroundColor: '#E8F5E9',
    padding: 16,
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  creditInfoLabel: {
    fontSize: 14,
    color: '#2E7D32',
  },
  creditInfoValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  amountContainer: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginTop: 8,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FAFAFA',
  },
  currencySymbol: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    padding: 0,
  },
  errorText: {
    color: '#E53935',
    fontSize: 12,
    marginTop: 8,
  },
  quickAmountContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  quickAmountButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  quickAmountButtonDisabled: {
    opacity: 0.5,
  },
  quickAmountText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  quickAmountTextDisabled: {
    color: '#999',
  },
  periodSelectorContainer: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginTop: 8,
  },
  periodOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  periodOption: {
    flex: 1,
    padding: 12,
    marginHorizontal: 4,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    backgroundColor: '#FAFAFA',
  },
  periodOptionSelected: {
    borderColor: '#FF6B35',
    backgroundColor: '#FFF3E0',
  },
  periodOptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  periodOptionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  periodOptionLabelSelected: {
    color: '#FF6B35',
  },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#CCC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioOuterSelected: {
    borderColor: '#FF6B35',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF6B35',
  },
  periodOptionDescription: {
    fontSize: 11,
    color: '#666',
    marginBottom: 4,
  },
  periodOptionDescriptionSelected: {
    color: '#E65100',
  },
  periodOptionRate: {
    fontSize: 12,
    fontWeight: '500',
    color: '#999',
  },
  periodOptionRateSelected: {
    color: '#FF6B35',
  },
  breakdownContainer: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginTop: 8,
  },
  breakdownCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  breakdownLabel: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  breakdownValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  breakdownDivider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 12,
  },
  breakdownLabelTotal: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  breakdownValueTotal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  emiContainer: {
    backgroundColor: '#FF6B35',
    borderRadius: 8,
    padding: 16,
    marginTop: 12,
    alignItems: 'center',
  },
  emiLabel: {
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.9,
    marginBottom: 4,
  },
  emiValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  emiSubtext: {
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.8,
    marginTop: 4,
  },
  submitButton: {
    backgroundColor: '#FF6B35',
    marginHorizontal: 16,
    marginTop: 16,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#CCC',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  termsText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    lineHeight: 18,
  },
  bottomSpacing: {
    height: 40,
  },
});

export default CreditPaymentForm;
