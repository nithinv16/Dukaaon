// Utility functions for AI recommendations
import { ProductRecommendation, RecommendationsData } from '../AIRecommendations';

export const buildRecommendationPrompt = (
  type: string,
  params: {
    userId: string;
    productId?: string;
    categoryId?: string;
    limit: number;
    context: any;
  }
): string => {
  const { userId, productId, categoryId, limit, context } = params;
  
  let prompt = `Generate ${limit} product recommendations for user ${userId}.\n`;
  
  switch (type) {
    case 'personalized':
      prompt += `Provide personalized recommendations based on user preferences and history.`;
      break;
    case 'similar':
      prompt += `Find products similar to product ID: ${productId}`;
      break;
    case 'trending':
      prompt += `Show trending and popular products`;
      break;
    case 'category':
      prompt += `Recommend products from category: ${categoryId}`;
      break;
    case 'cart_based':
      prompt += `Recommend products that complement items in the user's cart`;
      break;
    default:
      prompt += `Provide general product recommendations`;
  }
  
  if (context.currentCart && context.currentCart.length > 0) {
    prompt += `\nCurrent cart items: ${JSON.stringify(context.currentCart)}`;
  }
  
  if (context.preferences && context.preferences.length > 0) {
    prompt += `\nUser preferences: ${context.preferences.join(', ')}`;
  }
  
  if (context.budget) {
    prompt += `\nBudget constraint: $${context.budget}`;
  }
  
  prompt += `\n\nPlease use the get_product_recommendations function to fetch relevant products.`;
  
  return prompt;
};

export const processRecommendationResults = (
  data: any,
  type: string,
  limit: number
): ProductRecommendation[] => {
  if (!data || !Array.isArray(data)) {
    return [];
  }
  
  return data.slice(0, limit).map((item: any, index: number) => ({
    product_id: item.id || `product_${index}`,
    name: item.name || 'Unknown Product',
    description: item.description || 'No description available',
    price: item.price || 0,
    category: item.category || 'General',
    subcategory: item.subcategory,
    image_url: item.image_url,
    rating: item.rating || 4.0,
    availability: item.availability !== false,
    confidence_score: 0.8,
    reason: `Recommended based on ${type} criteria`,
    tags: item.tags || [],
    discount: item.discount
  }));
};

export const processSearchResults = (
  data: any,
  type: string,
  limit: number
): ProductRecommendation[] => {
  return processRecommendationResults(data, type, limit);
};

export const generateFallbackRecommendations = (
  type: string,
  context: any,
  limit: number
): ProductRecommendation[] => {
  const fallbackProducts = [
    {
      product_id: 'rice_001',
      name: 'Premium Basmati Rice',
      description: 'High-quality basmati rice, perfect for daily meals',
      price: 25.99,
      category: 'Grains',
      availability: true,
      confidence_score: 0.7,
      reason: 'Popular staple food item',
      rating: 4.5
    },
    {
      product_id: 'oil_001',
      name: 'Sunflower Cooking Oil',
      description: 'Pure sunflower oil for healthy cooking',
      price: 12.50,
      category: 'Oils',
      availability: true,
      confidence_score: 0.7,
      reason: 'Essential cooking ingredient',
      rating: 4.2
    },
    {
      product_id: 'dal_001',
      name: 'Toor Dal',
      description: 'Fresh toor dal, rich in protein',
      price: 8.99,
      category: 'Pulses',
      availability: true,
      confidence_score: 0.7,
      reason: 'Nutritious protein source',
      rating: 4.3
    },
    {
      product_id: 'wheat_001',
      name: 'Whole Wheat Flour',
      description: 'Fresh ground whole wheat flour',
      price: 15.75,
      category: 'Flour',
      availability: true,
      confidence_score: 0.7,
      reason: 'Basic baking ingredient',
      rating: 4.4
    },
    {
      product_id: 'sugar_001',
      name: 'White Sugar',
      description: 'Pure white sugar for sweetening',
      price: 6.25,
      category: 'Sweeteners',
      availability: true,
      confidence_score: 0.7,
      reason: 'Common household item',
      rating: 4.1
    }
  ];
  
  return fallbackProducts.slice(0, limit);
};

export const calculateConfidenceScore = (
  recommendations: ProductRecommendation[],
  type: string,
  context: any
): number => {
  if (recommendations.length === 0) return 0;
  
  const avgConfidence = recommendations.reduce((sum, rec) => sum + rec.confidence_score, 0) / recommendations.length;
  
  // Adjust confidence based on context availability
  let contextBonus = 0;
  if (context.currentCart && context.currentCart.length > 0) contextBonus += 0.1;
  if (context.preferences && context.preferences.length > 0) contextBonus += 0.1;
  if (context.recentOrders && context.recentOrders.length > 0) contextBonus += 0.1;
  
  return Math.min(1.0, avgConfidence + contextBonus);
};

export const generateRecommendationSuggestions = (
  type: string,
  recommendations: ProductRecommendation[]
): string[] => {
  const suggestions = [];
  
  switch (type) {
    case 'personalized':
      suggestions.push('Show me more personalized items');
      suggestions.push('Update my preferences');
      break;
    case 'similar':
      suggestions.push('Find products in same category');
      suggestions.push('Show different price range');
      break;
    case 'trending':
      suggestions.push('Show weekly trending items');
      suggestions.push('Filter by category');
      break;
    case 'category':
      suggestions.push('Show subcategories');
      suggestions.push('Sort by price');
      break;
    case 'cart_based':
      suggestions.push('View my cart');
      suggestions.push('Continue shopping');
      break;
    default:
      suggestions.push('Refine recommendations');
      suggestions.push('Browse categories');
  }
  
  return suggestions.slice(0, 3);
};