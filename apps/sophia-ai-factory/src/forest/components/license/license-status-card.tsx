'use client';
/**
 * License Status Card Component
 * Composition root: displays real-time license info from RaaS Gateway
 *
 * @module components/license/license-status-card
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchJson } from '@/seed/utils/fetch-json';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/seed/components/ui/card';
import { Button } from '@/seed/components/ui/button';
import { Key, RefreshCw } from 'lucide-react';
import { LicenseStatusTierSection } from './license-status-tier-section';
import { LicenseStatusUsageSection } from './license-status-usage-section';
import { LicenseStatusInfoGrid } from './license-status-info-grid';
import type { LicenseStatus } from './license-status-helpers';
import {
  LicenseStatusLoadingCard,
  LicenseStatusErrorCard,
  LicenseStatusCompactCard,
} from './license-status-card-states';

export {
  LicenseStatusLoadingCard,
  LicenseStatusErrorCard,
  LicenseStatusCompactCard,
};

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
    return <LicenseStatusLoadingCard />;
  }

  if (error || !license) {
    return <LicenseStatusErrorCard onRetry={() => refetch()} />;
  }

  if (compact) {
    return (
      <LicenseStatusCompactCard
        license={license}
        isSyncing={syncMutation.isPending}
        onRefresh={() => refetch()}
      />
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
