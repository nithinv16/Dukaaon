import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Image, TouchableOpacity, Alert, Platform } from 'react-native';
import { Text, TextInput, Button, IconButton, HelperText, SegmentedButtons, List, ProgressBar, Portal, Modal } from 'react-native-paper';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from '../../../../services/supabase/supabase';
import { useAuthStore } from '../../../../store/auth';
import { uploadProductImage } from '../../../../services/supabase/supabase';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { translationService } from '../../../../services/translationService';
import { VariantService, CreateVariantInput } from '../../../../services/products/VariantService';
import VariantManager from '../../../../components/products/VariantManager';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { getSafeAreaStyles } from '../../../../utils/android15EdgeToEdge';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SystemStatusBar } from '../../../../components/SystemStatusBar';
import { dynamicCategoryService } from '../../../../services/dynamic/dynamicCategoryService';

// --- Wholesaler Premium Theme (Navy/Teal) ---
const THEME = {
  primary: '#001F3F',    // Navy Blue
  secondary: '#39CCCC',  // Teal
  accent: '#7FDBFF',     // Sky Blue
  background: 'transparent',
  card: '#FFFFFF',
  textPrimary: '#111111',
  textSecondary: '#666666',
  success: '#39CCCC',    // Teal
  error: '#FF4136',
  warning: '#FF851B',
  divider: '#E0E0E0',
  inputBackground: '#F8F9FA',
};

