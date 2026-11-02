/**
 * Niche Video Dispatcher — canonical render-queue producer.
 *
 * This function produces a DRAFT or a RENDER QUEUE ENTRY. It does NOT produce
 * media: scene descriptors and an ffmpeg filter string are not bytes. A run can
 * only become `rendered` after `recordVerifiedArtifact` persists verified media
 * metadata (see tree/affiliate/execution). Nothing here claims published,
 * succeeded or revenue.
 *
 * Layer: forest (reusable infrastructure orchestrator)
 * @module forest/inngest/functions/niche-video-dispatcher
 */

import {
  DEFAULT_MAX_RENDER_COST_CENTS,
  PROPOSED_GATE1_VERTICAL_CAP_CENTS,
} from '@/seed/config/affiliate-budget-defaults';
import { inngest } from '@/seed/inngest/client';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { computeApprovalPayloadHash } from '@/seed/security/approval-payload-hash';
import { getAffiliateKillSwitchState } from '@/tree/affiliate/kill-switch/kill-switch-store';
import {
  createCampaignApproval,
  markApprovalExecuted,
  verifyAndEnforceCampaignApprovalD1,
  type ApprovalDispatchContext,
} from '@/tree/affiliate/approval/campaign-approval-repo';
import {
  beginExecutionRun,
  evaluateRenderGate,
  getExecutionRun,
  transitionRun,
  type ExecutionEvidence,
} from '@/tree/affiliate/execution';
import {
  createNicheVideoCampaignPlan,
  type NicheVideoCampaignPlan,
} from '@/tree/video/blueprints/niche-video-service';
import {
  sendCampaignApprovalNotification,
} from '@/tree/telegram/telegram-campaign-approval-handler';
import { getChatIdByUserId } from '@/tree/telegram/user-mappings-service';
import {
  synthesizeNicheScript,
  generateNicheCampaignVoiceover,
  generateSceneVisualAssets,
  composeNicheRenderManifest,
} from '@/tree/video/render';

/** Extended event data. Only the server action may set identity/approval fields. */
interface NicheVideoDispatchData {
  userId: string;
  tenantId?: string;
  offerId?: string;
  /** True only after the offer's terms/jurisdiction were verified server-side. */
  termsVerified?: boolean;
  approvalId?: string;
  /** Stored SHA-256 hash of the approved payload, read from D1 by the producer. */
  approvalHash?: string;
  /** Stable campaignId from the draft/approval when resuming or replaying. */
  campaignId?: string;
  maxRenderCostCents?: number;
  targetAccount?: string;
  idempotencyKey?: string;
  niche: 'saas_global' | 'crypto_global';
  blueprintId: string;
  productName: string;
  productUrl: string;
  targetAudience?: string;
  jurisdiction?: string;
  draftMode?: boolean;
  affiliateCode?: string;
  subId?: string | null;
  vanityCoupon?: string | null;
  locale?: 'en' | 'vi';
  requiresApproval?: boolean;
}

function buildApprovalPayload(
  data: NicheVideoDispatchData,
  plan: NicheVideoCampaignPlan,
  scriptBody: string,
) {
  return {
    scriptBody,
    affiliateTargetUrl: plan.trackedUrl || data.productUrl,
    jurisdiction: plan.compliance.jurisdiction || data.jurisdiction || 'UNKNOWN',
    disclosureText: plan.compliance.regulatoryRef || '#ad',
    maxRenderCostCents: data.maxRenderCostCents ?? DEFAULT_MAX_RENDER_COST_CENTS,
    ...(data.targetAccount ? { targetAccount: data.targetAccount } : {}),
  };
}

