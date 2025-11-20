/**
 * Google Analytics 4 Integration
 * 
 * This module provides utilities for tracking page views and custom events
 * with Google Analytics 4.
 */

// Type definitions for GA4 events
export interface GAEvent {
  action: string;
  category: string;
  label?: string;
  value?: number;
}

export interface GAPageView {
  page_path: string;
  page_title: string;
}

// Check if GA is available
export const isGAAvailable = (): boolean => {
  return typeof window !== 'undefined' && typeof window.gtag !== 'undefined';
};

/**
 * Track page views
 * @param url - The page URL
 * @param title - The page title
 */
export const trackPageView = (url: string, title?: string): void => {
  if (!isGAAvailable()) return;

  window.gtag('config', process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID!, {
    page_path: url,
    page_title: title,
  });
};

/**
 * Track custom events
 * @param event - Event details
 */
export const trackEvent = ({ action, category, label, value }: GAEvent): void => {
  if (!isGAAvailable()) return;

  window.gtag('event', action, {
    event_category: category,
    event_label: label,
    value: value,
  });
};

/**
 * Track inquiry form submissions
 * @param enquiryType - Type of enquiry (seller, contact, general)
 * @param sellerId - Optional seller ID for seller enquiries
 */
export const trackInquirySubmission = (
  enquiryType: 'seller' | 'contact' | 'general',
  sellerId?: string
): void => {
  trackEvent({
    action: 'form_submission',
    category: 'Inquiry',
    label: `${enquiryType}${sellerId ? ` - ${sellerId}` : ''}`,
    value: sellerId ? 1 : 0,
  });

  // Track as conversion
  if (isGAAvailable()) {
    window.gtag('event', 'conversion', {
      send_to: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
      event_category: 'Inquiry',
      event_label: enquiryType,
    });
  }
};

/**
 * Track seller profile views
 * @param sellerId - The seller ID
 * @param sellerName - The seller business name
 */
export const trackSellerView = (sellerId: string, sellerName: string): void => {
  trackEvent({
    action: 'view_seller_profile',
    category: 'Seller',
    label: sellerName,
  });

  // Track as enhanced ecommerce view_item event
  if (isGAAvailable()) {
    window.gtag('event', 'view_item', {
      items: [
        {
          item_id: sellerId,
          item_name: sellerName,
          item_category: 'Seller Profile',
        },
      ],
    });
  }
};

/**
 * Track "Enquire Details" button clicks
 * @param sellerId - The seller ID
 * @param sellerName - The seller business name
 */
export const trackEnquireClick = (sellerId: string, sellerName: string): void => {
  trackEvent({
    action: 'click_enquire_button',
    category: 'Engagement',
    label: `${sellerName} (${sellerId})`,
  });
};

/**
 * Track marketplace filter usage
 * @param filterType - Type of filter (businessType, category, radius)
 * @param filterValue - The filter value
 */
export const trackFilterUsage = (filterType: string, filterValue: string): void => {
  trackEvent({
    action: 'use_filter',
    category: 'Marketplace',
    label: `${filterType}: ${filterValue}`,
  });
};

/**
 * Track search actions
 * @param searchTerm - The search term
 */
export const trackSearch = (searchTerm: string): void => {
  trackEvent({
    action: 'search',
    category: 'Marketplace',
    label: searchTerm,
  });

  // Track as GA4 search event
  if (isGAAvailable()) {
    window.gtag('event', 'search', {
      search_term: searchTerm,
    });
  }
};

/**
 * Track user location
 * @param city - User's city
 * @param state - User's state
 * @param method - How location was obtained (browser, ip, manual)
 */
export const trackUserLocation = (
  city: string,
  state: string,
  method: 'browser' | 'ip' | 'manual'
): void => {
  trackEvent({
    action: 'location_detected',
    category: 'Geolocation',
    label: `${city}, ${state} (${method})`,
  });
};

/**
 * Track seller discovery patterns
 * @param sellersFound - Number of sellers found
 * @param radius - Search radius used
 * @param userCity - User's city
 */
export const trackSellerDiscovery = (
  sellersFound: number,
  radius: number,
  userCity: string
): void => {
  trackEvent({
    action: 'discover_sellers',
    category: 'Marketplace',
    label: userCity,
    value: sellersFound,
  });

  // Custom dimension for radius
  if (isGAAvailable()) {
    window.gtag('event', 'seller_discovery', {
      sellers_found: sellersFound,
      search_radius: radius,
      user_location: userCity,
    });
  }
};

/**
 * Track marketplace usage by region
 * @param region - User's region/state
 * @param action - Action taken (view, filter, search)
 */
export const trackRegionalUsage = (region: string, action: string): void => {
  trackEvent({
    action: 'regional_activity',
    category: 'Geography',
    label: `${region} - ${action}`,
  });
};

// Extend Window interface for TypeScript
declare global {
  interface Window {
    gtag: (
      command: string,
      targetId: string | Date,
      config?: Record<string, any>
    ) => void;
    dataLayer: any[];
  }
}
