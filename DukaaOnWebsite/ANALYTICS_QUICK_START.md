# Analytics Quick Start Guide

## Setup (5 minutes)

### 1. Get Your GA4 Measurement ID

1. Go to [Google Analytics](https://analytics.google.com/)
2. Create a new GA4 property
3. Copy your Measurement ID (format: `G-XXXXXXXXXX`)

### 2. Add to Environment Variables

Create or update `.env.local`:

```bash
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

### 3. Restart Development Server

```bash
npm run dev
```

That's it! Analytics is now tracking.

## What's Being Tracked

✅ **Page Views** - Automatic on every page  
✅ **Form Submissions** - Inquiry and contact forms  
✅ **Seller Views** - When users view seller profiles  
✅ **Enquire Clicks** - "Enquire Details" button clicks  
✅ **Filter Usage** - Marketplace filters and search  
✅ **Location Data** - User location detection  
✅ **Seller Discovery** - How many sellers users find  

## Verify It's Working

### Option 1: Browser DevTools
1. Open DevTools → Network tab
2. Filter by "google-analytics"
3. Navigate the site - you should see requests

### Option 2: GA4 Realtime
1. Go to GA4 → Reports → Realtime
2. Navigate your site
3. See events appear in real-time

### Option 3: GA Debugger Extension
1. Install [GA Debugger](https://chrome.google.com/webstore/detail/google-analytics-debugger/)
2. Enable it
3. Check console for GA events

## Key Events to Monitor

| Event | What It Tracks | Where to Find in GA4 |
|-------|---------------|---------------------|
| `form_submission` | Inquiry submissions | Events → form_submission |
| `view_seller_profile` | Seller page views | Events → view_seller_profile |
| `click_enquire_button` | Enquire button clicks | Events → click_enquire_button |
| `use_filter` | Filter usage | Events → use_filter |
| `search` | Search queries | Events → search |
| `seller_discovery` | Sellers found | Events → seller_discovery |

## Mark Events as Conversions

1. Go to GA4 → Configure → Events
2. Find these events:
   - `form_submission`
   - `click_enquire_button`
3. Click "Mark as conversion"

## Troubleshooting

**Events not showing?**
- Check measurement ID is correct
- Disable ad blockers
- Wait 24-48 hours for standard reports (use Realtime for instant feedback)

**Development mode?**
- Analytics is disabled in dev by default
- To enable: `NEXT_PUBLIC_GA_DEBUG=true`

## Next Steps

📖 Read [ANALYTICS_IMPLEMENTATION.md](./ANALYTICS_IMPLEMENTATION.md) for detailed documentation  
📊 Set up custom reports in GA4  
🎯 Configure conversion goals  
🔒 Implement cookie consent (before production)  

## Need Help?

- [GA4 Documentation](https://developers.google.com/analytics/devguides/collection/ga4)
- [Next.js Analytics Guide](https://nextjs.org/docs/app/building-your-application/optimizing/analytics)
