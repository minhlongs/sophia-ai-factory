/**
 * LicenseMetricsTable Component
 *
 * Displays per-license metrics in a sortable, filterable table.
 * Shows usage, quota, tier, and status for each license.
 */

'use client';

import { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ChevronUp,
  ChevronDown,
  Search,
  Filter,
  AlertTriangle,
} from 'lucide-react';
import type { LicenseUtilization } from '@/lib/analytics/types';

interface LicenseMetricsTableProps {
  licenses: LicenseUtilization[];
  isLoading?: boolean;
}

type SortKey = 'licenseNonce' | 'tier' | 'usedCredits' | 'limitCredit' | 'percentage' | 'expiresAt';
type SortDirection = 'asc' | 'desc';

export function LicenseMetricsTable({ licenses, isLoading }: LicenseMetricsTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey>('percentage');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Get unique tiers for filter
  const uniqueTiers = useMemo(() => {
    const tiers = new Set(licenses.map(l => l.tier));
    return Array.from(tiers);
  }, [licenses]);

  // Filter and sort licenses
  const filteredLicenses = useMemo(() => {
    return licenses
      .filter(license => {
        // Search filter
        const matchesSearch = searchQuery === '' ||
          license.licenseNonce.toLowerCase().includes(searchQuery.toLowerCase());

        // Tier filter
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
          case 'expiresAt':
            const aExp = a.expiresAt || Infinity;
            const bExp = b.expiresAt || Infinity;
            comparison = aExp - bExp;
            break;
        }

        return sortDirection === 'asc' ? comparison : -comparison;
      });
  }, [licenses, searchQuery, tierFilter, sortKey, sortDirection]);

  // Handle sort
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
  };

  // Sort icon
  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortKey !== columnKey) return null;
    return sortDirection === 'asc' ? (
      <ChevronUp className="w-4 h-4 ml-1" />
    ) : (
      <ChevronDown className="w-4 h-4 ml-1" />
    );
  };

  // Status badge with overage info
  const StatusBadge = ({
    percentage,
    expiresAt,
    overageCount = 0,
  }: {
    percentage: number;
    expiresAt: number | null;
    overageCount?: number;
  }) => {
    const now = Math.floor(Date.now() / 1000);
    const isExpired = expiresAt !== null && expiresAt < now;

    if (isExpired) {
      return (
        <Badge variant="destructive" className="text-xs">
          Expired
        </Badge>
      );
    }

    if (percentage >= 90) {
      return (
        <Badge variant="destructive" className="text-xs flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          Critical{overageCount > 0 && ` (${overageCount})`}
        </Badge>
      );
    }

    if (percentage >= 75) {
      return (
        <Badge variant="secondary" className="text-xs bg-amber-500/20 text-amber-500 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          Warning{overageCount > 0 && ` (${overageCount})`}
        </Badge>
      );
    }

    return (
      <Badge variant="secondary" className="text-xs bg-green-500/20 text-green-500">
        Healthy{overageCount > 0 && ` (${overageCount} overages)`}
      </Badge>
    );
  };

  // Format expiration
  const formatExpiration = (expiresAt: number | null) => {
    if (!expiresAt) return 'Never';
    const date = new Date(expiresAt * 1000);
    const now = new Date();
    const diffDays = Math.floor((expiresAt * 1000 - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'Expired';
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays < 7) return `${diffDays} days`;
    return date.toLocaleDateString('vi-VN');
  };

  // Progress bar
  const UsageProgress = ({ percentage }: { percentage: number }) => {
    const getColor = (pct: number) => {
      if (pct >= 90) return 'bg-red-500';
      if (pct >= 75) return 'bg-amber-500';
      return 'bg-green-500';
    };

    return (
      <div className="w-full bg-muted rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all ${getColor(percentage)}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    );
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
      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search license nonce..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Select value={tierFilter} onValueChange={setTierFilter}>
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
          {filteredLicenses.length} of {licenses.length} licenses
        </div>
      </div>

      {/* Table */}
      <div className="border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px] cursor-pointer" onClick={() => handleSort('licenseNonce')}>
                <div className="flex items-center">
                  License
                  <SortIcon columnKey="licenseNonce" />
                </div>
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => handleSort('tier')}>
                <div className="flex items-center">
                  Tier
                  <SortIcon columnKey="tier" />
                </div>
              </TableHead>
              <TableHead className="text-right cursor-pointer" onClick={() => handleSort('usedCredits')}>
                <div className="flex items-center justify-end">
                  Used Credits
                  <SortIcon columnKey="usedCredits" />
                </div>
              </TableHead>
              <TableHead className="text-right cursor-pointer" onClick={() => handleSort('limitCredit')}>
                <div className="flex items-center justify-end">
                  Limit
                  <SortIcon columnKey="limitCredit" />
                </div>
              </TableHead>
              <TableHead className="w-[200px] cursor-pointer" onClick={() => handleSort('percentage')}>
                <div className="flex items-center">
                  Usage
                  <SortIcon columnKey="percentage" />
                </div>
              </TableHead>
              <TableHead className="text-right cursor-pointer" onClick={() => handleSort('expiresAt')}>
                <div className="flex items-center justify-end">
                  Expires
                  <SortIcon columnKey="expiresAt" />
                </div>
              </TableHead>
              <TableHead className="text-right">Overages</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLicenses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  No licenses found
                </TableCell>
              </TableRow>
            ) : (
              filteredLicenses.map((license) => (
                <TableRow key={license.licenseNonce}>
                  <TableCell className="font-mono text-xs">
                    {license.licenseNonce.slice(0, 8)}...{license.licenseNonce.slice(-4)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {license.tier}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {license.usedCredits.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">
                    {license.limitCredit.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <UsageProgress percentage={license.percentage} />
                      <span className="text-xs font-mono w-10 text-right">
                        {license.percentage.toFixed(0)}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {formatExpiration(license.expiresAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    {license.overageCount ? (
                      <div className="flex items-center justify-end gap-1">
                        <AlertTriangle className="w-3 h-3 text-amber-500" />
                        <span className="font-mono text-xs">
                          {license.overageCount}{license.billableCount ? ` (${license.billableCount} bl)` : ''}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <StatusBadge
                      percentage={license.percentage}
                      expiresAt={license.expiresAt}
                      overageCount={license.overageCount || 0}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
