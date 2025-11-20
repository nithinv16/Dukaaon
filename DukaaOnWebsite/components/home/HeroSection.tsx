'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { fadeInUp, staggerContainer, staggerItem } from '@/components/animations/variants';
import Link from 'next/link';
import { useRef } from 'react';

export function HeroSection() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  });

  // Parallax effects
  const y = useTransform(scrollYProgress, [0, 1], ['0%', '50%']);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  return (
    <section
      ref={ref}
      className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-primary-dark via-primary-gray to-secondary-blue"
    >
      {/* Animated background elements */}
      <motion.div
        style={{ y }}
        className="absolute inset-0 z-0"
      >
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary-orange/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent-yellow/20 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-secondary-green/10 rounded-full blur-3xl" />
      </motion.div>

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 z-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px)`,
          backgroundSize: '50px 50px',
        }} />
      </div>

      {/* Content */}
      <motion.div
        style={{ opacity }}
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center"
      >
        <motion.div variants={staggerItem} className="mb-6">
          <span className="inline-block px-4 py-2 bg-primary-orange/20 backdrop-blur-sm rounded-full text-primary-orange text-sm font-medium border border-primary-orange/30">
            Empowering Rural Retail
          </span>
        </motion.div>

        <motion.h1
          variants={staggerItem}
          className="text-5xl sm:text-6xl lg:text-7xl font-heading font-bold text-white mb-6 leading-tight"
        >
          Transforming Rural
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-orange via-accent-yellow to-primary-orange animate-gradient">
            Distribution & Commerce
          </span>
        </motion.h1>

        <motion.p
          variants={staggerItem}
          className="text-xl sm:text-2xl text-neutral-light/90 mb-12 max-w-3xl mx-auto leading-relaxed"
        >
          AI-powered supply chain platform connecting retailers, wholesalers, and manufacturers
          with credit facilities and smart inventory management
        </motion.p>

        <motion.div
          variants={staggerItem}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center"
        >
          <Link href="/marketplace">
            <Button size="lg" className="min-w-[200px] group">
              Explore Marketplace
              <svg
                className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Button>
          </Link>
          <Link href="/contact">
            <Button variant="outline" size="lg" className="min-w-[200px] border-white text-white hover:bg-white hover:text-primary-dark">
              Get in Touch
            </Button>
          </Link>
        </motion.div>

        {/* Stats */}
        <motion.div
          variants={staggerItem}
          className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto"
        >
          {[
            { value: '10,000+', label: 'Retailers' },
            { value: '500+', label: 'Wholesalers' },
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

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.5, duration: 0.5, repeat: Infinity, repeatType: 'reverse' }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10"
      >
        <div className="flex flex-col items-center gap-2 text-white/60">
          <span className="text-sm">Scroll to explore</span>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
      </motion.div>
    </section>
  );
}
