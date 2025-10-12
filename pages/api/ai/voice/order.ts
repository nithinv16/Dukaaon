// Voice Ordering API Endpoint
import { NextApiRequest, NextApiResponse } from 'next';
import { voiceService, VoiceOrderingSession } from '../../../../services/aiAgent/voiceService';
import { bedrockAIService } from '../../../../services/aiAgent/bedrockAIService';
import formidable from 'formidable';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: false,
  },
};

export interface VoiceOrderRequest {
  action: 'start' | 'process' | 'confirm' | 'cancel';
  sessionId?: string;
  userId: string;
  language?: string;
  audioFile?: any;
}

export interface VoiceOrderResponse {
  sessionId: string;
  transcript?: string;
  aiResponse: string;
  audioResponse?: string;
  session: VoiceOrderingSession | null;
  orderSummary?: {
    items: any[];
    totalAmount: number;
    estimatedDelivery?: string;
  };
  nextAction?: 'continue_listening' | 'confirm_order' | 'add_more_items' | 'complete';
  suggestions?: string[];
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<VoiceOrderResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      sessionId: '',
      aiResponse: '',
      session: null,
      error: 'Method not allowed'
    });
  }

  try {
    let action: string;
    let sessionId: string | undefined;
    let userId: string;
    let language: string;
    let audioFile: any;

    // Handle different content types
    if (req.headers['content-type']?.includes('multipart/form-data')) {
      // Parse form data for audio uploads
      const form = formidable({
        maxFileSize: 10 * 1024 * 1024, // 10MB limit
        keepExtensions: true,
      });

      const [fields, files] = await form.parse(req);
      
      action = Array.isArray(fields.action) ? fields.action[0] : fields.action || 'process';
      sessionId = Array.isArray(fields.sessionId) ? fields.sessionId[0] : fields.sessionId;
      userId = Array.isArray(fields.userId) ? fields.userId[0] : fields.userId;
      language = Array.isArray(fields.language) ? fields.language[0] : fields.language || 'en-US';
      audioFile = Array.isArray(files.audio) ? files.audio[0] : files.audio;
    } else {
      // Parse JSON body for non-audio requests
      const body = req.body;
      action = body.action || 'start';
      sessionId = body.sessionId;
      userId = body.userId;
      language = body.language || 'en-US';
    }

    if (!userId) {
      return res.status(400).json({
        sessionId: '',
        aiResponse: '',
        session: null,
        error: 'UserId is required'
      });
    }

    let session: VoiceOrderingSession | null = null;
    let transcript = '';
    let aiResponse = '';
    let audioResponseUrl: string | undefined;

    switch (action) {
      case 'start':
        // Start new voice ordering session
        session = await voiceService.startVoiceOrderingSession(userId, language);
        aiResponse = getWelcomeMessage(language);
        
        // Generate welcome audio
        try {
          const textToSpeechResult = await voiceService.textToSpeech({
            text: aiResponse,
            language
          });
          audioResponseUrl = textToSpeechResult.audioUrl;
        } catch (error) {
          console.error('TTS error:', error);
        }
        
        break;

      case 'process':
        if (!sessionId || !audioFile) {
          return res.status(400).json({
            sessionId: sessionId || '',
            aiResponse: '',
            session: null,
            error: 'SessionId and audio file are required for processing'
          });
        }

        session = voiceService.getVoiceOrderingSession(sessionId);
        if (!session) {
          return res.status(404).json({
            sessionId,
            aiResponse: '',
            session: null,
            error: 'Voice ordering session not found'
          });
        }

        // Process audio to text
        const audioBuffer = fs.readFileSync(audioFile.filepath);
        const audioBlob = new Blob([audioBuffer], { type: audioFile.mimetype || 'audio/webm' });

        const speechResult = await voiceService.speechToText({
          audioBlob,
          language: session.language,
          userId
        });

        transcript = speechResult.transcript;

        if (!transcript) {
          aiResponse = "I'm sorry, I couldn't understand what you said. Could you please repeat that?";
        } else {
          // Process voice command with AI
          const orderResult = await processVoiceOrderCommand(transcript, session);
          aiResponse = orderResult.response;
          
          // Update session
          if (orderResult.sessionUpdate) {
            session = await voiceService.updateVoiceOrderingSession(sessionId, orderResult.sessionUpdate);
          }
        }

        // Generate audio response
        try {
          const textToSpeechResult = await voiceService.textToSpeech({
            text: aiResponse,
            language: session.language
          });
          audioResponseUrl = textToSpeechResult.audioUrl;
        } catch (error) {
          console.error('TTS error:', error);
        }

        // Clean up temp file
        try {
          fs.unlinkSync(audioFile.filepath);
        } catch (error) {
          console.error('Error cleaning up temp file:', error);
        }
        
        break;

      case 'confirm':
        if (!sessionId) {
          return res.status(400).json({
            sessionId: '',
            aiResponse: '',
            session: null,
            error: 'SessionId is required for confirmation'
          });
        }

        session = voiceService.getVoiceOrderingSession(sessionId);
        if (!session) {
          return res.status(404).json({
            sessionId,
            aiResponse: '',
            session: null,
            error: 'Voice ordering session not found'
          });
        }

        // Process order confirmation
        const confirmationResult = await confirmVoiceOrder(session);
        aiResponse = confirmationResult.response;
        
        if (confirmationResult.success) {
          await voiceService.endVoiceOrderingSession(sessionId);
          session.isActive = false;
        }
        
        break;

      case 'cancel':
        if (sessionId) {
          await voiceService.endVoiceOrderingSession(sessionId);
          session = voiceService.getVoiceOrderingSession(sessionId);
        }
        aiResponse = "Your voice ordering session has been cancelled. Thank you!";
        break;

      default:
        return res.status(400).json({
          sessionId: sessionId || '',
          aiResponse: '',
          session: null,
          error: 'Invalid action'
        });
    }

    // Determine next action
    const nextAction = determineNextAction(session, action);
    
    // Generate suggestions
    const suggestions = generateOrderingSuggestions(session, transcript, action);

    // Prepare order summary
    const orderSummary = session ? {
      items: session.context.cart,
      totalAmount: session.context.totalAmount,
      estimatedDelivery: calculateEstimatedDelivery()
    } : undefined;

    return res.status(200).json({
      sessionId: session?.id || sessionId || '',
      transcript,
      aiResponse,
      audioResponse: audioResponseUrl,
      session,
      orderSummary,
      nextAction,
      suggestions
    });

  } catch (error) {
    console.error('Voice Order API Error:', error);
    
    return res.status(500).json({
      sessionId: '',
      aiResponse: 'Sorry, there was an error processing your voice order. Please try again.',
      session: null,
      error: error.message || 'Internal server error'
    });
  }
}

