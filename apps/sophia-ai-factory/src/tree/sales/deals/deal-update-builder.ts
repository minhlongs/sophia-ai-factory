/**
 * Enterprise Deal Dynamic SQL Update Statement Builder
 *
 * Layer: tree/sales (Pure domain logic - only imports from @/seed)
 *
 * @module tree/sales/deals/deal-update-builder
 */

import type { UpdateEnterpriseDealInput } from '@/seed/types/enterprise-deal';

interface FieldSpec<K extends keyof UpdateEnterpriseDealInput> {
  key: K;
  column: string;
  transform?: (val: NonNullable<UpdateEnterpriseDealInput[K]>) => unknown;
}

const DEAL_UPDATE_FIELDS: ReadonlyArray<FieldSpec<keyof UpdateEnterpriseDealInput>> = [
  { key: 'leadName', column: 'lead_name', transform: (v) => String(v).trim() },
  { key: 'leadEmail', column: 'lead_email', transform: (v) => String(v).toLowerCase().trim() },
  { key: 'leadPhone', column: 'lead_phone' },
  { key: 'leadTitle', column: 'lead_title' },
  { key: 'companyName', column: 'company_name', transform: (v) => String(v).trim() },
  { key: 'companyDomain', column: 'company_domain', transform: (v) => String(v).toLowerCase().trim() },
  { key: 'leadSource', column: 'lead_source' },
  { key: 'dealStage', column: 'deal_stage' },
  { key: 'pipelineTier', column: 'pipeline_tier' },
  { key: 'dealValueEstimateCents', column: 'deal_value_estimate_cents' },
  { key: 'currency', column: 'currency' },
  { key: 'requestedMcuMonthly', column: 'requested_mcu_monthly' },
  { key: 'assignedAgentId', column: 'assigned_agent_id' },
  { key: 'assignedAgentRole', column: 'assigned_agent_role' },
  { key: 'meetingPrepBrief', column: 'meeting_prep_brief' },
  { key: 'proposalId', column: 'proposal_id' },
  { key: 'proposalLanguage', column: 'proposal_language' },
  { key: 'proposalContent', column: 'proposal_content' },
  { key: 'sandboxSubaccountId', column: 'sandbox_subaccount_id' },
  { key: 'sandboxStatus', column: 'sandbox_status' },
  { key: 'sandboxToken', column: 'sandbox_token' },
  { key: 'sandboxExpiresAt', column: 'sandbox_expires_at' },
  { key: 'notes', column: 'notes' },
  { key: 'metadata', column: 'metadata_json', transform: (v) => JSON.stringify(v) },
];

export function buildDealUpdateSql(
  id: string,
  input: UpdateEnterpriseDealInput,
  now = Date.now(),
): { sql: string; bindings: unknown[] } {
  const updates: string[] = [];
  const bindings: unknown[] = [];

  for (const spec of DEAL_UPDATE_FIELDS) {
    const rawVal = input[spec.key];
    if (rawVal !== undefined) {
      updates.push(`${spec.column} = ?`);
      bindings.push(
        spec.transform && rawVal !== null
          ? spec.transform(rawVal as NonNullable<typeof rawVal>)
          : rawVal,
      );
    }
  }

  updates.push('updated_at = ?');
  bindings.push(now);
  bindings.push(id);

  return {
    sql: `UPDATE enterprise_deals SET ${updates.join(', ')} WHERE id = ?`,
    bindings,
  };
}
