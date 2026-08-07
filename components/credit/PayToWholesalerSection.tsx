/**
 * PayToWholesalerSection - Component for credit payment to wholesalers
 * 
 * Implements Requirements 4.1:
 * - Display "Pay to Wholesaler" section showing available credit limit
 * - Show list of connected wholesalers
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
} from 'react-native';
import { CreditService, CreditFacility } from '../../services/credit/CreditService';
import { KYCService, KYCStatusResult } from '../../services/credit/KYCService';
import { useAuthStore } from '../../store/auth';

// ============================================================================
// Type Definitions
// ============================================================================

interface Wholesaler {
  id: string;
  business_name: string;
  phone: string;
}

interface PayToWholesalerSectionProps {
  onSelectWholesaler: (wholesaler: Wholesaler) => void;
  onKYCRequired: () => void;
}

// ============================================================================
// Component
// ============================================================================

export const PayToWholesalerSection: React.FC<PayToWholesalerSectionProps> = ({
  onSelectWholesaler,
  onKYCRequired,
}) => {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [creditFacility, setCreditFacility] = useState<CreditFacility | null>(null);
  const [kycStatus, setKycStatus] = useState<KYCStatusResult | null>(null);
  const [wholesalers, setWholesalers] = useState<Wholesaler[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    setError(null);

    try {
      // Load credit facility and KYC status in parallel
      const [facility, kyc, connectedWholesalers] = await Promise.all([
        CreditService.getOrCreateCreditFacility(user.id),
        KYCService.checkKYCStatus(user.id),
        CreditService.getConnectedWholesalers(user.id),
      ]);

      setCreditFacility(facility);
      setKycStatus(kyc);
      setWholesalers(connectedWholesalers);
    } catch (err) {
      console.error('[PayToWholesalerSection] Error loading data:', err);
      setError('Failed to load credit information');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleWholesalerPress = (wholesaler: Wholesaler) => {
    if (!kycStatus?.isVerified) {
      Alert.alert(
        'KYC Required',
        'Please complete your KYC verification to use credit facilities.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Complete KYC', onPress: onKYCRequired },
        ]
      );
      return;
    }

    if (!creditFacility || creditFacility.available_credit <= 0) {
      Alert.alert(
        'No Credit Available',
        'You do not have any available credit. Please contact support.',
        [{ text: 'OK' }]
      );
      return;
    }

    onSelectWholesaler(wholesaler);
  };

  const renderKYCBanner = () => {
    if (!kycStatus) return null;

    if (kycStatus.isVerified) return null;

    return (
      <TouchableOpacity style={styles.kycBanner} onPress={onKYCRequired}>
        <View style={styles.kycBannerContent}>
          <Text style={styles.kycBannerTitle}>
            {kycStatus.status === 'pending' ? '⏳ KYC Pending' : '❌ KYC Rejected'}
          </Text>
          <Text style={styles.kycBannerText}>
            {kycStatus.status === 'pending'
              ? 'Complete your KYC to access credit facilities'
              : kycStatus.rejectionReason || 'Please resubmit your documents'}
          </Text>
        </View>
        <Text style={styles.kycBannerArrow}>→</Text>
      </TouchableOpacity>
    );
  };

  const renderCreditInfo = () => {
    if (!creditFacility || !kycStatus?.isVerified) return null;

    return (
      <View style={styles.creditInfoContainer}>
        <View style={styles.creditInfoRow}>
          <View style={styles.creditInfoItem}>
            <Text style={styles.creditInfoLabel}>Credit Limit</Text>
            <Text style={styles.creditInfoValue}>
              ₹{creditFacility.credit_limit.toLocaleString()}
            </Text>
          </View>
          <View style={styles.creditInfoItem}>
            <Text style={styles.creditInfoLabel}>Available</Text>
            <Text style={[styles.creditInfoValue, styles.availableCredit]}>
              ₹{creditFacility.available_credit.toLocaleString()}
            </Text>
          </View>
        </View>
        <View style={styles.creditProgressContainer}>
          <View
            style={[
              styles.creditProgressBar,
              {
                width: `${(creditFacility.available_credit / creditFacility.credit_limit) * 100}%`,
              },
            ]}
          />
        </View>
      </View>
    );
  };

  const renderWholesalerItem = ({ item }: { item: Wholesaler }) => (
    <TouchableOpacity
      style={styles.wholesalerItem}
      onPress={() => handleWholesalerPress(item)}
    >
      <View style={styles.wholesalerAvatar}>
        <Text style={styles.wholesalerAvatarText}>
          {item.business_name.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.wholesalerInfo}>
        <Text style={styles.wholesalerName}>{item.business_name}</Text>
        <Text style={styles.wholesalerPhone}>{item.phone}</Text>
      </View>
      <Text style={styles.wholesalerArrow}>→</Text>
    </TouchableOpacity>
  );

  const renderEmptyWholesalers = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>No wholesalers available</Text>
      <Text style={styles.emptySubtext}>
        No active wholesalers found in your area
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Loading credit information...</Text>
      </View>
    );
  }

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
      <Text style={styles.sectionTitle}>💳 Pay to Wholesaler</Text>
      <Text style={styles.sectionSubtitle}>
        Use your credit to pay wholesalers directly
      </Text>

      {renderKYCBanner()}
      {renderCreditInfo()}

      <Text style={styles.wholesalersTitle}>Available Wholesalers</Text>
      <FlatList
        data={wholesalers}
        renderItem={renderWholesalerItem}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={renderEmptyWholesalers}
        scrollEnabled={false}
      />
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
  kycBanner: {
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  kycBannerContent: {
    flex: 1,
  },
  kycBannerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E65100',
    marginBottom: 2,
  },
  kycBannerText: {
    fontSize: 12,
    color: '#F57C00',
  },
  kycBannerArrow: {
    fontSize: 20,
    color: '#FF9800',
    marginLeft: 8,
  },
  creditInfoContainer: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  creditInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  creditInfoItem: {
    flex: 1,
  },
  creditInfoLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  creditInfoValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  availableCredit: {
    color: '#4CAF50',
  },
  creditProgressContainer: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  creditProgressBar: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 4,
  },
  wholesalersTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  wholesalerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  wholesalerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  wholesalerAvatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  wholesalerInfo: {
    flex: 1,
  },
  wholesalerName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  wholesalerPhone: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  wholesalerArrow: {
    fontSize: 20,
    color: '#CCC',
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});

export default PayToWholesalerSection;
