import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity, Image } from 'react-native';
import { Text, TextInput, Button, Card, Appbar, Portal, Modal, List, Divider, IconButton, HelperText, SegmentedButtons } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from '../../../../services/supabase/supabase';
import { useAuthStore } from '../../../../store/auth';
import { decode } from 'base64-arraybuffer';
import { PRODUCT_CATEGORIES } from '../../../../constants/categories';
import { getProductImage } from '../../../../constants/categoryImages';
import ProductImage from '../../../../components/common/ProductImage';
import { WHOLESALER_COLORS } from '../../../../constants/colors';
import { useEdgeToEdge, getSafeAreaStyles } from '../../../../utils/android15EdgeToEdge';
import { uploadProductImage } from '../../../../services/supabase/supabase';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { translationService } from '../../../../services/translationService';

interface RouteParams extends Record<string, string> {
  id: string;
}

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
}

export default function EditProduct() {
  const { currentLanguage } = useLanguage();
  const router = useRouter();
  const { id } = useLocalSearchParams<RouteParams>();
  const user = useAuthStore((state) => state.user);
  const { insets } = useEdgeToEdge({ statusBarStyle: 'dark' });
  
  const [form, setForm] = useState<ProductForm>({
    name: '',
    description: '',
    category: '',
    price: '',
    minOrderQuantity: '',
    availableQuantity: '',
    minStockAlert: '',
    unit: 'pieces',
    status: 'active',
  });
  const [image, setImage] = useState<string | null>(null);
  const [imageChanged, setImageChanged] = useState(false);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [additionalImages, setAdditionalImages] = useState<Array<{ uri: string; base64: string; id: string }>>([]);
  const [existingMedia, setExistingMedia] = useState<Array<{ id: string; media_url: string; display_order: number }>>([]);
  const [errors, setErrors] = useState<Partial<ProductForm>>({});
  const [loading, setLoading] = useState(false);
  const [translations, setTranslations] = useState({
    editProduct: 'Edit Product',
    changeProductImage: 'Change Product Image',
    changeImage: 'Change Image',
    productName: 'Product Name',
    description: 'Description',
    category: 'Category',
    priceInr: 'Price (INR)',
    minOrderQty: 'Min Order Qty',
    availableQty: 'Available Qty',
    minStockAlert: 'Min Stock Alert',
    status: 'Status',
    active: 'Active',
    inactive: 'Inactive',
    updateProduct: 'Update Product',
    validationProductNameRequired: 'Product name is required',
    validationCategoryRequired: 'Category is required',
    validationValidPriceRequired: 'Valid price is required',
    validationValidMinOrderQtyRequired: 'Valid minimum order quantity is required',
    validationValidAvailableQtyRequired: 'Valid available quantity is required',
    validationValidMinStockAlertRequired: 'Valid minimum stock alert is required',
    validationProductImageRequired: 'Product image is required',
    cameraPermissionRequired: 'Camera permission is required'
  });

  // Load translations
  useEffect(() => {
    const loadTranslations = async () => {
      try {
        const results = await Promise.all([
          translationService.translateText('Edit Product', currentLanguage),
          translationService.translateText('Change Product Image', currentLanguage),
          translationService.translateText('Change Image', currentLanguage),
          translationService.translateText('Product Name', currentLanguage),
          translationService.translateText('Description', currentLanguage),
          translationService.translateText('Category', currentLanguage),
          translationService.translateText('Price (INR)', currentLanguage),
          translationService.translateText('Min Order Qty', currentLanguage),
          translationService.translateText('Available Qty', currentLanguage),
          translationService.translateText('Min Stock Alert', currentLanguage),
          translationService.translateText('Status', currentLanguage),
          translationService.translateText('Active', currentLanguage),
          translationService.translateText('Inactive', currentLanguage),
          translationService.translateText('Update Product', currentLanguage),
          translationService.translateText('Product name is required', currentLanguage),
          translationService.translateText('Category is required', currentLanguage),
          translationService.translateText('Valid price is required', currentLanguage),
          translationService.translateText('Valid minimum order quantity is required', currentLanguage),
          translationService.translateText('Valid available quantity is required', currentLanguage),
          translationService.translateText('Valid minimum stock alert is required', currentLanguage),
          translationService.translateText('Product image is required', currentLanguage),
          translationService.translateText('Camera permission is required', currentLanguage)
        ]);
        
        setTranslations({
          editProduct: results[0].translatedText,
          changeProductImage: results[1].translatedText,
          changeImage: results[2].translatedText,
          productName: results[3].translatedText,
          description: results[4].translatedText,
          category: results[5].translatedText,
          priceInr: results[6].translatedText,
          minOrderQty: results[7].translatedText,
          availableQty: results[8].translatedText,
          minStockAlert: results[9].translatedText,
          status: results[10].translatedText,
          active: results[11].translatedText,
          inactive: results[12].translatedText,
          updateProduct: results[13].translatedText,
          validationProductNameRequired: results[14].translatedText,
          validationCategoryRequired: results[15].translatedText,
          validationValidPriceRequired: results[16].translatedText,
          validationValidMinOrderQtyRequired: results[17].translatedText,
          validationValidAvailableQtyRequired: results[18].translatedText,
          validationValidMinStockAlertRequired: results[19].translatedText,
          validationProductImageRequired: results[20].translatedText,
          cameraPermissionRequired: results[21].translatedText
        });
      } catch (error) {
        console.error('Translation loading error:', error);
      }
    };

    loadTranslations();
  }, [currentLanguage]);

  useEffect(() => {
    fetchProductDetails();
  }, [id]);

  const fetchProductDetails = async () => {
    try {
      const { data: product, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      if (product) {
        setForm({
          name: product.name,
          description: product.description || '',
          category: product.category,
          price: product.price.toString(),
          minOrderQuantity: product.min_order_quantity.toString(),
          availableQuantity: product.stock_available.toString(),
          minStockAlert: product.min_quantity.toString(),
          unit: product.unit,
          status: product.status,
        });

        // Ensure image URL is using HTTPS
        if (product.image_url) {
          setImage(product.image_url.replace('http://', 'https://'));
        }

        // Fetch existing product media
        const { data: media, error: mediaError } = await supabase
          .from('product_media')
          .select('id, media_url, display_order')
          .eq('product_id', id)
          .order('display_order');

        if (!mediaError && media) {
          setExistingMedia(media);
        }
      }
    } catch (error) {
      console.error('Error fetching product:', error);
      router.back();
    }
  };

  const validateForm = () => {
    const newErrors: Partial<ProductForm> = {};
    
    if (!form.name) newErrors.name = translations.validationProductNameRequired;
    if (!form.category) newErrors.category = translations.validationCategoryRequired;
    if (!form.price || isNaN(Number(form.price))) {
      newErrors.price = translations.validationValidPriceRequired;
    }
    if (!form.minOrderQuantity || isNaN(Number(form.minOrderQuantity))) {
      newErrors.minOrderQuantity = translations.validationValidMinOrderQtyRequired;
    }
    if (!form.availableQuantity || isNaN(Number(form.availableQuantity))) {
      newErrors.availableQuantity = translations.validationValidAvailableQtyRequired;
    }
    if (!form.minStockAlert || isNaN(Number(form.minStockAlert))) {
      newErrors.minStockAlert = translations.validationValidMinStockAlertRequired;
    }
    if (!image) {
      newErrors.name = translations.validationProductImageRequired;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const pickImage = async () => {
    try {
      // Request permissions
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.granted === false) {
        alert(translations.cameraPermissionRequired);
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        allowsMultipleSelection: false,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        
        // Resize image using ImageManipulator
        const manipulatedImage = await ImageManipulator.manipulateAsync(
          asset.uri,
          [{ resize: { width: 2000, height: 2000 } }],
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );
        
        setImage(manipulatedImage.uri);
        setImageChanged(true);
        // Store the base64 data for upload
        setImageBase64(manipulatedImage.base64 || '');
      }
    } catch (error) {
      console.error('Error picking image:', error);
      alert(translations.cameraPermissionRequired);
    }
  };

  const pickMultipleImages = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permissionResult.granted === false) {
        alert(translations.cameraPermissionRequired);
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 10,
      });

      if (!result.canceled && result.assets.length > 0) {
        const processedImages = await Promise.all(
          result.assets.map(async (asset) => {
            const manipulatedImage = await ImageManipulator.manipulateAsync(
              asset.uri,
              [{ resize: { width: 2000, height: 2000 } }],
              { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true }
            );
            
            return {
              uri: manipulatedImage.uri,
              base64: manipulatedImage.base64 || '',
              id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            };
          })
        );
        
        setAdditionalImages(prev => [...prev, ...processedImages]);
      }
    } catch (error) {
      console.error('Error picking multiple images:', error);
      alert(translations.cameraPermissionRequired);
    }
  };

  const removeAdditionalImage = (id: string) => {
    setAdditionalImages(prev => prev.filter(img => img.id !== id));
  };

  const uploadImage = async (base64Image: string) => {
    try {
      // Use the uploadProductImage function to upload the product image
      const { success, publicUrl, error } = await uploadProductImage(
        user?.id || '',
        base64Image,
        id
      );
      
      if (!success || error) {
        throw new Error(error || 'Failed to upload image');
      }
      
      // Ensure the URL is using HTTPS
      const finalUrl = publicUrl ? publicUrl.replace('http://', 'https://') : null;
      return finalUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  };

  const uploadProductMedia = async (productId: string, images: Array<{ uri: string; base64: string }>, startOrder: number) => {
    try {
      const mediaPromises = images.map(async (img, index) => {
        const { success, publicUrl, error } = await uploadProductImage(
          user?.id || '',
          img.uri,
          productId,
          img.base64
        );

        if (!success || !publicUrl) {
          console.error('Failed to upload media:', error);
          return null;
        }

        const { data, error: mediaError } = await supabase
          .from('product_media')
          .insert({
            product_id: productId,
            media_type: 'image',
            media_url: publicUrl.replace('http://', 'https://'),
            display_order: startOrder + index,
            is_primary: false,
          })
          .select()
          .single();

        if (mediaError) {
          console.error('Error inserting product media:', mediaError);
          return null;
        }

        return data;
      });

      const results = await Promise.all(mediaPromises);
      return results.filter(Boolean);
    } catch (error) {
      console.error('Error uploading product media:', error);
      throw error;
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    setLoading(true);
    try {
      let imageUrl = image;

      // Only upload new image if changed
      if (imageChanged && imageBase64) {
        imageUrl = await uploadImage(imageBase64);
      }

      const { error } = await supabase
        .from('products')
        .update({
          name: form.name,
          description: form.description,
          category: form.category,
          price: Number(form.price),
          min_order_quantity: Number(form.minOrderQuantity),
          stock_available: Number(form.availableQuantity),
          min_quantity: Number(form.minStockAlert),
          unit: form.unit,
          status: form.status,
          image_url: imageUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      // Upload additional images if any
      if (additionalImages.length > 0) {
        try {
          const maxOrder = existingMedia.length > 0 
            ? Math.max(...existingMedia.map(m => m.display_order)) + 1 
            : 1;
          await uploadProductMedia(id, additionalImages, maxOrder);
        } catch (mediaError) {
          console.error('Error uploading additional images:', mediaError);
          // Don't fail the entire operation
        }
      }

      router.back();
    } catch (err) {
      console.error('Error updating product:', err);
      Alert.alert('Error', 'Failed to update product. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.safeArea, getSafeAreaStyles(insets)]}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <IconButton 
              icon="arrow-left"
              onPress={() => router.back()}
              iconColor="#000000"
            />
          </View>
          <Text variant="titleLarge" style={styles.headerTitle}>{translations.editProduct}</Text>
          <View style={styles.headerRight} />
        </View>

        <ScrollView style={styles.content}>
          {/* Image Upload */}
          <View style={styles.imageSection}>
            <Text style={styles.sectionLabel}>Main Product Image *</Text>
            {image ? (
              <ProductImage
                imageUrl={image}
                style={styles.imagePreview}
                resizeMode="cover"
              />
            ) : (
              <Button
                mode="outlined"
                onPress={pickImage}
                style={styles.uploadButton}
                icon="camera"
              >
                {translations.changeProductImage}
              </Button>
            )}
            <Button
              mode="text"
              onPress={pickImage}
              style={styles.changeImage}
            >
              {translations.changeImage}
            </Button>

            {/* Additional Images Section */}
            <View style={styles.additionalImagesSection}>
              <Text style={styles.sectionLabel}>Additional Product Photos (Optional)</Text>
              
              {/* Show existing media */}
              {existingMedia.length > 0 && (
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  style={styles.additionalImagesScroll}
                >
                  {existingMedia.map((media) => (
                    <View key={media.id} style={styles.additionalImageContainer}>
                      <Image source={{ uri: media.media_url }} style={styles.additionalImage} />
                    </View>
                  ))}
                </ScrollView>
              )}

              <Button
                mode="outlined"
                icon="image-multiple"
                onPress={pickMultipleImages}
                style={styles.addMoreButton}
              >
                Add More Photos ({additionalImages.length})
              </Button>

              {additionalImages.length > 0 && (
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  style={styles.additionalImagesScroll}
                >
                  {additionalImages.map((img) => (
                    <View key={img.id} style={styles.additionalImageContainer}>
                      <Image source={{ uri: img.uri }} style={styles.additionalImage} />
                      <TouchableOpacity
                        style={styles.removeImageButton}
                        onPress={() => removeAdditionalImage(img.id)}
                      >
                        <IconButton
                          icon="close-circle"
                          size={24}
                          iconColor="#FF4444"
                          style={styles.removeIcon}
                        />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
          </View>

          {/* Product Details Form */}
          <TextInput
            mode="outlined"
            label={translations.productName}
            value={form.name}
            onChangeText={(text) => setForm({ ...form, name: text })}
            error={!!errors.name}
          />
          {errors.name && (
            <HelperText type="error">{errors.name}</HelperText>
          )}

          <TextInput
            mode="outlined"
            label={translations.description}
            value={form.description}
            onChangeText={(text) => setForm({ ...form, description: text })}
            multiline
            numberOfLines={3}
            style={styles.input}
          />

          <TextInput
            mode="outlined"
            label={translations.category}
            value={form.category}
            onChangeText={(text) => setForm({ ...form, category: text })}
            error={!!errors.category}
            style={styles.input}
          />
          {errors.category && (
            <HelperText type="error">{errors.category}</HelperText>
          )}

          <TextInput
            mode="outlined"
            label={translations.priceInr}
            value={form.price}
            onChangeText={(text) => setForm({ ...form, price: text })}
            keyboardType="numeric"
            error={!!errors.price}
            style={styles.input}
          />
          {errors.price && (
            <HelperText type="error">{errors.price}</HelperText>
          )}

          <View style={styles.row}>
            <TextInput
              mode="outlined"
              label={translations.minOrderQty}
              value={form.minOrderQuantity}
              onChangeText={(text) => setForm({ ...form, minOrderQuantity: text })}
              keyboardType="numeric"
              error={!!errors.minOrderQuantity}
              style={[styles.input, styles.halfInput]}
            />
            <TextInput
              mode="outlined"
              label={translations.availableQty}
              value={form.availableQuantity}
              onChangeText={(text) => setForm({ ...form, availableQuantity: text })}
              keyboardType="numeric"
              error={!!errors.availableQuantity}
              style={[styles.input, styles.halfInput]}
            />
          </View>
          {(errors.minOrderQuantity || errors.availableQuantity) && (
            <HelperText type="error">
              {errors.minOrderQuantity || errors.availableQuantity}
            </HelperText>
          )}

          <TextInput
            mode="outlined"
            label={translations.minStockAlert}
            value={form.minStockAlert}
            onChangeText={(text) => setForm({ ...form, minStockAlert: text })}
            keyboardType="numeric"
            error={!!errors.minStockAlert}
            style={styles.input}
          />
          {errors.minStockAlert && (
            <HelperText type="error">{errors.minStockAlert}</HelperText>
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

          <Button
            mode="contained"
            onPress={handleSubmit}
            loading={loading}
            disabled={loading}
            style={styles.submitButton}
          >
            {translations.updateProduct}
          </Button>
        </ScrollView>
      </View>
    </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerLeft: {
    width: 48,
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontWeight: '600',
  },
  headerRight: {
    width: 48,
  },
  content: {
    flex: 1,
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
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  additionalImagesSection: {
    marginTop: 24,
    width: '100%',
  },
  addMoreButton: {
    marginBottom: 12,
  },
  additionalImagesScroll: {
    marginTop: 8,
  },
  additionalImageContainer: {
    position: 'relative',
    marginRight: 12,
    width: 100,
    height: 100,
  },
  additionalImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  removeIcon: {
    margin: 0,
  },
  input: {
    marginTop: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
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
});
