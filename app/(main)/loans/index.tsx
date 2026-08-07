import React from 'react';
import { useEffect, useState, useRef, useMemo } from 'react';
import { View, StyleSheet, ScrollView, BackHandler, Alert, TouchableOpacity } from 'react-native';
import { Text, Button, TextInput, Card, SegmentedButtons, HelperText, ActivityIndicator, Menu, Portal } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEdgeToEdge, getSafeAreaStyles } from '../../../utils/android15EdgeToEdge';
import { useLanguage } from '../../../contexts/LanguageContext';
import { translationService } from '../../../services/translationService';
import { supabase } from '../../../services/supabase/supabase';
import { useAuthStore } from '../../../store/auth';
import { PRODUCT_CATEGORIES } from '../../../constants/categories';
import { PayToWholesalerSection, ActiveCreditsDisplay } from '../../../components/credit';

interface LoanApplicationForm {
  product_type: string;
  business_type: string;
  gstin: string;
  pan: string;
  avg_monthly_sales: string;
  inventory_turnover_days: string;
  requested_amount: string;
  tenure_value: string;
  tenure_unit: 'days' | 'months';
  repayment_frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
}

interface LoanApplication {
  id: string;
  request_id: string;
  product_type: string;
  business_type: string;
  requested_amount: number;
  tenure_months: number;
  tenure_unit?: string;
  repayment_frequency: string;
  status: 'draft' | 'submitted' | 'underwriting' | 'approved' | 'rejected' | 'disbursed';
  created_at: string;
  updated_at: string;
}

