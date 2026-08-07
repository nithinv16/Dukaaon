# AI Order Integration Guide

This guide explains how to integrate AI order tracking with your existing orders table.

## Overview

Instead of creating a separate AI orders system, we're adding a simple boolean flag to the existing `orders` table to track which orders were placed via the AI agent.

## Database Changes

### 1. Add AI Order Flag

Run the following SQL in your Supabase SQL Editor or database console:

```sql
-- Add the is_ai_order column to the orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_ai_order BOOLEAN DEFAULT FALSE;

-- Add a comment to document the column purpose
COMMENT ON COLUMN orders.is_ai_order IS 'Flag to indicate if the order was placed using the AI ordering agent';

-- Create an index for better query performance when filtering AI orders
CREATE INDEX IF NOT EXISTS idx_orders_is_ai_order ON orders(is_ai_order);

-- Create a partial index for AI orders only (more efficient for AI order queries)
CREATE INDEX IF NOT EXISTS idx_orders_ai_only ON orders(created_at DESC) WHERE is_ai_order = TRUE;
```

### 2. Create Helper Views

```sql
-- Create a view for easy querying of AI orders
CREATE OR REPLACE VIEW ai_orders_view AS
SELECT 
    o.*,
    'AI Agent' as order_source
FROM orders o
WHERE o.is_ai_order = TRUE;

-- Create a view for manual orders
CREATE OR REPLACE VIEW manual_orders_view AS
SELECT 
    o.*,
    'Manual' as order_source
FROM orders o
WHERE o.is_ai_order = FALSE OR o.is_ai_order IS NULL;
```

### 3. Create Analytics Function

```sql
-- Function to get order statistics by source
CREATE OR REPLACE FUNCTION get_order_stats_by_source()
RETURNS TABLE (
    order_source TEXT,
    total_orders BIGINT,
    total_amount NUMERIC,
    avg_order_value NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        CASE 
            WHEN o.is_ai_order = TRUE THEN 'AI Agent'
            ELSE 'Manual'
        END as order_source,
        COUNT(*) as total_orders,
        COALESCE(SUM(o.total_amount), 0) as total_amount,
        COALESCE(AVG(o.total_amount), 0) as avg_order_value
    FROM orders o
    GROUP BY 
        CASE 
            WHEN o.is_ai_order = TRUE THEN 'AI Agent'
            ELSE 'Manual'
        END;
END;
$$ LANGUAGE plpgsql;
```

## Application Integration

### 1. AI Order Service

The `aiOrderService.ts` file has been created in `/services/` with the following functions:

- `createAIOrder()` - Create orders with AI flag set to true
- `getAIOrders()` - Fetch orders placed via AI
- `getOrderStatsBySource()` - Get analytics comparing AI vs manual orders
- `updateAIOrderStatus()` - Update AI order status
- `isAIOrder()` - Check if an order was placed via AI
- `getRecentAIActivity()` - Get recent AI order activity

### 2. Usage Examples

#### Creating an AI Order

```typescript
import { createAIOrder } from '../services/aiOrderService';

const orderData = {
  user_id: 'user-123',
  retailer_id: 'retailer-456',
  seller_id: 'seller-789',
  status: 'confirmed',
  total_amount: 150.00,
  items: [
    {
      product_id: 'prod-1',
      product_name: 'Basmati Rice',
      quantity: 2,
      unit_price: 85.00,
      unit: 'kg'
    }
  ]
};

const result = await createAIOrder(orderData);
if (result.success) {
  console.log('AI order created:', result.order_id);
} else {
  console.error('Error:', result.error);
}
```

#### Fetching AI Orders

```typescript
import { getAIOrders } from '../services/aiOrderService';

const { success, orders } = await getAIOrders('user-123');
if (success) {
  console.log('AI orders:', orders);
}
```

#### Getting Order Statistics

```typescript
import { getOrderStatsBySource } from '../services/aiOrderService';

const { success, stats } = await getOrderStatsBySource();
if (success) {
  stats.forEach(stat => {
    console.log(`${stat.order_source}: ${stat.total_orders} orders, $${stat.total_amount} total`);
  });
}
```

## Integration with Azure AI Agent

When your Azure AI agent processes an order, ensure you:

1. **Set the AI flag**: Always set `is_ai_order: true` when creating orders via the AI agent
2. **Use the service**: Import and use `aiOrderService.ts` functions instead of direct database calls
3. **Track sessions**: Consider storing session information for conversation context
4. **Handle errors**: Implement proper error handling for AI order failures

### Example AI Agent Integration

```typescript
// In your AI agent order processing logic
import { createAIOrder } from '../services/aiOrderService';

export const processAIOrder = async (voiceInput: string, sessionId: string) => {
  try {
    // 1. Process voice input and extract order details
    const orderDetails = await parseVoiceOrder(voiceInput);
    
    // 2. Validate products and check inventory
    const validatedItems = await validateOrderItems(orderDetails.items);
    
    // 3. Create the order with AI flag
    const result = await createAIOrder({
      ...orderDetails,
      items: validatedItems,
      session_id: sessionId
    });
    
    // 4. Return response to user
    if (result.success) {
      return {
        success: true,
        message: `Order ${result.order_id} created successfully!`,
        order_id: result.order_id
      };
    } else {
      return {
        success: false,
        message: 'Failed to create order: ' + result.error
      };
    }
  } catch (error) {
    console.error('AI order processing error:', error);
    return {
      success: false,
      message: 'An error occurred while processing your order'
    };
  }
};
```

## Benefits of This Approach

1. **Minimal Changes**: Only adds one column to existing table
2. **Backward Compatible**: Existing orders remain unaffected
3. **Easy Analytics**: Simple queries to compare AI vs manual orders
4. **Flexible**: Can easily extend with more AI-specific fields later
5. **Performance**: Indexed for fast filtering and sorting

## Next Steps

1. Run the SQL commands in your Supabase dashboard
2. Test the `aiOrderService.ts` functions
3. Integrate with your Azure AI agent
4. Add analytics dashboard to track AI order performance
5. Consider adding more AI-specific fields as needed (e.g., `ai_session_id`, `voice_transcript`, etc.)

## Monitoring and Analytics

You can now easily track:
- Total AI orders vs manual orders
- AI order success rates
- Average order values by source
- AI agent performance over time
- Popular products ordered via AI

Use the provided views and functions to create dashboards and reports comparing AI vs manual order performance.