'use client';

import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { staggerContainer, staggerItem } from '@/components/animations/variants';
import { Heading } from '@/components/ui/Typography/Heading';

export function ProblemSolutionSection() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  const problems = [
    {
      icon: '💸',
      title: 'High Procurement Costs',
      description: 'Multiple intermediaries increase product costs by 30-40%',
    },
    {
      icon: '📉',
      title: 'Limited Credit Access',
      description: 'Rural retailers struggle to get working capital from traditional banks',
    },
    {
      icon: '📦',
      title: 'Inefficient Inventory',
      description: 'Manual tracking leads to stockouts and overstocking',
    },
    {
      icon: '🚛',
      title: 'Poor Logistics',
      description: 'Long delivery times and high transportation costs',
    },
    {
      icon: '💳',
      title: 'Cash Flow Challenges',
      description: 'Retailers need credit while wholesalers need immediate payment',
    },
  ];

  const solutions = [
    {
      icon: '🤝',
      title: 'Direct Connections',
      description: 'Connect retailers directly with wholesalers and manufacturers',
      color: 'from-blue-500 to-cyan-500',
    },
    {
      icon: '💳',
      title: 'Stock on Credit',
      description: 'Wholesalers get cash upfront, retailers get flexible credit periods',
      color: 'from-green-500 to-emerald-500',
    },
    {
      icon: '🤖',
      title: 'AI-Powered Tools',
      description: 'Smart inventory management and demand forecasting',
      color: 'from-purple-500 to-pink-500',
    },
    {
      icon: '🏪',
      title: 'Micro-Warehousing',
      description: 'Shopkeeper-hosted local distribution for faster, cheaper delivery',
      color: 'from-orange-500 to-red-500',
    },
  ];

  return (
    <section ref={ref} className="py-24 bg-gradient-to-b from-neutral-light to-white relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-0 left-0 w-96 h-96 bg-primary-orange rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-secondary-blue rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
          className="text-center mb-16"
        >
          <motion.div variants={staggerItem}>
            <span className="inline-block px-4 py-2 bg-accent-red/10 rounded-full text-accent-red text-sm font-medium mb-4">
              The Challenge
            </span>
          </motion.div>

          <motion.div variants={staggerItem}>
            <Heading as="h2" className="mb-6">
              Solving Rural Retail Challenges
            </Heading>
          </motion.div>

          <motion.p variants={staggerItem} className="text-xl text-primary-gray max-w-3xl mx-auto">
            Traditional distribution systems create inefficiencies that hurt rural retailers.
            DukaaOn provides technology-driven solutions.
          </motion.p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Problems */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -30 }}
            transition={{ duration: 0.6 }}
          >
            <div className="bg-white rounded-2xl p-8 shadow-lg border border-neutral-medium/20">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 bg-accent-red/10 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">⚠️</span>
                </div>
                <h3 className="text-2xl font-bold text-primary-dark">The Problems</h3>
              </div>

              <div className="space-y-6">
                {problems.map((problem, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                    transition={{ delay: index * 0.1 + 0.2, duration: 0.4 }}
                    className="flex gap-4 p-4 rounded-xl bg-neutral-light/50 hover:bg-neutral-light transition-colors"
                  >
                    <div className="text-3xl flex-shrink-0">{problem.icon}</div>
                    <div>
                      <h4 className="font-bold text-primary-dark mb-1">{problem.title}</h4>
                      <p className="text-sm text-primary-gray">{problem.description}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Stats */}
              <div className="mt-8 pt-8 border-t border-neutral-medium/30">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <div className="text-3xl font-bold text-accent-red mb-1">40%</div>
                    <div className="text-xs text-primary-gray">Higher Costs</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-accent-red mb-1">60%</div>
                    <div className="text-xs text-primary-gray">Credit Denied</div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Solutions */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: 30 }}
            transition={{ duration: 0.6 }}
          >
            <div className="bg-gradient-to-br from-primary-dark to-secondary-blue rounded-2xl p-8 shadow-xl text-white">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center backdrop-blur-sm">
                  <span className="text-2xl">✨</span>
                </div>
                <h3 className="text-2xl font-bold">Our Solutions</h3>
              </div>

              <div className="space-y-6">
                {solutions.map((solution, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                    transition={{ delay: index * 0.1 + 0.2, duration: 0.4 }}
                    className="relative group"
                  >
                    <div className="flex gap-4 p-4 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-all duration-300">
                      <div
                        className={`w-12 h-12 rounded-lg bg-gradient-to-br ${solution.color} flex items-center justify-center text-2xl flex-shrink-0 shadow-lg`}
                      >
                        {solution.icon}
                      </div>
                      <div>
                        <h4 className="font-bold mb-1">{solution.title}</h4>
                        <p className="text-sm text-white/80">{solution.description}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Stats */}
              <div className="mt-8 pt-8 border-t border-white/20">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <div className="text-3xl font-bold text-secondary-green mb-1">40%</div>
                    <div className="text-xs text-white/80">Cost Savings</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-secondary-green mb-1">3x</div>
                    <div className="text-xs text-white/80">Faster Delivery</div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* How it works diagram */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ delay: 0.8, duration: 0.6 }}
          className="mt-20"
        >
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold text-primary-dark mb-4">How DukaaOn Works</h3>
            <p className="text-lg text-primary-gray">A seamless ecosystem connecting all stakeholders</p>
          </div>

          <div className="relative">
            {/* Flow diagram */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
              {[
                { step: '1', title: 'Order Placement', desc: 'Voice, OCR, or Agentic AI ordering through app', icon: '📱' },
                { step: '2', title: 'Source Finding', desc: 'Nearest wholesaler, distributor, or micro-warehouse', icon: '📍' },
                { step: '3', title: 'AI Processing', desc: 'Smart routing & inventory check', icon: '🤖' },
                { step: '4', title: 'Fulfillment', desc: 'Order preparation & packaging', icon: '📦' },
                { step: '5', title: 'Delivery', desc: 'Fast local delivery to retailer', icon: '🚚' },
              ].map((item, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
                  transition={{ delay: index * 0.15 + 0.9, duration: 0.4 }}
                  className="relative"
                >
                  <div className="bg-white rounded-xl p-6 shadow-lg border border-neutral-medium/20 text-center hover:shadow-xl transition-shadow">
                    <div className="w-16 h-16 bg-gradient-to-br from-primary-orange to-accent-yellow rounded-full flex items-center justify-center text-3xl mx-auto mb-4 shadow-lg">
                      {item.icon}
                    </div>
                    <div className="text-sm font-bold text-primary-orange mb-2">Step {item.step}</div>
                    <h4 className="font-bold text-primary-dark mb-2">{item.title}</h4>
                    <p className="text-sm text-primary-gray">{item.desc}</p>
                  </div>

                  {/* Arrow connector (hidden on mobile, last item) */}
                  {index < 4 && (
                    <div className="hidden md:block absolute top-1/2 -right-3 transform -translate-y-1/2 z-10">
                      <svg className="w-6 h-6 text-primary-orange" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>

          {/* Credit & Financing Flow */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
            transition={{ delay: 1.5, duration: 0.6 }}
            className="mt-16"
          >
            <div className="bg-gradient-to-br from-secondary-green/10 to-secondary-blue/10 rounded-2xl p-8 border border-secondary-green/20">
              <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-secondary-green/20 rounded-full text-secondary-green text-sm font-medium mb-4">
                  <span className="text-xl">💰</span>
                  <span>Comprehensive Financing Solutions</span>
                </div>
                <h4 className="text-2xl font-bold text-primary-dark mb-2">Credit, Loans & Flexible Payments</h4>
                <p className="text-primary-gray">Stock on credit, business loans, and personal loans with flexible repayment from 1 day to months</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                  {
                    step: '1',
                    title: 'Retailer Orders',
                    desc: 'Choose credit option at checkout',
                    icon: '🛒',
                    color: 'from-blue-500 to-cyan-500',
                  },
                  {
                    step: '2',
                    title: 'Instant Payment',
                    desc: 'Wholesaler receives full payment immediately',
                    icon: '💵',
                    color: 'from-green-500 to-emerald-500',
                  },
                  {
                    step: '3',
                    title: 'Flexible Terms',
                    desc: 'Repayment period from 1 day to months',
                    icon: '📅',
                    color: 'from-purple-500 to-pink-500',
                  },
                  {
                    step: '4',
                    title: 'Easy Repayment',
                    desc: 'Multiple payment options & reminders',
                    icon: '✅',
                    color: 'from-orange-500 to-red-500',
                  },
                ].map((item, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                    transition={{ delay: index * 0.1 + 1.6, duration: 0.4 }}
                    className="relative"
                  >
                    <div className="bg-white rounded-xl p-6 shadow-md border border-neutral-medium/20 text-center hover:shadow-lg transition-shadow h-full">
                      <div className={`w-14 h-14 bg-gradient-to-br ${item.color} rounded-full flex items-center justify-center text-2xl mx-auto mb-4 shadow-md`}>
                        {item.icon}
                      </div>
                      <div className="text-xs font-bold text-secondary-green mb-2">Step {item.step}</div>
                      <h5 className="font-bold text-primary-dark mb-2 text-sm">{item.title}</h5>
                      <p className="text-xs text-primary-gray">{item.desc}</p>
                    </div>

                    {/* Arrow connector */}
                    {index < 3 && (
                      <div className="hidden md:block absolute top-1/2 -right-3 transform -translate-y-1/2 z-10">
                        <svg className="w-5 h-5 text-secondary-green" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>

              {/* Financing Options */}
              <div className="mt-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    {
                      icon: '📦',
                      title: 'Stock on Credit',
                      desc: 'Order inventory with flexible payment terms',
                      color: 'from-blue-500 to-cyan-500',
                    },
                    {
                      icon: '🏢',
                      title: 'Business Loans',
                      desc: 'Expand your business with working capital',
                      color: 'from-green-500 to-emerald-500',
                    },
                    {
                      icon: '👤',
                      title: 'Personal Loans',
                      desc: 'Quick personal financing for urgent needs',
                      color: 'from-purple-500 to-pink-500',
                    },
                  ].map((option, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 20 }}
                      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                      transition={{ delay: index * 0.1 + 2.0, duration: 0.3 }}
                      className="bg-white rounded-lg p-5 border border-secondary-green/20 hover:shadow-md transition-shadow"
                    >
                      <div className={`w-12 h-12 bg-gradient-to-br ${option.color} rounded-lg flex items-center justify-center text-2xl mb-3 shadow-sm`}>
                        {option.icon}
                      </div>
                      <h5 className="font-bold text-primary-dark mb-1 text-sm">{option.title}</h5>
                      <p className="text-xs text-primary-gray">{option.desc}</p>
                    </motion.div>
                  ))}
                </div>

                {/* Key Features */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Repayment Period', value: '1 day - 6 months' },
                    { label: 'Approval Time', value: 'Instant' },
                    { label: 'Interest Rate', value: 'Competitive' },
                    { label: 'Collateral', value: 'Not Required' },
                  ].map((item, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
                      transition={{ delay: index * 0.1 + 2.3, duration: 0.3 }}
                      className="bg-white/60 backdrop-blur-sm rounded-lg p-4 text-center border border-secondary-green/20"
                    >
                      <div className="text-xs text-primary-gray mb-1">{item.label}</div>
                      <div className="text-sm font-bold text-secondary-green">{item.value}</div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
