'use client';

import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { staggerContainer, staggerItem } from '@/components/animations/variants';
import { Heading } from '@/components/ui/Typography/Heading';

export function BusinessModel() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  const revenueStreams = [
    {
      title: 'Transaction Fees',
      description: 'Commission on every transaction between retailers and suppliers',
      icon: '💰',
    },
    {
      title: 'Credit Services',
      description: 'Interest income from working capital loans to retailers',
      icon: '💳',
    },
    {
      title: 'Logistics Services',
      description: 'Delivery and warehousing fees from micro-warehouse network',
      icon: '🚚',
    },
    {
      title: 'SaaS Subscriptions',
      description: 'Premium features for inventory management and analytics',
      icon: '📊',
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
              Business Model
            </span>
          </motion.div>

          <motion.div variants={staggerItem}>
            <Heading as="h2" className="mb-6">
              Scalable & Sustainable
            </Heading>
          </motion.div>

          <motion.p variants={staggerItem} className="text-xl text-primary-gray max-w-3xl mx-auto">
            Multiple revenue streams with strong unit economics and network effects
          </motion.p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Revenue Streams */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -30 }}
            transition={{ duration: 0.6 }}
          >
            <h3 className="text-2xl font-bold text-primary-dark mb-8">Revenue Streams</h3>
            <div className="space-y-6">
              {revenueStreams.map((stream, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                  transition={{ delay: index * 0.1 + 0.2 }}
                  className="flex gap-4 p-6 rounded-xl bg-white shadow-md border border-neutral-medium/20 hover:shadow-lg transition-shadow"
                >
                  <div className="text-4xl flex-shrink-0">{stream.icon}</div>
                  <div>
                    <h4 className="font-bold text-primary-dark mb-2">{stream.title}</h4>
                    <p className="text-sm text-primary-gray">{stream.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Key Metrics */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: 30 }}
            transition={{ duration: 0.6 }}
            className="bg-gradient-to-br from-primary-dark to-secondary-blue rounded-2xl p-8 text-white"
          >
            <h3 className="text-2xl font-bold mb-8">Key Metrics</h3>
            <div className="space-y-6">
              {[
                { label: 'Gross Merchandise Value', value: '₹50Cr+', trend: '+120% YoY' },
                { label: 'Active Retailers', value: '10,000+', trend: '+85% YoY' },
                { label: 'Transaction Volume', value: '50K+/month', trend: '+95% YoY' },
                { label: 'Contribution Margin', value: 'Positive', trend: 'Improving' },
              ].map((metric, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                  transition={{ delay: index * 0.1 + 0.4 }}
                  className="border-b border-white/20 pb-4 last:border-0"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-sm text-white/80">{metric.label}</span>
                    <span className="text-xs px-2 py-1 bg-secondary-green/30 rounded-full">
                      {metric.trend}
                    </span>
                  </div>
                  <div className="text-3xl font-bold">{metric.value}</div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
