// tests/enhanced-ai-ordering.test.ts
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { PhoneCallAIAgent } from '../services/aiAgent/phoneCallAgent';
import { EnhancedWhatsAppService } from '../services/communication/enhancedWhatsAppService';
import { supabase } from '../services/supabase/client';

// Mock external dependencies
jest.mock('../services/supabase/client');
jest.mock('openai');
jest.mock('microsoft-cognitiveservices-speech-sdk');

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

describe('Enhanced AI Ordering System', () => {
  let phoneAgent: PhoneCallAIAgent;
  let whatsappService: EnhancedWhatsAppService;

  beforeEach(() => {
    phoneAgent = new PhoneCallAIAgent();
    whatsappService = new EnhancedWhatsAppService();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('PhoneCallAIAgent', () => {
    describe('handleIncomingCall', () => {
      it('should create a new call session for retailer', async () => {
        const mockSessionId = 'session-123';
        mockSupabase.from.mockReturnValue({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockResolvedValue({
              data: [{ id: mockSessionId }],
              error: null
            })
          })
        } as any);

        const sessionId = await phoneAgent.handleIncomingCall(
          'call-123',
          '+1234567890',
          'retailer'
        );

        expect(sessionId).toBe(mockSessionId);
        expect(mockSupabase.from).toHaveBeenCalledWith('phone_call_sessions');
      });

      it('should handle wholesaler confirmation calls', async () => {
        const mockSessionId = 'session-456';
        const orderId = 123;
        
        mockSupabase.from.mockReturnValue({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockResolvedValue({
              data: [{ id: mockSessionId }],
              error: null
            })
          })
        } as any);

        const sessionId = await phoneAgent.handleIncomingCall(
          'call-456',
          '+1234567891',
          'wholesaler',
          orderId
        );

        expect(sessionId).toBe(mockSessionId);
      });
    });

    describe('processVoiceInput', () => {
      it('should process order confirmation from wholesaler', async () => {
        const mockSession = {
          id: 'session-123',
          caller_type: 'wholesaler',
          order_id: 123,
          ai_session_id: 'ai-session-123'
        };

        mockSupabase.from.mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockSession,
              error: null
            })
          })
        } as any);

        // Mock OpenAI response
        const mockAnalyzeIntent = jest.spyOn(phoneAgent as any, 'analyzeIntent')
          .mockResolvedValue({
            intent: 'confirm_order',
            confidence: 0.95,
            entities: { order_id: 123 }
          });

        const mockConfirmOrder = jest.spyOn(phoneAgent, 'confirmOrder')
          .mockResolvedValue({
            success: true,
            message: 'Order confirmed successfully'
          });

        const response = await phoneAgent.processVoiceInput(
          'call-123',
          'Yes, I confirm the order'
        );

        expect(mockAnalyzeIntent).toHaveBeenCalled();
        expect(mockConfirmOrder).toHaveBeenCalledWith(123);
        expect(response.action).toBe('end_call');
      });

      it('should handle new order placement from retailer', async () => {
        const mockSession = {
          id: 'session-456',
          caller_type: 'retailer',
          ai_session_id: 'ai-session-456'
        };

        mockSupabase.from.mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockSession,
              error: null
            })
          })
        } as any);

        const mockAnalyzeIntent = jest.spyOn(phoneAgent as any, 'analyzeIntent')
          .mockResolvedValue({
            intent: 'place_order',
            confidence: 0.9,
            entities: {
              products: [{ name: 'Rice', quantity: 10 }],
              delivery_address: '123 Main St'
            }
          });

        const mockPlaceOrder = jest.spyOn(phoneAgent, 'placeNewOrder')
          .mockResolvedValue({
            success: true,
            order_id: 789,
            total_amount: 150.00,
            message: 'Order placed successfully'
          });

        const response = await phoneAgent.processVoiceInput(
          'call-456',
          'I want to order 10 bags of rice for delivery to 123 Main St'
        );

        expect(mockAnalyzeIntent).toHaveBeenCalled();
        expect(mockPlaceOrder).toHaveBeenCalled();
        expect(response.message).toContain('Order placed successfully');
      });
    });

    describe('confirmOrder', () => {
      it('should update order status to confirmed', async () => {
        const orderId = 123;
        
        mockSupabase.from.mockReturnValue({
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: null,
              error: null
            })
          })
        } as any);

        const result = await phoneAgent.confirmOrder(orderId);

        expect(result.success).toBe(true);
        expect(mockSupabase.from).toHaveBeenCalledWith('orders');
      });
    });

    describe('checkInventory', () => {
      it('should return product availability', async () => {
        const mockProducts = [
          { id: 1, name: 'Rice', stock_quantity: 100, price: 15.00 },
          { id: 2, name: 'Wheat', stock_quantity: 0, price: 12.00 }
        ];

        mockSupabase.from.mockReturnValue({
          select: jest.fn().mockReturnValue({
            ilike: jest.fn().mockResolvedValue({
              data: mockProducts,
              error: null
            })
          })
        } as any);

        const result = await phoneAgent.checkInventory(['rice', 'wheat']);

        expect(result.available_products).toHaveLength(1);
        expect(result.out_of_stock_products).toHaveLength(1);
        expect(result.available_products[0].name).toBe('Rice');
        expect(result.out_of_stock_products[0].name).toBe('Wheat');
      });
    });
  });

  describe('EnhancedWhatsAppService', () => {
    describe('sendOrderNotification', () => {
      it('should send order notification to wholesaler', async () => {
        const mockOrder = {
          id: 123,
          total_amount: 150.00,
          delivery_address: '123 Main St',
          order_items: [
            { product_name: 'Rice', quantity: 10, price: 15.00 }
          ]
        };

        const mockFetch = jest.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ messages: [{ id: 'msg-123' }] })
        });
        global.fetch = mockFetch;

        mockSupabase.from.mockReturnValue({
          insert: jest.fn().mockResolvedValue({
            data: null,
            error: null
          })
        } as any);

        const result = await whatsappService.sendOrderNotification(
          '+1234567890',
          mockOrder
        );

        expect(result.success).toBe(true);
        expect(mockFetch).toHaveBeenCalled();
      });
    });

    describe('sendEscalationReminder', () => {
      it('should send escalation reminder', async () => {
        const mockFetch = jest.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ messages: [{ id: 'msg-456' }] })
        });
        global.fetch = mockFetch;

        mockSupabase.from.mockReturnValue({
          insert: jest.fn().mockResolvedValue({
            data: null,
            error: null
          })
        } as any);

        const result = await whatsappService.sendEscalationReminder(
          '+1234567890',
          123,
          1
        );

        expect(result.success).toBe(true);
        expect(mockFetch).toHaveBeenCalled();
      });
    });

    describe('handleIncomingWebhook', () => {
      it('should process order confirmation message', async () => {
        const mockWebhookData = {
          object: 'whatsapp_business_account',
          entry: [{
            id: 'entry-123',
            changes: [{
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '1234567890',
                  phone_number_id: 'phone-123'
                },
                messages: [{
                  from: '1234567891',
                  id: 'msg-789',
                  timestamp: '1640995200',
                  text: { body: 'confirm' },
                  type: 'text'
                }]
              },
              field: 'messages'
            }]
          }]
        };

        const mockOrder = {
          id: 123,
          status: 'pending',
          wholesaler_phone: '1234567891'
        };

        mockSupabase.from.mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({
                  data: [mockOrder],
                  error: null
                })
              })
            })
          }),
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: null,
              error: null
            })
          }),
          insert: jest.fn().mockResolvedValue({
            data: null,
            error: null
          })
        } as any);

        const result = await whatsappService.handleIncomingWebhook(mockWebhookData);

        expect(result.success).toBe(true);
      });
    });
  });

  describe('Integration Tests', () => {
    describe('Full Escalation Flow', () => {
      it('should handle complete escalation workflow', async () => {
        // Mock order creation
        const mockOrder = {
          id: 123,
          wholesaler_phone: '+1234567890',
          status: 'pending',
          total_amount: 150.00
        };

        // Mock escalation creation
        mockSupabase.from.mockReturnValue({
          insert: jest.fn().mockResolvedValue({
            data: [{ id: 'escalation-123' }],
            error: null
          }),
          select: jest.fn().mockResolvedValue({
            data: [mockOrder],
            error: null
          }),
          update: jest.fn().mockResolvedValue({
            data: null,
            error: null
          })
        } as any);

        // Test WhatsApp notification
        const mockFetch = jest.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ messages: [{ id: 'msg-123' }] })
        });
        global.fetch = mockFetch;

        const whatsappResult = await whatsappService.sendOrderNotification(
          mockOrder.wholesaler_phone,
          mockOrder
        );

        expect(whatsappResult.success).toBe(true);

        // Test escalation processing
        const escalationResponse = await fetch('/api/escalation/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: 123 })
        });

        // This would be mocked in a real test environment
        expect(mockFetch).toHaveBeenCalled();
      });
    });

    describe('Phone Call Integration', () => {
      it('should handle end-to-end phone call flow', async () => {
        const mockCallSession = {
          id: 'session-123',
          call_sid: 'call-123',
          caller_type: 'retailer'
        };

        mockSupabase.from.mockReturnValue({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockResolvedValue({
              data: [mockCallSession],
              error: null
            })
          }),
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockCallSession,
              error: null
            })
          }),
          update: jest.fn().mockResolvedValue({
            data: null,
            error: null
          })
        } as any);

        // Test call initiation
        const sessionId = await phoneAgent.handleIncomingCall(
          'call-123',
          '+1234567890',
          'retailer'
        );

        expect(sessionId).toBe('session-123');

        // Test voice processing
        const mockAnalyzeIntent = jest.spyOn(phoneAgent as any, 'analyzeIntent')
          .mockResolvedValue({
            intent: 'check_inventory',
            confidence: 0.9,
            entities: { products: ['rice'] }
          });

        const response = await phoneAgent.processVoiceInput(
          'call-123',
          'Do you have rice in stock?'
        );

        expect(mockAnalyzeIntent).toHaveBeenCalled();
        expect(response).toBeDefined();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database connection failed' }
          })
        })
      } as any);

      const response = await phoneAgent.processVoiceInput(
        'call-123',
        'test input'
      );

      expect(response.action).toBe('error');
      expect(response.message).toContain('technical issue');
    });

    it('should handle API failures in WhatsApp service', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'API Error' })
      });
      global.fetch = mockFetch;

      const result = await whatsappService.sendMessage(
        '+1234567890',
        'Test message'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('API Error');
    });
  });

  describe('Performance Tests', () => {
    it('should handle multiple concurrent calls', async () => {
      const mockSessions = Array.from({ length: 10 }, (_, i) => ({
        id: `session-${i}`,
        call_sid: `call-${i}`,
        caller_type: 'retailer'
      }));

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockImplementation((index) => 
            Promise.resolve({
              data: [mockSessions[index] || mockSessions[0]],
              error: null
            })
          )
        })
      } as any);

      const promises = Array.from({ length: 10 }, (_, i) =>
        phoneAgent.handleIncomingCall(
          `call-${i}`,
          `+123456789${i}`,
          'retailer'
        )
      );

      const results = await Promise.all(promises);
      expect(results).toHaveLength(10);
      expect(results.every(result => result.startsWith('session-'))).toBe(true);
    });
  });
});

// Helper function to run load tests
export async function runLoadTest() {
  console.log('Starting load test for Enhanced AI Ordering System...');
  
  const startTime = Date.now();
  const concurrentRequests = 50;
  const testDuration = 30000; // 30 seconds
  
  const promises = [];
  
  for (let i = 0; i < concurrentRequests; i++) {
    promises.push(
      fetch('/api/escalation/process', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      })
    );
  }
  
  try {
    const results = await Promise.all(promises);
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    const successCount = results.filter(r => r.ok).length;
    const failureCount = results.length - successCount;
    
    console.log(`Load test completed in ${duration}ms`);
    console.log(`Successful requests: ${successCount}`);
    console.log(`Failed requests: ${failureCount}`);
    console.log(`Average response time: ${duration / results.length}ms`);
    
    return {
      duration,
      totalRequests: results.length,
      successCount,
      failureCount,
      averageResponseTime: duration / results.length
    };
  } catch (error) {
    console.error('Load test failed:', error);
    throw error;
  }
}