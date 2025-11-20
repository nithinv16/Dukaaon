'use client';

import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { staggerContainer, staggerItem } from '@/components/animations/variants';
import { Heading } from '@/components/ui/Typography/Heading';

export function ValuePropositionSection() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  const metrics = [
    {
      value: '40%',
      label: 'Cost Reduction',
      description: 'Lower procurement costs through direct sourcing',
      icon: '💰',
    },
    {
      value: '3x',
      label: 'Faster Delivery',
      description: 'Micro-warehousing enables rapid fulfillment',
      icon: '⚡',
    },
    {
      value: '24/7',
      label: 'AI Support',
      description: 'Voice-based ordering in regional languages',
      icon: '🤖',
    },
    {
      value: '₹5L',
      label: 'Credit Access',
      description: 'Working capital for inventory growth',
      icon: '💳',
    },
  ];

  return (
    <section ref={ref} className="py-24 bg-neutral-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
          className="text-center mb-16"
        >
          <motion.div variants={staggerItem}>
            <span className="inline-block px-4 py-2 bg-primary-orange/10 rounded-full text-primary-orange text-sm font-medium mb-4">
              Our Impact
            </span>
          </motion.div>
          
          <motion.div variants={staggerItem}>
            <Heading as="h2" className="mb-6">
              Revolutionizing Rural Commerce
            </Heading>
          </motion.div>

          <motion.p variants={staggerItem} className="text-xl text-primary-gray max-w-3xl mx-auto">
            DukaaOn bridges the gap between rural retailers and suppliers through technology,
            enabling efficient distribution, credit access, and data-driven inventory management.
          </motion.p>
        </motion.div>

        {/* Animated metrics grid */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8"
        >
          {metrics.map((metric, index) => (
            <motion.div
              key={index}
              variants={staggerItem}
              whileHover={{ y: -8, transition: { duration: 0.2 } }}
              className="relative group"
            >
              <div className="bg-gradient-to-br from-white to-neutral-light border border-neutral-medium/20 rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-shadow duration-300">
                {/* Icon */}
                <div className="text-5xl mb-4 transform group-hover:scale-110 transition-transform duration-300">
                  {metric.icon}
                </div>

                {/* Animated value */}
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={isInView ? { scale: 1, opacity: 1 } : { scale: 0.5, opacity: 0 }}
                  transition={{ delay: index * 0.1 + 0.3, duration: 0.5, type: 'spring' }}
                  className="text-4xl font-bold text-primary-orange mb-2"
                >
                  {metric.value}
                </motion.div>

                <h3 className="text-xl font-semibold text-primary-dark mb-2">
                  {metric.label}
                </h3>

                <p className="text-sm text-primary-gray">
                  {metric.description}
                </p>

                {/* Decorative gradient border on hover */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary-orange to-accent-yellow opacity-0 group-hover:opacity-10 transition-opacity duration-300 pointer-events-none" />
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Core value proposition */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ delay: 0.6, duration: 0.6 }}
          className="mt-20 bg-gradient-to-br from-primary-dark to-secondary-blue rounded-3xl p-12 text-white relative overflow-hidden"
        >
          {/* Background decoration */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary-orange/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent-yellow/20 rounded-full blur-3xl" />

          <div className="relative z-10 max-w-4xl mx-auto text-center">
            <h3 className="text-3xl sm:text-4xl font-bold mb-6">
              Our Vision & Mission
            </h3>
            <div className="mb-8 space-y-6">
              <div>
                <h4 className="text-xl font-semibold text-accent-yellow mb-3">Vision</h4>
                <p className="text-lg text-neutral-light/90 leading-relaxed">
                  To become the backbone of rural and semi-urban commerce by enabling small retailers, 
                  wholesalers, and manufacturers through tech-driven distribution, financial and supply chain solutions.
                </p>
              </div>
              <div>
                <h4 className="text-xl font-semibold text-accent-yellow mb-3">Mission</h4>
                <p className="text-lg text-neutral-light/90 leading-relaxed">
                  Creating a future where every small retailer has access to the tools, credit, and technology 
                  they need to thrive in an increasingly digital world.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap justify-center gap-4 text-sm">
              {[
                'AI-Powered Supply Chain',
                'Micro-Warehousing',
                'Stock on Credit',
                'Agentic AI Ordering',
                'Voice & OCR',
                'Regional Languages',
              ].map((feature, index) => (
                <span
                  key={index}
                  className="px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full border border-white/20"
                >
                  {feature}
                </span>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
