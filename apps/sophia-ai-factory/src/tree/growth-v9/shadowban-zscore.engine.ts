/**
 * @file shadowban-zscore.engine.ts
 * @description Zero-IO mathematical engine for calculating shadowban anomaly using statistical Z-Scores
 * @layer tree
 */

export interface TelemetryPoint {
  timestampMs: number;
  viewVelocity: number;
  engagementRate: number;
}

export interface ZScoreResult {
  velocityZScore: number;
  engagementZScore: number;
  isAnomalous: boolean; // Flagged if Z-Score indicates significant negative deviation (shadowban)
}

/**
 * Calculates rolling mean and standard deviation, then calculates the Z-Score for the most recent data point.
 * Z = (X - \mu) / \sigma
 */
export function evaluateShadowbanRisk(
  historicalData: TelemetryPoint[],
  currentPoint: TelemetryPoint,
  anomalyThreshold: number = -2.0 // Typically < -2.0 indicates a significant drop
): ZScoreResult {
  if (historicalData.length === 0) {
    return {
      velocityZScore: 0,
      engagementZScore: 0,
      isAnomalous: false,
    };
  }

  // Calculate Mean
  const sum = historicalData.reduce(
    (acc, val) => {
      acc.viewVelocity += val.viewVelocity;
      acc.engagementRate += val.engagementRate;
      return acc;
    },
    { viewVelocity: 0, engagementRate: 0 }
  );

  const meanVelocity = sum.viewVelocity / historicalData.length;
  const meanEngagement = sum.engagementRate / historicalData.length;

  if (historicalData.length === 1) {
    // Cannot calculate standard deviation with a sample size of 1 correctly, defaults to 0 safely
    return {
      velocityZScore: currentPoint.viewVelocity < meanVelocity ? -1 : 1,
      engagementZScore: currentPoint.engagementRate < meanEngagement ? -1 : 1,
      isAnomalous: false,
    };
  }

  // Calculate Standard Deviation (Sample SD)
  const varianceSum = historicalData.reduce(
    (acc, val) => {
      acc.viewVelocity += Math.pow(val.viewVelocity - meanVelocity, 2);
      acc.engagementRate += Math.pow(val.engagementRate - meanEngagement, 2);
      return acc;
    },
    { viewVelocity: 0, engagementRate: 0 }
  );

  const sdVelocity = Math.sqrt(varianceSum.viewVelocity / (historicalData.length - 1));
  const sdEngagement = Math.sqrt(varianceSum.engagementRate / (historicalData.length - 1));

  // If standard deviation is 0, it means all historical data is exactly the same
  // We handle division by zero safely
  const velocityZScore =
    sdVelocity === 0
      ? currentPoint.viewVelocity === meanVelocity
        ? 0
        : currentPoint.viewVelocity < meanVelocity
        ? -999 // massive drop
        : 999
      : (currentPoint.viewVelocity - meanVelocity) / sdVelocity;

  const engagementZScore =
    sdEngagement === 0
      ? currentPoint.engagementRate === meanEngagement
        ? 0
        : currentPoint.engagementRate < meanEngagement
        ? -999
        : 999
      : (currentPoint.engagementRate - meanEngagement) / sdEngagement;

  // Shadowban is usually indicated by massive unnatural drops in both
  const isAnomalous = velocityZScore <= anomalyThreshold && engagementZScore <= anomalyThreshold;

  return {
    velocityZScore,
    engagementZScore,
    isAnomalous,
  };
}
