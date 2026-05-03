/**
 * React Query hook for Mission Control widget data.
 * Single network call, 5-minute stale time.
 * @module components/dashboard/mission-control/use-mission-control-data
 */

import { useQuery } from '@tanstack/react-query';
import type { Tier } from '@/types';

interface DayCount { date: string; count: number; }

export interface MissionControlData {
  tier: Tier;
  quota: { used: number; total: number; label: string };
  last7d: DayCount[];
  ctaHint: 'explore_sops' | 'upgrade' | 'renew';
}

export function useMissionControlData() {
  return useQuery<MissionControlData, Error>({
    queryKey: ['mission-control'],
    queryFn: async () => {
      const res = await fetch('/api/v1/dashboard/mission-control', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load mission control data');
      return res.json() as Promise<MissionControlData>;
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
}