export default function Loans() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const insets = useEdgeToEdge({ statusBarStyle: 'dark' });
  const { currentLanguage } = useLanguage();
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [kycStatus, setKycStatus] = useState<boolean | null>(null);
  const [checkingKyc, setCheckingKyc] = useState(false);
  const [productTypeMenuVisible, setProductTypeMenuVisible] = useState(false);
  const [businessTypeMenuVisible, setBusinessTypeMenuVisible] = useState(false);
  const [productTypeAnchor, setProductTypeAnchor] = useState({ x: 0, y: 0 });
  const [businessTypeAnchor, setBusinessTypeAnchor] = useState({ x: 0, y: 0 });
  const productTypeAnchorRef = useRef<View>(null);
  const businessTypeAnchorRef = useRef<View>(null);
  const [loanApplications, setLoanApplications] = useState<LoanApplication[]>([]);
  const [loadingApplications, setLoadingApplications] = useState(false);

  const [form, setForm] = useState<LoanApplicationForm>({
    product_type: '',
    business_type: '',
    gstin: '',
    pan: '',
    avg_monthly_sales: '',
    inventory_turnover_days: '',
    requested_amount: '',
    tenure_value: '',
    tenure_unit: 'months',
    repayment_frequency: 'monthly',
  });

  const [kycData, setKycData] = useState<{
    business_name?: string;
    owner_name?: string;
    gstin?: string;
    pan?: string;
    business_address?: string;
    pincode?: string;
  } | null>(null);

  const [errors, setErrors] = useState<Partial<Record<keyof LoanApplicationForm | 'tenure_value', string>>>({});

  const originalTexts = {
    quickLoans: 'Quick Loans',
    getInstantApproval: 'Get instant approval for your financial needs',
    loanPlatformDescription: "We're building a comprehensive loan platform to help your business grow. Get access to quick financing solutions tailored for your needs.",
    quickBusinessLoans: 'Quick business loans with fast approval',
    flexibleRepayment: 'Flexible repayment options that suit your cash flow',
    competitiveRates: 'Competitive interest rates starting from 12% per annum',
    minimalDocumentation: 'Minimal documentation - just Aadhaar and PAN required',
    applyForLoan: 'Apply for Loan',
    interestSubmitted: 'Your interest has been submitted successfully!',
    error: 'Error',
    success: 'Success',
    tryAgain: 'Please try again',

    // Form fields
    productType: 'Product Type',
    productTypeRequired: 'Product type is required',
    businessType: 'Business Type',
    businessTypeRequired: 'Business type is required',
    gstin: 'GSTIN (Optional)',
    pan: 'PAN',
    panRequired: 'PAN is required',
    panInvalid: 'Please enter a valid PAN (e.g., ABCDE1234F)',
    avgMonthlySales: 'Average Monthly Sales (₹)',
    avgMonthlySalesRequired: 'Average monthly sales is required',
    inventoryTurnoverDays: 'Inventory Turnover Days',
    inventoryTurnoverDaysRequired: 'Inventory turnover days is required',
    requestedAmount: 'Requested Loan Amount (₹)',
    requestedAmountRequired: 'Requested loan amount is required',
    tenureMonths: 'Tenure (Months)',
    tenureMonthsRequired: 'Tenure is required',
    repaymentFrequency: 'Repayment Frequency',
    daily: 'Daily',
    weekly: 'Weekly',
    biweekly: 'Bi-weekly',
    monthly: 'Monthly',
    tenureDays: 'Days',
    tenureMonths: 'Months',
    tenureValue: 'Tenure',
    tenureUnit: 'Tenure Unit',
    selectProductType: 'Select Product Type',
    selectBusinessType: 'Select Business Type',
    submitApplication: 'Submit Application',
    myApplications: 'My Loan Applications',
    noApplications: 'You have not applied for any loans yet.',
    applicationId: 'Application ID',
    amount: 'Amount',
    tenure: 'Tenure',
    months: 'months',
    days: 'days',
    statusLabel: 'Status',
    appliedOn: 'Applied on',
    viewDetails: 'View Details',
    statusDraft: 'Draft',
    statusSubmitted: 'Submitted',
    statusUnderwriting: 'Under Review',
    statusApproved: 'Approved',
    statusRejected: 'Rejected',
    statusDisbursed: 'Disbursed',
    cancel: 'Cancel',
    back: 'Back',
    loginRequired: 'Please log in to apply for a loan',
    kycRequired: 'KYC Verification Required',
    kycNotSubmitted: 'Please complete your KYC verification before applying for a loan. Go to Profile to submit your KYC documents.',
    goToProfile: 'Go to Profile',
    kycPending: 'Your KYC is under review. You cannot apply for a loan until your KYC is verified.',
    checkingKyc: 'Checking KYC status...',
    checking: 'Checking...',
    failedToCheckKyc: 'Failed to check KYC status. Please try again.',
    loadingApplications: 'Loading applications...',
    enterValidAmount: 'Please enter a valid amount',
    enterValidNumber: 'Please enter a valid number',
    tenureMinDays: 'Tenure must be at least 1 day',
    tenureMinMonths: 'Tenure must be at least 1 month',
    ok: 'OK',
    // Product type labels
    groceries: 'Groceries',
    beverages: 'Beverages',
    snacks: 'Snacks & Packaged Foods',
    household: 'Household Care',
    personalCare: 'Personal Care',
    // Business type labels
    retailer: 'Retailer',
    wholesaler: 'Wholesaler',
    manufacturer: 'Manufacturer',
    distributor: 'Distributor',
    importer: 'Importer',
    exporter: 'Exporter',
    trader: 'Trader',
    other: 'Other',
    // KYC info
    kycAutoFilled: 'KYC data auto-filled from your profile',
  };

  useEffect(() => {
    const loadTranslations = async () => {
      try {
        if (!currentLanguage || currentLanguage === 'en') {
          setTranslations(originalTexts);
          return;
        }

        const translationPromises = Object.entries(originalTexts).map(async ([key, value]) => {
          const translated = await translationService.translateText(value, currentLanguage);
          return [key, translated?.translatedText || value];
        });

        const translatedEntries = await Promise.all(translationPromises);
        const newTranslations = Object.fromEntries(translatedEntries);
        setTranslations(newTranslations);
      } catch (error) {
        console.error('Error loading translations:', error);
        setTranslations(originalTexts);
      }
    };

    loadTranslations();
  }, [currentLanguage]);

  const t = (key: keyof typeof originalTexts) => {
    return translations[key] || originalTexts[key] || key;
  };

  // Product type options from categories (with translation) - memoized to update when translations change
  // Explicitly ensure useMemo is available (prevents production build issues)
  const productTypeOptions = React.useMemo(() => {
    const productTypeMap: Record<string, string> = {
      groceries: 'groceries',
      beverages: 'beverages',
      snacks: 'snacks',
      household: 'household',
      'personal-care': 'personalCare',
    };
    return PRODUCT_CATEGORIES.map(cat => ({
      value: cat.id,
      label: productTypeMap[cat.id] ? t(productTypeMap[cat.id] as keyof typeof originalTexts) : cat.name,
    }));
  }, [translations, t]);

  // Business type options (with translation) - memoized to update when translations change
  // Explicitly use React.useMemo to prevent production build issues
  const businessTypeOptions = React.useMemo(() => {
    return [
      { value: 'retailer', label: t('retailer') },
      { value: 'wholesaler', label: t('wholesaler') },
      { value: 'manufacturer', label: t('manufacturer') },
      { value: 'distributor', label: t('distributor') },
      { value: 'importer', label: t('importer') },
      { value: 'exporter', label: t('exporter') },
      { value: 'trader', label: t('trader') },
      { value: 'other', label: t('other') },
    ];
  }, [translations, t]);

  // Check KYC status when component mounts or user changes
  useEffect(() => {
    const checkKycStatus = async () => {
      if (!user?.id) {
        setKycStatus(null);
        return;
      }

      try {
        setCheckingKyc(true);
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('kyc_status')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Error checking KYC status:', error);
          setKycStatus(null);
        } else {
          // kyc_status can be boolean (true/false) or null
          setKycStatus(profile?.kyc_status === true || profile?.kyc_status === 'verified' || profile?.kyc_status === 'active');
        }
      } catch (error) {
        console.error('Error checking KYC status:', error);
        setKycStatus(null);
      } finally {
        setCheckingKyc(false);
      }
    };

    checkKycStatus();
  }, [user?.id]);

  // Fetch loan applications when component mounts or user changes
  useEffect(() => {
    const fetchLoanApplications = async () => {
      if (!user?.id) {
        setLoanApplications([]);
        return;
      }

      try {
        setLoadingApplications(true);
        const { data, error } = await supabase
          .from('loan_applications')
          .select('*')
          .eq('created_by', user.id)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching loan applications:', error);
          setLoanApplications([]);
        } else {
          setLoanApplications(data || []);
        }
      } catch (error) {
        console.error('Error fetching loan applications:', error);
        setLoanApplications([]);
      } finally {
        setLoadingApplications(false);
      }
    };

    fetchLoanApplications();
  }, [user?.id]);

  // Fetch retailer KYC data when form is shown
  useEffect(() => {
    const fetchKycData = async () => {
      if (!showForm || !user?.id) return;

      // Don't fetch if KYC is not verified
      if (kycStatus !== true) {
        return;
      }

      try {
        setLoading(true);

        // Fetch profile with business_details
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('business_details')
          .eq('id', user.id)
          .single();

        if (profileError) {
          console.error('Error fetching profile:', profileError);
        }

        // Fetch seller_details if exists (for sellers who are also retailers)
        // Note: seller_details may not have gst_number column, so we only fetch business_name, owner_name, address
        const { data: sellerDetails, error: sellerError } = await supabase
          .from('seller_details')
          .select('business_name, owner_name, address')
          .eq('user_id', user.id)
          .maybeSingle();

        if (sellerError && sellerError.code !== 'PGRST116') {
          console.error('Error fetching seller details:', sellerError);
        }

        // Extract KYC data from profile.business_details (primary source for retailers)
        const businessDetails = profile?.business_details || {};

        // Parse address from seller_details if it's JSONB
        let sellerAddress = '';
        if (sellerDetails?.address) {
          if (typeof sellerDetails.address === 'string') {
            sellerAddress = sellerDetails.address;
          } else if (typeof sellerDetails.address === 'object') {
            sellerAddress = sellerDetails.address.street ||
              sellerDetails.address.location_address ||
              JSON.stringify(sellerDetails.address);
          }
        }

        const extractedKyc: typeof kycData = {
          business_name: sellerDetails?.business_name || businessDetails?.shopName || '',
          owner_name: sellerDetails?.owner_name || businessDetails?.ownerName || '',
          gstin: businessDetails?.gstNumber || '', // GSTIN comes from business_details for retailers
          pan: '', // PAN is typically entered separately in loan form, not stored in KYC
          business_address: sellerAddress ||
            (typeof businessDetails?.address === 'string'
              ? businessDetails.address
              : (businessDetails?.address?.street || businessDetails?.address || '')),
          pincode: businessDetails?.pincode || '',
        };

        setKycData(extractedKyc);

        // Auto-fill form fields if KYC data exists
        if (extractedKyc.business_name || extractedKyc.owner_name || extractedKyc.gstin) {
          setForm(prev => ({
            ...prev,
            gstin: prev.gstin || extractedKyc.gstin || '',
            // Note: PAN might not be in business_details, so we don't auto-fill it
            // Business type and product type are user inputs, not from KYC
          }));
        }
      } catch (error) {
        console.error('Error fetching KYC data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchKycData();
  }, [showForm, user?.id, kycStatus]);

  // Handle back button navigation
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showForm) {
        setShowForm(false);
        return true;
      }
      if (router.canGoBack()) {
        router.back();
        return true;
      } else {
        router.replace('/(main)/home');
        return true;
      }
    });

    return () => backHandler.remove();
  }, [router, showForm]);

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof LoanApplicationForm | 'tenure_value', string>> = {};

    if (!form.product_type.trim()) {
      newErrors.product_type = t('productTypeRequired');
    }
    if (!form.business_type.trim()) {
      newErrors.business_type = t('businessTypeRequired');
    }
    if (!form.pan.trim()) {
      newErrors.pan = t('panRequired');
    } else if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(form.pan.toUpperCase())) {
      newErrors.pan = t('panInvalid');
    }
    if (!form.avg_monthly_sales.trim()) {
      newErrors.avg_monthly_sales = t('avgMonthlySalesRequired');
    } else if (isNaN(parseFloat(form.avg_monthly_sales)) || parseFloat(form.avg_monthly_sales) <= 0) {
      newErrors.avg_monthly_sales = t('enterValidAmount');
    }
    if (!form.inventory_turnover_days.trim()) {
      newErrors.inventory_turnover_days = t('inventoryTurnoverDaysRequired');
    } else if (isNaN(parseInt(form.inventory_turnover_days)) || parseInt(form.inventory_turnover_days) < 0) {
      newErrors.inventory_turnover_days = t('enterValidNumber');
    }
    if (!form.requested_amount.trim()) {
      newErrors.requested_amount = t('requestedAmountRequired');
    } else if (isNaN(parseFloat(form.requested_amount)) || parseFloat(form.requested_amount) <= 0) {
      newErrors.requested_amount = t('enterValidAmount');
    }
    if (!form.tenure_value.trim()) {
      newErrors.tenure_value = t('tenureMonthsRequired');
    } else if (isNaN(parseInt(form.tenure_value)) || parseInt(form.tenure_value) <= 0) {
      newErrors.tenure_value = t('enterValidNumber');
    } else if (form.tenure_unit === 'days' && parseInt(form.tenure_value) < 1) {
      newErrors.tenure_value = t('tenureMinDays');
    } else if (form.tenure_unit === 'months' && parseInt(form.tenure_value) < 1) {
      newErrors.tenure_value = t('tenureMinMonths');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    if (!user?.id) {
      Alert.alert(t('error'), t('loginRequired'));
      return;
    }

    // Check KYC status before submitting
    if (kycStatus !== true) {
      Alert.alert(
        t('kycRequired'),
        t('kycNotSubmitted'),
        [
          {
            text: t('cancel'),
            style: 'cancel',
          },
          {
            text: t('goToProfile'),
            onPress: () => {
              setShowForm(false);
              router.push('/(main)/profile');
            },
          },
        ]
      );
      return;
    }

    setSubmitting(true);
    try {
      // Generate a unique request_id
      const request_id = `LOAN-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      // Convert tenure to months for storage (if in days, convert to approximate months)
      let tenure_months: number;
      if (form.tenure_unit === 'days') {
        // Convert days to months (approximate: 30 days = 1 month)
        tenure_months = Math.ceil(parseInt(form.tenure_value) / 30);
      } else {
        tenure_months = parseInt(form.tenure_value);
      }

      const applicationData = {
        request_id,
        product_type: form.product_type.trim(),
        business_type: form.business_type.trim(),
        gstin: form.gstin.trim() || null,
        pan: form.pan.toUpperCase().trim(),
        avg_monthly_sales: parseFloat(form.avg_monthly_sales),
        inventory_turnover_days: parseInt(form.inventory_turnover_days),
        requested_amount: parseFloat(form.requested_amount),
        tenure_months,
        tenure_unit: form.tenure_unit,
        repayment_frequency: form.repayment_frequency,
        // Store KYC data that was auto-fetched
        kyc_business_name: kycData?.business_name || null,
        kyc_owner_name: kycData?.owner_name || null,
        kyc_gstin: kycData?.gstin || null,
        kyc_pan: kycData?.pan || null,
        kyc_business_address: kycData?.business_address || null,
        kyc_pincode: kycData?.pincode || null,
        status: 'draft',
        created_by: user.id,
      };

      const { error } = await supabase
        .from('loan_applications')
        .insert(applicationData);

      if (error) {
        console.error('Error submitting loan application:', error);
        throw error;
      }

      Alert.alert(
        t('success'),
        t('interestSubmitted'),
        [
          {
            text: t('ok'),
            onPress: async () => {
              setShowForm(false);
              // Reset form
              setForm({
                product_type: '',
                business_type: '',
                gstin: '',
                pan: '',
                avg_monthly_sales: '',
                inventory_turnover_days: '',
                requested_amount: '',
                tenure_value: '',
                tenure_unit: 'months',
                repayment_frequency: 'monthly',
              });
              // Refresh loan applications list
              if (user?.id) {
                const { data } = await supabase
                  .from('loan_applications')
                  .select('*')
                  .eq('created_by', user.id)
                  .order('created_at', { ascending: false });
                setLoanApplications(data || []);
              }
              setKycData(null);
              setErrors({});
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Error submitting loan application:', error);
      Alert.alert(t('error'), error.message || t('tryAgain'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.safeArea, getSafeAreaStyles(insets), styles.centerContent]}>
        <ActivityIndicator size="large" color="#FF7D00" />
      </View>
    );
  }

  if (showForm) {
    // Show KYC required message if KYC is not verified
    if (kycStatus !== true) {
      return (
        <View style={[styles.safeArea, getSafeAreaStyles(insets)]}>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={[styles.scrollContent, styles.kycMessageContent]}
            showsVerticalScrollIndicator={false}
          >
            <Card style={styles.kycMessageCard}>
              <Card.Content>
                <Text variant="headlineSmall" style={styles.kycMessageTitle}>
                  {t('kycRequired')}
                </Text>
                <Text variant="bodyMedium" style={styles.kycMessageText}>
                  {checkingKyc ? t('checkingKyc') : t('kycNotSubmitted')}
                </Text>
                {!checkingKyc && (
                  <Button
                    mode="contained"
                    onPress={() => {
                      setShowForm(false);
                      router.push('/(main)/profile');
                    }}
                    style={styles.kycButton}
                    buttonColor="#FF7D00"
                  >
                    {t('goToProfile')}
                  </Button>
                )}
                <Button
                  mode="outlined"
                  onPress={() => setShowForm(false)}
                  style={styles.kycButton}
                >
                  {t('back')}
                </Button>
              </Card.Content>
            </Card>
          </ScrollView>
        </View>
      );
    }

    return (
      <View style={[styles.safeArea, getSafeAreaStyles(insets)]}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 }]}
          showsVerticalScrollIndicator={true}
        >
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="headlineSmall" style={styles.formTitle}>
                {t('applyForLoan')}
              </Text>

              {/* Product Type Dropdown */}
              <View style={styles.input}>
                <Text variant="bodyMedium" style={styles.label}>
                  {t('productType')} <Text style={styles.required}>*</Text>
                </Text>
                <View ref={productTypeAnchorRef} collapsable={false}>
                  <Menu
                    visible={productTypeMenuVisible}
                    onDismiss={() => setProductTypeMenuVisible(false)}
                    anchor={
                      <TouchableOpacity
                        onPress={() => setProductTypeMenuVisible(true)}
                        style={[
                          styles.dropdownContainer,
                          errors.product_type && styles.dropdownError,
                        ]}
                      >
                        <Text
                          style={[
                            styles.dropdownText,
                            !form.product_type && styles.dropdownPlaceholder,
                          ]}
                        >
                          {form.product_type
                            ? productTypeOptions.find((opt) => opt.value === form.product_type)?.label ||
                            form.product_type
                            : t('selectProductType')}
                        </Text>
                        <Text style={styles.dropdownIcon}>▼</Text>
                      </TouchableOpacity>
                    }
                    contentStyle={styles.menuContent}
                    style={styles.menuWrapper}
                  >
                    {productTypeOptions.map((option) => (
                      <Menu.Item
                        key={option.value}
                        onPress={() => {
                          setForm({ ...form, product_type: option.value });
                          setProductTypeMenuVisible(false);
                          // Clear error when selection is made
                          if (errors.product_type) {
                            setErrors((prev) => ({ ...prev, product_type: undefined }));
                          }
                        }}
                        title={option.label}
                      />
                    ))}
                  </Menu>
                </View>
                {errors.product_type && (
                  <HelperText type="error" style={styles.errorHelper}>
                    {errors.product_type}
                  </HelperText>
                )}
              </View>

              {/* Business Type Dropdown */}
              <View style={styles.input}>
                <Text variant="bodyMedium" style={styles.label}>
                  {t('businessType')} <Text style={styles.required}>*</Text>
                </Text>
                <View ref={businessTypeAnchorRef} collapsable={false}>
                  <Menu
                    visible={businessTypeMenuVisible}
                    onDismiss={() => setBusinessTypeMenuVisible(false)}
                    anchor={
                      <TouchableOpacity
                        onPress={() => setBusinessTypeMenuVisible(true)}
                        style={[
                          styles.dropdownContainer,
                          errors.business_type && styles.dropdownError,
                        ]}
                      >
                        <Text
                          style={[
                            styles.dropdownText,
                            !form.business_type && styles.dropdownPlaceholder,
                          ]}
                        >
                          {form.business_type
                            ? businessTypeOptions.find((opt) => opt.value === form.business_type)?.label ||
                            form.business_type
                            : t('selectBusinessType')}
                        </Text>
                        <Text style={styles.dropdownIcon}>▼</Text>
                      </TouchableOpacity>
                    }
                    contentStyle={styles.menuContent}
                    style={styles.menuWrapper}
                  >
                    {businessTypeOptions.map((option) => (
                      <Menu.Item
                        key={option.value}
                        onPress={() => {
                          setForm({ ...form, business_type: option.value });
                          setBusinessTypeMenuVisible(false);
                          // Clear error when selection is made
                          if (errors.business_type) {
                            setErrors((prev) => ({ ...prev, business_type: undefined }));
                          }
                        }}
                        title={option.label}
                      />
                    ))}
                  </Menu>
                </View>
                {errors.business_type && (
                  <HelperText type="error" style={styles.errorHelper}>
                    {errors.business_type}
                  </HelperText>
                )}
              </View>

              {kycData && (kycData.business_name || kycData.owner_name || kycData.gstin) && (
                <View style={styles.kycInfoCard}>
                  <Text variant="bodySmall" style={styles.kycInfoText}>
                    ✓ {t('kycAutoFilled')}
                  </Text>
                </View>
              )}

              <TextInput
                mode="outlined"
                label={t('gstin')}
                value={form.gstin}
                onChangeText={(text) => setForm({ ...form, gstin: text.toUpperCase() })}
                error={!!errors.gstin}
                style={styles.input}
                maxLength={15}
              />
              {errors.gstin && <HelperText type="error">{errors.gstin}</HelperText>}

              <TextInput
                mode="outlined"
                label={t('pan')}
                value={form.pan}
                onChangeText={(text) => setForm({ ...form, pan: text.toUpperCase() })}
                error={!!errors.pan}
                style={styles.input}
                maxLength={10}
              />
              {errors.pan && <HelperText type="error">{errors.pan}</HelperText>}

              <TextInput
                mode="outlined"
                label={t('avgMonthlySales')}
                value={form.avg_monthly_sales}
                onChangeText={(text) => setForm({ ...form, avg_monthly_sales: text.replace(/[^0-9.]/g, '') })}
                keyboardType="decimal-pad"
                error={!!errors.avg_monthly_sales}
                style={styles.input}
              />
              {errors.avg_monthly_sales && (
                <HelperText type="error">{errors.avg_monthly_sales}</HelperText>
              )}

              <TextInput
                mode="outlined"
                label={t('inventoryTurnoverDays')}
                value={form.inventory_turnover_days}
                onChangeText={(text) => setForm({ ...form, inventory_turnover_days: text.replace(/[^0-9]/g, '') })}
                keyboardType="number-pad"
                error={!!errors.inventory_turnover_days}
                style={styles.input}
              />
              {errors.inventory_turnover_days && (
                <HelperText type="error">{errors.inventory_turnover_days}</HelperText>
              )}

              <TextInput
                mode="outlined"
                label={t('requestedAmount')}
                value={form.requested_amount}
                onChangeText={(text) => setForm({ ...form, requested_amount: text.replace(/[^0-9.]/g, '') })}
                keyboardType="decimal-pad"
                error={!!errors.requested_amount}
                style={styles.input}
              />
              {errors.requested_amount && (
                <HelperText type="error">{errors.requested_amount}</HelperText>
              )}

              <View style={styles.tenureContainer}>
                <TextInput
                  mode="outlined"
                  label={t('tenureValue')}
                  value={form.tenure_value}
                  onChangeText={(text) => setForm({ ...form, tenure_value: text.replace(/[^0-9]/g, '') })}
                  keyboardType="number-pad"
                  error={!!errors.tenure_value}
                  style={[styles.input, styles.tenureInput]}
                />
                <View style={styles.tenureUnitContainer}>
                  <Text variant="bodyMedium" style={styles.segmentLabel}>
                    {t('tenureUnit')}
                  </Text>
                  <SegmentedButtons
                    value={form.tenure_unit}
                    onValueChange={(value) => setForm({ ...form, tenure_unit: value as 'days' | 'months' })}
                    buttons={[
                      { value: 'days', label: t('tenureDays') },
                      { value: 'months', label: t('tenureMonths') },
                    ]}
                    style={styles.tenureUnitButtons}
                  />
                </View>
                {errors.tenure_value && (
                  <HelperText type="error">{errors.tenure_value}</HelperText>
                )}
              </View>

              <View style={styles.segmentContainer}>
                <Text variant="bodyMedium" style={styles.segmentLabel}>
                  {t('repaymentFrequency')}
                </Text>
                <SegmentedButtons
                  value={form.repayment_frequency}
                  onValueChange={(value) => setForm({ ...form, repayment_frequency: value as any })}
                  buttons={[
                    { value: 'daily', label: t('daily') },
                    { value: 'weekly', label: t('weekly') },
                    { value: 'biweekly', label: t('biweekly') },
                    { value: 'monthly', label: t('monthly') },
                  ]}
                />
              </View>

              <View style={styles.buttonContainer}>
                <Button
                  mode="outlined"
                  onPress={() => setShowForm(false)}
                  style={styles.button}
                  disabled={submitting}
                >
                  {t('cancel')}
                </Button>
                <Button
                  mode="contained"
                  onPress={handleSubmit}
                  style={[styles.button, styles.submitButton]}
                  loading={submitting}
                  disabled={submitting}
                >
                  {t('submitApplication')}
                </Button>
              </View>
            </Card.Content>
          </Card>
        </ScrollView>
      </View>
    );
  }

  // Helper functions for status and formatting
  const getStatusColor = (status: LoanApplication['status']) => {
    switch (status) {
      case 'approved': return '#4CAF50';
      case 'rejected': return '#f44336';
      case 'disbursed': return '#2196F3';
      case 'underwriting': return '#FF9800';
      case 'submitted': return '#9C27B0';
      default: return '#757575';
    }
  };

  const getStatusText = (status: LoanApplication['status']) => {
    const map: Record<string, string> = {
      draft: 'statusDraft',
      submitted: 'statusSubmitted',
      underwriting: 'statusUnderwriting',
      approved: 'statusApproved',
      rejected: 'statusRejected',
      disbursed: 'statusDisbursed',
    };
    return t(map[status] || status);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  /**
   * Handle wholesaler selection from PayToWholesalerSection
   * Requirements 4.1: Show list of connected wholesalers
   */
  const handleSelectWholesaler = (wholesaler: { id: string; business_name: string; phone: string }) => {
    // Navigate to credit payment form with query params
    router.push(`/(main)/credit/payment?wholesalerId=${wholesaler.id}&wholesalerName=${encodeURIComponent(wholesaler.business_name)}`);
  };

  /**
   * Handle KYC required - redirect to KYC flow
   * Requirements 4.4: Redirect to KYC flow for unverified users
   */
  const handleKYCRequired = () => {
    router.push('/(main)/kyc');
  };

  return (
    <View style={[styles.safeArea, getSafeAreaStyles(insets)]}>
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 }]}>
        <View style={styles.container}>
          <View style={styles.heroCard}>
            <View style={styles.heroHeader}>
              <View style={styles.heroIconContainer}>
                <Ionicons name="cash-outline" size={32} color="#FF7D00" />
              </View>
              <View style={styles.heroHeaderText}>
                <Text style={styles.heroTitle}>{t('quickLoans')}</Text>
                <Text style={styles.heroSubtitle}>{t('getInstantApproval')}</Text>
              </View>
            </View>

            <Text style={styles.heroDescription}>
              {t('loanPlatformDescription')}
            </Text>

            <View style={styles.featuresList}>
              <View style={styles.featureRow}>
                <Ionicons name="flash" size={18} color="#FF7D00" />
                <Text style={styles.featureText}>{t('quickBusinessLoans')}</Text>
              </View>
              <View style={styles.featureRow}>
                <Ionicons name="calendar" size={18} color="#FF7D00" />
                <Text style={styles.featureText}>{t('flexibleRepayment')}</Text>
              </View>
              <View style={styles.featureRow}>
                <Ionicons name="trending-up" size={18} color="#FF7D00" />
                <Text style={styles.featureText}>{t('competitiveRates')}</Text>
              </View>
              <View style={styles.featureRow}>
                <Ionicons name="document-text" size={18} color="#FF7D00" />
                <Text style={styles.featureText}>{t('minimalDocumentation')}</Text>
              </View>
            </View>

            <Button
              mode="contained"
              onPress={async () => {
                if (!user?.id) {
                  Alert.alert(t('error'), t('loginRequired'));
                  return;
                }

                try {
                  setCheckingKyc(true);
                  const { data: profile, error } = await supabase
                    .from('profiles')
                    .select('kyc_status')
                    .eq('id', user.id)
                    .single();

                  if (error) {
                    console.error('Error checking KYC status:', error);
                    Alert.alert(t('error'), t('failedToCheckKyc'));
                    return;
                  }

                  const isKycVerified = profile?.kyc_status === true ||
                    profile?.kyc_status === 'verified' ||
                    profile?.kyc_status === 'active';

                  if (!isKycVerified) {
                    Alert.alert(
                      t('kycRequired'),
                      t('kycNotSubmitted'),
                      [
                        { text: t('cancel'), style: 'cancel' },
                        { text: t('goToProfile'), onPress: () => router.push('/(main)/profile') },
                      ]
                    );
                    return;
                  }

                  setKycStatus(isKycVerified);
                  setShowForm(true);
                } catch (error) {
                  console.error('Error checking KYC status:', error);
                  Alert.alert(t('error'), t('failedToCheckKyc'));
                } finally {
                  setCheckingKyc(false);
                }
              }}
              style={styles.applyButton}
              contentStyle={styles.applyButtonContent}
              labelStyle={styles.applyButtonLabel}
              loading={checkingKyc}
              disabled={checkingKyc}
            >
              {checkingKyc ? t('checking') : t('applyForLoan')}
            </Button>
          </View>

          {/* Show existing loan applications */}
          {loadingApplications ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#FF7D00" />
              <Text style={styles.loadingText}>{t('loadingApplications')}</Text>
            </View>
          ) : loanApplications.length > 0 ? (
            <View style={styles.applicationsSection}>
              <Text variant="titleLarge" style={styles.sectionTitle}>
                {t('myApplications')}
              </Text>
              {loanApplications.map((application) => (
                <View key={application.id} style={styles.applicationCard}>
                  <View style={styles.cardHeader}>
                    <View>
                      <Text style={styles.applicationIdLabel}>{t('applicationId')}</Text>
                      <Text style={styles.applicationIdValue}>{application.request_id}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(application.status) + '20', borderColor: getStatusColor(application.status) }]}>
                      <Text style={[styles.statusText, { color: getStatusColor(application.status) }]}>{getStatusText(application.status)}</Text>
                    </View>
                  </View>

                  <View style={styles.cardDivider} />

                  <View style={styles.cardRow}>
                    <View style={styles.cardColumn}>
                      <Text style={styles.cardLabel}>{t('amount')}</Text>
                      <Text style={styles.cardValue}>₹{application.requested_amount.toLocaleString('en-IN')}</Text>
                    </View>
                    <View style={styles.cardColumn}>
                      <Text style={styles.cardLabel}>{t('tenure')}</Text>
                      <Text style={styles.cardValue}>
                        {application.tenure_months} {application.tenure_unit === 'days' ? t('days') : t('months')}
                      </Text>
                    </View>
                    <View style={styles.cardColumn}>
                      <Text style={styles.cardLabel}>{t('appliedOn')}</Text>
                      <Text style={styles.cardValue}>{formatDate(application.created_at)}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          {/* Pay to Wholesaler Section - Requirements 4.1 */}
          <PayToWholesalerSection
            onSelectWholesaler={handleSelectWholesaler}
            onKYCRequired={handleKYCRequired}
          />

          {/* Active Credits Display - Requirements 4.8 */}
          <ActiveCreditsDisplay />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  container: {
    flex: 1,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Hero Card Styles
  heroCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#FF7D00',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#FFF3E0',
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  heroIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: '#FFF3E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  heroHeaderText: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  heroDescription: {
    fontSize: 15,
    color: '#444',
    lineHeight: 22,
    marginBottom: 24,
  },
  featuresList: {
    marginBottom: 24,
    backgroundColor: '#FAFAFA',
    padding: 16,
    borderRadius: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureText: {
    marginLeft: 12,
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  applyButton: {
    borderRadius: 16,
    backgroundColor: '#FF7D00',
    shadowColor: '#FF7D00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  applyButtonContent: {
    height: 54,
  },
  applyButtonLabel: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // Applications List
  applicationsSection: {
    marginTop: 8,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  applicationCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  applicationIdLabel: {
    fontSize: 11,
    color: '#999',
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  applicationIdValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#F5F5F5',
    marginBottom: 16,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardColumn: {
    flex: 1,
  },
  cardLabel: {
    fontSize: 11,
    color: '#999',
    marginBottom: 4,
    fontWeight: '500',
  },
  cardValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },

  // Form Styles
  formTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 24,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 8, // Inner padding handles spacing
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
    marginBottom: 24,
  },
  input: {
    marginBottom: 20,
    backgroundColor: '#fff',
    fontSize: 15,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#444',
    marginBottom: 8,
  },
  required: {
    color: '#FF7D00',
  },
  dropdownContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FAFAFA',
  },
  dropdownError: {
    borderColor: '#d32f2f',
    backgroundColor: '#ffebee',
  },
  dropdownText: {
    flex: 1,
    fontSize: 15,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  dropdownPlaceholder: {
    color: '#999',
  },
  dropdownIcon: {
    fontSize: 12,
    color: '#666',
  },
  menuWrapper: {
    borderRadius: 14,
    marginTop: 4,
  },
  menuContent: {
    borderRadius: 14,
    backgroundColor: '#fff',
    elevation: 8,
  },
  errorHelper: {
    color: '#d32f2f',
    marginTop: 4,
    marginLeft: 0,
  },
  tenureContainer: {
    marginBottom: 16,
  },
  tenureInput: {
    marginBottom: 16,
  },
  tenureUnitContainer: {
    marginBottom: 8,
  },
  tenureUnitButtons: {
    marginTop: 8,
  },
  segmentContainer: {
    marginBottom: 32,
  },
  segmentLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#444',
    marginBottom: 12,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    marginTop: 8,
  },
  button: {
    flex: 1,
    borderRadius: 14,
  },
  submitButton: {
    backgroundColor: '#FF7D00',
  },
  kycInfoCard: {
    backgroundColor: '#FFF8E1',
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#FFE0B2',
    flexDirection: 'row',
    alignItems: 'center',
  },
  kycInfoText: {
    color: '#F57C00',
    fontWeight: '600',
    fontSize: 13,
  },

  // KYC Message
  kycMessageContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  kycMessageCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    elevation: 4,
  },
  kycMessageTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 16,
    color: '#1A1A1A',
    textAlign: 'center',
  },
  kycMessageText: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  kycButton: {
    width: '100%',
    borderRadius: 14,
    marginBottom: 12,
  },

  loadingContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#888',
    fontWeight: '500',
  },
});