// Process voice order command with AI
async function processVoiceOrderCommand(transcript: string, session: VoiceOrderingSession) {
  try {
    // Create AI messages with context
    const messages = [
      {
        role: 'system' as const,
        content: `You are processing a voice order. Current cart has ${session.context.cart.length} items with total ₹${session.context.totalAmount}. Help the user add products, modify quantities, or complete their order.`,
        timestamp: new Date()
      },
      {
        role: 'user' as const,
        content: `Voice command: "${transcript}"`,
        timestamp: new Date()
      }
    ];

    const aiResponse = await bedrockAIService.chat(messages, session.userId);

    // Process function calls to update cart
    let sessionUpdate: Partial<VoiceOrderingSession> = {};
    
    if (aiResponse.function_calls) {
      for (const functionCall of aiResponse.function_calls) {
        if (functionCall.name === 'add_to_cart') {
          // Add item to session cart
          const newItem = {
            product_id: functionCall.parameters.product_id,
            quantity: functionCall.parameters.quantity || 1,
            added_at: new Date()
          };
          
          session.context.cart.push(newItem);
          session.context.totalAmount += calculateItemPrice(newItem);
          
          sessionUpdate = {
            context: session.context,
            lastActivity: new Date()
          };
        }
      }
    }

    return {
      response: aiResponse.content,
      sessionUpdate: Object.keys(sessionUpdate).length > 0 ? sessionUpdate : undefined
    };
  } catch (error) {
    console.error('Error processing voice order command:', error);
    return {
      response: "I'm sorry, I had trouble processing that command. Could you please try again?",
      sessionUpdate: undefined
    };
  }
}

