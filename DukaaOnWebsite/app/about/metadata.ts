import { Metadata } from 'next';
import { generateMetadata } from '@/components/layout';

export const metadata: Metadata = generateMetadata({
  title: 'About DukaaOn - Empowering Rural India Through Technology',
  description: 'Learn about DukaaOn\'s mission to transform rural retail distribution through AI-powered technology, micro-warehousing, and financial inclusion. Discover our story, vision, and impact.',
  keywords: [
    'DukaaOn about',
    'rural retail India',
    'distribution technology',
    'financial inclusion',
    'micro-warehousing',
    'rural commerce',
    'supply chain innovation',
    'retail empowerment',
  ],
  canonical: '/about',
});
