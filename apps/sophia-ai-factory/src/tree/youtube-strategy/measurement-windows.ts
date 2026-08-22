/**
 * Measurement window logic for YouTube video performance tracking.
 * Defines standard 24h / 7d / 30d observation periods.
 */

export type MeasurementWindow = '24h' | '7d' | '30d';

export interface WindowConfig {
  readonly label: MeasurementWindow;
  readonly durationMs: number;
  readonly description: string;
}

export const WINDOW_CONFIGS: Record<MeasurementWindow, WindowConfig> = {
  '24h': {
    label: '24h',
    durationMs: 24 * 60 * 60 * 1000,
    description: 'Initial traction signal',
  },
  '7d': {
    label: '7d',
    durationMs: 7 * 24 * 60 * 60 * 1000,
    description: 'Mid-term performance stabilization',
  },
  '30d': {
    label: '30d',
    durationMs: 30 * 24 * 60 * 60 * 1000,
    description: 'Long-term evergreen assessment',
  },
} as const;

export const ALL_WINDOWS: readonly MeasurementWindow[] = ['24h', '7d', '30d'];

/**
 * Determine which measurement windows have elapsed for a given publish time.
 */
export function elapsedWindows(publishedAt: Date, now: Date): MeasurementWindow[] {
  const elapsedMs = now.getTime() - publishedAt.getTime();
  return ALL_WINDOWS.filter((w) => elapsedMs >= WINDOW_CONFIGS[w].durationMs);
}

/**
 * Determine the next pending window for a given publish time.
 */
export function nextPendingWindow(
  publishedAt: Date,
  now: Date,
): MeasurementWindow | null {
  const elapsedMs = now.getTime() - publishedAt.getTime();
  for (const w of ALL_WINDOWS) {
    if (elapsedMs < WINDOW_CONFIGS[w].durationMs) return w;
  }
  return null;
}

/**
 * Calculate time remaining until a specific window elapses.
 * Returns 0 if the window has already elapsed.
 */
export function timeRemainingMs(
  publishedAt: Date,
  now: Date,
  window: MeasurementWindow,
): number {
  const deadlineMs = publishedAt.getTime() + WINDOW_CONFIGS[window].durationMs;
  return Math.max(0, deadlineMs - now.getTime());
}

/**
 * Format remaining time as human-readable string (e.g. "5h 30m").
 */
export function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return 'elapsed';
  const hours = Math.floor(ms / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
