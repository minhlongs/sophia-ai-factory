/**
 * Enterprise Deals Read and Query Access Operations
 *
 * Layer: tree/sales (Pure domain logic - only imports from @/seed)
 *
 * @module tree/sales/deals/deal-read
 */

import type { D1Database } from '@/seed/db/client';
import type {
  EnterpriseDeal,
  EnterpriseDealRow,
  QueryEnterpriseDealsFilters,
  QueryEnterpriseDealsResult,
} from '@/seed/types/enterprise-deal';
import { mapDealRowToDeal } from '@/seed/types/enterprise-deal';

/**
 * Retrieves an enterprise deal by ID.
 */
export async function getEnterpriseDealById(
  db: D1Database,
  id: string
): Promise<EnterpriseDeal | null> {
  const row = await db
    .prepare('SELECT * FROM enterprise_deals WHERE id = ?')
    .bind(id)
    .first<EnterpriseDealRow>();

  if (!row) return null;
  return mapDealRowToDeal(row);
}

/**
 * Retrieves the most recent enterprise deal by company domain.
 */
export async function getEnterpriseDealByDomain(
  db: D1Database,
  domain: string
): Promise<EnterpriseDeal | null> {
  const cleanDomain = domain.toLowerCase().trim();
  const row = await db
    .prepare('SELECT * FROM enterprise_deals WHERE company_domain = ? ORDER BY created_at DESC LIMIT 1')
    .bind(cleanDomain)
    .first<EnterpriseDealRow>();

  if (!row) return null;
  return mapDealRowToDeal(row);
}

/**
 * Queries enterprise deals with filtering, searching, and pagination.
 */
export async function queryEnterpriseDeals(
  db: D1Database,
  filters: QueryEnterpriseDealsFilters = {}
): Promise<QueryEnterpriseDealsResult> {
  const limit = Math.max(1, Math.min(filters.limit ?? 25, 100));
  const offset = Math.max(0, filters.offset ?? 0);
  const page = Math.floor(offset / limit) + 1;

  const whereConditions: string[] = [];
  const bindings: unknown[] = [];

  if (filters.stage) {
    whereConditions.push('deal_stage = ?');
    bindings.push(filters.stage);
  }

  if (filters.pipelineTier) {
    whereConditions.push('pipeline_tier = ?');
    bindings.push(filters.pipelineTier);
  }

  if (filters.search && filters.search.trim()) {
    const term = `%${filters.search.trim().toLowerCase()}%`;
    whereConditions.push(
      '(LOWER(company_name) LIKE ? OR LOWER(company_domain) LIKE ? OR LOWER(lead_name) LIKE ? OR LOWER(lead_email) LIKE ?)'
    );
    bindings.push(term, term, term, term);
  }

  const whereClause =
    whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

  // Order
  let orderColumn = 'created_at';
  if (filters.orderBy === 'bant_score') orderColumn = 'bant_score';
  if (filters.orderBy === 'deal_value_estimate_cents') orderColumn = 'deal_value_estimate_cents';
  const orderDirection = filters.orderDirection?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  const countQuery = `SELECT COUNT(*) as total FROM enterprise_deals ${whereClause}`;
  const totalRow = await db
    .prepare(countQuery)
    .bind(...bindings)
    .first<{ total: number }>();
  const total = totalRow?.total ?? 0;

  const dataQuery = `
    SELECT * FROM enterprise_deals
    ${whereClause}
    ORDER BY ${orderColumn} ${orderDirection}
    LIMIT ? OFFSET ?
  `;

  const rowsResult = await db
    .prepare(dataQuery)
    .bind(...bindings, limit, offset)
    .all<EnterpriseDealRow>();

  const rows = rowsResult.results || [];
  const deals = rows.map(mapDealRowToDeal);

  return {
    deals,
    total,
    page,
    pageSize: limit,
    hasMore: offset + deals.length < total,
  };
}
