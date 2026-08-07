import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Image, ActivityIndicator, Alert, Animated, TextInput } from 'react-native';
import { Text, Button, Card, IconButton, Divider, Portal, Snackbar, Chip } from 'react-native-paper';
import { Stack, useRouter } from 'expo-router';
import { useCartStore } from '../../../store/cart';
import { usePaymentStore } from '../../../store/payment';
import { supabase } from '../../../services/supabase/supabase';
import { useAuthStore } from '../../../store/auth';
import { useEdgeToEdge, getSafeAreaStyles } from '../../../utils/android15EdgeToEdge';
import ProductImage from '../../../components/common/ProductImage';
import * as Location from 'expo-location';
import { useLanguage } from '../../../contexts/LanguageContext';
import { translationService } from '../../../services/translationService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslateDynamic } from '../../../utils/translationUtils';

// Safe router hook with validation
const useSafeRouter = () => {
  let router;

  try {
    router = useRouter();
  } catch (error) {
    console.error('[Cart] Error initializing router:', error);
    router = null;
  }

  // Create safe router wrapper
  const safeRouter = {
    push: (path: string) => {
      if (router && typeof router.push === 'function') {
        router.push(path);
      } else {
        console.warn('[Cart] router.push not available for path:', path);
      }
    },
    replace: (path: string) => {
      if (router && typeof router.replace === 'function') {
        router.replace(path);
      } else {
        console.warn('[Cart] router.replace not available for path:', path);
      }
    },
    back: () => {
      if (router && typeof router.back === 'function') {
        router.back();
      } else {
        console.warn('[Cart] router.back not available');
      }
    },
    canGoBack: () => {
      if (router && typeof router.canGoBack === 'function') {
        return router.canGoBack();
      }
      return false;
    }
  };

  return safeRouter;
};

// Add this helper function at the top of the file, outside the component
const generateOrderNumber = () => {
  const timestamp = Date.now().toString();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `ORD${timestamp}${random}`;
};

// Helper function to check if a product has volatile pricing
const hasVolatilePricing = (productName: string): boolean => {
  if (!productName) return false;

  const volatileKeywords = ['onion', 'potato', 'garlic', 'rice', 'onions', 'potatoes', 'tomato', 'tomatoes'];
  const lowerName = productName.toLowerCase();

  return volatileKeywords.some(keyword => lowerName.includes(keyword));
};

// Nudge type definitions
type NudgeType = 'warning' | 'info' | 'success' | 'error';
type ConditionType = 'always' | 'volatile_products' | 'min_order' | 'item_count' | 'delivery_distance' | 'custom' | 'category';

interface CartNudge {
  id: string;
  nudge_id: string;
  type: NudgeType;
  title: string;
  message: string;
  icon?: string;
  priority: number;
  condition_type: ConditionType;
  condition_value?: any; // JSONB from database
  condition_description?: string;
  storage_key: string;
  display_order: number;
}

// Helper to check if product has volatile pricing (checks both database flag and category)
const checkVolatilePricing = async (
  productId: string,
  productName: string,
  hasVolatileFlag?: boolean,
  category?: string,
  subcategory?: string
): Promise<boolean> => {
  try {
    // First check if product has volatile pricing flag set
    if (hasVolatileFlag === true) {
      return true;
    }

    // If flag is not set, check the database
    const { data: product } = await supabase
      .from('products')
      .select('has_volatile_pricing, category, subcategory')
      .eq('id', productId)
      .single();

    if (product?.has_volatile_pricing === true) {
      return true;
    }

    // Check category-based volatile pricing
    const categoryToCheck = category || product?.category;
    const subcategoryToCheck = subcategory || product?.subcategory;

    if (categoryToCheck) {
      // First check for exact category + subcategory match
      if (subcategoryToCheck) {
        const { data: exactMatch } = await supabase
          .from('volatile_pricing_categories')
          .select('id')
          .eq('category', categoryToCheck)
          .eq('subcategory', subcategoryToCheck)
          .eq('is_active', true)
          .maybeSingle();

        if (exactMatch) {
          return true;
        }
      }

      // Then check for category with NULL subcategory (applies to all subcategories in that category)
      const { data: categoryMatch } = await supabase
        .from('volatile_pricing_categories')
        .select('id')
        .eq('category', categoryToCheck)
        .is('subcategory', null)
        .eq('is_active', true)
        .maybeSingle();

      if (categoryMatch) {
        return true;
      }
    }

    // Fallback to name-based check (for backward compatibility)
    return hasVolatilePricing(productName);
  } catch (error) {
    console.error('Error checking volatile pricing:', error);
    // Fallback to name-based check on error
    return hasVolatilePricing(productName);
  }
};

// Helper to evaluate nudge conditions
const evaluateNudgeCondition = async (
  nudge: CartNudge,
  items: any[],
  context: any
): Promise<boolean> => {
  switch (nudge.condition_type) {
    case 'always':
      return true;

    case 'volatile_products':
      // Check if any item has volatile pricing (using database flags and categories)
      for (const item of items) {
        const isVolatile = await checkVolatilePricing(
          item.product_id,
          item.name,
          item.has_volatile_pricing,
          item.category,
          item.subcategory
        );
        if (isVolatile) return true;
      }
      return false;

    case 'min_order':
      if (!nudge.condition_value?.min_subtotal) return false;
      return context.subtotal > 0 && context.subtotal < nudge.condition_value.min_subtotal;

    case 'item_count':
      if (!nudge.condition_value?.min_count && !nudge.condition_value?.max_count) return false;
      const count = items.reduce((sum, item) => sum + item.quantity, 0);
      if (nudge.condition_value.min_count && count < nudge.condition_value.min_count) return false;
      if (nudge.condition_value.max_count && count > nudge.condition_value.max_count) return false;
      return true;

    case 'delivery_distance':
      if (!nudge.condition_value?.max_distance) return false;
      const distance = context.deliveryDetails?.distance || 0;
      return distance > 0 && distance <= nudge.condition_value.max_distance;

    case 'category':
      if (!nudge.condition_value?.categories || !Array.isArray(nudge.condition_value.categories)) return false;
      return items.some(item => {
        const itemCategory = item.category || '';
        return nudge.condition_value.categories.includes(itemCategory);
      });

    case 'custom':
      // For custom conditions, you can add custom logic here
      // For now, return false as it requires custom implementation
      return false;

    default:
      return false;
  }
};

