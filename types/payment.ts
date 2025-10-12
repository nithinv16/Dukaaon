export type PaymentMethodType = 'upi' | 'card' | 'netbanking' | 'cod';

export interface PaymentMethod {
  id: string;
  type: 'upi' | 'card' | 'netbanking' | 'cod';
  title: string;
  is_default: boolean;
  details: {
    upi_id?: string;
    card_last4?: string;
    card_brand?: string;
    card_expiry?: string;
    bank_name?: string;
  };
  user_id: string;
  created_at: string;
}

export interface PaymentTransaction {
  id: string;
  order_id: string;
  amount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  payment_method: PaymentMethodType;
  transaction_id?: string;
  created_at: string;
  error_message?: string;
} 