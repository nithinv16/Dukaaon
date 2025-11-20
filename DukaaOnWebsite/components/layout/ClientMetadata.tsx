'use client';

import { useEffect } from 'react';

interface ClientMetadataProps {
  title?: string;
  description?: string;
  canonical?: string;
}

/**
 * Client-side metadata component for pages that need to be client components
 * This updates the document head dynamically
 */
export function ClientMetadata({ title, description, canonical }: ClientMetadataProps) {
  useEffect(() => {
    if (title) {
      document.title = title;
    }

    // Update meta description
    if (description) {
      let metaDescription = document.querySelector('meta[name="description"]');
      if (!metaDescription) {
        metaDescription = document.createElement('meta');
        metaDescription.setAttribute('name', 'description');
        document.head.appendChild(metaDescription);
      }
      metaDescription.setAttribute('content', description);
    }

    // Update canonical link
    if (canonical) {
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://dukaaon.in';
      let linkCanonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
      if (!linkCanonical) {
        linkCanonical = document.createElement('link');
        linkCanonical.setAttribute('rel', 'canonical');
        document.head.appendChild(linkCanonical);
      }
      linkCanonical.href = `${baseUrl}${canonical}`;
    }
  }, [title, description, canonical]);

  return null;
}
