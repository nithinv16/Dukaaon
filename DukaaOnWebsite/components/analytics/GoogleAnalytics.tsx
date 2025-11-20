'use client';

import Script from 'next/script';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { trackPageView } from '@/lib/analytics';

interface GoogleAnalyticsProps {
  measurementId: string;
}

/**
 * Google Analytics 4 Component
 * 
 * This component loads the GA4 tracking script and handles automatic page view tracking.
 * It should be included in the root layout.
 */
export default function GoogleAnalytics({ measurementId }: GoogleAnalyticsProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Track page views on route changes
  useEffect(() => {
    if (!measurementId) return;

    const url = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '');
    trackPageView(url, document.title);
  }, [pathname, searchParams, measurementId]);

  // Don't load GA in development unless explicitly enabled
  if (process.env.NODE_ENV === 'development' && !process.env.NEXT_PUBLIC_GA_DEBUG) {
    return null;
  }

  if (!measurementId) {
    console.warn('Google Analytics Measurement ID is not configured');
    return null;
  }

  return (
    <>
      {/* Google Analytics gtag.js script */}
      <Script
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
      />
      
      {/* Initialize gtag */}
      <Script
        id="google-analytics-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${measurementId}', {
              page_path: window.location.pathname,
              send_page_view: true
            });
          `,
        }}
      />
    </>
  );
}
