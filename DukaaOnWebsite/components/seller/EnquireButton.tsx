'use client';

import { Seller } from '@/types';
import { Button } from '@/components/ui/Button';
import { trackEnquireClick } from '@/lib/analytics';
import { MessageCircle } from 'lucide-react';

interface EnquireButtonProps {
  seller: Seller;
  onEnquire: () => void;
}

export function EnquireButton({ seller, onEnquire }: EnquireButtonProps) {
  const handleEnquireClick = () => {
    // Track the enquire button click
    trackEnquireClick(seller.id, seller.businessName);
    onEnquire();
  };

  return (
    <>
      {/* Desktop Button */}
      <div className="hidden md:block">
        <Button
          variant="primary"
          size="lg"
          onClick={handleEnquireClick}
          className="w-full flex items-center justify-center space-x-2 text-lg py-4"
        >
          <MessageCircle className="w-6 h-6" />
          <span>Enquire About {seller.businessName}</span>
        </Button>
      </div>

      {/* Mobile Fixed Button */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-medium p-4 shadow-lg z-40">
        <Button
          variant="primary"
          size="lg"
          onClick={handleEnquireClick}
          className="w-full flex items-center justify-center space-x-2"
        >
          <MessageCircle className="w-5 h-5" />
          <span>Enquire Details</span>
        </Button>
      </div>

      {/* Spacer for mobile to prevent content from being hidden behind fixed button */}
      <div className="md:hidden h-20" />
    </>
  );
}
