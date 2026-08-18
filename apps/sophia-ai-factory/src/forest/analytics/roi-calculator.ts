/**
 * ROI Calculator — forest re-export barrel
 * Canonical implementation lives in land/analytics/roi-calculator.ts.
 * Forest → land is explicitly allowed for orchestration per
 * .claude/rules/cross-layer-orchestration.md.
 */
export {
  type ROIMetrics,
  calculateRoiMetrics,
  calculateAggregateRoi,
} from '@/land/analytics/roi-calculator';
