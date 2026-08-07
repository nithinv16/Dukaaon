# Integration Guide: Making Your App Dynamic

## Step-by-Step Implementation

This guide will help you integrate the dynamic content system into your existing Dukaaon app.

---

## Phase 1: Database Setup (5 minutes)

### Step 1: Run the Migration

```bash
# Connect to your Supabase project
# Go to SQL Editor in Supabase Dashboard

# Copy the entire content of supabase/migrations/20250107_dynamic_content.sql
# Paste it and click "Run"

# This will create all necessary tables
```

**Verify it worked:**
```sql
SELECT * FROM app_config LIMIT 5;
SELECT * FROM feature_flags LIMIT 5;
SELECT * FROM categories LIMIT 5;
```

---

## Phase 2: Install Dependencies (2 minutes)

No new dependencies needed! Everything uses your existing setup.

---

## Phase 3: Integrate Remote Config (10 minutes)

### Step 1: Update App.js or Main Entry Point

Add remote config initialization:

```typescript
// In App.js or your main entry point
import { remoteConfigService } from './services/remoteConfig/remoteConfigService';
import { useEffect } from 'react';

export default function App() {
  useEffect(() => {
    // Preload configurations when app starts
    remoteConfigService.preloadConfigs();
  }, []);

  // ... rest of your app code
}
```

### Step 2: Use Remote Config in Checkout

Update your checkout screen to use dynamic min order amount:

```typescript
// In your checkout screen
import { remoteConfigService } from '../../services/remoteConfig/remoteConfigService';

export default function CheckoutScreen() {
  const [minOrderAmount, setMinOrderAmount] = useState(200);

  useEffect(() => {
    const fetchMinOrder = async () => {
      const config = await remoteConfigService.getConfig('min_order_amount');
      setMinOrderAmount(config?.amount || 200);
    };
    fetchMinOrder();
  }, []);

  // Use minOrderAmount in your validation
  if (cartTotal < minOrderAmount) {
    Alert.alert(`Minimum order amount is ₹${minOrderAmount}`);
    return;
  }
}
```

### Step 3: Use Feature Flags

Conditionally show features based on remote flags:

```typescript
// Example: Show/Hide Voice Search based on feature flag
import { remoteConfigService } from '../../services/remoteConfig/remoteConfigService';

export default function Header() {
  const [showVoiceSearch, setShowVoiceSearch] = useState(false);

  useEffect(() => {
    const checkFeature = async () => {
      const enabled = await remoteConfigService.isFeatureEnabled('voice_search');
      setShowVoiceSearch(enabled);
    };
    checkFeature();
  }, []);

  return (
    <View>
      {/* Your existing header */}
      {showVoiceSearch && (
        <VoiceSearchButton />
      )}
    </View>
  );
}
```

---

## Phase 4: Add Dynamic Banners (15 minutes)

### Step 1: Update Home Screen

Replace or add to your existing home screen:

```typescript
// app/(main)/home/index.tsx
import React from 'react';
import { ScrollView, View } from 'react-native';
import { DynamicBanners } from '../../../components/dynamic/DynamicBanners';
import { CategoryGrid } from '../../../components/home/CategoryGrid';
import { PromotionBanner } from '../../../components/dynamic/PromotionBanner';

export default function HomeScreen() {
  return (
    <ScrollView>
      {/* Add Dynamic Banners at the top */}
      <DynamicBanners 
        config={{
          auto_scroll: true,
          interval: 3000,
          height: 200,
        }}
      />

      {/* Your existing category grid */}
      <CategoryGrid />

      {/* Add Promotions Section */}
      <PromotionBanner 
        title="Special Offers"
        config={{
          layout: 'horizontal',
          max_promotions: 3,
        }}
      />

      {/* Rest of your home screen content */}
    </ScrollView>
  );
}
```

### Step 2: Test Banners

1. Go to Supabase Table Editor
2. Open `banners` table
3. Click "Insert row"
4. Add test data:
   ```
   title: "Welcome to Dukaaon"
   image_url: "https://via.placeholder.com/800x200"
   action_type: "none"
   is_active: true
   start_date: (today's date)
   end_date: (30 days from now)
   display_order: 1
   ```
5. Restart your app
6. You should see the banner! 🎉

---

## Phase 5: Migrate to Dynamic Categories (20 minutes)

### Option A: Keep Existing System + Add Dynamic

Keep your current category system and add dynamic banners/promotions only. This is the **safest** approach.

### Option B: Full Migration (Recommended for long-term)

#### Step 1: Run Category Migration Script

