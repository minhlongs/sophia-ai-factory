/**
 * Enterprise Deals Repository & D1 Data Access Object
 *
 * Implements:
 * - Deals CRUD and pagination
 * - BANT scoring persistence and pipeline filtering
 * - Lead enrichment caching and retrieval
 * - Pipeline metrics aggregation
 *
 * Layer: tree/sales (Pure domain logic - only imports from @/seed)
 *
 * @module tree/sales/enterprise-deal-repo
 */

import type { D1Database } from '@/seed/db/client';
import type {
  EnterpriseDeal,
  EnterpriseDealRow,
  EnterpriseLeadEnrichment,
  EnterpriseLeadEnrichmentRow,
  CreateEnterpriseDealInput,
  UpdateEnterpriseDealInput,
  QueryEnterpriseDealsFilters,
  QueryEnterpriseDealsResult,
} from '@/seed/types/enterprise-deal';
import {
  mapDealRowToDeal,
  mapEnrichmentRowToEnrichment,
} from '@/seed/types/enterprise-deal';
import { calculateBantScore } from './bant-scoring-service';

function generateId(prefix = 'deal'): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

/**
 * Creates a new enterprise deal in D1.
 * Automatically computes BANT qualification and pipeline tier if bantInput is provided.
 */
export async function createEnterpriseDeal(
  db: D1Database,
  input: CreateEnterpriseDealInput & { id?: string }
): Promise<EnterpriseDeal> {
  const id = input.id || generateId('deal');
  const now = Date.now();

  const domain = input.companyDomain.toLowerCase().trim();
  const email = input.leadEmail.toLowerCase().trim();

  const dealValueCents = input.dealValueEstimateCents ?? 0;
  const requestedMcu = input.requestedMcuMonthly ?? 0;

  // Merge provided bantInput with top-level deal fields
  const bantInput = {
    leadEmail: input.bantInput?.leadEmail || email,
    jobTitle: input.bantInput?.jobTitle || input.leadTitle || undefined,
    statedBudgetArr: input.bantInput?.statedBudgetArr ?? (dealValueCents > 0 ? dealValueCents / 100 : undefined),
    statedMonthlyMcu: input.bantInput?.statedMonthlyMcu ?? (requestedMcu > 0 ? requestedMcu : undefined),
    statedBottleneckOrPainPoint: input.bantInput?.statedBottleneckOrPainPoint || input.notes || undefined,
    timeframe: input.bantInput?.timeframe,
    needsHighVolumeSyndication: input.bantInput?.needsHighVolumeSyndication,
    needsApacDubbing: input.bantInput?.needsApacDubbing,
    needsDedicatedGpuLane: input.bantInput?.needsDedicatedGpuLane,
    needsCustomApiOrWhiteLabel: input.bantInput?.needsCustomApiOrWhiteLabel,
    needTags: input.bantInput?.needTags,
    companyRevenueRange: input.bantInput?.companyRevenueRange,
    isCorporateEmail: input.bantInput?.isCorporateEmail,
  };

  const bantResult = calculateBantScore(bantInput);

  const query = `
    INSERT INTO enterprise_deals (
      id, lead_name, lead_email, lead_phone, lead_title,
      company_name, company_domain, lead_source, deal_stage,
      pipeline_tier, deal_value_estimate_cents, currency, requested_mcu_monthly,
      bant_score, bant_budget_score, bant_authority_score, bant_need_score, bant_timeline_score,
      bant_analysis_json, assigned_agent_id, assigned_agent_role, meeting_prep_brief,
      proposal_id, proposal_language, proposal_content,
      sandbox_subaccount_id, sandbox_status, sandbox_token, sandbox_expires_at,
      notes, metadata_json, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?
    )
  `;

  await db
    .prepare(query)
    .bind(
      id,
      input.leadName.trim(),
      email,
      input.leadPhone?.trim() || null,
      input.leadTitle?.trim() || null,
      input.companyName.trim(),
      domain,
      input.leadSource || 'website',
      input.dealStage || 'new_lead',
      bantResult.pipelineTier,
      input.dealValueEstimateCents || 0,
      input.currency || 'USD',
      input.requestedMcuMonthly || 0,
      bantResult.totalScore,
      bantResult.budgetScore,
      bantResult.authorityScore,
      bantResult.needScore,
      bantResult.timelineScore,
      JSON.stringify(bantResult.analysis),
      null, // assigned_agent_id
      'ai_sales_executive',
      null, // meeting_prep_brief
      null, // proposal_id
      'en', // proposal_language
      null, // proposal_content
      null, // sandbox_subaccount_id
      'none', // sandbox_status
      null, // sandbox_token
      null, // sandbox_expires_at
      input.notes?.trim() || null,
      JSON.stringify(input.metadata || {}),
      now,
      now
    )
    .run();

  const created = await getEnterpriseDealById(db, id);
  if (!created) {
    throw new Error(`Failed to retrieve newly created enterprise deal '${id}'`);
  }
  return created;
}

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