export const nicheVideoDispatcher = inngest.createFunction(
  {
    id: 'niche-video-dispatcher',
    name: 'Niche Video Campaign Dispatcher',
    retries: 2,
  },
  { event: 'niche.video.campaign.requested' },
  async ({ event, step }) => {
    const data = event.data as NicheVideoDispatchData;
    const tenantId = data.tenantId ?? '';
    logger.info('nicheVideoDispatcher: processing campaign request', {
      userId: data.userId,
      tenantId: tenantId || 'MISSING',
      niche: data.niche,
      blueprintId: data.blueprintId,
    });

    // Step 1: Validate compliance & build campaign plan (no side effects yet).
    const campaignPlanResult = await step.run('evaluate-and-plan', async () => {
      const {
        niche, blueprintId, productName, productUrl, targetAudience, jurisdiction,
        draftMode, affiliateCode, subId, vanityCoupon, locale,
      } = data;
      const result = createNicheVideoCampaignPlan({
        niche, blueprintId, productName, productUrl, targetAudience,
        jurisdiction, draftMode, affiliateCode, subId, vanityCoupon, locale,
      });
      if (!result.ok) {
        logger.warn('nicheVideoDispatcher: campaign plan rejected', {
          reason: result.error.code,
          message: result.error.message,
        });
        return { ok: false as const, error: result.error };
      }
      return { ok: true as const, plan: result.value };
    });

    if (!campaignPlanResult.ok) {
      return { status: 'REJECTED' as const, state: 'blocked' as const, reason: campaignPlanResult.error.code, error: campaignPlanResult.error };
    }

    const plan = campaignPlanResult.plan as NicheVideoCampaignPlan;
    const stableCampaignId =
      data.campaignId ??
      (data.idempotencyKey
        ? data.idempotencyKey.startsWith(`${tenantId}:`)
          ? data.idempotencyKey.slice(tenantId.length + 1)
          : data.idempotencyKey
        : plan.planId);

    const stageSummary = await step.run('stage-video-artifacts', async () => ({
      planId: plan.planId,
      blueprintId: plan.blueprint.id,
      scenesCount: plan.storyboard.scenes.length,
      durationMs: plan.storyboard.totalDurationMs,
      trackedUrl: plan.trackedUrl,
      isAllowed: plan.compliance.isAllowed,
      jurisdiction: plan.compliance.jurisdiction,
    }));

    const script = await step.run('synthesize-script', async () => synthesizeNicheScript(plan));
    const approvalPayload = buildApprovalPayload(data, plan, script.fullNarration);
    const currentHash = await computeApprovalPayloadHash(approvalPayload);

    // Step 2: Draft-first. Unassessed/unknown jurisdiction and unverified terms
    // are staged for CEO review BEFORE any provider spend.
    const needsCeoApproval =
      plan.requiresCeoApproval || !plan.compliance.isAllowed || data.termsVerified !== true;

    if (needsCeoApproval) {
      await step.run('persist-ceo-approval-row', async () => {
        if (!tenantId) return { persisted: false, reason: 'TENANT_REQUIRED' };
        const db = await getD1();
        if (!db) return { persisted: false, reason: 'DB_UNAVAILABLE' };
        const dispatch: ApprovalDispatchContext = {
          userId: data.userId,
          offerId: data.offerId,
          maxRenderCostCents: data.maxRenderCostCents,
          targetAccount: data.targetAccount,
          idempotencyKey: data.idempotencyKey,
          niche: data.niche,
          blueprintId: data.blueprintId,
          productName: data.productName,
          productUrl: data.productUrl,
          targetAudience: data.targetAudience,
          jurisdiction: data.jurisdiction,
          affiliateCode: data.affiliateCode,
          subId: data.subId,
          vanityCoupon: data.vanityCoupon,
          locale: data.locale,
        };
        const created = await createCampaignApproval(db, {
          tenantId,
          campaignId: stableCampaignId,
          niche: data.niche,
          jurisdiction: approvalPayload.jurisdiction,
          status: 'pending_ceo',
          payload: approvalPayload,
          dispatch,
        });
        if (!created.ok) {
          logger.warn('nicheVideoDispatcher: approval row could not be persisted', {
            error: created.error.message,
          });
          return { persisted: false, reason: created.error.code };
        }

        // Notify the campaign owner's linked Telegram chat so the approval
        // request reaches the CEO/Admin who can tap Approve/Reject.
        try {
          const chatId = await getChatIdByUserId(data.userId);
          if (chatId) {
            await sendCampaignApprovalNotification({
              chatId,
              approval: created.value,
              productName: data.productName,
              affiliateUrl: data.productUrl,
              budgetUsd: (data.maxRenderCostCents ?? DEFAULT_MAX_RENDER_COST_CENTS) / 100,
              locale: data.locale === 'vi' ? 'vi' : 'en',
            });
          }
        } catch (error) {
          logger.warn('nicheVideoDispatcher: approval telegram notify failed', {
            error: error instanceof Error ? error.message : String(error),
          });
        }

        return { persisted: true, approvalId: created.value.id };
      });

      return {
        status: 'DRAFT_PENDING_CEO_APPROVAL' as const,
        state: 'approval_pending' as const,
        summary: { ...stageSummary, requiresCeoApproval: true },
        plan,
        script,
        approvalPayloadHash: currentHash,
        mediaReady: false,
      };
    }

    // Step 3: Side-effect gate. Re-checked here (not only at job start) so a
    // retry after a sleep cannot bypass halt / budget / approval binding.
    const gateResult = await step.run('verify-side-effect-gate', async () => {
      // A failed kill-switch read is NOT "off": fail closed and report unknown.
      const killState = tenantId
        ? await getAffiliateKillSwitchState(tenantId)
        : { active: true, known: false, reason: 'TENANT_REQUIRED' };
      const killSwitchActive = killState.active || !killState.known;
      let storedHash = data.approvalHash ?? '';

      // When D1 is available, re-verify against the persisted approval rather
      // than trusting the event's copy (covers revocation + status changes).
      const db = await getD1();
      if (db && data.approvalId) {
        // Verify THE row the continuation references — never the latest row
        // for the campaign (a newer draft must not shadow a granted approval).
        const verification = await verifyAndEnforceCampaignApprovalD1(
          db, tenantId, stableCampaignId, approvalPayload, killSwitchActive,
          { approvalId: data.approvalId },
        );
        if (!verification.ok) {
          return { ok: false as const, reason: verification.error.code };
        }
        storedHash = verification.value.verifiedHash;
      }

      const evidence: ExecutionEvidence = {
        tenantId,
        state: 'approval_pending',
        jurisdictionKnown: plan.compliance.isAllowed && Boolean(plan.compliance.jurisdiction),
        termsVerified: data.termsVerified === true,
        approval: {
          status: storedHash ? 'approved' : 'pending_ceo',
          currentHash,
          storedHash,
          nowMs: Date.now(),
        },
        killSwitchActive,
        reservedCostCents: data.maxRenderCostCents ?? DEFAULT_MAX_RENDER_COST_CENTS,
        maxCostCents: PROPOSED_GATE1_VERTICAL_CAP_CENTS,
        credentialsConnected: true,
        outcomeKnown: true,
      };
      const gate = evaluateRenderGate(evidence);
      if (!gate.ok) return { ok: false as const, reason: gate.error };
      return { ok: true as const, nextState: gate.value.nextState };
    });

    if (!gateResult.ok) {
      return {
        status: 'BLOCKED' as const,
        state: 'blocked' as const,
        reason: gateResult.reason,
        plan,
        script,
        mediaReady: false,
      };
    }

    // Step 4: Durable run + atomic cumulative budget reservation BEFORE any paid
    // TTS / voiceover side effect. If D1 is missing, reservation fails for ANY
    // reason, or the vertical ($25) / total ($50) pilot ceiling is exhausted,
    // fail closed immediately without calling ElevenLabs/TTS.
    const queueReservation = await step.run('persist-render-queued-run', async () => {
      const db = await getD1();
      if (!db) {
        return {
          ok: false as const,
          blockedReason: 'DB_UNAVAILABLE' as const,
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
        if (created.error === 'BUDGET_CAP_EXCEEDED') {
          return {
            ok: false as const,
            blockedReason: 'BUDGET_EXCEEDED' as const,
            errorDetail: 'Cumulative or single-run pilot budget ceiling exceeded',
            run: null,
            alreadyAdvanced: false,
          };
        }
        return {
          ok: false as const,
          blockedReason: 'RESERVATION_FAILED' as const,
          errorDetail: created.error,
          run: null,
          alreadyAdvanced: false,
        };
      }

      // If this is an idempotent replay and the run already progressed past
      // `approval_pending`, do NOT re-run TTS or re-consume the approval.
      if (created.value.replayed && created.value.state !== 'approval_pending') {
        const latest = (await getExecutionRun(db, tenantId, created.value.id)) ?? created.value;
        return {
          ok: true as const,
          blockedReason: null,
          errorDetail: null,
          run: latest,
          alreadyAdvanced: true,
        };
      }

      // Persist the queue acceptance. Without this the DB row would still say
      // `approval_pending` while the response said `render_queued`.
      const moved = await transitionRun(
        db, tenantId, created.value.id, 'approval_pending', 'render_queued', {},
      );
      if (moved.ok) {
        // Consume the approval exactly once it backs a queued run. Best-effort:
        // a crash here leaves `approved`, and the resume path re-checks the run
        // before re-sending, so the consumer stays idempotent either way.
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
          ok: true as const,
          blockedReason: null,
          errorDetail: null,
          run: moved.value,
          alreadyAdvanced: Boolean(moved.value.replayed),
        };
      }

      const current = await getExecutionRun(db, tenantId, created.value.id);
      if (current && current.state !== 'approval_pending') {
        return {
          ok: true as const,
          blockedReason: null,
          errorDetail: null,
          run: current,
          alreadyAdvanced: true,
        };
      }

      return {
        ok: false as const,
        blockedReason: 'RESERVATION_TRANSITION_FAILED' as const,
        errorDetail: String(moved.error),
        run: null,
        alreadyAdvanced: false,
      };
    });

    if (!queueReservation.ok || !queueReservation.run) {
      return {
        status: 'BLOCKED' as const,
        state: 'blocked' as const,
        reason: queueReservation.blockedReason ?? 'RESERVATION_FAILED',
        detail: queueReservation.errorDetail ?? 'Could not persist durable budget reservation',
        plan,
        script,
        mediaReady: false,
      };
    }

    const run = queueReservation.run;

    // If an idempotent replay found the run already advanced past `approval_pending`
    // (e.g. `render_queued`, `rendered`, `published`, `blocked`, `failed`), do NOT
    // call ElevenLabs TTS again. If it is still `render_queued`, re-emit the
    // idempotent render worker event so a crash between step 4 and step 6 self-heals.
    if (queueReservation.alreadyAdvanced) {
      if (run.state === 'render_queued' && tenantId) {
        await step.sendEvent('request-execution-render', {
          name: 'execution.render.requested',
          data: { tenantId, runId: run.id },
        });
      }
      return {
        status: 'RUN_ALREADY_ADVANCED' as const,
        state: run.state,
        runId: run.id,
        summary: stageSummary,
        plan,
        script,
        manifestIsMedia: false,
        mediaReady: Boolean(run.artifactId),
        artifactId: run.artifactId ?? null,
        nextAction: (run.state === 'render_queued' ? 'render_worker' : 'review_run') as
          | 'review_run'
          | 'render_worker',
      };
    }

    // Step 5: Voiceover. Runs only AFTER durable budget reservation succeeds.
    // - If TTS failed BEFORE any provider charge (`outcomeUncertain !== true`),
    //   transition the run to `failed` so its reservation is released cleanly.
    // - If TTS failed AFTER dispatch with an uncertain outcome (timeout / network drop),
    //   transition the run to `blocked` (`UNCERTAIN_OUTCOME`) so the reservation
    //   remains locked until operator reconciliation.
    const voiceover = await step.run('generate-voiceover', async () =>
      generateNicheCampaignVoiceover({
        planId: plan.planId,
        userId: data.userId,
        tenantId,
        narrationText: script.fullNarration,
        locale: data.locale,
        niche: data.niche,
      }),
    );

    if (!voiceover.success || voiceover.provider === 'mock') {
      const uncertainTts = voiceover.outcomeUncertain === true;
      if (run.id && tenantId) {
        await step.run('release-failed-voiceover-run', async () => {
          const db = await getD1();
          if (!db) return;
          if (uncertainTts) {
            await transitionRun(
              db,
              tenantId,
              run.id,
              'render_queued',
              'blocked',
              {
                failureReason: `UNCERTAIN_OUTCOME: ${voiceover.error ?? 'TTS outcome uncertain after provider dispatch'}`,
              },
            );
            return;
          }
          await transitionRun(
            db,
            tenantId,
            run.id,
            'render_queued',
            'failed',
            {
              failureReason: `PROVIDER_UNAVAILABLE: ${voiceover.error ?? 'voiceover failed before render submit'}`,
            },
          );
        });
      }
      if (uncertainTts) {
        return {
          status: 'BLOCKED' as const,
          state: 'blocked' as const,
          reason: 'UNCERTAIN_OUTCOME' as const,
          detail: voiceover.error ?? 'Voiceover outcome uncertain after provider dispatch',
          runId: run.id,
          plan,
          script,
          mediaReady: false,
        };
      }
      return {
        status: 'FAILED' as const,
        state: 'failed' as const,
        reason: (voiceover.errorCode === 'CREDENTIALS_MISSING'
          ? 'CREDENTIALS_MISSING'
          : 'PROVIDER_UNAVAILABLE') as 'CREDENTIALS_MISSING' | 'PROVIDER_UNAVAILABLE',
        detail: voiceover.error ?? 'Voiceover provider did not produce audio',
        runId: run.id,
        plan,
        script,
        mediaReady: false,
      };
    }

    const manifest = await step.run('assemble-render-manifest', async () => {
      const visualResult = generateSceneVisualAssets(plan.planId, script.scenes);
      return composeNicheRenderManifest({
        plan,
        script,
        visuals: visualResult.assets,
        voiceover,
      });
    });

    const durableState = run.state;
    const alreadyAdvanced = durableState !== 'render_queued';

    if (!alreadyAdvanced && tenantId) {
      await step.sendEvent('request-execution-render', {
        name: 'execution.render.requested',
        data: { tenantId, runId: run.id },
      });
    }
    return {
      // Deliberately NOT "RENDER_READY": a manifest is not a rendered artifact.
      status: (alreadyAdvanced ? 'RUN_ALREADY_ADVANCED' : 'RENDER_QUEUED') as
        | 'RUN_ALREADY_ADVANCED'
        | 'RENDER_QUEUED',
      state: durableState,
      runId: run.id,
      summary: stageSummary,
      plan,
      script,
      voiceover,
      manifest,
      manifestIsMedia: false,
      mediaReady: Boolean(run.artifactId),
      artifactId: run.artifactId ?? null,
      nextAction: (alreadyAdvanced ? 'review_run' : 'render_worker') as
        | 'review_run'
        | 'render_worker',
    };
  },
);
