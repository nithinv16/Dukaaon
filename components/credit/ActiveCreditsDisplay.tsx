/**
 * ActiveCreditsDisplay - Component for displaying active credits
 * 
 * Implements Requirements 4.8:
 * - Show outstanding balance
 * - Display next payment date
 * - Show payment history
 * - Add prepayment option
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  RefreshControl,
} from 'react-native';
import {
  CreditService,
  CreditPayment,
  CreditPaymentHistory,
  formatCurrency,
  getRepaymentPeriodLabel,
} from '../../services/credit/CreditService';
import { useAuthStore } from '../../store/auth';

// ============================================================================
// Type Definitions
// ============================================================================

interface ActiveCreditsDisplayProps {
  onRefresh?: () => void;
}

interface CreditWithHistory extends CreditPayment {
  paymentHistory?: CreditPaymentHistory[];
  wholesalerName?: string;
}

// ============================================================================
// Component
// ============================================================================

export const ActiveCreditsDisplay: React.FC<ActiveCreditsDisplayProps> = ({
  onRefresh,
}) => {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCredits, setActiveCredits] = useState<CreditWithHistory[]>([]);
  const [totalOutstanding, setTotalOutstanding] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  // Prepayment modal state
  const [prepaymentModalVisible, setPrepaymentModalVisible] = useState(false);
  const [selectedCredit, setSelectedCredit] = useState<CreditWithHistory | null>(null);
  const [prepaymentAmount, setPrepaymentAmount] = useState('');
  const [processingPrepayment, setProcessingPrepayment] = useState(false);
  
  // Payment history modal state
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [selectedCreditHistory, setSelectedCreditHistory] = useState<CreditPaymentHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);


  // Load active credits data
  const loadData = useCallback(async () => {
    if (!user?.id) return;

    try {
      // Fetch active credits and total outstanding in parallel
      const [credits, outstanding] = await Promise.all([
        CreditService.getActiveCreditPayments(user.id),
        CreditService.getTotalOutstanding(user.id),
      ]);

      setActiveCredits(credits);
      setTotalOutstanding(outstanding);
      setError(null);
    } catch (err) {
      console.error('[ActiveCreditsDisplay] Error loading data:', err);
      setError('Failed to load credit information');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    onRefresh?.();
  }, [loadData, onRefresh]);

  // Load payment history for a specific credit
  const loadPaymentHistory = async (creditPaymentId: string) => {
    setLoadingHistory(true);
    try {
      const history = await CreditService.getPaymentHistory(creditPaymentId);
      setSelectedCreditHistory(history);
      setHistoryModalVisible(true);
    } catch (err) {
      console.error('[ActiveCreditsDisplay] Error loading history:', err);
      Alert.alert('Error', 'Failed to load payment history');
    } finally {
      setLoadingHistory(false);
    }
  };

  // Handle prepayment
  const handlePrepayment = async () => {
    if (!selectedCredit) return;

    const amount = parseFloat(prepaymentAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return;
    }

    if (amount > selectedCredit.outstanding_amount) {
      Alert.alert(
        'Amount Too High',
        `Maximum prepayment amount is ${formatCurrency(selectedCredit.outstanding_amount)}`
      );
      return;
    }

    setProcessingPrepayment(true);
    try {
      const result = await CreditService.makePrepayment(
        selectedCredit.id,
        amount,
        `PREPAY-${Date.now()}`
      );

      if (result.success) {
        Alert.alert(
          'Prepayment Successful',
          `Your prepayment of ${formatCurrency(amount)} has been processed. Remaining balance: ${formatCurrency(result.remainingBalance)}`,
          [{ text: 'OK', onPress: () => {
            setPrepaymentModalVisible(false);
            setPrepaymentAmount('');
            setSelectedCredit(null);
            loadData();
          }}]
        );
      }
    } catch (err: any) {
      Alert.alert('Prepayment Failed', err.message || 'Failed to process prepayment');
    } finally {
      setProcessingPrepayment(false);
    }
  };

  // Open prepayment modal
  const openPrepaymentModal = (credit: CreditWithHistory) => {
    setSelectedCredit(credit);
    setPrepaymentAmount('');
    setPrepaymentModalVisible(true);
  };

  // Format date for display
  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return '#4CAF50';
      case 'pending_mandate':
        return '#FF9800';
      case 'completed':
        return '#2196F3';
      case 'defaulted':
        return '#F44336';
      default:
        return '#757575';
    }
  };

  // Get status label
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active':
        return 'Active';
      case 'pending_mandate':
        return 'Pending Setup';
      case 'completed':
        return 'Completed';
      case 'defaulted':
        return 'Defaulted';
      default:
        return status;
    }
  };


  // Render total outstanding summary
  const renderSummary = () => {
    if (activeCredits.length === 0) return null;

    return (
      <View style={styles.summaryContainer}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total Outstanding</Text>
          <Text style={styles.summaryValue}>{formatCurrency(totalOutstanding)}</Text>
          <Text style={styles.summarySubtext}>
            {activeCredits.length} active credit{activeCredits.length !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>
    );
  };

  // Render individual credit item
  const renderCreditItem = ({ item }: { item: CreditWithHistory }) => {
    const daysUntilPayment = item.next_payment_date
      ? Math.ceil((new Date(item.next_payment_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null;

    return (
      <View style={styles.creditCard}>
        {/* Header with status */}
        <View style={styles.creditHeader}>
          <View style={styles.creditTitleContainer}>
            <Text style={styles.creditTitle}>Credit Payment</Text>
            <Text style={styles.creditId}>#{item.id.slice(0, 8)}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.statusText}>{getStatusLabel(item.status)}</Text>
          </View>
        </View>

        {/* Outstanding Balance */}
        <View style={styles.balanceContainer}>
          <Text style={styles.balanceLabel}>Outstanding Balance</Text>
          <Text style={styles.balanceValue}>{formatCurrency(item.outstanding_amount)}</Text>
          <View style={styles.progressContainer}>
            <View
              style={[
                styles.progressBar,
                {
                  width: `${((item.total_repayment - item.outstanding_amount) / item.total_repayment) * 100}%`,
                },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {formatCurrency(item.total_repayment - item.outstanding_amount)} of {formatCurrency(item.total_repayment)} paid
          </Text>
        </View>

        {/* Payment Details */}
        <View style={styles.detailsContainer}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Next Payment</Text>
            <View style={styles.detailValueContainer}>
              <Text style={styles.detailValue}>{formatDate(item.next_payment_date)}</Text>
              {daysUntilPayment !== null && daysUntilPayment >= 0 && (
                <Text style={[
                  styles.daysUntilPayment,
                  daysUntilPayment <= 3 && styles.daysUntilPaymentUrgent,
                ]}>
                  {daysUntilPayment === 0 ? 'Today' : 
                   daysUntilPayment === 1 ? 'Tomorrow' : 
                   `in ${daysUntilPayment} days`}
                </Text>
              )}
            </View>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>EMI Amount</Text>
            <Text style={styles.detailValue}>
              {formatCurrency(item.emi_amount)} / {getRepaymentPeriodLabel(item.repayment_period).toLowerCase()}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Interest Rate</Text>
            <Text style={styles.detailValue}>{item.interest_rate}% p.a.</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Started On</Text>
            <Text style={styles.detailValue}>{formatDate(item.created_at)}</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.historyButton}
            onPress={() => loadPaymentHistory(item.id)}
            disabled={loadingHistory}
          >
            <Text style={styles.historyButtonText}>📋 Payment History</Text>
          </TouchableOpacity>

          {item.status === 'active' && item.outstanding_amount > 0 && (
            <TouchableOpacity
              style={styles.prepayButton}
              onPress={() => openPrepaymentModal(item)}
            >
              <Text style={styles.prepayButtonText}>💰 Prepay</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  // Render empty state
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>💳</Text>
      <Text style={styles.emptyTitle}>No Active Credits</Text>
      <Text style={styles.emptySubtext}>
        You don't have any active credit payments.{'\n'}
        Use "Pay to Wholesaler" to get started.
      </Text>
    </View>
  );


  // Render prepayment modal
  const renderPrepaymentModal = () => (
    <Modal
      visible={prepaymentModalVisible}
      transparent
      animationType="slide"
      onRequestClose={() => setPrepaymentModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Make Prepayment</Text>
          
          {selectedCredit && (
            <>
              <View style={styles.modalInfoRow}>
                <Text style={styles.modalInfoLabel}>Outstanding Balance</Text>
                <Text style={styles.modalInfoValue}>
                  {formatCurrency(selectedCredit.outstanding_amount)}
                </Text>
              </View>

              <View style={styles.prepaymentInputContainer}>
                <Text style={styles.prepaymentInputLabel}>Prepayment Amount</Text>
                <View style={styles.prepaymentInputWrapper}>
                  <Text style={styles.currencySymbol}>₹</Text>
                  <TextInput
                    style={styles.prepaymentInput}
                    value={prepaymentAmount}
                    onChangeText={(text) => setPrepaymentAmount(text.replace(/[^0-9.]/g, ''))}
                    placeholder="0.00"
                    placeholderTextColor="#999"
                    keyboardType="decimal-pad"
                    maxLength={10}
                  />
                </View>
              </View>

              {/* Quick amount buttons */}
              <View style={styles.quickAmountContainer}>
                {[
                  { label: '25%', value: selectedCredit.outstanding_amount * 0.25 },
                  { label: '50%', value: selectedCredit.outstanding_amount * 0.5 },
                  { label: '100%', value: selectedCredit.outstanding_amount },
                ].map((option) => (
                  <TouchableOpacity
                    key={option.label}
                    style={styles.quickAmountButton}
                    onPress={() => setPrepaymentAmount(option.value.toFixed(2))}
                  >
                    <Text style={styles.quickAmountText}>{option.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => {
                    setPrepaymentModalVisible(false);
                    setPrepaymentAmount('');
                    setSelectedCredit(null);
                  }}
                >
                  <Text style={styles.modalCancelButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.modalConfirmButton,
                    processingPrepayment && styles.modalConfirmButtonDisabled,
                  ]}
                  onPress={handlePrepayment}
                  disabled={processingPrepayment}
                >
                  {processingPrepayment ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.modalConfirmButtonText}>Confirm Prepayment</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );

  // Render payment history modal
  const renderHistoryModal = () => (
    <Modal
      visible={historyModalVisible}
      transparent
      animationType="slide"
      onRequestClose={() => setHistoryModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, styles.historyModalContent]}>
          <View style={styles.historyModalHeader}>
            <Text style={styles.modalTitle}>Payment History</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setHistoryModalVisible(false)}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {selectedCreditHistory.length === 0 ? (
            <View style={styles.emptyHistoryContainer}>
              <Text style={styles.emptyHistoryText}>No payments recorded yet</Text>
            </View>
          ) : (
            <FlatList
              data={selectedCreditHistory}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.historyItem}>
                  <View style={styles.historyItemLeft}>
                    <Text style={styles.historyAmount}>{formatCurrency(item.amount)}</Text>
                    <Text style={styles.historyDate}>{formatDate(item.payment_date)}</Text>
                  </View>
                  <View style={styles.historyItemRight}>
                    <View style={[
                      styles.historyStatusBadge,
                      { backgroundColor: item.status === 'success' ? '#E8F5E9' : '#FFEBEE' },
                    ]}>
                      <Text style={[
                        styles.historyStatusText,
                        { color: item.status === 'success' ? '#2E7D32' : '#C62828' },
                      ]}>
                        {item.status === 'success' ? '✓ Paid' : '✗ Failed'}
                      </Text>
                    </View>
                    {item.transaction_id && (
                      <Text style={styles.historyTransactionId}>
                        {item.transaction_id.slice(0, 12)}...
                      </Text>
                    )}
                  </View>
                </View>
              )}
              style={styles.historyList}
            />
          )}
        </View>
      </View>
    </Modal>
  );


  // Loading state
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Loading active credits...</Text>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadData}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>📊 Active Credits</Text>
      <Text style={styles.sectionSubtitle}>
        Track your credit payments and make prepayments
      </Text>

      {renderSummary()}

      <FlatList
        data={activeCredits}
        renderItem={renderCreditItem}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={renderEmptyState}
        scrollEnabled={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#FF6B35']}
          />
        }
      />

      {renderPrepaymentModal()}
      {renderHistoryModal()}
    </View>
  );
};

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
    fontSize: 14,
  },
  errorContainer: {
    padding: 20,
    alignItems: 'center',
  },
  errorText: {
    color: '#E53935',
    fontSize: 14,
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  summaryContainer: {
    marginBottom: 16,
  },
  summaryCard: {
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#FF6B35',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#E65100',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#E65100',
  },
  summarySubtext: {
    fontSize: 12,
    color: '#F57C00',
    marginTop: 4,
  },
  creditCard: {
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  creditHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  creditTitleContainer: {
    flex: 1,
  },
  creditTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  creditId: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  balanceContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  balanceLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  balanceValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  progressContainer: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 11,
    color: '#666',
  },
  detailsContainer: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
  },
  detailValueContainer: {
    alignItems: 'flex-end',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  daysUntilPayment: {
    fontSize: 11,
    color: '#4CAF50',
    marginTop: 2,
  },
  daysUntilPaymentUrgent: {
    color: '#FF9800',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  historyButton: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  historyButtonText: {
    color: '#666',
    fontWeight: '500',
    fontSize: 14,
  },
  prepayButton: {
    flex: 1,
    backgroundColor: '#FF6B35',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  prepayButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  historyModalContent: {
    minHeight: '50%',
  },
  historyModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 20,
    color: '#666',
  },
  modalInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  modalInfoLabel: {
    fontSize: 14,
    color: '#666',
  },
  modalInfoValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  prepaymentInputContainer: {
    marginBottom: 16,
  },
  prepaymentInputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 8,
  },
  prepaymentInputWrapper: {
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
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginRight: 8,
  },
  prepaymentInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    padding: 0,
  },
  quickAmountContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 12,
  },
  quickAmountButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  quickAmountText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
  },
  modalCancelButtonText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 16,
  },
  modalConfirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#FF6B35',
    alignItems: 'center',
  },
  modalConfirmButtonDisabled: {
    backgroundColor: '#CCC',
  },
  modalConfirmButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
  // History modal styles
  historyList: {
    maxHeight: 400,
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  historyItemLeft: {
    flex: 1,
  },
  historyAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  historyDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  historyItemRight: {
    alignItems: 'flex-end',
  },
  historyStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  historyStatusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  historyTransactionId: {
    fontSize: 10,
    color: '#999',
    marginTop: 4,
  },
  emptyHistoryContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyHistoryText: {
    fontSize: 14,
    color: '#666',
  },
});

export default ActiveCreditsDisplay;
