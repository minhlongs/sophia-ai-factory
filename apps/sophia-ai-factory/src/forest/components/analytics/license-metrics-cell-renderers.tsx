'use client';

/**
 * License Metrics Cell Renderers
 * StatusBadge, UsageProgress, and formatExpiration for LicenseMetricsTable rows
 */

import { Badge } from '@/seed/components/ui/badge';
import { AlertTriangle } from 'lucide-react';

/** Color class for usage percentage */
function getUsageColor(pct: number): string {
  if (pct >= 90) return 'bg-red-500';
  if (pct >= 75) return 'bg-amber-500';
  return 'bg-green-500';
}

/** Progress bar for usage percentage */
export function UsageProgress({ percentage }: { percentage: number }) {
  return (
    <div className="w-full bg-muted rounded-full h-2">
      <div
        className={`h-2 rounded-full transition-all ${getUsageColor(percentage)}`}
        style={{ width: `${Math.min(percentage, 100)}%` }}
      />
    </div>
  );
}

/** Status badge with expiry + overage awareness */
export function StatusBadge({
  percentage,
  expiresAt,
  overageCount = 0,
}: {
  percentage: number;
  expiresAt: number | null;
  overageCount?: number;
}) {
  const now = Math.floor(Date.now() / 1000);
  const isExpired = expiresAt !== null && expiresAt < now;

  if (isExpired) {
    return <Badge variant="destructive" className="text-xs">Expired</Badge>;
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
}

/** Format expiration timestamp to human-readable string */
export function formatExpiration(expiresAt: number | null): string {
  if (!expiresAt) return 'Never';
  const date = new Date(expiresAt * 1000);
  const now = new Date();
  const diffDays = Math.floor((expiresAt * 1000 - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'Expired';
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays < 7) return `${diffDays} days`;
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(date);
}