/**
 * Updates an enterprise deal.
 */
export async function updateEnterpriseDeal(
  db: D1Database,
  id: string,
  input: UpdateEnterpriseDealInput
): Promise<EnterpriseDeal> {
  const existing = await getEnterpriseDealById(db, id);
  if (!existing) {
    throw new Error(`Enterprise deal not found: ${id}`);
  }

  const updates: string[] = [];
  const bindings: unknown[] = [];
  const now = Date.now();

  if (input.leadName !== undefined) {
    updates.push('lead_name = ?');
    bindings.push(input.leadName.trim());
  }
  if (input.leadEmail !== undefined) {
    updates.push('lead_email = ?');
    bindings.push(input.leadEmail.toLowerCase().trim());
  }
  if (input.leadPhone !== undefined) {
    updates.push('lead_phone = ?');
    bindings.push(input.leadPhone);
  }
  if (input.leadTitle !== undefined) {
    updates.push('lead_title = ?');
    bindings.push(input.leadTitle);
  }
  if (input.companyName !== undefined) {
    updates.push('company_name = ?');
    bindings.push(input.companyName.trim());
  }
  if (input.companyDomain !== undefined) {
    updates.push('company_domain = ?');
    bindings.push(input.companyDomain.toLowerCase().trim());
  }
  if (input.leadSource !== undefined) {
    updates.push('lead_source = ?');
    bindings.push(input.leadSource);
  }
  if (input.dealStage !== undefined) {
    updates.push('deal_stage = ?');
    bindings.push(input.dealStage);
  }
  if (input.pipelineTier !== undefined) {
    updates.push('pipeline_tier = ?');
    bindings.push(input.pipelineTier);
  }
  if (input.dealValueEstimateCents !== undefined) {
    updates.push('deal_value_estimate_cents = ?');
    bindings.push(input.dealValueEstimateCents);
  }
  if (input.currency !== undefined) {
    updates.push('currency = ?');
    bindings.push(input.currency);
  }
  if (input.requestedMcuMonthly !== undefined) {
    updates.push('requested_mcu_monthly = ?');
    bindings.push(input.requestedMcuMonthly);
  }
  if (input.assignedAgentId !== undefined) {
    updates.push('assigned_agent_id = ?');
    bindings.push(input.assignedAgentId);
  }
  if (input.assignedAgentRole !== undefined) {
    updates.push('assigned_agent_role = ?');
    bindings.push(input.assignedAgentRole);
  }
  if (input.meetingPrepBrief !== undefined) {
    updates.push('meeting_prep_brief = ?');
    bindings.push(input.meetingPrepBrief);
  }
  if (input.proposalId !== undefined) {
    updates.push('proposal_id = ?');
    bindings.push(input.proposalId);
  }
  if (input.proposalLanguage !== undefined) {
    updates.push('proposal_language = ?');
    bindings.push(input.proposalLanguage);
  }
  if (input.proposalContent !== undefined) {
    updates.push('proposal_content = ?');
    bindings.push(input.proposalContent);
  }
  if (input.sandboxSubaccountId !== undefined) {
    updates.push('sandbox_subaccount_id = ?');
    bindings.push(input.sandboxSubaccountId);
  }
  if (input.sandboxStatus !== undefined) {
    updates.push('sandbox_status = ?');
    bindings.push(input.sandboxStatus);
  }
  if (input.sandboxToken !== undefined) {
    updates.push('sandbox_token = ?');
    bindings.push(input.sandboxToken);
  }
  if (input.sandboxExpiresAt !== undefined) {
    updates.push('sandbox_expires_at = ?');
    bindings.push(input.sandboxExpiresAt);
  }
  if (input.notes !== undefined) {
    updates.push('notes = ?');
    bindings.push(input.notes);
  }
  if (input.metadata !== undefined) {
    updates.push('metadata_json = ?');
    bindings.push(JSON.stringify(input.metadata));
  }

  updates.push('updated_at = ?');
  bindings.push(now);

  bindings.push(id);

  const sql = `UPDATE enterprise_deals SET ${updates.join(', ')} WHERE id = ?`;
  await db.prepare(sql).bind(...bindings).run();

  const updated = await getEnterpriseDealById(db, id);
  if (!updated) {
    throw new Error(`Failed to retrieve updated enterprise deal '${id}'`);
  }
  return updated;
}

/**
 * Deletes an enterprise deal by ID.
 */
export async function deleteEnterpriseDeal(
  db: D1Database,
  id: string
): Promise<boolean> {
  const result = await db
    .prepare('DELETE FROM enterprise_deals WHERE id = ?')
    .bind(id)
    .run();
  return (result.meta?.changes ?? 0) > 0;
}

// ── Lead Enrichment Operations ───────────────────────────────────────────────

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
  const id = existing?.id || enrichment.id || generateId('enr');

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
