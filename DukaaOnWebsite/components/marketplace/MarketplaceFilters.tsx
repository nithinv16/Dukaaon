'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { trackFilterUsage, trackSearch } from '@/lib/analytics';
import { Search, Filter, X, Sliders } from 'lucide-react';

export interface FilterState {
  search: string;
  businessType: string;
  category: string;
  radius: number;
}

interface MarketplaceFiltersProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  categories: string[];
  showRadiusSlider?: boolean;
}

export function MarketplaceFilters({
  filters,
  onFilterChange,
  categories,
  showRadiusSlider = true,
}: MarketplaceFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleSearchChange = (value: string) => {
    onFilterChange({ ...filters, search: value });
    // Track search if value is not empty
    if (value.trim()) {
      trackSearch(value);
    }
  };

  const handleBusinessTypeChange = (value: string) => {
    onFilterChange({ ...filters, businessType: value });
    // Track filter usage
    if (value) {
      trackFilterUsage('businessType', value);
    }
  };

  const handleCategoryChange = (value: string) => {
    onFilterChange({ ...filters, category: value });
    // Track filter usage
    if (value) {
      trackFilterUsage('category', value);
    }
  };

  const handleRadiusChange = (value: number) => {
    onFilterChange({ ...filters, radius: value });
    // Track filter usage
    trackFilterUsage('radius', `${value}km`);
  };

  const handleClearFilters = () => {
    onFilterChange({
      search: '',
      businessType: '',
      category: '',
      radius: 100,
    });
  };

  const hasActiveFilters =
    filters.search ||
    filters.businessType ||
    filters.category ||
    filters.radius !== 100;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-neutral-medium p-4 space-y-4">
      {/* Search Bar - Always Visible */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-primary-gray" />
        <Input
          type="text"
          placeholder="Search by business name..."
          value={filters.search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Toggle Filters Button - Mobile */}
      <div className="flex items-center justify-between lg:hidden">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center space-x-2"
        >
          <Filter className="w-4 h-4" />
          <span>Filters</span>
          {hasActiveFilters && (
            <span className="bg-primary-orange text-white text-xs px-2 py-0.5 rounded-full">
              Active
            </span>
          )}
        </Button>
        {hasActiveFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearFilters}
            className="text-primary-gray hover:text-primary-dark border-neutral-medium"
          >
            <X className="w-4 h-4 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {/* Filter Options */}
      <div
        className={`space-y-4 ${
          isExpanded ? 'block' : 'hidden'
        } lg:block`}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Business Type Filter */}
          <div>
            <label className="block text-sm font-medium text-primary-dark mb-2">
              Business Type
            </label>
            <Select
              value={filters.businessType}
              onChange={(e) => handleBusinessTypeChange(e.target.value)}
              options={[
                { value: '', label: 'All Types' },
                { value: 'wholesaler', label: 'Wholesaler' },
                { value: 'manufacturer', label: 'Manufacturer' },
              ]}
            />
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-sm font-medium text-primary-dark mb-2">
              Category
            </label>
            <Select
              value={filters.category}
              onChange={(e) => handleCategoryChange(e.target.value)}
              options={[
                { value: '', label: 'All Categories' },
                ...categories.map((category) => ({
                  value: category,
                  label: category,
                })),
              ]}
            />
          </div>

          {/* Radius Slider */}
          {showRadiusSlider && (
            <div>
              <label className="block text-sm font-medium text-primary-dark mb-2">
                Radius: {filters.radius} km
              </label>
              <div className="flex items-center space-x-3">
                <Sliders className="w-4 h-4 text-primary-gray flex-shrink-0" />
                <input
                  type="range"
                  min="10"
                  max="200"
                  step="10"
                  value={filters.radius}
                  onChange={(e) => handleRadiusChange(Number(e.target.value))}
                  className="flex-1 h-2 bg-neutral-light rounded-lg appearance-none cursor-pointer accent-primary-orange"
                />
              </div>
              <div className="flex justify-between text-xs text-primary-gray mt-1">
                <span>10 km</span>
                <span>200 km</span>
              </div>
            </div>
          )}
        </div>

        {/* Clear Filters - Desktop */}
        {hasActiveFilters && (
          <div className="hidden lg:flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearFilters}
              className="text-primary-gray hover:text-primary-dark border-neutral-medium"
            >
              <X className="w-4 h-4 mr-1" />
              Clear All Filters
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
