'use client';

/**
 * Usage Meter Rate Limit Section
 * Shows current RPM, max RPM, remaining, and reset time
 */

import { Zap } from 'lucide-react';

interface RateLimitData {
  current: number;
  limit: number;
  remaining: number;
  resetAt: string;
}

interface UsageMeterRateLimitSectionProps {
  rateLimit: RateLimitData;
}

export function UsageMeterRateLimitSection({ rateLimit }: UsageMeterRateLimitSectionProps) {
  return (
    <div className="pt-4 border-t">
      <div className="flex items-center gap-2 mb-3">
        <Zap className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">Rate Limit</span>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center p-3 bg-muted rounded-lg">
          <div className="text-2xl font-bold">{rateLimit.current}</div>
          <div className="text-xs text-muted-foreground">Current RPM</div>
        </div>
        <div className="text-center p-3 bg-muted rounded-lg">
          <div className="text-2xl font-bold">{rateLimit.limit}</div>
          <div className="text-xs text-muted-foreground">Max RPM</div>
        </div>
        <div className="text-center p-3 bg-muted rounded-lg">
          <div className="text-2xl font-bold">{rateLimit.remaining}</div>
          <div className="text-xs text-muted-foreground">Remaining</div>
        </div>
      </div>
      <div className="mt-3 text-xs text-muted-foreground text-center">
        Rate limit resets at {new Date(rateLimit.resetAt).toLocaleTimeString()}
      </div>
    </div>
  );
}
