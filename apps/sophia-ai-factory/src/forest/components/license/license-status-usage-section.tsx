'use client';

/**
 * License Status Usage Section
 * Quota progress bar + overage warning + feature entitlements + billing info
 */

import { Progress } from '@/seed/components/ui/progress';
import { Badge } from '@/seed/components/ui/badge';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface LicenseStatusUsageSectionProps {
  currentUsage: number;
  quotaLimit: number;
  features: string[];
  polarCustomerId?: string | null;
  stripeCustomerId?: string | null;
}

export function LicenseStatusUsageSection({
  currentUsage,
  quotaLimit,
  features,
  polarCustomerId,
  stripeCustomerId,
}: LicenseStatusUsageSectionProps) {
  const usagePercentage = quotaLimit > 0 ? (currentUsage / quotaLimit) * 100 : 0;

  const progressColor =
    usagePercentage >= 100 ? 'bg-destructive' :
    usagePercentage >= 80 ? 'bg-yellow-500' :
    'bg-green-500';

  return (
    <>
      {/* Quota Usage */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Quota Usage</span>
          <span className="font-medium">
            {currentUsage.toLocaleString()} / {quotaLimit.toLocaleString()}
          </span>
        </div>
        <Progress value={usagePercentage} indicatorClassName={progressColor} />
        {usagePercentage >= 80 && (
          <p className="text-xs text-yellow-600 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            {usagePercentage >= 100 ? 'Quota exceeded' : 'Approaching quota limit'}
          </p>
        )}
      </div>

      {/* Feature Entitlements */}
      {features.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium">Feature Entitlements</div>
          <div className="flex flex-wrap gap-2">
            {features.map((feature) => (
              <Badge key={feature} variant="outline" className="text-xs">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {feature}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Billing Integration */}
      {(polarCustomerId || stripeCustomerId) && (
        <div className="pt-4 border-t space-y-2">
          <div className="text-sm font-medium">Billing Integration</div>
          <div className="flex gap-4 text-xs text-muted-foreground">
            {polarCustomerId && (
              <div className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-green-600" />
                Polar: {polarCustomerId.slice(0, 12)}...
              </div>
            )}
            {stripeCustomerId && (
              <div className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-green-600" />
                Stripe: {stripeCustomerId.slice(0, 12)}...
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
