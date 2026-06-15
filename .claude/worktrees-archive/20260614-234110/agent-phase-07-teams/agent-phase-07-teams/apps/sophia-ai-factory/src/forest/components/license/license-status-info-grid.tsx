'use client';

/**
 * License Status Info Grid
 * 3-column grid showing nonce, expiry countdown, and rate limit
 */

import { Shield, Clock, Zap } from 'lucide-react';

interface LicenseStatusInfoGridProps {
  nonce: string;
  expiresAt?: string | null;
  rateLimit: number;
}

export function LicenseStatusInfoGrid({ nonce, expiresAt, rateLimit }: LicenseStatusInfoGridProps) {
  const daysUntilExpiry = expiresAt
    ? Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Shield className="h-4 w-4" />
          Nonce
        </div>
        <code className="text-xs bg-muted px-2 py-1 rounded block truncate">
          {nonce.slice(0, 12)}...
        </code>
      </div>

      {expiresAt && (
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
              : daysUntilExpiry === 0 ? 'Today' : 'Expired'}
          </div>
        </div>
      )}

      <div className="space-y-1">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Zap className="h-4 w-4" />
          Rate Limit
        </div>
        <div className="text-sm font-medium">
          {rateLimit.toLocaleString()} req/min
        </div>
      </div>
    </div>
  );
}
