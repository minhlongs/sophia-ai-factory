/**
 * Step 4 Budget Reservation & Step 5 Voiceover / Manifest Helpers
 * for the Niche Video Campaign Dispatcher.
 *
 * Layer: forest (reusable infrastructure orchestrator)
 * @module forest/inngest/functions/niche-video-dispatcher-render-steps
 */

import { DEFAULT_MAX_RENDER_COST_CENTS } from '@/seed/config/affiliate-budget-defaults';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { markApprovalExecuted } from '@/tree/affiliate/approval/campaign-approval-repo';
import {
  beginExecutionRun,
  getExecutionRun,
  transitionRun,
  type ExecutionRunRecord,
} from '@/tree/affiliate/execution';
import type { NicheVideoCampaignPlan } from '@/tree/video/blueprints/niche-video-service';
import type { SynthesizedCampaignScript } from '@/tree/video/render';
import type { NicheVideoDispatchData } from './niche-video-dispatcher-approval-steps';

export type QueueReservationResult =
  | {
      ok: true;
      blockedReason: null;
      errorDetail: null;
      run: ExecutionRunRecord;
      alreadyAdvanced: boolean;
    }
  | {
      ok: false;
      blockedReason:
        | 'DB_UNAVAILABLE'
        | 'BUDGET_EXCEEDED'
        | 'RESERVATION_FAILED'
        | 'RESERVATION_TRANSITION_FAILED';
      errorDetail: string;
      run: null;
      alreadyAdvanced: false;
    };

export async function persistRenderQueuedRunStep(params: {
  data: NicheVideoDispatchData;
  tenantId: string;
  stableCampaignId: string;
  plan: NicheVideoCampaignPlan;
}): Promise<QueueReservationResult> {
  const { data, tenantId, stableCampaignId, plan } = params;
  const db = await getD1();
  if (!db) {
    return {
      ok: false,
      blockedReason: 'DB_UNAVAILABLE',
      errorDetail: 'D1 database is unavailable for atomic budget reservation',
      run: null,
      alreadyAdvanced: false,
    };
  }
  const created = await beginExecutionRun(db, {
    tenantId,
    campaignId: stableCampaignId,
    offerId: data.offerId ?? null,
    approvalId: data.approvalId ?? null,
    idempotencyKey: data.idempotencyKey ?? stableCampaignId,
    locale: data.locale ?? 'en',
    market: plan.compliance.jurisdiction || null,
    niche: data.niche,
    reservedCostCents: data.maxRenderCostCents ?? DEFAULT_MAX_RENDER_COST_CENTS,
  });
  if (!created.ok) {
    return {
      ok: false,
      blockedReason: created.error === 'BUDGET_CAP_EXCEEDED' ? 'BUDGET_EXCEEDED' : 'RESERVATION_FAILED',
      errorDetail:
        created.error === 'BUDGET_CAP_EXCEEDED'
          ? 'Cumulative or single-run pilot budget ceiling exceeded'
          : created.error,
      run: null,
      alreadyAdvanced: false,
    };
  }

  if (created.value.replayed && created.value.state !== 'approval_pending') {
    const latest = (await getExecutionRun(db, tenantId, created.value.id)) ?? created.value;
    return { ok: true, blockedReason: null, errorDetail: null, run: latest, alreadyAdvanced: true };
  }

  const moved = await transitionRun(db, tenantId, created.value.id, 'approval_pending', 'render_queued', {});
  if (moved.ok) {
    if (data.approvalId) {
      const consumed = await markApprovalExecuted(db, tenantId, data.approvalId);
      if (!consumed.ok) {
        logger.warn('nicheVideoDispatcher: approval could not be marked executed', {
          approvalId: data.approvalId,
          error: consumed.error.code,
        });
      }
    }
    return {
      ok: true,
      blockedReason: null,
      errorDetail: null,
      run: moved.value,
      alreadyAdvanced: Boolean(moved.value.replayed),
    };
  }

  const current = await getExecutionRun(db, tenantId, created.value.id);
  if (current && current.state !== 'approval_pending') {
    return { ok: true, blockedReason: null, errorDetail: null, run: current, alreadyAdvanced: true };
  }

  return {
    ok: false,
    blockedReason: 'RESERVATION_TRANSITION_FAILED',
    errorDetail: String(moved.error),
    run: null,
    alreadyAdvanced: false,
  };
}

export async function releaseFailedVoiceoverRunStep(params: {
  tenantId: string;
  runId: string;
  uncertainTts: boolean;
  voiceoverError?: string;
}): Promise<void> {
  const { tenantId, runId, uncertainTts, voiceoverError } = params;
  const db = await getD1();
  if (!db) return;
  if (uncertainTts) {
    await transitionRun(db, tenantId, runId, 'render_queued', 'blocked', {
      failureReason: `UNCERTAIN_OUTCOME: ${voiceoverError ?? 'TTS outcome uncertain after provider dispatch'}`,
    });
    return;
  }
  await transitionRun(db, tenantId, runId, 'render_queued', 'failed', {
    failureReason: `PROVIDER_UNAVAILABLE: ${voiceoverError ?? 'voiceover failed before render submit'}`,
  });
}

export function buildVoiceoverFailureResponse(params: {
  uncertainTts: boolean;
  errorCode?: string;
  errorMsg?: string;
  runId: string;
  plan: NicheVideoCampaignPlan;
  script: SynthesizedCampaignScript;
}) {
  const { uncertainTts, errorCode, errorMsg, runId, plan, script } = params;
  if (uncertainTts) {
    return {
      status: 'BLOCKED' as const,
      state: 'blocked' as const,
      reason: 'UNCERTAIN_OUTCOME' as const,
      detail: errorMsg ?? 'Voiceover outcome uncertain after provider dispatch',
      runId,
      plan,
      script,
      mediaReady: false,
    };
  }
  return {
    status: 'FAILED' as const,
    state: 'failed' as const,
    reason: (errorCode === 'CREDENTIALS_MISSING'
      ? 'CREDENTIALS_MISSING'
      : 'PROVIDER_UNAVAILABLE') as 'CREDENTIALS_MISSING' | 'PROVIDER_UNAVAILABLE',
    detail: errorMsg ?? 'Voiceover provider did not produce audio',
    runId,
    plan,
    script,
    mediaReady: false,
  };
}
