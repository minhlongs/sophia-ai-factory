/**
 * Internal database and governance helpers for Agency Client Subaccount Onboarding
 *
 * Layer: land/agency
 *
 * @module land/agency/portal-actions/onboarding-mutator-helpers
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { AgencyOnboardingSubmission } from '@/seed/types';
import {
  sanitizeCustomCss,
  validateHexColor,
} from '@/tree/agency/onboarding-validator';
import { computeSha256Sync } from '@/tree/governance/agy-policy-engine';

export type SeedAgentEntry = AgencyOnboardingSubmission['seedAgents'][number];

/**
 * Generates deterministic AGY governance YAML and JSON payloads for a seed agent.
 */
export function buildAgentGovernancePayload(agent: SeedAgentEntry): {
  agentYaml: string;
  configJson: string;
  sha256: string;
} {
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
  return { agentYaml, configJson, sha256 };
}

/**
 * Inserts subaccount record, branding configuration, and initial MCU quota allocation.
 */
export async function insertSubaccountCoreRecords(
  db: D1Database,
  submission: AgencyOnboardingSubmission,
  subaccountId: string,
  normalizedSlug: string,
  now: string
): Promise<void> {
  const { agencyOrgId, profile, branding, domain } = submission;
  const customDomain = domain.customDomain ? domain.customDomain.trim().toLowerCase() : null;

  await db
    .prepare(
      `INSERT INTO client_subaccounts (id, agency_org_id, name, slug, custom_domain, status, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, 'active', ?6, ?7)`
    )
    .bind(subaccountId, agencyOrgId, profile.clientName.trim(), normalizedSlug, customDomain, now, now)
    .run();

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

  const allocationId = `alloc_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const initialMcu = Math.max(0, Math.round(profile.initialMcuBudget));

  await db
    .prepare(
      `INSERT INTO subaccount_mcu_allocations (id, subaccount_id, allocated_mcu, used_mcu, created_at, updated_at)
       VALUES (?1, ?2, ?3, 0, ?4, ?5)`
    )
    .bind(allocationId, subaccountId, initialMcu, now, now)
    .run();
}

/**
 * Deploys enabled seed agents into AGY governance ledger.
 */
export async function deploySeedAgentsLedger(
  db: D1Database,
  agencyOrgId: string,
  seedAgents: SeedAgentEntry[],
  now: string
): Promise<number> {
  let deployedAgentsCount = 0;
  const enabledAgents = seedAgents.filter((a) => a.enabled);

  for (const agent of enabledAgents) {
    const configId = `agy_cfg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const { agentYaml, configJson, sha256 } = buildAgentGovernancePayload(agent);

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

  return deployedAgentsCount;
}
