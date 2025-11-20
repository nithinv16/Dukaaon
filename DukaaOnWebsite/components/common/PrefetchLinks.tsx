'use client';

import Link from 'next/link';
import { useEffect } from 'react';

/**
 * PrefetchLinks component
 * 
 * Prefetches critical routes to improve navigation performance.
 * This component should be included in the root layout or key pages.
 */
export function PrefetchLinks() {
  useEffect(() => {
    // Prefetch critical routes on mount
    const criticalRoutes = [
      '/marketplace',
      '/about',
      '/contact',
    ];

    // Use requestIdleCallback for non-blocking prefetch
    if ('requestIdleCallback' in window) {
      criticalRoutes.forEach((route) => {
        requestIdleCallback(() => {
          const link = document.createElement('link');
          link.rel = 'prefetch';
          link.href = route;
          document.head.appendChild(link);
        });
      });
    }
  }, []);

  return null;
}

/**
 * PrefetchLink component
 * 
 * A wrapper around Next.js Link that enables prefetching by default.
 * Use this for important navigation links.
 */
interface PrefetchLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  prefetch?: boolean;
}

export function PrefetchLink({ 
  href, 
  children, 
  className,
  prefetch = true 
}: PrefetchLinkProps) {
  return (
    <Link 
      href={href} 
      className={className}
      prefetch={prefetch}
    >
      {children}
    </Link>
  );
}
