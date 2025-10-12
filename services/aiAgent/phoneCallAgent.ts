// services/aiAgent/phoneCallAgent.ts
import { supabase } from '../supabase/client';
import OpenAI from 'openai';
import * as sdk from 'microsoft-cognitiveservices-speech-sdk';

export interface CallSession {
  sessionId: string;
  callSid: string;
  orderId?: number;
  callerPhone: string;
  callerType: 'retailer' | 'wholesaler';
  conversationState: {
    currentIntent?: string;
    extractedEntities?: Record<string, any>;
    currentOrder?: {
      items: Array<{
        productName: string;
        quantity: number;
        unitPrice?: number;
      }>;
      totalAmount?: number;
      deliveryAddress?: string;
      specialInstructions?: string;
    };
    confirmationPending?: boolean;
    lastUserInput?: string;
  };
  startedAt: Date;
  lastActivityAt: Date;
}

export interface VoiceProcessingResult {
  success: boolean;
  transcript: string;
  intent: string;
  entities: Record<string, any>;
  aiResponse: string;
  actions: string[];
  nextStep?: string;
  error?: string;
}

export interface OrderConfirmationResult {
  success: boolean;
  orderId?: number;
  message: string;
  actions: string[];
}

export class PhoneCallAIAgent {
  private openai: OpenAI;
  private speechConfig: sdk.SpeechConfig;
  private activeSessions: Map<string, CallSession> = new Map();

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    });

    this.speechConfig = sdk.SpeechConfig.fromSubscription(
      process.env.AZURE_SPEECH_KEY!,
      process.env.AZURE_SPEECH_REGION!
    );
    this.speechConfig.speechRecognitionLanguage = 'en-US';
    this.speechConfig.speechSynthesisLanguage = 'en-US';
    this.speechConfig.speechSynthesisVoiceName = 'en-US-AriaNeural';
  }

  async handleIncomingCall(callData: {
    callSid: string;
    from: string;
    to: string;
  }): Promise<CallSession> {
    const sessionId = `call_${callData.callSid}_${Date.now()}`;
    
    // Determine caller type based on phone number
    const callerType = await this.determineCallerType(callData.from);
    
    const session: CallSession = {
      sessionId,
      callSid: callData.callSid,
      callerPhone: callData.from,
      callerType,
      conversationState: {},
      startedAt: new Date(),
      lastActivityAt: new Date()
    };

    this.activeSessions.set(sessionId, session);

    // Log call session to database
    await supabase.from('phone_call_sessions').insert({
      session_id: sessionId,
      caller_phone: callData.from,
      caller_type: callerType,
      call_sid: callData.callSid,
      call_status: 'connected',
      started_at: session.startedAt.toISOString()
    });

    // Create AI conversation session
    await supabase.from('ai_conversation_sessions').insert({
      session_id: sessionId,
      user_type: callerType,
      communication_channel: 'voice_call',
      phone_number: callData.from,
      session_status: 'active',
      started_at: session.startedAt.toISOString(),
      last_activity_at: session.lastActivityAt.toISOString()
    });

    return session;
  }

  async processVoiceInput(
    sessionId: string,
    audioData: string | Buffer
  ): Promise<VoiceProcessingResult> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return {
        success: false,
        transcript: '',
        intent: '',
        entities: {},
        aiResponse: 'Session not found',
        actions: [],
        error: 'Invalid session ID'
      };
    }

    try {
      // Convert speech to text
      const transcript = await this.speechToText(audioData);
      
      if (!transcript) {
        return {
          success: false,
          transcript: '',
          intent: '',
          entities: {},
          aiResponse: 'I couldn\'t understand what you said. Could you please repeat?',
          actions: ['request_repeat']
        };
      }

      // Process with AI to extract intent and entities
      const aiAnalysis = await this.analyzeIntent(transcript, session);
      
      // Update conversation state
      session.conversationState.lastUserInput = transcript;
      session.lastActivityAt = new Date();
      
      // Generate appropriate response and actions
      const response = await this.generateResponse(aiAnalysis, session);
      
      // Log conversation turn
      await this.logConversationTurn(sessionId, {
        speaker: 'user',
        content: transcript,
        intent: aiAnalysis.intent,
        entities: aiAnalysis.entities
      });
      
      await this.logConversationTurn(sessionId, {
        speaker: 'ai_agent',
        content: response.aiResponse,
        actions: response.actions
      });

      // Update session in database
      await this.updateSessionActivity(sessionId);

      return {
        success: true,
        transcript,
        intent: aiAnalysis.intent,
        entities: aiAnalysis.entities,
        aiResponse: response.aiResponse,
        actions: response.actions,
        nextStep: response.nextStep
      };
    } catch (error) {
      console.error('Error processing voice input:', error);
      return {
        success: false,
        transcript: '',
        intent: '',
        entities: {},
        aiResponse: 'I\'m experiencing technical difficulties. Please try again.',
        actions: ['technical_error'],
        error: error.message
      };
    }
  }

  async confirmOrder(
    sessionId: string,
    orderId: number
  ): Promise<OrderConfirmationResult> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return {
        success: false,
        message: 'Session not found',
        actions: ['session_error']
      };
    }

    try {
      // Update order status to confirmed
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          status: 'confirmed',
          confirmation_method: 'phone_call',
          last_communication_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (updateError) {
        throw new Error(`Failed to update order: ${updateError.message}`);
      }

      // Mark escalation as resolved
      await supabase
        .from('order_escalations')
        .update({
          is_resolved: true,
          resolution_method: 'phone_call',
          resolved_at: new Date().toISOString()
        })
        .eq('order_id', orderId);

      // Update phone call session
      await supabase
        .from('phone_call_sessions')
        .update({
          order_id: orderId,
          order_modified: true,
          ai_actions_taken: ['order_confirmed']
        })
        .eq('session_id', sessionId);

      return {
        success: true,
        orderId,
        message: `Order #${orderId} has been confirmed successfully. Thank you!`,
        actions: ['order_confirmed', 'end_call']
      };
    } catch (error) {
      console.error('Error confirming order:', error);
      return {
        success: false,
        message: 'There was an error confirming your order. Please try again.',
        actions: ['confirmation_error']
      };
    }
  }

  async placeNewOrder(
    sessionId: string,
    orderData: {
      items: Array<{
        productName: string;
        quantity: number;
      }>;
      deliveryAddress?: string;
      specialInstructions?: string;
    }
  ): Promise<{
    success: boolean;
    orderId?: number;
    totalAmount?: number;
    message: string;
    actions: string[];
  }> {
    const session = this.activeSessions.get(sessionId);
    if (!session || session.callerType !== 'retailer') {
      return {
        success: false,
        message: 'Invalid session or unauthorized to place orders',
        actions: ['authorization_error']
      };
    }

    try {
      // Get user ID from phone number
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name')
        .eq('phone', session.callerPhone)
        .single();

      if (userError || !userData) {
        return {
          success: false,
          message: 'User not found. Please register first.',
          actions: ['user_not_found']
        };
      }

      // Process each item and calculate total
      let totalAmount = 0;
      const processedItems = [];

      for (const item of orderData.items) {
        const productResult = await this.findProduct(item.productName);
        
        if (!productResult.found) {
          return {
            success: false,
            message: `Product "${item.productName}" not found. Please specify a different product.`,
            actions: ['product_not_found']
          };
        }

        const itemTotal = productResult.price * item.quantity;
        totalAmount += itemTotal;
        
        processedItems.push({
          product_id: productResult.id,
          quantity: item.quantity,
          unit_price: productResult.price,
          total_price: itemTotal
        });
      }

      // Calculate delivery cost
      const deliveryCost = await this.calculateDeliveryCost(
        orderData.deliveryAddress || userData.address
      );
      totalAmount += deliveryCost;

      // Create order
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: userData.id,
          total_amount: totalAmount,
          delivery_cost: deliveryCost,
          delivery_address: orderData.deliveryAddress,
          special_instructions: orderData.specialInstructions,
          status: 'pending',
          is_ai_order: true,
          retailer_phone: session.callerPhone
        })
        .select()
        .single();

      if (orderError) {
        throw new Error(`Failed to create order: ${orderError.message}`);
      }

      // Create order items
      const orderItems = processedItems.map(item => ({
        ...item,
        order_id: orderData.id
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) {
        throw new Error(`Failed to create order items: ${itemsError.message}`);
      }

      // Update session with order ID
      session.orderId = orderData.id;
      session.conversationState.currentOrder = {
        items: orderData.items.map(item => ({
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: processedItems.find(p => p.product_id === item.product_id)?.unit_price
        })),
        totalAmount,
        deliveryAddress: orderData.deliveryAddress,
        specialInstructions: orderData.specialInstructions
      };

      // Update phone call session
      await supabase
        .from('phone_call_sessions')
        .update({
          order_id: orderData.id,
          order_modified: true,
          ai_actions_taken: ['order_created']
        })
        .eq('session_id', sessionId);

      return {
        success: true,
        orderId: orderData.id,
        totalAmount,
        message: `Order #${orderData.id} created successfully! Total amount: ₹${totalAmount} (including ₹${deliveryCost} delivery). Would you like to confirm this order?`,
        actions: ['order_created', 'request_confirmation']
      };
    } catch (error) {
      console.error('Error placing order:', error);
      return {
        success: false,
        message: 'There was an error placing your order. Please try again.',
        actions: ['order_creation_error']
      };
    }
  }

  async checkInventory(
    productName: string
  ): Promise<{
    available: boolean;
    stock: number;
    price: number;
    message: string;
  }> {
    try {
      const productResult = await this.findProduct(productName);
      
      if (!productResult.found) {
        return {
          available: false,
          stock: 0,
          price: 0,
          message: `Product "${productName}" is not available in our inventory.`
        };
      }

      const isAvailable = productResult.stock > 0;
      
      return {
        available: isAvailable,
        stock: productResult.stock,
        price: productResult.price,
        message: isAvailable 
          ? `${productResult.name} is available. Stock: ${productResult.stock} units, Price: ₹${productResult.price} per unit.`
          : `${productResult.name} is currently out of stock.`
      };
    } catch (error) {
      console.error('Error checking inventory:', error);
      return {
        available: false,
        stock: 0,
        price: 0,
        message: 'Unable to check inventory at the moment. Please try again.'
      };
    }
  }

  async endCall(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    // Update call session as completed
    await supabase
      .from('phone_call_sessions')
      .update({
        call_status: 'completed',
        ended_at: new Date().toISOString(),
        call_duration: Math.floor((Date.now() - session.startedAt.getTime()) / 1000)
      })
      .eq('session_id', sessionId);

    // Update AI conversation session
    await supabase
      .from('ai_conversation_sessions')
      .update({
        session_status: 'completed',
        ended_at: new Date().toISOString()
      })
      .eq('session_id', sessionId);

    // Remove from active sessions
    this.activeSessions.delete(sessionId);
  }

  private async speechToText(audioData: string | Buffer): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        // Create audio config from buffer or stream
        let audioConfig: sdk.AudioConfig;
        
        if (typeof audioData === 'string') {
          // Assume it's a file path or URL
          audioConfig = sdk.AudioConfig.fromWavFileInput(audioData);
        } else {
          // Handle buffer data
          const pushStream = sdk.AudioInputStream.createPushStream();
          pushStream.write(audioData);
          pushStream.close();
          audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);
        }

        const recognizer = new sdk.SpeechRecognizer(this.speechConfig, audioConfig);
        
        recognizer.recognizeOnceAsync(
          (result) => {
            if (result.reason === sdk.ResultReason.RecognizedSpeech) {
              resolve(result.text);
            } else {
              resolve('');
            }
            recognizer.close();
          },
          (error) => {
            console.error('Speech recognition error:', error);
            recognizer.close();
            reject(error);
          }
        );
      } catch (error) {
        reject(error);
      }
    });
  }

  private async analyzeIntent(
    transcript: string,
    session: CallSession
  ): Promise<{
    intent: string;
    entities: Record<string, any>;
    confidence: number;
  }> {
    const systemPrompt = `You are an AI assistant for a wholesale ordering system. Analyze the user's input and extract:
1. Intent (order_confirmation, place_order, check_inventory, modify_order, cancel_order, general_inquiry)
2. Entities (product names, quantities, addresses, etc.)
3. Confidence score (0-1)

User type: ${session.callerType}
Conversation context: ${JSON.stringify(session.conversationState)}

Respond in JSON format:
{
  "intent": "intent_name",
  "entities": {
    "products": [{"name": "product_name", "quantity": number}],
    "address": "delivery_address",
    "confirmation": boolean
  },
  "confidence": 0.95
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: transcript }
        ],
        temperature: 0.1,
        max_tokens: 500
      });

      const analysis = JSON.parse(response.choices[0].message.content || '{}');
      return {
        intent: analysis.intent || 'general_inquiry',
        entities: analysis.entities || {},
        confidence: analysis.confidence || 0.5
      };
    } catch (error) {
      console.error('Error analyzing intent:', error);
      return {
        intent: 'general_inquiry',
        entities: {},
        confidence: 0.1
      };
    }
  }

  private async generateResponse(
    analysis: { intent: string; entities: Record<string, any>; confidence: number },
    session: CallSession
  ): Promise<{
    aiResponse: string;
    actions: string[];
    nextStep?: string;
  }> {
    const { intent, entities } = analysis;
    
    switch (intent) {
      case 'order_confirmation':
        if (session.orderId) {
          const confirmationResult = await this.confirmOrder(session.sessionId, session.orderId);
          return {
            aiResponse: confirmationResult.message,
            actions: confirmationResult.actions
          };
        } else {
          // Find pending order for wholesaler
          const pendingOrder = await this.findPendingOrder(session.callerPhone);
          if (pendingOrder) {
            const confirmationResult = await this.confirmOrder(session.sessionId, pendingOrder.id);
            return {
              aiResponse: confirmationResult.message,
              actions: confirmationResult.actions
            };
          }
        }
        break;
        
      case 'place_order':
        if (session.callerType === 'retailer' && entities.products) {
          const orderResult = await this.placeNewOrder(session.sessionId, {
            items: entities.products,
            deliveryAddress: entities.address,
            specialInstructions: entities.instructions
          });
          return {
            aiResponse: orderResult.message,
            actions: orderResult.actions
          };
        }
        break;
        
      case 'check_inventory':
        if (entities.products && entities.products.length > 0) {
          const product = entities.products[0];
          const inventoryResult = await this.checkInventory(product.name);
          return {
            aiResponse: inventoryResult.message,
            actions: ['inventory_checked']
          };
        }
        break;
    }

    // Default response
    return {
      aiResponse: this.getDefaultResponse(intent, session.callerType),
      actions: ['general_response']
    };
  }

  private getDefaultResponse(intent: string, callerType: string): string {
    const responses = {
      retailer: {
        general_inquiry: "Hello! I'm your AI assistant. I can help you place orders, check inventory, and answer questions about products. What would you like to do today?",
        place_order: "I'd be happy to help you place an order. Please tell me which products you need and the quantities.",
        check_inventory: "I can check our current inventory for you. Which product would you like me to check?"
      },
      wholesaler: {
        general_inquiry: "Hello! I'm calling about a pending order that needs your confirmation. Would you like me to provide the order details?",
        order_confirmation: "Thank you for taking my call. I have an order that requires your confirmation. Shall I read the details?"
      }
    };

    return responses[callerType]?.[intent] || responses[callerType]?.general_inquiry || "How can I help you today?";
  }

  private async determineCallerType(phoneNumber: string): Promise<'retailer' | 'wholesaler'> {
    // Check if it's a registered retailer
    const { data: retailer } = await supabase
      .from('users')
      .select('id')
      .eq('phone', phoneNumber)
      .eq('user_type', 'retailer')
      .single();

    if (retailer) return 'retailer';

    // Check if it's a wholesaler with pending orders
    const { data: orders } = await supabase
      .from('orders')
      .select('id')
      .eq('wholesaler_phone', phoneNumber)
      .eq('status', 'pending')
      .limit(1);

    return orders && orders.length > 0 ? 'wholesaler' : 'retailer';
  }

  private async findProduct(productName: string): Promise<{
    found: boolean;
    id?: number;
    name?: string;
    price?: number;
    stock?: number;
  }> {
    // Use fuzzy matching to find products
    const { data: products, error } = await supabase
      .rpc('search_products_fuzzy', {
        search_term: productName,
        similarity_threshold: 0.3
      });

    if (error || !products || products.length === 0) {
      return { found: false };
    }

    const product = products[0];
    return {
      found: true,
      id: product.id,
      name: product.name,
      price: product.price,
      stock: product.stock_quantity
    };
  }

  private async findPendingOrder(wholesalerPhone: string): Promise<{ id: number } | null> {
    const { data: orders, error } = await supabase
      .from('orders')
      .select('id')
      .eq('wholesaler_phone', wholesalerPhone)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error || !orders || orders.length === 0) {
      return null;
    }

    return orders[0];
  }

  private async calculateDeliveryCost(address: string): Promise<number> {
    // Simple delivery cost calculation
    // In a real implementation, this would integrate with delivery services
    const baseDeliveryCost = 50; // ₹50 base cost
    const distanceMultiplier = 1; // Would be calculated based on actual distance
    
    return baseDeliveryCost * distanceMultiplier;
  }

  private async logConversationTurn(
    sessionId: string,
    turnData: {
      speaker: 'user' | 'ai_agent';
      content: string;
      intent?: string;
      entities?: Record<string, any>;
      actions?: string[];
    }
  ): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    // Get current turn number
    const { data: existingTurns } = await supabase
      .from('conversation_turns')
      .select('turn_number')
      .eq('session_id', sessionId)
      .order('turn_number', { ascending: false })
      .limit(1);

    const turnNumber = existingTurns && existingTurns.length > 0 
      ? existingTurns[0].turn_number + 1 
      : 1;

    await supabase.from('conversation_turns').insert({
      session_id: sessionId,
      turn_number: turnNumber,
      speaker: turnData.speaker,
      content: turnData.content,
      intent_detected: turnData.intent,
      entities_extracted: turnData.entities,
      actions_performed: turnData.actions
    });
  }

  private async updateSessionActivity(sessionId: string): Promise<void> {
    await supabase
      .from('ai_conversation_sessions')
      .update({
        last_activity_at: new Date().toISOString()
      })
      .eq('session_id', sessionId);
  }
}

export default PhoneCallAIAgent;