# Admin Dashboard Setup Guide

## Overview
This guide will help you create a web-based admin panel to manage all dynamic content in your Dukaaon app without requiring app updates.

---

## Option 1: Quick Setup with Supabase Studio (Easiest)

### What is Supabase Studio?
Supabase Studio is a built-in admin interface that comes with your Supabase project. You can use it to manage your dynamic content directly.

### How to Access:
1. Go to your Supabase Dashboard: https://app.supabase.com
2. Select your project (dukaaon)
3. Click on "Table Editor" in the left sidebar

### Managing Content:

#### **Banners**
1. Click on `banners` table
2. Click "Insert row" to add a new banner
3. Fill in:
   - `title`: Banner headline
   - `subtitle`: Optional subtitle
   - `image_url`: Upload image to Storage first, then paste URL
   - `action_type`: Choose from dropdown (category/product/screen/url)
   - `action_value`: Enter category ID, product ID, or URL
   - `display_order`: Order (1, 2, 3, etc.)
   - `is_active`: ✓ to make it live
   - `start_date`: When to start showing
   - `end_date`: When to stop showing

#### **Promotions**
1. Click on `promotions` table
2. Click "Insert row"
3. Fill in:
   - `name`: Promotion name (e.g., "Summer Sale")
   - `description`: Details about the offer
   - `code`: Discount code (e.g., "SUMMER50")
   - `discount_type`: percentage/fixed/bogo/free_shipping
   - `discount_value`: 50 (for 50% or ₹50)
   - `is_active`: ✓
   - `start_date` & `end_date`

#### **Feature Flags**
1. Click on `feature_flags` table
2. Toggle `is_enabled` column for any feature
3. Changes take effect immediately!

#### **App Config**
1. Click on `app_config` table
2. Edit `value` column (JSON format)
3. Example: Change min order amount:
   ```json
   {"amount": 300, "currency": "INR"}
   ```

### Uploading Images:
1. Click "Storage" in left sidebar
2. Create a bucket called "banners" (set to Public)
3. Upload your images
4. Click image → Copy URL → Paste in `image_url` field

---

## Option 2: Build Custom Admin Panel (Advanced)

If you want a more user-friendly interface for your team, build a custom admin panel.

### Tech Stack:
- **Next.js** (React-based, easy to deploy)
- **Supabase JS Client** (already using it)
- **Tailwind CSS** (for styling)

### Quick Setup:

#### 1. Create Next.js Admin App

```bash
# In a new directory (separate from your React Native app)
npx create-next-app@latest dukaaon-admin
cd dukaaon-admin

# Install Supabase client
npm install @supabase/supabase-js

# Install UI library (optional but recommended)
npm install @shadcn/ui
```

#### 2. Configure Supabase

Create `lib/supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
```

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

#### 3. Create Admin Pages

