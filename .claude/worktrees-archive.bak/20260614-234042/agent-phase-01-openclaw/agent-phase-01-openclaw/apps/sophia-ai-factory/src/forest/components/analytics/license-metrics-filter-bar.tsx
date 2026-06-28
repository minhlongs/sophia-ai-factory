'use client';

/**
 * License Metrics Filter Bar
 * Search input + tier select filter for LicenseMetricsTable
 */

import { Input } from '@/seed/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/seed/components/ui/select';
import { Search, Filter } from 'lucide-react';

interface LicenseMetricsFilterBarProps {
  searchQuery: string;
  tierFilter: string;
  uniqueTiers: string[];
  totalCount: number;
  filteredCount: number;
  onSearchChange: (value: string) => void;
  onTierChange: (value: string) => void;
}

export function LicenseMetricsFilterBar({
  searchQuery,
  tierFilter,
  uniqueTiers,
  totalCount,
  filteredCount,
  onSearchChange,
  onTierChange,
}: LicenseMetricsFilterBarProps) {
  return (
    <div className="flex gap-4 items-center">
      <div className="relative flex-1 max-w-sm">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          placeholder="Search license nonce..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
        <Select value={tierFilter} onValueChange={onTierChange}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All Tiers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tiers</SelectItem>
            {uniqueTiers.map(tier => (
              <SelectItem key={tier} value={tier}>{tier}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="text-sm text-muted-foreground ml-auto">
        {filteredCount} of {totalCount} licenses
      </div>
    </div>
  );
}
