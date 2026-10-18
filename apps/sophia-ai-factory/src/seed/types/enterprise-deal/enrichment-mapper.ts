/**
 * Enterprise Lead Enrichment Row Mapper
 *
 * Layer: seed/types (Foundational - zero upper-layer imports)
 *
 * @module seed/types/enterprise-deal/enrichment-mapper
 */

import type { EnrichmentSource, EnrichmentStatus } from './deal-constants';
import type {
  EnterpriseLeadEnrichment,
  EnterpriseLeadEnrichmentRow,
} from './deal-entities';

export function mapEnrichmentRowToEnrichment(
  row: EnterpriseLeadEnrichmentRow
): EnterpriseLeadEnrichment {
  let techStack: string[] = [];
  try {
    techStack = JSON.parse(row.tech_stack_json || '[]');
  } catch {
    techStack = [];
  }

  let rawPayload: Record<string, unknown> = {};
  try {
    rawPayload = JSON.parse(row.raw_payload_json || '{}');
  } catch {
    rawPayload = {};
  }

  return {
    id: row.id,
    dealId: row.deal_id,
    domain: row.domain,
    companyName: row.company_name,
    industry: row.industry,
    employeeCountRange: row.employee_count_range,
    estimatedAnnualRevenue: row.estimated_annual_revenue,
    headquartersLocation: row.headquarters_location,
    country: row.country,
    techStack,
    linkedinCompanyUrl: row.linkedin_company_url,
    twitterHandle: row.twitter_handle,
    enrichmentSource: (row.enrichment_source as EnrichmentSource) || 'heuristic',
    confidenceScore: Number(row.confidence_score ?? 1.0),
    rawPayload,
    status: (row.status as EnrichmentStatus) || 'completed',
    createdAt: Number(row.created_at || 0),
    updatedAt: Number(row.updated_at || 0),
  };
}
