'use client';

/**
 * SOP Detail Analytics Types
 *
 * Layer: components/sop/detail/analytics
 */

import type { SopRunRow, SopTemplateRow } from '@/seed/sop/sop-types';

export interface SopAnalyticsTabProps {
  runs: SopRunRow[];
  totalRuns?: number;
  totalCreditsSpent?: number;
  sopId?: string;
  template?: SopTemplateRow | null;
}

export interface DrillDownPanelProps {
  drillDownDate: string | null;
  setDrillDownDate: (v: string | null) => void;
  dayDrillDown: SopRunRow[] | null;
}

export interface SopStats {
  completed: number;
  failed: number;
  paused: number;
  running: number;
  total: number;
  successRate: number;
}
