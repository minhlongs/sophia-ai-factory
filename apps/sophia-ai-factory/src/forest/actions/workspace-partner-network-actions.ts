/**
 * Server Actions for Workspace Partner Network Management (Cloud-Gated)
 * Layer: forest (Server Actions)
 * @module forest/actions/workspace-partner-network-actions
 */

'use server';

import { getD1 } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { enforceCommercialFeatureForUser } from '@/seed/config/enforce-commercial-feature-server';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import {
  createDualRailPayoutBatch,
  generateVietQrCsv,
  type DualRailPayoutBatch,
} from '@/land/payouts/dual-rail';
import {
  recruitWorkspacePartnerSchema,
  reviewWorkspacePartnerStatusSchema,
  createWorkspaceDualRailBatchSchema,
  type RecruitWorkspacePartnerInput,
  type ReviewWorkspacePartnerStatusInput,
  type CreateWorkspaceDualRailBatchInput,
  type WorkspacePartnerSummary,
} from './workspace-partner-network-schema';
import { queryWorkspacePartners, insertWorkspacePartner } from './workspace-partner-network-db-helpers';

async function authorizeWorkspacePartnerGate(): Promise<
  | { ok: true; userId: string; db: D1Database }
  | { ok: false; error: string }
> {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return { ok: false, error: 'Unauthorized' };
  const gate = await enforceCommercialFeatureForUser(user.id, 'affiliate_attribution_payouts');
  if (!gate.ok) return { ok: false, error: gate.error.message };
  const db = await getD1();
  if (!db) return { ok: false, error: 'Database binding unavailable' };
  return { ok: true, userId: user.id, db };
}

export async function listWorkspacePartnersAction(): Promise<{
  success: boolean;
  partners?: WorkspacePartnerSummary[];
  error?: string;
}> {
  try {
    const auth = await authorizeWorkspacePartnerGate();
    if (!auth.ok) return { success: false, error: auth.error };
    const partners = await queryWorkspacePartners(auth.db, auth.userId);
    return { success: true, partners };
  } catch (err) {
    const error = toError(err);
    logger.error('[workspace-partner-network] Failed to list partners', { error: error.message });
    return { success: false, error: error.message };
  }
}

export async function recruitWorkspacePartnerAction(
  rawInput: RecruitWorkspacePartnerInput,
): Promise<{ success: boolean; partnerId?: string; error?: string }> {
  try {
    const parsed = recruitWorkspacePartnerSchema.safeParse(rawInput);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues?.[0]?.message || 'Invalid partner input' };
    }
    const auth = await authorizeWorkspacePartnerGate();
    if (!auth.ok) return { success: false, error: auth.error };
    const { partnerId, normalizedCode } = await insertWorkspacePartner(auth.db, auth.userId, parsed.data);
    logger.info('[workspace-partner-network] Recruited partner', {
      tenantId: auth.userId,
      partnerId,
      partnerCode: normalizedCode,
      rail: parsed.data.payoutRail,
    });
    return { success: true, partnerId };
  } catch (err) {
    const error = toError(err);
    logger.error('[workspace-partner-network] Failed to recruit partner', { error: error.message });
    return { success: false, error: error.message };
  }
}

export async function reviewWorkspacePartnerStatusAction(
  rawInput: ReviewWorkspacePartnerStatusInput,
): Promise<{ success: boolean; newStatus?: 'active' | 'suspended'; error?: string }> {
  try {
    const parsed = reviewWorkspacePartnerStatusSchema.safeParse(rawInput);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues?.[0]?.message || 'Invalid review input' };
    }
    const auth = await authorizeWorkspacePartnerGate();
    if (!auth.ok) return { success: false, error: auth.error };
    const newStatus = parsed.data.decision === 'approve' ? 'active' : 'suspended';
    const isSuspicious = parsed.data.decision === 'approve' ? 0 : 1;
    const res = await auth.db
      .prepare('UPDATE affiliate_partners SET status = ?1, is_suspicious = ?2, updated_at = ?3 WHERE id = ?4 AND tenant_id = ?5')
      .bind(newStatus, isSuspicious, Date.now(), parsed.data.partnerId, auth.userId)
      .run();
    if ((res.meta?.changes ?? 0) === 0) return { success: false, error: 'Partner not found in this workspace' };
    return { success: true, newStatus };
  } catch (err) {
    const error = toError(err);
    logger.error('[workspace-partner-network] Failed to review partner status', { error: error.message });
    return { success: false, error: error.message };
  }
}

export async function createWorkspaceDualRailBatchAction(
  rawInput?: CreateWorkspaceDualRailBatchInput,
): Promise<{ success: boolean; batch?: DualRailPayoutBatch; vietQrCsv?: string; error?: string }> {
  try {
    const parsed = createWorkspaceDualRailBatchSchema.safeParse(rawInput ?? {});
    if (!parsed.success) return { success: false, error: parsed.error.issues?.[0]?.message || 'Invalid batch input' };
    const auth = await authorizeWorkspacePartnerGate();
    if (!auth.ok) return { success: false, error: auth.error };
    const batch = await createDualRailPayoutBatch(auth.db, {
      tenantId: auth.userId,
      rail: parsed.data.rail,
      minPayoutCents: parsed.data.minPayoutCents,
    });
    const vietQrCsv = generateVietQrCsv(batch.items, { batchId: batch.batchId });
    return { success: true, batch, vietQrCsv };
  } catch (err) {
    const error = toError(err);
    logger.error('[workspace-partner-network] Failed to create dual-rail batch', { error: error.message });
    return { success: false, error: error.message };
  }
}
