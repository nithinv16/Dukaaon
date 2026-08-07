# 🔧 Fix: Migration Error - Quick Solution

## ❌ The Error

```
ERROR: new row violates check constraint "home_sections_section_type_check"
```

---

## ✅ The Fix (30 seconds)

### Step 1: Run This Migration First

**Open Supabase SQL Editor** and run this **NEW** file:

📁 **File:** `supabase/migrations/20250113_fix_home_sections_constraint.sql`

```sql
-- Just copy the entire file and paste into SQL Editor
-- Then click "Run"
```

⏱️ Takes: 1 second

---

### Step 2: Now Run Sample Data Again

**Run this file** (it will work now):

📁 **File:** `supabase/migrations/20250113_sample_home_sections_data.sql`

```sql
-- Copy entire file and paste into SQL Editor
-- Then click "Run"
```

⏱️ Takes: 2 seconds  
✅ Should work without errors!

---

## 📋 Complete Migration Order

If starting fresh, run in this order:

```
1. 20250107_dynamic_content_CLEAN.sql              (if not done)
2. 20250113_fix_home_sections_constraint.sql       ⭐ NEW - Run this!
3. 20250113_purchase_tracking_personalization.sql
4. 20250113_sample_home_sections_data.sql
```

---

## 🎯 What Happened

**Problem:** The `home_sections` table only allowed these section types:
- ❌ 'banner', 'category_grid', 'product_carousel', etc.

**But we're using:**
- ✅ 'categories', 'products', 'personalized', 'sellers', 'manufacturers'

**Solution:** The fix migration updates the constraint to allow BOTH old and new names!

---

## ✅ Verify It Worked

Run this in SQL Editor:

```sql
-- Should show 7 sections
SELECT section_type, title, display_order 
FROM home_sections 
ORDER BY display_order;
```

**Expected result:**
```
banner          | Promotions             | 1
categories      | Shop by Category       | 2
products        | Trending Products      | 3
personalized    | Recommended for You    | 4
products        | New Arrivals           | 5
sellers         | Nearby Wholesalers     | 6
manufacturers   | Nearby Manufacturers   | 7
```

---

## 🚀 Next Steps

1. ✅ Run the fix migration (if you haven't)
2. ✅ Run sample data migration
3. ✅ Restart your app
4. ✅ Check home page - should show all sections!

---

**That's it! The error is fixed.** 🎉

---

## 💡 Why This Happened

The original `home_sections` table was created with a strict check constraint. Our new component uses more intuitive section type names like 'categories' and 'products' instead of 'category_grid' and 'product_carousel'.

The fix migration updates the constraint to support both naming conventions, so everything is backward compatible!

---

**Just run the fix migration and you're good to go!** ✨

