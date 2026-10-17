'use client';
/**
 * License Status Card State Sub-components (Loading, Error, Compact)
 *
 * @module components/license/license-status-card-states
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/seed/components/ui/card';
import { Badge } from '@/seed/components/ui/badge';
import { Button } from '@/seed/components/ui/button';
import { RefreshCw, AlertCircle } from 'lucide-react';
import {
  type LicenseStatus,
  getTierVariant,
  getStatusColor,
  formatTier,
} from './license-status-helpers';

export function LicenseStatusLoadingCard() {
  return (
    <Card>
      <CardHeader>
        <div className="motion-safe:animate-pulse space-y-2">
          <div className="h-4 bg-muted rounded w-1/3" />
          <div className="h-3 bg-muted rounded w-1/4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="motion-safe:animate-pulse space-y-4">
          <div className="h-10 bg-muted rounded" />
          <div className="h-4 bg-muted rounded w-1/2" />
        </div>
      </CardContent>
    </Card>
  );
}

export function LicenseStatusErrorCard({ onRetry }: { onRetry: () => void }) {
  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-5 w-5" />
          License Error
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Failed to load license status. Please try again.
        </p>
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </CardContent>
    </Card>
  );
}

export function LicenseStatusCompactCard({
  license,
  isSyncing,
  onRefresh,
}: {
  license: LicenseStatus;
  isSyncing: boolean;
  onRefresh: () => void;
}) {
  const statusColor = getStatusColor(license.status);
  const dotClass =
    statusColor === 'green'
      ? 'bg-green-500'
      : statusColor === 'red'
        ? 'bg-red-500'
        : statusColor === 'yellow'
          ? 'bg-yellow-500'
          : 'bg-muted';

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">License</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${dotClass}`} />
            <Badge variant={getTierVariant(license.tier)}>
              {formatTier(license.tier)}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={isSyncing}
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? 'motion-safe:animate-spin' : ''}`} />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
