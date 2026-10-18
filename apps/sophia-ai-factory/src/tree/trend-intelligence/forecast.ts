/**
 * Naive exponential-smoothing forecaster for trend trajectories.
 * Pure functions only — no DB access, no clock reads.
 *
 * Layer: tree (domain reusable)
 * @module tree/trend-intelligence/forecast
 */

export interface ForecastPoint {
  readonly step: number;
  readonly timestamp: number;
  readonly projected: number;
  readonly lower: number;
  readonly upper: number;
}

export interface ForecastPayload {
  readonly model: 'exponential-smoothing';
  readonly alpha: number;
  readonly level: number;
  readonly residualStdDev: number;
  readonly generatedAt: number;
  readonly stepMs: number;
  readonly horizonSteps: number;
  readonly points: readonly ForecastPoint[];
}

export const DEFAULT_SMOOTHING_ALPHA = 0.4;
export const FORECAST_HORIZON_STEPS = 7;
export const DEFAULT_STEP_MS = 24 * 60 * 60 * 1000;
const Z_95 = 1.959963984540054;

function assertAlpha(alpha: number): void {
  if (!(Number.isFinite(alpha) && alpha > 0 && alpha <= 1)) {
    throw new RangeError(`alpha must be in (0, 1], received ${alpha}`);
  }
}

/** Final SES level of the series: l_t = α·x_t + (1−α)·l_{t−1}, l_0 = x_0. */
export function smoothingLevel(series: readonly number[], alpha: number): number {
  assertAlpha(alpha);
  if (series.length === 0) return 0;
  let level = series[0];
  for (let i = 1; i < series.length; i++) {
    level = alpha * series[i] + (1 - alpha) * level;
  }
  return level;
}

/** Std-dev of one-step-ahead forecast errors (x_t − l_{t−1}); 0 for short series. */
export function residualStdDev(series: readonly number[], alpha: number): number {
  assertAlpha(alpha);
  if (series.length < 2) return 0;
  let level = series[0];
  const errors: number[] = [];
  for (let i = 1; i < series.length; i++) {
    errors.push(series[i] - level);
    level = alpha * series[i] + (1 - alpha) * level;
  }
  const mean = errors.reduce((acc, e) => acc + e, 0) / errors.length;
  const variance = errors.reduce((acc, e) => acc + (e - mean) ** 2, 0) / errors.length;
  return Math.sqrt(variance);
}

function validateForecastOptions(generatedAtMs: number, stepMs: number, horizonSteps: number): void {
  if (!Number.isFinite(generatedAtMs)) {
    throw new RangeError(`generatedAtMs must be finite, received ${generatedAtMs}`);
  }
  if (!(stepMs > 0 && Number.isFinite(stepMs))) {
    throw new RangeError(`stepMs must be a positive finite number, received ${stepMs}`);
  }
  if (!(Number.isInteger(horizonSteps) && horizonSteps > 0)) {
    throw new RangeError(`horizonSteps must be a positive integer, received ${horizonSteps}`);
  }
}

/**
 * Build a 7-day (by default) flat projection with widening 95% intervals.
 */
export function buildForecast(
  series: readonly number[],
  generatedAtMs: number,
  options?: { alpha?: number; stepMs?: number; horizonSteps?: number },
): ForecastPayload {
  const alpha = options?.alpha ?? DEFAULT_SMOOTHING_ALPHA;
  const stepMs = options?.stepMs ?? DEFAULT_STEP_MS;
  const horizonSteps = options?.horizonSteps ?? FORECAST_HORIZON_STEPS;
  assertAlpha(alpha);
  validateForecastOptions(generatedAtMs, stepMs, horizonSteps);

  const level = smoothingLevel(series, alpha);
  const sigma = residualStdDev(series, alpha);
  const projected = Math.max(level, 0);

  const points: ForecastPoint[] = [];
  for (let step = 1; step <= horizonSteps; step++) {
    const margin = Z_95 * sigma * Math.sqrt(step);
    points.push({
      step,
      timestamp: generatedAtMs + step * stepMs,
      projected,
      lower: Math.max(projected - margin, 0),
      upper: projected + margin,
    });
  }

  return {
    model: 'exponential-smoothing',
    alpha,
    level,
    residualStdDev: sigma,
    generatedAt: generatedAtMs,
    stepMs,
    horizonSteps,
    points,
  };
}
