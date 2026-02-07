"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

interface FilterSidebarProps {
  categories: string[];
  selectedCategory: string | null;
  onCategoryChange: (category: string | null) => void;
  commissionRanges: { label: string; min: number; max: number }[];
  selectedRange: { min: number; max: number } | null;
  onRangeChange: (range: { min: number; max: number } | null) => void;
}

export function FilterSidebar({
  categories,
  selectedCategory,
  onCategoryChange,
  commissionRanges,
  selectedRange,
  onRangeChange,
}: FilterSidebarProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card glass className="p-6 sticky top-24 bg-card border-border">
        {/* Categories */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-foreground mb-4">Category</h3>
          <div className="space-y-2">
            <button
              onClick={() => onCategoryChange(null)}
              className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                selectedCategory === null
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              All Categories
            </button>
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => onCategoryChange(category)}
                className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                  selectedCategory === category
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* Commission Range */}
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-4">Commission</h3>
          <div className="space-y-2">
            <button
              onClick={() => onRangeChange(null)}
              className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                selectedRange === null
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              All Ranges
            </button>
            {commissionRanges.map((range) => (
              <button
                key={range.label}
                onClick={() => onRangeChange({ min: range.min, max: range.max })}
                className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                  selectedRange?.min === range.min && selectedRange?.max === range.max
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>

        {/* Active Filters */}
        {(selectedCategory || selectedRange) && (
          <div className="mt-6 pt-6 border-t border-border">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">Active Filters</span>
              <button
                onClick={() => {
                  onCategoryChange(null);
                  onRangeChange(null);
                }}
                className="text-xs text-[var(--neon-cyan)] hover:underline"
              >
                Clear All
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedCategory && (
                <Badge variant="secondary">{selectedCategory}</Badge>
              )}
              {selectedRange && (
                <Badge variant="secondary">
                  {commissionRanges.find(
                    (r) => r.min === selectedRange.min && r.max === selectedRange.max
                  )?.label}
                </Badge>
              )}
            </div>
          </div>
        )}
      </Card>
    </motion.div>
  );
}