export default function Cart() {
  const user = useAuthStore(state => state.user);
  const { insets } = useEdgeToEdge({ statusBarStyle: 'dark' });
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const { items, removeItem, updateQuantity, loading, clearCart, calculateDeliveryFee } = useCartStore();
  const [clearingCart, setClearingCart] = useState(false);
  const [deletingItems, setDeletingItems] = useState<Set<string>>(new Set());
  const [editableQuantities, setEditableQuantities] = useState<{ [key: string]: string }>({});
  const router = useSafeRouter();
  const { defaultMethod } = usePaymentStore();
  const { currentLanguage } = useLanguage();
  const { translateArrayFields } = useTranslateDynamic();
  const [translatedItems, setTranslatedItems] = useState<any[]>([]);
  const [dismissedNudges, setDismissedNudges] = useState<Set<string>>(new Set());
  const [visibleNudges, setVisibleNudges] = useState<CartNudge[]>([]);
  const [cartNudges, setCartNudges] = useState<CartNudge[]>([]);
  const [translatedNudges, setTranslatedNudges] = useState<CartNudge[]>([]);
  const [nudgesLoading, setNudgesLoading] = useState(true);

  // Animation and Scroll State
  const scrollY = React.useRef(new Animated.Value(0)).current;
  const [contentHeight, setContentHeight] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const [scrollPosition, setScrollPosition] = useState(0);
  const isScrollable = contentHeight > containerHeight + 20; // +20 threshold

  const floatingCardOpacity = scrollY.interpolate({
    inputRange: [0, 50],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const floatingCardTranslateY = scrollY.interpolate({
    inputRange: [0, 50],
    outputRange: [0, 100],
    extrapolate: 'clamp',
  });

  // Define original texts for translation
  const originalTexts = {
    cartCleared: 'Cart cleared successfully',
    clearFailed: 'Failed to clear cart',
    locationRequired: 'Location Required',
    locationRequiredMessage: 'Please enable location access to calculate delivery fees and place orders.',
    ok: 'OK',
    orderError: 'Order Error',
    sellerLocationError: 'Unable to get seller location information',
    orderFailed: 'Failed to place order',
    orderPlacedSuccessfully: 'Order placed successfully!',
    addPaymentMethod: 'Add Payment Method',
    placeOrder: 'Place Order',
    proceedToCheckout: 'Proceed to Checkout',
    emptyTitle: 'Your cart is empty',
    emptyMessage: 'Add some products to get started',
    browseProducts: 'Browse Products',
    orderByCall: 'Order by Call',
    title: 'Cart',
    totalItems: 'Total Items',
    subtotal: 'Subtotal',
    deliveryFee: 'Delivery Fee',
    total: 'Total',
    payment: 'Payment',
    change: 'Change',
    priceWarningTitle: 'Price may vary for some products',
    priceWarningMessage: 'Some products like Onions, Potatoes, Garlic, and Rice have prices that change frequently. The seller may not update prices in real-time. You can check the final bill and pay by Cash on Delivery.',
    dismiss: 'Dismiss',
    // Add more nudge translations here as needed
    minOrderTitle: 'Minimum order value',
    minOrderMessage: 'Add more items to qualify for special offers.',
    deliveryTimeTitle: 'Estimated delivery time',
    deliveryTimeMessage: 'Your order will be delivered within the estimated time.'
  };

  // State for translations
  const [translations, setTranslations] = useState(originalTexts);

  // Load translations when language changes
  useEffect(() => {
    const loadTranslations = async () => {
      try {
        if (!currentLanguage || currentLanguage === 'en') {
          setTranslations(originalTexts);
          return;
        }

        // Translate each text individually using translateText method (like stock screen)
        const translationPromises = Object.entries(originalTexts).map(async ([key, value]) => {
          const translated = await translationService.translateText(value, currentLanguage);
          return [key, translated.translatedText];
        });

        const translatedEntries = await Promise.all(translationPromises);
        const newTranslations = Object.fromEntries(translatedEntries);
        setTranslations(newTranslations);
      } catch (error) {
        console.error('Error loading translations:', error);
        setTranslations(originalTexts); // Fallback to original texts
      }
    };

    loadTranslations();
  }, [currentLanguage]);

  // Create a synchronous translation function for UI text
  const t = (key: string) => {
    return translations[key as keyof typeof translations] || key;
  };
  // Sync editable quantities with cart items (only add new items, don't overwrite existing edits)
  useEffect(() => {
    setEditableQuantities(prev => {
      const updated: { [key: string]: string } = { ...prev };
      items.forEach(item => {
        // Only initialize if not already set (allows user to edit without interference)
        if (!(item.uniqueId in updated)) {
          updated[item.uniqueId] = item.quantity.toString();
        } else {
          // If item quantity changed externally (e.g., from +/- buttons), update the editable value
          // Only update if the editable value doesn't match the actual quantity (user might be editing)
          const currentEditable = parseInt(updated[item.uniqueId] || '0', 10);
          if (currentEditable === item.quantity) {
            // Values match, keep editable value as-is
          } else if (!isNaN(currentEditable) && currentEditable !== item.quantity) {
            // Editable value exists and doesn't match - this means user edited it, keep it
            // But if the actual quantity changed from +/- buttons, we need to sync
            // We'll let onBlur handle the sync to avoid interrupting user input
          }
        }
      });
      // Remove quantities for items that no longer exist in cart
      Object.keys(updated).forEach(key => {
        if (!items.find(item => item.uniqueId === key)) {
          delete updated[key];
        }
      });
      return updated;
    });
  }, [items]);

  const handleQuantityInputChange = (itemId: string, text: string) => {
    // Allow empty string for editing, but validate on blur
    if (text === '' || /^\d+$/.test(text)) {
      setEditableQuantities(prev => ({
        ...prev,
        [itemId]: text
      }));
    }
  };

  const handleQuantityBlur = async (itemId: string, item: typeof items[0]) => {
    const textValue = editableQuantities[itemId] || item.quantity.toString();
    const numValue = parseInt(textValue, 10);
    const minQuantity = item.min_quantity || 1;

    if (textValue === '' || isNaN(numValue) || numValue < minQuantity) {
      // Reset to current quantity or min_quantity
      const finalQuantity = Math.max(minQuantity, item.quantity);
      setEditableQuantities(prev => ({
        ...prev,
        [itemId]: finalQuantity.toString()
      }));
      // If value is less than min_quantity, update to min_quantity
      if (!isNaN(numValue) && numValue < minQuantity) {
        await updateQuantity(itemId, minQuantity);
        // Sync editableQuantities after update
        setEditableQuantities(prev => ({
          ...prev,
          [itemId]: minQuantity.toString()
        }));
      } else if (textValue === '' || isNaN(numValue)) {
        // Empty or invalid input - reset to current quantity
        setEditableQuantities(prev => ({
          ...prev,
          [itemId]: item.quantity.toString()
        }));
      }
    } else {
      // Update quantity if it changed
      if (numValue !== item.quantity) {
        await updateQuantity(itemId, numValue);
      }
      // Ensure display matches the validated quantity
      setEditableQuantities(prev => ({
        ...prev,
        [itemId]: numValue.toString()
      }));
    }
  };

  const [locationLoading, setLocationLoading] = useState(true);
  const [locationError, setLocationError] = useState('');
  const [deliveryDetails, setDeliveryDetails] = useState({
    fee: 0,
    vehicleType: '2 wheeler',
    distance: 0
  });

  // Store locations for delivery calculation
  const [userLocation, setUserLocation] = useState({
    latitude: 0,
    longitude: 0
  });

  // Add this state to track if we have all needed locations
  const [locationsReady, setLocationsReady] = useState(false);

  useEffect(() => {
    useCartStore.getState().loadCart();
    loadUserLocation();
    loadDismissedNudges();
    loadCartNudges();
  }, []);

  // Helper to normalize invalid icon names to valid Material Community Icons
  const normalizeIconName = (icon: string | null | undefined, type: NudgeType): string | undefined => {
    if (!icon) return undefined;

    // Map invalid icon names to valid ones
    const iconMap: Record<string, string> = {
      'alert-circle-outline': 'alert-circle',
      'information-circle-outline': 'information',
      'cash-outline': 'cash',
      'checkmark-circle-outline': 'check-circle',
      'close-circle-outline': 'close-circle',
    };

    // Check if icon needs normalization
    if (iconMap[icon]) {
      return iconMap[icon];
    }

    // Return the icon as-is if it's valid, otherwise return undefined to use default
    return icon;
  };

  // Load cart nudges from database
  const loadCartNudges = async () => {
    try {
      setNudgesLoading(true);
      const { data, error } = await supabase
        .from('cart_nudges')
        .select('*')
        .eq('is_active', true)
        .order('priority', { ascending: false })
        .order('display_order', { ascending: true });

      if (error) throw error;

      if (data) {
        // Map database data to CartNudge interface and normalize invalid icons
        const mappedNudges: CartNudge[] = data.map(nudge => {
          const nudgeType = nudge.type as NudgeType;
          const normalizedIcon = normalizeIconName(nudge.icon, nudgeType);

          return {
            id: nudge.id,
            nudge_id: nudge.nudge_id,
            type: nudgeType,
            title: nudge.title,
            message: nudge.message,
            icon: normalizedIcon,
            priority: nudge.priority,
            condition_type: nudge.condition_type as ConditionType,
            condition_value: nudge.condition_value || undefined,
            condition_description: nudge.condition_description || undefined,
            storage_key: nudge.storage_key,
            display_order: nudge.display_order
          };
        });

        setCartNudges(mappedNudges);
        // Translate nudges when language changes
        translateCartNudges(mappedNudges);
      }
    } catch (error) {
      console.error('Error loading cart nudges:', error);
      setCartNudges([]); // Fallback to empty array
    } finally {
      setNudgesLoading(false);
    }
  };

  // Translate cart nudges based on current language
  const translateCartNudges = async (nudges: CartNudge[]) => {
    if (currentLanguage === 'en' || nudges.length === 0) {
      setTranslatedNudges(nudges);
      return;
    }

    try {
      const translatedNudges = await Promise.all(
        nudges.map(async (nudge) => {
          const [translatedTitle, translatedMessage] = await Promise.all([
            translationService.translateText(nudge.title, currentLanguage),
            translationService.translateText(nudge.message, currentLanguage)
          ]);

          return {
            ...nudge,
            title: translatedTitle.translatedText || nudge.title,
            message: translatedMessage.translatedText || nudge.message
          };
        })
      );

      setTranslatedNudges(translatedNudges);
    } catch (error) {
      console.error('Error translating cart nudges:', error);
      // Keep original nudges on error
      setTranslatedNudges(nudges);
    }
  };

  // Re-translate nudges when language changes
  useEffect(() => {
    if (cartNudges.length > 0) {
      translateCartNudges(cartNudges);
    } else {
      setTranslatedNudges([]);
    }
  }, [currentLanguage, cartNudges.length]);

  // Translate cart items when language or items change
  useEffect(() => {
    const translateItems = async () => {
      if (items.length === 0) {
        setTranslatedItems([]);
        return;
      }

      if (currentLanguage === 'en') {
        setTranslatedItems(items);
        return;
      }

      try {
        // Note: Product names (item.name) should NOT be translated - they are brand names/proper nouns
        // Note: Unit should NOT be translated - it's a measurement unit (kg, liter, etc.)
        // Only translate seller_name field
        const translated = await translateArrayFields(items, ['seller_name'], currentLanguage);
        setTranslatedItems(translated);
      } catch (error) {
        console.error('Error translating cart items:', error);
        setTranslatedItems(items); // Fallback to original items
      }
    };

    translateItems();
  }, [items, currentLanguage, translateArrayFields]);

  const calculateSubtotal = () => {
    return items.reduce((total, item) => {
      return total + (Number(item.price) * item.quantity);
    }, 0);
  };

  // Check which nudges should be shown
  useEffect(() => {
    if (items.length === 0 || nudgesLoading || cartNudges.length === 0) {
      setVisibleNudges([]);
      return;
    }

    const context = {
      subtotal: calculateSubtotal(),
      itemCount: items.length,
      deliveryFee: deliveryDetails.fee,
      userLocation,
      deliveryDetails
    };

    // Evaluate conditions for each nudge asynchronously
    const evaluateNudges = async () => {
      const activeNudges: CartNudge[] = [];

      // Use translated nudges if available, otherwise use original cartNudges
      const nudgesToEvaluate = translatedNudges.length > 0 &&
        translatedNudges.length === cartNudges.length ? translatedNudges : cartNudges;

      for (const nudge of nudgesToEvaluate) {
        // Don't show if dismissed
        if (dismissedNudges.has(nudge.nudge_id)) continue;

        // Evaluate condition
        const shouldShow = await evaluateNudgeCondition(nudge, items, context);
        if (shouldShow) {
          activeNudges.push(nudge);
        }
      }

      // Sort by priority (higher first), then by display_order
      activeNudges.sort((a, b) => {
        if (b.priority !== a.priority) {
          return b.priority - a.priority;
        }
        return a.display_order - b.display_order;
      });

      setVisibleNudges(activeNudges);
    };

    evaluateNudges();
  }, [items, dismissedNudges, deliveryDetails, userLocation, cartNudges, translatedNudges, nudgesLoading]);

  // Default expiration time: 7 days (can be customized per nudge in database)
  const NUDGE_EXPIRATION_DAYS = 7;
  const NUDGE_EXPIRATION_MS = NUDGE_EXPIRATION_DAYS * 24 * 60 * 60 * 1000;

  // Load all dismissed nudges from AsyncStorage
  const loadDismissedNudges = async () => {
    try {
      const dismissed = new Set<string>();

      // Load dismissed nudges from database cart_nudges table
      const { data: nudges } = await supabase
        .from('cart_nudges')
        .select('nudge_id, storage_key')
        .eq('is_active', true);

      if (nudges) {
        const now = Date.now();
        for (const nudge of nudges) {
          const value = await AsyncStorage.getItem(nudge.storage_key);

          if (value) {
            try {
              // Try to parse as JSON (new format with timestamp)
              const dismissalData = JSON.parse(value);
              if (dismissalData.dismissed) {
                const dismissedAt = dismissalData.dismissedAt || 0;
                const elapsed = now - dismissedAt;

                // Only consider dismissed if within expiration period
                if (elapsed < NUDGE_EXPIRATION_MS) {
                  dismissed.add(nudge.nudge_id);
                } else {
                  // Expired dismissal - remove it from storage
                  await AsyncStorage.removeItem(nudge.storage_key);
                }
              }
            } catch (parseError) {
              // Legacy format: just 'true' string - treat as dismissed without expiration
              // For backward compatibility, we'll keep old dismissals but allow them to be manually reset
              if (value === 'true') {
                dismissed.add(nudge.nudge_id);
              }
            }
          }
        }
      }

      setDismissedNudges(dismissed);
    } catch (error) {
      console.error('Error loading dismissed nudges:', error);
    }
  };

  // Handle dismissing a specific nudge
  const handleDismissNudge = async (nudgeId: string, storageKey: string) => {
    try {
      // Store dismissal with timestamp
      const dismissalData = {
        dismissed: true,
        dismissedAt: Date.now()
      };

      await AsyncStorage.setItem(storageKey, JSON.stringify(dismissalData));
      setDismissedNudges(prev => new Set(prev).add(nudgeId));
      setVisibleNudges(prev => prev.filter(n => n.nudge_id !== nudgeId));
    } catch (error) {
      console.error('Error saving nudge dismissal:', error);
      // Still update state even if storage fails
      setDismissedNudges(prev => new Set(prev).add(nudgeId));
      setVisibleNudges(prev => prev.filter(n => n.nudge_id !== nudgeId));
    }
  };

  // Simplified approach to location loading and delivery calculation
  useEffect(() => {
    if (items.length > 0) {
      // Load user location only
      loadUserLocation().then(() => {
        setLocationLoading(false);
      }).catch(error => {
        console.error('Error loading user location:', error);
        setLocationLoading(false);
      });
    } else {
      setLocationLoading(false);
    }
  }, [items]);

  // Effect to calculate delivery fee when locations and loading state change
  useEffect(() => {
    if (!locationLoading &&
      userLocation?.latitude &&
      userLocation?.longitude) {
      calculateDeliveryFeeForCart();
    }
  }, [locationLoading, userLocation, items]);

  // Simplified user location fetching - focus on profile table only
  const loadUserLocation = async () => {
    try {
      const user = useAuthStore.getState().user;
      if (!user?.id) return;

      // Get retailer's location directly from profiles table
      const { data, error } = await supabase
        .from('profiles')
        .select('latitude, longitude')
        .eq('id', user.id)
        .single();

      if (!error && data && data.latitude && data.longitude) {
        console.log('Got retailer location from profile:', data);
        setUserLocation({
          latitude: Number(data.latitude),
          longitude: Number(data.longitude)
        });
        return true;
      } else {
        console.error('No retailer location in profile:', error || 'Missing data');
        // Don't auto-update location - retailer should set shop location during KYC
        // If location is missing, show error to user
        return false;
      }
      return false;
    } catch (error) {
      console.error('Error loading user location:', error);
      return false;
    }
  };



  // Batch delivery fee calculation for cart display
  const calculateDeliveryFeeForCart = async () => {
    try {
      if (!userLocation?.latitude || !userLocation?.longitude) {
        console.error('Missing user coordinates for delivery calculation');
        setDeliveryDetails({
          fee: 0,
          vehicleType: '2 wheeler',
          distance: 0
        });
        return 0;
      }

      // Group items by seller
      const itemsBySeller = items.reduce((acc, item) => {
        if (!acc[item.seller_id]) {
          acc[item.seller_id] = [];
        }
        acc[item.seller_id].push(item);
        return acc;
      }, {} as Record<string, typeof items>);

      const sellerIds = Object.keys(itemsBySeller);

      // If only one seller, use simple calculation
      if (sellerIds.length === 1) {
        const sellerId = sellerIds[0];

        // Fetch seller location dynamically
        const { data: sellerData, error: sellerError } = await supabase
          .from('seller_details')
          .select('latitude, longitude')
          .eq('user_id', sellerId)
          .single();

        if (sellerError || !sellerData?.latitude || !sellerData?.longitude) {
          console.error('Missing store coordinates for delivery calculation:', sellerError);
          setDeliveryDetails({
            fee: 0,
            vehicleType: '2 wheeler',
            distance: 0
          });
          return 0;
        }

        const sellerLocation = {
          latitude: Number(sellerData.latitude),
          longitude: Number(sellerData.longitude)
        };

        const subtotal = calculateSubtotal();
        const itemCount = items.reduce((count, item) => count + item.quantity, 0);

        const details = calculateDeliveryFee(
          subtotal,
          itemCount,
          Number(userLocation.latitude),
          Number(userLocation.longitude),
          sellerLocation.latitude,
          sellerLocation.longitude
        );

        setDeliveryDetails(details);
        return details.fee;
      }

      // For multiple sellers, calculate batch delivery fee
      const sellerDistances: Record<string, { distance: number; location: { latitude: number; longitude: number } }> = {};

      // Get all seller locations and calculate distances
      for (const sellerId of sellerIds) {
        const { data: sellerData, error: sellerError } = await supabase
          .from('seller_details')
          .select('latitude, longitude')
          .eq('user_id', sellerId)
          .single();

        if (sellerError || !sellerData?.latitude || !sellerData?.longitude) {
          console.error('Missing seller location for:', sellerId);
          continue;
        }

        const sellerLocation = {
          latitude: Number(sellerData.latitude),
          longitude: Number(sellerData.longitude)
        };

        // Calculate distance to this seller
        const distance = calculateDistance(
          Number(userLocation.latitude),
          Number(userLocation.longitude),
          sellerLocation.latitude,
          sellerLocation.longitude
        );

        sellerDistances[sellerId] = {
          distance,
          location: sellerLocation
        };
      }

      // Find the farthest seller
      const farthestSeller = Object.entries(sellerDistances).reduce((farthest, [sellerId, data]) =>
        data.distance > farthest.distance ? { sellerId, distance: data.distance, location: data.location } : farthest,
        { sellerId: '', distance: 0, location: { latitude: 0, longitude: 0 } }
      );

      if (!farthestSeller.sellerId) {
        setDeliveryDetails({
          fee: 0,
          vehicleType: '2 wheeler',
          distance: 0
        });
        return 0;
      }

      // Calculate delivery fee based on farthest seller and total order value
      const totalSubtotal = calculateSubtotal();
      const totalItemCount = items.reduce((count, item) => count + item.quantity, 0);

      const batchDeliveryDetails = calculateDeliveryFee(
        totalSubtotal,
        totalItemCount,
        Number(userLocation.latitude),
        Number(userLocation.longitude),
        farthestSeller.location.latitude,
        farthestSeller.location.longitude
      );

      setDeliveryDetails(batchDeliveryDetails);
      return batchDeliveryDetails.fee;

    } catch (error) {
      console.error('Error in delivery calculation wrapper:', error);
      setDeliveryDetails({
        fee: 0,
        vehicleType: '2 wheeler',
        distance: 0
      });
      return 0;
    }
  };

  // Helper function to calculate distance
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
  };

  const deg2rad = (deg: number): number => {
    return deg * (Math.PI / 180);
  };

  // Helper to get styles based on nudge type
  const getNudgeStyles = (type: NudgeType) => {
    switch (type) {
      case 'warning':
        return {
          cardStyle: { backgroundColor: '#FFF3E0', borderLeftColor: '#FF9800' },
          iconColor: '#FF9800',
          titleStyle: { color: '#E65100' }
        };
      case 'error':
        return {
          cardStyle: { backgroundColor: '#FFEBEE', borderLeftColor: '#F44336' },
          iconColor: '#F44336',
          titleStyle: { color: '#C62828' }
        };
      case 'success':
        return {
          cardStyle: { backgroundColor: '#E8F5E9', borderLeftColor: '#4CAF50' },
          iconColor: '#4CAF50',
          titleStyle: { color: '#2E7D32' }
        };
      default: // info
        return {
          cardStyle: { backgroundColor: '#E3F2FD', borderLeftColor: '#2196F3' },
          iconColor: '#2196F3',
          titleStyle: { color: '#1565C0' }
        };
    }
  };

  // Helper to get default icon based on nudge type (using valid Material Community Icons)
  const getDefaultIcon = (type: NudgeType): string => {
    switch (type) {
      case 'warning':
        return 'alert-circle';
      case 'error':
        return 'close-circle';
      case 'success':
        return 'check-circle';
      default:
        return 'information';
    }
  };

  const calculateItemTotal = (price: string, quantity: number) => {
    return Number(price) * quantity;
  };

  // Calculate total including delivery fee
  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    return subtotal + deliveryDetails.fee;
  };

  // Handle clearing the cart with confirmation
  const handleClearCart = async () => {
    try {
      setClearingCart(true);
      await clearCart();
      setSnackbarMessage(t('cartCleared'));
      setSnackbarVisible(true);
    } catch (error) {
      console.error('Error clearing cart:', error);
      setSnackbarMessage(t('clearFailed'));
      setSnackbarVisible(true);
    } finally {
      setClearingCart(false);
    }
  };

  const placeOrder = async () => {
    try {
      if (!user?.id) return;

      // Basic validation
      if (!userLocation?.latitude || !userLocation?.longitude) {
        Alert.alert(
          t('locationRequired'),
          t('locationRequiredMessage'),
          [{ text: t('ok') }]
        );
        return;
      }

      // Group items by seller
      const itemsBySeller = items.reduce((acc, item) => {
        if (!acc[item.seller_id]) {
          acc[item.seller_id] = [];
        }
        acc[item.seller_id].push(item);
        return acc;
      }, {} as Record<string, typeof items>);

      // Prepare delivery address
      const deliveryAddress = {
        street: user.business_details?.address || '',
        city: user.business_details?.city || '',
        state: user.business_details?.state || '',
        postal_code: user.business_details?.postal_code || '',
        address: user.business_details?.address || '',
        pincode: user.business_details?.postal_code || '',
        country: 'India',
        latitude: Number(userLocation.latitude),
        longitude: Number(userLocation.longitude)
      };

      // Calculate total amounts
      let totalAmount = 0;
      let totalDeliveryFee = 0;
      const ordersBySeller: Record<string, any> = {};
      const sellerDistances: Record<string, { distance: number; location: { latitude: number; longitude: number } }> = {};

      // First pass: Get all seller locations and calculate distances
      for (const [seller_id, sellerItems] of Object.entries(itemsBySeller)) {
        console.log('Processing order for seller:', seller_id);

        // Get seller location directly
        const { data: sellerData, error: sellerError } = await supabase
          .from('seller_details')
          .select('latitude, longitude')
          .eq('user_id', seller_id)
          .single();

        if (sellerError || !sellerData?.latitude || !sellerData?.longitude) {
          Alert.alert(
            t('orderError'),
            t('sellerLocationError'),
            [{ text: t('ok') }]
          );
          return;
        }

        // Create coordinates with explicit number conversion
        const sellerLocation = {
          latitude: Number(sellerData.latitude),
          longitude: Number(sellerData.longitude)
        };

        // Calculate distance to this seller
        const distance = calculateDistance(
          Number(userLocation.latitude),
          Number(userLocation.longitude),
          sellerLocation.latitude,
          sellerLocation.longitude
        );

        sellerDistances[seller_id] = {
          distance,
          location: sellerLocation
        };

        const subtotal = sellerItems.reduce((total, item) =>
          total + (Number(item.price) * item.quantity), 0);

        totalAmount += subtotal;
      }

      // Find the farthest seller for batch delivery fee calculation
      const farthestSeller = Object.entries(sellerDistances).reduce((farthest, [sellerId, data]) =>
        data.distance > farthest.distance ? { sellerId, distance: data.distance } : farthest,
        { sellerId: '', distance: 0 }
      );

      // Calculate combined order details for delivery fee
      const totalItemCount = items.reduce((count, item) => count + item.quantity, 0);

      // Calculate delivery fee based on farthest seller and combined order value
      const batchDeliveryDetails = calculateDeliveryFee(
        totalAmount,
        totalItemCount,
        Number(userLocation.latitude),
        Number(userLocation.longitude),
        sellerDistances[farthestSeller.sellerId].location.latitude,
        sellerDistances[farthestSeller.sellerId].location.longitude
      );

      totalDeliveryFee = batchDeliveryDetails.fee;

      // Second pass: Create orders with proper delivery fee distribution
      for (const [seller_id, sellerItems] of Object.entries(itemsBySeller)) {
        const subtotal = sellerItems.reduce((total, item) =>
          total + (Number(item.price) * item.quantity), 0);

        // Only the farthest seller gets the delivery fee, others get 0
        const deliveryFeeForThisSeller = seller_id === farthestSeller.sellerId ? totalDeliveryFee : 0;

        ordersBySeller[seller_id] = {
          user_id: user.id,
          seller_id: seller_id,
          items: sellerItems.map(item => ({
            product_id: item.product_id,
            quantity: item.quantity,
            price: item.price,
            name: item.name,
            unit: item.unit
          })),
          total_amount: subtotal,
          delivery_fee: deliveryFeeForThisSeller, // Explicitly set delivery fee
          status: 'pending',
          payment_method: defaultMethod?.type || 'cod',
          delivery_address: user.business_details?.shopName
            ? `${user.business_details.shopName}, ${user.business_details?.address || ''}`
            : user.business_details?.address || '',
          order_number: generateOrderNumber(),
        };
      }

      // Helper function to calculate distance
      function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371; // Radius of the earth in km
        const dLat = deg2rad(lat2 - lat1);
        const dLon = deg2rad(lon2 - lon1);
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c; // Distance in km
      }

      function deg2rad(deg: number): number {
        return deg * (Math.PI / 180);
      }

      // Use MasterOrderService to place the complete order
      const { MasterOrderService } = await import('../../../services/masterOrderService');

      const result = await MasterOrderService.placeCompleteOrder(
        user.id,
        ordersBySeller,
        deliveryAddress,
        totalAmount, // Pass only the subtotal without delivery fee
        totalDeliveryFee,
        defaultMethod?.type || 'cod',
        undefined // delivery instructions
      );

      if (!result.success) {
        console.error('Error placing master order:', result.error);
        setSnackbarMessage(result.error || t('orderFailed'));
        setSnackbarVisible(true);
        return;
      }

      // Clear cart immediately after successful order placement
      await clearCart();

      // Show success message and navigate
      setSnackbarMessage(t('orderPlacedSuccessfully'));
      setSnackbarVisible(true);

      // Navigate after a short delay to show success message
      setTimeout(() => {
        router.replace('/(main)/orders');
      }, 2000);

    } catch (error) {
      console.error('Error placing order:', error);
      setSnackbarMessage(t('orderFailed'));
      setSnackbarVisible(true);
    }
  };

  const handleCheckout = () => {
    if (!defaultMethod) {
      router.push(`/(main)/payment/methods?amount=${calculateTotal()}`);
    } else if (defaultMethod.type === 'cod') {
      placeOrder();
    } else {
      // Pass delivery fee and total to checkout
      const subtotal = calculateSubtotal();
      const deliveryFee = deliveryDetails.fee;
      router.push({
        pathname: '/(main)/checkout',
        params: {
          subtotal: subtotal.toString(),
          deliveryFee: deliveryFee.toString(),
          total: calculateTotal().toString(),
        }
      });
    }
  };

  const getButtonLabel = () => {
    if (!defaultMethod) {
      return t('addPaymentMethod');
    }
    if (defaultMethod.type === 'cod') {
      return t('placeOrder');
    }
    return t('proceedToCheckout');
  };

  if (loading) {
    return (
      <View style={[styles.container, getSafeAreaStyles(insets)]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={[styles.container, styles.centerContent, getSafeAreaStyles(insets)]}>
        <Text variant="headlineMedium">{t('emptyTitle')}</Text>
        <Text variant="bodyMedium" style={styles.emptyText}>
          {t('emptyMessage')}
        </Text>
        <View style={styles.emptyCartActions}>
          <Button
            mode="contained"
            onPress={() => router.push('/(main)/screens/categories')}
            style={styles.browseButton}
          >
            {t('browseProducts')}
          </Button>
          <Button
            mode="outlined"
            icon="phone"
            onPress={() => router.push('/(main)/phone-order')}
            style={styles.callButton}
          >
            {t('orderByCall')}
          </Button>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, getSafeAreaStyles(insets)]}>
      <View style={styles.header}>
        <IconButton
          icon="arrow-left"
          onPress={() => router.back()}
        />
        <View style={styles.headerTitleContainer}>
          <Text variant="titleLarge" style={styles.headerTitleText}>{t('title')}</Text>
          {items.length > 0 && (
            <View style={styles.itemCountBadge}>
              <Text style={styles.itemCountText}>{items.length}</Text>
            </View>
          )}
        </View>
        {items.length > 0 && (
          <IconButton
            icon="trash-can-outline"
            size={24}
            onPress={handleClearCart}
            disabled={clearingCart}
            style={styles.headerRight}
          />
        )}
      </View>

      <View style={styles.mainContent}>
        <Animated.ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={true}
          overScrollMode="always"
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { 
              useNativeDriver: true,
              listener: (event: any) => {
                const offsetY = event.nativeEvent.contentOffset.y;
                setScrollPosition(offsetY);
              }
            }
          )}
          scrollEventThrottle={16}
          onContentSizeChange={(w, h) => setContentHeight(h)}
          onLayout={(e) => setContainerHeight(e.nativeEvent.layout.height)}
        >
          {/* Cart Nudges/Warnings */}
          {visibleNudges.map((nudge) => {
            const nudgeStyles = getNudgeStyles(nudge.type);
            // Use default icon if nudge.icon is invalid or not provided
            const iconToUse = nudge.icon || getDefaultIcon(nudge.type);
            return (
              <Card key={nudge.id} style={[styles.nudgeCard, nudgeStyles.cardStyle]}>
                <Card.Content style={styles.nudgeContent}>
                  <View style={styles.nudgeHeader}>
                    <IconButton
                      icon={iconToUse}
                      iconColor={nudgeStyles.iconColor}
                      size={24}
                      style={styles.nudgeIcon}
                    />
                    <View style={styles.nudgeTextContainer}>
                      <Text variant="titleSmall" style={[styles.nudgeTitle, nudgeStyles.titleStyle]}>
                        {nudge.title}
                      </Text>
                      <Text variant="bodySmall" style={styles.nudgeMessage}>
                        {nudge.message}
                      </Text>
                    </View>
                    <IconButton
                      icon="close"
                      size={20}
                      iconColor="#666"
                      onPress={() => handleDismissNudge(nudge.nudge_id, nudge.storage_key)}
                      style={styles.dismissButton}
                    />
                  </View>
                </Card.Content>
              </Card>
            );
          })}

          {(translatedItems.length > 0 ? translatedItems : items).map((item, index) => {
            const originalItem = items.find(i => i.uniqueId === item.uniqueId) || item;
            return (
            <View key={`${item.uniqueId}-${index}`} style={styles.cartItemCard}>
              <View style={styles.cartItemRow}>
                <ProductImage
                  imageUrl={originalItem.image_url}
                  style={styles.cartItemImage}
                  resizeMode="cover"
                />
                <View style={styles.cartItemDetails}>
                  <View style={styles.cartItemHeader}>
                    <Text variant="bodyLarge" numberOfLines={1} style={styles.itemName}>{originalItem?.name || 'Product'}</Text>
                    {deletingItems.has(originalItem.uniqueId!) ? (
                      <ActivityIndicator size="small" color="#FF5252" style={{ marginRight: 8 }} />
                    ) : (
                      <IconButton
                        icon="delete-outline"
                        size={24}
                        iconColor="#FF5252"
                        style={styles.deleteButton}
                        onPress={async () => {
                          setDeletingItems(prev => new Set(prev).add(originalItem.uniqueId!));
                          // Small delay to allow UI to update
                          setTimeout(() => {
                            removeItem(originalItem.uniqueId!);
                            setDeletingItems(prev => {
                              const next = new Set(prev);
                              next.delete(originalItem.uniqueId!);
                              return next;
                            });
                          }, 50);
                        }}
                      />
                    )}
                  </View>

                  <View style={styles.itemMetaRow}>
                    <Text variant="bodySmall" style={styles.itemUnit}>₹{Number(originalItem.price).toFixed(2)} / {originalItem.unit}</Text>
                    {(item.seller_name || originalItem.seller_name) && (
                      <Text variant="bodySmall" style={styles.sellerName} numberOfLines={1}>
                        • {item.seller_name || originalItem.seller_name}
                      </Text>
                    )}
                  </View>

                  <View style={styles.cartItemFooter}>
                    <Text variant="titleMedium" style={styles.itemTotal}>
                      ₹{calculateItemTotal(originalItem.price, 
                        editableQuantities[originalItem.uniqueId!] 
                          ? (parseInt(editableQuantities[originalItem.uniqueId!], 10) || originalItem.quantity)
                          : originalItem.quantity
                      ).toFixed(2)}
                    </Text>

                    <View style={styles.quantityContainer}>
                      <IconButton
                        icon="minus"
                        size={16}
                        iconColor="#1A1A1A"
                        style={styles.quantityButton}
                        disabled={originalItem.quantity <= (originalItem.min_quantity || 1)}
                        onPress={() => {
                          const minQuantity = originalItem.min_quantity || 1;
                          if (originalItem.quantity > minQuantity) {
                            updateQuantity(originalItem.uniqueId!, originalItem.quantity - 1);
                            // Update editable quantity to match
                            setEditableQuantities(prev => ({
                              ...prev,
                              [originalItem.uniqueId!]: (originalItem.quantity - 1).toString()
                            }));
                          } else if (originalItem.quantity === minQuantity) {
                            // If quantity equals min_quantity, remove item instead of decreasing
                            removeItem(originalItem.uniqueId!);
                          }
                        }}
                      />
                      <TextInput
                        style={styles.quantityInput}
                        value={editableQuantities[originalItem.uniqueId] ?? originalItem.quantity.toString()}
                        onChangeText={(text) => handleQuantityInputChange(originalItem.uniqueId!, text)}
                        onBlur={() => handleQuantityBlur(originalItem.uniqueId!, originalItem)}
                        keyboardType="number-pad"
                        selectTextOnFocus
                        textAlign="center"
                      />
                      <IconButton
                        icon="plus"
                        size={16}
                        iconColor="#fff"
                        containerColor="#1A1A1A"
                        style={styles.quantityButtonActive}
                        onPress={() => {
                          updateQuantity(originalItem.uniqueId!, originalItem.quantity + 1);
                          // Update editable quantity to match
                          setEditableQuantities(prev => ({
                            ...prev,
                            [originalItem.uniqueId!]: (originalItem.quantity + 1).toString()
                          }));
                        }}
                      />
                    </View>
                  </View>
                </View>
              </View>
            </View>
            );
          })}



          {/* Show inline summary card always (floating card fades away on scroll) */}
          <Card style={styles.summaryCard}>
            <Card.Content style={styles.summaryContent}>
              <View style={styles.compactSummarySection}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>{t('subtotal')}</Text>
                  <Text style={styles.summaryValue}>₹{calculateSubtotal().toFixed(2)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <View style={styles.deliveryFeeContainer}>
                    <Text style={styles.summaryLabel}>{t('deliveryFee')}</Text>
                    {locationLoading ? (
                      <ActivityIndicator size="small" />
                    ) : (
                      <Text style={styles.summaryValue}>₹{deliveryDetails.fee.toFixed(2)}</Text>
                    )}
                  </View>
                </View>

                <View style={styles.deliveryDetailsContainer}>
                  <Chip
                    icon="map-marker-distance"
                    style={styles.deliveryChip}
                    textStyle={styles.chipText}
                    compact={true}
                    mode="outlined"
                  >
                    {(() => {
                      const distanceValue = typeof deliveryDetails.distance === 'number'
                        ? deliveryDetails.distance
                        : typeof deliveryDetails.distance === 'string'
                          ? parseFloat(deliveryDetails.distance)
                          : typeof deliveryDetails.distance === 'object' && deliveryDetails.distance !== null
                            ? ((deliveryDetails.distance as any).distance || (deliveryDetails.distance as any).value || 0)
                            : 0;
                      return (distanceValue || 0).toFixed(1);
                    })()} km
                  </Chip>
                  <Chip
                    icon="truck-delivery"
                    style={styles.deliveryChip}
                    textStyle={styles.chipText}
                    compact={true}
                    mode="outlined"
                  >
                    {deliveryDetails.vehicleType}
                  </Chip>
                </View>
              </View>

              <Divider style={styles.compactDivider} />

              <View style={styles.totalRow}>
                <Text variant="titleMedium" style={styles.totalLabel}>{t('total')}</Text>
                <Text variant="titleMedium" style={styles.totalValue}>₹{calculateTotal().toFixed(2)}</Text>
              </View>

              {defaultMethod && (
                <View style={styles.paymentMethod}>
                  <Text variant="bodySmall" style={styles.paymentLabel}>{t('payment')}: {defaultMethod?.title || 'Payment Method'}</Text>
                  <Button
                    mode="text"
                    onPress={() => router.push('/(main)/payment/methods')}
                    style={styles.changeButton}
                    labelStyle={styles.changeButtonLabel}
                    compact
                  >
                    {t('change')}
                  </Button>
                </View>
              )}

              <Button
                mode="contained"
                onPress={handleCheckout}
                style={styles.checkoutButton}
                labelStyle={styles.checkoutButtonLabel}
                contentStyle={styles.checkoutButtonContent}
                disabled={items.length === 0 || locationLoading}
              >
                {getButtonLabel()}
              </Button>
            </Card.Content>
          </Card>

          <View style={styles.bottomPadding} />
        </Animated.ScrollView>
      </View>

      {/* Show floating card only when more than 4 items and scrollable */}
      {isScrollable && items.length > 4 && (
        <View 
          style={styles.floatingSummaryCard} 
          pointerEvents={scrollPosition > 50 ? "none" : "auto"}
        >
          <Animated.View
            style={{
              opacity: floatingCardOpacity,
              transform: [{ translateY: floatingCardTranslateY }],
            }}
            pointerEvents={scrollPosition > 50 ? "none" : "auto"}
          >
            <Card style={styles.summaryCard}>
            <Card.Content style={styles.summaryContent}>
            <View style={styles.compactSummarySection}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t('subtotal')}</Text>
                <Text style={styles.summaryValue}>₹{calculateSubtotal().toFixed(2)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <View style={styles.deliveryFeeContainer}>
                  <Text style={styles.summaryLabel}>{t('deliveryFee')}</Text>
                  {locationLoading ? (
                    <ActivityIndicator size="small" />
                  ) : (
                    <Text style={styles.summaryValue}>₹{deliveryDetails.fee.toFixed(2)}</Text>
                  )}
                </View>
              </View>

              <View style={styles.deliveryDetailsContainer}>
                <Chip
                  icon="map-marker-distance"
                  style={styles.deliveryChip}
                  textStyle={styles.chipText}
                  compact={true}
                  mode="outlined"
                >
                  {(() => {
                    const distanceValue = typeof deliveryDetails.distance === 'number'
                      ? deliveryDetails.distance
                      : typeof deliveryDetails.distance === 'string'
                        ? parseFloat(deliveryDetails.distance)
                        : typeof deliveryDetails.distance === 'object' && deliveryDetails.distance !== null
                          ? ((deliveryDetails.distance as any).distance || (deliveryDetails.distance as any).value || 0)
                          : 0;
                    return (distanceValue || 0).toFixed(1);
                  })()} km
                </Chip>
                <Chip
                  icon="truck-delivery"
                  style={styles.deliveryChip}
                  textStyle={styles.chipText}
                  compact={true}
                  mode="outlined"
                >
                  {deliveryDetails.vehicleType}
                </Chip>
              </View>
            </View>

            <Divider style={styles.compactDivider} />

            <View style={styles.totalRow}>
              <Text variant="titleMedium" style={styles.totalLabel}>{t('total')}</Text>
              <Text variant="titleMedium" style={styles.totalValue}>₹{calculateTotal().toFixed(2)}</Text>
            </View>

            {defaultMethod && (
              <View style={styles.paymentMethod}>
                <Text variant="bodySmall" style={styles.paymentLabel}>{t('payment')}: {defaultMethod?.title || 'Payment Method'}</Text>
                <Button
                  mode="text"
                  onPress={() => router.push('/(main)/payment/methods')}
                  style={styles.changeButton}
                  labelStyle={styles.changeButtonLabel}
                  compact
                >
                  {t('change')}
                </Button>
              </View>
            )}

            <Button
              mode="contained"
              onPress={handleCheckout}
              style={styles.checkoutButton}
              labelStyle={styles.checkoutButtonLabel}
              contentStyle={styles.checkoutButtonContent}
              disabled={items.length === 0 || locationLoading}
            >
              {getButtonLabel()}
            </Button>
          </Card.Content>
          </Card>
          </Animated.View>
        </View>
      )}
      <Portal>
        <Snackbar
          visible={snackbarVisible}
          onDismiss={() => setSnackbarVisible(false)}
          duration={2500}
          style={styles.snackbar}
          wrapperStyle={styles.snackbarWrapper}
        >
          <Text style={{ color: 'white' }}>{snackbarMessage || 'Notification'}</Text>
        </Snackbar>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA', // Premium light grey
  },
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    elevation: 0,
  },
  headerTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleText: {
    fontWeight: '700',
    fontSize: 20,
    color: '#1A1A1A',
  },
  itemCountBadge: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: '#FFE0B2',
  },
  itemCountText: {
    color: '#FF7D00',
    fontSize: 12,
    fontWeight: '700',
  },
  headerRight: {
    width: 48,
    marginRight: 4,
  },
  mainContent: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  // Cart Item Styles
  cartItemCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    marginBottom: 16,
    padding: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
  },
  cartItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  cartItemImage: {
    width: 80,
    height: 80,
    borderRadius: 16,
    backgroundColor: '#F8F9FA',
  },
  cartItemDetails: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'space-between',
    minHeight: 80,
  },
  cartItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    flex: 1,
    marginRight: 8,
    lineHeight: 22,
  },
  itemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  itemUnit: {
    fontSize: 13,
    color: '#888',
  },
  sellerName: {
    fontSize: 13,
    color: '#888',
    marginLeft: 6,
    flex: 1,
  },
  cartItemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  itemTotal: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FF7D00',
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 30,
    height: 36,
    padding: 2,
  },
  quantityButton: {
    margin: 0,
    width: 32,
    height: 32,
  },
  quantityButtonActive: {
    margin: 0,
    width: 32,
    height: 32,
  },
  quantityText: {
    marginHorizontal: 8,
    fontWeight: '600',
    fontSize: 15,
    minWidth: 16,
    textAlign: 'center',
  },
  quantityInput: {
    marginHorizontal: 8,
    fontWeight: '600',
    fontSize: 15,
    minWidth: 30,
    textAlign: 'center',
    padding: 0,
    color: '#1A1A1A',
  },
  deleteButton: {
    margin: 0,
    width: 36,
    height: 36,
    marginTop: -4,
    marginRight: -8,
  },



  // Summary Card
  summaryCard: {
    marginTop: 64,
    borderRadius: 24,
    backgroundColor: '#fff',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
  },
  floatingSummaryCard: {
    marginTop: 0,
    position: 'absolute',
    bottom: 80,
    left: 16,
    right: 16,
    zIndex: 100,
  },
  summaryContent: {
    padding: 20,
  },
  compactSummarySection: {
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  deliveryFeeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flex: 1,
    alignItems: 'center',
  },
  deliveryDetailsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 4,
  },
  deliveryChip: {
    height: 24,
    backgroundColor: '#F5F5F5',
  },
  chipText: {
    fontSize: 11,
    color: '#666',
    marginVertical: 0,
  },
  compactDivider: {
    backgroundColor: '#F0F0F0',
    height: 1,
    marginBottom: 16,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  totalValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FF7D00', // Primary Orange
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#eee',
  },
  paymentLabel: {
    fontSize: 13,
    color: '#444',
    fontWeight: '500',
  },
  changeButton: {
    margin: 0,
  },
  changeButtonLabel: {
    fontSize: 12,
    color: '#FF7D00',
    fontWeight: '600',
  },
  checkoutButton: {
    borderRadius: 16,
    backgroundColor: '#1A1A1A', // Premium Dark button
    shadowColor: '#FF7D00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  checkoutButtonLabel: {
    fontSize: 16,
    fontWeight: '700',
    paddingVertical: 4,
    color: '#fff',
  },
  checkoutButtonContent: {
    height: 52,
  },

  // Empty State & Misc
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 12,
    marginBottom: 24,
    color: '#888',
    fontSize: 16,
  },
  emptyCartActions: {
    flexDirection: 'column',
    gap: 12,
    width: '100%',
    paddingHorizontal: 40,
  },
  browseButton: {
    width: '100%',
    borderRadius: 12,
    backgroundColor: '#FF7D00',
    marginBottom: 0,
  },
  callButton: {
    width: '100%',
    borderRadius: 12,
    borderColor: '#FF7D00',
    borderWidth: 1,
    marginLeft: 0,
  },
  nudgeCard: {
    marginVertical: 8,
    marginHorizontal: 12,
    borderLeftWidth: 4,
    elevation: 2,
  },
  nudgeContent: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  nudgeHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  nudgeIcon: {
    margin: 0,
    marginRight: 4,
  },
  nudgeTextContainer: {
    flex: 1,
    marginRight: 4,
  },
  nudgeTitle: {
    fontWeight: '600',
    marginBottom: 4,
  },
  nudgeMessage: {
    color: '#666',
    lineHeight: 18,
  },
  dismissButton: {
    margin: 0,
    padding: 0,
  },
  bottomPadding: {
    height: 160,
  },
  snackbar: {
    backgroundColor: '#323232',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 8,
  },
  snackbarWrapper: {
    bottom: 0,
    zIndex: 9999,
  },
});