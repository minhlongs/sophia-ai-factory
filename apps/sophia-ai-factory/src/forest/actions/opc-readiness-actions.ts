/**
 * Server Actions for OPC Gate 1 Pre-Flight Readiness & Self-Serve Setup ($0.00 Spend).
 *
 * Authenticates the caller, resolves the active workspace (or personal owner
 * workspace fallback), and allows inspecting readiness, saving/verifying
 * workspace affiliate offers (`B3`), and toggling the workspace Kill Switch (`B4`)
 * at $0.00 without invoking Inngest or paid third-party APIs.
 *
 * Layer: forest (Server Actions)
 * @module forest/actions/opc-readiness-actions
 */

'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { resolveOrgId } from '@/seed/auth/resolve-org-id';
import { hasWorkspaceRole } from '@/seed/auth/workspace-access';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import {
  resetKillSwitchInMemoryCache,
  setAffiliateKillSwitch,
} from '@/tree/affiliate/kill-switch/kill-switch-store';
import { upsertWorkspaceVerifiedOffer } from '@/tree/affiliate/offers/workspace-offer-upsert';
import {
  evaluateOpcGate1Readiness,
  type OpcGate1ReadinessReport,
} from '@/tree/affiliate/readiness/opc-gate1-readiness';
import type { NicheVideoActionResponse } from './niche-video-action-helpers';

export type { OpcGate1ReadinessReport } from '@/tree/affiliate/readiness/opc-gate1-readiness';

export interface SaveNicheWorkspaceOfferInput {
  niche: 'saas_global' | 'crypto_global';
  productName: string;
  productUrl: string;
  commissionTerms: string;
  jurisdiction?: string;
  offerId?: string;
  networkId?: string;
}

export interface SaveNicheWorkspaceOfferOutput {
  offerId: string;
  niche: 'saas_global' | 'crypto_global';
  jurisdiction: string;
  report: OpcGate1ReadinessReport;
}

async function resolveAuthorizedWorkspace(): Promise<
  | { ok: true; db: D1Database; userId: string; workspaceId: string }
  | { ok: false; response: NicheVideoActionResponse<never> }
> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      ok: false,
      response: { success: false, error: 'Unauthorized: authentication required', code: 'UNAUTHORIZED' },
    };
  }
  const db = await getD1();
  if (!db) {
    return {
      ok: false,
      response: { success: false, error: 'Database binding unavailable for readiness check', code: 'DB_UNAVAILABLE' },
    };
  }
  let workspaceId = user.id;
  try {
    const orgId = await resolveOrgId(user.id, db);
    if (orgId) workspaceId = orgId;
  } catch {
    workspaceId = user.id;
  }
  const isAdmin = workspaceId === user.id || (await hasWorkspaceRole(workspaceId, user.id, 'ADMIN', db));
  if (!isAdmin) {
    return {
      ok: false,
      response: { success: false, error: 'Forbidden: Workspace Admin authorization required', code: 'FORBIDDEN' },
    };
  }
  return { ok: true, db, userId: user.id, workspaceId };
}

export async function getOpcGate1ReadinessAction(): Promise<
  NicheVideoActionResponse<OpcGate1ReadinessReport>
> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Unauthorized: authentication required', code: 'UNAUTHORIZED' };
    }
    const db = await getD1();
    if (!db) {
      return { success: false, error: 'Database binding unavailable for readiness check', code: 'DB_UNAVAILABLE' };
    }
    const orgId = await resolveOrgId(user.id, db);
    const workspaceId = orgId ?? user.id;
    const report = await evaluateOpcGate1Readiness({ db, workspaceId, userId: user.id });
    return { success: true, data: report };
  } catch (err: unknown) {
    const error = toError(err);
    logger.error('getOpcGate1ReadinessAction failed', { error: error.message });
    return { success: false, error: error.message, code: 'INTERNAL_ERROR' };
  }
}

export async function saveNicheWorkspaceOfferAction(
  input: SaveNicheWorkspaceOfferInput,
): Promise<NicheVideoActionResponse<SaveNicheWorkspaceOfferOutput>> {
  try {
    const auth = await resolveAuthorizedWorkspace();
    if (!auth.ok) return auth.response;
    const { db, userId, workspaceId } = auth;

    const rawJurisdiction = (input.jurisdiction ?? (input.niche === 'crypto_global' ? 'US' : 'GLOBAL'))
      .trim()
      .toUpperCase();
    const jurisdiction =
      input.niche === 'crypto_global' && rawJurisdiction === 'GLOBAL' ? 'US' : rawJurisdiction;

    const upserted = await upsertWorkspaceVerifiedOffer(db, {
      tenantId: workspaceId,
      offerId: input.offerId,
      networkId: input.networkId,
      programName: input.productName,
      productUrl: input.productUrl,
      commissionTerms: input.commissionTerms,
      niche: input.niche,
      jurisdiction,
    });
    if (!upserted.ok) {
      return {
        success: false,
        error: `Offer verification failed: ${upserted.error}`,
        code: upserted.error,
      };
    }

    const report = await evaluateOpcGate1Readiness({ db, workspaceId, userId });
    return {
      success: true,
      data: {
        offerId: upserted.value.offerId,
        niche: input.niche,
        jurisdiction,
        report,
      },
    };
  } catch (err: unknown) {
    const error = toError(err);
    logger.error('saveNicheWorkspaceOfferAction failed', { error: error.message });
    return { success: false, error: error.message, code: 'INTERNAL_ERROR' };
  }
}

export async function setOpcWorkspaceKillSwitchAction(input: {
  active: boolean;
}): Promise<NicheVideoActionResponse<OpcGate1ReadinessReport>> {
  try {
    const auth = await resolveAuthorizedWorkspace();
    if (!auth.ok) return auth.response;
    const { db, userId, workspaceId } = auth;

    await setAffiliateKillSwitch(Boolean(input.active), workspaceId, userId);
    resetKillSwitchInMemoryCache();
    const report = await evaluateOpcGate1Readiness({ db, workspaceId, userId });
    return { success: true, data: report };
  } catch (err: unknown) {
    const error = toError(err);
    logger.error('setOpcWorkspaceKillSwitchAction failed', { error: error.message });
    return { success: false, error: error.message, code: 'INTERNAL_ERROR' };
  }
}
