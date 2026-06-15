'use client';

/**
 * License List Filter Bar
 * Search input + tier/status selects + refresh button
 */

import { Input } from '@/seed/components/ui/input';
import { Button } from '@/seed/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/seed/components/ui/select';
import { Search, Filter, RefreshCw } from 'lucide-react';

interface LicenseListFilterBarProps {
  search: string;
  tierFilter: string;
  statusFilter: string;
  onSearchChange: (value: string) => void;
  onTierChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onRefresh: () => void;
}

export function LicenseListFilterBar({
  search,
  tierFilter,
  statusFilter,
  onSearchChange,
  onTierChange,
  onStatusChange,
  onRefresh,
}: LicenseListFilterBarProps) {
  return (
    <div className="flex gap-2 mb-4">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by ID..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 bg-muted border-border text-foreground"
        />
      </div>
      <Select value={tierFilter} onValueChange={onTierChange}>
        <SelectTrigger className="w-[150px] bg-muted border-border">
          <Filter className="w-4 h-4 mr-2" aria-hidden="true" />
          <SelectValue placeholder="All Tiers" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Tiers</SelectItem>
          <SelectItem value="basic">Basic</SelectItem>
          <SelectItem value="premium">Premium</SelectItem>
          <SelectItem value="enterprise">Enterprise</SelectItem>
          <SelectItem value="master">Master</SelectItem>
        </SelectContent>
      </Select>
      <Select value={statusFilter} onValueChange={onStatusChange}>
        <SelectTrigger className="w-[150px] bg-muted border-border">
          <SelectValue placeholder="All Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="revoked">Revoked</SelectItem>
          <SelectItem value="expired">Expired</SelectItem>
        </SelectContent>
      </Select>
      <Button
        variant="outline"
        size="icon"
        onClick={onRefresh}
        aria-label="Refresh license list"
        className="border-border hover:bg-muted"
      >
        <RefreshCw className="w-4 h-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
