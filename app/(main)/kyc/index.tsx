import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Image, Alert } from 'react-native';
import { Text, Card, Button, IconButton, ActivityIndicator } from 'react-native-paper';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../../../services/supabase/supabase';
import { useAuthStore } from '../../../store/auth';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLanguage } from '../../../contexts/LanguageContext';
import { translationService } from '../../../services/translationService';

interface Document {
  type: string;
  label: string;
  image: string | null;
  status: 'pending' | 'verified' | 'rejected';
  uploaded_at?: string;
}

interface ProfileData {
  id_proof?: string;
  address_proof?: string;
  business_proof?: string;
  kyc_status?: boolean;
}

export default function KYC() {
  const router = useRouter();
  const user = useAuthStore(state => state.user);
  const { currentLanguage } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [profileData, setProfileData] = useState<ProfileData>({});
  const [translationsLoading, setTranslationsLoading] = useState(true);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [documents, setDocuments] = useState<Record<string, Document>>({
    id_proof: { type: 'id_proof', label: 'ID Proof', image: null, status: 'pending' },
    address_proof: { type: 'address_proof', label: 'Address Proof', image: null, status: 'pending' },
    business_proof: { type: 'business_proof', label: 'Business Proof', image: null, status: 'pending' },
  });

  const t = useCallback((key: string) => {
    return translations[key] || key;
  }, [translations]);

  useEffect(() => {
    const loadTranslations = async () => {
      try {
        // Define original English texts mapped to translation keys (reference: loans screen approach)
        const originalTexts: Record<string, string> = {
          'kyc.verification': 'KYC Verification',
          'kyc.id_proof': 'ID Proof',
          'kyc.address_proof': 'Address Proof',
          'kyc.business_proof': 'Business Proof',
          'kyc.upload_restricted': 'Upload restricted',
          'kyc.upload_restricted_message': 'KYC is verified. You cannot modify documents.',
          'kyc.permission_required': 'Permission required',
          'kyc.camera_permission_message': 'We need permission to access your media library',
          'kyc.success': 'Success',
          'kyc.uploaded_successfully': 'uploaded successfully',
          'kyc.upload_failed': 'Upload failed',
          'kyc.upload_failed_message': 'Failed to upload document. Please try again.',
          'kyc.error': 'Error',
          'kyc.error_fetching_profile': 'Error fetching profile:',
          'kyc.failed_to_fetch_kyc': 'Failed to fetch KYC details',
          'kyc.uploading': 'Uploading',
          'kyc.re_upload': 'Re-upload',
          'kyc.kyc_verified_cannot_modify': 'KYC verified. You cannot modify documents.',
          'kyc.upload_document': 'Upload Document',
          'kyc.uploaded': 'Uploaded',
          'kyc.pending': 'Pending',
          'kyc.verified': 'Verified',
          'kyc.rejected': 'Rejected',
          'kyc.ok': 'OK',
        };

        if (!currentLanguage || currentLanguage === 'en') {
          // No translation needed, use English texts
          setTranslations(originalTexts);
          return;
        }

        // Translate each text individually (similar to Loans screen)
        const translationPromises = Object.entries(originalTexts).map(async ([key, value]) => {
          const result = await translationService.translateText(value, currentLanguage);
          return [key, result.translatedText] as const;
        });

        const translatedEntries = await Promise.all(translationPromises);
        setTranslations(Object.fromEntries(translatedEntries));
      } catch (error) {
        console.error('Error loading translations:', error);
        // Fallback to original English texts on error
        setTranslations({
          'kyc.verification': 'KYC Verification',
          'kyc.id_proof': 'ID Proof',
          'kyc.address_proof': 'Address Proof',
          'kyc.business_proof': 'Business Proof',
          'kyc.upload_restricted': 'Upload restricted',
          'kyc.upload_restricted_message': 'KYC is verified. You cannot modify documents.',
          'kyc.permission_required': 'Permission required',
          'kyc.camera_permission_message': 'We need permission to access your media library',
          'kyc.success': 'Success',
          'kyc.uploaded_successfully': 'uploaded successfully',
          'kyc.upload_failed': 'Upload failed',
          'kyc.upload_failed_message': 'Failed to upload document. Please try again.',
          'kyc.error': 'Error',
          'kyc.error_fetching_profile': 'Error fetching profile:',
          'kyc.failed_to_fetch_kyc': 'Failed to fetch KYC details',
          'kyc.uploading': 'Uploading',
          'kyc.re_upload': 'Re-upload',
          'kyc.kyc_verified_cannot_modify': 'KYC verified. You cannot modify documents.',
          'kyc.upload_document': 'Upload Document',
          'kyc.uploaded': 'Uploaded',
          'kyc.pending': 'Pending',
          'kyc.verified': 'Verified',
          'kyc.rejected': 'Rejected',
          'kyc.ok': 'OK',
        });
      } finally {
        setTranslationsLoading(false);
      }
    };

    loadTranslations();
  }, [currentLanguage]);

  useEffect(() => {
    if (!translationsLoading) {
      // Update document labels with translations
      setDocuments(prev => ({
        id_proof: { ...prev.id_proof, label: t('kyc.id_proof') },
        address_proof: { ...prev.address_proof, label: t('kyc.address_proof') },
        business_proof: { ...prev.business_proof, label: t('kyc.business_proof') },
      }));
      
      fetchKYCDocuments();
    }
  }, [translationsLoading, t]);

  const handlePickImage = async (docType: string) => {
    try {
      // Check if KYC is already verified (prevent re-upload)
      if (profileData.kyc_status === true) {
        Alert.alert(
          t('kyc.upload_restricted'), 
          t('kyc.upload_restricted_message'),
          [{ text: t('kyc.ok') }]
        );
        return;
      }

      // Request permissions
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert(t('kyc.permission_required'), t('kyc.camera_permission_message'));
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setUploading(docType);
        try {
          const asset = result.assets[0];
          
          // Resize image using ImageManipulator
          const manipulatedImage = await ImageManipulator.manipulateAsync(
            asset.uri,
            [{ resize: { width: 2000, height: 2000 } }],
            { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true }
          );
          
          console.log(`Starting upload for ${docType}`);
          const publicUrl = await uploadDocument(manipulatedImage.base64 || '', docType);
          
          // Update local state
          setDocuments(prev => ({
            ...prev,
            [docType]: {
              ...prev[docType],
              image: publicUrl,
              status: 'pending',
              uploaded_at: new Date().toISOString(),
            }
          }));
          
          // Update profile data state
          setProfileData(prev => ({
            ...prev,
            [docType]: publicUrl
          }));
          
          Alert.alert(t('kyc.success'), `${documents[docType].label} ${t('kyc.uploaded_successfully')}`);
        } catch (error) {
          console.error('Error uploading document:', error);
          Alert.alert(t('kyc.upload_failed'), t('kyc.upload_failed_message'));
        } finally {
          setUploading(null);
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert(t('kyc.permission_required'), t('kyc.camera_permission_message'));
    }
  };

  const fetchKYCDocuments = async () => {
    try {
      if (!user?.id) return;

      console.log('Fetching KYC documents for user:', user.id);

      // Fetch profile details including KYC document URLs
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select(`
          id,
          id_proof,
          address_proof,
          business_proof,
          kyc_status
        `)
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        Alert.alert(t('kyc.error'), `${t('kyc.error_fetching_profile')} ${profileError.message}`);
        return;
      }

      if (profile) {
        console.log('Profile data:', profile);
        setProfileData(profile);
        
        // Update documents state with profile data
        const updatedDocuments = { ...documents };
        
        // Update each document with its URL from the profile
        if (profile.id_proof) {
          updatedDocuments.id_proof = {
            ...updatedDocuments.id_proof,
            image: profile.id_proof,
            status: profile.kyc_status ? 'verified' : 'pending',
          };
        }
        
        if (profile.address_proof) {
          updatedDocuments.address_proof = {
            ...updatedDocuments.address_proof,
            image: profile.address_proof,
            status: profile.kyc_status ? 'verified' : 'pending',
          };
        }
        
        if (profile.business_proof) {
          updatedDocuments.business_proof = {
            ...updatedDocuments.business_proof,
            image: profile.business_proof,
            status: profile.kyc_status ? 'verified' : 'pending',
          };
        }
        
        setDocuments(updatedDocuments);
      }
    } catch (error) {
      console.error('Error in fetchKYCDocuments:', error);
      Alert.alert(t('kyc.error'), t('kyc.failed_to_fetch_kyc'));
    } finally {
      setLoading(false);
    }
  };

  const uploadDocument = async (base64Image: string, docType: string) => {
    try {
      if (!user?.id) {
        throw new Error('User ID not found');
      }

      // Create date stamp for file name
      const dateStamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
      const timeStamp = Date.now();
      
      // Create file name with date stamp
      const fileName = `${docType}_${dateStamp}_${timeStamp}.jpg`;
      
      // Create folder structure: profiles/KYC_doc/{user_id}/{document_type}/
      const folderPath = `KYC_doc/${user.id}/${docType}`;
      const filePath = `${folderPath}/${fileName}`;
      
      console.log('Uploading to path:', filePath);

      // Upload file to Supabase Storage (profiles bucket) using base64
      const { data: fileData, error: uploadError } = await supabase
        .storage
        .from('profiles')
        .upload(filePath, decode(base64Image), {
          contentType: 'image/jpeg',
          upsert: true // Allow overwriting existing files
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      console.log('File uploaded successfully:', fileData);

      // Get public URL
      const { data: { publicUrl } } = supabase
        .storage
        .from('profiles')
        .getPublicUrl(filePath);

      console.log('Public URL:', publicUrl);

      // Update the profiles table using RPC function
      const { data: rpcResult, error: rpcError } = await supabase
        .rpc('update_kyc_document', {
          p_user_id: user.id,
          p_document_type: docType,
          p_document_url: publicUrl
        });

      if (rpcError) {
        console.error('RPC error:', rpcError);
        throw rpcError;
      }

      console.log('RPC result:', rpcResult);

      // Check if RPC call was successful
      if (rpcResult && !rpcResult.success) {
        throw new Error(rpcResult.error || 'Failed to update database');
      }

      return publicUrl;
    } catch (error) {
      console.error('Error uploading document:', error);
      throw error;
    }
  };

  const renderDocument = (key: string, doc: Document) => {
    const isUploaded = !!doc.image;
    const isUploading = uploading === key;
    const isKycVerified = profileData.kyc_status === true;
    const statusColor = doc.status === 'verified' ? '#4CAF50' : 
                       doc.status === 'rejected' ? '#f44336' : '#ff9800';

    return (
      <Card key={key} style={styles.card}>
        <Card.Content>
          <View style={styles.documentHeader}>
            <Text variant="titleMedium">{doc.label}</Text>
            {isUploaded && (
              <Text style={[styles.status, { color: statusColor }]}>
                {t(`kyc.${doc.status}`).toUpperCase()}
              </Text>
            )}
          </View>

          {doc.image ? (
            <View style={styles.imageContainer}>
              <Image source={{ uri: doc.image }} style={styles.documentImage} />
              {doc.uploaded_at && (
                <Text style={styles.uploadDate}>
                  {t('kyc.uploaded')}: {new Date(doc.uploaded_at).toLocaleDateString()}
                </Text>
              )}
              {!isKycVerified && (
                <Button 
                  mode="outlined" 
                  onPress={() => handlePickImage(key)}
                  style={styles.reuploadButton}
                  disabled={isUploading}
                  loading={isUploading}
                >
                  {isUploading ? t('kyc.uploading') : t('kyc.re_upload')}
                </Button>
              )}
              {isKycVerified && (
                <Text style={styles.verifiedText}>
                  {t('kyc.kyc_verified_cannot_modify')}
                </Text>
              )}
            </View>
          ) : (
            <Button 
              mode="contained" 
              onPress={() => handlePickImage(key)}
              style={styles.uploadButton}
              disabled={isUploading || isKycVerified}
              loading={isUploading}
            >
              {isUploading ? t('kyc.uploading') : t('kyc.upload_document')}
            </Button>
          )}
        </Card.Content>
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <IconButton 
          icon="arrow-left" 
          size={24}
          onPress={() => router.back()}
        />
        <Text variant="titleLarge" style={styles.headerTitle}>{t('kyc.verification')}</Text>
        <View style={styles.headerRight} />
      </View>

      {translationsLoading || loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
        </View>
      ) : (
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            {Object.entries(documents).map(([key, doc]) => renderDocument(key, doc))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fff',
    paddingHorizontal: 8,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontWeight: '600',
  },
  headerRight: {
    width: 48,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
    paddingBottom: 100, // Add extra bottom padding to clear bottom navigation
  },
  card: {
    marginBottom: 16,
    elevation: 2,
  },
  sectionTitle: {
    marginBottom: 16,
    fontWeight: '600',
  },
  input: {
    marginBottom: 16,
  },
  imageContainer: {
    position: 'relative',
    alignItems: 'center',
  },
  documentImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginTop: 8,
  },
  removeImage: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  uploadButton: {
    marginTop: 8,
  },
  submitButton: {
    marginVertical: 24,
    borderRadius: 20,
  },
  documentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  status: {
    fontWeight: '600',
  },
  uploadDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
  },
  reuploadButton: {
    marginTop: 8,
  },
  verifiedText: {
    fontSize: 14,
    color: '#4CAF50',
    marginTop: 8,
    textAlign: 'center',
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    marginBottom: 24,
    fontWeight: '600',
  },
});