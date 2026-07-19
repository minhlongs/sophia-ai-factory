/**
 * Shared funnel analytics types.
 *
 * Moved here from land/analytics/funnel-dashboard so forest/components
 * can import without crossing the forest→land boundary.
 *
 * @module seed/types/funnel
 */
export interface FunnelStepData { name: string; key: string; count: number; dropOffRate: number | null; conversionRate: number; } export interface FunnelGroup { id: string; title: string; description: string; steps: FunnelStepData[]; }
export interface FunnelDashboard { fromTs: number; toTs: number; funnels: FunnelGroup[]; }
