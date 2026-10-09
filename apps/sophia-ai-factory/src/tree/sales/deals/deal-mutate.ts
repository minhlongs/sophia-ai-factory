/**
 * Enterprise Deals Update and Deletion Operations
 *
 * Layer: tree/sales (Pure domain logic - only imports from @/seed)
 *
 * @module tree/sales/deals/deal-mutate
 */

import type { D1Database } from '@/seed/db/client';
import type {
  EnterpriseDeal,
  UpdateEnterpriseDealInput,
} from '@/seed/types/enterprise-deal';
import { getEnterpriseDealById } from './deal-read';

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
