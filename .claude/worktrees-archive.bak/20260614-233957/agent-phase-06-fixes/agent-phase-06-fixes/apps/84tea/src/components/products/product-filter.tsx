"use client";

import { useState } from "react";
import { Typography } from "@/components/ui/typography";
import { CATEGORIES, TEA_TYPES } from "@/lib/data/products";

interface ProductFilterProps {
  activeCategory: string;
  activeType: string | null;
  priceRange: [number, number];
  onCategoryChange: (category: string) => void;
  onTypeChange: (type: string | null) => void;
  onPriceChange: (range: [number, number]) => void;
  onClear: () => void;
}

export function ProductFilter({
  activeCategory,
  activeType,
  priceRange,
  onCategoryChange,
  onTypeChange,
  onPriceChange,
  onClear
}: ProductFilterProps) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-surface p-6 rounded-2xl border border-outline-variant sticky top-24">
      <div className="flex items-center justify-between mb-6">
        <Typography variant="title-medium" className="font-bold flex items-center gap-2">
          <span className="material-symbols-rounded text-primary">filter_list</span>
          Bộ lọc
        </Typography>
        <button
          onClick={onClear}
          className="text-xs text-on-surface-variant hover:text-error transition-colors underline"
        >
          Xóa tất cả
        </button>
      </div>

      <div className="space-y-8">
        {/* Categories */}
        <div>
          <Typography variant="title-small" className="font-bold mb-4 block">
            Danh mục
          </Typography>
          <div className="space-y-2">
            {CATEGORIES.map((category) => (
              <label
                key={category.id}
                className="flex items-center gap-3 cursor-pointer group"
              >
                <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                  activeCategory === category.id
                    ? 'bg-primary border-primary text-on-primary'
                    : 'border-outline group-hover:border-primary'
                }`}>
                  {activeCategory === category.id && (
                    <span className="material-symbols-rounded text-sm font-bold">check</span>
                  )}
                </div>
                <input
                  type="radio"
                  name="category"
                  value={category.id}
                  checked={activeCategory === category.id}
                  onChange={() => {
                    onCategoryChange(category.id);
                    // Reset type if switching to non-tea category
                    if (category.id !== 'tea' && category.id !== 'all') {
                      onTypeChange(null);
                    }
                  }}
                  className="hidden"
                />
                <span className={`text-sm transition-colors ${
                  activeCategory === category.id ? 'text-primary font-medium' : 'text-on-surface-variant group-hover:text-on-surface'
                }`}>
                  {category.name}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Tea Types - Only show if All or Tea is selected */}
        {(activeCategory === 'all' || activeCategory === 'tea') && (
          <div className="animate-in fade-in slide-in-from-top-2 duration-300">
             <div className="h-px bg-outline-variant w-full mb-6" />
            <Typography variant="title-small" className="font-bold mb-4 block">
              Loại trà
            </Typography>
            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                  activeType === null
                    ? 'bg-primary border-primary'
                    : 'border-outline group-hover:border-primary'
                }`}>
                   {activeType === null && (
                    <div className="w-2 h-2 rounded-full bg-on-primary" />
                   )}
                </div>
                <input
                  type="radio"
                  name="type"
                  checked={activeType === null}
                  onChange={() => onTypeChange(null)}
                  className="hidden"
                />
                <span className={`text-sm ${activeType === null ? 'text-primary font-medium' : 'text-on-surface-variant'}`}>
                  Tất cả loại trà
                </span>
              </label>

              {TEA_TYPES.map((type) => (
                <label key={type.id} className="flex items-center gap-3 cursor-pointer group">
                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                    activeType === type.id
                      ? 'bg-primary border-primary'
                      : 'border-outline group-hover:border-primary'
                  }`}>
                    {activeType === type.id && (
                      <div className="w-2 h-2 rounded-full bg-on-primary" />
                    )}
                  </div>
                  <input
                    type="radio"
                    name="type"
                    value={type.id}
                    checked={activeType === type.id}
                    onChange={() => onTypeChange(type.id)}
                    className="hidden"
                  />
                  <span className={`text-sm transition-colors ${
                    activeType === type.id ? 'text-primary font-medium' : 'text-on-surface-variant group-hover:text-on-surface'
                  }`}>
                    {type.name}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Price Range */}
        <div>
           <div className="h-px bg-outline-variant w-full mb-6" />
          <Typography variant="title-small" className="font-bold mb-4 block">
            Khoảng giá
          </Typography>
          <div className="space-y-4">
             <div className="flex items-center justify-between text-sm text-on-surface-variant">
               <span>{priceRange[0].toLocaleString()}đ</span>
               <span>{priceRange[1].toLocaleString()}đ</span>
             </div>
             {/* Simple Range Slider UI Mockup - In real app use a library like Radix Slider */}
             <div className="relative h-2 bg-surface-variant rounded-full">
               <div className="absolute left-0 right-0 h-full bg-primary rounded-full opacity-20" />
               <div className="absolute left-0 h-full w-full bg-primary rounded-full" />
             </div>
             <div className="grid grid-cols-2 gap-3">
               <button
                  onClick={() => onPriceChange([0, 500000])}
                  className={`px-3 py-2 rounded-lg text-xs border transition-colors ${
                    priceRange[1] === 500000
                      ? 'bg-secondary-container border-secondary-container text-on-secondary-container font-bold'
                      : 'border-outline-variant hover:border-primary text-on-surface-variant'
                  }`}
               >
                 Dưới 500k
               </button>
               <button
                  onClick={() => onPriceChange([500000, 1000000])}
                  className={`px-3 py-2 rounded-lg text-xs border transition-colors ${
                    priceRange[0] === 500000
                      ? 'bg-secondary-container border-secondary-container text-on-secondary-container font-bold'
                      : 'border-outline-variant hover:border-primary text-on-surface-variant'
                  }`}
               >
                 500k - 1tr
               </button>
               <button
                  onClick={() => onPriceChange([1000000, 5000000])}
                  className={`px-3 py-2 rounded-lg text-xs border transition-colors ${
                    priceRange[0] === 1000000
                      ? 'bg-secondary-container border-secondary-container text-on-secondary-container font-bold'
                      : 'border-outline-variant hover:border-primary text-on-surface-variant'
                  }`}
               >
                 Trên 1tr
               </button>
               <button
                  onClick={() => onPriceChange([0, 10000000])}
                  className={`px-3 py-2 rounded-lg text-xs border transition-colors ${
                    priceRange[1] === 10000000 && priceRange[0] === 0
                      ? 'bg-secondary-container border-secondary-container text-on-secondary-container font-bold'
                      : 'border-outline-variant hover:border-primary text-on-surface-variant'
                  }`}
               >
                 Tất cả
               </button>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
