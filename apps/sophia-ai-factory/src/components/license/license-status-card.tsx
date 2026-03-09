/**
 * License Status Card Component
 *
 * Displays real-time license information from RaaS Gateway:
 * - License tier badge (BASIC/PREMIUM/ENTERPRISE/MASTER)
 * - Status indicator (active/expired/suspended)
 * - Expiration countdown
 * - Feature entitlements
 *
 * Features:
 * - Auto-refresh every 30 seconds
 * - Sync with RaaS Gateway via API
 * - JWT + mk_ API key authentication
 * - Cloudflare KV rate limiting
 *
 * @module components/license/license-status-card
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Key, RefreshCw, Shield, Zap, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface LicenseStatus {
  nonce: string;
  tier: 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER';
  status: 'active' | 'expired' | 'suspended' | 'revoked';
  createdAt: string;
  expiresAt?: string | null;
  features: string[];
  rateLimit: number;
  quotaLimit: number;
  currentUsage: number;
  polarCustomerId?: string | null;
  stripeCustomerId?: string | null;
}

interface LicenseStatusCardProps {
  licenseNonce?: string;
  compact?: boolean;
}

/**
 * Get tier badge variant
 */
function getTierVariant(tier: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (tier) {
    case 'MASTER': return 'destructive';
    case 'ENTERPRISE': return 'default';
    case 'PREMIUM': return 'secondary';
    default: return 'outline';
  }
}

/**
 * Get status indicator color
 */
function getStatusColor(status: string): 'green' | 'red' | 'yellow' | 'gray' {
  switch (status) {
    case 'active': return 'green';
    case 'expired': return 'red';
    case 'suspended': return 'yellow';
    case 'revoked': return 'gray';
    default: return 'gray';
  }
}

/**
 * Format tier display name
 */
function formatTier(tier: string): string {
  return tier.charAt(0) + tier.slice(1).toLowerCase();
}

/**
 * License Status Card
 */
export function LicenseStatusCard({ licenseNonce, compact = false }: LicenseStatusCardProps) {
  const queryClient = useQueryClient();

  // Fetch license status
  const { data: license, isLoading, error, refetch } = useQuery<LicenseStatus>({
    queryKey: ['/api/license/status', licenseNonce],
    enabled: !!licenseNonce,
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  // Sync with RaaS Gateway mutation
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
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-muted rounded w-1/3" />
            <div className="h-3 bg-muted rounded w-1/4" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
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
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => refetch()}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const statusColor = getStatusColor(license.status);
  const usagePercentage = license.quotaLimit > 0
    ? (license.currentUsage / license.quotaLimit) * 100
    : 0;

  const daysUntilExpiry = license.expiresAt
    ? Math.ceil((new Date(license.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  if (compact) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">License</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  statusColor === 'green' ? 'bg-green-500' :
                  statusColor === 'red' ? 'bg-red-500' :
                  statusColor === 'yellow' ? 'bg-yellow-500' : 'bg-gray-500'
                }`}
              />
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
              <RefreshCw className={`h-4 w-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
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
            <CardDescription>
              Real-time status from RaaS Gateway
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending || license.status !== 'active'}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
            Sync
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Tier & Status */}
        <div className="flex items-center gap-4">
          <Badge variant={getTierVariant(license.tier)} className="text-sm px-3 py-1">
            {formatTier(license.tier)}
          </Badge>
          <div className="flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full ${
                statusColor === 'green' ? 'bg-green-500' :
                statusColor === 'red' ? 'bg-red-500' :
                statusColor === 'yellow' ? 'bg-yellow-500' : 'bg-gray-500'
              }`}
            />
            <span className={`text-sm capitalize ${
              statusColor === 'green' ? 'text-green-600' :
              statusColor === 'red' ? 'text-red-600' :
              statusColor === 'yellow' ? 'text-yellow-600' : 'text-gray-600'
            }`}>
              {license.status}
            </span>
          </div>
        </div>

        {/* License Info */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Shield className="h-4 w-4" />
              Nonce
            </div>
            <code className="text-xs bg-muted px-2 py-1 rounded block truncate">
              {license.nonce.slice(0, 12)}...
            </code>
          </div>

          {license.expiresAt && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                Expires
              </div>
              <div className={`text-sm font-medium ${
                daysUntilExpiry !== null && daysUntilExpiry <= 7 ? 'text-destructive' : ''
              }`}>
                {daysUntilExpiry !== null && daysUntilExpiry > 0
                  ? `${daysUntilExpiry} days`
                  : daysUntilExpiry === 0
                  ? 'Today'
                  : 'Expired'}
              </div>
            </div>
          )}

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Zap className="h-4 w-4" />
              Rate Limit
            </div>
            <div className="text-sm font-medium">
              {license.rateLimit.toLocaleString()} req/min
            </div>
          </div>
        </div>

        {/* Usage Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Quota Usage</span>
            <span className="font-medium">
              {license.currentUsage.toLocaleString()} / {license.quotaLimit.toLocaleString()}
            </span>
          </div>
          <Progress
            value={usagePercentage}
            indicatorClassName={
              usagePercentage >= 100 ? 'bg-destructive' :
              usagePercentage >= 80 ? 'bg-yellow-500' :
              'bg-green-500'
            }
          />
          {usagePercentage >= 80 && (
            <p className="text-xs text-yellow-600 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {usagePercentage >= 100 ? 'Quota exceeded' : 'Approaching quota limit'}
            </p>
          )}
        </div>

        {/* Feature Entitlements */}
        {license.features.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium">Feature Entitlements</div>
            <div className="flex flex-wrap gap-2">
              {license.features.map((feature) => (
                <Badge key={feature} variant="outline" className="text-xs">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  {feature}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Integration Info */}
        {(license.polarCustomerId || license.stripeCustomerId) && (
          <div className="pt-4 border-t space-y-2">
            <div className="text-sm font-medium">Billing Integration</div>
            <div className="flex gap-4 text-xs text-muted-foreground">
              {license.polarCustomerId && (
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                  Polar: {license.polarCustomerId.slice(0, 12)}...
                </div>
              )}
              {license.stripeCustomerId && (
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                  Stripe: {license.stripeCustomerId.slice(0, 12)}...
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default LicenseStatusCard;
