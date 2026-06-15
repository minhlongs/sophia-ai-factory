/**
 * Usage Meter - shared helpers and types
 */

export interface UsageMeterData {
  hourly: {
    used: number;
    limit: number;
    percentage: number;
    status: 'ok' | 'warning' | 'critical' | 'overage';
  };
  daily: {
    used: number;
    limit: number;
    percentage: number;
    status: 'ok' | 'warning' | 'critical' | 'overage';
  };
  monthly: {
    used: number;
    limit: number;
    percentage: number;
    status: 'ok' | 'warning' | 'critical' | 'overage';
    overage?: number;
  };
  rateLimit: {
    current: number;
    limit: number;
    remaining: number;
    resetAt: string;
  };
}

/** Get progress bar color class for usage status */
export function getStatusColor(status: string): string {
  switch (status) {
    case 'overage': return 'bg-destructive';
    case 'critical': return 'bg-orange-500';
    case 'warning': return 'bg-yellow-500';
    default: return 'bg-green-500';
  }
}

/** Get border color class for usage status */
export function getStatusBorderColor(status: string): string {
  switch (status) {
    case 'overage': return 'border-destructive';
    case 'critical': return 'border-orange-500';
    case 'warning': return 'border-yellow-500';
    default: return 'border-green-500';
  }
}

/** Format number with K/M suffix */
export function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}
