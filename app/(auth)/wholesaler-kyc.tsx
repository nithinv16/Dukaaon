import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Button, TextInput, HelperText } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { SystemStatusBar } from '../../components/SystemStatusBar';
import { supabase } from '../../services/supabase/supabase';
import { useAuthStore } from '../../store/auth';
import { useTranslation } from '../../contexts/LanguageContext';
import { DocumentUpload } from '../../components/kyc/DocumentUpload';

interface WholesalerKYCForm {
  businessName: string;
  ownerName: string;
  registrationNumber: string;
  gstNumber: string;
  address: {
    office: string;
    warehouse: string;
  };
  pincode: string;
  businessType: string;
  yearEstablished: string;
}

export default function WholesalerKYC() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const { t } = useTranslation();
  
  const [form, setForm] = useState<WholesalerKYCForm>({
    businessName: '',
    ownerName: '',
    registrationNumber: '',
    gstNumber: '',
    address: {
      office: '',
      warehouse: '',
    },
    pincode: '',
    businessType: '',
    yearEstablished: '',
  });
  const [errors, setErrors] = useState<Partial<WholesalerKYCForm>>({});
  const [loading, setLoading] = useState(false);

  const validateForm = () => {
    const newErrors: Partial<WholesalerKYCForm> = {};
    
    if (!form.businessName) newErrors.businessName = 'Business name is required';
    if (!form.ownerName) newErrors.ownerName = 'Owner name is required';
    if (!form.registrationNumber) newErrors.registrationNumber = 'Registration number is required';
    if (!form.gstNumber) newErrors.gstNumber = 'GST number is required';
    if (!form.address.office || !form.address.warehouse) {
      newErrors.address = { office: '', warehouse: '' };
      if (!form.address.office) newErrors.address.office = 'Office address is required';
      if (!form.address.warehouse) newErrors.address.warehouse = 'Warehouse address is required';
    }
    if (!form.pincode || form.pincode.length !== 6) {
      newErrors.pincode = 'Valid pincode is required';
    }
    if (!form.businessType) newErrors.businessType = 'Business type is required';
    if (!form.yearEstablished) newErrors.yearEstablished = 'Year established is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    setLoading(true);
    try {
      // First create/update profile using UPSERT
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: user?.id,
          role: 'wholesaler',
          phone_number: user?.phone_number,
          status: 'pending',
        }, {
          onConflict: 'id'
        });

      if (profileError) {
        console.error('Profile upsert error:', profileError);
        throw profileError;
      }

      // Then upsert wholesaler details
      const { error: detailsError } = await supabase
        .from('wholesaler_details')
        .upsert({
          user_id: user?.id,
          business_name: form.businessName,
          owner_name: form.ownerName,
          registration_number: form.registrationNumber,
          gst_number: form.gstNumber,
          office_address: form.address.office,
          warehouse_address: form.address.warehouse,
          pincode: form.pincode,
          business_type: form.businessType,
          year_established: form.yearEstablished,
          status: 'pending',
        }, {
          onConflict: 'user_id'
        });

      if (detailsError) {
        console.error('Wholesaler details upsert error:', detailsError);
        throw detailsError;
      }

      console.log('Wholesaler KYC submitted successfully');
      router.replace('/(main)/wholesaler');
    } catch (error) {
      console.error('Error submitting KYC:', error);
      setErrors({ businessName: 'Failed to submit KYC. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <SystemStatusBar style="dark" />
      
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text variant="headlineMedium" style={styles.title}>
            {t('kyc.complete_business_profile')}
          </Text>
          <Text variant="bodyLarge" style={styles.subtitle}>
            {t('kyc.provide_wholesale_details')}
          </Text>
        </View>

        <View style={styles.form}>
          <TextInput
            mode="outlined"
            label={t('kyc.business_name')}
            value={form.businessName}
            onChangeText={(text) => setForm({ ...form, businessName: text })}
            error={!!errors.businessName}
          />
          {errors.businessName && (
            <HelperText type="error">{errors.businessName}</HelperText>
          )}

          <TextInput
            mode="outlined"
            label={t('kyc.owner_name')}
            value={form.ownerName}
            onChangeText={(text) => setForm({ ...form, ownerName: text })}
            error={!!errors.ownerName}
            style={styles.input}
          />
          {errors.ownerName && (
            <HelperText type="error">{errors.ownerName}</HelperText>
          )}

          <TextInput
            mode="outlined"
            label={t('kyc.business_registration_number')}
            value={form.registrationNumber}
            onChangeText={(text) => setForm({ ...form, registrationNumber: text })}
            error={!!errors.registrationNumber}
            style={styles.input}
          />
          {errors.registrationNumber && (
            <HelperText type="error">{errors.registrationNumber}</HelperText>
          )}

          <TextInput
            mode="outlined"
            label={t('kyc.gst_number')}
            value={form.gstNumber}
            onChangeText={(text) => setForm({ ...form, gstNumber: text })}
            error={!!errors.gstNumber}
            style={styles.input}
          />
          {errors.gstNumber && (
            <HelperText type="error">{errors.gstNumber}</HelperText>
          )}

          <TextInput
            mode="outlined"
            label={t('kyc.office_address')}
            value={form.address.office}
            onChangeText={(text) => setForm({ 
              ...form, 
              address: { ...form.address, office: text } 
            })}
            error={!!errors.address?.office}
            multiline
            numberOfLines={3}
            style={styles.input}
          />
          {errors.address?.office && (
            <HelperText type="error">{errors.address.office}</HelperText>
          )}

          <TextInput
            mode="outlined"
            label={t('kyc.warehouse_address')}
            value={form.address.warehouse}
            onChangeText={(text) => setForm({ 
              ...form, 
              address: { ...form.address, warehouse: text } 
            })}
            error={!!errors.address?.warehouse}
            multiline
            numberOfLines={3}
            style={styles.input}
          />
          {errors.address?.warehouse && (
            <HelperText type="error">{errors.address.warehouse}</HelperText>
          )}

          <TextInput
            mode="outlined"
            label="PIN Code"
            value={form.pincode}
            onChangeText={(text) => setForm({ ...form, pincode: text })}
            keyboardType="number-pad"
            maxLength={6}
            error={!!errors.pincode}
            style={styles.input}
          />
          {errors.pincode && (
            <HelperText type="error">{errors.pincode}</HelperText>
          )}

          <TextInput
            mode="outlined"
            label="Business Type"
            value={form.businessType}
            onChangeText={(text) => setForm({ ...form, businessType: text })}
            error={!!errors.businessType}
            style={styles.input}
          />
          {errors.businessType && (
            <HelperText type="error">{errors.businessType}</HelperText>
          )}

          <TextInput
            mode="outlined"
            label="Year Established"
            value={form.yearEstablished}
            onChangeText={(text) => setForm({ ...form, yearEstablished: text })}
            keyboardType="number-pad"
            maxLength={4}
            error={!!errors.yearEstablished}
            style={styles.input}
          />
          {errors.yearEstablished && (
            <HelperText type="error">{errors.yearEstablished}</HelperText>
          )}

          <DocumentUpload
            type="business_proof"
            title="Business Registration"
            description="Upload your business registration certificate"
            onUpload={async (doc) => {
              // Handle document upload
            }}
          />

          <DocumentUpload
            type="gst_certificate"
            title="GST Certificate"
            description="Upload your GST registration certificate"
            onUpload={async (doc) => {
              // Handle document upload
            }}
          />

          <DocumentUpload
            type="warehouse_photo"
            title="Warehouse Photo"
            description="Upload a clear photo of your warehouse"
            onUpload={async (doc) => {
              // Handle document upload
            }}
          />

          <Button
            mode="contained"
            onPress={handleSubmit}
            loading={loading}
            disabled={loading}
            style={styles.submitButton}
          >
            {t('kyc.submit')}
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
  },
  title: {
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    textAlign: 'center',
    opacity: 0.7,
  },
  form: {
    padding: 20,
  },
  input: {
    marginTop: 12,
  },
  submitButton: {
    marginTop: 24,
    marginBottom: 40,
    borderRadius: 20,
  },
});