import RazorpayCheckout from 'react-native-razorpay';
import { razorpayConfig } from '../../config/razorpay';
import { PaymentMethodType } from '../../types/payment';

export interface RazorpayPaymentOptions {
  amount: number;
  orderId: string;
  paymentMethod: PaymentMethodType;
  userDetails: {
    name: string;
    email: string;
    contact: string;
  };
  description?: string;
  prefill?: {
    email?: string;
    contact?: string;
    name?: string;
  };
  notes?: Record<string, string>;
  forceUpi?: boolean; // If true, pre-select UPI method to show UPI apps directly
}

export interface RazorpayPaymentResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export interface RazorpayOrderResponse {
  id: string;
  entity: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string;
  status: string;
  attempts: number;
  created_at: number;
}

class RazorpayServiceClass {
  private readonly keyId: string;
  private readonly merchantName: string;
  private readonly supabaseUrl: string;

  constructor() {
    this.keyId = razorpayConfig.keyId;
    this.merchantName = razorpayConfig.merchantName;
    
    // Get Supabase URL from config or environment
    this.supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 
                      process.env.SUPABASE_URL || 
                      'https://xcpznnkpjgyrpbvpnvit.supabase.co';
    
    // Debug: Log the actual key ID being used (first 15 chars for security)
    console.log('[RazorpayService] Initialized with Key ID:', 
      this.keyId ? `${this.keyId.substring(0, 15)}... (length: ${this.keyId.length})` : 'NOT SET'
    );
    
    if (!this.keyId) {
      console.warn('[RazorpayService] Warning: Razorpay Key ID is not configured');
    } else if (this.keyId.length < 14) {
      console.error('[RazorpayService] ERROR: Key ID is too short!', {
        keyId: this.keyId,
        length: this.keyId.length,
        expected: '14+ characters',
        source: 'Check EXPO_PUBLIC_RAZORPAY_KEY_ID environment variable or app.config.js',
        fix: 'Restart app with --clear flag: npx expo start --clear'
      });
    }
  }