**Banner Management Page** - `pages/admin/banners.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export default function BannersAdmin() {
  const [banners, setBanners] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [formData, setFormData] = useState({
    title: '',
    subtitle: '',
    image_url: '',
    action_type: 'category',
    action_value: '',
    display_order: 1,
    is_active: true,
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  });

  useEffect(() => {
    fetchBanners();
  }, []);

  const fetchBanners = async () => {
    const { data, error } = await supabase
      .from('banners')
      .select('*')
      .order('display_order', { ascending: true });
    
    if (!error) setBanners(data || []);
    setIsLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const { data, error } = await supabase
      .from('banners')
      .insert([formData])
      .select();
    
    if (!error) {
      alert('Banner created successfully! ✅');
      fetchBanners();
      // Reset form
      setFormData({
        title: '',
        subtitle: '',
        image_url: '',
        action_type: 'category',
        action_value: '',
        display_order: 1,
        is_active: true,
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      });
    } else {
      alert('Error: ' + error.message);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Upload to Supabase Storage
    const fileName = `banner-${Date.now()}.${file.name.split('.').pop()}`;
    const { data, error } = await supabase.storage
      .from('banners')
      .upload(fileName, file);
    
    if (!error) {
      const { data: { publicUrl } } = supabase.storage
        .from('banners')
        .getPublicUrl(fileName);
      
      setFormData({ ...formData, image_url: publicUrl });
    }
  };

  const toggleBannerStatus = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('banners')
      .update({ is_active: !currentStatus })
      .eq('id', id);
    
    if (!error) fetchBanners();
  };

  const deleteBanner = async (id: string) => {
    if (!confirm('Are you sure you want to delete this banner?')) return;
    
    const { error } = await supabase
      .from('banners')
      .delete()
      .eq('id', id);
    
    if (!error) fetchBanners();
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Manage Banners</h1>

      {/* Create Banner Form */}
      <div className="bg-white shadow-md rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Create New Banner</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full border rounded px-3 py-2"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Subtitle (Optional)</label>
            <input
              type="text"
              value={formData.subtitle}
              onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Upload Image</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="w-full border rounded px-3 py-2"
            />
            {formData.image_url && (
              <img src={formData.image_url} alt="Preview" className="mt-2 h-32 rounded" />
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Action Type</label>
              <select
                value={formData.action_type}
                onChange={(e) => setFormData({ ...formData, action_type: e.target.value })}
                className="w-full border rounded px-3 py-2"
              >
                <option value="category">Category</option>
                <option value="product">Product</option>
                <option value="screen">Screen</option>
                <option value="url">URL</option>
                <option value="none">No Action</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Action Value</label>
              <input
                type="text"
                value={formData.action_value}
                onChange={(e) => setFormData({ ...formData, action_value: e.target.value })}
                className="w-full border rounded px-3 py-2"
                placeholder="e.g., category ID, product ID, or URL"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Position</label>
              <input
                type="number"
                value={formData.display_order}
                onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) })}
                className="w-full border rounded px-3 py-2"
                min="1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Start Date</label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full border rounded px-3 py-2"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">End Date</label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="w-full border rounded px-3 py-2"
                required
              />
            </div>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="mr-2"
            />
            <label className="text-sm font-medium">Active</label>
          </div>

          <button
            type="submit"
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
          >
            Create Banner
          </button>
        </form>
      </div>

      {/* Existing Banners */}
      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Existing Banners</h2>
        
        {isLoading ? (
          <p>Loading...</p>
        ) : banners.length === 0 ? (
          <p>No banners yet. Create your first one above!</p>
        ) : (
          <div className="space-y-4">
            {banners.map((banner: any) => (
              <div key={banner.id} className="border rounded-lg p-4 flex items-center gap-4">
                <img
                  src={banner.image_url}
                  alt={banner.title}
                  className="w-32 h-20 object-cover rounded"
                />
                <div className="flex-1">
                  <h3 className="font-semibold">{banner.title}</h3>
                  <p className="text-sm text-gray-600">{banner.subtitle}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Position: {banner.display_order} | {banner.action_type}: {banner.action_value}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => toggleBannerStatus(banner.id, banner.is_active)}
                    className={`px-4 py-2 rounded ${
                      banner.is_active ? 'bg-green-600 text-white' : 'bg-gray-300'
                    }`}
                  >
                    {banner.is_active ? 'Active' : 'Inactive'}
                  </button>
                  <button
                    onClick={() => deleteBanner(banner.id)}
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

**Similar pages for:**
- `pages/admin/promotions.tsx` - Manage promotions
- `pages/admin/categories.tsx` - Manage categories
- `pages/admin/config.tsx` - Manage app config
- `pages/admin/features.tsx` - Toggle feature flags

#### 4. Deploy Admin Panel

**Vercel (Recommended - Free):**
```bash
npm install -g vercel
vercel
```

**Netlify:**
```bash
npm run build
# Deploy the .next folder
```

---

## Option 3: Use Existing Admin Templates

### Recommended Templates:

1. **Refine Admin** (https://refine.dev/)
   - Built for data-heavy apps
   - Supabase integration out of the box
   - Free and open-source

2. **React Admin** (https://marmelab.com/react-admin/)
   - Enterprise-grade
   - Supabase data provider available

3. **AdminJS** (https://adminjs.co/)
   - Auto-generates admin panel
   - Minimal setup required

---

## Security Considerations

### Protect Your Admin Panel

1. **Add Authentication:**
```typescript
// In admin pages, add this check:
useEffect(() => {
  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
    }
  };
  checkAuth();
}, []);
```

2. **Create Admin Role in Supabase:**

```sql
-- Add role column to profiles
ALTER TABLE profiles ADD COLUMN role TEXT DEFAULT 'user';

-- Set your user as admin
UPDATE profiles SET role = 'admin' WHERE email = 'your@email.com';

-- Create RLS policies
CREATE POLICY "Only admins can modify banners"
  ON banners
  FOR INSERT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
```

3. **Use Environment Variables:**
Never expose your service role key in the admin panel. Use the anon key with proper RLS policies.

---

## Workflow Example

### Scenario: Add a Diwali Sale Banner

**Without Admin Panel (Old Way):**
1. Edit code locally
2. Upload new banner image to assets
3. Rebuild app
4. Test thoroughly
5. Upload to Play Store
6. Wait for review (1-7 days)
7. Users update app

**With Admin Panel (New Way):**
1. Login to admin panel
2. Click "Create Banner"
3. Upload Diwali banner image
4. Set title: "Diwali Sale - 50% OFF"
5. Set dates: Nov 1 - Nov 15
6. Click "Publish"
7. **DONE! Users see it immediately!** ✨

---

## Monitoring & Analytics

### Add Usage Tracking:

```typescript
// In your admin panel
const logAdminAction = async (action: string, details: any) => {
  await supabase.from('admin_logs').insert({
    action,
    details,
    user_id: currentUser.id,
    timestamp: new Date().toISOString(),
  });
};

// Call after actions
await logAdminAction('banner_created', { banner_id: newBanner.id });
```

---

## Best Practices

1. **Test in Staging First:**
   - Create a staging Supabase project
   - Test all changes there first
   - Then apply to production

2. **Schedule Content:**
   - Use start_date and end_date effectively
   - Plan campaigns in advance
   - Automate seasonal changes

3. **Version Control:**
   - Keep admin panel code in Git
   - Document all changes
   - Have rollback plan

4. **Performance:**
   - Optimize images before uploading
   - Use CDN for images (Supabase Storage does this automatically)
   - Set reasonable cache durations

5. **Content Calendar:**
   - Plan promotions ahead of time
   - Schedule seasonal banners
   - Coordinate with marketing team

---

## Quick Commands Reference

```bash
# Check active banners
psql -c "SELECT title, is_active FROM banners WHERE is_active = true;"

# Toggle feature flag
psql -c "UPDATE feature_flags SET is_enabled = NOT is_enabled WHERE feature_key = 'voice_search';"

# Update app config
psql -c "UPDATE app_config SET value = '{\"amount\": 250}' WHERE key = 'min_order_amount';"
```

---

## Need Help?

- **Supabase Docs:** https://supabase.com/docs
- **Next.js Docs:** https://nextjs.org/docs
- **Community:** https://github.com/supabase/supabase/discussions

---

**Remember:** Once you set this up, you'll NEVER need to submit an app update for content changes again! 🎉

