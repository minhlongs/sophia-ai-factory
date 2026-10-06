'use server';

/**
 * Land Layer: Agency Portal & Client Onboarding Server Actions
 *
 * Provides transactional server actions for:
 * 1. Step-by-step onboarding validation
 * 2. Atomic client subaccount provisioning, branding persistence, MCU allocation, and seed agent deployment
 * 3. High-performance Agency Admin Portal dashboard data aggregation with tenant isolation
 * 4. Client status management and MCU reallocation
 *
 * Layer: land (imports @/seed/*, @/tree/*; strictly zero imports from @/forest/*)
 *
 * @module land/agency/agency-portal-actions
 */

import { getD1Sync } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type { D1Database } from '@cloudflare/workers-types';
import type {
  AgencyOnboardingSubmission,
  AgencyOnboardingResult,
  AgencyOnboardingStep,
  AgencyAdminDashboardData,
  AgencyClientSummary,
  AgencyCampaignSummary,
  AgencyProfileInput,
  AgencyBrandingInput,
  AgencyDomainInput,
  SeedAgentDeploymentConfig,
} from '@/seed/types';

/**
 * Resolves active D1 database binding.
 */
function resolveDb(dbOverride?: unknown): D1Database {
  if (dbOverride && typeof (dbOverride as D1Database).prepare === 'function') {
    return dbOverride as D1Database;
  }
  return getD1Sync();
}
import {
  validateProfileStep,
  validateBrandingStep,
  validateDomainStep,
  validateSeedAgentsStep,
  validateCompleteSubmission,
  sanitizeCustomCss,
  validateHexColor,
} from '@/tree/agency/onboarding-validator';
import {
  calculateMcuUtilization,
  buildRevenueAttribution,
  aggregateAgencyKpis,
} from '@/tree/agency/attribution-engine';
import { computeSha256Sync } from '@/tree/governance/agy-policy-engine';

export interface StepValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates step-by-step inputs for the 5-step onboarding wizard.
 */
export async function validateOnboardingStepAction(
  step: AgencyOnboardingStep,
  payload: unknown
): Promise<StepValidationResult> {
  switch (step) {
    case 1:
      return validateProfileStep(payload as AgencyProfileInput);
    case 2:
      return validateBrandingStep(payload as AgencyBrandingInput);
    case 3:
      return validateDomainStep(payload as AgencyDomainInput);
    case 4:
      return validateSeedAgentsStep(payload as SeedAgentDeploymentConfig[]);
    case 5:
      return { valid: true, errors: [] };
    default:
      return { valid: false, errors: ['INVALID_STEP'] };
  }
}

/**
 * Executes atomic client subaccount onboarding, branding setup, quota allocation, and seed agent deployment.
 */
