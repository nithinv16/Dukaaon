// Voice Search API Endpoint
import { NextApiRequest, NextApiResponse } from 'next';
import { voiceService, VoiceSearchRequest } from '../../../../services/aiAgent/voiceService';
import { bedrockAIService } from '../../../../services/aiAgent/bedrockAIService';
import formidable from 'formidable';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: false, // Disable body parsing for file uploads
  },
};

export interface VoiceSearchResponse {
  transcript: string;
  searchResults: any[];
  aiResponse: string;
  audioResponse?: string;
  confidence: number;
  language: string;
  suggestions?: string[];
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<VoiceSearchResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      transcript: '',
      searchResults: [],
      aiResponse: '',
      confidence: 0,
      language: 'en-US',
      error: 'Method not allowed'
    });
  }

  try {
    // Parse form data (audio file + metadata)
    const form = formidable({
      maxFileSize: 10 * 1024 * 1024, // 10MB limit
      keepExtensions: true,
    });

    const [fields, files] = await form.parse(req);
    
    const userId = Array.isArray(fields.userId) ? fields.userId[0] : fields.userId;
    const language = Array.isArray(fields.language) ? fields.language[0] : fields.language || 'en-US';
    const audioFile = Array.isArray(files.audio) ? files.audio[0] : files.audio;

    if (!userId || !audioFile) {
      return res.status(400).json({
        transcript: '',
        searchResults: [],
        aiResponse: '',
        confidence: 0,
        language,
        error: 'UserId and audio file are required'
      });
    }

    // Convert file to blob
    const audioBuffer = fs.readFileSync(audioFile.filepath);
    const audioBlob = new Blob([audioBuffer], { type: audioFile.mimetype || 'audio/webm' });

    // Process speech to text
    const voiceSearchRequest: VoiceSearchRequest = {
      audioBlob,
      language,
      userId
    };

    const speechResult = await voiceService.speechToText(voiceSearchRequest);
    
    if (!speechResult.transcript) {
      return res.status(400).json({
        transcript: '',
        searchResults: [],
        aiResponse: 'Sorry, I could not understand what you said. Please try again.',
        confidence: 0,
        language,
        error: 'No transcript generated'
      });
    }

    // Use AI to process the transcript and search for products
    const aiMessages = [
      {
        role: 'user' as const,
        content: `Voice search query: "${speechResult.transcript}". Please search for relevant products and provide a helpful response.`,
        timestamp: new Date()
      }
    ];

    const aiResponse = await bedrockAIService.chat(aiMessages, userId);

    // Extract search results from function calls
    let searchResults: any[] = [];
    if (aiResponse.function_calls) {
      for (const functionCall of aiResponse.function_calls) {
        if (functionCall.name === 'search_products') {
          // The function should have been executed and results included
          // For now, we'll make a direct search call
          try {
            const searchParams = functionCall.parameters;
            searchResults = await performProductSearch(searchParams);
          } catch (error) {
            console.error('Search error:', error);
          }
        }
      }
    }

    // Generate audio response
    let audioResponseUrl: string | undefined;
    try {
      const textToSpeechResult = await voiceService.textToSpeech({
        text: aiResponse.content,
        language
      });
      audioResponseUrl = textToSpeechResult.audioUrl;
    } catch (error) {
      console.error('Text-to-speech error:', error);
      // Continue without audio response
    }

    // Generate suggestions
    const suggestions = generateVoiceSearchSuggestions(speechResult.transcript, searchResults);

    // Clean up temporary file
    try {
      fs.unlinkSync(audioFile.filepath);
    } catch (error) {
      console.error('Error cleaning up temp file:', error);
    }

    return res.status(200).json({
      transcript: speechResult.transcript,
      searchResults,
      aiResponse: aiResponse.content,
      audioResponse: audioResponseUrl,
      confidence: speechResult.confidence,
      language: speechResult.language,
      suggestions
    });

  } catch (error) {
    console.error('Voice Search API Error:', error);
    
    return res.status(500).json({
      transcript: '',
      searchResults: [],
      aiResponse: 'Sorry, there was an error processing your voice search. Please try again.',
      confidence: 0,
      language: 'en-US',
      error: error.message || 'Internal server error'
    });
  }
}

// Perform product search based on AI parameters
async function performProductSearch(searchParams: any): Promise<any[]> {
  try {
    const { supabase } = require('../../../../services/supabase/supabase');
    
    const { query, category, limit = 10, price_range } = searchParams;
    
    let queryBuilder = supabase
      .from('products')
      .select(`
        id, name, price, image_url, category, subcategory, 
        description, stock_available, unit, min_quantity,
        profiles!seller_id (
          business_details,
          seller_details (business_name)
        )
      `)
      .ilike('name', `%${query}%`)
      .limit(limit);

    if (category) {
      queryBuilder = queryBuilder.eq('category', category);
    }

    if (price_range) {
      if (price_range.min) queryBuilder = queryBuilder.gte('price', price_range.min);
      if (price_range.max) queryBuilder = queryBuilder.lte('price', price_range.max);
    }

    const { data, error } = await queryBuilder;
    
    if (error) {
      console.error('Product search error:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Product search error:', error);
    return [];
  }
}

// Generate contextual suggestions for voice search
function generateVoiceSearchSuggestions(transcript: string, searchResults: any[]): string[] {
  const suggestions: string[] = [];
  
  // Analyze transcript for intent
  const lowerTranscript = transcript.toLowerCase();
  
  if (lowerTranscript.includes('cheap') || lowerTranscript.includes('affordable')) {
    suggestions.push('Show me budget-friendly options');
    suggestions.push('Sort by lowest price');
  }
  
  if (lowerTranscript.includes('best') || lowerTranscript.includes('quality')) {
    suggestions.push('Show me premium products');
    suggestions.push('Filter by ratings');
  }
  
  if (lowerTranscript.includes('near') || lowerTranscript.includes('nearby')) {
    suggestions.push('Find sellers near me');
    suggestions.push('Check delivery options');
  }
  
  // Based on search results
  if (searchResults.length > 0) {
    const categories = [...new Set(searchResults.map(p => p.category))];
    if (categories.length > 1) {
      suggestions.push(`Filter by ${categories[0]}`);
    }
    
    suggestions.push('Add to cart');
    suggestions.push('Compare products');
  } else {
    suggestions.push('Try a different search term');
    suggestions.push('Browse categories');
    suggestions.push('Show popular products');
  }
  
  return suggestions.slice(0, 3);
}