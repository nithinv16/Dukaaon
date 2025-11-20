import Link from 'next/link';
import { Facebook, Twitter, Linkedin, Instagram, Mail, Phone } from 'lucide-react';

const navigation = {
  company: [
    { name: 'About Us', href: '/about' },
    { name: 'Marketplace', href: '/marketplace' },
    { name: 'Contact', href: '/contact' },
  ],
  stakeholders: [
    { name: 'For Retailers', href: '/#retailers' },
    { name: 'For Wholesalers', href: '/#wholesalers' },
    { name: 'For Manufacturers', href: '/#manufacturers' },
    { name: 'For Investors', href: '/investors' },
  ],
  legal: [
    { name: 'Privacy Policy', href: '/privacy' },
    { name: 'Terms of Service', href: '/terms' },
  ],
  social: [
    {
      name: 'Facebook',
      href: '#',
      icon: Facebook,
    },
    {
      name: 'Twitter',
      href: '#',
      icon: Twitter,
    },
    {
      name: 'LinkedIn',
      href: '#',
      icon: Linkedin,
    },
    {
      name: 'Instagram',
      href: '#',
      icon: Instagram,
    },
  ],
};

export function Footer() {
  return (
    <footer className="bg-primary-dark text-neutral-light" aria-labelledby="footer-heading">
      <h2 id="footer-heading" className="sr-only">
        Footer
      </h2>
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
          {/* Company Info */}
          <div className="space-y-4">
            <div className="flex items-center">
              <img 
                src="/logo.png" 
                alt="DukaaOn" 
                className="bg-white/10 rounded-lg shadow-md brightness-0 invert object-cover"
                style={{ width: '180px', height: '46px' }}
              />
            </div>
            <p className="text-sm text-neutral-medium">
              Tech-enabled distribution and financial inclusion platform for rural and semi-urban retailers.
            </p>
            
            {/* Contact Info */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2 text-sm">
                <Mail className="h-4 w-4 text-primary-orange" />
                <a
                  href="mailto:support@dukaaon.in"
                  className="hover:text-primary-orange transition-colors"
                >
                  support@dukaaon.in
                </a>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <Phone className="h-4 w-4 text-primary-orange" />
                <a
                  href="tel:+918089668552"
                  className="hover:text-primary-orange transition-colors"
                >
                  +91-8089668552
                </a>
              </div>
            </div>

            {/* App Download Buttons */}
            <div className="space-y-2 pt-4">
              <p className="text-sm font-semibold text-white">Download Our App</p>
              <div className="flex flex-col space-y-2">
                <a
                  href="https://play.google.com/store/apps/details?id=com.sixn8.dukaaon&pcampaignid=web_share"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-lg bg-neutral-dark px-4 py-2 text-sm font-medium text-white hover:bg-neutral-dark/80 transition-colors"
                  aria-label="Download on Google Play"
                >
                  <svg className="h-6 w-6 mr-2" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z" />
                  </svg>
                  Google Play
                </a>
              </div>
            </div>
          </div>

          {/* Company Links */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white">
              Company
            </h3>
            <ul className="mt-4 space-y-3">
              {navigation.company.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className="text-sm text-neutral-medium hover:text-primary-orange transition-colors"
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Stakeholders Links */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white">
              For Stakeholders
            </h3>
            <ul className="mt-4 space-y-3">
              {navigation.stakeholders.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className="text-sm text-neutral-medium hover:text-primary-orange transition-colors"
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal & Social */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white">
              Legal
            </h3>
            <ul className="mt-4 space-y-3">
              {navigation.legal.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className="text-sm text-neutral-medium hover:text-primary-orange transition-colors"
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>

            {/* Social Media Links */}
            <div className="mt-6">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-white">
                Follow Us
              </h3>
              <div className="mt-4 flex space-x-4">
                {navigation.social.map((item) => (
                  <a
                    key={item.name}
                    href={item.href}
                    className="text-neutral-medium hover:text-primary-orange transition-colors"
                    aria-label={item.name}
                  >
                    <item.icon className="h-5 w-5" aria-hidden="true" />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 border-t border-neutral-dark pt-8">
          <p className="text-center text-sm text-neutral-medium">
            &copy; 2025 DukaaOn. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
