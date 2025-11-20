'use client';

import { PageLayout, ClientMetadata, generateBreadcrumbSchema } from '@/components/layout';
import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { Heading } from '@/components/ui/Typography/Heading';
import { staggerContainer, staggerItem } from '@/components/animations/variants';
import { Target, Users, TrendingUp, Award, Lightbulb, Heart } from 'lucide-react';

export default function AboutPage() {
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'About', url: '/about' },
  ]);

  const heroRef = useRef<HTMLDivElement>(null);
  const missionRef = useRef<HTMLDivElement>(null);
  const storyRef = useRef<HTMLDivElement>(null);
  const marketRef = useRef<HTMLDivElement>(null);

  const isHeroInView = useInView(heroRef, { once: true });
  const isMissionInView = useInView(missionRef, { once: true, margin: '-100px' });
  const isStoryInView = useInView(storyRef, { once: true, margin: '-100px' });
  const isMarketInView = useInView(marketRef, { once: true, margin: '-100px' });

  return (
    <PageLayout>
      <ClientMetadata
        title="About DukaaOn - Empowering Rural India Through Technology"
        description="Learn about DukaaOn's mission to transform rural retail distribution through AI-powered technology, micro-warehousing, and financial inclusion. Discover our story, vision, and impact."
        canonical="/about"
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <div className="min-h-[calc(100vh-4rem)] bg-neutral-light">
        {/* Hero Section */}
        <section ref={heroRef} className="relative bg-gradient-to-br from-primary-dark via-secondary-blue to-primary-dark text-white py-24 overflow-hidden">
          {/* Background decoration */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary-orange rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent-yellow rounded-full blur-3xl" />
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={isHeroInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
              transition={{ duration: 0.6 }}
              className="text-center max-w-4xl mx-auto"
            >
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={isHeroInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="inline-block px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-sm font-medium mb-6 border border-white/20"
              >
                About DukaaOn
              </motion.span>

              <Heading as="h1" className="text-white mb-6">
                Empowering Rural India Through Technology
              </Heading>

              <motion.p
                initial={{ opacity: 0 }}
                animate={isHeroInView ? { opacity: 1 } : { opacity: 0 }}
                transition={{ delay: 0.4, duration: 0.6 }}
                className="text-xl text-neutral-light/90 leading-relaxed"
              >
                DukaaOn is revolutionizing rural retail distribution by connecting retailers,
                wholesalers, and manufacturers through an AI-powered platform that enables
                efficient supply chains, credit access, and financial inclusion.
              </motion.p>
            </motion.div>
          </div>
        </section>

        {/* Mission & Vision Section */}
        <section ref={missionRef} className="py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate={isMissionInView ? 'visible' : 'hidden'}
              className="grid md:grid-cols-2 gap-12"
            >
              {/* Mission */}
              <motion.div variants={staggerItem} className="relative group">
                <div className="bg-gradient-to-br from-primary-orange/5 to-accent-yellow/5 rounded-2xl p-8 border border-primary-orange/20 hover:shadow-xl transition-shadow duration-300">
                  <div className="w-16 h-16 bg-gradient-to-br from-primary-orange to-accent-yellow rounded-xl flex items-center justify-center mb-6 shadow-lg">
                    <Target className="w-8 h-8 text-white" />
                  </div>
                  <h2 className="text-3xl font-bold text-primary-dark mb-4">Our Mission</h2>
                  <p className="text-lg text-primary-gray leading-relaxed mb-4">
                    To transform rural retail distribution in India by leveraging technology,
                    enabling direct connections between retailers and suppliers, and providing
                    access to credit and financial services.
                  </p>
                  <p className="text-base text-primary-gray leading-relaxed">
                    We believe every rural retailer deserves access to the same tools and
                    opportunities as their urban counterparts. Through our platform, we&apos;re
                    democratizing access to efficient supply chains, working capital, and
                    data-driven insights.
                  </p>
                </div>
              </motion.div>

              {/* Vision */}
              <motion.div variants={staggerItem} className="relative group">
                <div className="bg-gradient-to-br from-secondary-blue/5 to-secondary-green/5 rounded-2xl p-8 border border-secondary-blue/20 hover:shadow-xl transition-shadow duration-300">
                  <div className="w-16 h-16 bg-gradient-to-br from-secondary-blue to-secondary-green rounded-xl flex items-center justify-center mb-6 shadow-lg">
                    <Lightbulb className="w-8 h-8 text-white" />
                  </div>
                  <h2 className="text-3xl font-bold text-primary-dark mb-4">Our Vision</h2>
                  <p className="text-lg text-primary-gray leading-relaxed mb-4">
                    To become India&apos;s leading tech-enabled distribution and financial inclusion
                    platform for rural and semi-urban markets, serving millions of retailers
                    across the country.
                  </p>
                  <p className="text-base text-primary-gray leading-relaxed">
                    We envision a future where technology bridges the urban-rural divide,
                    creating sustainable livelihoods and economic prosperity in every corner
                    of India through efficient commerce and financial empowerment.
                  </p>
                </div>
              </motion.div>
            </motion.div>

            {/* Core Values */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={isMissionInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="mt-16"
            >
              <h3 className="text-2xl font-bold text-primary-dark text-center mb-12">Our Core Values</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {[
                  {
                    icon: <Heart className="w-6 h-6" />,
                    title: 'Empowerment',
                    description: 'Enabling rural retailers to grow their businesses and improve livelihoods',
                  },
                  {
                    icon: <Users className="w-6 h-6" />,
                    title: 'Inclusivity',
                    description: 'Making technology and financial services accessible to all',
                  },
                  {
                    icon: <Award className="w-6 h-6" />,
                    title: 'Excellence',
                    description: 'Delivering reliable, high-quality solutions that create real impact',
                  },
                ].map((value, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={isMissionInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                    transition={{ delay: 0.6 + index * 0.1, duration: 0.4 }}
                    className="text-center"
                  >
                    <div className="w-12 h-12 bg-primary-orange/10 rounded-lg flex items-center justify-center mx-auto mb-4 text-primary-orange">
                      {value.icon}
                    </div>
                    <h4 className="font-bold text-primary-dark mb-2">{value.title}</h4>
                    <p className="text-sm text-primary-gray">{value.description}</p>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        {/* Company Story Section */}
        <section ref={storyRef} className="py-24 bg-neutral-light">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={isStoryInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
              transition={{ duration: 0.6 }}
              className="text-center mb-16"
            >
              <span className="inline-block px-4 py-2 bg-primary-orange/10 rounded-full text-primary-orange text-sm font-medium mb-4">
                Our Journey
              </span>
              <Heading as="h2" className="mb-6">
                The DukaaOn Story
              </Heading>
              <p className="text-xl text-primary-gray max-w-3xl mx-auto">
                Born from a deep understanding of rural retail challenges and a vision
                to create lasting impact through technology.
              </p>
            </motion.div>

            {/* Timeline */}
            <div className="relative">
              {/* Vertical line */}
              <div className="hidden md:block absolute left-1/2 transform -translate-x-1/2 h-full w-1 bg-gradient-to-b from-primary-orange via-secondary-blue to-secondary-green" />

              <div className="space-y-12">
                {[
                  {
                    phase: 'The Problem',
                    title: 'Identifying the Gap',
                    description: 'Rural retailers in India face significant challenges: high procurement costs due to multiple intermediaries, limited access to credit, inefficient inventory management, and poor logistics. These issues result in 30-40% higher costs and reduced profitability.',
                    icon: '🔍',
                    color: 'from-accent-red to-primary-orange',
                  },
                  {
                    phase: 'The Solution',
                    title: 'Building the Platform',
                    description: 'DukaaOn was created to address these challenges through technology. Our platform connects retailers directly with wholesalers and manufacturers, eliminating intermediaries. We integrated AI-powered tools for inventory management, voice-based ordering in regional languages, and embedded finance for credit access.',
                    icon: '💡',
                    color: 'from-primary-orange to-accent-yellow',
                  },
                  {
                    phase: 'The Innovation',
                    title: 'Micro-Warehousing Network',
                    description: 'We pioneered a micro-warehousing model that brings inventory closer to rural retailers. This innovation reduces delivery times by 3x and transportation costs significantly, while enabling stock-sharing between retailers for better inventory efficiency.',
                    icon: '🏪',
                    color: 'from-secondary-blue to-secondary-green',
                  },
                  {
                    phase: 'The Impact',
                    title: 'Transforming Lives',
                    description: 'Today, DukaaOn is empowering rural retailers across India with 40% cost savings, instant credit access up to ₹5 lakhs, and AI-driven insights. We\'re not just building a platform—we\'re creating economic opportunities and financial inclusion in rural India.',
                    icon: '🚀',
                    color: 'from-secondary-green to-primary-orange',
                  },
                ].map((item, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
                    animate={isStoryInView ? { opacity: 1, x: 0 } : { opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
                    transition={{ delay: index * 0.2, duration: 0.6 }}
                    className={`relative md:w-1/2 ${index % 2 === 0 ? 'md:pr-12 md:text-right' : 'md:ml-auto md:pl-12'}`}
                  >
                    {/* Timeline dot */}
                    <div className="hidden md:block absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-white border-4 border-primary-orange rounded-full z-10" style={{ left: index % 2 === 0 ? 'auto' : '0', right: index % 2 === 0 ? '0' : 'auto' }} />

                    <div className="bg-white rounded-2xl p-8 shadow-lg border border-neutral-medium/20 hover:shadow-xl transition-shadow duration-300">
                      <div className={`inline-flex items-center justify-center w-16 h-16 rounded-xl bg-gradient-to-br ${item.color} text-3xl mb-4 shadow-lg`}>
                        {item.icon}
                      </div>
                      <div className="text-sm font-bold text-primary-orange mb-2">{item.phase}</div>
                      <h3 className="text-2xl font-bold text-primary-dark mb-3">{item.title}</h3>
                      <p className="text-primary-gray leading-relaxed">{item.description}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Market Opportunity Section */}
        <section ref={marketRef} className="py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={isMarketInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
              transition={{ duration: 0.6 }}
              className="text-center mb-16"
            >
              <span className="inline-block px-4 py-2 bg-secondary-blue/10 rounded-full text-secondary-blue text-sm font-medium mb-4">
                Market Opportunity
              </span>
              <Heading as="h2" className="mb-6">
                A Massive Untapped Market
              </Heading>
              <p className="text-xl text-primary-gray max-w-3xl mx-auto">
                Rural India represents one of the largest and fastest-growing retail markets
                in the world, with immense potential for digital transformation.
              </p>
            </motion.div>

            {/* Market Stats */}
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate={isMarketInView ? 'visible' : 'hidden'}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16"
            >
              {[
                {
                  value: '12M+',
                  label: 'Rural Retail Stores',
                  description: 'Across India',
                  icon: '🏪',
                  color: 'from-primary-orange to-accent-yellow',
                },
                {
                  value: '₹50T',
                  label: 'Market Size',
                  description: 'Rural retail market',
                  icon: '💰',
                  color: 'from-secondary-blue to-secondary-green',
                },
                {
                  value: '65%',
                  label: 'Population',
                  description: 'Lives in rural areas',
                  icon: '👥',
                  color: 'from-secondary-green to-primary-orange',
                },
                {
                  value: '15%',
                  label: 'CAGR',
                  description: 'Market growth rate',
                  icon: '📈',
                  color: 'from-accent-yellow to-accent-red',
                },
              ].map((stat, index) => (
                <motion.div
                  key={index}
                  variants={staggerItem}
                  whileHover={{ y: -8 }}
                  className="relative group"
                >
                  <div className="bg-gradient-to-br from-neutral-light to-white rounded-2xl p-6 border border-neutral-medium/20 shadow-lg hover:shadow-xl transition-all duration-300">
                    <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${stat.color} flex items-center justify-center text-2xl mb-4 shadow-md`}>
                      {stat.icon}
                    </div>
                    <div className="text-4xl font-bold text-primary-dark mb-2">{stat.value}</div>
                    <div className="text-lg font-semibold text-primary-dark mb-1">{stat.label}</div>
                    <div className="text-sm text-primary-gray">{stat.description}</div>
                  </div>
                </motion.div>
              ))}
            </motion.div>

            {/* Key Insights */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={isMarketInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="bg-gradient-to-br from-primary-dark to-secondary-blue rounded-3xl p-12 text-white relative overflow-hidden"
            >
              {/* Background decoration */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary-orange/20 rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent-yellow/20 rounded-full blur-3xl" />

              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-8">
                  <TrendingUp className="w-8 h-8" />
                  <h3 className="text-3xl font-bold">Why Now?</h3>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    <h4 className="text-xl font-bold mb-4">Growing Digital Adoption</h4>
                    <ul className="space-y-3 text-neutral-light/90">
                      <li className="flex items-start gap-3">
                        <span className="text-secondary-green text-xl">✓</span>
                        <span>Smartphone penetration in rural areas has reached 45% and growing rapidly</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="text-secondary-green text-xl">✓</span>
                        <span>Internet connectivity improving with government initiatives like BharatNet</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="text-secondary-green text-xl">✓</span>
                        <span>Digital payment adoption accelerated by UPI and mobile wallets</span>
                      </li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="text-xl font-bold mb-4">Market Dynamics</h4>
                    <ul className="space-y-3 text-neutral-light/90">
                      <li className="flex items-start gap-3">
                        <span className="text-secondary-green text-xl">✓</span>
                        <span>Rising disposable incomes in rural households driving consumption</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="text-secondary-green text-xl">✓</span>
                        <span>Government focus on rural development and financial inclusion</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="text-secondary-green text-xl">✓</span>
                        <span>Increasing demand for organized retail and quality products</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Problem Statement & Solution */}
        <section className="py-24 bg-neutral-light">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12">
              {/* Problem Statement */}
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                <div className="bg-white rounded-2xl p-8 shadow-lg border border-neutral-medium/20 h-full">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 bg-accent-red/10 rounded-lg flex items-center justify-center">
                      <span className="text-2xl">⚠️</span>
                    </div>
                    <h3 className="text-2xl font-bold text-primary-dark">The Challenge</h3>
                  </div>

                  <p className="text-lg text-primary-gray mb-6 leading-relaxed">
                    Rural retailers face systemic challenges that limit their growth and profitability:
                  </p>

                  <ul className="space-y-4">
                    {[
                      'Multiple intermediaries increase costs by 30-40%',
                      'Limited or no access to formal credit facilities',
                      'Manual inventory management leads to inefficiencies',
                      'Long delivery times and high transportation costs',
                      'Lack of data-driven insights for business decisions',
                      'Language barriers in using digital tools',
                    ].map((problem, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <span className="text-accent-red text-xl flex-shrink-0">✗</span>
                        <span className="text-primary-gray">{problem}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>

              {/* Solution Approach */}
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                <div className="bg-gradient-to-br from-primary-dark to-secondary-blue rounded-2xl p-8 shadow-xl text-white h-full">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center backdrop-blur-sm">
                      <span className="text-2xl">✨</span>
                    </div>
                    <h3 className="text-2xl font-bold">Our Approach</h3>
                  </div>

                  <p className="text-lg text-white/90 mb-6 leading-relaxed">
                    DukaaOn provides comprehensive technology-driven solutions:
                  </p>

                  <ul className="space-y-4">
                    {[
                      'Direct B2B marketplace connecting retailers with suppliers',
                      'Embedded finance with instant credit approval up to ₹5L',
                      'AI-powered inventory management and demand forecasting',
                      'Micro-warehousing network for 3x faster delivery',
                      'Voice-based ordering in 10+ regional languages',
                      'Real-time analytics and business intelligence dashboard',
                    ].map((solution, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <span className="text-secondary-green text-xl flex-shrink-0">✓</span>
                        <span className="text-white/90">{solution}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Call to Action */}
        <section className="py-24 bg-gradient-to-br from-primary-orange to-accent-yellow">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-4xl font-bold text-white mb-6">
                Join Us in Transforming Rural India
              </h2>
              <p className="text-xl text-white/90 mb-8 leading-relaxed">
                Whether you&apos;re a retailer looking to grow your business, a wholesaler seeking
                new markets, or an investor interested in rural commerce, DukaaOn has
                opportunities for you.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a
                  href="/marketplace"
                  className="inline-flex items-center justify-center px-8 py-4 bg-white text-primary-orange font-semibold rounded-lg hover:bg-neutral-light transition-colors shadow-lg"
                >
                  Explore Marketplace
                </a>
                <a
                  href="/contact"
                  className="inline-flex items-center justify-center px-8 py-4 bg-primary-dark text-white font-semibold rounded-lg hover:bg-primary-dark/90 transition-colors shadow-lg"
                >
                  Get in Touch
                </a>
              </div>
            </motion.div>
          </div>
        </section>
      </div>
    </PageLayout>
  );
}
