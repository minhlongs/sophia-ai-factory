/**
 * LicenseMetricsTable Component
 * Composition root: sortable, filterable per-license metrics table
 */

'use client';

import { useState, useMemo } from 'react';
import {
  Table,
  TableHead,
  TableHeader,
  TableRow,
} from '@/seed/components/ui/table';
import { ChevronUp, ChevronDown } from 'lucide-react';
import type { LicenseUtilization } from '@/lib/analytics/types';
import { LicenseMetricsFilterBar } from './license-metrics-filter-bar';
import { LicenseMetricsTableBody } from './license-metrics-table-body';

interface LicenseMetricsTableProps {
  licenses: LicenseUtilization[];
  isLoading?: boolean;
}

type SortKey = 'licenseNonce' | 'tier' | 'usedCredits' | 'limitCredit' | 'percentage' | 'expiresAt';
type SortDirection = 'asc' | 'desc';

function SortIcon({ columnKey, sortKey, sortDirection }: {
  columnKey: SortKey;
  sortKey: SortKey;
  sortDirection: SortDirection;
}) {
  if (sortKey !== columnKey) return null;
  return sortDirection === 'asc'
    ? <ChevronUp className="w-4 h-4 ml-1" aria-hidden="true" />
    : <ChevronDown className="w-4 h-4 ml-1" aria-hidden="true" />;
}

export function LicenseMetricsTable({ licenses, isLoading }: LicenseMetricsTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey>('percentage');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const uniqueTiers = useMemo(() => {
    return Array.from(new Set(licenses.map(l => l.tier)));
  }, [licenses]);

  const filteredLicenses = useMemo(() => {
    return licenses
      .filter(license => {
        const matchesSearch = searchQuery === '' ||
          license.licenseNonce.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesTier = tierFilter === 'all' || license.tier === tierFilter;
        return matchesSearch && matchesTier;
      })
      .sort((a, b) => {
        let comparison = 0;
        switch (sortKey) {
          case 'licenseNonce':
            comparison = a.licenseNonce.localeCompare(b.licenseNonce);
            break;
          case 'tier':
            comparison = a.tier.localeCompare(b.tier);
            break;
          case 'usedCredits':
          case 'limitCredit':
          case 'percentage':
            comparison = a[sortKey] - b[sortKey];
            break;
          case 'expiresAt': {
            const aExp = a.expiresAt || Infinity;
            const bExp = b.expiresAt || Infinity;
            comparison = aExp - bExp;
            break;
          }
        }
        return sortDirection === 'asc' ? comparison : -comparison;
      });
  }, [licenses, searchQuery, tierFilter, sortKey, sortDirection]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
  };

  if (isLoading) {
    return (
      <div className="w-full flex items-center justify-center py-8">
        <div className="text-muted-foreground">Loading license metrics...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <LicenseMetricsFilterBar
        searchQuery={searchQuery}
        tierFilter={tierFilter}
        uniqueTiers={uniqueTiers}
        totalCount={licenses.length}
        filteredCount={filteredLicenses.length}
        onSearchChange={setSearchQuery}
        onTierChange={setTierFilter}
      />

      <div className="border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px] cursor-pointer" onClick={() => handleSort('licenseNonce')}>
                <div className="flex items-center">
                  License
                  <SortIcon columnKey="licenseNonce" sortKey={sortKey} sortDirection={sortDirection} />
                </div>
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => handleSort('tier')}>
                <div className="flex items-center">
                  Tier
                  <SortIcon columnKey="tier" sortKey={sortKey} sortDirection={sortDirection} />
                </div>
              </TableHead>
              <TableHead className="text-right cursor-pointer" onClick={() => handleSort('usedCredits')}>
                <div className="flex items-center justify-end">
                  Used Credits
                  <SortIcon columnKey="usedCredits" sortKey={sortKey} sortDirection={sortDirection} />
                </div>
              </TableHead>
              <TableHead className="text-right cursor-pointer" onClick={() => handleSort('limitCredit')}>
                <div className="flex items-center justify-end">
                  Limit
                  <SortIcon columnKey="limitCredit" sortKey={sortKey} sortDirection={sortDirection} />
                </div>
              </TableHead>
              <TableHead className="w-[200px] cursor-pointer" onClick={() => handleSort('percentage')}>
                <div className="flex items-center">
                  Usage
                  <SortIcon columnKey="percentage" sortKey={sortKey} sortDirection={sortDirection} />
                </div>
              </TableHead>
              <TableHead className="text-right cursor-pointer" onClick={() => handleSort('expiresAt')}>
                <div className="flex items-center justify-end">
                  Expires
                  <SortIcon columnKey="expiresAt" sortKey={sortKey} sortDirection={sortDirection} />
                </div>
              </TableHead>
              <TableHead className="text-right">Overages</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <LicenseMetricsTableBody licenses={filteredLicenses} />
        </Table>
      </div>
    </div>
  );
}
