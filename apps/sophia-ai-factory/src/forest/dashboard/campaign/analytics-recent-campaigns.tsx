/**
 * AnalyticsRecentCampaigns — Reusable table of recent campaigns.
 *
 * Layer: Forest (infrastructure orchestrators)
 * Displays: campaign name, status, created date, completed date (if any)
 * Sortable by clicking column headers.
 * Max rows configurable via maxRows prop (default 10).
 * Links to individual campaign detail page.
 */

'use client';

import React, { useState, useMemo } from 'react';
import { Link } from '@/navigation';
import { useTranslations } from 'next-intl';
import { cn } from '@/seed/utils/cn';
import { ArrowUpDown, ArrowUp, ArrowDown, ExternalLink } from 'lucide-react';
import type { AnalyticsRecentCampaignsProps } from './types';

type SortField = 'name' | 'status' | 'createdAt' | 'completedAt';
type SortDir = 'asc' | 'desc';

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function getStatusLabel(status: string): string {
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function AnalyticsRecentCampaigns({
  campaigns,
  maxRows = 10,
  className,
}: AnalyticsRecentCampaignsProps) {
  const t = useTranslations('dashboard.analytics');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const sorted = useMemo(() => {
    const copy = [...campaigns];
    copy.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name':
          cmp = a.name.localeCompare(b.name);
          break;
        case 'status':
          cmp = a.status.localeCompare(b.status);
          break;
        case 'createdAt':
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'completedAt': {
          const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0;
          const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0;
          cmp = aTime - bTime;
          break;
        }
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return copy.slice(0, maxRows);
  }, [campaigns, sortField, sortDir, maxRows]);

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3 w-3 ml-1 inline opacity-50" />;
    }
    return sortDir === 'asc'
      ? <ArrowUp className="h-3 w-3 ml-1 inline" />
      : <ArrowDown className="h-3 w-3 ml-1 inline" />;
  };

  const thClass =
    'px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer select-none hover:text-foreground transition-colors';
  const tdClass = 'px-4 py-3 text-sm whitespace-nowrap';

  return (
    <div className={cn('space-y-2', className)}>
      <div className="overflow-x-auto rounded-lg border border-border/50">
        <table className="w-full" aria-label={t('recent_campaigns_title') || 'Recent campaigns'}>
          <thead className="bg-muted/30">
            <tr>
              <th className={thClass} onClick={() => handleSort('name')}>
                {t('recent_name') || 'Name'}
                {renderSortIcon('name')}
              </th>
              <th className={thClass} onClick={() => handleSort('status')}>
                {t('recent_status') || 'Status'}
                {renderSortIcon('status')}
              </th>
              <th className={thClass} onClick={() => handleSort('createdAt')}>
                {t('recent_created') || 'Created'}
                {renderSortIcon('createdAt')}
              </th>
              <th className={thClass} onClick={() => handleSort('completedAt')}>
                {t('recent_completed') || 'Completed'}
                {renderSortIcon('completedAt')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <span className="sr-only">{t('recent_actions') || 'Actions'}</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30 bg-card">
            {sorted.map((campaign) => (
              <tr
                key={campaign.id}
                className="hover:bg-muted/20 transition-colors"
              >
                <td className={cn(tdClass, 'font-medium text-foreground max-w-[200px] truncate')}>
                  {campaign.name}
                </td>
                <td className={tdClass}>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                    {getStatusLabel(campaign.status)}
                  </span>
                </td>
                <td className={tdClass + ' text-muted-foreground'}>
                  {formatDate(campaign.createdAt)}
                </td>
                <td className={tdClass + ' text-muted-foreground'}>
                  {formatDate(campaign.completedAt)}
                </td>
                <td className={cn(tdClass, 'text-right')}>
                  <Link
                    href={`/dashboard/campaigns/${campaign.id}`}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                    aria-label={`${t('recent_view') || 'View'} ${campaign.name}`}
                  >
                    {t('recent_view') || 'View'}
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-sm text-muted-foreground"
                >
                  {t('recent_empty') || 'No campaigns found'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

AnalyticsRecentCampaigns.displayName = 'AnalyticsRecentCampaigns';
