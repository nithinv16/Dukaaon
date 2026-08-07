import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Dimensions, Image, Alert, Modal } from 'react-native';
import { Card, Button, Chip, TextInput, IconButton, Divider } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../../../services/supabase/supabase';
import { useCartStore } from '../../../../store/cart';
import { useWishlistStore } from '../../../../store/wishlist';
import { useAuthStore } from '../../../../store/auth';
import { Ionicons } from '@expo/vector-icons';
// Video support - uncomment when expo-av is installed
// import { Video } from 'expo-av';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { translationService } from '../../../../services/translationService';
import { useTranslateDynamic } from '../../../../utils/translationUtils';
import { VariantService, ProductVariant, createVariantGroups } from '../../../../services/products/VariantService';
import VariantSelector from '../../../../components/products/VariantSelector';
import logger from '../../../../utils/logger';

import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Premium Color Palette
const COLORS = {
  primary: '#FF7D00', // Vibrant Orange
  primaryLight: '#FFF3E0', // Soft Orange
  secondary: '#1A1A1A', // Dark Grey/Black
  text: '#333333',
  textLight: '#888888',
  white: '#FFFFFF',
  background: '#F8F9FA', // Cool White/Grey
  cardBg: '#FFFFFF',
  inputBg: '#F3F4F6',
  border: '#E5E7EB',
  success: '#34C759',
  error: '#FF3B30',
};

interface ProductMedia {
  id: string;
  media_type: 'image' | 'video';
  media_url: string;
  thumbnail_url?: string;
  display_order: number;
  caption?: string;
  is_primary: boolean;
}

interface ProductReview {
  id: string;
  user_id: string;
  rating: number;
  comment?: string;
  is_verified_purchase: boolean;
  helpful_count: number;
  created_at: string;
  profiles?: {
    phone_number?: string;
    business_details?: {
      shopName?: string;
    };
  };
}

interface ProductDetailsConfig {
  layout_type: 'default' | 'minimal' | 'detailed' | 'custom';
  show_videos_first: boolean;
  show_seller_info: boolean;
  show_similar_products: boolean;
  show_recommended_products: boolean;
  show_reviews: boolean;
  sections_order?: string[];
  custom_styles?: any;
}

interface Product {
  id: string;
  name: string;
  price: number;
  image_url?: string;
  description?: string;
  brand?: string;
  category?: string;
  subcategory?: string;
  min_quantity: number;
  unit: string;
  seller_id: string;
  status: string;
  profiles?: {
    id: string;
    seller_details?: {
      business_name: string;
      seller_type: string;
      image_url?: string;
      description?: string;
    };
  };
}

interface SimilarProduct {
  id: string;
  name: string;
  price: number;
  image_url?: string;
  brand?: string;
}

