// AI Recommendations API Endpoint
import { NextApiRequest, NextApiResponse } from 'next';
import { bedrockAIService } from '../../../services/aiAgent/bedrockAIService';

export interface RecommendationsRequest {
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
}

export interface RecommendationsResponse {
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
  error?: string;
}

export interface ProductRecommendation {
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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<RecommendationsResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      recommendations: [],
      reasoning: '',
      confidence: 0,
      type: '',
      metadata: {
        totalFound: 0,
        processingTime: 0,
        aiModel: '',
        contextUsed: []
      },
      error: 'Method not allowed'
    });
  }

  const startTime = Date.now();

  try {
    const {
      userId,
      type,
      productId,
      categoryId,
      limit = 10,
      context = {}
    }: RecommendationsRequest = req.body;

    if (!userId || !type) {
      return res.status(400).json({
        recommendations: [],
        reasoning: '',
        confidence: 0,
        type,
        metadata: {
          totalFound: 0,
          processingTime: Date.now() - startTime,
          aiModel: 'bedrock-claude-3.5-sonnet',
          contextUsed: []
        },
        error: 'UserId and type are required'
      });
    }

    // Build AI prompt based on recommendation type
    const prompt = buildRecommendationPrompt(type, {
      userId,
      productId,
      categoryId,
      limit,
      context
    });

    // Get recommendations from AI
    const messages = [
      {
        role: 'system' as const,
        content: 'You are an expert product recommendation engine for Dukaaon marketplace. Provide personalized, relevant product recommendations with detailed reasoning.',
        timestamp: new Date()
      },
      {
        role: 'user' as const,
        content: prompt,
        timestamp: new Date()
      }
    ];

    const aiResponse = await bedrockAIService.chat(messages, userId);

    // Process AI response and function calls
    let recommendations: ProductRecommendation[] = [];
    let contextUsed: string[] = [];

    if (aiResponse.function_calls) {
      for (const functionCall of aiResponse.function_calls) {
        if (functionCall.name === 'get_product_recommendations') {
          const funcResult = await bedrockAIService.executeFunction(functionCall, userId);
          if (funcResult.success && funcResult.data) {
            recommendations = processRecommendationResults(funcResult.data, type, limit);
            contextUsed.push('product_database');
          }
        } else if (functionCall.name === 'search_products') {
          const funcResult = await bedrockAIService.executeFunction(functionCall, userId);
          if (funcResult.success && funcResult.data) {
            recommendations = processSearchResults(funcResult.data, type, limit);
            contextUsed.push('product_search');
          }
        }
      }
    }

    // If no function calls or results, generate mock recommendations
    if (recommendations.length === 0) {
      recommendations = generateFallbackRecommendations(type, context, limit);
      contextUsed.push('fallback_algorithm');
    }

    // Calculate confidence score
    const confidence = calculateConfidenceScore(recommendations, type, context);

    // Generate suggestions for user
    const suggestions = generateRecommendationSuggestions(type, recommendations);

    const processingTime = Date.now() - startTime;

    return res.status(200).json({
      recommendations,
      reasoning: aiResponse.content,
      confidence,
      type,
      metadata: {
        totalFound: recommendations.length,
        processingTime,
        aiModel: 'bedrock-claude-3.5-sonnet',
        contextUsed
      },
      suggestions
    });

  } catch (error) {
    console.error('Recommendations API Error:', error);
    
    const processingTime = Date.now() - startTime;
    
    return res.status(500).json({
      recommendations: [],
      reasoning: 'Sorry, there was an error generating recommendations. Please try again.',
      confidence: 0,
      type: req.body.type || 'unknown',
      metadata: {
        totalFound: 0,
        processingTime,
        aiModel: 'bedrock-claude-3.5-sonnet',
        contextUsed: []
      },
      error: error.message || 'Internal server error'
    });
  }
}