```typescript
// Run this once in your app or as a script
import { dynamicCategoryService } from './services/dynamic/dynamicCategoryService';

// In a test screen or startup function
const runMigration = async () => {
  console.log('Starting migration...');
  await dynamicCategoryService.migrateOldCategories();
  console.log('Migration complete!');
};

// Call it
runMigration();
```

#### Step 2: Update CategoryGrid Component

Modify your existing `CategoryGrid.tsx`:

```typescript
// In components/home/CategoryGrid.tsx
import { dynamicCategoryService } from '../../services/dynamic/dynamicCategoryService';

export function CategoryGrid() {
  const [categories, setCategories] = useState([]);
  
  useEffect(() => {
    fetchDynamicCategories();
  }, []);

  const fetchDynamicCategories = async () => {
    const cats = await dynamicCategoryService.getCategories();
    
    // Transform to your existing format
    const formatted = cats.map(cat => ({
      id: cat.slug,
      name: cat.name,
      image: cat.image_url ? { uri: cat.image_url } : getCategoryImage(cat.slug),
    }));
    
    setCategories(formatted);
  };

  // Rest of your existing CategoryGrid code
}
```

---

## Phase 6: Add Admin Controls (30 minutes)

### Quick Method: Use Supabase Studio

1. Bookmark this URL: `https://app.supabase.com/project/YOUR_PROJECT_ID/editor`
2. Train your team to use it
3. Done! ✅

### Better Method: Build Simple Admin

See `ADMIN_DASHBOARD_SETUP.md` for full instructions.

Quick start:
```bash
# Create admin folder
mkdir admin-panel
cd admin-panel
npx create-next-app@latest .
npm install @supabase/supabase-js
```

---

## Phase 7: Test Everything (15 minutes)

### Test Checklist:

- [ ] **Banners:**
  - [ ] Create a banner in Supabase
  - [ ] Restart app - banner shows
  - [ ] Set `is_active` to false
  - [ ] Restart app - banner hidden
  
- [ ] **Promotions:**
  - [ ] Create a promotion
  - [ ] Shows on home screen
  - [ ] Code is displayed
  
- [ ] **Feature Flags:**
  - [ ] Toggle a feature flag
  - [ ] Feature appears/disappears in app
  
- [ ] **Config:**
  - [ ] Change min_order_amount
  - [ ] Restart app
  - [ ] New amount is enforced at checkout

### Debug Tips:

If something doesn't work:

1. **Check Supabase Logs:**
   - Go to Logs section in Supabase
   - Look for errors

2. **Check App Console:**
   ```typescript
   console.log('Config:', await remoteConfigService.getConfig('min_order_amount'));
   ```

3. **Clear Cache:**
   ```typescript
   remoteConfigService.clearCache();
   ```

---

## Phase 8: Go Live! (5 minutes)

### Pre-Launch Checklist:

- [ ] All migrations run successfully
- [ ] Test banner works
- [ ] Feature flags tested
- [ ] Admin access secured
- [ ] Team trained on Supabase Studio

### Launch:

1. Deploy new app version with dynamic content support
2. Create initial content in Supabase (banners, promotions)
3. Monitor for any issues
4. Celebrate! 🎉

---

## Usage Examples

### Example 1: Seasonal Campaign

**Festival Sale for Diwali:**

```sql
-- Add in Supabase SQL Editor
INSERT INTO banners (title, subtitle, image_url, action_type, action_value, display_order, is_active, start_date, end_date)
VALUES (
  'Diwali Mega Sale! 🪔',
  'Up to 50% off on all categories',
  'https://your-storage-url/diwali-banner.jpg',
  'screen',
  '/(main)/screens/promotions',
  1,
  true,
  '2024-11-01',
  '2024-11-15'
);

INSERT INTO promotions (name, description, code, discount_type, discount_value, is_active, start_date, end_date)
VALUES (
  'Diwali Special',
  'Celebrate Diwali with 50% off on all groceries!',
  'DIWALI50',
  'percentage',
  50,
  true,
  '2024-11-01',
  '2024-11-15'
);
```

**Result:** Instant update! No app submission needed!

### Example 2: A/B Testing

Test a new feature with 50% of users:

```sql
-- Enable for 50% of users gradually
UPDATE feature_flags
SET rollout_percentage = 50
WHERE feature_key = 'quick_reorder';

-- Monitor metrics

-- If successful, roll out to everyone
UPDATE feature_flags
SET rollout_percentage = 100
WHERE feature_key = 'quick_reorder';
```

### Example 3: Emergency Maintenance

Something broke? Enable maintenance mode instantly:

```sql
UPDATE app_config
SET value = '{"enabled": true, "message": "We are fixing an issue. Please check back in 30 minutes."}'
WHERE key = 'maintenance_mode';
```

Then in your app:

```typescript
useEffect(() => {
  const checkMaintenance = async () => {
    const maintenance = await remoteConfigService.isMaintenanceMode();
    if (maintenance.enabled) {
      Alert.alert('Maintenance', maintenance.message);
      // Optionally disable app features
    }
  };
  checkMaintenance();
}, []);
```

---

## Rollback Plan

If something goes wrong:

### Option 1: Disable Content
```sql
-- Disable all banners
UPDATE banners SET is_active = false;

-- Disable all promotions
UPDATE promotions SET is_active = false;

-- Disable feature
UPDATE feature_flags SET is_enabled = false WHERE feature_key = 'problematic_feature';
```

### Option 2: Revert Config
```sql
-- Revert to previous value
UPDATE app_config
SET value = '{"amount": 200, "currency": "INR"}'
WHERE key = 'min_order_amount';
```

### Option 3: Full Rollback
- Publish previous app version
- Keep old code as fallback

---

## Performance Considerations

### Caching Strategy:

The remote config service caches data for 5 minutes by default. Adjust if needed:

```typescript
// In remoteConfigService.ts
private CACHE_DURATION = 5 * 60 * 1000; // Change this value
```

### Optimization Tips:

1. **Preload on App Start:**
   ```typescript
   remoteConfigService.preloadConfigs(); // Loads all common configs
   ```

2. **Lazy Load Banners:**
   Banners only load when home screen mounts

3. **Image Optimization:**
   - Compress images before uploading
   - Use WebP format
   - Supabase Storage serves optimized images automatically

4. **Offline Support:**
   Remote config service stores last-fetched values in AsyncStorage for offline use

---

## Monitoring

### Track Changes:

Create an audit log table:

```sql
CREATE TABLE admin_activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  changes JSONB,
  performed_by UUID REFERENCES profiles(id),
  performed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add trigger to track banner changes
CREATE OR REPLACE FUNCTION log_banner_changes()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO admin_activity_log (action, table_name, record_id, changes, performed_by)
  VALUES (TG_OP, 'banners', NEW.id, row_to_json(NEW), NEW.updated_by);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER banner_changes_trigger
AFTER INSERT OR UPDATE ON banners
FOR EACH ROW EXECUTE FUNCTION log_banner_changes();
```

---

## Common Issues & Solutions

### Issue 1: Banners Not Showing

**Possible Causes:**
- `is_active` is false
- Date range is wrong
- Image URL is broken

**Solution:**
```sql
-- Check banner status
SELECT title, is_active, start_date, end_date, image_url
FROM banners
WHERE id = 'your-banner-id';
```

### Issue 2: Feature Flag Not Working

**Solution:**
```typescript
// Clear cache and refetch
remoteConfigService.clearCache();
const enabled = await remoteConfigService.isFeatureEnabled('voice_search');
console.log('Feature enabled:', enabled);
```

### Issue 3: Config Changes Not Reflecting

**Cause:** Cache is active for 5 minutes

**Solutions:**
1. Wait 5 minutes
2. Force refresh: `remoteConfigService.refreshAllConfigs()`
3. Restart app

---

## Next Steps

After successful integration:

1. ✅ **Train Your Team:**
   - Show them how to use Supabase Studio
   - Create documentation for common tasks
   
2. ✅ **Build Admin Panel:**
   - Follow `ADMIN_DASHBOARD_SETUP.md`
   - Make it user-friendly for non-technical staff

3. ✅ **Plan Content Calendar:**
   - Schedule seasonal campaigns
   - Prepare promotional content in advance

4. ✅ **Monitor Analytics:**
   - Track which banners get clicked
   - Monitor promotion usage
   - A/B test different content

5. ✅ **Scale Up:**
   - Add more dynamic features
   - Implement personalization
   - Regional content targeting

---

## Success Metrics

You'll know it's working when:

- ✅ You can change banners without app updates
- ✅ Promotions go live instantly
- ✅ Feature flags work in real-time
- ✅ Your team can manage content independently
- ✅ No more waiting for Play Store reviews for content changes!

---

## Need Help?

- Check `DYNAMIC_CONTENT_STRATEGY.md` for architecture details
- Check `ADMIN_DASHBOARD_SETUP.md` for admin panel setup
- Supabase Discord: https://discord.supabase.com
- GitHub Issues: Create an issue in your repo

---

**Congratulations!** Your app is now dynamic like Blinkit and Amazon! 🚀

