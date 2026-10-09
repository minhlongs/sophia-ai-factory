/**
 * Lead Enrichment and Pipeline Metrics Aggregation
 *
 * Layer: tree/sales (Pure domain logic - only imports from @/seed)
 *
 * @module tree/sales/deals/deal-enrichment-metrics
 */

import type { D1Database } from '@/seed/db/client';
import type {
  EnterpriseLeadEnrichment,
  EnterpriseLeadEnrichmentRow,
} from '@/seed/types/enterprise-deal';
import { mapEnrichmentRowToEnrichment } from '@/seed/types/enterprise-deal';
import { generateDealId } from './deal-create';

/**
 * Upserts a lead enrichment record in D1.
 */
export async function upsertLeadEnrichment(
  db: D1Database,
  enrichment: Omit<EnterpriseLeadEnrichment, 'id' | 'createdAt' | 'updatedAt'> & {
    id?: string;
  }
): Promise<EnterpriseLeadEnrichment> {
  const cleanDomain = enrichment.domain.toLowerCase().trim();
  const existing = await getLeadEnrichmentByDomain(db, cleanDomain);
  const now = Date.now();
  const id = existing?.id || enrichment.id || generateDealId('enr');

  const query = `
    INSERT INTO enterprise_lead_enrichments (
      id, deal_id, domain, company_name, industry,
      employee_count_range, estimated_annual_revenue, headquarters_location, country,
      tech_stack_json, linkedin_company_url, twitter_handle,
      enrichment_source, confidence_score, raw_payload_json, status,
      created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?
    )
    ON CONFLICT(id) DO UPDATE SET
      deal_id = excluded.deal_id,
      company_name = excluded.company_name,
      industry = excluded.industry,
      employee_count_range = excluded.employee_count_range,
      estimated_annual_revenue = excluded.estimated_annual_revenue,
      headquarters_location = excluded.headquarters_location,
      country = excluded.country,
      tech_stack_json = excluded.tech_stack_json,
      linkedin_company_url = excluded.linkedin_company_url,
      twitter_handle = excluded.twitter_handle,
      enrichment_source = excluded.enrichment_source,
      confidence_score = excluded.confidence_score,
      raw_payload_json = excluded.raw_payload_json,
      status = excluded.status,
      updated_at = excluded.updated_at
  `;

  await db
    .prepare(query)
    .bind(
      id,
      enrichment.dealId || null,
      cleanDomain,
      enrichment.companyName || null,
      enrichment.industry || null,
      enrichment.employeeCountRange || null,
      enrichment.estimatedAnnualRevenue || null,
      enrichment.headquartersLocation || null,
      enrichment.country || null,
      JSON.stringify(enrichment.techStack || []),
      enrichment.linkedinCompanyUrl || null,
      enrichment.twitterHandle || null,
      enrichment.enrichmentSource || 'heuristic',
      enrichment.confidenceScore ?? 1.0,
      JSON.stringify(enrichment.rawPayload || {}),
      enrichment.status || 'completed',
      existing?.createdAt || now,
      now
    )
    .run();

  const retrieved = await getLeadEnrichmentByDomain(db, cleanDomain);
  if (!retrieved) {
    throw new Error(`Failed to retrieve upserted enrichment for domain '${cleanDomain}'`);
  }
  return retrieved;
}

/**
 * Retrieves lead enrichment by domain.
 */
export async function getLeadEnrichmentByDomain(
  db: D1Database,
  domain: string
): Promise<EnterpriseLeadEnrichment | null> {
  const cleanDomain = domain.toLowerCase().trim();
  const row = await db
    .prepare(
      'SELECT * FROM enterprise_lead_enrichments WHERE domain = ? ORDER BY updated_at DESC LIMIT 1'
    )
    .bind(cleanDomain)
    .first<EnterpriseLeadEnrichmentRow>();

  if (!row) return null;
  return mapEnrichmentRowToEnrichment(row);
}

/**
 * Retrieves lead enrichment by deal ID.
 */
export async function getLeadEnrichmentByDealId(
  db: D1Database,
  dealId: string
): Promise<EnterpriseLeadEnrichment | null> {
  const row = await db
    .prepare(
      'SELECT * FROM enterprise_lead_enrichments WHERE deal_id = ? ORDER BY updated_at DESC LIMIT 1'
    )
    .bind(dealId)
    .first<EnterpriseLeadEnrichmentRow>();

  if (!row) return null;
  return mapEnrichmentRowToEnrichment(row);
}

/**
 * Aggregates high-level enterprise pipeline metrics for dashboard display.
 */
export async function getDealsPipelineMetrics(db: D1Database): Promise<{
  totalDeals: number;
  hotDeals: number;
  warmDeals: number;
  coldDeals: number;
  totalEstimatedValueCents: number;
  avgBantScore: number;
  wonDeals: number;
}> {
  const stats = await db
    .prepare(`
      SELECT
        COUNT(*) as total_deals,
        SUM(CASE WHEN pipeline_tier = 'hot' THEN 1 ELSE 0 END) as hot_deals,
        SUM(CASE WHEN pipeline_tier = 'warm' THEN 1 ELSE 0 END) as warm_deals,
        SUM(CASE WHEN pipeline_tier = 'cold' THEN 1 ELSE 0 END) as cold_deals,
        SUM(deal_value_estimate_cents) as total_val_cents,
        AVG(bant_score) as avg_bant,
        SUM(CASE WHEN deal_stage = 'closed_won' THEN 1 ELSE 0 END) as won_deals
      FROM enterprise_deals
    `)
    .first<{
      total_deals: number;
      hot_deals: number;
      warm_deals: number;
      cold_deals: number;
      total_val_cents: number | null;
      avg_bant: number | null;
      won_deals: number;
    }>();

  return {
    totalDeals: Number(stats?.total_deals || 0),
    hotDeals: Number(stats?.hot_deals || 0),
    warmDeals: Number(stats?.warm_deals || 0),
    coldDeals: Number(stats?.cold_deals || 0),
    totalEstimatedValueCents: Number(stats?.total_val_cents || 0),
    avgBantScore: Math.round(Number(stats?.avg_bant || 0)),
    wonDeals: Number(stats?.won_deals || 0),
  };
}
