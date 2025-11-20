'use client';

import { Seller } from '@/types';
import { SellerCard } from './SellerCard';
import { Loader2 } from 'lucide-react';

interface SellerGridProps {
  sellers: Seller[];
  isLoading?: boolean;
  onEnquire: (sellerId: string) => void;
}

export function SellerGrid({ sellers, isLoading, onEnquire }: SellerGridProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-primary-orange animate-spin" />
      </div>
    );
  }

  if (sellers.length === 0) {
    return null; // Empty state handled by parent component
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {sellers.map((seller) => (
        <SellerCard key={seller.id} seller={seller} onEnquire={onEnquire} />
      ))}
    </div>
  );
}
