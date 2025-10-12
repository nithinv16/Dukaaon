import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Image, Alert, Pressable, ActivityIndicator, RefreshControl, BackHandler, TouchableOpacity } from 'react-native';
import { Text, TextInput, Button, Card, IconButton, SegmentedButtons, Menu, Portal, Snackbar } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useRouter } from 'expo-router';
import { supabase } from '../../../services/supabase/supabase';
import { useAuthStore } from '../../../store/auth';
import { decode } from 'base64-arraybuffer';
import { SharedProduct } from '../../../types/stock';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLanguage } from '../../../contexts/LanguageContext';
import { translationService } from '../../../services/translationService';
import { translateArrayFields } from '../../../utils/translationUtils';
import { useEdgeToEdge, getSafeAreaStyles } from '../../../utils/android15EdgeToEdge';
import { GooglePlacesAutocomplete } from '../../../components/common/GooglePlacesAutocomplete';

import { 
  calculateDeliveryDistance, 
  calculateDeliveryFee as calculateDeliveryFeeUtil,
  extractCoordinatesFromGoogleMapsUrl,
  debugCoordinateExtraction
} from '../../../utils/distanceCalculation';

interface ProductForm {
  name: string;
  brand: string;
  category: string;
  subCategory: string;
  units: string;
  price: string;
  image: {
    uri: string;
    base64: string;
  } | null;
  description: string;
}



// First, let's define the color theme constants at the top of the file
const COLORS = {
  primary: '#FF7D00', // Orange
  secondary: '#34495E', // Dark grey blue
  grey: '#95A5A6', // Grey
  white: '#FFFFFF', // White
  offWhite: '#F5F5F5', // Off white
  lightGrey: '#ECEFF1', // Light grey for backgrounds
  error: '#E74C3C', // Red for errors/delete
  success: '#2ECC71', // Green for success actions
};

