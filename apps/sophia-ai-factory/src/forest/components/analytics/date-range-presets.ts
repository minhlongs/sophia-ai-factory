/**
 * Preset configurations and ISO date range helpers for DateRangePicker.
 * @module forest/components/analytics/date-range-presets
 */

import type { DateRange } from 'react-day-picker';

/** ISO 8601 date range emitted by onChange */
export interface ISODateRange {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
  fromDate: Date;
  toDate: Date;
}

export type PresetKey = '7d' | '30d' | '90d' | 'month' | 'last-month';

interface DaysPreset {
  label: string;
  days: number;
}
interface TypePreset {
  label: string;
  type: 'current' | 'previous';
}
export type PresetConfig = DaysPreset | TypePreset;

export const PRESETS: Record<PresetKey, PresetConfig> = {
  '7d':         { label: 'Last 7 days',  days: 7 },
  '30d':        { label: 'Last 30 days', days: 30 },
  '90d':        { label: 'Last 90 days', days: 90 },
  'month':      { label: 'This month',   type: 'current' },
  'last-month': { label: 'Last month',   type: 'previous' },
};

export function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function resolvePresetDateRange(preset: PresetKey): DateRange {
  const config = PRESETS[preset];
  const now = new Date();
  let from = new Date(now);
  let to = new Date(now);

  if ('days' in config) {
    from.setDate(now.getDate() - config.days);
  } else if (config.type === 'current') {
    from = new Date(now.getFullYear(), now.getMonth(), 1);
  } else {
    from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    to = new Date(now.getFullYear(), now.getMonth(), 0);
  }

  return { from, to };
}
