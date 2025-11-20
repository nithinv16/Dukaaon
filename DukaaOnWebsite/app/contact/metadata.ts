import { Metadata } from 'next';
import { generateMetadata } from '@/components/layout';

export const metadata: Metadata = generateMetadata({
  title: 'Contact Us - Get in Touch with DukaaOn',
  description: 'Have questions about DukaaOn? Contact our team for inquiries about our platform, partnerships, or support. We\'re here to help retailers, wholesalers, and manufacturers.',
  keywords: [
    'DukaaOn contact',
    'contact DukaaOn',
    'customer support',
    'business inquiries',
    'partnership opportunities',
    'retail platform support',
  ],
  canonical: '/contact',
});
