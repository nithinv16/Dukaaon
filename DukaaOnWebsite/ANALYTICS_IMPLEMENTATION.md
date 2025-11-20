# Analytics Implementation Guide

This document describes the Google Analytics 4 (GA4) implementation for the DukaaOn website.

## Overview

The website uses Google Analytics 4 to track user behavior, conversions, and geographic patterns. Analytics tracking is implemented throughout the application to provide insights into:

- Page views and navigation patterns
- Form submissions (inquiries and contact)
- Seller profile views
- Marketplace filter usage
- Geographic distribution of visitors
- Seller discovery patterns

## Setup Instructions

### 1. Create GA4 Property

1. Go to [Google Analytics](https://analytics.google.com/)
2. Create a new GA4 property for DukaaOn website
3. Copy the Measurement ID (format: `G-XXXXXXXXXX`)

### 2. Configure Environment Variables

Add the following to your `.env.local` file:

```bash
# Google Analytics 4
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX

# Optional: Enable GA in development mode
NEXT_PUBLIC_GA_DEBUG=false
```

### 3. Verify Installation

1. Start the development server: `npm run dev`
2. Open the website in your browser
3. Open browser DevTools → Network tab
4. Look for requests to `google-analytics.com/g/collect`
5. Alternatively, use the [GA Debugger Chrome Extension](https://chrome.google.com/webstore/detail/google-analytics-debugger/)

## Implementation Details

### Core Components

#### 1. GoogleAnalytics Component (`components/analytics/GoogleAnalytics.tsx`)

This component loads the GA4 tracking script and handles automatic page view tracking. It's included in the root layout and:

- Loads the gtag.js script from Google
- Initializes GA4 with the measurement ID
- Tracks page views on route changes
- Disabled in development by default (unless `NEXT_PUBLIC_GA_DEBUG=true`)

#### 2. Analytics Library (`lib/analytics.ts`)

Provides utility functions for tracking custom events:

**Page Tracking:**
- `trackPageView(url, title)` - Track page views

**Conversion Tracking:**
- `trackInquirySubmission(enquiryType, sellerId)` - Track form submissions
- `trackSellerView(sellerId, sellerName)` - Track seller profile views
- `trackEnquireClick(sellerId, sellerName)` - Track "Enquire Details" button clicks

**Marketplace Tracking:**
- `trackFilterUsage(filterType, filterValue)` - Track filter usage
- `trackSearch(searchTerm)` - Track search queries
- `trackSellerDiscovery(sellersFound, radius, userCity)` - Track seller discovery

**Geographic Tracking:**
- `trackUserLocation(city, state, method)` - Track user location detection
- `trackRegionalUsage(region, action)` - Track regional activity patterns

### Tracked Events

#### 1. Page Views
- **Event:** `page_view`
- **Trigger:** Automatic on route change
- **Data:** Page path, page title

#### 2. Inquiry Form Submissions
- **Event:** `form_submission` + `conversion`
- **Trigger:** Successful form submission
- **Data:** Enquiry type (seller/contact/general), seller ID
- **Location:** `components/forms/EnquiryForm.tsx`

#### 3. Seller Profile Views
- **Event:** `view_seller_profile` + `view_item`
- **Trigger:** Seller profile page load
- **Data:** Seller ID, seller name
- **Location:** `app/seller/[id]/page.tsx`

#### 4. Enquire Button Clicks
- **Event:** `click_enquire_button`
- **Trigger:** "Enquire Details" button click
- **Data:** Seller ID, seller name
- **Location:** `components/seller/EnquireButton.tsx`

#### 5. Marketplace Filter Usage
- **Event:** `use_filter`
- **Trigger:** Filter change (business type, category, radius)
- **Data:** Filter type, filter value
- **Location:** `components/marketplace/MarketplaceFilters.tsx`

#### 6. Search Queries
- **Event:** `search`
- **Trigger:** Search input change
- **Data:** Search term
- **Location:** `components/marketplace/MarketplaceFilters.tsx`

#### 7. Seller Discovery
- **Event:** `seller_discovery`
- **Trigger:** Sellers loaded in marketplace
- **Data:** Number of sellers found, search radius, user city
- **Location:** `app/marketplace/page.tsx`

#### 8. Location Detection
- **Event:** `location_detected`
- **Trigger:** User location obtained
- **Data:** City, state, detection method (browser/ip/manual)
- **Location:** `hooks/useGeolocation.ts`

#### 9. Regional Activity
- **Event:** `regional_activity`
- **Trigger:** Various marketplace actions
- **Data:** Region, action type
- **Location:** Multiple locations

## Custom Dimensions and Metrics

The following custom data is tracked with events:

- **sellers_found** - Number of sellers discovered
- **search_radius** - Search radius in kilometers
- **user_location** - User's city/region
- **search_term** - Search query text
- **filter_type** - Type of filter applied
- **detection_method** - How location was obtained

## GA4 Dashboard Setup

### Recommended Reports

1. **Conversion Funnel**
   - Marketplace visits → Seller views → Enquire clicks → Form submissions

2. **Geographic Analysis**
   - User locations by city/state
   - Seller discovery patterns by region
   - Regional conversion rates

3. **Marketplace Engagement**
   - Filter usage frequency
   - Search queries
   - Average sellers discovered per session

4. **Seller Performance**
   - Most viewed sellers
   - Sellers with highest enquiry rates
   - Category popularity

### Custom Events to Configure in GA4

1. Go to GA4 → Configure → Events
2. Mark the following as conversions:
   - `form_submission`
   - `conversion`
   - `click_enquire_button`

### Recommended Explorations

1. **User Journey Analysis**
   - Path: Home → Marketplace → Seller Profile → Enquiry

2. **Geographic Heatmap**
   - User locations and seller discovery patterns

3. **Conversion Attribution**
   - Which pages/actions lead to enquiries

## Privacy Considerations

- No personally identifiable information (PII) is tracked
- User location is only tracked at city/state level
- IP addresses are anonymized by GA4
- Cookie consent should be implemented before production deployment

## Testing

### Development Testing

1. Set `NEXT_PUBLIC_GA_DEBUG=true` in `.env.local`
2. Open browser DevTools → Console
3. Look for GA debug messages
4. Use [GA Debugger extension](https://chrome.google.com/webstore/detail/google-analytics-debugger/)

### Production Testing

1. Use [Google Tag Assistant](https://tagassistant.google.com/)
2. Check GA4 Realtime reports
3. Verify events appear in GA4 DebugView

## Troubleshooting

### Events Not Appearing

1. Check that `NEXT_PUBLIC_GA_MEASUREMENT_ID` is set correctly
2. Verify the measurement ID format (should be `G-XXXXXXXXXX`)
3. Check browser console for errors
4. Ensure ad blockers are disabled during testing
5. Wait 24-48 hours for data to appear in standard reports (use Realtime for immediate feedback)

### Page Views Not Tracking

1. Verify `GoogleAnalytics` component is included in root layout
2. Check that the component is not being blocked by CSP headers
3. Ensure Next.js App Router is being used (not Pages Router)

### Custom Events Not Firing

1. Check that the tracking function is being called
2. Verify `window.gtag` is defined (check `isGAAvailable()`)
3. Look for JavaScript errors in console
4. Test in production mode (`npm run build && npm start`)

## Future Enhancements

1. **Enhanced Geographic Tracking**
   - Implement reverse geocoding to get actual city/state names
   - Track user location with more precision

2. **User Segmentation**
   - Track stakeholder types (investor, retailer, wholesaler, etc.)
   - Create custom audiences based on behavior

3. **A/B Testing**
   - Integrate with Google Optimize or similar tool
   - Test different CTAs and layouts

4. **Enhanced Ecommerce**
   - Track seller "products" as items
   - Implement product impression tracking

5. **Cookie Consent**
   - Implement cookie consent banner
   - Respect user privacy preferences
   - Integrate with consent management platform

## Resources

- [GA4 Documentation](https://developers.google.com/analytics/devguides/collection/ga4)
- [gtag.js Reference](https://developers.google.com/tag-platform/gtagjs/reference)
- [GA4 Event Reference](https://developers.google.com/analytics/devguides/collection/ga4/reference/events)
- [Next.js Analytics Guide](https://nextjs.org/docs/app/building-your-application/optimizing/analytics)

## Support

For issues or questions about analytics implementation, contact the development team or refer to the GA4 documentation.
