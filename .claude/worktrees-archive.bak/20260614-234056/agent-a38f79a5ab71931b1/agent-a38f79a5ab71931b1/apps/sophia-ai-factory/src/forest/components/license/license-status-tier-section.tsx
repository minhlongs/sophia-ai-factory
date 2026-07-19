'use client';

/**
 * License Status Tier Section
 * Shows tier badge + status indicator dot
 */

import { Badge } from '@/seed/components/ui/badge';
import { getTierVariant, getStatusColor, formatTier } from './license-status-helpers';

interface LicenseStatusTierSectionProps {
  tier: string;
  status: string;
}

export function LicenseStatusTierSection({ tier, status }: LicenseStatusTierSectionProps) {
  const statusColor = getStatusColor(status);

  const dotClass =
    statusColor === 'green' ? 'bg-green-500' :
    statusColor === 'red' ? 'bg-red-500' :
    statusColor === 'yellow' ? 'bg-yellow-500' : 'bg-muted';

  const textClass =
    statusColor === 'green' ? 'text-green-600' :
    statusColor === 'red' ? 'text-red-600' :
    statusColor === 'yellow' ? 'text-yellow-600' : 'text-muted-foreground';

  return (
    <div className="flex items-center gap-4">
      <Badge variant={getTierVariant(tier)} className="text-sm px-3 py-1">
        {formatTier(tier)}
      </Badge>
      <div className="flex items-center gap-2">
        <div className={`w-3 h-3 rounded-full ${dotClass}`} />
        <span className={`text-sm capitalize ${textClass}`}>
          {status}
        </span>
      </div>
    </div>
  );
}
