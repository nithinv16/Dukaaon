import React, { useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text, Button, ProgressBar } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { SystemStatusBar } from '../../components/SystemStatusBar';
import { DocumentUpload } from '../../components/kyc/DocumentUpload';
import { BusinessForm } from '../../components/kyc/BusinessForm';
import { supabase } from '../../services/supabase/supabase';
import { BusinessDetails, KYCDocument } from '../../types/kyc';
import { useAuthStore } from '../../store/auth';

export default function KYC() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [businessDetails, setBusinessDetails] = useState<BusinessDetails>({
    shopName: '',
    address: {
      street: '',
      city: '',
      state: '',
      pincode: '',
    },
    gstin: '',
  });
  const [documents, setDocuments] = useState<KYCDocument[]>([]);
  const [errors, setErrors] = useState<any>({});

  const validateBusinessDetails = () => {
    const newErrors: any = {};
    
    if (!businessDetails.shopName) {
      newErrors.shopName = 'Shop name is required';
    }
    if (!businessDetails.address.street || !businessDetails.address.city ||
        !businessDetails.address.state || !businessDetails.address.pincode) {
      newErrors.address = 'All address fields are required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleDocumentUpload = async (document: KYCDocument) => {
    try {
      // Convert URI to Blob
      const response = await fetch(document.uri);
      const blob = await response.blob();

      const fileName = `${user?.id}/${document.type}-${Date.now()}`;
      const { data, error } = await supabase.storage
        .from('kyc-documents')
        .upload(fileName, blob);

      if (error) throw error;

      setDocuments([...documents, { ...document, uri: data.path }]);
    } catch (error) {
      console.error('Document upload error:', error);
      throw error;
    }
  };

  const handleSubmit = async () => {
    if (!validateBusinessDetails()) return;
    if (documents.length < 4) {
      alert('Please upload all required documents');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          business_details: businessDetails,
          documents,
          kyc_status: 'pending',
        })
        .eq('id', user?.id);

      if (error) throw error;

      router.replace('/(main)/home/');
    } catch (error) {
      console.error('KYC submission error:', error);
      alert('Failed to submit KYC. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <SystemStatusBar style="dark" />

      <View style={styles.header}>
        <Text variant="headlineMedium" style={styles.title}>
          Business Verification
        </Text>
        <ProgressBar progress={step / 2} style={styles.progress} />
      </View>

      {step === 1 ? (
        <View style={styles.form}>
          <BusinessForm
            values={businessDetails}
            onChange={setBusinessDetails}
            errors={errors}
          />
          <Button
            mode="contained"
            onPress={() => validateBusinessDetails() && setStep(2)}
            style={styles.button}
          >
            Next
          </Button>
        </View>
      ) : (
        <View style={styles.form}>
          <DocumentUpload
            type="rental_agreement"
            title="Rental Agreement"
            description="Upload your shop's rental agreement or ownership document"
            onUpload={handleDocumentUpload}
          />
          <DocumentUpload
            type="electricity_bill"
            title="Electricity Bill"
            description="Upload your latest electricity bill"
            onUpload={handleDocumentUpload}
          />
          <DocumentUpload
            type="shop_photo"
            title="Shop Photo"
            description="Take a clear photo of your shop's exterior"
            onUpload={handleDocumentUpload}
          />
          <DocumentUpload
            type="owner_photo"
            title="Your Photo"
            description="Take a clear photo of yourself at your shop"
            onUpload={handleDocumentUpload}
          />
          
          <View style={styles.buttonContainer}>
            <Button
              mode="outlined"
              onPress={() => setStep(1)}
              style={[styles.button, styles.backButton]}
            >
              Back
            </Button>
            <Button
              mode="contained"
              onPress={handleSubmit}
              loading={loading}
              disabled={loading}
              style={[styles.button, styles.submitButton]}
            >
              Submit
            </Button>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    padding: 20,
    paddingTop: 60,
  },
  title: {
    textAlign: 'center',
    marginBottom: 20,
  },
  progress: {
    height: 6,
    borderRadius: 3,
  },
  form: {
    padding: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  button: {
    marginTop: 20,
  },
  backButton: {
    flex: 1,
    marginRight: 10,
  },
  submitButton: {
    flex: 2,
    marginLeft: 10,
  },
});