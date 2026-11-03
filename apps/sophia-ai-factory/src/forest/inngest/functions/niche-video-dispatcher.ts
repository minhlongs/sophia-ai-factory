/**
 * Niche Video Dispatcher — canonical render-queue producer.
 *
 * Produces a DRAFT (`DRAFT_PENDING_CEO_APPROVAL`) at $0.00 whenever `approvalId`
 * is absent, or a RENDER QUEUE ENTRY (`RENDER_QUEUED`) after verifying the
 * approved D1 row, Kill Switch, and cumulative pilot budget reservation.
 *
 * Layer: forest (reusable infrastructure orchestrator)
 * @module forest/inngest/functions/niche-video-dispatcher
 */

import { inngest } from '@/seed/inngest/client';
import { computeApprovalPayloadHash } from '@/seed/security/approval-payload-hash';
import { logger } from '@/seed/utils/logger-utility';
import {
  createNicheVideoCampaignPlan,
  type NicheVideoCampaignPlan,
} from '@/tree/video/blueprints/niche-video-service';
import {
  composeNicheRenderManifest,
  generateNicheCampaignVoiceover,
  generateSceneVisualAssets,
  synthesizeNicheScript,
} from '@/tree/video/render';
import {
  buildApprovalPayload,
  persistCeoApprovalDraftStep,
  verifySideEffectGateStep,
  type NicheVideoDispatchData,
} from './niche-video-dispatcher-approval-steps';
import {
  buildVoiceoverFailureResponse,
  persistRenderQueuedRunStep,
  releaseFailedVoiceoverRunStep,
} from './niche-video-dispatcher-render-steps';

export type { NicheVideoDispatchData } from './niche-video-dispatcher-approval-steps';

function resolveStableCampaignId(data: NicheVideoDispatchData, tenantId: string, fallbackPlanId: string): string {
  if (data.campaignId) return data.campaignId;
  if (!data.idempotencyKey) return fallbackPlanId;
  return data.idempotencyKey.startsWith(`${tenantId}:`)
    ? data.idempotencyKey.slice(tenantId.length + 1)
    : data.idempotencyKey;
}

