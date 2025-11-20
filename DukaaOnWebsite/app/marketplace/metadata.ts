import { Metadata } from 'next';
import { generateMetadata } from '@/components/layout';

export const metadata: Metadata = generateMetadata({
  title: 'Marketplace - Find Wholesalers & Manufacturers Near You | DukaaOn',
  description: 'Discover wholesalers and manufacturers in your area. Connect directly with suppliers, get competitive prices, and grow your retail business with DukaaOn\'s location-based marketplace.',
  keywords: [
    'wholesalers near me',
    'manufacturers India',
    'B2B marketplace',
    'supplier directory',
    'wholesale suppliers',
    'local manufacturers',
    'retail suppliers',
    'DukaaOn marketplace',
  ],
  canonical: '/marketplace',
});