import { LinearGradient } from 'expo-linear-gradient';

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
  const insets = useSafeAreaInsets();

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
    uploadProductImage: 'Upload Product Photo',
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
    addProduct: 'Create Product',
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
          translationService.translateText('Upload Product Photo', currentLanguage),
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
          translationService.translateText('Create Product', currentLanguage),
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
  const [image, setImage] = useState<string | null>(null); // Main image (for backward compatibility)
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [additionalImages, setAdditionalImages] = useState<Array<{ uri: string; base64: string; id: string }>>([]);
  const [errors, setErrors] = useState<Partial<ProductForm>>({});
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);

  // Dynamic Categories State
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string | null>(null);

  // Create Category State
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [newSubcategory, setNewSubcategory] = useState('');
  const [creatingCategoryLoading, setCreatingCategoryLoading] = useState(false);

  useEffect(() => {
    const loadCategories = async () => {
      const data = await dynamicCategoryService.getCategoriesWithSubcategories();
      setCategories(data);
    };
    loadCategories();
  }, []);

  // Variant management state
  const [showVariantManager, setShowVariantManager] = useState(false);
  const [createdProductId, setCreatedProductId] = useState<string | null>(null);
  const [showVariantPrompt, setShowVariantPrompt] = useState(false);

  // Smart variant detection state
  const [similarProducts, setSimilarProducts] = useState<any[]>([]);
  const [showSimilarProductsPrompt, setShowSimilarProductsPrompt] = useState(false);
  const [selectedSimilarProduct, setSelectedSimilarProduct] = useState<any>(null);

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
        allowsMultipleSelection: false, // Single selection for main image
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

  const pickMultipleImages = async () => {
    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        alert(translations.cameraPermissionRequired);
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 10, // Allow up to 10 additional images
      });

      if (!result.canceled && result.assets.length > 0) {
        const processedImages = await Promise.all(
          result.assets.map(async (asset) => {
            // Resize image using ImageManipulator
            const manipulatedImage = await ImageManipulator.manipulateAsync(
              asset.uri,
              [{ resize: { width: 2000, height: 2000 } }],
              { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true }
            );

            // Convert to base64 for upload
            const base64 = manipulatedImage.base64 || '';

            return {
              uri: manipulatedImage.uri,
              base64,
              id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            };
          })
        );

        setAdditionalImages(prev => [...prev, ...processedImages]);
      }
    } catch (error) {
      console.error('Error picking multiple images:', error);
      alert(translations.failedToPickImage);
    }
  };

  const removeAdditionalImage = (id: string) => {
    setAdditionalImages(prev => prev.filter(img => img.id !== id));
  };

  // Search for similar products (smart variant detection)
  const searchSimilarProducts = async (productName: string) => {
    if (!productName || productName.trim().length < 3) {
      setSimilarProducts([]);
      return;
    }

    try {
      // Extract base product name (remove size/quantity indicators)
      const baseName = productName
        .replace(/\d+\s*(ml|l|g|kg|oz|piece|pack)/gi, '') // Remove quantities
        .trim();

      if (baseName.length < 3) return;

      // Search for products with similar names
      const { data, error } = await supabase
        .from('products')
        .select('id, name, price, image_url, has_variants')
        .eq('seller_id', user?.id)
        .ilike('name', `%${baseName}%`)
        .eq('status', 'active')
        .limit(5);

      if (error) {
        console.error('Error searching similar products:', error);
        return;
      }

      // Filter out exact matches and very different products
      const similar = (data || []).filter(product => {
        const productBaseName = product.name
          .replace(/\d+\s*(ml|l|g|kg|oz|piece|pack)/gi, '')
          .trim()
          .toLowerCase();

        return productBaseName === baseName.toLowerCase() &&
          product.name.toLowerCase() !== productName.toLowerCase();
      });

      setSimilarProducts(similar);
    } catch (error) {
      console.error('Error in searchSimilarProducts:', error);
    }
  };

  // Debounced product name change handler
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (form.name) {
        searchSimilarProducts(form.name);
      }
    }, 500); // Wait 500ms after user stops typing

    return () => clearTimeout(timeoutId);
  }, [form.name]);

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

      // Use the uploadProductImage function to upload the product image
      const { success, publicUrl, error } = await uploadProductImage(
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

  const uploadProductMedia = async (productId: string, images: Array<{ uri: string; base64: string }>, isPrimary: boolean = false, startOrder: number = 0) => {
    try {
      const mediaPromises = images.map(async (img, index) => {
        // Upload each image
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

        // Insert into product_media table
        const { data, error: mediaError } = await supabase
          .from('product_media')
          .insert({
            product_id: productId,
            media_type: 'image',
            media_url: publicUrl.replace('http://', 'https://'),
            display_order: startOrder + index,
            is_primary: isPrimary && index === 0, // First image is primary if it's the main image
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
      // Upload main image
      const imageUrl = await uploadImage(image!);
      if (!imageUrl) {
        alert(translations.failedToUploadImage);
        return;
      }

      // Create product
      const { data: productData, error } = await supabase
        .from('products')
        .insert({
          seller_id: user?.id,
          name: form.name.trim(),
          description: form.description.trim(),
          category: form.category.trim(),
          subcategory: form.subcategory?.trim(),
          category_id: selectedCategoryId,
          subcategory_id: selectedSubcategoryId,
          price: Number(form.price),
          min_order_quantity: Number(form.minOrderQuantity),
          stock_available: Number(form.availableQuantity),
          min_quantity: Number(form.minStockAlert),
          unit: form.unit,
          status: form.status,
          image_url: imageUrl
        })
        .select()
        .single();

      if (error) throw error;

      // Upload main image to product_media as primary (display_order: 0)
      if (productData?.id && imageBase64) {
        try {
          await uploadProductMedia(
            productData.id,
            [{ uri: image!, base64: imageBase64 }],
            true, // isPrimary
            0 // startOrder
          );
        } catch (mediaError) {
          console.error('Error uploading primary image to media:', mediaError);
          // Don't fail the entire operation
        }
      }

      // Upload additional images to product_media table
      if (additionalImages.length > 0 && productData?.id) {
        try {
          await uploadProductMedia(
            productData.id,
            additionalImages,
            false, // not primary
            1 // startOrder (main image is at 0)
          );
        } catch (mediaError) {
          console.error('Error uploading additional images:', mediaError);
          // Don't fail the entire operation if additional images fail
          alert('Product added, but some additional images failed to upload.');
        }
      }

      // Product created successfully
      setCreatedProductId(productData.id);

      // Ask if user wants to add variants
      setLoading(false);
      setShowVariantPrompt(true);

    } catch (error) {
      console.error('Error:', error);
      alert(translations.failedToAddProduct);
      setLoading(false);
    }
  };

  // Handle variant save
  const handleSaveVariants = async (variants: CreateVariantInput[]) => {
    try {
      if (!createdProductId) return;

      await VariantService.createVariants(variants);
      alert(`Product and ${variants.length} variant(s) added successfully!`);
      setShowVariantManager(false);
      router.back();
    } catch (error) {
      console.error('Error saving variants:', error);
      alert(`Product created, but failed to save variants: ${(error as Error).message}`);
      router.back();
    }
  };

  // Handle skip variants
  const handleSkipVariants = () => {
    alert(translations.productAddedSuccessfully);
    setShowVariantPrompt(false);
    router.back();
  };

  // Handle add variants
  const handleAddVariants = () => {
    setShowVariantPrompt(false);
    setShowVariantManager(true);
  };

  // Handle add as variant to existing product
  const handleAddAsVariant = (product: any) => {
    setSelectedSimilarProduct(product);
    setCreatedProductId(product.id);
    setShowSimilarProductsPrompt(false);
    setShowVariantManager(true);
  };

  // Handle create as new product (ignore similar products)
  const handleCreateAsNew = () => {
    setShowSimilarProductsPrompt(false);
    setSimilarProducts([]);
    // Continue with normal form submission
  };

  const handleCreateCustomCategory = async () => {
    if (!newCategory.trim() || !newSubcategory.trim()) {
      alert('Please enter both category and subcategory names');
      return;
    }
    setCreatingCategoryLoading(true);
    try {
      const cat = await dynamicCategoryService.createCategory(newCategory);
      if (cat) {
        const sub = await dynamicCategoryService.createSubcategory(cat.id, newSubcategory);
        if (sub) {
          // Refresh list
          const data = await dynamicCategoryService.getCategoriesWithSubcategories();
          setCategories(data);

          // Select new
          setForm(prev => ({
            ...prev,
            category: cat.name,
            subcategory: sub.name
          }));
          setSelectedCategoryId(cat.id);
          setSelectedSubcategoryId(sub.id);

          // Reset & Close
          setIsCreatingCategory(false);
          setCategoryModalVisible(false);
          setNewCategory('');
          setNewSubcategory('');
        }
      }
    } catch (e) {
      console.error(e);
      alert('Failed to create category');
    } finally {
      setCreatingCategoryLoading(false);
    }
  };

  const renderCategoryModal = () => (
    <Portal>
      <Modal
        visible={categoryModalVisible}
        onDismiss={() => {
          setCategoryModalVisible(false);
          setIsCreatingCategory(false);
        }}
        contentContainerStyle={styles.modalContainer}
      >
        <Text style={styles.modalTitle}>
          {isCreatingCategory ? 'Create New Category' : translations.selectCategory}
        </Text>

        {isCreatingCategory ? (
          <ScrollView style={styles.modalScroll}>
            <Text style={styles.inputLabel}>New Category Name</Text>
            <TextInput
              mode="outlined"
              placeholder="e.g. Beverages"
              value={newCategory}
              onChangeText={setNewCategory}
              style={styles.input}
              outlineColor="transparent"
              activeOutlineColor={THEME.secondary}
            />

            <Text style={styles.inputLabel}>New Subcategory Name</Text>
            <TextInput
              mode="outlined"
              placeholder="e.g. Soft Drinks"
              value={newSubcategory}
              onChangeText={setNewSubcategory}
              style={styles.input}
              outlineColor="transparent"
              activeOutlineColor={THEME.secondary}
            />

            <View style={styles.modalBtnRow}>
              <Button
                mode="outlined"
                onPress={() => setIsCreatingCategory(false)}
                style={styles.modalBtn}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={handleCreateCustomCategory}
                loading={creatingCategoryLoading}
                disabled={creatingCategoryLoading}
                style={styles.modalBtn}
                buttonColor={THEME.secondary}
              >
                Create
              </Button>
            </View>
          </ScrollView>
        ) : (
          <ScrollView style={styles.modalScroll}>
            {categories.map(category => (
              <View key={category.id} style={styles.categorySection}>
                <Text style={styles.categoryTitle}>
                  {category?.name || 'Category'}
                </Text>
                {(category.subcategories || []).map((sub: any) => (
                  <TouchableOpacity
                    key={sub.id}
                    style={[
                      styles.subcategoryItem,
                      form.category === category.name && form.subcategory === sub.name && styles.subcategoryItemActive
                    ]}
                    onPress={() => {
                      setForm(prev => ({
                        ...prev,
                        category: category.name,
                        subcategory: sub.name
                      }));
                      setSelectedCategoryId(category.id);
                      setSelectedSubcategoryId(sub.id);
                      setCategoryModalVisible(false);
                    }}
                  >
                    <Text style={[
                      styles.subcategoryText,
                      form.category === category.name && form.subcategory === sub.name && styles.subcategoryTextActive
                    ]}>
                      {sub?.name || 'Subcategory'}
                    </Text>
                    {form.category === category.name && form.subcategory === sub.name && (
                      <MaterialCommunityIcons name="check" size={20} color={THEME.secondary} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            ))}

            <TouchableOpacity
              style={styles.createNewCategoryBtn}
              onPress={() => setIsCreatingCategory(true)}
            >
              <MaterialCommunityIcons name="plus" size={24} color={THEME.secondary} />
              <Text style={styles.createNewCategoryText}>Create New Category</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </Modal>
    </Portal>
  );

  return (
    <View style={[styles.container, getSafeAreaStyles(insets)]}>
      <SystemStatusBar style="light" />

      {/* Light Orange Gradient Background */}
      <LinearGradient
        colors={['#FFF3E0', '#FFFFFF', '#FFF8E1']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Decorative Gradient Background for Header */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 120, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, backgroundColor: THEME.primary, overflow: 'hidden' }}>
        <LinearGradient
          colors={[THEME.primary, '#003366']}
          style={StyleSheet.absoluteFillObject}
        />
        {/* Subtle decorative circles */}
        <View style={{ position: 'absolute', top: -50, right: -50, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.05)' }} />
        <View style={{ position: 'absolute', bottom: -20, left: -20, width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.05)' }} />
      </View>

      {/* Premium Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: '#FFFFFF' }]}>{translations.addNewProduct}</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Main Image Section */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionHeader}>Product Images</Text>
          <View style={styles.imageSection}>
            {image ? (
              <View style={styles.mainImageWrapper}>
                <Image source={{ uri: image }} style={styles.imagePreview} />
                <TouchableOpacity onPress={pickImage} style={styles.editImageBadge}>
                  <MaterialCommunityIcons name="pencil" size={16} color="white" />
                </TouchableOpacity>
                <View style={styles.mainTagBadge}>
                  <Text style={styles.mainTagText}>Main</Text>
                </View>
              </View>
            ) : (
              <TouchableOpacity onPress={pickImage} style={styles.uploadPlaceholder}>
                <View style={styles.uploadIconCircle}>
                  <MaterialCommunityIcons name="camera-plus-outline" size={32} color={THEME.secondary} />
                </View>
                <Text style={styles.uploadText}>{translations.uploadProductImage}</Text>
                <Text style={styles.uploadSubtext}>Tap to select form gallery</Text>
              </TouchableOpacity>
            )}

            {/* Additional Images */}
            {image && (
              <View style={styles.additionalImagesContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.additionalImagesScroll}>
                  {additionalImages.map((img) => (
                    <View key={img.id} style={styles.miniImageWrapper}>
                      <Image source={{ uri: img.uri }} style={styles.miniImage} />
                      <TouchableOpacity
                        style={styles.removeMiniImage}
                        onPress={() => removeAdditionalImage(img.id)}
                      >
                        <MaterialCommunityIcons name="close" size={12} color="white" />
                      </TouchableOpacity>
                    </View>
                  ))}

                  <TouchableOpacity onPress={pickMultipleImages} style={styles.addMoreMini}>
                    <MaterialCommunityIcons name="plus" size={24} color={THEME.textSecondary} />
                    <Text style={styles.addMoreText}>Add</Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            )}
          </View>
        </View>

        {/* Basic Information */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionHeader}>Basic Information</Text>

          <Text style={styles.inputLabel}>{translations.productName}</Text>
          <TextInput
            mode="outlined"
            placeholder="e.g. Premium Basmati Rice"
            value={form.name}
            onChangeText={(text) => {
              setForm({ ...form, name: text });
            }}
            error={!!errors.name}
            style={styles.input}
            outlineColor="transparent"
            activeOutlineColor={THEME.secondary}
            textColor={THEME.textPrimary}
          />
          {errors.name && <HelperText type="error">{errors.name}</HelperText>}

          {/* Similar Products Alert */}
          {similarProducts.length > 0 && (
            <View style={styles.similarProductsAlert}>
              <View style={styles.similarAlertHeader}>
                <MaterialCommunityIcons name="information" size={20} color={THEME.warning} />
                <Text style={styles.similarAlertTitle}>Similar products found</Text>
              </View>
              <Text style={styles.similarAlertMsg}>
                Consider adding as a variant instead of a new product
              </Text>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.similarScroll}>
                {similarProducts.map((product) => (
                  <TouchableOpacity
                    key={product.id}
                    style={styles.similarCard}
                    onPress={() => handleAddAsVariant(product)}
                  >
                    {product.image_url ? (
                      <Image source={{ uri: product.image_url }} style={styles.similarImg} />
                    ) : (
                      <View style={[styles.similarImg, { backgroundColor: '#eee' }]} />
                    )}
                    <View style={styles.similarInfo}>
                      <Text style={styles.similarName} numberOfLines={1}>{product.name}</Text>
                      <Text style={styles.similarPrice}>₹{product.price}</Text>
                    </View>
                    <View style={styles.similarBtn}>
                      <Text style={styles.similarBtnText}>Add Variant</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TouchableOpacity onPress={handleCreateAsNew}>
                <Text style={styles.ignoreLink}>Ignore and create new product</Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={styles.inputLabel}>{translations.description}</Text>
          <TextInput
            mode="outlined"
            placeholder="Describe your product details..."
            value={form.description}
            onChangeText={(text) => setForm({ ...form, description: text })}
            multiline
            numberOfLines={4}
            style={[styles.input, { height: 100 }]}
            outlineColor="transparent"
            activeOutlineColor={THEME.secondary}
            textColor={THEME.textPrimary}
          />

          <Text style={styles.inputLabel}>{translations.selectCategory}</Text>
          <TouchableOpacity
            style={styles.categorySelector}
            onPress={() => setCategoryModalVisible(true)}
          >
            <Text style={[styles.categorySelectorText, !form.category && { color: '#999' }]}>
              {form.category ? `${form.category} • ${form.subcategory}` : 'Select a category'}
            </Text>
            <MaterialCommunityIcons name="chevron-down" size={24} color={THEME.textSecondary} />
          </TouchableOpacity>
          {errors.category && <HelperText type="error">{errors.category}</HelperText>}
        </View>

        {/* Pricing & Inventory */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionHeader}>Pricing & Inventory</Text>

          <View style={styles.row}>
            <View style={styles.halfCol}>
              <Text style={styles.inputLabel}>{translations.price}</Text>
              <TextInput
                mode="outlined"
                placeholder="0.00"
                value={form.price}
                onChangeText={(text) => setForm({ ...form, price: text })}
                keyboardType="numeric"
                error={!!errors.price}
                style={styles.input}
                outlineColor="transparent"
                activeOutlineColor={THEME.secondary}
                textColor={THEME.textPrimary}
                left={<TextInput.Affix text="₹ " />}
              />
            </View>
            <View style={styles.halfCol}>
              <Text style={styles.inputLabel}>{translations.unit}</Text>
              <TextInput
                mode="outlined"
                placeholder="pcs, kg..."
                value={form.unit}
                onChangeText={(text) => setForm({ ...form, unit: text })}
                style={styles.input}
                outlineColor="transparent"
                activeOutlineColor={THEME.secondary}
                textColor={THEME.textPrimary}
              />
            </View>
          </View>
          {errors.price && <HelperText type="error">{errors.price}</HelperText>}

          <View style={styles.row}>
            <View style={styles.halfCol}>
              <Text style={styles.inputLabel}>{translations.availableQuantity}</Text>
              <TextInput
                mode="outlined"
                placeholder="0"
                value={form.availableQuantity}
                onChangeText={(text) => setForm({ ...form, availableQuantity: text })}
                keyboardType="numeric"
                error={!!errors.availableQuantity}
                style={styles.input}
                outlineColor="transparent"
                activeOutlineColor={THEME.secondary}
                textColor={THEME.textPrimary}
              />
            </View>
            <View style={styles.halfCol}>
              <Text style={styles.inputLabel}>{translations.minStockAlert}</Text>
              <TextInput
                mode="outlined"
                placeholder="0"
                value={form.minStockAlert}
                onChangeText={(text) => setForm({ ...form, minStockAlert: text })}
                keyboardType="numeric"
                style={styles.input}
                outlineColor="transparent"
                activeOutlineColor={THEME.secondary}
                textColor={THEME.textPrimary}
              />
            </View>
          </View>
          {errors.availableQuantity && (
            <HelperText type="error">{errors.availableQuantity}</HelperText>
          )}

          <Text style={styles.inputLabel}>{translations.status}</Text>
          <SegmentedButtons
            value={form.status}
            onValueChange={(value) => setForm({ ...form, status: value as 'active' | 'inactive' })}
            buttons={[
              {
                value: 'active',
                label: translations.active,
                checkedColor: '#fff',
                style: { backgroundColor: form.status === 'active' ? THEME.success : 'transparent', borderColor: THEME.divider }
              },
              {
                value: 'inactive',
                label: translations.inactive,
                checkedColor: '#fff',
                style: { backgroundColor: form.status === 'inactive' ? THEME.textSecondary : 'transparent', borderColor: THEME.divider }
              },
            ]}
            style={styles.statusSelector}
            theme={{ colors: { secondaryContainer: 'transparent' } }}
          />
        </View>

        {/* Upload Progress */}
        {uploadProgress > 0 && (
          <View style={styles.progressSection}>
            <Text style={styles.progressLabel}>Uploading assets...</Text>
            <ProgressBar
              progress={uploadProgress / 100}
              color={THEME.secondary}
              style={styles.progressBar}
            />
            <Text style={styles.progressValue}>{uploadProgress}%</Text>
          </View>
        )}

        <View style={styles.footerSpacing} />
      </ScrollView>

      {/* Floating Submit Button */}
      <Button
        mode="contained"
        onPress={handleSubmit}
        loading={loading}
        disabled={loading}
        style={styles.floatingSubmitButton}
        contentStyle={{ height: 56 }}
        labelStyle={{ fontSize: 16, fontWeight: '700' }}
        buttonColor={THEME.secondary}
        icon={loading ? undefined : "check-circle-outline"}
      >
        {translations.addProduct}
      </Button>

      {renderCategoryModal()}

      {/* Variant Prompt Modal */}
      <Portal>
        <Modal
          visible={showVariantPrompt}
          onDismiss={handleSkipVariants}
          contentContainerStyle={styles.premiumModal}
        >
          <View style={styles.successIconCircle}>
            <MaterialCommunityIcons name="check" size={32} color="white" />
          </View>
          <Text style={styles.premiumModalTitle}>Product Created!</Text>
          <Text style={styles.premiumModalText}>
            Would you like to add variants (different sizes, flavors, etc.) to this product?
          </Text>
          <View style={styles.modalBtnRow}>
            <Button
              mode="outlined"
              onPress={handleSkipVariants}
              style={styles.modalBtn}
              textColor={THEME.textSecondary}
            >
              Skip
            </Button>
            <Button
              mode="contained"
              onPress={handleAddVariants}
              style={styles.modalBtn}
              buttonColor={THEME.secondary}
            >
              Add Variants
            </Button>
          </View>
        </Modal>
      </Portal>

      {/* Variant Manager Modal */}
      <Portal>
        <Modal
          visible={showVariantManager}
          onDismiss={() => {
            setShowVariantManager(false);
            router.back();
          }}
          contentContainerStyle={styles.variantManagerModal}
        >
          {createdProductId && (
            <VariantManager
              productId={createdProductId}
              onSave={handleSaveVariants}
              onCancel={() => {
                setShowVariantManager(false);
                router.back();
              }}
            />
          )}
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: THEME.background,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.primary,
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  sectionContainer: {
    backgroundColor: THEME.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.primary,
    marginBottom: 16,
  },

  // Image Styles
  imageSection: {
    alignItems: 'center',
  },
  mainImageWrapper: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    position: 'relative',
    backgroundColor: '#F5F5F5',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  editImageBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainTagBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: THEME.secondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  mainTagText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '700',
  },
  uploadPlaceholder: {
    width: '100%',
    height: 180,
    borderWidth: 2,
    borderColor: '#E0E5F2',
    borderStyle: 'dashed',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFCFE',
    marginBottom: 24,
  },
  uploadIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  uploadText: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME.primary,
    marginBottom: 4,
  },
  uploadSubtext: {
    fontSize: 12,
    color: THEME.textSecondary,
  },
  additionalImagesContainer: {
    width: '100%',
  },
  additionalImagesScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  miniImageWrapper: {
    width: 70,
    height: 70,
    borderRadius: 8,
    marginRight: 12,
    position: 'relative',
  },
  miniImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  removeMiniImage: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: THEME.error,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'white',
  },
  addMoreMini: {
    width: 70,
    height: 70,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: THEME.divider,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFCFE',
  },
  addMoreText: {
    fontSize: 10,
    color: THEME.textSecondary,
    fontWeight: '600',
  },

  // Form Styles
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.textPrimary,
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    backgroundColor: THEME.inputBackground,
    marginBottom: 4,
    borderRadius: 8,
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  halfCol: {
    flex: 1,
  },
  categorySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: THEME.inputBackground,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  categorySelectorText: {
    fontSize: 14,
    color: THEME.textPrimary,
  },
  statusSelector: {
    marginTop: 8,
  },

  // Similar Products Styles
  similarProductsAlert: {
    backgroundColor: '#FFF8E1', // Warning light
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  similarAlertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  similarAlertTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#D84315', // Deep orange
  },
  similarAlertMsg: {
    fontSize: 12,
    color: '#5D4037',
    marginBottom: 12,
  },
  similarScroll: {
    marginBottom: 12,
  },
  similarCard: {
    width: 140,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 8,
    marginRight: 10,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  similarImg: {
    width: '100%',
    height: 80,
    borderRadius: 6,
    marginBottom: 6,
  },
  similarInfo: {
    marginBottom: 8,
  },
  similarName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  similarPrice: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.secondary,
  },
  similarBtn: {
    backgroundColor: '#FFF3E0',
    borderRadius: 4,
    paddingVertical: 4,
    alignItems: 'center',
  },
  similarBtnText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#E65100',
  },
  ignoreLink: {
    alignSelf: 'center',
    fontSize: 12,
    color: THEME.textSecondary,
    textDecorationLine: 'underline',
  },

  // Modal Styles
  modalContainer: {
    backgroundColor: 'white',
    margin: 20,
    borderRadius: 16,
    maxHeight: '80%',
    paddingVertical: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.primary,
    marginBottom: 16,
    textAlign: 'center',
  },
  modalScroll: {
    paddingHorizontal: 20,
  },
  categorySection: {
    marginBottom: 20,
  },
  categoryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  subcategoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  subcategoryItemActive: {
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 0,
  },
  subcategoryText: {
    fontSize: 15,
    color: THEME.textPrimary,
  },
  subcategoryTextActive: {
    color: THEME.secondary,
    fontWeight: '600',
  },

  // Progress Bar
  progressSection: {
    marginVertical: 16,
    paddingHorizontal: 4,
  },
  progressLabel: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginBottom: 8,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E0E5F2',
  },
  progressValue: {
    alignSelf: 'flex-end',
    fontSize: 11,
    marginTop: 4,
    color: THEME.secondary,
    fontWeight: '600',
  },

  // Footer / Submit
  floatingSubmitButton: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    borderRadius: 28,
    elevation: 6,
    shadowColor: THEME.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  footerSpacing: {
    height: 120, // Increased spacing for scrolling
  },

  // Premium Alert/Prompt Modal
  premiumModal: {
    backgroundColor: 'white',
    margin: 24,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
  },
  successIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: THEME.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    elevation: 4,
    shadowColor: THEME.success,
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  premiumModalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: THEME.primary,
    marginBottom: 8,
    textAlign: 'center',
  },
  premiumModalText: {
    fontSize: 15,
    color: THEME.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  modalBtnRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  modalBtn: {
    flex: 1,
    borderRadius: 12,
  },

  // Variant Manager Modal
  variantManagerModal: {
    backgroundColor: 'white',
    margin: 0,
    height: '92%',
    marginTop: 'auto',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  createNewCategoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
    marginTop: 8,
    gap: 8,
  },
  createNewCategoryText: {
    color: THEME.secondary,
    fontWeight: '700',
    fontSize: 15,
  },
});
