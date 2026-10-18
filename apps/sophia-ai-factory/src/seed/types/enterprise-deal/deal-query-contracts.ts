/**
 * Enterprise Deal Query Filter and Result Contracts
 *
 * Layer: seed/types (Foundational - zero upper-layer imports)
 *
 * @module seed/types/enterprise-deal/deal-query-contracts
 */

import type { DealStage, PipelineTier } from './deal-constants';
import type { EnterpriseDeal } from './deal-entities';

export interface QueryEnterpriseDealsFilters {
  stage?: DealStage;
  pipelineTier?: PipelineTier;
  search?: string;
  limit?: number;
  offset?: number;
  orderBy?: 'created_at' | 'bant_score' | 'deal_value_estimate_cents';
  orderDirection?: 'asc' | 'desc';
}

export interface QueryEnterpriseDealsResult {
  deals: EnterpriseDeal[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