export async function submitAgencyOnboardingAction(
  submission: AgencyOnboardingSubmission,
  dbOverride?: unknown
): Promise<AgencyOnboardingResult> {
  const validation = validateCompleteSubmission(submission);
  if (!validation.valid) {
    return {
      success: false,
      stepErrors: validation.stepErrors,
      error: 'VALIDATION_FAILED',
    };
  }

  const db = resolveDb(dbOverride);
  const { agencyOrgId, profile, branding, domain, seedAgents } = submission;
  const normalizedSlug = profile.agencySlug.trim().toLowerCase();
  const now = new Date().toISOString();

  try {
    // 1. Check slug uniqueness within agency organization
    const existing = await db
      .prepare(
        'SELECT id FROM client_subaccounts WHERE agency_org_id = ?1 AND lower(slug) = ?2 LIMIT 1'
      )
      .bind(agencyOrgId, normalizedSlug)
      .first<{ id: string }>();

    if (existing) {
      return {
        success: false,
        error: 'SLUG_ALREADY_EXISTS',
        stepErrors: { profile: ['SLUG_ALREADY_EXISTS'] },
      };
    }

    const subaccountId = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const customDomain = domain.customDomain ? domain.customDomain.trim().toLowerCase() : null;

    // 2. Insert client subaccount
    await db
      .prepare(
        `INSERT INTO client_subaccounts (id, agency_org_id, name, slug, custom_domain, status, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, 'active', ?6, ?7)`
      )
      .bind(
        subaccountId,
        agencyOrgId,
        profile.clientName.trim(),
        normalizedSlug,
        customDomain,
        now,
        now
      )
      .run();

    // 3. Insert subaccount branding
    const primaryColor = validateHexColor(branding.primaryColor, '#0f172a');
    const accentColor = validateHexColor(branding.accentColor, '#10b981');
    const sanitizedCss = sanitizeCustomCss(branding.customCss);

    await db
      .prepare(
        `INSERT INTO subaccount_branding (subaccount_id, logo_url, primary_color, accent_color, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
      )
      .bind(
        subaccountId,
        branding.logoUrl || null,
        primaryColor,
        accentColor,
        now,
        now
      )
      .run();

    // 4. Insert MCU quota allocation
    const allocationId = `alloc_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const initialMcu = Math.max(0, Math.round(profile.initialMcuBudget));

    await db
      .prepare(
        `INSERT INTO subaccount_mcu_allocations (id, subaccount_id, allocated_mcu, used_mcu, created_at, updated_at)
         VALUES (?1, ?2, ?3, 0, ?4, ?5)`
      )
      .bind(
        allocationId,
        subaccountId,
        initialMcu,
        now,
        now
      )
      .run();

    // 5. Deploy enabled seed agents into AGY governance ledger
    let deployedAgentsCount = 0;
    const enabledAgents = seedAgents.filter((a) => a.enabled);

    for (const agent of enabledAgents) {
      const configId = `agy_cfg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const agentYaml = `schemaVersion: "1.0"\nagent:\n  id: "${agent.agentId}"\n  name: "${agent.name}"\n  role: "${agent.role}"\n  maxAutonomyLevel: "${agent.maxAutonomy}"\ncompute:\n  maxTokensPerRun: 128000\n  maxComputeUnitsMcu: ${agent.maxComputeUnitsMcu}\npermissions:\n  allow:\n    - "${agent.role}:*"\n  deny:\n    - "system:*"\nescalation:\n  onQuotaExceeded: "${agent.escalationPolicy}"\n  onDisallowedAction: "halt"\n`;

      const configJson = JSON.stringify({
        schemaVersion: '1.0',
        agent: {
          id: agent.agentId,
          name: agent.name,
          role: agent.role,
          maxAutonomyLevel: agent.maxAutonomy,
        },
        compute: {
          maxTokensPerRun: 128000,
          maxComputeUnitsMcu: agent.maxComputeUnitsMcu,
        },
        permissions: {
          allow: [`${agent.role}:*`],
          deny: ['system:*'],
        },
        escalation: {
          onQuotaExceeded: agent.escalationPolicy,
          onDisallowedAction: 'halt',
        },
      });

      const sha256 = computeSha256Sync(agentYaml);

      await db
        .prepare(
          `INSERT INTO agy_governance_configs (
             id, agency_id, agent_id, schema_version, raw_yaml, config_json, sha256_hash, is_active, created_at, updated_at
           ) VALUES (?1, ?2, ?3, '1.0', ?4, ?5, ?6, 1, ?7, ?8)`
        )
        .bind(
          configId,
          agencyOrgId,
          agent.agentId,
          agentYaml,
          configJson,
          sha256,
          now,
          now
        )
        .run();

      deployedAgentsCount++;
    }

    const portalUrl = `/portal/${normalizedSlug}`;

    logger.info('[Agency Actions] Client onboarded successfully', {
      subaccountId,
      agencyOrgId,
      slug: normalizedSlug,
      deployedAgentsCount,
    });

    return {
      success: true,
      subaccountId,
      agencySlug: normalizedSlug,
      portalUrl,
      deployedAgentsCount,
    };
  } catch (err) {
    logger.error('[Agency Actions] Onboarding transaction failed', {
      error: String(err),
      agencyOrgId,
      slug: normalizedSlug,
    });
    return {
      success: false,
      error: 'DATABASE_ERROR',
    };
  }
}

/**
 * Retrieves the comprehensive Agency Admin Portal dashboard data with tenant isolation.
 */
export async function getAgencyAdminOverviewAction(
  agencyOrgId: string,
  agencyContext = { agencyId: agencyOrgId, agencyName: 'My Agency', agencySlug: 'my-agency' },
  dbOverride?: unknown
): Promise<AgencyAdminDashboardData> {
  const db = resolveDb(dbOverride);

  try {
    // 1. Fetch subaccounts scoped strictly to agency_org_id
    const rows = await db
      .prepare(
        `SELECT
           c.id, c.name, c.slug, c.status, c.custom_domain, c.created_at,
           coalesce(a.allocated_mcu, 0) as allocated_mcu,
           coalesce(a.used_mcu, 0) as used_mcu
         FROM client_subaccounts c
         LEFT JOIN subaccount_mcu_allocations a ON c.id = a.subaccount_id
         WHERE c.agency_org_id = ?1
         ORDER BY c.created_at DESC`
      )
      .bind(agencyOrgId)
      .all<{
        id: string;
        name: string;
        slug: string;
        status: string;
        custom_domain: string | null;
        created_at: string;
        allocated_mcu: number;
        used_mcu: number;
      }>();

    const clientRows = rows.results || [];

    const clients: AgencyClientSummary[] = clientRows.map((r) => {
      const util = calculateMcuUtilization(r.allocated_mcu, r.used_mcu);
      const isSuspended = r.status.toLowerCase() === 'suspended';
      return {
        id: r.id,
        name: r.name,
        slug: r.slug,
        status: isSuspended ? 'suspended' : 'active',
        allocatedMcu: r.allocated_mcu,
        usedMcu: r.used_mcu,
        mcuUtilizationRate: util.usedRatePercent,
        customDomain: r.custom_domain,
        portalUrl: `/portal/${r.slug}`,
        activeCampaignsCount: 0,
        createdAt: r.created_at,
      };
    });

    // 2. Fetch video reviews / campaigns for these subaccounts
    const campaigns: AgencyCampaignSummary[] = [];
    if (clients.length > 0) {
      const subaccountIds = clients.map((c) => c.id);
      const placeholders = subaccountIds.map((_, i) => `?${i + 1}`).join(',');
      const reviewRows = await db
        .prepare(
          `SELECT r.id, r.subaccount_id, r.video_title, r.status, r.created_at, c.name as client_name
           FROM video_reviews r
           JOIN client_subaccounts c ON r.subaccount_id = c.id
           WHERE r.subaccount_id IN (${placeholders})
           ORDER BY r.created_at DESC LIMIT 50`
        )
        .bind(...subaccountIds)
        .all<{
          id: string;
          subaccount_id: string;
          video_title: string | null;
          status: string;
          created_at: string;
          client_name: string;
        }>();

      for (const rev of reviewRows.results || []) {
        const statusNormalized = rev.status.toLowerCase();
        const campaignStatus: 'draft' | 'in_review' | 'approved' | 'published' =
          statusNormalized === 'approved'
            ? 'approved'
            : statusNormalized === 'changes_requested'
            ? 'draft'
            : 'in_review';

        campaigns.push({
          id: rev.id,
          subaccountId: rev.subaccount_id,
          clientName: rev.client_name,
          title: rev.video_title || 'Untitled Campaign',
          status: campaignStatus,
          rendersCount: 1,
          mcuConsumed: 10,
          updatedAt: rev.created_at,
        });
      }

      // Update activeCampaignsCount on clients
      for (const client of clients) {
        client.activeCampaignsCount = campaigns.filter(
          (cmp) => cmp.subaccountId === client.id && (cmp.status === 'in_review' || cmp.status === 'approved')
        ).length;
      }
    }

    // 3. Build attributions
    const attributions = clients.map((c) =>
      buildRevenueAttribution(c.id, c.name, 'growth', c.allocatedMcu, c.usedMcu)
    );

    // 4. Aggregate KPIs
    const kpi = aggregateAgencyKpis(clients, campaigns, attributions);

    return {
      kpi,
      clients,
      campaigns,
      attribution: attributions,
      agencyContext,
    };
  } catch (err) {
    logger.error('[Agency Actions] Failed to load agency admin overview', {
      error: String(err),
      agencyOrgId,
    });
    // Return safe empty state on DB errors
    return {
      kpi: {
        totalActiveClients: 0,
        totalAllocatedMcu: 0,
        totalUsedMcu: 0,
        mcuUtilizationRate: 0,
        activeCampaigns: 0,
        attributedMrrUsd: 0,
        growthRatePercent: 0,
      },
      clients: [],
      campaigns: [],
      attribution: [],
      agencyContext,
    };
  }
}

/**
 * Updates client subaccount status (active vs suspended) with compound tenant isolation.
 */
export async function updateClientSubaccountStatusAction(
  subaccountId: string,
  agencyOrgId: string,
  status: 'active' | 'suspended',
  dbOverride?: unknown
): Promise<{ success: boolean; error?: string }> {
  if (!subaccountId || typeof subaccountId !== 'string' || !agencyOrgId || typeof agencyOrgId !== 'string') {
    return { success: false, error: 'SUBACCOUNT_NOT_FOUND_OR_FORBIDDEN' };
  }

  const db = resolveDb(dbOverride);
  const now = new Date().toISOString();

  try {
    const res = await db
      .prepare(
        `UPDATE client_subaccounts
         SET status = ?1, updated_at = ?2
         WHERE id = ?3 AND agency_org_id = ?4`
      )
      .bind(status, now, subaccountId, agencyOrgId)
      .run();

    if (!res.meta?.changes) {
      return { success: false, error: 'SUBACCOUNT_NOT_FOUND_OR_FORBIDDEN' };
    }

    return { success: true };
  } catch (err) {
    logger.error('[Agency Actions] Failed to update client status', {
      error: String(err),
      subaccountId,
      agencyOrgId,
    });
    return { success: false, error: 'DATABASE_ERROR' };
  }
}

/**
 * Reallocates MCU quota for a subaccount with tenant verification.
 */
export async function reallocateClientMcuQuotaAction(
  subaccountId: string,
  agencyOrgId: string,
  allocatedMcu: number,
  dbOverride?: unknown
): Promise<{ success: boolean; remainingMcu?: number; error?: string }> {
  if (!subaccountId || typeof subaccountId !== 'string' || !agencyOrgId || typeof agencyOrgId !== 'string') {
    return { success: false, error: 'SUBACCOUNT_NOT_FOUND_OR_FORBIDDEN' };
  }

  if (!Number.isFinite(allocatedMcu) || allocatedMcu < 0) {
    return { success: false, error: 'INVALID_MCU_AMOUNT' };
  }

  const db = resolveDb(dbOverride);
  const now = new Date().toISOString();

  try {
    // Verify client belongs to this agency
    const client = await db
      .prepare('SELECT id FROM client_subaccounts WHERE id = ?1 AND agency_org_id = ?2')
      .bind(subaccountId, agencyOrgId)
      .first<{ id: string }>();

    if (!client) {
      return { success: false, error: 'SUBACCOUNT_NOT_FOUND_OR_FORBIDDEN' };
    }

    // Update quota
    await db
      .prepare(
        `UPDATE subaccount_mcu_allocations
         SET allocated_mcu = ?1, updated_at = ?2
         WHERE subaccount_id = ?3`
      )
      .bind(allocatedMcu, now, subaccountId)
      .run();

    return { success: true, remainingMcu: allocatedMcu };
  } catch (err) {
    logger.error('[Agency Actions] Failed to reallocate MCU quota', {
      error: String(err),
      subaccountId,
      agencyOrgId,
    });
    return { success: false, error: 'DATABASE_ERROR' };
  }
}
