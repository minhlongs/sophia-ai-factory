export type ActionEvent = {
  timestamp: number; // Unix time ms
  actionType: string;
};

export type GhostMatrixResult = {
  zScore: number;
  isAnomalous: boolean; // True if Z > threshold
  meanVelocity: number;
  varianceVelocity: number;
};

/**
 * Calculates Z-Score of action velocity (actions per window) to detect
 * spam-like or bot-like behavior to evade shadowbans.
 */
export function calculateZScore(
  history: ActionEvent[],
  currentActionsInWindow: number,
  windowMs: number = 3600000,
  anomalyThreshold: number = 3.0
): GhostMatrixResult {
  if (history.length === 0) {
    return {
      zScore: 0,
      isAnomalous: false,
      meanVelocity: 0,
      varianceVelocity: 0,
    };
  }

  // Bucket historical actions into windows
  const minTime = Math.min(...history.map((h) => h.timestamp));
  const maxTime = Math.max(...history.map((h) => h.timestamp));

  // If everything is in one window duration, we have very little varied history.
  // We'll count actions per 'windowMs' bucket.
  const numBuckets = Math.max(1, Math.ceil((maxTime - minTime + 1) / windowMs));
  const buckets = new Array(numBuckets).fill(0);

  for (const event of history) {
    const bucketIndex = Math.floor((event.timestamp - minTime) / windowMs);
    buckets[bucketIndex]++;
  }

  // Calculate mean
  const sum = buckets.reduce((a, b) => a + b, 0);
  const mean = sum / buckets.length;

  // Calculate variance
  const varianceSum = buckets.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0);
  const variance = buckets.length > 1 ? varianceSum / (buckets.length - 1) : 0;
  const stdDev = Math.sqrt(variance);

  let zScore = 0;
  if (stdDev > 0) {
    zScore = (currentActionsInWindow - mean) / stdDev;
  } else if (currentActionsInWindow > mean) {
    // If standard deviation is 0 but we spike above mean
    zScore = Infinity;
  }

  const isAnomalous = zScore > anomalyThreshold || zScore === Infinity;

  return {
    zScore,
    isAnomalous,
    meanVelocity: mean,
    varianceVelocity: variance,
  };
}