// Build recommendation prompt based on type
function buildRecommendationPrompt(type: string, params: any): string {
  const { userId, productId, categoryId, limit, context } = params;
  
  let prompt = `Generate ${limit} product recommendations for user ${userId}.\n\n`;
  
  switch (type) {
    case 'personalized':
      prompt += `Type: Personalized recommendations based on user history and preferences.\n`;
      if (context.recentOrders?.length) {
        prompt += `Recent orders: ${JSON.stringify(context.recentOrders)}\n`;
      }
      if (context.preferences?.length) {
        prompt += `User preferences: ${context.preferences.join(', ')}\n`;
      }
      break;
      
    case 'similar':
      prompt += `Type: Products similar to product ID: ${productId}\n`;
      prompt += `Find products with similar features, category, or use cases.\n`;
      break;
      
    case 'trending':
      prompt += `Type: Trending and popular products\n`;
      prompt += `Focus on currently popular items and seasonal trends.\n`;
      break;
      
    case 'category':
      prompt += `Type: Category-based recommendations for category: ${categoryId}\n`;
      prompt += `Show best products in this category.\n`;
      break;
      
    case 'cart_based':
      prompt += `Type: Recommendations based on current cart items\n`;
      if (context.currentCart?.length) {
        prompt += `Current cart: ${JSON.stringify(context.currentCart)}\n`;
      }
      prompt += `Suggest complementary or frequently bought together items.\n`;
      break;
  }
  
  if (context.location) {
    prompt += `User location: ${context.location}\n`;
  }
  
  if (context.budget) {
    prompt += `Budget consideration: ₹${context.budget}\n`;
  }
  
  prompt += `\nPlease use the get_product_recommendations function to fetch relevant products.`;
  
  return prompt;
}

// Process recommendation results from function calls
function processRecommendationResults(data: any, type: string, limit: number): ProductRecommendation[] {
  if (!Array.isArray(data)) {
    return [];
  }
  
  return data.slice(0, limit).map((item: any, index: number) => ({
    product_id: item.id || `prod_${index}`,
    name: item.name || item.title || 'Product',
    description: item.description || 'Quality product available on Dukaaon',
    price: item.price || item.cost || 100,
    category: item.category || 'General',
    subcategory: item.subcategory,
    image_url: item.image_url || item.image,
    rating: item.rating || 4.0,
    availability: item.availability !== false,
    confidence_score: calculateItemConfidence(item, type, index),
    reason: generateRecommendationReason(item, type),
    tags: item.tags || [],
    discount: item.discount ? {
      percentage: item.discount.percentage || 0,
      original_price: item.discount.original_price || item.price
    } : undefined
  }));
}

// Process search results as recommendations
function processSearchResults(data: any, type: string, limit: number): ProductRecommendation[] {
  if (!Array.isArray(data)) {
    return [];
  }
  
  return data.slice(0, limit).map((item: any, index: number) => ({
    product_id: item.id || `search_${index}`,
    name: item.name || item.title || 'Product',
    description: item.description || 'Quality product found through search',
    price: item.price || 100,
    category: item.category || 'General',
    subcategory: item.subcategory,
    image_url: item.image_url || item.image,
    rating: item.rating || 4.0,
    availability: item.availability !== false,
    confidence_score: calculateItemConfidence(item, type, index),
    reason: `Found through ${type} search algorithm`,
    tags: item.tags || []
  }));
}

