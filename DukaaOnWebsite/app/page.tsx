import dynamic from 'next/dynamic';
import { PageLayout, generateMetadata } from '@/components/layout';
import { HeroSection } from '@/components/home';
import { Metadata } from 'next';

// Lazy load non-critical sections with loading fallbacks
const ValuePropositionSection = dynamic(
  () => import('@/components/home').then(mod => ({ default: mod.ValuePropositionSection })),
  { ssr: true }
);

const FeaturesSection = dynamic(
  () => import('@/components/home').then(mod => ({ default: mod.FeaturesSection })),
  { ssr: true }
);

const NearbySellersSection = dynamic(
  () => import('@/components/home').then(mod => ({ default: mod.NearbySellersSection })),
  { 
    ssr: false,
    loading: () => (
      <div className="py-16 bg-neutral-light">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-neutral-medium rounded w-1/3"></div>
            <div className="h-4 bg-neutral-medium rounded w-2/3"></div>
          </div>
        </div>
      </div>
    )
  }
);

const StakeholderBenefitsSection = dynamic(
  () => import('@/components/home').then(mod => ({ default: mod.StakeholderBenefitsSection })),
  { ssr: true }
);

const ProblemSolutionSection = dynamic(
  () => import('@/components/home').then(mod => ({ default: mod.ProblemSolutionSection })),
  { ssr: true }
);

export const metadata: Metadata = generateMetadata({
  title: 'DukaaOn - Tech-Enabled Distribution Platform for Rural India',
  description: 'Empowering rural retailers with AI-powered supply chain, micro-warehousing, instant credit access, and direct connections to wholesalers and manufacturers across India.',
  keywords: [
    'DukaaOn',
    'rural retail',
    'distribution platform',
    'wholesalers India',
    'manufacturers India',
    'supply chain',
    'micro-warehousing',
    'retail credit',
    'B2B marketplace',
    'rural commerce',
  ],
  canonical: '/',
});

export default function Home() {
  return (
    <PageLayout>
      <HeroSection />
      <ValuePropositionSection />
      <FeaturesSection />
      
      {/* Nearby Wholesalers Section */}
      <NearbySellersSection
        businessType="wholesaler"
        title="Nearby Wholesalers"
        description="Connect with trusted wholesalers in your area for competitive prices and reliable supply"
      />
      
      {/* Nearby Manufacturers Section */}
      <NearbySellersSection
        businessType="manufacturer"
        title="Nearby Manufacturers"
        description="Source directly from manufacturers near you for better margins and quality products"
      />
      
      <StakeholderBenefitsSection />
      <ProblemSolutionSection />
    </PageLayout>
  );
}