export default function ProductDetails() {
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ id: string }>();
  const { currentLanguage } = useLanguage();
  const { translateArrayFields } = useTranslateDynamic();
  const { addToCart } = useCartStore();
  const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlistStore();
  const { user } = useAuthStore();

  const [product, setProduct] = useState<Product | null>(null);
  const [translatedProduct, setTranslatedProduct] = useState<Product | null>(null);
  const [media, setMedia] = useState<ProductMedia[]>([]);
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [translatedReviews, setTranslatedReviews] = useState<ProductReview[]>([]);
  const [similarProducts, setSimilarProducts] = useState<SimilarProduct[]>([]);
  const [translatedSimilarProducts, setTranslatedSimilarProducts] = useState<SimilarProduct[]>([]);
  const [recommendedProducts, setRecommendedProducts] = useState<SimilarProduct[]>([]);
  const [translatedRecommendedProducts, setTranslatedRecommendedProducts] = useState<SimilarProduct[]>([]);
  const [config, setConfig] = useState<ProductDetailsConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [averageRating, setAverageRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [imageViewerIndex, setImageViewerIndex] = useState(0);
  const imageViewerScrollRef = useRef<ScrollView>(null);
  const [translatedSellerName, setTranslatedSellerName] = useState<string | null>(null);
  const [translatedSellerDescription, setTranslatedSellerDescription] = useState<string | null>(null);

  // Variant-related state
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [variantLoading, setVariantLoading] = useState(false);

  // Define original texts for translation
  const originalTexts = {
    loadingProductDetails: 'Loading product details...',
    productNotFound: 'Product not found',
    goBack: 'Go Back',
    noImageAvailable: 'No image available',
    quantity: 'Quantity',
    min: 'Min',
    addToCart: 'Add to Cart',
    description: 'Description',
    sellerInformation: 'Seller Information',
    viewSellerProducts: 'View all products from this seller →',
    reviews: 'Reviews',
    writeReview: 'Write Review',
    cancel: 'Cancel',
    writeAReview: 'Write a Review',
    rating: 'Rating',
    comment: 'Comment',
    submit: 'Submit',
    similarProducts: 'Similar Products',
    recommendedProducts: 'Recommended Products',
    productAdded: 'Product added to cart',
    failedToAdd: 'Failed to add product to cart. Please try again.',
    provideRating: 'Please provide a rating',
    reviewSubmitted: 'Review submitted successfully',
    failedToSubmit: 'Failed to submit review',
    error: 'Error',
    success: 'Success',
    distanceConstraint: 'Distance Constraint',
    failedToLoad: 'Failed to load product details',
    per: 'per',
    reviewsCount: 'reviews',
    unknownSeller: 'Unknown Seller',
    noReviewsYet: 'No reviews yet',
    yourReviewOptional: 'Your review (optional)',
    verifiedPurchase: 'Verified Purchase'
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

        // Translate each text individually using translateText method
        const translationPromises = Object.entries(originalTexts).map(async ([key, value]) => {
          try {
            const translated = await translationService.translateText(value, currentLanguage);
            return [key, translated?.translatedText || value];
          } catch (error) {
            logger.error(`Error translating ${key}:`, error);
            return [key, value]; // Fallback to original text
          }
        });

        const translatedEntries = await Promise.all(translationPromises);
        const newTranslations = Object.fromEntries(translatedEntries);
        setTranslations(newTranslations);
      } catch (error) {
        logger.error('Error loading translations:', error);
        setTranslations(originalTexts); // Fallback to original texts
      }
    };

    loadTranslations();
  }, [currentLanguage]);

  // Create a synchronous translation function for UI text
  const t = (key: keyof typeof originalTexts) => {
    return translations[key] || originalTexts[key] || key;
  };

  // Fetch product details
  const fetchProductDetails = useCallback(async () => {
    if (!params.id) return;

    setIsLoading(true);
    try {
      // Fetch product with seller details
      // Note: products.seller_id -> profiles.id -> seller_details.user_id
      const { data: productData, error: productError } = await supabase
        .from('products')
        .select(`
          *,
          profiles!seller_id (
            id,
            seller_details (
              business_name,
              seller_type,
              image_url,
              description
            )
          )
        `)
        .eq('id', params.id)
        .single();

      if (productError) {
        logger.error('Error fetching product:', productError);
        Alert.alert(t('error'), t('failedToLoad'));
        return;
      }

      setProduct(productData);

      // Translate product details
      if (productData) {
        translateProductDetails(productData);
      }

      // Fetch product media
      const { data: mediaData } = await supabase
        .from('product_media')
        .select('*')
        .eq('product_id', params.id)
        .order('display_order', { ascending: true });

      // Always use product's image_url as the first image
      // Then append additional media from product_media table
      const allMedia: ProductMedia[] = [];

      // Add main product image as first image
      if (productData.image_url) {
        // Check if the main image is already in product_media to avoid duplicates
        const mainImageExists = mediaData?.some(
          (m: ProductMedia) => m.media_url === productData.image_url && m.media_type === 'image'
        );

        if (!mainImageExists) {
          allMedia.push({
            id: 'main',
            media_type: 'image',
            media_url: productData.image_url,
            display_order: 0,
            is_primary: true
          } as ProductMedia);
        }
      }

      // Append additional media from product_media table
      if (mediaData && mediaData.length > 0) {
        allMedia.push(...mediaData);
      }

      setMedia(allMedia);

      // Fetch product details config
      const { data: configData } = await supabase
        .from('product_details_config')
        .select('*')
        .eq('product_id', params.id)
        .single();

      if (configData) {
        setConfig(configData);
      } else {
        // Default config
        setConfig({
          layout_type: 'default',
          show_videos_first: false,
          show_seller_info: true,
          show_similar_products: true,
          show_recommended_products: true,
          show_reviews: true,
          sections_order: ['media', 'info', 'description', 'seller', 'reviews', 'similar', 'recommended']
        });
      }

      // Fetch reviews
      const { data: reviewsData } = await supabase
        .from('product_reviews')
        .select(`
          *,
          profiles:profiles!product_reviews_user_id_fkey(
            phone_number,
            business_details
          )
        `)
        .eq('product_id', params.id)
        .order('created_at', { ascending: false });

      if (reviewsData) {
        setReviews(reviewsData);
        // Translate reviews
        translateReviews(reviewsData);
        // Calculate average rating
        if (reviewsData.length > 0) {
          const avg = reviewsData.reduce((sum, r) => sum + r.rating, 0) / reviewsData.length;
          setAverageRating(avg);
          setTotalReviews(reviewsData.length);
        }
      }

      // Fetch similar products (same category)
      if (productData.category) {
        const { data: similarData } = await supabase
          .from('products')
          .select('id, name, price, image_url, brand')
          .eq('category', productData.category)
          .eq('status', 'available')
          .neq('id', params.id)
          .limit(10);

        if (similarData) {
          setSimilarProducts(similarData);
          // Translate similar products
          translateProducts(similarData, setTranslatedSimilarProducts);
        }
      }

      // Fetch recommended products (using recommendation service if available)
      // For now, fetch products from same seller
      const { data: recommendedData } = await supabase
        .from('products')
        .select('id, name, price, image_url, brand')
        .eq('seller_id', productData.seller_id)
        .eq('status', 'available')
        .neq('id', params.id)
        .limit(10);

      if (recommendedData) {
        setRecommendedProducts(recommendedData);
        // Translate recommended products
        translateProducts(recommendedData, setTranslatedRecommendedProducts);
      }

      // Fetch product variants
      try {
        setVariantLoading(true);
        const productVariants = await VariantService.getProductVariants(params.id);
        if (productVariants && productVariants.length > 0) {
          setVariants(productVariants);
          // Set default variant or first variant as selected
          const defaultVariant = productVariants.find(v => v.is_default) || productVariants[0];
          setSelectedVariant(defaultVariant);
        }
      } catch (variantError) {
        logger.error('Error fetching variants:', variantError);
        // Non-critical error, don't show alert
      } finally {
        setVariantLoading(false);
      }

    } catch (error) {
      logger.error('Error fetching product details:', error);
      Alert.alert('Error', 'Failed to load product details');
    } finally {
      setIsLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchProductDetails();
  }, [fetchProductDetails]);

  // Translate product details when product or language changes
  const translateProductDetails = async (productData: Product) => {
    if (currentLanguage === 'en') {
      setTranslatedProduct(productData);
      return;
    }

    try {
      const translated = await translateArrayFields(
        [productData],
        ['name', 'description', 'brand', 'category', 'subcategory']
      );

      if (translated && translated.length > 0) {
        setTranslatedProduct(translated[0] as Product);
      } else {
        setTranslatedProduct(productData);
      }
    } catch (error) {
      logger.error('Error translating product details:', error);
      setTranslatedProduct(productData);
    }
  };

  // Translate reviews when reviews or language changes
  const translateReviews = async (reviewsData: ProductReview[]) => {
    if (currentLanguage === 'en' || reviewsData.length === 0) {
      setTranslatedReviews(reviewsData);
      return;
    }

    try {
      const translated = await translateArrayFields(
        reviewsData,
        ['comment']
      );

      setTranslatedReviews(translated as ProductReview[]);
    } catch (error) {
      logger.error('Error translating reviews:', error);
      setTranslatedReviews(reviewsData);
    }
  };

  // Translate products array (for similar/recommended)
  const translateProducts = async (
    products: SimilarProduct[],
    setTranslated: (products: SimilarProduct[]) => void
  ) => {
    if (currentLanguage === 'en' || products.length === 0) {
      setTranslated(products);
      return;
    }

    try {
      const translated = await translateArrayFields(
        products,
        ['name', 'brand']
      );

      setTranslated(translated as SimilarProduct[]);
    } catch (error) {
      logger.error('Error translating products:', error);
      setTranslated(products);
    }
  };

  // Re-translate when language changes
  useEffect(() => {
    if (product) {
      translateProductDetails(product);
    }
  }, [currentLanguage, product]);

  // Update navigation options - Hide default header for immersive experience
  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  // Memoize review IDs to detect actual content changes, not just length
  const reviewIds = useMemo(() => reviews.map(r => r.id).join(','), [reviews]);

  useEffect(() => {
    if (reviews.length > 0) {
      translateReviews(reviews);
    }
  }, [currentLanguage, reviewIds]);

  // Memoize similar product IDs to detect actual content changes
  const similarProductIds = useMemo(() => similarProducts.map(p => p.id).join(','), [similarProducts]);

  useEffect(() => {
    if (similarProducts.length > 0) {
      translateProducts(similarProducts, setTranslatedSimilarProducts);
    }
  }, [currentLanguage, similarProductIds]);

  // Memoize recommended product IDs to detect actual content changes
  const recommendedProductIds = useMemo(() => recommendedProducts.map(p => p.id).join(','), [recommendedProducts]);

  useEffect(() => {
    if (recommendedProducts.length > 0) {
      translateProducts(recommendedProducts, setTranslatedRecommendedProducts);
    }
  }, [currentLanguage, recommendedProductIds]);

  // Set quantity to min_quantity when product loads
  useEffect(() => {
    if (product && product.min_quantity) {
      setQuantity(product.min_quantity);
    }
  }, [product]);

  // Scroll to selected image when modal opens
  useEffect(() => {
    if (imageViewerVisible && imageViewerScrollRef.current) {
      setTimeout(() => {
        imageViewerScrollRef.current?.scrollTo({
          x: imageViewerIndex * SCREEN_WIDTH,
          y: 0,
          animated: false,
        });
      }, 100);
    }
  }, [imageViewerVisible, imageViewerIndex]);

  // Translate seller info when seller details or language changes
  useEffect(() => {
    const translateSellerInfo = async () => {
      const sellerDetails = product?.profiles?.seller_details;
      if (!sellerDetails) {
        setTranslatedSellerName(null);
        setTranslatedSellerDescription(null);
        return;
      }

      if (currentLanguage === 'en') {
        setTranslatedSellerName(sellerDetails.business_name || null);
        setTranslatedSellerDescription(sellerDetails.description || null);
        return;
      }

      try {
        const [nameTranslation, descTranslation] = await Promise.all([
          sellerDetails.business_name
            ? translationService.translateText(sellerDetails.business_name, currentLanguage)
            : Promise.resolve(null),
          sellerDetails.description
            ? translationService.translateText(sellerDetails.description, currentLanguage)
            : Promise.resolve(null)
        ]);

        setTranslatedSellerName(nameTranslation?.translatedText || sellerDetails.business_name || null);
        setTranslatedSellerDescription(descTranslation?.translatedText || sellerDetails.description || null);
      } catch (error) {
        logger.error('Error translating seller info:', error);
        setTranslatedSellerName(sellerDetails.business_name || null);
        setTranslatedSellerDescription(sellerDetails.description || null);
      }
    };

    if (product) {
      translateSellerInfo();
    }
  }, [currentLanguage, product?.profiles?.seller_details]);

  const handleAddToCart = async () => {
    if (!product) return;

    try {
      const cartItem = {
        uniqueId: '', // Will be set by the server
        product_id: product.id,
        name: product.name,
        price: (selectedVariant?.price || product.price).toString(),
        quantity: quantity,
        image_url: media[0]?.media_url || product.image_url || '',
        unit: product.unit,
        seller_id: product.seller_id,
        variant_id: selectedVariant?.id, // Include variant ID if selected
        variant_info: selectedVariant ? `${selectedVariant.variant_type}: ${selectedVariant.variant_value}` : undefined
      };

      await addToCart(cartItem);
      Alert.alert(t('success'), t('productAdded'));
    } catch (error: any) {
      logger.error('Error adding to cart:', error);

      // Check if it's a distance validation error
      if (error.message && error.message.includes('Distance to')) {
        Alert.alert(t('distanceConstraint'), error.message);
      } else {
        Alert.alert(t('error'), t('failedToAdd'));
      }
    }
  };

  const handleToggleWishlist = () => {
    if (!product) return;

    if (isInWishlist(product.id)) {
      removeFromWishlist(product.id);
    } else {
      addToWishlist({
        id: product.id,
        name: product.name,
        price: product.price,
        image_url: media[0]?.media_url || product.image_url || '',
        seller_id: product.seller_id,
        min_quantity: product.min_quantity,
        unit: product.unit
      });
    }
  };

  const handleSubmitReview = async () => {
    if (!user || !product || reviewRating === 0) {
      Alert.alert(t('error'), t('provideRating'));
      return;
    }

    try {
      const { error } = await supabase
        .from('product_reviews')
        .upsert({
          product_id: product.id,
          user_id: user.id,
          rating: reviewRating,
          comment: reviewComment || null
        }, {
          onConflict: 'product_id,user_id'
        });

      if (error) throw error;

      Alert.alert(t('success'), t('reviewSubmitted'));
      setReviewRating(0);
      setReviewComment('');
      setShowReviewForm(false);
      fetchProductDetails(); // Refresh reviews
    } catch (error) {
      logger.error('Error submitting review:', error);
      Alert.alert(t('error'), t('failedToSubmit'));
    }
  };

  const handleProductPress = (productId: string) => {
    router.push(`/(main)/screens/product/${productId}`);
  };

  // Use translated product if available, otherwise use original
  const displayProduct = translatedProduct || product;

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF7D00" />
        <Text style={styles.loadingText}>{t('loadingProductDetails')}</Text>
      </View>
    );
  }

  if (!product) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{t('productNotFound')}</Text>
        <Button onPress={() => router.back()}>{t('goBack')}</Button>
      </View>
    );
  }

  const displayMedia = config?.show_videos_first
    ? [...(media || []).filter(m => m.media_type === 'video'), ...(media || []).filter(m => m.media_type === 'image')]
    : (media || []);

  const sectionsOrder = config?.sections_order || [
    'media', 'info', 'description', 'seller', 'reviews', 'similar', 'recommended'
  ];

  const renderSection = (sectionName: string) => {
    switch (sectionName) {
      case 'media':
        return renderMediaSection();
      case 'info':
        return renderInfoSection();
      case 'description':
        return renderDescriptionSection();
      case 'seller':
        return config?.show_seller_info ? renderSellerSection() : null;
      case 'reviews':
        return config?.show_reviews ? renderReviewsSection() : null;
      case 'similar':
        return config?.show_similar_products ? renderSimilarProducts() : null;
      case 'recommended':
        return config?.show_recommended_products ? renderRecommendedProducts() : null;
      default:
        return null;
    }
  };

  const renderMediaSection = () => {
    if (displayMedia.length === 0) {
      // Show placeholder if no media
      return (
        <View style={styles.mediaSection}>
          <View style={styles.mediaItem}>
            <View style={styles.mediaImage}>
              <Text style={styles.noImageText}>{t('noImageAvailable')}</Text>
            </View>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.mediaSection}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => {
            const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
            setCurrentMediaIndex(index);
          }}
        >
          {(displayMedia || []).map((item, index) => (
            <View key={item.id || `media-${index}`} style={styles.mediaItem}>
              {item.media_type === 'video' ? (
                <View style={styles.mediaImage}>
                  <Text style={styles.videoPlaceholder}>Video: {item.media_url}</Text>
                  <Text style={styles.videoNote}>Video playback requires expo-av</Text>
                  {/* <Video
                    source={{ uri: item.media_url }}
                    style={styles.mediaImage}
                    useNativeControls
                    resizeMode="contain"
                  /> */}
                </View>
              ) : (
                <TouchableOpacity
                  style={{ width: '100%', height: '100%' }}
                  onPress={() => {
                    const imageIndex = displayMedia
                      .filter(item => item.media_type === 'image')
                      .findIndex(img => img.id === item.id);
                    setImageViewerIndex(imageIndex >= 0 ? imageIndex : 0);
                    setImageViewerVisible(true);
                  }}
                  activeOpacity={0.9}
                >
                  <Image
                    source={{
                      uri: item.media_url || 'https://via.placeholder.com/400x400?text=No+Image'
                    }}
                    style={styles.mediaImage}
                    resizeMode="contain"
                    onError={(error) => {
                      logger.error('Image load error:', error.nativeEvent.error, 'URL:', item.media_url);
                    }}
                  />
                </TouchableOpacity>
              )}
              {item.caption && (
                <Text style={styles.mediaCaption}>{item.caption}</Text>
              )}
            </View>
          ))}
        </ScrollView>

        {displayMedia.length > 1 && (
          <View style={styles.mediaIndicators}>
            {(displayMedia || []).map((_, index) => (
              <View
                key={index}
                style={[
                  styles.indicator,
                  index === currentMediaIndex && styles.indicatorActive
                ]}
              />
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderInfoSection = () => (
    <View style={styles.infoContainer}>
      <View style={styles.headerRow}>
        <View style={styles.titleContainer}>
          {(displayProduct?.brand || product.brand) && (
            <Text style={styles.brand}>{displayProduct?.brand || product.brand}</Text>
          )}
          <Text style={styles.productName}>{displayProduct?.name || product.name}</Text>
        </View>
        <TouchableOpacity
          style={styles.wishlistButton}
          onPress={handleToggleWishlist}
        >
          <Ionicons
            name={isInWishlist(product.id) ? 'heart' : 'heart-outline'}
            size={24}
            color={isInWishlist(product.id) ? COLORS.primary : COLORS.textLight}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.priceRow}>
        <Text style={styles.price}>₹{(selectedVariant?.price || product.price).toFixed(2)}</Text>
        <Text style={styles.unit}>{t('per')} {product.unit}</Text>
      </View>

      {averageRating > 0 && (
        <View style={styles.ratingContainer}>
          <View style={styles.ratingPill}>
            <Text style={styles.ratingValue}>{averageRating.toFixed(1)}</Text>
            <Ionicons name="star" size={12} color={COLORS.white} />
          </View>
          <Text style={styles.ratingCount}>
            {totalReviews} {t('reviewsCount')}
          </Text>
        </View>
      )}

      {/* Category & Subcategory Chips */}
      {((displayProduct?.category || product.category) || (displayProduct?.subcategory || product.subcategory)) && (
        <View style={styles.categoryChipsContainer}>
          {(displayProduct?.category || product.category) && (
            <Chip
              style={styles.categoryChip}
              textStyle={styles.categoryChipText}
              icon="folder"
            >
              {displayProduct?.category || product.category}
            </Chip>
          )}
          {(displayProduct?.subcategory || product.subcategory) && (
            <Chip
              style={styles.subcategoryChip}
              textStyle={styles.subcategoryChipText}
              icon="tag"
            >
              {displayProduct?.subcategory || product.subcategory}
            </Chip>
          )}
        </View>
      )}

      {/* Variant Selector */}
      {!variantLoading && variants.length > 0 && (
        <View style={styles.variantSection}>
          <VariantSelector
            variants={variants}
            variantGroups={createVariantGroups(variants)}
            selectedVariant={selectedVariant || undefined}
            basePrice={product.price}
            onVariantSelect={(variant) => {
              setSelectedVariant(variant);
              logger.log('Selected variant:', variant);
            }}
            displayMode="chips"
            showPriceDiff={true}
          />
        </View>
      )}
    </View>
  );

  const renderDescriptionSection = () => {
    const description = displayProduct?.description || product.description;
    if (!description) return null;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('description')}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
    );
  };

  const renderSellerSection = () => {
    const sellerDetails = product.profiles?.seller_details;
    const sellerName = translatedSellerName || sellerDetails?.business_name || t('unknownSeller');
    const sellerDescription = translatedSellerDescription || sellerDetails?.description;

    return (
      <TouchableOpacity
        style={styles.section}
        onPress={() => router.push(`/(main)/screens/category/${product.seller_id}`)}
      >
        <Text style={styles.sectionTitle}>{t('sellerInformation')}</Text>
        <View style={styles.sellerInfo}>
          {sellerDetails?.image_url && (
            <Image
              source={{ uri: sellerDetails.image_url }}
              style={styles.sellerImage}
            />
          )}
          <View style={styles.sellerDetails}>
            <Text style={styles.sellerName}>{sellerName}</Text>
            {sellerDescription && (
              <Text style={styles.sellerDescription} numberOfLines={2}>
                {sellerDescription}
              </Text>
            )}
            <Text style={styles.viewSellerText}>
              {t('viewSellerProducts')}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Use translated reviews if available, otherwise use original
  const displayReviews = translatedReviews.length > 0 && translatedReviews.length === reviews.length
    ? translatedReviews
    : reviews;

  const renderReviewsSection = () => (
    <View style={styles.section}>
      <View style={styles.reviewsHeader}>
        <Text style={styles.sectionTitle}>
          {t('reviews')} ({totalReviews})
        </Text>
        {user && (
          <Button
            mode="outlined"
            onPress={() => setShowReviewForm(!showReviewForm)}
            compact
          >
            {showReviewForm ? t('cancel') : t('writeReview')}
          </Button>
        )}
      </View>

      {showReviewForm && user && (
        <Card style={styles.reviewForm}>
          <Card.Content>
            <Text style={styles.reviewFormTitle}>{t('writeAReview')}</Text>
            <View style={styles.starsContainer}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setReviewRating(star)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={star <= reviewRating ? 'star' : 'star-outline'}
                    size={28}
                    color="#FF7D00"
                  />
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              label={t('yourReviewOptional')}
              value={reviewComment}
              onChangeText={setReviewComment}
              multiline
              numberOfLines={4}
              style={styles.reviewInput}
              mode="outlined"
            />
            <Button
              mode="contained"
              onPress={handleSubmitReview}
              style={styles.submitReviewButton}
              buttonColor="#FF7D00"
              disabled={reviewRating === 0}
            >
              {t('submit')}
            </Button>
          </Card.Content>
        </Card>
      )}

      {displayReviews.length === 0 ? (
        <Text style={styles.noReviews}>{t('noReviewsYet')}</Text>
      ) : (
        displayReviews.map((review) => (
          <Card key={review.id} style={styles.reviewCard}>
            <Card.Content>
              <View style={styles.reviewHeader}>
                <View style={styles.reviewerInfo}>
                  <Text style={styles.reviewerName}>
                    {review.profiles?.business_details?.shopName ||
                      review.profiles?.phone_number?.slice(-4) ||
                      'Anonymous'}
                  </Text>
                  {review.is_verified_purchase && (
                    <Chip mode="flat" compact style={styles.verifiedChip}>
                      {t('verifiedPurchase')}
                    </Chip>
                  )}
                </View>
                <View style={styles.starsContainer}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Ionicons
                      key={star}
                      name={star <= review.rating ? 'star' : 'star-outline'}
                      size={16}
                      color="#FF7D00"
                    />
                  ))}
                </View>
              </View>
              {review.comment && (
                <Text style={styles.reviewComment}>{review.comment}</Text>
              )}
              <Text style={styles.reviewDate}>
                {new Date(review.created_at).toLocaleDateString()}
              </Text>
            </Card.Content>
          </Card>
        ))
      )}
    </View>
  );

  // Use translated similar products if available, otherwise use original
  const displaySimilarProducts = translatedSimilarProducts.length > 0 &&
    translatedSimilarProducts.length === similarProducts.length
    ? translatedSimilarProducts
    : similarProducts;

  const renderSimilarProducts = () => {
    if (displaySimilarProducts.length === 0) return null;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('similarProducts')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {displaySimilarProducts.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.productCard}
              onPress={() => handleProductPress(item.id)}
            >
              <Card>
                <Image
                  source={{ uri: item.image_url || 'https://via.placeholder.com/150' }}
                  style={styles.productCardImage}
                />
                <Card.Content>
                  <Text style={styles.productCardName} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Text style={styles.productCardPrice}>₹{item.price.toFixed(2)}</Text>
                </Card.Content>
              </Card>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  // Use translated recommended products if available, otherwise use original
  const displayRecommendedProducts = translatedRecommendedProducts.length > 0 &&
    translatedRecommendedProducts.length === recommendedProducts.length
    ? translatedRecommendedProducts
    : recommendedProducts;

  const renderRecommendedProducts = () => {
    if (displayRecommendedProducts.length === 0) return null;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('recommendedProducts')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {displayRecommendedProducts.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.productCard}
              onPress={() => handleProductPress(item.id)}
            >
              <Card>
                <Image
                  source={{ uri: item.image_url || 'https://via.placeholder.com/150' }}
                  style={styles.productCardImage}
                />
                <Card.Content>
                  <Text style={styles.productCardName} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Text style={styles.productCardPrice}>₹{item.price.toFixed(2)}</Text>
                </Card.Content>
              </Card>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[COLORS.primaryLight, COLORS.white]}
        style={StyleSheet.absoluteFill}
      />

      {/* Floating Back Button */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => {
          if (navigation.canGoBack()) {
            navigation.goBack();
          } else {
            router.back();
          }
        }}
      >
        <Ionicons name="arrow-back" size={24} color={COLORS.secondary} />
      </TouchableOpacity>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        bounces={false}
      >
        {/* Force Media to be first for premium layout */}
        {renderMediaSection()}

        <View style={styles.sheetContainer}>
          {sectionsOrder
            .filter(section => section !== 'media') // Skip media as it's rendered top
            .map((section, index) => (
              <View key={section} style={index === sectionsOrder.length - 2 ? styles.lastSection : {}}>
                {renderSection(section)}
              </View>
            ))}
        </View>
      </ScrollView>

      {/* Fixed Bottom Action Bar */}
      <View style={styles.bottomBar}>
        <View style={styles.quantityContainer}>
          <TouchableOpacity
            style={[styles.quantityBtn, quantity <= product.min_quantity && styles.quantityBtnDisabled]}
            onPress={() => setQuantity(Math.max(product.min_quantity, quantity - 1))}
            disabled={quantity <= product.min_quantity}
          >
            <Ionicons name="remove" size={20} color={quantity <= product.min_quantity ? COLORS.textLight : COLORS.secondary} />
          </TouchableOpacity>

          <Text style={styles.quantityText}>{quantity}</Text>

          <TouchableOpacity
            style={styles.quantityBtn}
            onPress={() => setQuantity(quantity + 1)}
          >
            <Ionicons name="add" size={20} color={COLORS.secondary} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.addToCartBtn}
          onPress={handleAddToCart}
          activeOpacity={0.8}
        >
          <View>
            <Text style={styles.addToCartLabel}>{t('addToCart')}</Text>
            {quantity > 1 && (
              <Text style={styles.unitText}>{quantity} {product.unit}</Text>
            )}
          </View>
          <Text style={styles.addToCartPrice}>₹{(product.price * quantity).toFixed(2)}</Text>
        </TouchableOpacity>
      </View>

      {/* Full-screen Image Viewer Modal */}
      <Modal
        visible={imageViewerVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setImageViewerVisible(false)}
      >
        <View style={styles.imageViewerContainer}>
          <TouchableOpacity
            style={styles.imageViewerCloseButton}
            onPress={() => setImageViewerVisible(false)}
          >
            <Ionicons name="close" size={30} color="#fff" />
          </TouchableOpacity>

          <ScrollView
            ref={imageViewerScrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
              setImageViewerIndex(index);
            }}
            onLayout={() => {
              // Scroll to the selected image when modal opens
              if (imageViewerScrollRef.current) {
                setTimeout(() => {
                  imageViewerScrollRef.current?.scrollTo({
                    x: imageViewerIndex * SCREEN_WIDTH,
                    y: 0,
                    animated: false,
                  });
                }, 100);
              }
            }}
          >
            {displayMedia
              .filter(item => item.media_type === 'image')
              .map((item, index) => (
                <View key={item.id || `viewer-${index}`} style={styles.imageViewerItem}>
                  <Image
                    source={{ uri: item.media_url }}
                    style={styles.imageViewerImage}
                    resizeMode="contain"
                  />
                  {item.caption && (
                    <Text style={styles.imageViewerCaption}>{item.caption}</Text>
                  )}
                </View>
              ))}
          </ScrollView>

          {displayMedia.filter(item => item.media_type === 'image').length > 1 && (
            <View style={styles.imageViewerIndicators}>
              <Text style={styles.imageViewerCounter}>
                {imageViewerIndex + 1} / {displayMedia.filter(item => item.media_type === 'image').length}
              </Text>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 160, // Increased space for floating bottom bar
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: 16,
    color: COLORS.textLight,
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 18,
    color: COLORS.secondary,
    marginBottom: 20,
    textAlign: 'center',
  },
  backButton: {
    position: 'absolute',
    top: 30, // Reduced from 50 for less safe area
    left: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  mediaSection: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH, // Square aspect ratio for product images
    backgroundColor: COLORS.white,
    position: 'relative',
  },
  mediaItem: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain', // Changed to contain to show full product
  },
  noImageText: {
    fontSize: 16,
    color: COLORS.textLight,
  },
  mediaCaption: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    color: '#fff',
    padding: 8,
    borderRadius: 8,
    fontSize: 12,
    textAlign: 'center',
  },
  mediaIndicators: {
    position: 'absolute',
    bottom: 40, // Moved up to not be covered by sheet
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  indicatorActive: {
    backgroundColor: COLORS.primary,
    width: 24, // Elongated active dot
  },
  sheetContainer: {
    backgroundColor: COLORS.white,
    marginTop: -24, // Overlap effect
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 32,
    paddingHorizontal: 24,
    minHeight: 500,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 5,
  },
  infoContainer: {
    marginBottom: 24,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  titleContainer: {
    flex: 1,
    marginRight: 12,
  },
  brand: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  productName: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.secondary,
    lineHeight: 32,
  },
  wishlistButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.inputBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 16,
  },
  price: {
    fontSize: 32,
    fontWeight: '800',
    color: COLORS.secondary,
    letterSpacing: -0.5,
  },
  unit: {
    fontSize: 16,
    color: COLORS.textLight,
    fontWeight: '500',
    marginLeft: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.success,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
    gap: 4,
  },
  ratingValue: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 12,
  },
  ratingCount: {
    color: COLORS.textLight,
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  categoryChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    gap: 8,
  },
  categoryChip: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
    borderWidth: 1,
  },
  categoryChipText: {
    color: COLORS.primary,
    fontSize: 12,
  },
  subcategoryChip: {
    backgroundColor: '#E3F2FD',
    borderColor: '#1976D2',
    borderWidth: 1,
  },
  subcategoryChipText: {
    color: '#1976D2',
    fontSize: 12,
  },
  variantSection: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  section: {
    marginBottom: 32,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 24,
  },
  lastSection: {
    borderBottomWidth: 0,
    marginBottom: 0,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    lineHeight: 26,
    color: COLORS.text,
  },
  sellerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.inputBg,
    padding: 16,
    borderRadius: 16,
  },
  sellerImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: 16,
  },
  sellerDetails: {
    flex: 1,
  },
  sellerName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 4,
  },
  sellerDescription: {
    fontSize: 13,
    color: COLORS.textLight,
    marginBottom: 8,
  },
  viewSellerText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
  },
  reviewsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  reviewCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 0, // Flat style for reviews
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reviewerName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.secondary,
    marginRight: 8,
  },
  verifiedChip: {
    height: 20,
    backgroundColor: '#E8F5E9', // Light green
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewComment: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 22,
    marginBottom: 8,
  },
  reviewDate: {
    fontSize: 12,
    color: COLORS.textLight,
  },
  reviewForm: {
    backgroundColor: COLORS.inputBg,
    borderRadius: 16,
    marginBottom: 24,
    elevation: 0,
  },
  reviewFormTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  reviewInput: {
    backgroundColor: COLORS.white,
    marginTop: 12,
    marginBottom: 16,
    fontSize: 14,
  },
  submitReviewButton: {
    borderRadius: 12,
    paddingVertical: 6,
  },
  noReviews: {
    textAlign: 'center',
    color: COLORS.textLight,
    fontStyle: 'italic',
    marginTop: 8,
  },
  productCard: {
    width: 160,
    marginRight: 16,
    marginBottom: 8,
  },
  productCardImage: {
    width: '100%',
    height: 160,
    borderRadius: 16,
    backgroundColor: COLORS.inputBg,
    marginBottom: 8,
  },
  productCardName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.secondary,
    marginBottom: 4,
    lineHeight: 20,
  },
  productCardPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 80, // Lifted up to clear Tab Bar
    left: 16,
    right: 16,
    backgroundColor: COLORS.white,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 32, // Fully rounded pill
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 8, // Softer elevation for floating look
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    gap: 12,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.inputBg,
    borderRadius: 30,
    padding: 6,
    gap: 12,
  },
  quantityBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  quantityBtnDisabled: {
    backgroundColor: '#F0F0F0',
    elevation: 0,
  },
  quantityText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.secondary,
    minWidth: 20,
    textAlign: 'center',
  },
  addToCartBtn: {
    flex: 1,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 30,
    elevation: 4,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  addToCartLabel: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
  unitText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '500',
  },
  addToCartPrice: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '700',
  },
  videoPlaceholder: {
    fontSize: 14,
    color: COLORS.textLight,
    textAlign: 'center',
  },
  videoNote: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 8,
  },
  // Modal styles
  imageViewerContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 100,
    padding: 8,
  },
  imageViewerItem: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.8,
  },
  imageViewerCaption: {
    color: '#fff',
    position: 'absolute',
    bottom: 80,
    padding: 20,
    textAlign: 'center',
  },
  imageViewerIndicators: {
    position: 'absolute',
    bottom: 40,
  },
  imageViewerCounter: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