// Generate fallback recommendations when AI functions fail
function generateFallbackRecommendations(type: string, context: any, limit: number): ProductRecommendation[] {
  const fallbackProducts = [
    {
      product_id: 'rice_001',
      name: 'Basmati Rice 5kg',
      description: 'Premium quality basmati rice, perfect for daily cooking',
      price: 450,
      category: 'Groceries',
      subcategory: 'Rice & Grains'
    },
    {
      product_id: 'oil_001',
      name: 'Sunflower Oil 1L',
      description: 'Pure sunflower cooking oil for healthy cooking',
      price: 120,
      category: 'Groceries',
      subcategory: 'Cooking Oil'
    },
    {
      product_id: 'dal_001',
      name: 'Toor Dal 1kg',
      description: 'Fresh toor dal, rich in protein and nutrients',
      price: 180,
      category: 'Groceries',
      subcategory: 'Pulses & Lentils'
    },
    {
      product_id: 'milk_001',
      name: 'Fresh Milk 1L',
      description: 'Farm fresh full cream milk',
      price: 60,
      category: 'Dairy',
      subcategory: 'Milk'
    },
    {
      product_id: 'bread_001',
      name: 'Whole Wheat Bread',
      description: 'Soft and nutritious whole wheat bread',
      price: 35,
      category: 'Bakery',
      subcategory: 'Bread'
    }
  ];
  
  return fallbackProducts.slice(0, limit).map((product, index) => ({
    ...product,
    image_url: `/images/products/${product.product_id}.jpg`,
    rating: 4.0 + (Math.random() * 1),
    availability: true,
    confidence_score: 0.7 - (index * 0.1),
    reason: `Popular ${type} recommendation`,
    tags: ['popular', 'quality', 'fresh']
  }));
}

// Calculate confidence score for recommendations
function calculateConfidenceScore(recommendations: ProductRecommendation[], type: string, context: any): number {
  if (recommendations.length === 0) {
    return 0;
  }
  
  let baseConfidence = 0.5;
  
  // Adjust confidence based on type
  switch (type) {
    case 'personalized':
      baseConfidence = context.recentOrders?.length ? 0.8 : 0.6;
      break;
    case 'similar':
      baseConfidence = 0.75;
      break;
    case 'trending':
      baseConfidence = 0.7;
      break;
    case 'category':
      baseConfidence = 0.65;
      break;
    case 'cart_based':
      baseConfidence = context.currentCart?.length ? 0.8 : 0.5;
      break;
  }
  
  // Average individual confidence scores
  const avgItemConfidence = recommendations.reduce((sum, item) => sum + item.confidence_score, 0) / recommendations.length;
  
  return Math.min(0.95, (baseConfidence + avgItemConfidence) / 2);
}

// Calculate confidence for individual items
function calculateItemConfidence(item: any, type: string, index: number): number {
  let confidence = 0.8 - (index * 0.05); // Decrease confidence for lower ranked items
  
  // Adjust based on item properties
  if (item.rating && item.rating > 4.0) {
    confidence += 0.1;
  }
  
  if (item.availability === false) {
    confidence -= 0.2;
  }
  
  if (item.discount) {
    confidence += 0.05;
  }
  
  return Math.max(0.1, Math.min(0.95, confidence));
}

// Generate reason for recommendation
function generateRecommendationReason(item: any, type: string): string {
  const reasons: Record<string, string> = {
    personalized: 'Based on your purchase history and preferences',
    similar: 'Similar to products you viewed',
    trending: 'Popular choice among customers',
    category: 'Top rated in this category',
    cart_based: 'Frequently bought together with your cart items'
  };
  
  return reasons[type] || 'Recommended for you';
}

// Generate suggestions for user actions
function generateRecommendationSuggestions(type: string, recommendations: ProductRecommendation[]): string[] {
  const suggestions: string[] = [];
  
  if (recommendations.length > 0) {
    suggestions.push(`View ${recommendations[0].name}`);
    suggestions.push('Add to cart');
    suggestions.push('Compare products');
  }
  
  switch (type) {
    case 'personalized':
      suggestions.push('Update preferences');
      suggestions.push('View order history');
      break;
    case 'similar':
      suggestions.push('View product details');
      suggestions.push('See more similar items');
      break;
    case 'trending':
      suggestions.push('View trending categories');
      suggestions.push('See weekly deals');
      break;
    case 'category':
      suggestions.push('Browse category');
      suggestions.push('Filter by price');
      break;
    case 'cart_based':
      suggestions.push('View cart');
      suggestions.push('Complete purchase');
      break;
  }
  
  return suggestions.slice(0, 3);
}