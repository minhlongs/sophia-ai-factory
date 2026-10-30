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

const DEFAULT_MAX_RENDER_COST_CENTS = 50;

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
          campaignId: plan.planId,
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
          db, tenantId, plan.planId, approvalPayload, killSwitchActive,
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
        maxCostCents: data.maxRenderCostCents ?? DEFAULT_MAX_RENDER_COST_CENTS,
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

    // Step 4: Voiceover. A failed/mock TTS result is a FAILED run, never a
    // manifest that looks like a finished video.
    const voiceover = await step.run('generate-voiceover', async () =>
      generateNicheCampaignVoiceover({
        planId: plan.planId,
        userId: data.userId,
        narrationText: script.fullNarration,
        locale: data.locale,
      }),
    );

    if (!voiceover.success || (voiceover.provider === 'mock' && process.env.NODE_ENV !== 'test')) {
      return {
        status: 'FAILED' as const,
        state: 'failed' as const,
        reason: 'PROVIDER_UNAVAILABLE' as const,
        detail: voiceover.error ?? 'Voiceover provider did not produce audio',
        plan,
        script,
        mediaReady: false,
      };
    }

    // Step 5: Durable run + render queue entry. This is a DESCRIPTOR, not media.
    const run = await step.run('persist-render-queued-run', async () => {
      const db = await getD1();
      if (!db) return null;
      const created = await beginExecutionRun(db, {
        tenantId,
        campaignId: plan.planId,
        offerId: data.offerId ?? null,
        approvalId: data.approvalId ?? null,
        idempotencyKey: data.idempotencyKey ?? plan.planId,
        locale: data.locale ?? 'en',
        market: plan.compliance.jurisdiction || null,
        reservedCostCents: data.maxRenderCostCents ?? DEFAULT_MAX_RENDER_COST_CENTS,
      });
      if (!created.ok) return null;

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
        return moved.value;
      }
      // Replay after a later state (rendered/publish_queued/...): report the
      // durable state instead of pretending the queue step just happened.
      return (await getExecutionRun(db, tenantId, created.value.id)) ?? created.value;
    });

    const manifest = await step.run('assemble-render-manifest', async () => {
      const visualResult = generateSceneVisualAssets(plan.planId, script.scenes);
      return composeNicheRenderManifest({
        plan,
        script,
        visuals: visualResult.assets,
        voiceover,
      });
    });

    // A replay that reaches a run already past `render_queued` must not be
    // reported as a fresh queue acceptance.
    const durableState = run?.state ?? gateResult.nextState;
    const alreadyAdvanced = durableState !== 'render_queued';

    // Hand every render_queued run to the render worker. This send is a durable
    // step (memoized on retry), and the worker itself is idempotent
    // (single provider_job_id binding + CAS transitions), so emitting on both
    // fresh and replayed queue acceptances is safe AND self-healing: a crash
    // between the queue commit and this step is repaired by the retry.
    if (!alreadyAdvanced && run && tenantId) {
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
      runId: run?.id ?? null,
      summary: stageSummary,
      plan,
      script,
      voiceover,
      manifest,
      manifestIsMedia: false,
      mediaReady: Boolean(run?.artifactId),
      artifactId: run?.artifactId ?? null,
      nextAction: (alreadyAdvanced ? 'review_run' : 'render_worker') as
        | 'review_run'
        | 'render_worker',
    };
  },
);
