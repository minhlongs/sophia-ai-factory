/**
 * Analytics Queries - Barrel Re-export
 *
 * All analytics query functions consolidated for backward-compatible import.
 * Import from '@/land/analytics/queries' or individual modules.
 */

export { fetchUsageMetrics } from './usage-queries';
export { fetchRevenueMetrics } from './revenue-queries';
export { fetchLicenseMetrics } from './campaign-queries';
export { fetchRevenueSnapshot } from './revenue-nowpayments';
export { aggregateRevenueAttribution, getContentUnitAttribution } from './revenue-attribution';
export type { RevenueAttributionRow, ContentUnitAttribution } from './revenue-attribution';
export { resolveContentRoi } from './content-roi-resolver';
export type { ContentProjectRoi, WorkspaceContentRoi, ChannelRoi } from './content-roi-resolver';
export { resolveCrossChannel } from './cross-channel-resolver';
export type { CrossChannelDashboard, ChannelAggregate } from './cross-channel-resolver';
