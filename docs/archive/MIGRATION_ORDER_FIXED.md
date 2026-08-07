# 🔧 Migration Order - FIXED

## ❌ Error You Got

```
ERROR: 23514: new row for relation "home_sections" violates check constraint
"home_sections_section_type_check"
```

**Cause:** The `home_sections` table only allowed certain section types, but we're using new names.

---

## ✅ Fixed Migration Order

Run these SQL files **IN THIS EXACT ORDER** in Supabase SQL Editor:

### 1️⃣ Dynamic Content Tables (if not done yet)
**File:** `supabase/migrations/20250107_dynamic_content_CLEAN.sql`

```bash
# Copy entire file → Paste in Supabase SQL Editor → Run
```

⏱️ Takes: 5 seconds  
✅ Creates: banners, categories, home_sections, etc.

---

### 2️⃣ **FIX: Update home_sections Constraint** ⚠️
**File:** `supabase/migrations/20250113_fix_home_sections_constraint.sql` ⭐ **NEW - Run this first!**

```bash
# Copy entire file → Paste in Supabase SQL Editor → Run
```

⏱️ Takes: 1 second  
✅ Fixes: Allows 'categories', 'products', 'personalized', 'sellers', 'manufacturers'

---

### 3️⃣ Purchase Tracking & Personalization
**File:** `supabase/migrations/20250113_purchase_tracking_personalization.sql`

```bash
# Copy entire file → Paste in Supabase SQL Editor → Run
```

⏱️ Takes: 3 seconds  
✅ Creates: purchase_history, product_recommendations, functions

---

### 4️⃣ Sample Data (for testing)
**File:** `supabase/migrations/20250113_sample_home_sections_data.sql`

```bash
# Copy entire file → Paste in Supabase SQL Editor → Run
```

⏱️ Takes: 2 seconds  
✅ Inserts: 7 home sections, 8 categories, 3 banners

---

## 📋 Quick Checklist

```bash
✅ Step 1: Run 20250107_dynamic_content_CLEAN.sql
✅ Step 2: Run 20250113_fix_home_sections_constraint.sql ⭐ NEW
✅ Step 3: Run 20250113_purchase_tracking_personalization.sql
✅ Step 4: Run 20250113_sample_home_sections_data.sql
✅ Step 5: Restart app and test
```

---

## 🎯 What the Fix Does

### Before (Original Constraint):
```sql
section_type IN (
  'banner',
  'category_grid',      -- Old name
  'product_carousel',   -- Old name
  'offer_banner',
  'quick_links',
  'brand_carousel',
  'video_banner'
)
```

### After (Updated Constraint):
```sql
section_type IN (
  'banner',
  'categories',         -- ✨ NEW (our name)
  'category_grid',      -- Old name (still works)
  'products',           -- ✨ NEW (our name)
  'product_carousel',   -- Old name (still works)
  'personalized',       -- ✨ NEW
  'sellers',            -- ✨ NEW
  'manufacturers',      -- ✨ NEW
  'offer_banner',
  'quick_links',
  'brand_carousel',
  'video_banner'
)
```

**Now supports both old and new naming!** ✅

---

## 🔍 Verify Success

After running all migrations, verify:

```sql
-- Check constraint updated
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conname = 'home_sections_section_type_check';

-- Check home sections inserted
SELECT section_type, title, display_order, is_active 
FROM home_sections 
ORDER BY display_order;
-- Should show 7 sections

-- Check categories
SELECT COUNT(*) FROM categories WHERE is_active = true;
-- Should show 8 categories

-- Check banners
SELECT COUNT(*) FROM banners WHERE is_active = true;
-- Should show 3 banners
```

---

## 🚀 After Running Migrations

1. **Restart your app**
   ```bash
   npm start
   ```

2. **Open home page**
   
3. **You should see:**
   - ✅ Dynamic banners
   - ✅ Category carousel
   - ✅ Product carousels
   - ✅ Nearby sellers/manufacturers

---

## ⚠️ Important Notes

1. **Run migrations in order!** The fix (step 2) must run BEFORE sample data (step 4)

2. **If you already ran sample data and got error:**
   ```sql
   -- Clear bad data first
   DELETE FROM home_sections;
   
   -- Then run the fix migration
   -- Then run sample data again
   ```

3. **The fix is backward compatible** - supports both old and new section type names

---

## 📚 Summary

**Problem:** Check constraint too restrictive  
**Solution:** Updated constraint to include new section types  
**Status:** ✅ Fixed!  
**Action:** Run migrations in the order above  

---

**Now your migrations will run successfully!** 🎉

