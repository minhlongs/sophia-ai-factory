/**
 * Server Actions for OPC Gate 1 Pre-Flight Readiness & Self-Serve Setup ($0.00 Spend).
 * Layer: forest (Server Actions)
 * @module forest/actions/opc-readiness-actions
 */

'use server';

import { z } from 'zod';
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
import { evaluateJurisdictionCompliance } from '@/tree/video/compliance/jurisdiction-compliance-guard';
import type { NicheVideoActionResponse } from './niche-video-action-helpers';

export type { OpcGate1ReadinessReport } from '@/tree/affiliate/readiness/opc-gate1-readiness';

const SaveNicheWorkspaceOfferSchema = z.object({
  niche: z.enum(['saas_global', 'crypto_global']),
  productName: z.string().trim().min(1).max(200),
  productUrl: z.string().trim().url().max(2048),
  commissionTerms: z.string().trim().min(1).max(500),
  jurisdiction: z.string().trim().max(32).optional(),
  offerId: z.string().trim().max(120).optional(),
  networkId: z.string().trim().max(80).optional(),
});

const SetOpcWorkspaceKillSwitchSchema = z.object({ active: z.boolean() });

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

async function resolveCallerWorkspace(requireAdmin: boolean): Promise<
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
  let workspaceId: string;
  try {
    const orgId = await resolveOrgId(user.id, db);
    workspaceId = orgId ?? user.id;
    if (requireAdmin) {
      const isAdmin =
        workspaceId === user.id || (await hasWorkspaceRole(workspaceId, user.id, 'ADMIN', db));
      if (!isAdmin) {
        return {
          ok: false,
          response: { success: false, error: 'Forbidden: Workspace Admin authorization required', code: 'FORBIDDEN' },
        };
      }
    }
  } catch (err: unknown) {
    logger.error('Workspace resolution failed in opc-readiness-actions', { error: toError(err).message });
    return {
      ok: false,
      response: {
        success: false,
        error: 'Workspace resolution failed due to database error',
        code: 'WORKSPACE_RESOLUTION_FAILED',
      },
    };
  }
  return { ok: true, db, userId: user.id, workspaceId };
}

export async function getOpcGate1ReadinessAction(): Promise<
  NicheVideoActionResponse<OpcGate1ReadinessReport>
> {
  try {
    const auth = await resolveCallerWorkspace(false);
    if (!auth.ok) return auth.response;
    const report = await evaluateOpcGate1Readiness(auth);
    return { success: true, data: report };
  } catch (err: unknown) {
    const error = toError(err);
    logger.error('getOpcGate1ReadinessAction failed', { error: error.message });
    return {
      success: false,
      error: 'Workspace resolution failed due to database error',
      code: 'WORKSPACE_RESOLUTION_FAILED',
    };
  }
}

export async function saveNicheWorkspaceOfferAction(
  input: SaveNicheWorkspaceOfferInput,
): Promise<NicheVideoActionResponse<SaveNicheWorkspaceOfferOutput>> {
  try {
    const parsed = SaveNicheWorkspaceOfferSchema.safeParse(input);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join('; ');
      return { success: false, error: msg, code: 'VALIDATION_ERROR' };
    }
    const valid = parsed.data;
    const auth = await resolveCallerWorkspace(true);
    if (!auth.ok) return auth.response;
    const { db, userId, workspaceId } = auth;

    const trimmed = valid.jurisdiction?.trim().toUpperCase();
    const jurisdiction =
      trimmed && trimmed.length > 0 ? trimmed : valid.niche === 'crypto_global' ? 'US' : 'GLOBAL';

    const compliance = evaluateJurisdictionCompliance(valid.niche, jurisdiction);
    if (!compliance.isAllowed) {
      const reason = compliance.reason ?? 'JURISDICTION_UNASSESSED_OR_BLOCKED';
      return { success: false, error: `Offer verification failed: ${reason}`, code: reason };
    }

    const upserted = await upsertWorkspaceVerifiedOffer(db, {
      tenantId: workspaceId,
      offerId: valid.offerId,
      networkId: valid.networkId,
      programName: valid.productName,
      productUrl: valid.productUrl,
      commissionTerms: valid.commissionTerms,
      niche: valid.niche,
      jurisdiction,
    });
    if (!upserted.ok) {
      return { success: false, error: `Offer verification failed: ${upserted.error}`, code: upserted.error };
    }

    const report = await evaluateOpcGate1Readiness({ db, workspaceId, userId });
    return {
      success: true,
      data: { offerId: upserted.value.offerId, niche: valid.niche, jurisdiction, report },
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
    const parsed = SetOpcWorkspaceKillSwitchSchema.safeParse(input);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join('; ');
      return { success: false, error: msg, code: 'VALIDATION_ERROR' };
    }
    const auth = await resolveCallerWorkspace(true);
    if (!auth.ok) return auth.response;
    const { db, userId, workspaceId } = auth;

    await setAffiliateKillSwitch(parsed.data.active, workspaceId, userId);
    resetKillSwitchInMemoryCache();
    const report = await evaluateOpcGate1Readiness({ db, workspaceId, userId });
    return { success: true, data: report };
  } catch (err: unknown) {
    const error = toError(err);
    logger.error('setOpcWorkspaceKillSwitchAction failed', { error: error.message });
    return { success: false, error: error.message, code: 'INTERNAL_ERROR' };
  }
}
