import { Metadata, Viewport } from 'next';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string[];
  ogImage?: string;
  ogType?: 'website' | 'article';
  canonical?: string;
  noindex?: boolean;
}

export function generateMetadata({
  title = 'DukaaOn - Tech-Enabled Distribution Platform',
  description = 'DukaaOn is a tech-enabled distribution and financial inclusion platform for rural and semi-urban retailers, connecting them with wholesalers and manufacturers.',
  keywords = [
    'DukaaOn',
    'distribution platform',
    'rural retail',
    'wholesalers',
    'manufacturers',
    'supply chain',
    'India',
  ],
  ogImage = '/og-image.jpg',
  ogType = 'website',
  canonical,
  noindex = false,
}: SEOProps = {}): Metadata {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://dukaaon.in';
  
  return {
    title,
    description,
    keywords,
    authors: [{ name: 'DukaaOn' }],
    robots: noindex ? 'noindex, nofollow' : 'index, follow',
    ...(canonical && { alternates: { canonical: `${baseUrl}${canonical}` } }),
    openGraph: {
      title,
      description,
      type: ogType,
      locale: 'en_IN',
      url: canonical ? `${baseUrl}${canonical}` : baseUrl,
      siteName: 'DukaaOn',
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
      creator: '@dukaaon',
      site: '@dukaaon',
    },
    verification: {
      // Add verification codes when available
      // google: 'your-google-verification-code',
      // yandex: 'your-yandex-verification-code',
    },
  };
}

// Viewport configuration (must be exported separately in Next.js 14+)
export function generateViewport(): Viewport {
  return {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
  };
}

// Structured Data for Organization
export function generateOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'DukaaOn',
    url: process.env.NEXT_PUBLIC_SITE_URL || 'https://dukaaon.in',
    logo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://dukaaon.in'}/logo.png`,
    description:
      'Tech-enabled distribution and financial inclusion platform for rural and semi-urban retailers',
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+91-8089668552',
      contactType: 'Customer Service',
      email: 'support@dukaaon.in',
      areaServed: 'IN',
      availableLanguage: ['English', 'Hindi'],
    },
    sameAs: [
      // Add social media URLs when available
      'https://www.facebook.com/dukaaon',
      'https://www.twitter.com/dukaaon',
      'https://www.linkedin.com/company/dukaaon',
    ],
  };
}

// Structured Data for Breadcrumbs
export function generateBreadcrumbSchema(items: { name: string; url: string }[]) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://dukaaon.in';
  
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${baseUrl}${item.url}`,
    })),
  };
}

// Structured Data for Local Business (for seller profiles)
export function generateLocalBusinessSchema(seller: {
  name: string;
  description: string;
  address: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  categories: string[];
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: seller.name,
    description: seller.description,
    address: {
      '@type': 'PostalAddress',
      streetAddress: seller.address,
      addressLocality: seller.city,
      addressRegion: seller.state,
      addressCountry: 'IN',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: seller.latitude,
      longitude: seller.longitude,
    },
    ...(seller.categories.length > 0 && {
      hasOfferCatalog: {
        '@type': 'OfferCatalog',
        name: 'Products',
        itemListElement: seller.categories.map((category) => ({
          '@type': 'OfferCatalog',
          name: category,
        })),
      },
    }),
  };
}
