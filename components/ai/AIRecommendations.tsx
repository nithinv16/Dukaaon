import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Button, Chip, Badge } from 'react-native-paper';

interface ProductRecommendation {
  product_id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  subcategory?: string;
  image_url?: string;
  rating?: number;
  availability: boolean;
  confidence_score: number;
  reason: string;
  tags?: string[];
  discount?: {
    percentage: number;
    original_price: number;
  };
}

interface RecommendationsData {
  recommendations: ProductRecommendation[];
  reasoning: string;
  confidence: number;
  type: string;
  metadata: {
    totalFound: number;
    processingTime: number;
    aiModel: string;
    contextUsed: string[];
  };
  suggestions?: string[];
}

interface AIRecommendationsProps {
  userId: string;
  type: 'personalized' | 'similar' | 'trending' | 'category' | 'cart_based';
  productId?: string;
  categoryId?: string;
  limit?: number;
  context?: {
    currentCart?: any[];
    recentOrders?: any[];
    preferences?: string[];
    location?: string;
    budget?: number;
  };
  onProductSelect?: (product: ProductRecommendation) => void;
  onAddToCart?: (product: ProductRecommendation) => void;
  style?: any;
  showHeader?: boolean;
  compact?: boolean;
}

const AIRecommendations: React.FC<AIRecommendationsProps> = ({
  userId,
  type,
  productId,
  categoryId,
  limit = 10,
  context = {},
  onProductSelect,
  onAddToCart,
  style,
  showHeader = true,
  compact = false
}) => {
  const [recommendations, setRecommendations] = useState<RecommendationsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);

  useEffect(() => {
    loadRecommendations();
  }, [userId, type, productId, categoryId, limit]);

  const loadRecommendations = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Use React Native compatible AI service
      const { reactNativeAIService } = await import('../../services/aiAgent/reactNativeAIService');
      
      // Get recommendations from AI service
      const recommendations = await reactNativeAIService.getRecommendations(
        type,
        {
          userId,
          productId,
          categoryId,
          limit,
          context
        }
      );

      const recommendationsData: RecommendationsData = {
        recommendations,
        reasoning: `Generated ${recommendations.length} ${type} recommendations based on your preferences and activity.`,
        confidence: 0.85,
        type,
        metadata: {
          totalFound: recommendations.length,
          processingTime: 0,
          aiModel: 'openai-gpt-3.5-turbo',
          contextUsed: ['user_preferences', 'product_catalog']
        },
        suggestions: [
          "Tell me more about the first recommendation",
          "What are some alternatives?",
          "Show me cheaper options",
          "Find premium alternatives"
        ]
      };

      setRecommendations(recommendationsData);

    } catch (error) {
      console.error('Error loading recommendations:', error);
      setError(error.message || 'Failed to load recommendations');
      
      // Set fallback recommendations
      const fallbackRecommendations: ProductRecommendation[] = [
        {
          product_id: 'fallback-1',
          name: 'Popular Product',
          description: 'A highly rated product that customers love',
          price: 29.99,
          category: 'General',
          availability: true,
          confidence_score: 0.7,
          reason: 'Popular choice among users',
          rating: 4.5
        },
        {
          product_id: 'fallback-2',
          name: 'Trending Item',
          description: 'Currently trending in your area',
          price: 49.99,
          category: 'General',
          availability: true,
          confidence_score: 0.6,
          reason: 'Trending in your location',
          rating: 4.2
        }
      ];

      const fallbackData: RecommendationsData = {
        recommendations: fallbackRecommendations,
        reasoning: 'Showing popular products while we resolve the connection issue.',
        confidence: 0.6,
        type,
        metadata: {
          totalFound: fallbackRecommendations.length,
          processingTime: 0,
          aiModel: 'fallback',
          contextUsed: ['fallback_algorithm']
        },
        suggestions: [
          "Try again",
          "Browse manually",
          "Contact support"
        ]
      };

      setRecommendations(fallbackData);
    } finally {
      setIsLoading(false);
    }
  };

  const handleProductPress = (product: ProductRecommendation) => {
    setSelectedProduct(product.product_id);
    onProductSelect?.(product);
  };

  const handleAddToCart = async (product: ProductRecommendation) => {
    try {
      // Add visual feedback
      setSelectedProduct(product.product_id);
      
      // Call parent handler
      onAddToCart?.(product);
      
      // Show success feedback
      Alert.alert('Added to Cart', `${product.name} has been added to your cart.`);
      
    } catch (error) {
      console.error('Error adding to cart:', error);
      Alert.alert('Error', 'Failed to add product to cart. Please try again.');
    } finally {
      setTimeout(() => setSelectedProduct(null), 1000);
    }
  };

  const getTypeTitle = () => {
    const titles: Record<string, string> = {
      personalized: 'Recommended for You',
      similar: 'Similar Products',
      trending: 'Trending Now',
      category: 'Popular in Category',
      cart_based: 'Frequently Bought Together'
    };
    return titles[type] || 'Recommendations';
  };

  const getTypeIcon = () => {
    const icons: Record<string, string> = {
      personalized: 'person',
      similar: 'copy',
      trending: 'trending-up',
      category: 'grid',
      cart_based: 'basket'
    };
    return icons[type] || 'star';
  };

  const renderConfidenceIndicator = (confidence: number) => {
    const color = confidence > 0.8 ? '#4caf50' : confidence > 0.6 ? '#ff9800' : '#f44336';
    const label = confidence > 0.8 ? 'High' : confidence > 0.6 ? 'Medium' : 'Low';
    
    return (
      <View style={[styles.confidenceIndicator, { backgroundColor: color }]}>
        <Text style={styles.confidenceText}>{label}</Text>
      </View>
    );
  };

  const renderProductCard = (product: ProductRecommendation, index: number) => {
    const isSelected = selectedProduct === product.product_id;
    
    return (
      <TouchableOpacity
        key={product.product_id}
        style={[
          compact ? styles.compactProductCard : styles.productCard,
          isSelected && styles.selectedProductCard
        ]}
        onPress={() => handleProductPress(product)}
        activeOpacity={0.7}
      >
        <Card style={styles.card}>
          <View style={styles.cardContent}>
            {/* Product Image */}
            <View style={compact ? styles.compactImageContainer : styles.imageContainer}>
              {product.image_url ? (
                <Image
                  source={{ uri: product.image_url }}
                  style={compact ? styles.compactProductImage : styles.productImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={[
                  compact ? styles.compactProductImage : styles.productImage,
                  styles.placeholderImage
                ]}>
                  <Ionicons name="image" size={compact ? 20 : 40} color="#ccc" />
                </View>
              )}
              
              {/* Availability Badge */}
              {!product.availability && (
                <Badge style={styles.unavailableBadge}>Out of Stock</Badge>
              )}
              
              {/* Discount Badge */}
              {product.discount && (
                <Badge style={styles.discountBadge}>
                  {product.discount.percentage}% OFF
                </Badge>
              )}
            </View>

            {/* Product Info */}
            <View style={styles.productInfo}>
              <Text style={compact ? styles.compactProductName : styles.productName} numberOfLines={2}>
                {product.name}
              </Text>
              
              {!compact && (
                <Text style={styles.productDescription} numberOfLines={2}>
                  {product.description}
                </Text>
              )}
              
              <View style={styles.priceContainer}>
                {product.discount ? (
                  <>
                    <Text style={styles.discountedPrice}>₹{product.price}</Text>
                    <Text style={styles.originalPrice}>₹{product.discount.original_price}</Text>
                  </>
                ) : (
                  <Text style={styles.price}>₹{product.price}</Text>
                )}
              </View>
              
              {/* Rating */}
              {product.rating && (
                <View style={styles.ratingContainer}>
                  <Ionicons name="star" size={14} color="#ffc107" />
                  <Text style={styles.rating}>{product.rating.toFixed(1)}</Text>
                </View>
              )}
              
              {/* Reason */}
              <Text style={styles.reason} numberOfLines={1}>
                {product.reason}
              </Text>
              
              {/* Tags */}
              {!compact && product.tags && product.tags.length > 0 && (
                <View style={styles.tagsContainer}>
                  {product.tags.slice(0, 2).map((tag, idx) => (
                    <Chip key={`tag-${product.product_id || product.id}-${idx}`} style={styles.tag} textStyle={styles.tagText}>
                      {tag}
                    </Chip>
                  ))}
                </View>
              )}
            </View>

            {/* Actions */}
            <View style={styles.actionsContainer}>
              <TouchableOpacity
                style={[
                  styles.addToCartButton,
                  !product.availability && styles.disabledButton
                ]}
                onPress={() => handleAddToCart(product)}
                disabled={!product.availability}
              >
                <Ionicons 
                  name={isSelected ? "checkmark" : "add"} 
                  size={16} 
                  color={!product.availability ? "#ccc" : "#fff"} 
                />
                {!compact && (
                  <Text style={[
                    styles.addToCartText,
                    !product.availability && styles.disabledText
                  ]}>
                    {isSelected ? "Added" : "Add"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  const renderHeader = () => {
    if (!showHeader || !recommendations) return null;

    return (
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name={getTypeIcon()} size={24} color="#667eea" />
          <Text style={styles.headerTitle}>{getTypeTitle()}</Text>
        </View>
        
        <View style={styles.headerRight}>
          {renderConfidenceIndicator(recommendations.confidence)}
          <Text style={styles.countText}>
            {recommendations.recommendations.length} items
          </Text>
        </View>
      </View>
    );
  };

  const renderMetadata = () => {
    if (compact || !recommendations) return null;

    return (
      <View style={styles.metadata}>
        <Text style={styles.reasoning}>{recommendations.reasoning}</Text>
        
        <View style={styles.metadataRow}>
          <Text style={styles.metadataText}>
            Processed in {recommendations.metadata.processingTime}ms
          </Text>
          <Text style={styles.metadataText}>
            AI Model: {recommendations.metadata.aiModel}
          </Text>
        </View>
        
        {recommendations.metadata.contextUsed.length > 0 && (
          <View style={styles.contextContainer}>
            <Text style={styles.contextLabel}>Context used:</Text>
            {recommendations.metadata.contextUsed.map((context, index) => (
              <Chip key={`context-${index}-${context}`} style={styles.contextChip} textStyle={styles.contextChipText}>
                {context}
              </Chip>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderSuggestions = () => {
    if (compact || !recommendations?.suggestions || recommendations.suggestions.length === 0) {
      return null;
    }

    return (
      <View style={styles.suggestionsContainer}>
        <Text style={styles.suggestionsTitle}>You might also like:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {recommendations.suggestions.map((suggestion, index) => (
            <TouchableOpacity key={`suggestion-${index}-${suggestion.slice(0, 10)}`} style={styles.suggestionChip}>
              <Text style={styles.suggestionText}>{suggestion}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer, style]}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.loadingText}>Loading AI recommendations...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.errorContainer, style]}>
        <Ionicons name="alert-circle" size={48} color="#f44336" />
        <Text style={styles.errorText}>{error}</Text>
        <Button mode="outlined" onPress={loadRecommendations} style={styles.retryButton}>
          Retry
        </Button>
      </View>
    );
  }

  if (!recommendations || recommendations.recommendations.length === 0) {
    return (
      <View style={[styles.container, styles.emptyContainer, style]}>
        <Ionicons name="search" size={48} color="#ccc" />
        <Text style={styles.emptyText}>No recommendations available</Text>
        <Text style={styles.emptySubtext}>Try adjusting your preferences or browse our catalog</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      {renderHeader()}
      {renderMetadata()}
      
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        horizontal={compact}
        showsHorizontalScrollIndicator={false}
      >
        {recommendations.recommendations.map((product, index) => renderProductCard(product, index))}
      </ScrollView>
      
      {renderSuggestions()}
    </View>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#f44336',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    marginLeft: 8,
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  confidenceIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 4,
  },
  confidenceText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  countText: {
    fontSize: 12,
    color: '#666',
  },
  metadata: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  reasoning: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    marginBottom: 8,
  },
  metadataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  metadataText: {
    fontSize: 12,
    color: '#666',
  },
  contextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  contextLabel: {
    fontSize: 12,
    color: '#666',
    marginRight: 8,
  },
  contextChip: {
    backgroundColor: '#e3f2fd',
    height: 24,
  },
  contextChipText: {
    fontSize: 10,
    color: '#1976d2',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  productCard: {
    marginBottom: 16,
  },
  compactProductCard: {
    width: width * 0.7,
    marginRight: 12,
  },
  selectedProductCard: {
    transform: [{ scale: 0.98 }],
  },
  card: {
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardContent: {
    flexDirection: 'row',
    padding: 12,
  },
  imageContainer: {
    width: 80,
    height: 80,
    marginRight: 12,
  },
  compactImageContainer: {
    width: 60,
    height: 60,
    marginRight: 8,
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  compactProductImage: {
    width: 60,
    height: 60,
    borderRadius: 6,
  },
  placeholderImage: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  unavailableBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#f44336',
    fontSize: 10,
  },
  discountBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: '#4caf50',
    fontSize: 10,
  },
  productInfo: {
    flex: 1,
    justifyContent: 'space-between',
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  compactProductName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  productDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
    marginBottom: 8,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  price: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  discountedPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4caf50',
    marginRight: 8,
  },
  originalPrice: {
    fontSize: 14,
    color: '#999',
    textDecorationLine: 'line-through',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  rating: {
    marginLeft: 4,
    fontSize: 14,
    color: '#666',
  },
  reason: {
    fontSize: 12,
    color: '#667eea',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  tagsContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  tag: {
    backgroundColor: '#f0f0f0',
    height: 20,
  },
  tagText: {
    fontSize: 10,
    color: '#666',
  },
  actionsContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  addToCartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#667eea',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  disabledButton: {
    backgroundColor: '#e0e0e0',
  },
  addToCartText: {
    marginLeft: 4,
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  disabledText: {
    color: '#ccc',
  },
  suggestionsContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  suggestionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  suggestionChip: {
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  suggestionText: {
    fontSize: 14,
    color: '#667eea',
  },
});

export default AIRecommendations;