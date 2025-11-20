'use client';

import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { staggerContainer, staggerItem } from '@/components/animations/variants';
import { Heading } from '@/components/ui/Typography/Heading';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';

export function InvestorBenefits() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  const benefits = [
    {
      icon: '📊',
      title: 'Large Market Opportunity',
      description: '₹50+ trillion rural retail market with high growth potential and low penetration',
    },
    {
      icon: '🚀',
      title: 'Scalable Technology Platform',
      description: 'Network effects and low marginal costs enable rapid scaling across India',
    },
    {
      icon: '🤝',
      title: 'Social Impact',
      description: 'Financial inclusion and empowerment of rural communities creates lasting value',
    },
    {
      icon: '💹',
      title: 'Strong Unit Economics',
      description: 'Proven business model with positive contribution margins and multiple revenue streams',
    },
    {
      icon: '🎯',
      title: 'First-Mover Advantage',
      description: 'Early entry into underserved rural markets with limited competition',
    },
    {
      icon: '🔒',
      title: 'Defensible Moat',
      description: 'Network effects, data advantages, and local relationships create barriers to entry',
    },
  ];

  return (
    <section ref={ref} className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
          className="text-center mb-16"
        >
          <motion.div variants={staggerItem}>
            <span className="inline-block px-4 py-2 bg-primary-orange/10 rounded-full text-primary-orange text-sm font-medium mb-4">
              Why Invest
            </span>
          </motion.div>

          <motion.div variants={staggerItem}>
            <Heading as="h2" className="mb-6">
              Investment Highlights
            </Heading>
          </motion.div>

          <motion.p variants={staggerItem} className="text-xl text-primary-gray max-w-3xl mx-auto">
            Join us in building the future of rural commerce in India
          </motion.p>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16"
        >
          {benefits.map((benefit, index) => (
            <motion.div
              key={index}
              variants={staggerItem}
              className="bg-gradient-to-br from-neutral-light to-white rounded-xl p-6 border border-neutral-medium/20 hover:shadow-lg transition-shadow"
            >
              <div className="text-4xl mb-4">{benefit.icon}</div>
              <h3 className="text-xl font-bold text-primary-dark mb-3">{benefit.title}</h3>
              <p className="text-primary-gray leading-relaxed">{benefit.description}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ delay: 0.6 }}
          className="bg-gradient-to-br from-primary-dark to-secondary-blue rounded-3xl p-12 text-white text-center"
        >
          <h3 className="text-3xl sm:text-4xl font-bold mb-6">
            Ready to Join Our Journey?
          </h3>
          <p className="text-xl text-neutral-light/90 mb-8 max-w-2xl mx-auto">
            Let's discuss how you can be part of transforming rural commerce in India
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/contact">
              <Button size="lg" variant="outline" className="min-w-[200px] border-white text-white hover:bg-white hover:text-primary-dark">
                Schedule a Meeting
              </Button>
            </Link>
            <a
              href="mailto:investors@dukaaon.in"
              className="inline-flex items-center justify-center px-8 py-3 bg-white text-primary-dark rounded-lg font-medium hover:bg-neutral-light transition-colors min-w-[200px]"
            >
              Email Us
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
