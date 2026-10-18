'use client';

import {
  TableHead,
  TableHeader,
  TableRow,
} from '@/seed/components/ui/table';
import { ChevronUp, ChevronDown } from 'lucide-react';

export type SortKey =
  | 'licenseNonce'
  | 'tier'
  | 'usedCredits'
  | 'limitCredit'
  | 'percentage'
  | 'expiresAt';
export type SortDirection = 'asc' | 'desc';

function SortIcon({
  columnKey,
  sortKey,
  sortDirection,
}: {
  columnKey: SortKey;
  sortKey: SortKey;
  sortDirection: SortDirection;
}) {
  if (sortKey !== columnKey) return null;
  return sortDirection === 'asc' ? (
    <ChevronUp className="w-4 h-4 ml-1" aria-hidden="true" />
  ) : (
    <ChevronDown className="w-4 h-4 ml-1" aria-hidden="true" />
  );
}

interface LicenseMetricsTableHeaderProps {
  sortKey: SortKey;
  sortDirection: SortDirection;
  onSort: (key: SortKey) => void;
}

export function LicenseMetricsTableHeader({
  sortKey,
  sortDirection,
  onSort,
}: LicenseMetricsTableHeaderProps) {
  return (
    <TableHeader>
      <TableRow>
        <TableHead className="w-[200px] cursor-pointer" onClick={() => onSort('licenseNonce')}>
          <div className="flex items-center">
            License
            <SortIcon columnKey="licenseNonce" sortKey={sortKey} sortDirection={sortDirection} />
          </div>
        </TableHead>
        <TableHead className="cursor-pointer" onClick={() => onSort('tier')}>
          <div className="flex items-center">
            Tier
            <SortIcon columnKey="tier" sortKey={sortKey} sortDirection={sortDirection} />
          </div>
        </TableHead>
        <TableHead className="text-right cursor-pointer" onClick={() => onSort('usedCredits')}>
          <div className="flex items-center justify-end">
            Used Credits
            <SortIcon columnKey="usedCredits" sortKey={sortKey} sortDirection={sortDirection} />
          </div>
        </TableHead>
        <TableHead className="text-right cursor-pointer" onClick={() => onSort('limitCredit')}>
          <div className="flex items-center justify-end">
            Limit
            <SortIcon columnKey="limitCredit" sortKey={sortKey} sortDirection={sortDirection} />
          </div>
        </TableHead>
        <TableHead className="w-[200px] cursor-pointer" onClick={() => onSort('percentage')}>
          <div className="flex items-center">
            Usage
            <SortIcon columnKey="percentage" sortKey={sortKey} sortDirection={sortDirection} />
          </div>
        </TableHead>
        <TableHead className="text-right cursor-pointer" onClick={() => onSort('expiresAt')}>
          <div className="flex items-center justify-end">
            Expires
            <SortIcon columnKey="expiresAt" sortKey={sortKey} sortDirection={sortDirection} />
          </div>
        </TableHead>
        <TableHead className="text-right">Overages</TableHead>
        <TableHead>Status</TableHead>
      </TableRow>
    </TableHeader>
  );
}
