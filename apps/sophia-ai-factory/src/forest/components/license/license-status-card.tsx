'use client';
/**
 * License Status Card Component
 * Composition root: displays real-time license info from RaaS Gateway
 *
 * @module components/license/license-status-card
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchJson } from '@/seed/utils/fetch-json';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/seed/components/ui/card';
import { Badge } from '@/seed/components/ui/badge';
import { Button } from '@/seed/components/ui/button';
import { Key, RefreshCw, AlertCircle } from 'lucide-react';
import { LicenseStatusTierSection } from './license-status-tier-section';
import { LicenseStatusUsageSection } from './license-status-usage-section';
import { LicenseStatusInfoGrid } from './license-status-info-grid';
import {
  type LicenseStatus,
  getTierVariant,
  getStatusColor,
  formatTier,
} from './license-status-helpers';

interface LicenseStatusCardProps {
  licenseNonce?: string;
  compact?: boolean;
}

export function LicenseStatusCard({ licenseNonce, compact = false }: LicenseStatusCardProps) {
  const queryClient = useQueryClient();

  const { data: license, isLoading, error, refetch } = useQuery<LicenseStatus>({
    queryKey: ['/api/license/status', licenseNonce],
    queryFn: () => fetchJson<LicenseStatus>(`/api/license/status?nonce=${encodeURIComponent(licenseNonce ?? '')}`),
    enabled: !!licenseNonce,
    refetchInterval: 30000,
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/license/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseNonce }),
      });
      if (!response.ok) throw new Error('Sync failed');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/license/status'] });
    },
  });

  if (isLoading) {
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

  if (error || !license) {
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
          <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const statusColor = getStatusColor(license.status);

  if (compact) {
    const dotClass =
      statusColor === 'green' ? 'bg-green-500' :
      statusColor === 'red' ? 'bg-red-500' :
      statusColor === 'yellow' ? 'bg-yellow-500' : 'bg-gray-500';

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
              onClick={() => refetch()}
              disabled={syncMutation.isPending}
            >
              <RefreshCw className={`h-4 w-4 ${syncMutation.isPending ? 'motion-safe:animate-spin' : ''}`} />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              License Status
            </CardTitle>
            <CardDescription>Real-time status from RaaS Gateway</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending || license.status !== 'active'}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${syncMutation.isPending ? 'motion-safe:animate-spin' : ''}`} />
            Sync
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <LicenseStatusTierSection tier={license.tier} status={license.status} />

        <LicenseStatusInfoGrid
          nonce={license.nonce}
          expiresAt={license.expiresAt}
          rateLimit={license.rateLimit}
        />

        <LicenseStatusUsageSection
          currentUsage={license.currentUsage}
          quotaLimit={license.quotaLimit}
          features={license.features}
          stripeCustomerId={license.stripeCustomerId}
        />
      </CardContent>
    </Card>
  );
}

export default LicenseStatusCard;
