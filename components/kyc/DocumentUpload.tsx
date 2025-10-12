import React, { useState } from 'react';
import { View, Image, StyleSheet, Platform, Alert } from 'react-native';
import { Button, Text, IconButton } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from '../../services/supabase/supabase';
import { decode } from 'base64-arraybuffer';  

export type DocumentType = 
  | 'business_proof'
  | 'gst_certificate'
  | 'warehouse_photo'
  | 'shop_photo';

interface DocumentUploadProps {
  type: DocumentType;
  title: string;
  description: string;
  required?: boolean;
  style?: any;
  onUpload?: (doc: any) => Promise<void>;
  takePhotoText?: string;
  chooseFileText?: string;
}

export function DocumentUpload({ 
  type, 
  title, 
  description, 
  onUpload, 
  takePhotoText = 'Take Photo', 
  chooseFileText = 'Choose File' 
}: DocumentUploadProps) {
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const requestPermissions = async (): Promise<boolean> => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      return status === 'granted';
    } catch (err) {
      console.warn('Permission request error:', err);
      return false;
    }
  };

  const pickImage = async () => {
    try {
      // Request permissions first
      const hasPermissions = await requestPermissions();
      if (!hasPermissions) {
        Alert.alert(
          'Permissions Required',
          'Media library permissions are required to upload documents. Please grant permissions in your device settings.',
          [{ text: 'OK' }]
        );
        return;
      }

      console.log('Launching image library...');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        console.log('Image selected successfully, processing...');
        const asset = result.assets[0];
        
        // Resize image using ImageManipulator
        const manipulatedImage = await ImageManipulator.manipulateAsync(
          asset.uri,
          [{ resize: { width: 2000, height: 2000 } }],
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
        );
        
        setImage(manipulatedImage.uri);
        await handleUpload(manipulatedImage.uri);
      } else {
        console.log('Image selection was canceled');
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', `Failed to pick image: ${(error as any).message || 'Unknown error'}. Please try again.`);
    }
  };

  const takePhoto = async () => {
    try {
      // Request camera permissions
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permissions Required',
          'Camera permissions are required to take photos. Please grant permissions in your device settings.',
          [{ text: 'OK' }]
        );
        return;
      }

      console.log('Launching camera...');
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        console.log('Photo taken successfully, processing...');
        const asset = result.assets[0];
        
        // Resize image using ImageManipulator
        const manipulatedImage = await ImageManipulator.manipulateAsync(
          asset.uri,
          [{ resize: { width: 2000, height: 2000 } }],
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
        );
        
        setImage(manipulatedImage.uri);
        await handleUpload(manipulatedImage.uri);
      } else {
        console.log('Photo capture was canceled');
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', `Failed to take photo: ${(error as any).message || 'Unknown error'}. Please try again.`);
    }
  };

  const handleUpload = async (uri: string) => {
    setLoading(true);
    try {
      console.log('Starting image upload process...');
      
      // Convert image to base64
      console.log('Converting image to base64 from URI');
      const response = await fetch(uri);
      const blob = await response.blob();
      console.log('Blob created, size:', blob.size);
      const finalBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Extract only the base64 data part
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      
      if (!finalBase64) {
        console.error('Failed to get base64 data from image');
        throw new Error('Failed to get base64 data from image');
      }

      // Upload to the correct bucket - 'building_image'
      const fileName = `${type}_${Date.now()}.jpg`;
      const filePath = `seller-kyc/${fileName}`;
      
      console.log(`Uploading to building_image bucket, path: ${filePath}`);
      
      const { data, error } = await supabase.storage
        .from('building_image')
        .upload(filePath, decode(finalBase64), {
          contentType: 'image/jpeg',
          upsert: true
        });

      if (error) {
        console.error('Supabase upload error:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        throw error;
      }

      console.log('Upload successful, getting public URL');
      
      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('building_image')
        .getPublicUrl(filePath);

      console.log('Upload completed successfully:', publicUrl);

      if (onUpload) {
        await onUpload({
          type,
          uri: publicUrl,
          status: 'uploaded',
        });
      }
    } catch (error) {
      console.error('Upload error:', error);
      console.error('Upload error details:', JSON.stringify(error, null, 2));
      alert(`Failed to upload document: ${error.message || 'Unknown error'}. Please try again.`);
      setImage(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text variant="titleMedium" style={styles.title}>{title || 'Document Upload'}</Text>
      <Text variant="bodySmall" style={styles.description}>{description || 'Please upload the required document'}</Text>

      {image ? (
        <View style={styles.imageContainer}>
          <Image source={{ uri: image }} style={styles.image} />
          <IconButton
            icon="refresh"
            mode="contained"
            onPress={pickImage}
            style={styles.retakeButton}
          />
        </View>
      ) : (
        <View style={styles.buttonContainer}>
          <Button
            mode="outlined"
            icon="camera"
            onPress={takePhoto}
            loading={loading}
            style={styles.button}
          >
            {takePhotoText}
          </Button>
          <Button
            mode="outlined"
            icon="image"
            onPress={pickImage}
            loading={loading}
            style={styles.button}
          >
            {chooseFileText}
          </Button>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  title: {
    marginBottom: 8,
  },
  description: {
    marginBottom: 16,
    opacity: 0.7,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  button: {
    flex: 1,
    marginHorizontal: 8,
  },
  imageContainer: {
    position: 'relative',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: 200,
    borderRadius: 8,
  },
  retakeButton: {
    position: 'absolute',
    bottom: -20,
    backgroundColor: 'white',
  },
});