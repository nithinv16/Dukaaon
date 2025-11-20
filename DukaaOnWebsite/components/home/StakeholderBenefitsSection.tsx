'use client';

import { motion, useInView } from 'framer-motion';
import { useRef, useState } from 'react';
import { staggerContainer, staggerItem } from '@/components/animations/variants';
import { Heading } from '@/components/ui/Typography/Heading';

interface Stakeholder {
  id: string;
  name: string;
  icon: string;
  color: string;
  benefits: {
    title: string;
    description: string;
    icon: string;
  }[];
}

export function StakeholderBenefitsSection() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });
  const [activeTab, setActiveTab] = useState('retailers');

  const stakeholders: Stakeholder[] = [
    {
      id: 'retailers',
      name: 'Retailers',
      icon: '🏪',
      color: 'primary-orange',
      benefits: [
        {
          title: 'Lower Procurement Costs',
          description: 'Direct sourcing from wholesalers and manufacturers reduces intermediary costs by up to 40%',
          icon: '💰',
        },
        {
          title: 'Credit Access',
          description: 'Get working capital loans up to ₹5L with flexible repayment terms',
          icon: '💳',
        },
        {
          title: 'Inventory Management',
          description: 'AI-powered tools help optimize stock levels and reduce wastage',
          icon: '📊',
        },
        {
          title: 'Fast Delivery',
          description: 'Micro-warehousing network ensures same-day or next-day delivery',
          icon: '🚚',
        },
      ],
    },
    {
      id: 'wholesalers',
      name: 'Wholesalers',
      icon: '🏭',
      color: 'secondary-blue',
      benefits: [
        {
          title: 'Expanded Reach',
          description: 'Connect with thousands of retailers across rural and semi-urban areas',
          icon: '🌍',
        },
        {
          title: 'Digital Ordering',
          description: 'Automated order processing reduces manual work and errors',
          icon: '📱',
        },
        {
          title: 'Inventory Visibility',
          description: 'Real-time tracking of stock levels and demand patterns',
          icon: '👁️',
        },
        {
          title: 'Payment Security',
          description: 'Guaranteed payments through platform-managed transactions',
          icon: '🔒',
        },
      ],
    },
    {
      id: 'manufacturers',
      name: 'Manufacturers',
      icon: '🏗️',
      color: 'secondary-green',
      benefits: [
        {
          title: 'Direct Market Access',
          description: 'Reach rural retailers without multiple distribution layers',
          icon: '🎯',
        },
        {
          title: 'Demand Insights',
          description: 'AI-powered analytics reveal market trends and opportunities',
          icon: '📈',
        },
        {
          title: 'Brand Building',
          description: 'Showcase products directly to end retailers with rich media',
          icon: '✨',
        },
        {
          title: 'Efficient Logistics',
          description: 'Leverage micro-warehousing for optimized distribution',
          icon: '📦',
        },
      ],
    },
    {
      id: 'fmcg',
      name: 'FMCG Companies',
      icon: '🏢',
      color: 'accent-yellow',
      benefits: [
        {
          title: 'Rural Penetration',
          description: 'Access untapped rural markets with established distribution network',
          icon: '🌾',
        },
        {
          title: 'Market Intelligence',
          description: 'Detailed analytics on rural consumption patterns and preferences',
          icon: '🧠',
        },
        {
          title: 'Brand Visibility',
          description: 'Promote products through targeted campaigns to rural retailers',
          icon: '📢',
        },
        {
          title: 'Supply Chain Efficiency',
          description: 'Reduce distribution costs through optimized logistics',
          icon: '⚡',
        },
      ],
    },

  ];

  const activeStakeholder = stakeholders.find((s) => s.id === activeTab) || stakeholders[0];

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
            <span className="inline-block px-4 py-2 bg-secondary-green/10 rounded-full text-secondary-green text-sm font-medium mb-4">
              For Everyone
            </span>
          </motion.div>

          <motion.div variants={staggerItem}>
            <Heading as="h2" className="mb-6">
              Benefits for All Stakeholders
            </Heading>
          </motion.div>

          <motion.p variants={staggerItem} className="text-xl text-primary-gray max-w-3xl mx-auto">
            DukaaOn creates value across the entire supply chain ecosystem
          </motion.p>
        </motion.div>

        {/* Tab navigation */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ delay: 0.3 }}
          className="flex flex-wrap justify-center gap-3 mb-12"
        >
          {stakeholders.map((stakeholder) => (
            <button
              key={stakeholder.id}
              onClick={() => setActiveTab(stakeholder.id)}
              className={`px-6 py-3 rounded-lg font-medium transition-all duration-300 flex items-center gap-2 ${
                activeTab === stakeholder.id
                  ? `bg-${stakeholder.color} text-white shadow-lg scale-105`
                  : 'bg-neutral-light text-primary-gray hover:bg-neutral-medium/30'
              }`}
              style={
                activeTab === stakeholder.id
                  ? {
                      backgroundColor: `var(--${stakeholder.color})`,
                    }
                  : undefined
              }
            >
              <span className="text-xl">{stakeholder.icon}</span>
              <span>{stakeholder.name}</span>
            </button>
          ))}
        </motion.div>

        {/* Benefits content */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          {activeStakeholder.benefits.map((benefit, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1, duration: 0.4 }}
              className="bg-gradient-to-br from-neutral-light to-white rounded-xl p-6 border border-neutral-medium/20 hover:shadow-lg transition-shadow duration-300"
            >
              <div className="flex items-start gap-4">
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl flex-shrink-0"
                  style={{
                    backgroundColor: `var(--${activeStakeholder.color})20`,
                  }}
                >
                  {benefit.icon}
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-primary-dark mb-2">
                    {benefit.title}
                  </h3>
                  <p className="text-primary-gray leading-relaxed">
                    {benefit.description}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Call to action */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ delay: 0.6 }}
          className="mt-16 text-center"
        >
          <div className="inline-flex flex-col sm:flex-row gap-4 items-center">
            <a
              href="/contact"
              className="px-8 py-3 bg-primary-orange text-white rounded-lg font-medium hover:bg-primary-orange/90 transition-colors shadow-lg"
            >
              Partner With Us
            </a>
            <a
              href="/investors"
              className="px-8 py-3 border-2 border-primary-orange text-primary-orange rounded-lg font-medium hover:bg-primary-orange hover:text-white transition-colors"
            >
              For Investors
            </a>
            <a
              href="/about"
              className="px-8 py-3 border-2 border-primary-gray text-primary-gray rounded-lg font-medium hover:border-primary-dark hover:text-primary-dark transition-colors"
            >
              Learn More
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
