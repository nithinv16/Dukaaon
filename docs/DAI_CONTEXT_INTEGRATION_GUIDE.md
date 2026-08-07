# Dai AI Assistant - Context Awareness Integration Guide

## Quick Start

This guide shows how to integrate the enhanced context awareness into your existing Dai AI Assistant.

## Step 1: Update bedrockAIService.ts

Replace the `getUserContext` and `buildSystemMessage` methods in `services/aiAgent/bedrockAIService.ts`:

```typescript
// At the top of the file, add import:
import { enhancedContextService, EnhancedUserContext } from './enhancedContextService';

// In the BedrockAIService class, replace getUserContext:
private async getUserContext(userId: string): Promise<EnhancedUserContext> {
  return await enhancedContextService.getUserContext(userId);
}

// Replace buildSystemMessage to use enhanced context:
private buildSystemMessage(context: EnhancedUserContext): AIMessage {
  let systemContent = AI_AGENT_CONFIG.systemPrompt;

  // Add user profile
  if (context.user_profile) {
    systemContent += `\n\n=== USER PROFILE ===
- Business: ${context.user_profile.business_name}
- Location: ${context.user_profile.location.city}, ${context.user_profile.location.state}
- Language: ${context.user_profile.language}
- Coordinates: ${context.user_profile.location.latitude}, ${context.user_profile.location.longitude}`;
  }

  // Add current cart
  if (context.current_cart.item_count > 0) {
    systemContent += `\n\n=== CURRENT CART ===
- Items: ${context.current_cart.item_count}
- Total: ₹${context.current_cart.total.toFixed(2)}`;
  }

  // Add order history insights
  if (context.order_history.total_orders > 0) {
    systemContent += `\n\n=== ORDER HISTORY ===
- Total orders: ${context.order_history.total_orders}
- Average order value: ₹${context.order_history.average_order_value.toFixed(2)}
- Ordering frequency: ${context.order_history.ordering_frequency}
- Favorite categories: ${context.order_history.favorite_categories.join(', ') || 'None'}
- Preferred sellers: ${context.order_history.preferred_sellers.length} sellers`;
  }

  // Add behavioral patterns
  if (context.behavior_patterns.preferred_order_time.length > 0) {
    systemContent += `\n\n=== BEHAVIOR PATTERNS ===
- Preferred order time: ${context.behavior_patterns.preferred_order_time.join(', ')}
- Preferred payment: ${context.behavior_patterns.preferred_payment_method}
- Repeat purchase rate: ${(context.behavior_patterns.repeat_purchase_rate * 100).toFixed(0)}%`;
  }

  // Add learned preferences
  systemContent += `\n\n=== LEARNED PREFERENCES ===
- Price sensitivity: ${context.learned_preferences.price_sensitivity}
- Quality preference: ${context.learned_preferences.quality_preference}
- Bulk buying: ${context.learned_preferences.bulk_buying_tendency ? 'Yes' : 'No'}`;

  if (Object.keys(context.learned_preferences.brand_loyalty).length > 0) {
    const topBrands = Object.entries(context.learned_preferences.brand_loyalty)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([brand]) => brand);
    systemContent += `\n- Top brands: ${topBrands.join(', ')}`;
  }

  // Add contextual information
  systemContent += `\n\n=== CURRENT CONTEXT ===
- Time: ${context.contextual_info.current_time} on ${context.contextual_info.day_of_week}
- Season: ${context.contextual_info.season}`;

  return {
    role: 'system',
    content: systemContent,
    timestamp: new Date()
  };
}
```

## Step 2: Create Database Tables (Optional but Recommended)

Run this migration to enable preference storage and behavior tracking:

```sql
-- User preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  preferences JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- User behavior tracking
CREATE TABLE IF NOT EXISTS user_behavior_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action_type VARCHAR(50) NOT NULL,
  action_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_behavior_logs_user_id 
  ON user_behavior_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_behavior_logs_action 
  ON user_behavior_logs(action_type);
```

## Step 3: Test the Integration

1. **Test basic context loading:**
```typescript
import { enhancedContextService } from './services/aiAgent/enhancedContextService';

const context = await enhancedContextService.getUserContext('user-id-here');
console.log('Context loaded:', context);
```

2. **Test with AI chat:**
- Open the AI chat interface
- Send a message
- Check console logs for context information
- Verify AI responses are more personalized

## Step 4: Track User Behavior (Optional Enhancement)

Add behavior tracking when users perform actions:

```typescript
// In your product view component
import { supabase } from '../services/supabase/supabase';

async function trackProductView(userId: string, productId: string) {
  await supabase
    .from('user_behavior_logs')
    .insert({
      user_id: userId,
      action_type: 'view_product',
      action_data: { product_id: productId }
    });
}

// In your search component
async function trackSearch(userId: string, query: string) {
  await supabase
    .from('user_behavior_logs')
    .insert({
      user_id: userId,
      action_type: 'search',
      action_data: { query }
    });
}
```

## Benefits You'll See

### Immediate Benefits
1. **Better Personalization** - AI understands user preferences
2. **Smarter Suggestions** - Based on order history and behavior
3. **Context Awareness** - AI remembers user's business and patterns
4. **Faster Responses** - Less clarification needed

### Example Improvements

**Before:**
- User: "I need rice"
- AI: "What quantity of rice do you need?"

**After (with context):**
- User: "I need rice"
- AI: "I see you usually order 10kg rice from [Preferred Seller]. Should I add that to your cart? You typically order this weekly."

## Performance Considerations

- Context loading is done in parallel (fast)
- Results are cached in memory during conversation
- Database queries are optimized with indexes
- Fallback to minimal context on errors

## Troubleshooting

### Issue: Context not loading
- Check user ID is valid
- Verify database tables exist
- Check console for errors

### Issue: Slow context loading
- Ensure database indexes are created
- Check network connection
- Consider caching context

### Issue: Preferences not updating
- Preferences are calculated from behavior
- May take a few orders to learn patterns
- Can be manually updated in `user_preferences` table

## Next Steps

1. ✅ Integrate enhanced context service
2. ✅ Test with real users
3. ⏭️ Add conversation summarization (Phase 2)
4. ⏭️ Add proactive suggestions (Phase 3)
5. ⏭️ Add preference learning UI (Phase 4)

## Support

For issues or questions:
- Check `docs/DAI_CONTEXT_AWARENESS_ENHANCEMENT.md` for full documentation
- Review `services/aiAgent/enhancedContextService.ts` for implementation details

---

**Status:** Phase 1 Complete - Ready for Integration  
**Last Updated:** 2025-01-07

