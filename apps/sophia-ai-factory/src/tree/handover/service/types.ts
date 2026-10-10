/**
 * Handover Service Types & Filters
 * Layer: Tree (Handover)
 */

export interface HandoverListFilter {
  limit?: number;
  offset?: number;
  status?: string;
  acceptanceStatus?: string;
}

export interface HandoverStatsResult {
  total: number;
  pending: number;
  active: number;
  accepted: number;
  rejected: number;
}
