'use client';

import React from 'react';
import Link from 'next/link';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import type { HealthResponse } from '@/types/health';

export function HealthIndicator() {
  const { data: health, isLoading, isError } = useQuery<HealthResponse>({
    queryKey: ['system-health'],
    queryFn: async () => {
      const res = await fetch('/api/health');
      if (!res.ok) throw new Error('Failed to fetch health status');
      return res.json();
    },
    refetchInterval: 30000, // Check every 30 seconds
  });

  if (isLoading) return null;

  let statusColor = 'text-green-500';
  let StatusIcon = CheckCircle;
  let statusText = 'System Operational';

  if (isError || !health) {
    statusColor = 'text-muted-foreground';
    StatusIcon = AlertCircle;
    statusText = 'Status Unknown';
  } else if (health.status === 'unhealthy') {
    statusColor = 'text-destructive';
    StatusIcon = AlertCircle;
    statusText = 'System Issues Detected';
  } else if (health.status === 'degraded') {
    statusColor = 'text-yellow-500';
    StatusIcon = AlertCircle;
    statusText = 'System Degraded';
  }

  const lastChecked = health ? new Date(health.timestamp).toLocaleTimeString() : 'Never';

  return (
    <Link
      href="/dashboard/system-health"
      className="flex items-center gap-2 px-4 py-2 mt-auto text-sm hover:bg-muted transition-colors rounded-lg group"
      title={`${statusText} (Last checked: ${lastChecked})`}
    >
      <StatusIcon className={`w-4 h-4 ${statusColor}`} />
      <span className="text-muted-foreground font-medium group-hover:text-foreground">
        System Status
      </span>
      <span className={`w-2 h-2 rounded-full ml-auto ${
        health?.status === 'healthy' ? 'bg-green-500' :
        health?.status === 'degraded' ? 'bg-yellow-500' :
        health?.status === 'unhealthy' ? 'bg-destructive' : 'bg-muted-foreground'
      } animate-pulse`} />
    </Link>
  );
}
