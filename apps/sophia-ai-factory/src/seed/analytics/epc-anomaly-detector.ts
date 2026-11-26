/**
 * Zero-Dependency Decaying Welford + Page CUSUM EPC Anomaly Detector.
 *
 * Clean-room primitive (MIT/Apache-2.0 patterns from uriva/anomalisa,
 * theonetrade/volume-anomaly, and vietthang/peak-ewma):
 * detects sudden affiliate EPC drops with lossless JSON snapshots for
 * stateless Cloudflare Workers + D1 persistence and 48h alert cooldown.
 *
 * Layer: seed/analytics (pure math, zero external deps)
 *
 * @module seed/analytics/epc-anomaly-detector
 */

export interface EpcAnomalyState {
  readonly count: number;
  readonly mean: number;
  readonly m2: number;
  readonly cusumDrop: number;
  readonly lastAlertAtMs: number | null;
}

export interface EpcAnomalyEvaluation {
  readonly nextState: EpcAnomalyState;
  readonly anomalyDetected: boolean;
  readonly shouldNotify: boolean;
  readonly zScore: number;
  readonly reason: string | null;
}

const STATS_DECAY = 0.98;
const COOLDOWN_MS = 48 * 60 * 60 * 1000;

export function createInitialEpcState(): EpcAnomalyState {
  return { count: 0, mean: 0, m2: 0, cusumDrop: 0, lastAlertAtMs: null };
}

export function evaluateEpcObservation(
  state: EpcAnomalyState,
  observedEpc: number,
  nowMs: number = Date.now(),
): EpcAnomalyEvaluation {
  const safeVal = Number.isFinite(observedEpc) ? Math.max(0, observedEpc) : 0;
  const decayedCount = state.count * STATS_DECAY;
  const variance = decayedCount > 1 ? state.m2 / decayedCount : 0;
  const stdDev = Math.sqrt(Math.max(1e-6, variance));

  const zScore = state.count >= 3 ? Number(((safeVal - state.mean) / stdDev).toFixed(3)) : 0;
  const dropSlack = 0.5 * stdDev;
  const nextCusum =
    state.count >= 3 ? Math.max(0, state.cusumDrop + (state.mean - safeVal) - dropSlack) : 0;

  const isZDrop = state.count >= 3 && zScore <= -2.5;
  const isCusumTrip = state.count >= 3 && nextCusum > 3.0 * stdDev;
  const anomalyDetected = isZDrop || isCusumTrip;

  const inCooldown =
    state.lastAlertAtMs !== null && nowMs - state.lastAlertAtMs < COOLDOWN_MS;
  const shouldNotify = anomalyDetected && !inCooldown;

  const nextCount = decayedCount + 1;
  const delta = safeVal - state.mean;
  const nextMean = state.mean + delta / nextCount;
  const nextM2 = state.m2 * STATS_DECAY + delta * (safeVal - nextMean);

  return {
    nextState: {
      count: Number(nextCount.toFixed(4)),
      mean: Number(nextMean.toFixed(6)),
      m2: Number(nextM2.toFixed(6)),
      cusumDrop: anomalyDetected ? 0 : Number(nextCusum.toFixed(6)),
      lastAlertAtMs: shouldNotify ? nowMs : state.lastAlertAtMs,
    },
    anomalyDetected,
    shouldNotify,
    zScore,
    reason: isZDrop ? 'EPC_ZSCORE_DROP' : isCusumTrip ? 'EPC_CUSUM_DECAY' : null,
  };
}
