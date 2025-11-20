import { Metadata } from 'next';
import { PageLayout, generateMetadata } from '@/components/layout';
import { InvestorsHero } from '@/components/investors/InvestorsHero';
import { MarketOpportunity } from '@/components/investors/MarketOpportunity';
import { BusinessModel } from '@/components/investors/BusinessModel';
import { InvestorBenefits } from '@/components/investors/InvestorBenefits';

export const metadata: Metadata = generateMetadata({
  title: 'For Investors - DukaaOn',
  description: 'Invest in the future of rural commerce. DukaaOn offers a scalable, technology-driven platform with strong unit economics and massive market opportunity.',
  keywords: [
    'DukaaOn investors',
    'rural commerce investment',
    'fintech investment India',
    'supply chain investment',
    'rural retail opportunity',
  ],
  canonical: '/investors',
});

export default function InvestorsPage() {
  return (
    <PageLayout>
      <InvestorsHero />
      <MarketOpportunity />
      <BusinessModel />
      <InvestorBenefits />
    </PageLayout>
  );
}
