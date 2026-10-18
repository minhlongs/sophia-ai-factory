/**
 * LicenseMetricsTable Component
 * Composition root: sortable, filterable per-license metrics table
 */

'use client';

import { useState, useMemo } from 'react';
import { Table } from '@/seed/components/ui/table';
import type { LicenseUtilization } from '@/land/analytics/types';
import { LicenseMetricsFilterBar } from './license-metrics-filter-bar';
import { LicenseMetricsTableBody } from './license-metrics-table-body';
import {
  LicenseMetricsTableHeader,
  type SortKey,
  type SortDirection,
} from './license-metrics-table-header';

export { type SortKey, type SortDirection };

interface LicenseMetricsTableProps {
  licenses: LicenseUtilization[];
  isLoading?: boolean;
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
          <LicenseMetricsTableHeader
            sortKey={sortKey}
            sortDirection={sortDirection}
            onSort={handleSort}
          />
          <LicenseMetricsTableBody licenses={filteredLicenses} />
        </Table>
      </div>
    </div>
  );
}