// Confirm voice order
async function confirmVoiceOrder(session: VoiceOrderingSession) {
  try {
    if (session.context.cart.length === 0) {
      return {
        success: false,
        response: "Your cart is empty. Please add some items before confirming your order."
      };
    }

    // Here you would integrate with your order processing system
    // For now, we'll simulate order creation
    const orderId = `VO-${Date.now()}`;
    
    // You would typically:
    // 1. Create order in database
    // 2. Process payment
    // 3. Send confirmation notifications
    // 4. Update inventory
    
    const response = `Great! Your order #${orderId} has been confirmed. You have ${session.context.cart.length} items totaling ₹${session.context.totalAmount}. You'll receive a confirmation message shortly.`;
    
    return {
      success: true,
      response,
      orderId
    };
  } catch (error) {
    console.error('Error confirming voice order:', error);
    return {
      success: false,
      response: "Sorry, there was an error confirming your order. Please try again or contact support."
    };
  }
}

// Get welcome message based on language
function getWelcomeMessage(language: string): string {
  const messages: Record<string, string> = {
    'en-US': "Hello! I'm Dai, your AI ordering assistant. I can help you find and order products using voice commands. What would you like to order today?",
    'hi-IN': "नमस्ते! मैं दाई हूं, आपका AI ऑर्डरिंग असिस्टेंट। मैं आपको वॉइस कमांड का उपयोग करके उत्पाद खोजने और ऑर्डर करने में मदद कर सकता हूं। आज आप क्या ऑर्डर करना चाहेंगे?",
    'ta-IN': "வணக்கம்! நான் தாய், உங்கள் AI ஆர்டரிங் உதவியாளர். குரல் கட்டளைகளைப் பயன்படுத்தி தயாரிப்புகளைக் கண்டுபிடித்து ஆர்டர் செய்ய நான் உங்களுக்கு உதவ முடியும். இன்று நீங்கள் என்ன ஆர்டர் செய்ய விரும்புகிறீர்கள்?",
    'te-IN': "నమస్కారం! నేను దాయి, మీ AI ఆర్డరింగ్ అసిస్టెంట్. వాయిస్ కమాండ్లను ఉపయోగించి ఉత్పత్తులను కనుగొని ఆర్డర్ చేయడంలో నేను మీకు సహాయం చేయగలను. ఈరోజు మీరు ఏమి ఆర్డర్ చేయాలనుకుంటున్నారు?"
  };
  
  return messages[language] || messages['en-US'];
}

// Determine next action based on session state
function determineNextAction(session: VoiceOrderingSession | null, currentAction: string): string {
  if (!session || !session.isActive) {
    return 'complete';
  }
  
  if (currentAction === 'start') {
    return 'continue_listening';
  }
  
  if (session.context.cart.length === 0) {
    return 'add_more_items';
  }
  
  if (session.context.cart.length > 0 && session.context.currentStep === 'processing') {
    return 'confirm_order';
  }
  
  return 'continue_listening';
}

// Generate contextual suggestions
function generateOrderingSuggestions(session: VoiceOrderingSession | null, transcript: string, action: string): string[] {
  const suggestions: string[] = [];
  
  if (!session) {
    return ['Start voice ordering', 'Browse products', 'View cart'];
  }
  
  if (action === 'start') {
    suggestions.push('Add rice to cart');
    suggestions.push('Show me vegetables');
    suggestions.push('I need cooking oil');
  } else if (session.context.cart.length === 0) {
    suggestions.push('Add products to cart');
    suggestions.push('Search for items');
    suggestions.push('Show popular products');
  } else {
    suggestions.push('Add more items');
    suggestions.push('Review my cart');
    suggestions.push('Confirm order');
  }
  
  return suggestions.slice(0, 3);
}

// Calculate item price (placeholder)
function calculateItemPrice(item: any): number {
  // This would typically fetch the actual product price from database
  return 100; // Placeholder price
}

// Calculate estimated delivery
function calculateEstimatedDelivery(): string {
  const deliveryDate = new Date();
  deliveryDate.setDate(deliveryDate.getDate() + 2); // 2 days from now
  return deliveryDate.toLocaleDateString();
}