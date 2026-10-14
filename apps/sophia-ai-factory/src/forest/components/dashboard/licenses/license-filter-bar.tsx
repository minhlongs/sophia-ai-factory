import React from 'react';
import { Search, RefreshCw } from 'lucide-react';
import { TIER_OPTIONS } from './license-helpers';

interface LicenseFilterBarProps {
  search: string;
  onSearchChange: (val: string) => void;
  tierFilter: string;
  onTierFilterChange: (val: string) => void;
  loading: boolean;
  onRefresh: () => void;
}

export function LicenseFilterBar({
  search,
  onSearchChange,
  tierFilter,
  onTierFilterChange,
  loading,
  onRefresh,
}: LicenseFilterBarProps): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[200px] max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by license ID or user..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-card text-sm"
        />
      </div>
      <select
        value={tierFilter}
        onChange={(e) => onTierFilterChange(e.target.value)}
        className="px-3 py-2 rounded-lg border border-border bg-card text-sm"
      >
        <option value="">All tiers</option>
        {TIER_OPTIONS.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <button
        onClick={onRefresh}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card text-sm hover:bg-muted transition-colors"
      >
        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        Refresh
      </button>
    </div>
  );
}