export default function StockSharing() {
  const router = useRouter();
  const user = useAuthStore(state => state.user);
  const { currentLanguage } = useLanguage();
  const { insets } = useEdgeToEdge({ statusBarStyle: 'light' });

  // Original texts for translation
  const originalTexts = {
    stockSharing: 'Stock Sharing',
    deliveryService: 'Delivery Service',
    shareYourStock: 'Share Your Stock',
    shareYourExcessStock: 'Share Your Excess Stock',
    deliverToCustomers: 'Deliver to Customers',
    yourSharedProducts: 'Your Shared Products',
    addProduct: 'Add Product',
    productName: 'Product Name',
    brand: 'Brand',
    category: 'Category',
    subCategory: 'Sub Category',
    subcategory: 'Sub Category',
    units: 'Units',
    price: 'Price (₹)',
    description: 'Description',
    selectImage: 'Select Image',
    shareProduct: 'Share Product',
    edit: 'Edit',
    delete: 'Delete',
    startSharing: 'Start Sharing Your Stock',
    noProductsShared: 'No products shared yet',
    startSharingDescription: 'Share your products with nearby customers and grow your business.',
    loading: 'Loading...',
    submitting: 'Submitting...',
    updating: 'Updating...',
    deleting: 'Deleting...',
    selectCategory: 'Select Category',
    selectSubCategory: 'Select Sub Category',
    enterProductName: 'Enter product name',
    enterBrand: 'Enter brand',
    enterUnits: 'Enter units (e.g., kg, pieces)',
    enterPrice: 'Enter price',
    enterDescription: 'Enter description',
    imageRequired: 'Please select an image',
    allFieldsRequired: 'Please fill all required fields',
    productSharedSuccess: 'Product shared successfully!',
    productUpdatedSuccess: 'Product updated successfully!',
    productDeletedSuccess: 'Product deleted successfully!',
    errorOccurred: 'An error occurred',
    deleteConfirmTitle: 'Delete Product',
    deleteConfirmMessage: 'Are you sure you want to delete this product?',
    cancel: 'Cancel',
    confirm: 'Confirm',
    nearbyStock: 'Nearby Stock',
    mySharedProducts: 'My Shared Products',
    shareStock: 'Share Stock',
    selectTabToViewContent: 'Select a tab above to view content',
    
    // Customer and delivery related
    customerDetails: 'Customer Details',
    customerName: 'Customer Name',
    customerNameRequired: 'Customer name is required',
    customerPhoneRequired: 'Customer phone is required',
    phone: 'Phone',
    manualAddress: 'Manual Address',
    
    // Product related
    brandOptional: 'Brand (Optional)',
    unitsAvailable: 'Units Available',
    pricePerUnit: 'Price per Unit (₹)',
    descriptionOptional: 'Description (Optional)',
    updateProduct: 'Update Product',
    tapToAddImage: 'Tap to add image',
    productNameRequired: 'Product name is required',
    validQuantityRequired: 'Valid quantity is required',
    validPriceRequired: 'Valid price is required',
    
    // Product display
    notSpecified: 'Not Specified',
    availableUnits: 'Available Units',
    kmAway: 'km away',
    distance: 'Distance',
    seller: 'Seller',
    
    // Loading and status messages
    loadingYourSharedProducts: 'Loading your shared products...',
    noSharedProductsYet: 'No shared products yet',
    shareYourFirstProduct: 'Share your first product',
    nearbyAvailableStock: 'Nearby Available Stock',
    locationAccessRequired: 'Location access required to show nearby stock',
    noNearbyStockAvailable: 'No nearby stock available',
    
    // Actions
    contactSeller: 'Contact Seller',
    deliveryBookedSuccessfully: 'Delivery booked successfully',
    failedToBookDelivery: 'Failed to book delivery',
    
    // Categories
    'categories.groceries': 'Groceries',
    'categories.personal_care': 'Personal Care',
    'categories.household': 'Household',
    'categories.beverages': 'Beverages',
    'categories.snacks': 'Snacks',
    'categories.rice_grains': 'Rice & Grains',
    'categories.oil_ghee': 'Oil & Ghee',
    'categories.spices': 'Spices',
    'categories.hair_care': 'Hair Care',
    'categories.skin_care': 'Skin Care',
    'categories.oral_care': 'Oral Care',
    'categories.cleaning': 'Cleaning',
    'categories.kitchen': 'Kitchen',
    'categories.bathroom': 'Bathroom',
    'categories.tea_coffee': 'Tea & Coffee',
    'categories.soft_drinks': 'Soft Drinks',
    'categories.juices': 'Juices',
    'categories.chips': 'Chips',
    'categories.biscuits': 'Biscuits',
    'categories.sweets': 'Sweets',
    
    // Alert messages
    permissionDenied: 'Permission denied',
    locationPermissionRequired: 'Location permission is required to find nearby stock',
    permissionRequired: 'Permission Required',
    cameraRollPermissionsNeeded: 'Sorry, we need camera roll permissions to upload images.',
    error: 'Error',
    failedToPickImage: 'Failed to pick image. Please try again.',
    productNameRequired: 'Product name is required',
    validUnitsRequired: 'Valid units are required',
    validPriceRequired: 'Valid price is required',
    categoryRequired: 'Category is required',
    couldNotGetLocationCoordinates: 'Could not get location coordinates for this place',
    customerNameRequired: 'Customer name is required',
    customerPhoneRequired: 'Customer phone is required',
    manualAddressRequired: 'Manual address is required',
    smartAddressRequired: 'Smart address (location search) is required',
    validQuantityRequired: 'Valid quantity is required',
    contactSeller: 'Contact Seller',
    contactSellerMessage: 'Would you like to contact the seller about "[PRODUCT_NAME]"?',
    contact: 'Contact'
  };

  const [translations, setTranslations] = useState(originalTexts);

  // Load translations when language changes
  useEffect(() => {
    const loadTranslations = async () => {
      try {
        console.log('[StockSharing] Loading translations for language:', currentLanguage);
        
        if (currentLanguage === 'en') {
          setTranslations(originalTexts);
          return;
        }

        // Translate each text individually using translateText method (like login and home screens)
        const translationPromises = Object.entries(originalTexts).map(async ([key, value]) => {
          console.log(`[StockSharing] Translating "${key}": "${value}" to ${currentLanguage}`);
          const translated = await translationService.translateText(value, currentLanguage);
          console.log(`[StockSharing] Translation result for "${key}":`, translated);
          return [key, translated.translatedText];
        });
        
        const translatedEntries = await Promise.all(translationPromises);
        const newTranslations = Object.fromEntries(translatedEntries);
        console.log('[StockSharing] All translations loaded:', newTranslations);
        setTranslations(newTranslations);
      } catch (error) {
        console.error('[StockSharing] Error loading translations:', error);
        setTranslations(originalTexts); // Fallback to original texts
      }
    };

    loadTranslations();
  }, [currentLanguage]);

  // Create a synchronous translation function for UI text
  const t = (key: string) => {
    const fallbackTranslations: Record<string, string> = {
      phone: 'Phone Number',
      manualAddress: 'Enter address manually',
      name: 'Product Name',
      quantity: 'Quantity',
      shareStock: 'Share Stock',
      nearbyStock: 'Nearby Stock',
      mySharedProducts: 'My Shared Products',
      selectTabToViewContent: 'Select a tab above to view content'
    };
    
    return translations[key] || fallbackTranslations[key] || key;
  };

  // Define categories and subcategories inside the component to access translation function
  // State for categories and subcategories
  const [categories, setCategories] = useState<Array<{ label: string; value: string }>>([]);
  const [subCategories, setSubCategories] = useState<Record<string, Array<{ label: string; value: string }>>>({});

  // Initialize categories and subcategories with translations
  useEffect(() => {
    const initializeCategories = () => {
      const translatedCategories = [
        { label: t('categories.groceries'), value: 'groceries' },
        { label: t('categories.personal_care'), value: 'personal-care' },
        { label: t('categories.household'), value: 'household' },
        { label: t('categories.beverages'), value: 'beverages' },
        { label: t('categories.snacks'), value: 'snacks' },
      ];

      const translatedSubCategories = {
        groceries: [
          { label: t('categories.rice_grains'), value: 'rice-grains' },
          { label: t('categories.oil_ghee'), value: 'oil-ghee' },
          { label: t('categories.spices'), value: 'spices' },
        ],
        'personal-care': [
          { label: t('categories.hair_care'), value: 'hair-care' },
          { label: t('categories.skin_care'), value: 'skin-care' },
          { label: t('categories.oral_care'), value: 'oral-care' },
        ],
        household: [
          { label: t('categories.cleaning'), value: 'cleaning' },
          { label: t('categories.kitchen'), value: 'kitchen' },
          { label: t('categories.bathroom'), value: 'bathroom' },
        ],
        beverages: [
          { label: t('categories.tea_coffee'), value: 'tea-coffee' },
          { label: t('categories.soft_drinks'), value: 'soft-drinks' },
          { label: t('categories.juices'), value: 'juices' },
        ],
        snacks: [
          { label: t('categories.chips'), value: 'chips' },
          { label: t('categories.biscuits'), value: 'biscuits' },
          { label: t('categories.sweets'), value: 'sweets' },
        ],
      };

      setCategories(translatedCategories);
      setSubCategories(translatedSubCategories);
    };

    initializeCategories();
  }, [currentLanguage]);
  const [activeTab, setActiveTab] = useState<'share' | 'nearby' | 'delivery' | null>('share');
  const [translatedSharedProducts, setTranslatedSharedProducts] = useState<SharedProduct[]>([]);
  const [translatedNearbyProducts, setTranslatedNearbyProducts] = useState<SharedProduct[]>([]);
  const [form, setForm] = useState<ProductForm>({
    name: '',
    brand: '',
    category: '',
    subCategory: '',
    units: '',
    price: '',
    image: null,
    description: '',
  });
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [menuVisible, setMenuVisible] = useState(false);
  const [sharedProducts, setSharedProducts] = useState<SharedProduct[]>([]);
  const [nearbyProducts, setNearbyProducts] = useState<SharedProduct[]>([]);
  const [userLocation, setUserLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [showSharedProducts, setShowSharedProducts] = useState(false);
  const [showingSharedTab, setShowingSharedTab] = useState(false);
  const [showFormContent, setShowFormContent] = useState(false);
  const [deliveryForm, setDeliveryForm] = useState({
    customerName: '',
    customerPhone: '',
    customerAddress: '',
    manualAddress: '',
    smartAddress: '',
    deliveryInstructions: '',
    productName: '',
    quantity: '',
    pricePerUnit: '',
    vehicleType: '2wheeler' as '2wheeler' | '3wheeler' | '4wheeler',
    paymentMethod: 'cod' as 'cod' | 'prepaid',
    googleMapsUrl: '',
    deliveryLocation: null as { lat: number; lng: number } | null,
    distance: 0
  });

  useEffect(() => {
    fetchUserLocation();
    fetchSharedProducts();
  }, []);

  // Handle back button navigation on main stock screen
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // Navigate to home screen when back button is pressed on stock screen
      router.push('/(main)/home');
      // Return true to prevent default back button behavior
      return true;
    });

    return () => backHandler.remove();
  }, [router]);

  const fetchUserLocation = async () => {
    try {
      // First try to get retailer's location from profiles table
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('latitude, longitude')
        .eq('id', user?.id)
        .single();
      
      if (!profileError && profileData && profileData.latitude && profileData.longitude) {
        console.log('Got retailer location from profiles table:', profileData);
        setUserLocation({
          latitude: Number(profileData.latitude),
          longitude: Number(profileData.longitude)
        });
        return;
      }
      
      // Fallback to device location if profile location not available
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(translations.permissionDenied, translations.locationPermissionRequired);
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      setUserLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      });
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  const fetchSharedProducts = async () => {
    try {
      setLoading(true);
      
      // Fetch products shared by the current user - using the correct table structure
      const { data: userProducts, error: userError } = await supabase
        .from('shared_stock')
        .select('*')
        .eq('user_id', user.id);
      
      if (userError) {
        console.error('Error fetching shared products:', userError);
        // If there's an error, just set an empty array
        setSharedProducts([]);
        setTranslatedSharedProducts([]);
      } else {
        const products = userProducts || [];
        setSharedProducts(products);
        
        // Translate product data
        if (products.length > 0) {
          const translated = await translateArrayFields(
            products,
            ['name', 'brand', 'description'],
            currentLanguage
          );
          setTranslatedSharedProducts(translated);
        } else {
          setTranslatedSharedProducts([]);
        }
      }
      
      // Fetch nearby products if location is available
      if (userLocation) {
        // Fetch all available products from other users
        const { data: nearby, error: nearbyError } = await supabase
          .from('shared_stock')
          .select('*')
          .neq('user_id', user.id)
          .eq('is_available', true);
        
        if (nearbyError) {
          console.error('Error fetching nearby products:', nearbyError);
          setNearbyProducts([]);
          setTranslatedNearbyProducts([]);
        } else {
          // Calculate distances client-side
          const productsWithDistance = (nearby || []).map(product => {
            if (product?.latitude && product?.longitude && userLocation) {
              const distance = calculateDistance(
                userLocation.latitude,
                userLocation.longitude,
                product.latitude,
                product.longitude
              );
              return { ...product, distance };
            }
            return { ...product, distance: null };
          });
          
          // Sort by distance
          const sortedProducts = productsWithDistance.sort((a, b) => {
            if (a.distance === null) return 1;
            if (b.distance === null) return -1;
            return a.distance - b.distance;
          });
          
          setNearbyProducts(sortedProducts);
          
          // Translate nearby product data
          if (sortedProducts.length > 0) {
            const translatedNearby = await translateArrayFields(
              sortedProducts,
              ['name', 'brand', 'description'],
              currentLanguage
            );
            setTranslatedNearbyProducts(translatedNearby);
          } else {
            setTranslatedNearbyProducts([]);
          }
        }
      }
    } catch (error) {
      console.error('Error in fetchSharedProducts:', error);
      // Set empty arrays to prevent UI errors
      setSharedProducts([]);
      setNearbyProducts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    const distance = R * c; // Distance in km
    return distance;
  };

  const deg2rad = (deg: number) => {
    return deg * (Math.PI/180);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchSharedProducts();
  };

  const pickImage = async () => {
    try {
      // Request permissions
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert(translations.permissionRequired, translations.cameraRollPermissionsNeeded);
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
        const asset = result.assets[0];
        
        // Resize image using ImageManipulator
        const manipulatedImage = await ImageManipulator.manipulateAsync(
          asset.uri,
          [{ resize: { width: 2000, height: 2000 } }],
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );
        
        setForm({ ...form, image: manipulatedImage.base64 || '' });
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert(translations.error, translations.failedToPickImage);
    }
  };

  const handleSelectImage = async () => {
    try {
      // Request permissions
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert(translations.permissionRequired, translations.cameraRollPermissionsNeeded);
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
        const asset = result.assets[0];
        
        // Resize image using ImageManipulator
        const manipulatedImage = await ImageManipulator.manipulateAsync(
          asset.uri,
          [{ resize: { width: 2000, height: 2000 } }],
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );
        
        // Store the URI and base64 separately
        setForm({ 
          ...form, 
          image: {
            uri: manipulatedImage.uri,
            base64: manipulatedImage.base64 || ''
          }
        });
      }
    } catch (error) {
      console.error('Error selecting image:', error);
      setSnackbarMessage('Failed to select image');
      setSnackbarVisible(true);
    }
  };

  const handleInputChange = (field: keyof ProductForm, value: string) => {
    setForm({ ...form, [field]: value });
  };

  const validateForm = () => {
    if (!form.name.trim()) {
      Alert.alert(translations.error, translations.productNameRequired);
      return false;
    }
    if (!form.units.trim() || isNaN(Number(form.units)) || Number(form.units) <= 0) {
      Alert.alert(translations.error, translations.validUnitsRequired);
      return false;
    }
    if (!form.price.trim() || isNaN(Number(form.price)) || Number(form.price) < 0) {
      Alert.alert(translations.error, translations.validPriceRequired);
      return false;
    }
    if (!form.category) {
      Alert.alert(translations.error, translations.categoryRequired);
      return false;
    }
    return true;
  };

  const handleShareProduct = async () => {
    try {
      if (!form.name || !form.category || !form.units || !form.price) {
        setSnackbarMessage('Please fill all required fields');
        setSnackbarVisible(true);
        return;
      }

      setLoading(true);

      // Prepare the data to be inserted or updated
      const productData = {
        user_id: user.id,
        name: form.name,
        brand: form.brand || null,
        category: form.category,
        sub_category: form.subCategory || null,
        units: parseInt(form.units),
        price: parseFloat(form.price),
        description: form.description || null,
        is_available: true,
        latitude: userLocation?.latitude || null,
        longitude: userLocation?.longitude || null,
        location_address: userLocation ? 'Current location' : null,
      };

      // If there's an image, upload it first
      let imageUrl = null;
      if (form.image && form.image.base64) {
        try {
          const fileName = `${user.id}_${Date.now()}.jpg`;
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('shared-stock-images')
            .upload(fileName, decode(form.image.base64), {
              contentType: 'image/jpeg',
              upsert: true
            });

          if (uploadError) throw uploadError;
          
          // Get the public URL
          const { data: urlData } = supabase.storage
            .from('shared-stock-images')
            .getPublicUrl(fileName);
            
          imageUrl = urlData.publicUrl;
        } catch (imageError) {
          console.error('Image upload error:', imageError);
          // Continue without the image if upload fails
        }
      }

      // Add the image URL to the product data
      const finalProductData = {
        ...productData,
        image_url: imageUrl,
      };

      let error;
      
      if (editingProductId) {
        // Update existing product
        const { error: updateError } = await supabase
          .from('shared_stock')
          .update(finalProductData)
          .eq('id', editingProductId);
          
        error = updateError;
      } else {
        // Insert new product
        const { error: insertError } = await supabase
          .from('shared_stock')
          .insert([finalProductData]);
          
        error = insertError;
      }

      if (error) throw error;

      // Reset form and editing state
      setForm({
        name: '',
        brand: '',
        category: '',
        subCategory: '',
        units: '',
        price: '',
        image: null,
        description: '',
      });
      setEditingProductId(null);
      setShowFormContent(false);
      
      // Switch to the shared tab to see the updated product
      setShowingSharedTab(true);
      
      setSnackbarMessage(editingProductId ? 'Product updated successfully' : 'Product shared successfully');
      setSnackbarVisible(true);
      
      // Refresh the shared products list
      fetchSharedProducts();
    } catch (error) {
      console.error('Error sharing product:', error);
      setSnackbarMessage('Failed to share product: ' + (error.message || 'Unknown error'));
      setSnackbarVisible(true);
    } finally {
      setLoading(false);
    }
  };

  const handleEditProduct = (product: SharedProduct) => {
    // Set the form with the product details
    setForm({
      name: product?.name || '',
      brand: product?.brand || '',
      category: product?.category || '',
      subCategory: product?.sub_category || '',
      units: product?.units?.toString() || '0',
      price: product?.price?.toString() || '0',
      image: null, // We can't edit the image directly
      description: product?.description || '',
    });
    
    // Set the editing product ID
    setEditingProductId(product?.id || '');
    
    // Show form content when editing
    setShowFormContent(true);
    
    // Switch to the share tab for editing
    setShowingSharedTab(false);
    setActiveTab('share');
  };

  const handleDeleteProduct = async (productId: string) => {
    try {
      const { error } = await supabase
        .from('shared_stock')
        .delete()
        .eq('id', productId);
      
      if (error) throw error;
      
      // Refresh the list after deletion
      fetchSharedProducts();
      
      setSnackbarMessage('Product deleted successfully');
      setSnackbarVisible(true);
    } catch (error) {
      console.error('Error deleting product:', error);
      setSnackbarMessage('Failed to delete product');
      setSnackbarVisible(true);
    }
  };

  const calculateDeliveryFee = (distance: number, vehicleType: '2wheeler' | '3wheeler' | '4wheeler') => {
    return calculateDeliveryFeeUtil(distance, vehicleType);
  };

  // Enhanced function to calculate distance and update delivery form
  const updateDeliveryDistance = async () => {
    if (!userLocation) return;

    let distance = 0;
    
    if (deliveryForm.addressType === 'smart') {
      // For smart address, use coordinates or Google Maps URL
      if (deliveryForm.deliveryLocation) {
        distance = calculateDeliveryDistance(
          userLocation.latitude,
          userLocation.longitude,
          deliveryForm.deliveryLocation
        );
      } else if (deliveryForm.googleMapsUrl) {
        distance = calculateDeliveryDistance(
          userLocation.latitude,
          userLocation.longitude,
          deliveryForm.googleMapsUrl
        );
      }
    }
    // For manual address, distance remains 0 as we can't calculate without coordinates
    
    setDeliveryForm(prev => ({ ...prev, distance }));
  };

  // Function to handle manual address changes
  const handleManualAddressChange = (value: string) => {
    setDeliveryForm(prev => ({
      ...prev,
      manualAddress: value,
      customerAddress: value
    }));
  };

  // Function to handle smart address selection
  const handleSmartAddressSelection = async (place: any) => {
    console.log('Smart address selected:', place);
    
    // Validate that we have proper coordinates
    if (!place.lat || !place.lng) {
      console.error('Invalid coordinates from Places API:', place);
      Alert.alert(translations.error, translations.couldNotGetLocationCoordinates);
      return;
    }
    
    const coordinates = {
      lat: place.lat,
      lng: place.lng
    };
    
    console.log('Places API coordinates:', coordinates);
    
    const newForm = {
      ...deliveryForm,
      smartAddress: place.address,
      customerAddress: place.address,
      googleMapsUrl: place.place_id ? `https://maps.google.com/?place_id=${place.place_id}` : '',
      deliveryLocation: coordinates
    };
    setDeliveryForm(newForm);
    
    // Calculate distance using retailer location from profiles table
    try {
      const retailerLocation = await getRetailerLocation();
      if (retailerLocation) {
        const distance = calculateDeliveryDistance(
          retailerLocation.lat,
          retailerLocation.lng,
          coordinates.lat,
          coordinates.lng
        );
        console.log('Distance calculated from Places API coordinates:', distance, 'km');
        setDeliveryForm(prev => ({ ...prev, distance }));
      } else {
        console.warn('Could not get retailer location for distance calculation');
      }
    } catch (error) {
      console.error('Error calculating distance from Places API selection:', error);
    }
  };

  // Debug helper function - can be called from console
  const debugGoogleMapsUrl = async (url: string) => {
    console.log('\n=== DEBUGGING GOOGLE MAPS URL ===');
    return await debugCoordinateExtraction(url);
  };

  // Make debug function available globally for console access
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).debugGoogleMapsUrl = debugGoogleMapsUrl;
      console.log('\n🔧 Debug helper available! Use: debugGoogleMapsUrl("your-google-maps-url")');
    }
  }, []);

  // Function to handle Google Maps URL detection
  const getRetailerLocation = async () => {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('latitude, longitude')
        .eq('id', user?.id)
        .single();
      
      if (!profileError && profileData && profileData.latitude && profileData.longitude) {
        return {
          latitude: Number(profileData.latitude),
          longitude: Number(profileData.longitude)
        };
      }
      return null;
    } catch (error) {
      console.error('Error getting retailer location:', error);
      return null;
    }
  };

  const handleGoogleMapsUrlDetection = async (url: string) => {
    console.log('Detecting Google Maps URL:', url);
    try {
      // Check if it's a shortened URL (maps.app.goo.gl format)
      const isShortenedUrl = url.includes('maps.app.goo.gl') || url.includes('goo.gl/maps');
      
      if (isShortenedUrl) {
        console.log('Shortened URL detected, using minimum delivery fee without distance calculation');
        // For shortened URLs, accept as-is and use minimum delivery fee
        setDeliveryForm(prev => ({
          ...prev,
          googleMapsUrl: url,
          deliveryLocation: null, // No specific coordinates needed
          distance: 0 // Use minimum fee
        }));
        return;
      }
      
      const coords = await extractCoordinatesFromGoogleMapsUrl(url);
      
      if (coords) {
        console.log('Successfully extracted coordinates:', coords);
        
        // Get retailer location from profiles table
        const retailerLocation = await getRetailerLocation();
        
        if (retailerLocation) {
          const distance = await calculateDeliveryDistance(
            retailerLocation.latitude,
            retailerLocation.longitude,
            coords
          );
          console.log('Calculated distance using retailer location:', distance, 'km');
          
          setDeliveryForm(prev => ({
            ...prev,
            googleMapsUrl: url,
            deliveryLocation: coords,
            distance
          }));
        } else {
          console.log('Retailer location not available, setting coordinates without distance');
          setDeliveryForm(prev => ({
            ...prev,
            googleMapsUrl: url,
            deliveryLocation: coords,
            distance: 0
          }));
        }
      } else {
        console.warn('Failed to extract coordinates from URL:', url);
        setDeliveryForm(prev => ({
          ...prev,
          googleMapsUrl: url,
          deliveryLocation: null,
          distance: 0
        }));
      }
    } catch (error) {
      console.error('Error extracting coordinates from URL:', error);
      setDeliveryForm(prev => ({
        ...prev,
        googleMapsUrl: url,
        deliveryLocation: null,
        distance: 0
      }));
    }
  };

  // Removed local extractLocationFromGoogleMapsUrl function
  // Now using the centralized extractCoordinatesFromGoogleMapsUrl from utils
  const handleAddressChange = async (address: string) => {
    setDeliveryForm(prev => ({ ...prev, customerAddress: address }));
    
    // If it looks like a Google Maps URL, try to extract coordinates
    if (address.includes('maps.google.com') || address.includes('goo.gl/maps') || address.includes('maps.app.goo.gl')) {
      try {
        const coords = await extractCoordinatesFromGoogleMapsUrl(address);
        if (coords) {
          console.log('Coordinates extracted from URL:', coords);
          // Get retailer location from profiles table
          const retailerLocation = await getRetailerLocation();
          
          if (retailerLocation) {
            const distance = calculateDeliveryDistance(
              retailerLocation.lat,
              retailerLocation.lng,
              coords.lat,
              coords.lng
            );
            console.log('Distance calculated from URL coordinates:', distance, 'km');
            setDeliveryForm(prev => ({
              ...prev,
              googleMapsUrl: address,
              deliveryLocation: coords,
              distance: distance
            }));
          }
        } else {
          console.warn('Could not extract coordinates from URL:', address);
        }
      } catch (error) {
        console.error('Error extracting coordinates or calculating distance:', error);
      }
    } else {
      // Reset for non-URL addresses
      setDeliveryForm(prev => ({
        ...prev,
        googleMapsUrl: '',
        deliveryLocation: null,
        distance: 0
      }));
    }
  };

  const handleBookDelivery = async () => {
    try {
      // Validate form
      if (!deliveryForm.customerName.trim()) {
        Alert.alert(translations.error, translations.customerNameRequired);
        return;
      }
      if (!deliveryForm.customerPhone.trim()) {
        Alert.alert(translations.error, translations.customerPhoneRequired);
        return;
      }
      if (!deliveryForm.manualAddress.trim()) {
        Alert.alert(translations.error, translations.manualAddressRequired);
        return;
      }
      if (!deliveryForm.smartAddress.trim()) {
        Alert.alert(translations.error, translations.smartAddressRequired);
        return;
      }
      if (!deliveryForm.productName.trim()) {
        Alert.alert(translations.error, translations.productNameRequired);
        return;
      }
      if (!deliveryForm.quantity.trim() || isNaN(Number(deliveryForm.quantity)) || Number(deliveryForm.quantity) <= 0) {
        Alert.alert(translations.error, translations.validQuantityRequired);
        return;
      }
      if (!deliveryForm.pricePerUnit.trim() || isNaN(Number(deliveryForm.pricePerUnit)) || Number(deliveryForm.pricePerUnit) <= 0) {
        Alert.alert(translations.error, translations.validPriceRequired);
        return;
      }

      setLoading(true);

      // Calculate delivery fee based on distance and vehicle type
      let effectiveDistance = deliveryForm.distance;
      
      // If no distance calculated yet but we have delivery coordinates, calculate it now
      if (effectiveDistance === 0 && deliveryForm.deliveryLocation) {
        const retailerLocation = await getRetailerLocation();
        if (retailerLocation) {
          effectiveDistance = await calculateDeliveryDistance(
            retailerLocation.latitude,
            retailerLocation.longitude,
            deliveryForm.deliveryLocation
          );
          console.log('Calculated distance for delivery fee:', effectiveDistance, 'km');
        }
      }
      
      // Use actual distance if available, otherwise use minimum base fee
      // For shortened Google Maps URLs, always use minimum fee (distance = 1)
      const isShortUrl = deliveryForm.googleMapsUrl && 
        (deliveryForm.googleMapsUrl.includes('maps.app.goo.gl') || 
         deliveryForm.googleMapsUrl.includes('goo.gl/maps'));
      const finalDistance = isShortUrl ? 1 : (effectiveDistance > 0 ? effectiveDistance : 1);
      const deliveryFee = calculateDeliveryFeeUtil(finalDistance, deliveryForm.vehicleType);
      
      console.log('Delivery fee calculation:', {
        originalDistance: deliveryForm.distance,
        effectiveDistance,
        finalDistance,
        deliveryFee,
        vehicleType: deliveryForm.vehicleType
      });

       // Calculate subtotal and total amount
       const subtotal = parseInt(deliveryForm.quantity) * parseFloat(deliveryForm.pricePerUnit);
       const totalAmount = subtotal + deliveryFee;

       // Create delivery booking using the SQL function
       const { data, error } = await supabase.rpc('create_stock_delivery_booking', {
         p_customer_name: deliveryForm.customerName.trim(),
         p_customer_phone: deliveryForm.customerPhone.trim(),
         p_customer_address: deliveryForm.customerAddress.trim(),
         p_delivery_instructions: deliveryForm.deliveryInstructions.trim() || null,
         p_product_name: deliveryForm.productName.trim(),
         p_quantity: parseInt(deliveryForm.quantity),
         p_price_per_unit: parseFloat(deliveryForm.pricePerUnit),
         p_subtotal: subtotal,
         p_delivery_fee: deliveryFee,
         p_total_amount: totalAmount,
         p_vehicle_type: deliveryForm.vehicleType,
         p_payment_method: deliveryForm.paymentMethod,
         p_google_maps_url: deliveryForm.googleMapsUrl || null,
         p_delivery_location: deliveryForm.deliveryLocation ? JSON.stringify({
           lat: deliveryForm.deliveryLocation.lat,
           lng: deliveryForm.deliveryLocation.lng,
           address: deliveryForm.customerAddress.trim()
         }) : JSON.stringify({
           address: deliveryForm.customerAddress.trim()
         }),
         p_distance_km: effectiveDistance || null,
         p_delivery_latitude: deliveryForm.deliveryLocation?.lat,
         p_delivery_longitude: deliveryForm.deliveryLocation?.lng,
         p_address_type: 'both',
         p_manual_address: deliveryForm.manualAddress.trim(),
         p_smart_address: deliveryForm.smartAddress.trim()
       });

      if (error) {
        console.error('Error creating delivery booking:', error);
        throw error;
      }

      // Reset form
       setDeliveryForm({
         customerName: '',
         customerPhone: '',
         customerAddress: '',
         manualAddress: '',
         smartAddress: '',
         deliveryInstructions: '',
         productName: '',
         quantity: '',
         pricePerUnit: '',
         vehicleType: '2wheeler',
         paymentMethod: 'cod',
         googleMapsUrl: '',
         deliveryLocation: null,
         distance: 0
       });

      setSnackbarMessage(t('deliveryBookedSuccessfully'));
      setSnackbarVisible(true);

    } catch (error) {
      console.error('Error booking delivery:', error);
      setSnackbarMessage(t('failedToBookDelivery'));
      setSnackbarVisible(true);
    } finally {
      setLoading(false);
    }
  };

  const handleContactSeller = (product: SharedProduct) => {
    // Implement contact functionality - could open chat or show contact info
    const message = translations.contactSellerMessage.replace('[PRODUCT_NAME]', product?.name || 'this product');
    Alert.alert(
      translations.contactSeller,
      message,
      [
        { text: translations.cancel, style: 'cancel' },
        { text: translations.contact, onPress: () => console.log('Contact seller for', product?.id || 'unknown') }
      ]
    );
  };

  const renderShareForm = () => {
    // Get subcategories based on selected category
    const subcategories = form.category ? subCategories[form.category] || [] : [];

    return (
      <View style={styles.formContainer}>
        <Text variant="titleMedium" style={styles.formTitle}>{t('shareYourExcessStock')}</Text>
        
        {!showFormContent ? (
          <View style={styles.buttonOnlyContainer}>
            <Button 
              mode="contained" 
              onPress={() => setShowFormContent(true)}
              style={styles.startSharingButton}
              icon="plus"
            >
              {t('startSharing')}
            </Button>
          </View>
        ) : (
          <>
        <Pressable onPress={handleSelectImage} style={styles.imageUpload}>
          {form.image ? (
            <Image source={{ uri: form.image.uri }} style={styles.previewImage} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <IconButton icon="camera" size={40} />
              <Text>{t('tapToAddImage')}</Text>
            </View>
          )}
        </Pressable>
        
        <TextInput
          label={t('productName')}
          value={form.name}
          onChangeText={(text) => setForm({ ...form, name: text })}
          style={styles.input}
          mode="outlined"
        />
        
        <TextInput
          label={t('brandOptional')}
          value={form.brand}
          onChangeText={(text) => setForm({ ...form, brand: text })}
          style={styles.input}
          mode="outlined"
        />
        
        {/* Category Selection */}
        <Text style={styles.label}>{t('category')}</Text>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.categoryScroll}
        >
          {categories.map((category) => (
            <Pressable
              key={category.value}
              style={[
                styles.categoryChip,
                form.category === category.value && styles.selectedCategoryChip
              ]}
              onPress={() => {
                setForm({ 
                  ...form, 
                  category: category.value,
                  subCategory: '' // Reset subcategory when category changes
                });
              }}
            >
              <Text 
                style={[
                  styles.categoryChipText,
                  form.category === category.value && styles.selectedCategoryChipText
                ]}
              >
                {category.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        
        {/* Subcategory Selection - only show if a category is selected */}
        {form.category && subcategories.length > 0 && (
          <>
            <Text style={styles.label}>{t('subcategory')}</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.categoryScroll}
            >
              {subcategories.map((subcat) => (
                <Pressable
                  key={subcat.value}
                  style={[
                    styles.categoryChip,
                    form.subCategory === subcat.value && styles.selectedCategoryChip
                  ]}
                  onPress={() => setForm({ ...form, subCategory: subcat.value })}
                >
                  <Text 
                    style={[
                      styles.categoryChipText,
                      form.subCategory === subcat.value && styles.selectedCategoryChipText
                    ]}
                  >
                    {subcat.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        )}
        
        <View style={styles.row}>
          <TextInput
            label={t('unitsAvailable')}
            value={form.units}
            onChangeText={(text) => setForm({ ...form, units: text })}
            style={[styles.input, styles.halfInput]}
            mode="outlined"
            keyboardType="numeric"
          />
          
          <TextInput
            label={t('pricePerUnit')}
            value={form.price}
            onChangeText={(text) => setForm({ ...form, price: text })}
            style={[styles.input, styles.halfInput]}
            mode="outlined"
            keyboardType="numeric"
            left={<TextInput.Affix text="₹" />}
          />
        </View>
        
        <TextInput
          label={t('descriptionOptional')}
          value={form.description}
          onChangeText={(text) => setForm({ ...form, description: text })}
          style={styles.input}
          mode="outlined"
          multiline
          numberOfLines={3}
        />
        
        <Button 
          mode="contained" 
          onPress={handleShareProduct}
          style={styles.submitButton}
          loading={loading}
          disabled={loading}
        >
          {editingProductId ? t('updateProduct') : t('shareProduct')}
        </Button>
        </>
        )}
      </View>
    );
  };

  const renderSharedProducts = () => {
    if (loading && !refreshing) {
      return (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loaderText}>{t('loadingYourSharedProducts')}</Text>
        </View>
      );
    }

    if (sharedProducts.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.noProductsText}>
            {t('noSharedProductsYet')}
          </Text>
          <Button 
            mode="contained" 
            onPress={() => {
              setShowingSharedTab(false);
              setActiveTab('share');
            }} 
            style={styles.addButton}
          >
            {t('shareYourFirstProduct')}
          </Button>
        </View>
      );
    }

    return (
      <View style={styles.productsContainer}>
        <Text variant="titleMedium" style={styles.sectionTitle}>
          {t('yourSharedProducts')}
        </Text>
        
        {(translatedSharedProducts.length > 0 ? translatedSharedProducts : sharedProducts).map((product) => (
          <Card key={product?.id || Math.random()} style={styles.productCard}>
              {product?.image_url && (
                <Card.Cover source={{ uri: product.image_url }} style={styles.productCardImage} />
              )}
            <Card.Content>
              <View style={styles.productHeader}>
                <Text variant="titleLarge">{String(product?.name || 'Product Name')}</Text>
                <Text variant="titleLarge">₹{String(product?.price || '0')}</Text>
              </View>
              
              <Text variant="bodyMedium">{t('brand')}: {String(product?.brand || t('notSpecified'))}</Text>
                <Text variant="bodyMedium">{t('category')}: {String(product?.category || t('notSpecified'))}</Text>
                <Text variant="bodyMedium">{t('availableUnits')}: {String(product?.units || '0')}</Text>
              
              {product?.description && (
                  <Text variant="bodySmall" style={styles.description}>
                    {String(product?.description || 'No description available')}
                  </Text>
                )}
            </Card.Content>
            
            <Card.Actions>
              <Button 
                mode="outlined" 
                onPress={() => handleEditProduct(product)}
                icon="pencil"
              >
                {t('edit')}
              </Button>
              <Button 
                mode="outlined" 
                onPress={() => handleDeleteProduct(product?.id || '')}
                icon="delete"
                textColor="#ff4444"
              >
                {t('delete')}
              </Button>
            </Card.Actions>
          </Card>
        ))}
      </View>
    );
  };

  const renderNearbyProducts = () => (
    <View style={styles.productsContainer}>
      <Text variant="titleMedium" style={styles.sectionTitle}>{t('nearbyAvailableStock')}</Text>
      
      {!userLocation ? (
        <Text style={styles.noProductsText}>{t('locationAccessRequired')}</Text>
      ) : loading && nearbyProducts.length === 0 ? (
        <ActivityIndicator style={styles.loader} />
      ) : nearbyProducts.length === 0 ? (
        <Text style={styles.noProductsText}>{t('noNearbyStockAvailable')}</Text>
      ) : (
        <ScrollView 
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          {(translatedNearbyProducts.length > 0 ? translatedNearbyProducts : nearbyProducts).map((product) => (
            <Card key={product?.id || Math.random()} style={styles.productCard}>
              {product?.image_url && (
                <Card.Cover source={{ uri: product.image_url }} style={styles.productCardImage} />
              )}
              <Card.Content>
                <Text variant="titleMedium">{String(product?.name || 'Product Name')}</Text>
                <Text variant="bodyMedium">{t('units')}: {String(product?.units || '0')}</Text>
                <Text variant="bodyMedium">{t('price')}: ₹{String(product?.price || '0')}</Text>
                {product?.brand && <Text variant="bodySmall">{t('brand')}: {String(product.brand || 'Unknown Brand')}</Text>}
                {product?.category && <Text variant="bodySmall">{t('category')}: {String(product.category || 'Unknown Category')}</Text>}
                {product?.distance !== null && (
                  <Text variant="bodySmall">{t('distance')}: {String((() => {
                    const distanceValue = typeof product?.distance === 'number' 
                      ? product.distance
                      : typeof product?.distance === 'string'
                      ? parseFloat(product.distance)
                      : typeof product?.distance === 'object' && product?.distance !== null
                      ? (product.distance?.distance || product.distance?.value || 0)
                      : 0;
                    return (distanceValue || 0).toFixed(1);
                  })() || '0.0')} {t('kmAway')}</Text>
                )}
                {product.profiles?.business_details?.shopName && (
                  <Text variant="bodySmall">{t('seller')}: {String(product.profiles.business_details.shopName || 'Unknown Seller')}</Text>
                )}
                {product?.description && (
                  <Text variant="bodySmall" style={styles.description}>{String(product.description || 'No description available')}</Text>
                )}
              </Card.Content>
              <Card.Actions>
                <Button 
                  mode="contained" 
                  onPress={() => handleContactSeller(product)}
                  style={styles.buyButton}
                >
                  {t('contactSeller')}
                </Button>
              </Card.Actions>
            </Card>
          ))}
        </ScrollView>
      )}
    </View>
  );

  const renderDeliveryBooking = () => {
    const subtotal = deliveryForm.quantity && deliveryForm.pricePerUnit 
      ? parseFloat(deliveryForm.quantity) * parseFloat(deliveryForm.pricePerUnit) 
      : 0;
    // For manual addresses, use base fee; for smart addresses, use calculated distance
    // Check if it's a shortened URL (maps.app.goo.gl format) - use minimum fee
    const isShortenedUrl = deliveryForm.googleMapsUrl && 
      (deliveryForm.googleMapsUrl.includes('maps.app.goo.gl') || deliveryForm.googleMapsUrl.includes('goo.gl/maps'));
    
    const effectiveDistance = deliveryForm.addressType === 'manual' ? 1 : 
      isShortenedUrl ? 1 : // Use minimum fee for shortened URLs
      (deliveryForm.distance || 1);
    
    const deliveryFee = calculateDeliveryFee(effectiveDistance, deliveryForm.vehicleType);
    const total = subtotal + deliveryFee;

    return (
      <ScrollView style={styles.container}>
        <Text style={styles.sectionTitle}>{t('deliverToCustomers')}</Text>
        <Card style={styles.formCard}>
          <Card.Content>
            <Text style={styles.formSectionTitle}>{t('customerDetails')}</Text>
            
            <TextInput
              label={t('customerName')}
              value={deliveryForm.customerName}
              onChangeText={(value) => setDeliveryForm({...deliveryForm, customerName: value})}
              style={styles.input}
              mode="outlined"
            />
            
            <TextInput
              label={t('phone')}
              value={deliveryForm.customerPhone}
              onChangeText={(value) => setDeliveryForm({...deliveryForm, customerPhone: value})}
              style={styles.input}
              mode="outlined"
              keyboardType="phone-pad"
            />
            
            <Text style={styles.formSectionTitle}>Address Details</Text>
            
            <Text style={styles.fieldLabel}>Smart Address Search *</Text>
            <GooglePlacesAutocomplete
              placeholder="Search address or paste Google Maps link"
              initialValue={deliveryForm.smartAddress}
              onPlaceSelected={handleSmartAddressSelection}
              onAddressChange={(address) => {
                setDeliveryForm(prev => ({ 
                  ...prev, 
                  smartAddress: address,
                  customerAddress: address
                }));
              }}
              onGoogleMapsUrlDetected={handleGoogleMapsUrlDetection}
              style={styles.input}
              mode="outlined"
            />
            {deliveryForm.distance > 0 && (
              <Text style={styles.distanceText}>
                📍 Distance: {(() => {
                  const distanceValue = typeof deliveryForm.distance === 'number' 
                    ? deliveryForm.distance
                    : typeof deliveryForm.distance === 'string'
                    ? parseFloat(deliveryForm.distance)
                    : typeof deliveryForm.distance === 'object' && deliveryForm.distance !== null
                    ? (deliveryForm.distance.distance || deliveryForm.distance.value || 0)
                    : 0;
                  return (distanceValue || 0).toFixed(2);
                })()} km
              </Text>
            )}
            
            <Text style={styles.fieldLabel}>Manual Address Entry *</Text>
            <TextInput
              label={t('manualAddress')}
              placeholder="Type the complete address manually (for delivery partner reference)"
              value={deliveryForm.manualAddress}
              onChangeText={handleManualAddressChange}
              style={styles.input}
              mode="outlined"
              multiline
              numberOfLines={3}
            />
            <Text style={styles.manualAddressNote}>
              ℹ️ Note: Both smart search and manual address are required. Smart address is used for distance calculation and delivery fee, while manual address serves as backup reference for delivery partners.
            </Text>
            
            <Text style={styles.formSectionTitle}>Delivery Options</Text>
            
            <Text style={styles.fieldLabel}>Vehicle Type</Text>
            <SegmentedButtons
              value={deliveryForm.vehicleType}
              onValueChange={(value) => setDeliveryForm({...deliveryForm, vehicleType: value as '2wheeler' | '3wheeler' | '4wheeler'})}
              buttons={[
                { value: '2wheeler', label: '2-Wheeler' },
                { value: '3wheeler', label: '3-Wheeler' },
                { value: '4wheeler', label: '4-Wheeler' },
              ]}
              style={styles.vehicleSegmentedButtons}
            />
            
            <Text style={styles.fieldLabel}>Payment Method</Text>
            <SegmentedButtons
              value={deliveryForm.paymentMethod}
              onValueChange={(value) => setDeliveryForm({...deliveryForm, paymentMethod: value as 'cod' | 'prepaid'})}
              buttons={[
                { value: 'cod', label: 'Cash on Delivery' },
                { value: 'prepaid', label: 'Prepaid' },
              ]}
              style={styles.paymentSegmentedButtons}
            />
            
            <TextInput
              label={`Delivery Instructions (Optional)`}
              value={deliveryForm.deliveryInstructions}
              onChangeText={(value) => setDeliveryForm({...deliveryForm, deliveryInstructions: value})}
              style={styles.input}
              mode="outlined"
              multiline
              numberOfLines={2}
            />
            
            <Text style={styles.formSectionTitle}>Product Details</Text>
            
            <TextInput
              label={t('name')}
              value={deliveryForm.productName}
              onChangeText={(value) => setDeliveryForm({...deliveryForm, productName: value})}
              style={styles.input}
              mode="outlined"
            />
            
            <TextInput
              label={t('quantity')}
              value={deliveryForm.quantity}
              onChangeText={(value) => setDeliveryForm({...deliveryForm, quantity: value})}
              style={styles.input}
              mode="outlined"
              keyboardType="numeric"
            />
            
            <TextInput
              label={t('price')}
              value={deliveryForm.pricePerUnit}
              onChangeText={(value) => setDeliveryForm({...deliveryForm, pricePerUnit: value})}
              style={styles.input}
              mode="outlined"
              keyboardType="numeric"
            />
            
            <View style={styles.deliveryFeeContainer}>
              <Text style={styles.deliveryFeeLabel}>Subtotal: ₹{String((subtotal || 0).toFixed(2))}</Text>
              <Text style={styles.deliveryFeeLabel}>
                Delivery Fee ({String(deliveryForm.vehicleType || 'bike')}): ₹{String((deliveryFee || 0).toFixed(2))}
              </Text>
              {deliveryForm.paymentMethod === 'prepaid' && (
                <Text style={styles.prepaidNote}>
                  Note: For prepaid orders, payment should be made in advance
                </Text>
              )}
              <Text style={styles.totalAmount}>
                Total Amount: ₹{String((total || 0).toFixed(2))}
              </Text>
            </View>
            
            <Button
              mode="contained"
              onPress={handleBookDelivery}
              style={styles.bookButton}
              loading={loading}
              disabled={loading}
            >
              {String(loading ? 'Booking...' : 'Book Delivery')}
            </Button>
          </Card.Content>
        </Card>
      </ScrollView>
    );
  };

  return (
    <View style={[styles.safeAreaContainer, getSafeAreaStyles(insets)]}>
      <View style={styles.container}>
        {/* Header with title */}
        <View style={styles.header}>
          <Text variant="titleLarge" style={styles.headerTitle}>{t('stockSharing')}</Text>
        </View>
        
        {/* Tab buttons */}
        <View style={styles.tabsContainer}>
          {/* Prominent Delivery Button */}
          <View style={styles.deliveryButtonContainer}>
            <TouchableOpacity
              style={[
                styles.prominentDeliveryButton,
                activeTab === 'delivery' && styles.prominentDeliveryButtonActive
              ]}
              onPress={() => {
                setActiveTab('delivery');
                setShowingSharedTab(false);
              }}
            >
              <View style={styles.deliveryButtonContent}>
                <View style={styles.deliveryIconContainer}>
                <Text style={styles.storeIcon}>🏪</Text>
                <View style={styles.roadLine} />
                <Text style={styles.bikeIcon}>🚴‍♀️</Text>
                <View style={styles.roadLine} />
                <Text style={styles.homeIcon}>🏠</Text>
              </View>
                <Text style={[
                  styles.prominentDeliveryButtonText,
                  activeTab === 'delivery' && styles.prominentDeliveryButtonTextActive
                ]}>
                  {t('deliverToCustomers')}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
          
          {/* Main Segmented Buttons for Share and Nearby - Always visible */}
          <SegmentedButtons
            value={activeTab === 'delivery' || activeTab === null ? '' : activeTab}
            onValueChange={(value) => {
              setActiveTab(value as 'share' | 'nearby');
              setShowingSharedTab(false);
            }}
            buttons={[
              { value: 'share', label: t('shareStock') },
              { value: 'nearby', label: t('nearbyStock') },
            ]}
            style={styles.segmentedButtons}
          />
          
          {/* My Shared tab - only show when not in delivery mode and a tab is selected */}
          {activeTab !== 'delivery' && activeTab !== null && (
            <Button 
              mode={showingSharedTab ? "contained" : "outlined"}
              icon="package-variant"
              onPress={() => {
                setShowingSharedTab(!showingSharedTab);
                if (!showingSharedTab) {
                  fetchSharedProducts();
                }
              }}
              style={styles.sharedTab}
            >
              {t('mySharedProducts')} ({String(sharedProducts.length || '0')})
            </Button>
          )}
        </View>
        
        {/* Scrollable content area */}
        <ScrollView 
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={true}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          {activeTab === null ? (
            <View style={styles.emptyStateContainer}>
              <Text style={styles.emptyStateText}>
                {t('selectTabToViewContent')}
              </Text>
            </View>
          ) : showingSharedTab ? (
              renderSharedProducts()
            ) : activeTab === 'delivery' ? (
              renderDeliveryBooking()
            ) : activeTab === 'share' ? (
              renderShareForm()
            ) : (
              renderNearbyProducts()
            )}
          
          {/* Add extra padding at the bottom to ensure the submit button is accessible */}
          <View style={styles.bottomPadding} />
        </ScrollView>
        
        <Portal>
          <Snackbar
            visible={snackbarVisible}
            onDismiss={() => setSnackbarVisible(false)}
            duration={3000}
            style={styles.snackbar}
          >
            {snackbarMessage}
          </Snackbar>
        </Portal>
      </View>
    </View>
  );
}

// Then update the styles to use these colors
const styles = StyleSheet.create({
  safeAreaContainer: {
    flex: 1,
    backgroundColor: COLORS.secondary, // Match header color
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingBottom: 60, // Add padding for bottom navigation
  },
  header: {
    padding: 16,
    paddingBottom: 8,
    backgroundColor: COLORS.secondary,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grey,
    alignItems: 'center',
  },
  headerTitle: {
    fontWeight: 'bold',
    textAlign: 'center',
    color: COLORS.white,
  },
  tabsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGrey,
  },
  segmentedButtons: {
    marginBottom: 16,
  },
  vehicleSegmentedButtons: {
    marginBottom: 16,
  },
  paymentSegmentedButtons: {
    marginBottom: 16,
  },
  distanceText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    fontStyle: 'italic',
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 8,
    color: '#333',
  },
  prepaidNote: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 4,
  },
  formCard: {
    margin: 16,
    elevation: 2,
  },
  formSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    marginTop: 8,
    color: '#333',
  },
  deliveryFeeContainer: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginVertical: 16,
  },
  deliveryFeeLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },
  bookButton: {
    marginTop: 16,
    borderRadius: 8,
  },
  sharedTab: {
    marginTop: 8,
  },
  bottomPadding: {
    height: 50,
  },
  scrollContainer: {
    flex: 1,
    backgroundColor: COLORS.offWhite,
  },
  scrollContent: {
    padding: 16,
  },
  formContainer: {
    padding: 16,
    backgroundColor: COLORS.white,
    borderRadius: 8,
    shadowColor: COLORS.secondary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  formTitle: {
    marginBottom: 16,
    color: COLORS.secondary,
  },
  imageContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  productImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
  },
  imagePlaceholder: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    backgroundColor: COLORS.lightGrey,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.grey,
    borderStyle: 'dashed',
  },
  input: {
    marginBottom: 16,
    backgroundColor: 'transparent',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfInput: {
    width: '48%',
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
  },
  submitButton: {
    marginTop: 16,
    marginBottom: 32,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
  },
  productsContainer: {
    padding: 16,
    backgroundColor: '#fff',
  },
  sectionTitle: {
    marginBottom: 16,
    color: COLORS.secondary,
  },
  productCard: {
    marginBottom: 16,
    elevation: 2,
    backgroundColor: COLORS.white,
    borderRadius: 8,
  },
  productCardImage: {
    height: 160,
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  description: {
    marginTop: 8,
    fontStyle: 'italic',
  },
  loader: {
    marginTop: 32,
  },
  noProductsText: {
    textAlign: 'center',
    marginTop: 32,
    color: '#666',
  },
  buyButton: {
    borderRadius: 15,
    backgroundColor: COLORS.primary,
  },
  snackbar: {
    backgroundColor: COLORS.success,
    marginBottom: 16,
  },
  imageUpload: {
    alignItems: 'center',
    marginBottom: 16,
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  
  loaderText: {
    marginTop: 10,
    color: '#666',
  },
  
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  
  addButton: {
    marginTop: 20,
    borderRadius: 8,
  },
  sharedTab: {
    marginBottom: 8,
    borderRadius: 8,
    borderColor: COLORS.primary,
  },
  bottomPadding: {
    height: 100, // Extra padding at the bottom
  },
  deliveryButtonContainer: {
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  prominentDeliveryButton: {
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  prominentDeliveryButtonActive: {
    backgroundColor: '#E5E7EB',
    borderColor: '#9CA3AF',
    elevation: 3,
    shadowOpacity: 0.12,
  },
  prominentDeliveryButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    
    color: '#374151',
    textAlign: 'center',
    marginTop: 8,
  },
  prominentDeliveryButtonTextActive: {
    color: '#1F2937',
  },
  deliveryButtonContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  deliveryIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  storeIcon: {
    fontSize: 18,
  },
  bikeIcon: {
    fontSize: 18,
    transform: [{ scaleX: -1 }],
  },
  roadLine: {
    width: 16,
    height: 2,
    backgroundColor: '#6B7280',
    marginHorizontal: 3,
  },
  homeIcon: {
    fontSize: 18,
  },
  categoryScroll: {
    marginBottom: 16,
  },
  
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.lightGrey,
    marginRight: 8,
    borderWidth: 1,
    borderColor: COLORS.grey,
  },
  
  selectedCategoryChip: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  
  categoryChipText: {
    fontSize: 14,
    color: '#333',
  },
  
  selectedCategoryChipText: {
    color: 'white',
    fontWeight: '500',
  },
  buttonOnlyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  startSharingButton: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default StockSharing;

