'use client';

import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { fadeInUp, staggerContainer, staggerItem } from '@/components/animations/variants';
import Link from 'next/link';

export function InvestorsHero() {
  return (
    <section className="relative min-h-[70vh] flex items-center justify-center overflow-hidden bg-gradient-to-br from-primary-dark via-secondary-blue to-primary-gray">
      {/* Animated background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary-orange/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent-yellow/20 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      {/* Content */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center py-20"
      >
        <motion.div variants={staggerItem} className="mb-6">
          <span className="inline-block px-4 py-2 bg-accent-yellow/20 backdrop-blur-sm rounded-full text-accent-yellow text-sm font-medium border border-accent-yellow/30">
            Investment Opportunity
          </span>
        </motion.div>

        <motion.h1
          variants={staggerItem}
          className="text-5xl sm:text-6xl lg:text-7xl font-heading font-bold text-white mb-6 leading-tight"
        >
          Invest in the Future of
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-orange via-accent-yellow to-primary-orange animate-gradient">
            Rural Commerce
          </span>
        </motion.h1>

        <motion.p
          variants={staggerItem}
          className="text-xl sm:text-2xl text-neutral-light/90 mb-12 max-w-3xl mx-auto leading-relaxed"
        >
          Join us in transforming India's ₹50+ trillion rural retail market through technology, 
          financial inclusion, and innovative supply chain solutions
        </motion.p>

        <motion.div
          variants={staggerItem}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center"
        >
          <Link href="/contact">
            <Button size="lg" className="min-w-[200px]">
              Get in Touch
            </Button>
          </Link>
          <a href="#opportunity" className="text-white hover:text-accent-yellow transition-colors">
            Learn More ↓
          </a>
        </motion.div>

        {/* Key metrics */}
        <motion.div
          variants={staggerItem}
          className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto"
        >
          {[
            { value: '₹50T+', label: 'Market Size' },
            { value: '10K+', label: 'Retailers' },
            { value: '₹50Cr+', label: 'GMV' },
            { value: '15+', label: 'States' },
          ].map((stat, index) => (
            <motion.div
              key={index}
              variants={fadeInUp}
              className="bg-white/10 backdrop-blur-md rounded-lg p-6 border border-white/20"
            >
              <div className="text-3xl sm:text-4xl font-bold text-white mb-2">{stat.value}</div>
              <div className="text-sm text-neutral-light/80">{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
    </section>
  );
}
