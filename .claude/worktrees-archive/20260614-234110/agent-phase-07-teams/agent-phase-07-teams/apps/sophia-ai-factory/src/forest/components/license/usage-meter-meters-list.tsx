'use client';

/**
 * Usage Meter Meters List
 * Renders the hourly/daily/monthly usage meter cards with progress bars and tooltips
 */

import { Progress } from '@/seed/components/ui/progress';
import { Badge } from '@/seed/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/seed/components/ui/tooltip';
import { Clock, Zap, Calendar, AlertCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { getStatusColor, getStatusBorderColor, formatNumber } from './usage-meter-helpers';

interface MeterEntry {
  label: string;
  icon: LucideIcon;
  description: string;
  data: {
    used: number;
    limit: number;
    percentage: number;
    status: 'ok' | 'warning' | 'critical' | 'overage';
    overage?: number;
  };
}

interface UsageMeterMetersListProps {
  hourly: MeterEntry['data'];
  daily: MeterEntry['data'];
  monthly: MeterEntry['data'] & { overage?: number };
}

export function UsageMeterMetersList({ hourly, daily, monthly }: UsageMeterMetersListProps) {
  const meters: MeterEntry[] = [
    { label: 'Hourly', icon: Clock, data: hourly, description: 'Credits used this hour' },
    { label: 'Daily', icon: Zap, data: daily, description: 'Credits used today' },
    { label: 'Monthly', icon: Calendar, data: monthly, description: 'Credits used this month' },
  ];

  return (
    <div className="space-y-4">
      {meters.map((meter) => {
        const Icon = meter.icon;
        return (
          <div
            key={meter.label}
            className={`space-y-2 p-4 rounded-lg border ${getStatusBorderColor(meter.data.status)} bg-muted/30`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{meter.label} Usage</span>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Badge
                      variant={
                        meter.data.status === 'overage' ? 'destructive' :
                        meter.data.status === 'critical' ? 'default' :
                        meter.data.status === 'warning' ? 'secondary' : 'outline'
                      }
                    >
                      {meter.data.status.toUpperCase()}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{meter.description}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <div className="space-y-2">
              <Progress
                value={meter.data.percentage}
                indicatorClassName={getStatusColor(meter.data.status)}
                className="h-3"
              />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{formatNumber(meter.data.used)} used</span>
                <span className="font-medium">{formatNumber(meter.data.limit)} limit</span>
                <span className="text-muted-foreground">{meter.data.percentage.toFixed(1)}%</span>
              </div>
            </div>

            {meter.data.status === 'overage' && meter.data.overage && (
              <div className="flex items-center gap-2 text-xs text-destructive">
                <AlertCircle className="h-3 w-3" />
                {formatNumber(meter.data.overage)} credits over limit
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
