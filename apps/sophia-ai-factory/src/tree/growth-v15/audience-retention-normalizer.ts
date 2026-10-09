/**
 * Tree Layer: Audience Retention Normalizer
 * Numerical quadrature and retention decay calculus for audience engagement curves.
 * Layer: tree/growth-v15 | Max LOC: < 200 | Zero :any
 * @module tree/growth-v15/audience-retention-normalizer
 */

import type {
  AudienceRetentionCurvePoint,
  RetentionIntegralResult,
} from '@/seed/types/growth-triad-v15';

/**
 * Calculates normalized engagement metrics from discrete audience retention curves
 * using trapezoidal numerical integration.
 */
export function normalizeAudienceRetention(
  curve: AudienceRetentionCurvePoint[]
): RetentionIntegralResult {
  if (curve.length < 2) {
    return {
      integratedRetentionPct: 0,
      normalizedCompletionScore: 0,
      hookDropoffRate: 0,
      bodySlope: 0,
    };
  }

  // Sort curve monotonically by timePct
  const sorted = [...curve].sort((a, b) => a.timePct - b.timePct);

  // Trapezoidal quadrature over [timePct_0, timePct_n]
  let totalArea = 0;
  for (let i = 0; i < sorted.length - 1; i++) {
    const p1 = sorted[i];
    const p2 = sorted[i + 1];
    const dt = p2.timePct - p1.timePct;
    if (dt > 0) {
      const avgHeight = (p1.retentionPct + p2.retentionPct) / 2;
      totalArea += dt * avgHeight;
    }
  }

  // Domain of integration length
  const totalDt = sorted[sorted.length - 1].timePct - sorted[0].timePct;
  const integratedRetentionPct = totalDt > 0 ? totalArea / totalDt : 0;
  const normalizedCompletionScore = Math.max(0, Math.min(1, integratedRetentionPct / 100));

  // Hook dropoff rate: drop in retention between first point and either ~10% mark or second point
  const firstPoint = sorted[0];
  const hookTarget = sorted.find((p) => p.timePct >= 10) ?? sorted[1];
  const hookDropoff = Math.max(0, firstPoint.retentionPct - hookTarget.retentionPct);
  const hookDropoffRate = firstPoint.retentionPct > 0 ? hookDropoff / firstPoint.retentionPct : 0;

  // Body slope: linear slope between ~10% and ~90% (or overall bounds if intermediate points do not span)
  let pStart = sorted[0];
  let pEnd = sorted[sorted.length - 1];
  const candidateStart = sorted.find((p) => p.timePct >= 10);
  const candidateEnd = [...sorted].reverse().find((p) => p.timePct <= 90);
  if (candidateStart && candidateEnd && candidateEnd.timePct > candidateStart.timePct) {
    pStart = candidateStart;
    pEnd = candidateEnd;
  }
  const deltaX = pEnd.timePct - pStart.timePct;
  const bodySlope = deltaX > 0 ? (pEnd.retentionPct - pStart.retentionPct) / deltaX : 0;

  return {
    integratedRetentionPct,
    normalizedCompletionScore,
    hookDropoffRate: Math.max(0, Math.min(1, hookDropoffRate)),
    bodySlope,
  };
}
