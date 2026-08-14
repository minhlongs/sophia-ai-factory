'use client';

import React from 'react';
import { cn } from '@/seed/utils/cn';
import { Button } from '@/seed/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/seed/components/ui/dropdown-menu';
import { Tier } from '@/seed/types';

export interface TierFilterProps {
  selectedTiers: Tier[];
  onChange: (tiers: Tier[]) => void;
  adminOnly?: boolean;
  className?: string;
}

const TIERS: Tier[] = ['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER'];

export function TierFilter({
  selectedTiers,
  onChange,
  adminOnly = false,
  className,
}: TierFilterProps) {
  const handleToggle = (tier: Tier) => {
    const newTiers = selectedTiers.includes(tier)
      ? selectedTiers.filter((t) => t !== tier)
      : [...selectedTiers, tier];
    onChange(newTiers);
  };

  const handleSelectAll = () => {
    onChange(selectedTiers.length === TIERS.length ? [] : TIERS);
  };

  const handleClear = () => {
    onChange([]);
  };

  if (adminOnly) {
    return null; // Hide for non-admin users
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className={cn('w-[180px]', className)}>
          Tier: {selectedTiers.length === 0 ? 'All' : selectedTiers.length === TIERS.length ? 'All' : selectedTiers.join(', ')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[180px]">
        <div className="flex gap-2 p-2 border-b">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSelectAll}
            className="flex-1 text-xs"
          >
            Select All
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="flex-1 text-xs"
          >
            Clear
          </Button>
        </div>
        {TIERS.map((tier) => (
          <DropdownMenuCheckboxItem
            key={tier}
            checked={selectedTiers.includes(tier)}
            onCheckedChange={() => handleToggle(tier)}
          >
            {tier}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
