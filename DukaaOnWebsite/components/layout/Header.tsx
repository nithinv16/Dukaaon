'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';

const navigation = [
  { name: 'Home', href: '/' },
  { name: 'About', href: '/about' },
  { name: 'Marketplace', href: '/marketplace' },
  { name: 'Contact', href: '/contact' },
];

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [mobileMenuOpen]);

  const handleSmoothScroll = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href.startsWith('#')) {
      e.preventDefault();
      const element = document.querySelector(href);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setMobileMenuOpen(false);
      }
    }
  };

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white shadow-md'
          : 'bg-white/95 backdrop-blur-sm'
      }`}
    >
      <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8" aria-label="Main navigation">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center">
              <img 
                src="/logo.png" 
                alt="DukaaOn" 
                className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 object-cover"
                style={{ width: '180px', height: '46px' }}
              />
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex md:items-center md:space-x-8">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                onClick={(e) => handleSmoothScroll(e, item.href)}
                prefetch={true}
                className={`relative text-sm font-medium transition-colors duration-200 ${
                  isActive(item.href)
                    ? 'text-primary-orange'
                    : 'text-primary-gray hover:text-primary-orange'
                }`}
              >
                {item.name}
                {isActive(item.href) && (
                  <span className="absolute -bottom-1 left-0 h-0.5 w-full bg-primary-orange" />
                )}
              </Link>
            ))}
          </div>

          {/* CTA Button - Desktop */}
          <div className="hidden md:flex md:items-center">
            <Button
              variant="primary"
              size="md"
              asChild
            >
              <Link href="/marketplace" prefetch={true}>Explore Marketplace</Link>
            </Button>
          </div>

          {/* Mobile menu button */}
          <div className="flex md:hidden">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md p-2 text-primary-gray hover:bg-neutral-light hover:text-primary-orange focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-orange"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-expanded={mobileMenuOpen}
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" aria-hidden="true" />
              ) : (
                <Menu className="h-6 w-6" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile menu */}
      <div
        className={`md:hidden transition-all duration-300 ease-in-out ${
          mobileMenuOpen
            ? 'max-h-screen opacity-100'
            : 'max-h-0 opacity-0 overflow-hidden'
        }`}
      >
        <div className="space-y-1 px-4 pb-3 pt-2 bg-white border-t border-neutral-medium">
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              onClick={(e) => {
                handleSmoothScroll(e, item.href);
                setMobileMenuOpen(false);
              }}
              className={`block rounded-md px-3 py-2 text-base font-medium transition-colors duration-200 ${
                isActive(item.href)
                  ? 'bg-primary-orange/10 text-primary-orange'
                  : 'text-primary-gray hover:bg-neutral-light hover:text-primary-orange'
              }`}
            >
              {item.name}
            </Link>
          ))}
          <div className="pt-4">
            <Button
              variant="primary"
              size="md"
              className="w-full"
              asChild
            >
              <Link href="/marketplace" onClick={() => setMobileMenuOpen(false)}>
                Explore Marketplace
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