export const nicheVideoDispatcher = inngest.createFunction(
  { id: 'niche-video-dispatcher', name: 'Niche Video Campaign Dispatcher', retries: 2 },
  { event: 'niche.video.campaign.requested' },
  async ({ event, step }) => {
    const data = event.data as NicheVideoDispatchData;
    const tenantId = data.tenantId ?? '';
    logger.info('nicheVideoDispatcher: processing campaign request', {
      userId: data.userId, tenantId: tenantId || 'MISSING', niche: data.niche, blueprintId: data.blueprintId,
    });

    const campaignPlanResult = await step.run('evaluate-and-plan', async () => {
      const result = createNicheVideoCampaignPlan({
        niche: data.niche, blueprintId: data.blueprintId, productName: data.productName,
        productUrl: data.productUrl, targetAudience: data.targetAudience,
        jurisdiction: data.jurisdiction, draftMode: data.draftMode,
        affiliateCode: data.affiliateCode, subId: data.subId,
        vanityCoupon: data.vanityCoupon, locale: data.locale,
      });
      if (!result.ok) {
        logger.warn('nicheVideoDispatcher: campaign plan rejected', {
          reason: result.error.code, message: result.error.message,
        });
        return { ok: false as const, error: result.error };
      }
      return { ok: true as const, plan: result.value };
    });

    if (!campaignPlanResult.ok) {
      return {
        status: 'REJECTED' as const, state: 'blocked' as const,
        reason: campaignPlanResult.error.code, error: campaignPlanResult.error,
      };
    }

    const plan = campaignPlanResult.plan as NicheVideoCampaignPlan;
    const stableCampaignId = resolveStableCampaignId(data, tenantId, plan.planId);

    const stageSummary = await step.run('stage-video-artifacts', async () => ({
      planId: plan.planId, blueprintId: plan.blueprint.id,
      scenesCount: plan.storyboard.scenes.length, durationMs: plan.storyboard.totalDurationMs,
      trackedUrl: plan.trackedUrl, isAllowed: plan.compliance.isAllowed,
      jurisdiction: plan.compliance.jurisdiction,
    }));

    const script = await step.run('synthesize-script', async () =>
      synthesizeNicheScript(plan, data.locale),
    );
    const approvalPayload = buildApprovalPayload(data, plan, script.fullNarration);
    const currentHash = await computeApprovalPayloadHash(approvalPayload);

    // Draft-first: every campaign without an explicit approved `approvalId`
    // (or with unassessed jurisdiction / unverified terms) halts at $0.00.
    const needsCeoApproval =
      !data.approvalId ||
      plan.requiresCeoApproval ||
      !plan.compliance.isAllowed ||
      data.termsVerified !== true;

    if (needsCeoApproval) {
      await step.run('persist-ceo-approval-row', async () =>
        persistCeoApprovalDraftStep({ data, tenantId, stableCampaignId, approvalPayload }),
      );
      return {
        status: 'DRAFT_PENDING_CEO_APPROVAL' as const, state: 'approval_pending' as const,
        summary: { ...stageSummary, requiresCeoApproval: true },
        plan, script, approvalPayloadHash: currentHash, mediaReady: false,
      };
    }

    const gateResult = await step.run('verify-side-effect-gate', async () =>
      verifySideEffectGateStep({ data, tenantId, stableCampaignId, plan, approvalPayload, currentHash }),
    );
    if (!gateResult.ok) {
      return {
        status: 'BLOCKED' as const, state: 'blocked' as const,
        reason: gateResult.reason, plan, script, mediaReady: false,
      };
    }

    const queueReservation = await step.run('persist-render-queued-run', async () =>
      persistRenderQueuedRunStep({ data, tenantId, stableCampaignId, plan }),
    );
    if (!queueReservation.ok || !queueReservation.run) {
      return {
        status: 'BLOCKED' as const, state: 'blocked' as const,
        reason: queueReservation.blockedReason ?? 'RESERVATION_FAILED',
        detail: queueReservation.errorDetail ?? 'Could not persist durable budget reservation',
        plan, script, mediaReady: false,
      };
    }

    const run = queueReservation.run;
    if (queueReservation.alreadyAdvanced) {
      if (run.state === 'render_queued' && tenantId) {
        await step.sendEvent('request-execution-render', {
          name: 'execution.render.requested', data: { tenantId, runId: run.id },
        });
      }
      return {
        status: 'RUN_ALREADY_ADVANCED' as const, state: run.state, runId: run.id,
        summary: stageSummary, plan, script, manifestIsMedia: false,
        mediaReady: Boolean(run.artifactId), artifactId: run.artifactId ?? null,
        nextAction: (run.state === 'render_queued' ? 'render_worker' : 'review_run') as
          | 'review_run' | 'render_worker',
      };
    }

    const voiceover = await step.run('generate-voiceover', async () =>
      generateNicheCampaignVoiceover({
        planId: plan.planId, userId: data.userId, tenantId,
        narrationText: script.fullNarration, locale: data.locale, niche: data.niche,
      }),
    );

    if (!voiceover.success || voiceover.provider === 'mock') {
      const uncertainTts = voiceover.outcomeUncertain === true;
      if (run.id && tenantId) {
        await step.run('release-failed-voiceover-run', async () =>
          releaseFailedVoiceoverRunStep({
            tenantId, runId: run.id, uncertainTts, voiceoverError: voiceover.error,
          }),
        );
      }
      return buildVoiceoverFailureResponse({
        uncertainTts, errorCode: voiceover.errorCode, errorMsg: voiceover.error,
        runId: run.id, plan, script,
      });
    }

    const manifest = await step.run('assemble-render-manifest', async () => {
      const visualResult = generateSceneVisualAssets(plan.planId, script.scenes);
      return composeNicheRenderManifest({ plan, script, visuals: visualResult.assets, voiceover });
    });

    const durableState = run.state;
    const alreadyAdvanced = durableState !== 'render_queued';
    if (!alreadyAdvanced && tenantId) {
      await step.sendEvent('request-execution-render', {
        name: 'execution.render.requested', data: { tenantId, runId: run.id },
      });
    }
    return {
      status: (alreadyAdvanced ? 'RUN_ALREADY_ADVANCED' : 'RENDER_QUEUED') as
        | 'RUN_ALREADY_ADVANCED' | 'RENDER_QUEUED',
      state: durableState, runId: run.id, summary: stageSummary,
      plan, script, voiceover, manifest, manifestIsMedia: false,
      mediaReady: Boolean(run.artifactId), artifactId: run.artifactId ?? null,
      nextAction: (alreadyAdvanced ? 'review_run' : 'render_worker') as
        | 'review_run' | 'render_worker',
    };
  },
);
