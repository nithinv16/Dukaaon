import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Image } from 'react-native';
import { Text, TextInput, Button, IconButton, HelperText, SegmentedButtons, List, ProgressBar } from 'react-native-paper';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from '../../../../services/supabase/supabase';
import { useAuthStore } from '../../../../store/auth';
import { decode } from 'base64-arraybuffer';
import { PRODUCT_CATEGORIES } from '../../../../constants/categories';
import { getProductImage } from '../../../../constants/categoryImages';
import ProductImage from '../../../../components/common/ProductImage';
import { Portal, Modal } from 'react-native-paper';
import SupabaseService from '../../../../services/SupabaseService';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { translationService } from '../../../../services/translationService';

interface ProductForm {
  name: string;
  description: string;
  category: string;
  price: string;
  minOrderQuantity: string;
  availableQuantity: string;
  minStockAlert: string;
  unit: string;
  status: 'active' | 'inactive';
  subcategory: string;
}

export default function AddProduct() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const { currentLanguage } = useLanguage();
  
  const [translations, setTranslations] = useState({
    cameraPermissionRequired: 'Camera permission required',
    failedToPickImage: 'Failed to pick image',
    failedToUploadImage: 'Failed to upload image',
    productAddedSuccessfully: 'Product added successfully',
    failedToAddProduct: 'Failed to add product',
    nameRequired: 'Product name is required',
    descriptionRequired: 'Description is required',
    categoryRequired: 'Category is required',
    priceRequired: 'Price is required',
    priceInvalid: 'Price must be a valid number',
    minOrderQuantityRequired: 'Minimum order quantity is required',
    minOrderQuantityInvalid: 'Minimum order quantity must be a valid number',
    availableQuantityRequired: 'Available quantity is required',
    availableQuantityInvalid: 'Available quantity must be a valid number',
    minStockAlertRequired: 'Minimum stock alert is required',
    minStockAlertInvalid: 'Minimum stock alert must be a valid number',
    addNewProduct: 'Add New Product',
    changeImage: 'Change Image',
    uploadProductImage: 'Upload Product Image',
    productName: 'Product Name',
    description: 'Description',
    selectCategory: 'Select Category',
    price: 'Price (INR)',
    unit: 'Unit',
    availableQuantity: 'Available Quantity',
    minStockAlert: 'Min Stock Alert',
    status: 'Status',
    active: 'Active',
    inactive: 'Inactive',
    addProduct: 'Add Product',
  });

  useEffect(() => {
    const loadTranslations = async () => {
      if (currentLanguage === 'en') return;

      try {
        const results = await Promise.all([
          translationService.translateText('Camera permission required', currentLanguage),
          translationService.translateText('Failed to pick image', currentLanguage),
          translationService.translateText('Failed to upload image', currentLanguage),
          translationService.translateText('Product added successfully', currentLanguage),
          translationService.translateText('Failed to add product', currentLanguage),
          translationService.translateText('Product name is required', currentLanguage),
          translationService.translateText('Description is required', currentLanguage),
          translationService.translateText('Category is required', currentLanguage),
          translationService.translateText('Price is required', currentLanguage),
          translationService.translateText('Price must be a valid number', currentLanguage),
          translationService.translateText('Minimum order quantity is required', currentLanguage),
          translationService.translateText('Minimum order quantity must be a valid number', currentLanguage),
          translationService.translateText('Available quantity is required', currentLanguage),
          translationService.translateText('Available quantity must be a valid number', currentLanguage),
          translationService.translateText('Minimum stock alert is required', currentLanguage),
          translationService.translateText('Minimum stock alert must be a valid number', currentLanguage),
          translationService.translateText('Add New Product', currentLanguage),
          translationService.translateText('Change Image', currentLanguage),
          translationService.translateText('Upload Product Image', currentLanguage),
          translationService.translateText('Product Name', currentLanguage),
          translationService.translateText('Description', currentLanguage),
          translationService.translateText('Select Category', currentLanguage),
          translationService.translateText('Price (INR)', currentLanguage),
          translationService.translateText('Unit', currentLanguage),
          translationService.translateText('Available Quantity', currentLanguage),
          translationService.translateText('Min Stock Alert', currentLanguage),
          translationService.translateText('Status', currentLanguage),
          translationService.translateText('Active', currentLanguage),
          translationService.translateText('Inactive', currentLanguage),
          translationService.translateText('Add Product', currentLanguage),
        ]);

        setTranslations({
          cameraPermissionRequired: results[0].translatedText,
          failedToPickImage: results[1].translatedText,
          failedToUploadImage: results[2].translatedText,
          productAddedSuccessfully: results[3].translatedText,
          failedToAddProduct: results[4].translatedText,
          nameRequired: results[5].translatedText,
          descriptionRequired: results[6].translatedText,
          categoryRequired: results[7].translatedText,
          priceRequired: results[8].translatedText,
          priceInvalid: results[9].translatedText,
          minOrderQuantityRequired: results[10].translatedText,
          minOrderQuantityInvalid: results[11].translatedText,
          availableQuantityRequired: results[12].translatedText,
          availableQuantityInvalid: results[13].translatedText,
          minStockAlertRequired: results[14].translatedText,
          minStockAlertInvalid: results[15].translatedText,
          addNewProduct: results[16].translatedText,
          changeImage: results[17].translatedText,
          uploadProductImage: results[18].translatedText,
          productName: results[19].translatedText,
          description: results[20].translatedText,
          selectCategory: results[21].translatedText,
          price: results[22].translatedText,
          unit: results[23].translatedText,
          availableQuantity: results[24].translatedText,
          minStockAlert: results[25].translatedText,
          status: results[26].translatedText,
          active: results[27].translatedText,
          inactive: results[28].translatedText,
          addProduct: results[29].translatedText,
        });
      } catch (error) {
        console.error('Failed to load translations:', error);
      }
    };

    loadTranslations();
  }, [currentLanguage]);
  
  const [form, setForm] = useState<ProductForm>({
    name: '',
    description: '',
    category: '',
    price: '',
    minOrderQuantity: '1',
    availableQuantity: '',
    minStockAlert: '',
    unit: 'pieces',
    status: 'active',
    subcategory: '',
  });
  const [image, setImage] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<ProductForm>>({});
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<typeof PRODUCT_CATEGORIES[0] | null>(null);

  const pickImage = async () => {
    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        alert(translations.cameraPermissionRequired);
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        
        // Resize image using ImageManipulator
        const manipulatedImage = await ImageManipulator.manipulateAsync(
          asset.uri,
          [{ resize: { width: 2000, height: 2000 } }],
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
        );
        
        setImage(manipulatedImage.uri);
        
        // Convert to base64 for upload
        const response = await fetch(manipulatedImage.uri);
        const blob = await response.blob();
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            const base64Data = result.split(',')[1];
            resolve(base64Data);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        
        setImageBase64(base64);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      alert(translations.failedToPickImage);
    }
  };

  const validateForm = () => {
    const newErrors: Partial<ProductForm> = {};
    
    if (!form.name) newErrors.name = translations.nameRequired;
    if (!form.category) newErrors.category = translations.categoryRequired;
    if (!form.price || isNaN(Number(form.price))) {
      newErrors.price = translations.priceInvalid;
    }
    if (!form.availableQuantity || isNaN(Number(form.availableQuantity))) {
      newErrors.availableQuantity = translations.availableQuantityInvalid;
    }
    if (!image) {
      newErrors.name = translations.nameRequired;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const compressImage = async (uri: string) => {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1024 } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
    );
    return result.uri;
  };

  const uploadImage = async (uri: string) => {
    try {
      setUploadProgress(0);
      
      // Compress image first
      const compressedUri = await compressImage(uri);
      
      // Simulate upload progress (since Supabase doesn't provide progress)
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 100);
      
      // Use the SupabaseService to upload the product image
      const { success, publicUrl, error } = await SupabaseService.uploadProductImage(
        user?.id || '',
        compressedUri,
        null, // productId
        imageBase64 // pass base64 data if available
      );
      
      clearInterval(progressInterval);
      
      if (!success || error) {
        throw new Error(error || 'Failed to upload image');
      }
      
      setUploadProgress(100);
      
      return publicUrl;
    } catch (error) {
      console.error('Upload error:', error);
      return null;
    } finally {
      setTimeout(() => setUploadProgress(0), 1000);
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    setLoading(true);
    try {
      // Upload image
      const imageUrl = await uploadImage(image!);
      if (!imageUrl) {
        alert(translations.failedToUploadImage);
        return;
      }

      // Create product
      const { error } = await supabase.from('products').insert({
        seller_id: user?.id,
        name: form.name.trim(),
        description: form.description.trim(),
        category: form.category.trim(),
        price: Number(form.price),
        min_order_quantity: Number(form.minOrderQuantity),
        stock_available: Number(form.availableQuantity),
        min_quantity: Number(form.minStockAlert),
        unit: form.unit,
        status: form.status,
        image_url: imageUrl
      });

      if (error) throw error;

      alert(translations.productAddedSuccessfully);
      router.back();

    } catch (error) {
      console.error('Error:', error);
      alert(translations.failedToAddProduct);
    } finally {
      setLoading(false);
    }
  };

  const renderCategoryModal = () => (
    <Portal>
      <Modal
        visible={categoryModalVisible}
        onDismiss={() => setCategoryModalVisible(false)}
        contentContainerStyle={styles.modalContainer}
      >
        <ScrollView>
          {PRODUCT_CATEGORIES.map(category => (
            <View key={category.id}>
              <Text variant="titleMedium" style={styles.categoryTitle}>
                {category?.name || 'Category'}
              </Text>
              {category.subcategories.map(sub => (
                <List.Item
                  key={sub.id}
                  title={sub?.name || 'Subcategory'}
                  onPress={() => {
                    setForm(prev => ({
                      ...prev,
                      category: category.name,
                      subcategory: sub.name
                    }));
                    setCategoryModalVisible(false);
                    setSelectedCategory(category);
                  }}
                  right={props => 
                    form.category === category.name && 
                    form.subcategory === sub.name ? (
                      <List.Icon {...props} icon="check" />
                    ) : null
                  }
                />
              ))}
            </View>
          ))}
        </ScrollView>
      </Modal>
    </Portal>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <IconButton 
          icon="arrow-left"
          onPress={() => router.back()}
        />
        <Text variant="titleLarge">{translations.addNewProduct}</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content}>
        {/* Image Upload */}
        <View style={styles.imageSection}>
          {image ? (
            <>
              <Image source={{ uri: image }} style={styles.imagePreview} />
              <Button
                mode="outlined"
                onPress={pickImage}
                style={styles.changeImage}
              >
                {translations.changeImage}
              </Button>
            </>
          ) : (
            <Button
              mode="outlined"
              icon="camera"
              onPress={pickImage}
              style={styles.uploadButton}
            >
              {translations.uploadProductImage}
            </Button>
          )}
        </View>

        {/* Product Details Form */}
        <TextInput
          mode="outlined"
          label={translations.productName}
          value={form.name}
          onChangeText={(text) => setForm({ ...form, name: text })}
          error={!!errors.name}
          style={styles.input}
        />
        {errors.name && <HelperText type="error">{errors.name}</HelperText>}

        <TextInput
          mode="outlined"
          label={translations.description}
          value={form.description}
          onChangeText={(text) => setForm({ ...form, description: text })}
          multiline
          numberOfLines={3}
          style={styles.input}
        />

        <Button
          mode="outlined"
          onPress={() => setCategoryModalVisible(true)}
          style={styles.input}
        >
          {form.category ? `${form.category} - ${form.subcategory}` : translations.selectCategory}
        </Button>
        {errors.category && <HelperText type="error">{errors.category}</HelperText>}

        <View style={styles.row}>
          <TextInput
            mode="outlined"
            label={translations.price}
            value={form.price}
            onChangeText={(text) => setForm({ ...form, price: text })}
            keyboardType="numeric"
            error={!!errors.price}
            style={[styles.input, styles.halfInput]}
          />
          <TextInput
            mode="outlined"
            label={translations.unit}
            value={form.unit}
            onChangeText={(text) => setForm({ ...form, unit: text })}
            style={[styles.input, styles.halfInput]}
          />
        </View>
        {errors.price && <HelperText type="error">{errors.price}</HelperText>}

        <View style={styles.row}>
          <TextInput
            mode="outlined"
            label={translations.availableQuantity}
            value={form.availableQuantity}
            onChangeText={(text) => setForm({ ...form, availableQuantity: text })}
            keyboardType="numeric"
            error={!!errors.availableQuantity}
            style={[styles.input, styles.halfInput]}
          />
          <TextInput
            mode="outlined"
            label={translations.minStockAlert}
            value={form.minStockAlert}
            onChangeText={(text) => setForm({ ...form, minStockAlert: text })}
            keyboardType="numeric"
            style={[styles.input, styles.halfInput]}
          />
        </View>
        {errors.availableQuantity && (
          <HelperText type="error">{errors.availableQuantity}</HelperText>
        )}

        <Text variant="bodyMedium" style={styles.label}>{translations.status}</Text>
        <SegmentedButtons
          value={form.status}
          onValueChange={(value) => setForm({ ...form, status: value as 'active' | 'inactive' })}
          buttons={[
            { value: 'active', label: translations.active },
            { value: 'inactive', label: translations.inactive },
          ]}
          style={styles.segmentedButtons}
        />

        {/* Show upload progress */}
        {uploadProgress > 0 && (
          <View style={styles.progressContainer}>
            <ProgressBar
              progress={uploadProgress / 100}
              color="#2196F3"
              style={styles.progressBar}
            />
            <Text style={styles.progressText}>{uploadProgress}%</Text>
          </View>
        )}

        <Button
          mode="contained"
          onPress={handleSubmit}
          loading={loading}
          disabled={loading}
          style={styles.submitButton}
        >
          {translations.addProduct}
        </Button>
      </ScrollView>

      {renderCategoryModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 60,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerRight: {
    width: 48,
  },
  content: {
    padding: 16,
  },
  imageSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  imagePreview: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 8,
  },
  uploadButton: {
    width: '100%',
    height: 200,
    justifyContent: 'center',
  },
  changeImage: {
    marginTop: 8,
  },
  input: {
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 16,
  },
  halfInput: {
    flex: 1,
  },
  label: {
    marginTop: 16,
    marginBottom: 8,
  },
  segmentedButtons: {
    marginBottom: 24,
  },
  submitButton: {
    marginVertical: 24,
    borderRadius: 20,
  },
  modalContainer: {
    backgroundColor: 'white',
    margin: 20,
    padding: 20,
    borderRadius: 8,
    maxHeight: '80%',
  },
  categoryTitle: {
    fontWeight: '600',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#f5f5f5',
  },
  progressContainer: {
    marginVertical: 16,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
  },
  progressText: {
    textAlign: 'center',
    marginTop: 8,
    color: '#666',
  },
});