  /**
   * Create Razorpay order via Supabase Edge Function
   * This is required before opening Razorpay checkout
   */
  async createRazorpayOrder(
    amount: number,
    receipt: string,
    notes?: Record<string, string>
  ): Promise<string> {
    try {
      // Import supabase client dynamically to avoid circular dependencies
      const { supabase } = await import('../../services/supabase/supabase');
      
      // Get current session for authentication
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        throw new Error('User not authenticated. Please log in again.');
      }

      console.log('[RazorpayService] Creating Razorpay order via Edge Function...');

      // Call Supabase Edge Function to create Razorpay order
      const { data, error } = await supabase.functions.invoke('razorpay-function', {
        body: {
          amount,
          currency: 'INR',
          receipt,
          notes,
        },
      });

      if (error) {
        // Log detailed error information
        console.error('[RazorpayService] Edge Function error details:', {
          error,
          message: error.message,
          context: error.context,
          status: error.status,
          // Try to get response body if available
          response: (error as any).response,
        });
        
        // Try to extract more details from the error
        let errorMessage = 'Failed to create Razorpay order';
        if (error.message) {
          errorMessage = error.message;
        } else if (error.context?.message) {
          errorMessage = error.context.message;
        } else if ((error as any).response) {
          try {
            const errorBody = typeof (error as any).response === 'string' 
              ? JSON.parse((error as any).response)
              : (error as any).response;
            errorMessage = errorBody.error || errorBody.message || errorMessage;
          } catch {
            // Ignore parse errors
          }
        }
        
        // Check if it's a 404 (function not deployed) or 500 (function error)
        const statusCode = error.status || (error as any).statusCode;
        if (statusCode === 404) {
          throw new Error('Edge Function not found. Please deploy the razorpay-function.');
        } else if (statusCode === 401 || statusCode === 403) {
          throw new Error('Authentication failed. Please log in again.');
        } else if (statusCode === 500) {
          throw new Error('Edge Function error. Please check Razorpay credentials in Supabase secrets.');
        }
        
        throw new Error(`${errorMessage}. Status: ${statusCode || 'unknown'}`);
      }

      if (!data || !data.order_id) {
        console.error('[RazorpayService] Invalid response:', data);
        throw new Error('Invalid response from order creation API. The Edge Function may not be deployed or configured correctly.');
      }

      console.log('[RazorpayService] Razorpay order created successfully:', data.order_id);
      return data.order_id;
    } catch (error: any) {
      console.error('[RazorpayService] Error in createRazorpayOrder:', error);
      throw new Error(error.message || 'Failed to create Razorpay order');
    }
  }

  /**
   * Initialize Razorpay payment
   * This opens the Razorpay checkout UI
   */
  async initializePayment(options: RazorpayPaymentOptions): Promise<RazorpayPaymentResponse> {
    try {
      if (!this.keyId) {
        throw new Error('Razorpay Key ID is not configured');
      }

      // Validate key format - Razorpay keys are typically 14+ characters
      if (!this.keyId.startsWith('rzp_')) {
        throw new Error(`Invalid Razorpay Key ID format. Must start with 'rzp_'. Current: ${this.keyId.substring(0, 10)}...`);
      }
      
      // Check if key ID looks incomplete (too short)
      // Minimum valid Razorpay key is around 14 characters (rzp_live_xxxxx)
      if (this.keyId.length < 14) {
        const errorMsg = `Invalid Razorpay Key ID: Key appears incomplete (${this.keyId.length} characters). Expected format: rzp_live_xxxxxxxxxxxxx or rzp_test_xxxxxxxxxxxxx. Please check your EXPO_PUBLIC_RAZORPAY_KEY_ID environment variable.`;
        console.error('[RazorpayService]', errorMsg);
        console.error('[RazorpayService] Current Key ID:', this.keyId);
        throw new Error(errorMsg);
      }

      // Convert amount to paise (Razorpay expects amount in smallest currency unit)
      const amountInPaise = Math.round(options.amount * 100);

      // Validate amount
      if (amountInPaise < 100) {
        throw new Error('Minimum payment amount is ₹1.00');
      }

      // Step 1: Create Razorpay order via backend (required for production)
      let razorpayOrderId: string;
      try {
        razorpayOrderId = await this.createRazorpayOrder(
          options.amount,
          options.orderId.substring(0, 40), // Receipt max 40 chars
          {
            order_id: options.orderId,
            payment_method: options.paymentMethod,
            ...options.notes,
          }
        );
        console.log('[RazorpayService] Created Razorpay order:', razorpayOrderId);
      } catch (orderError: any) {
        console.error('[RazorpayService] Failed to create Razorpay order:', {
          error: orderError,
          message: orderError?.message,
          // Check if it's a deployment issue
          isDeploymentIssue: orderError?.message?.includes('not found') || 
                            orderError?.message?.includes('404') ||
                            orderError?.status === 404,
        });
        
        // If Edge Function is not deployed, show helpful message but continue
        // The Razorpay SDK can work without order_id, but it's not recommended
        if (orderError?.message?.includes('not found') || orderError?.status === 404) {
          console.warn('[RazorpayService] Edge Function not deployed. Continuing without order_id.');
          console.warn('[RazorpayService] To fix: Deploy the function using: supabase functions deploy razorpay-function');
        } else {
          console.warn('[RazorpayService] Continuing without Razorpay order_id - this may cause errors');
        }
        razorpayOrderId = '';
      }

      // Validate key ID format
      if (this.keyId.length < 14 || !this.keyId.startsWith('rzp_')) {
        throw new Error(`Invalid Razorpay Key ID format. Expected format: rzp_live_xxxxx or rzp_test_xxxxx. Current: ${this.keyId.substring(0, 10)}...`);
      }

      // Step 2: Prepare Razorpay checkout options
      // IMPORTANT: Do NOT specify 'method' field to show ALL payment methods
      // When method is not specified, Razorpay shows all available methods
      // UPI Intent flow (direct app redirection) works automatically when:
      // 1. Android queries are configured in AndroidManifest (we added them in app.config.js)
      // 2. UPI apps are installed on the device
      // 3. User selects UPI as payment method
      const razorpayOptions: any = {
        description: options.description || `${this.merchantName} - Order ${options.orderId}`,
        currency: 'INR',
        key: this.keyId,
        amount: amountInPaise,
        name: this.merchantName,
        prefill: {
          email: options.userDetails.email || options.prefill?.email || '',
          // CRITICAL: Razorpay requires contact (mobile number) in format: +{country code}{phone number}
          // Example: +919876543210 (for India)
          // If contact is missing or empty, Razorpay will prompt user to enter it manually
          contact: options.userDetails.contact || options.prefill?.contact || '',
          name: options.userDetails.name || options.prefill?.name || '',
        },
        theme: {
          color: '#FF7D00', // Your app's primary color
        },
        // Use orderId as receipt for tracking (max 40 chars)
        receipt: options.orderId.substring(0, 40),
        notes: {
          order_id: options.orderId,
          payment_method: options.paymentMethod,
          ...options.notes,
        },
      };

      // CRITICAL: React Native SDK UPI Intent Configuration
      // Based on research: React Native SDK behaves differently than Web SDK
      // 
      // Key Findings:
      // 1. Setting 'method' field might prevent UPI apps from showing
      // 2. React Native SDK auto-detects UPI apps when Android queries are configured
      // 3. User must select "UPI" in Razorpay UI first, then UPI apps appear
      // 4. The 'method' field format might not be supported in React Native SDK
      //
      // Solution: Don't set 'method' field - let Razorpay show all methods
      // When user selects UPI, UPI apps (Google Pay, PhonePe, Paytm) will appear
      // if Android queries are properly configured (which they are)
      
      // NOTE: We're NOT setting the method field because:
      // - React Native SDK might not support method: { upi: { flow: 'intent' } } format
      // - Setting method might restrict or break UPI Intent flow
      // - Android queries in AndroidManifest.xml are sufficient for UPI Intent
      // - Razorpay will automatically use UPI Intent when user selects UPI
      
      if (options.forceUpi) {
        console.log('[RazorpayService] Force UPI requested - but not setting method field');
        console.log('[RazorpayService] User will need to select UPI in Razorpay UI to see UPI apps');
        console.log('[RazorpayService] UPI apps will appear when UPI is selected (if Android queries are configured)');
      } else {
        console.log('[RazorpayService] All payment methods will be shown');
        console.log('[RazorpayService] When user selects UPI, UPI apps will appear (if Android queries are configured)');
      }
      
      console.log('[RazorpayService] Razorpay options:', {
        amount: amountInPaise,
        currency: 'INR',
        method: 'NOT SET (all methods will be shown)',
        hasOrderId: !!razorpayOrderId,
        forceUpi: options.forceUpi,
        note: 'User must select UPI in Razorpay UI to see UPI apps',
      });

      // CRITICAL: UPI Intent requires order_id to be present
      // Don't proceed without order_id - it's required for UPI Intent flow
      if (!razorpayOrderId) {
        const errorMsg = 'Razorpay order creation failed. UPI Intent requires order_id. Cannot proceed with payment.';
        console.error('[RazorpayService]', errorMsg);
        throw new Error(errorMsg);
      }
      
      razorpayOptions.order_id = razorpayOrderId;
      console.log('[RazorpayService] Using Razorpay order_id:', razorpayOrderId);

      console.log('[RazorpayService] Initializing payment with options:', {
        amount: amountInPaise,
        currency: razorpayOptions.currency,
        orderId: options.orderId,
        razorpayOrderId: razorpayOrderId || 'none',
        paymentMethod: options.paymentMethod,
        keyId: this.keyId.substring(0, 15) + '...', // Log partial key for debugging
        hasOrderId: !!razorpayOrderId,
      });

      // Open Razorpay checkout
      console.log('[RazorpayService] Opening Razorpay checkout...');
      let response;
      try {
        response = await RazorpayCheckout.open(razorpayOptions);
        console.log('[RazorpayService] Payment response received:', {
          hasPaymentId: !!response?.razorpay_payment_id,
          hasOrderId: !!response?.razorpay_order_id,
          hasSignature: !!response?.razorpay_signature,
        });
      } catch (checkoutError: any) {
        // Log the full error structure
        console.error('[RazorpayService] Razorpay checkout error:', {
          error: checkoutError,
          errorString: JSON.stringify(checkoutError, null, 2),
          code: checkoutError?.code,
          description: checkoutError?.description,
          message: checkoutError?.message,
          errorObject: checkoutError?.error,
          keyId: this.keyId.substring(0, 15) + '...',
          amount: amountInPaise,
          hasOrderId: !!razorpayOrderId,
        });
        throw checkoutError;
      }

      // Check if response is valid
      if (!response || !response.razorpay_payment_id) {
        throw new Error('Invalid payment response from Razorpay');
      }

      // Razorpay returns payment details
      return {
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_order_id: response.razorpay_order_id || options.orderId,
        razorpay_signature: response.razorpay_signature,
      };
    } catch (error: any) {
      // Log comprehensive error details for debugging
      console.error('[RazorpayService] Payment initialization error - Full details:', {
        error,
        errorType: typeof error,
        errorKeys: error ? Object.keys(error) : [],
        code: error?.code,
        description: error?.description,
        message: error?.message,
        keyId: this.keyId?.substring(0, 15) + '...',
        keyIdLength: this.keyId?.length,
        // Try to stringify the entire error for inspection
        errorStringified: JSON.stringify(error, Object.getOwnPropertyNames(error), 2),
      });
      
      // Parse nested error structure from Razorpay
      let errorMessage = 'Payment failed. Please try again.';
      let errorCode = error?.code;
      
      // Handle nested error structure (error.error.description)
      if (error?.error) {
        const nestedError = error.error;
        errorCode = nestedError.code || errorCode;
        
        if (nestedError.description) {
          errorMessage = nestedError.description;
        } else if (nestedError.reason) {
          // Handle specific error reasons
          switch (nestedError.reason) {
            case 'payment_cancelled':
              errorMessage = 'Payment was cancelled. Please try again when ready.';
              break;
            case 'payment_failed':
              errorMessage = 'Payment failed. Please check your payment method and try again.';
              break;
            default:
              errorMessage = nestedError.description || `Payment error: ${nestedError.reason}`;
          }
        }
      } else if (error?.description) {
        // Try to parse JSON string if description is a JSON string
        try {
          const parsedDesc = JSON.parse(error.description);
          if (parsedDesc.error) {
            errorMessage = parsedDesc.error.description || errorMessage;
            errorCode = parsedDesc.error.code || errorCode;
          }
        } catch {
          // If not JSON, use description as is
          errorMessage = error.description;
        }
      }
      
      // Handle specific Razorpay error codes
      if (errorCode === 'NETWORK_ERROR' || error?.code === 'NETWORK_ERROR') {
        throw new Error('Network error. Please check your internet connection.');
      } else if (errorCode === 'BAD_REQUEST_ERROR' || error?.code === 'BAD_REQUEST_ERROR') {
        // For payment cancellation, show user-friendly message
        if (error?.error?.reason === 'payment_cancelled' || error?.error?.step === 'payment_authentication') {
          throw new Error('Payment was cancelled or timed out. Please try again.');
        }
        throw new Error(errorMessage);
      } else if (errorCode === 'SERVER_ERROR' || error?.code === 'SERVER_ERROR') {
        throw new Error('Payment server error. Please try again later.');
      } else if (errorCode === 'AUTHORIZATION_ERROR' || error?.code === 'AUTHORIZATION_ERROR') {
        throw new Error('Payment authorization failed. Please verify your Razorpay Key ID is correct.');
      } else if (error?.message) {
        // Check for common error messages
        if (error.message.includes('key') || error.message.includes('Key')) {
          throw new Error('Invalid Razorpay Key ID. Please check your configuration.');
        }
        throw new Error(error.message);
      } else {
        throw new Error(errorMessage);
      }
    }
  }

  /**
   * Verify payment signature
   * Note: This should ideally be done on your backend for security
   * This is a client-side verification that can be bypassed
   */
  async verifyPayment(
    paymentId: string,
    orderId: string,
    signature: string
  ): Promise<boolean> {
    try {
      // IMPORTANT: Client-side verification is not secure
      // You should verify the payment signature on your backend
      // This is just a placeholder check
      
      if (!paymentId || !orderId || !signature) {
        console.warn('[RazorpayService] Missing payment verification data');
        return false;
      }

      // In production, make an API call to your backend to verify the signature
      // For now, we'll do a basic validation
      const isValid = paymentId.startsWith('pay_') && 
                     orderId.startsWith('order_') && 
                     signature.length > 0;

      if (!isValid) {
        console.warn('[RazorpayService] Payment verification failed - invalid format');
        return false;
      }

      // TODO: Implement proper server-side verification
      // You should call your backend API to verify the signature using the key secret
      // Example:
      // const response = await fetch('https://your-api.com/verify-payment', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ paymentId, orderId, signature })
      // });
      // const { verified } = await response.json();
      // return verified;

      console.log('[RazorpayService] Payment verification passed (client-side check)');
      return true;
    } catch (error) {
      console.error('[RazorpayService] Payment verification error:', error);
      return false;
    }
  }

  /**
   * Map payment method type to Razorpay method
   */
  private getPaymentMethod(paymentMethod: PaymentMethodType): any {
    switch (paymentMethod) {
      case 'upi':
        return {
          upi: {
            flow: 'collect', // or 'intent'
          },
        };
      case 'card':
        return {
          card: {},
        };
      case 'netbanking':
        return {
          netbanking: {},
        };
      default:
        return {}; // All methods
    }
  }

  /**
   * Close Razorpay checkout (if needed)
   */
  closeCheckout(): void {
    try {
      RazorpayCheckout.close();
    } catch (error) {
      console.error('[RazorpayService] Error closing checkout:', error);
    }
  }
}

// Export singleton instance
export const razorpayService = new RazorpayServiceClass();
export default razorpayService;

