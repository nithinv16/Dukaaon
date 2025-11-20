'use client';

import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { staggerContainer, staggerItem } from '@/components/animations/variants';
import { Heading } from '@/components/ui/Typography/Heading';

export function MarketOpportunity() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  const opportunities = [
    {
      icon: '🌾',
      title: 'Massive Untapped Market',
      description: 'India rural retail market is valued at ₹50+ trillion with 850+ million people',
      stats: '65% of India population',
    },
    {
      icon: '📈',
      title: 'High Growth Potential',
      description: 'Rural consumption growing at 15% CAGR, faster than urban markets',
      stats: '15% CAGR',
    },
    {
      icon: '🏪',
      title: 'Fragmented Distribution',
      description: '12+ million small retailers with inefficient supply chains',
      stats: '12M+ retailers',
    },
    {
      icon: '💳',
      title: 'Credit Gap',
      description: '₹8 trillion credit gap for small retailers and MSMEs',
      stats: '₹8T opportunity',
    },
  ];

  return (
    <section id="opportunity" ref={ref} className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
          className="text-center mb-16"
        >
          <motion.div variants={staggerItem}>
            <span className="inline-block px-4 py-2 bg-secondary-green/10 rounded-full text-secondary-green text-sm font-medium mb-4">
              Market Analysis
            </span>
          </motion.div>

          <motion.div variants={staggerItem}>
            <Heading as="h2" className="mb-6">
              A Trillion-Dollar Opportunity
            </Heading>
          </motion.div>

          <motion.p variants={staggerItem} className="text-xl text-primary-gray max-w-3xl mx-auto">
            India rural retail sector represents one of the largest untapped markets globally
          </motion.p>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
          className="grid grid-cols-1 md:grid-cols-2 gap-8"
        >
          {opportunities.map((item, index) => (
            <motion.div
              key={index}
              variants={staggerItem}
              className="bg-gradient-to-br from-neutral-light to-white rounded-2xl p-8 border border-neutral-medium/20 hover:shadow-xl transition-shadow"
            >
              <div className="text-5xl mb-4">{item.icon}</div>
              <h3 className="text-2xl font-bold text-primary-dark mb-3">{item.title}</h3>
              <p className="text-primary-gray mb-4 leading-relaxed">{item.description}</p>
              <div className="inline-block px-4 py-2 bg-primary-orange/10 rounded-lg">
                <span className="text-primary-orange font-bold">{item.stats}</span>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
