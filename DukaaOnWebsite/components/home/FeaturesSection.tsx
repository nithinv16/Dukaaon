'use client';

import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { staggerContainer, staggerItem, hoverLift } from '@/components/animations/variants';
import { Heading } from '@/components/ui/Typography/Heading';

interface Feature {
  icon: string;
  title: string;
  description: string;
  benefits: string[];
  gradient: string;
}

export function FeaturesSection() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  const features: Feature[] = [
    {
      icon: '🤖',
      title: 'AI-Powered Supply Chain',
      description: 'Intelligent demand forecasting and automated inventory management',
      benefits: [
        'Predictive analytics for stock optimization',
        'Automated reordering based on sales patterns',
        'Real-time inventory tracking',
      ],
      gradient: 'from-blue-500 to-cyan-500',
    },
    {
      icon: '🏪',
      title: 'Micro-Warehousing Network',
      description: 'Distributed storage for faster delivery and reduced logistics costs',
      benefits: [
        'Local warehouses in rural areas',
        'Same-day delivery capability',
        'Reduced transportation costs',
      ],
      gradient: 'from-purple-500 to-pink-500',
    },
    {
      icon: '💳',
      title: 'Credit Facilities',
      description: 'Working capital loans and flexible payment terms for retailers',
      benefits: [
        'Up to ₹5L credit line',
        'Flexible repayment terms',
        'Digital credit scoring',
      ],
      gradient: 'from-green-500 to-emerald-500',
    },
    {
      icon: '🏪',
      title: 'Shopkeeper-Hosted Micro-Warehouses',
      description: 'Transform retail shops into local distribution hubs for faster fulfillment',
      benefits: [
        'Earn additional income as micro-warehouse',
        'Serve nearby retailers efficiently',
        'Reduce last-mile delivery costs',
      ],
      gradient: 'from-orange-500 to-red-500',
    },
    {
      icon: '🤖',
      title: 'Agentic AI-Based Ordering',
      description: 'Intelligent AI agents handle orders through voice, OCR, and automated processing',
      benefits: [
        'Voice-based ordering in regional languages',
        'OCR for scanning product lists',
        'Natural language understanding',
      ],
      gradient: 'from-indigo-500 to-purple-500',
    },
    {
      icon: '📊',
      title: 'AI Automated Stock Replenishment',
      description: 'Smart inventory management based on demand patterns and buying behavior',
      benefits: [
        'Predictive demand forecasting',
        'Automated reorder suggestions',
        'Optimize stock levels dynamically',
      ],
      gradient: 'from-cyan-500 to-blue-500',
    },
    {
      icon: '💰',
      title: 'Stock on Credit Facility',
      description: 'Wholesalers get cash upfront while retailers enjoy flexible credit periods',
      benefits: [
        'Immediate payment to suppliers',
        'Extended credit for retailers',
        'Improved cash flow for all',
      ],
      gradient: 'from-green-500 to-teal-500',
    },
  ];

  return (
    <section ref={ref} className="py-24 bg-gradient-to-b from-neutral-light to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
          className="text-center mb-16"
        >
          <motion.div variants={staggerItem}>
            <span className="inline-block px-4 py-2 bg-secondary-blue/10 rounded-full text-secondary-blue text-sm font-medium mb-4">
              Platform Features
            </span>
          </motion.div>

          <motion.div variants={staggerItem}>
            <Heading as="h2" className="mb-6">
              Everything You Need to Succeed
            </Heading>
          </motion.div>

          <motion.p variants={staggerItem} className="text-xl text-primary-gray max-w-3xl mx-auto">
            Comprehensive tools and services designed specifically for rural retail ecosystems
          </motion.p>
        </motion.div>

        {/* Features grid */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
        >
          {features.map((feature, index) => (
            <motion.div
              key={index}
              variants={staggerItem}
              whileHover="hover"
              className="group relative"
            >
              <motion.div
                variants={hoverLift}
                className="h-full bg-white rounded-2xl p-8 border border-neutral-medium/20 shadow-md transition-all duration-300"
              >
                {/* Icon with gradient background */}
                <div className="relative mb-6">
                  <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-10 rounded-2xl blur-xl group-hover:opacity-20 transition-opacity`} />
                  <div className={`relative w-16 h-16 bg-gradient-to-br ${feature.gradient} rounded-2xl flex items-center justify-center text-3xl shadow-lg`}>
                    {feature.icon}
                  </div>
                </div>

                {/* Content */}
                <h3 className="text-2xl font-bold text-primary-dark mb-3 group-hover:text-primary-orange transition-colors">
                  {feature.title}
                </h3>

                <p className="text-primary-gray mb-6 leading-relaxed">
                  {feature.description}
                </p>

                {/* Benefits list */}
                <ul className="space-y-2">
                  {feature.benefits.map((benefit, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-primary-gray">
                      <svg
                        className="w-5 h-5 text-secondary-green flex-shrink-0 mt-0.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>

                {/* Hover effect overlay */}
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-5 rounded-2xl transition-opacity pointer-events-none`} />
              </motion.div>
            </motion.div>
          ))}
        </motion.div>

        {/* Call to action */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ delay: 0.8, duration: 0.6 }}
          className="mt-16 text-center"
        >
          <p className="text-lg text-primary-gray mb-6">
            Ready to transform your retail business?
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/marketplace"
              className="inline-flex items-center justify-center px-8 py-3 bg-primary-orange text-white rounded-lg font-medium hover:bg-primary-orange/90 transition-colors"
            >
              Explore Marketplace
            </a>
            <a
              href="/contact"
              className="inline-flex items-center justify-center px-8 py-3 border-2 border-primary-orange text-primary-orange rounded-lg font-medium hover:bg-primary-orange hover:text-white transition-colors"
            >
              Contact Sales
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
