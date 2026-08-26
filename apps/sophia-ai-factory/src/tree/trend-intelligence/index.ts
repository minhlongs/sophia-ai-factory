/**
 * Trend Intelligence — cross-channel trend detection + forecasting.
 *
 * Public API:
 *  - detectTrends: signals/events → ranked TrendDetection rows persisted
 *    to trend_detections (detect.ts)
 *  - buildForecast / smoothingLevel / residualStdDev: pure SES forecaster
 *    (forecast.ts)
 *  - computeTopicMomentum / bucketEvidence / topicsFromText: pure detection
 *    math (detect-math.ts)
 *
 * Layer: tree (domain reusable). Imports seed + tree only.
 *
 * @module tree/trend-intelligence
 */

export {
  detectTrends,
  type TrendDetectionRecord,
  type DetectTrendsInput,
} from './detect';
export {
  buildForecast,
  smoothingLevel,
  residualStdDev,
  DEFAULT_SMOOTHING_ALPHA,
  FORECAST_HORIZON_STEPS,
  DEFAULT_STEP_MS,
  type ForecastPayload,
  type ForecastPoint,
} from './forecast';
export {
  bucketEvidence,
  computeTopicMomentum,
  topicsFromText,
  type EvidencePoint,
  type TopicWindowStats,
  type DetectOptions,
} from './detect-math';
