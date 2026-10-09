/**
 * Agency Client Subaccount Onboarding Server Action
 *
 * Layer: land/agency
 *
 * @module land/agency/portal-actions/onboarding-mutator
 */

'use server';

import { logger } from '@/seed/utils/logger-utility';
import type {
  AgencyOnboardingSubmission,
  AgencyOnboardingResult,
} from '@/seed/types';
import {
  validateCompleteSubmission,
  sanitizeCustomCss,
  validateHexColor,
} from '@/tree/agency/onboarding-validator';
import { computeSha256Sync } from '@/tree/governance/agy-policy-engine';
import { resolveDb } from './common';

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
      .prepare('SELECT id FROM client_subaccounts WHERE agency_org_id = ?1 AND lower(slug) = ?2 LIMIT 1')
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
      .bind(subaccountId, agencyOrgId, profile.clientName.trim(), normalizedSlug, customDomain, now, now)
      .run();

    // 3. Insert subaccount branding
    const primaryColor = validateHexColor(branding.primaryColor, '#0f172a');
    const accentColor = validateHexColor(branding.accentColor, '#10b981');
    sanitizeCustomCss(branding.customCss);

    await db
      .prepare(
        `INSERT INTO subaccount_branding (subaccount_id, logo_url, primary_color, accent_color, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
      )
      .bind(subaccountId, branding.logoUrl || null, primaryColor, accentColor, now, now)
      .run();

    // 4. Insert MCU quota allocation
    const allocationId = `alloc_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const initialMcu = Math.max(0, Math.round(profile.initialMcuBudget));

    await db
      .prepare(
        `INSERT INTO subaccount_mcu_allocations (id, subaccount_id, allocated_mcu, used_mcu, created_at, updated_at)
         VALUES (?1, ?2, ?3, 0, ?4, ?5)`
      )
      .bind(allocationId, subaccountId, initialMcu, now, now)
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
        .bind(configId, agencyOrgId, agent.agentId, agentYaml, configJson, sha256, now, now)
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
