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
import { getDealsPipelineMetrics } from './deals-pipeline-metrics';

export { getDealsPipelineMetrics };

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
