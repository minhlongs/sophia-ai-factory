import type { AnalyticsRecentCampaignsProps } from './types';

export type SortField = 'name' | 'status' | 'createdAt' | 'completedAt';
export type SortDir = 'asc' | 'desc';

export function formatDate(dateStr: string | null): string {
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

export function getStatusLabel(status: string): string {
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function sortCampaigns(
  campaigns: AnalyticsRecentCampaignsProps['campaigns'],
  sortField: SortField,
  sortDir: SortDir,
  maxRows: number,
): AnalyticsRecentCampaignsProps['campaigns'] {
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
}
