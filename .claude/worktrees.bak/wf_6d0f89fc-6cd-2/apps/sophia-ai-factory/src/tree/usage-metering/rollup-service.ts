/**
 * Usage Metering - Rollup Service (barrel re-export for backward compatibility)
 *
 * Implementation moved to rollup/ directory for modular code management.
 * Import from here or directly from './rollup/*'.
 */

export type { ServiceBreakdownItem, HourlySummaryRecord, DailySummaryRecord } from './rollup/rollup-utils';

export {
  calculateHourlyRollup,
  upsertHourlySummary,
  runHourlyRollup,
  calculateDailyRollup,
  upsertDailySummary,
  runDailyRollup,
} from './rollup/index';
