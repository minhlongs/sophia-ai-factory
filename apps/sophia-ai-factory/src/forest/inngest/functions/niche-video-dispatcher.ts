/**
 * Niche Video Dispatcher
 *
 * Inngest function orchestrating campaign plan resolution, compliance validation,
 * scene-by-scene script synthesis, voiceover audio generation, and render manifest assembly.
 * Layer: forest (reusable infrastructure orchestrator)
 * @module forest/inngest/functions/niche-video-dispatcher
 */

import { inngest } from '@/seed/inngest/client';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { isAffiliateKillSwitchActive } from '@/tree/affiliate/kill-switch/kill-switch-store';
import {
  createCampaignApproval,
  verifyAndEnforceCampaignApprovalD1,
} from '@/tree/affiliate/approval/campaign-approval-repo';
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

export const nicheVideoDispatcher = inngest.createFunction(
  {
    id: 'niche-video-dispatcher',
    name: 'Niche Video Campaign Dispatcher',
    retries: 2,
  },
  { event: 'niche.video.campaign.requested' },
  async ({ event, step }) => {
    const data = event.data;
    logger.info('nicheVideoDispatcher: processing campaign request', {
      userId: data.userId,
      niche: data.niche,
      blueprintId: data.blueprintId,
      productName: data.productName,
    });

    // Step 1: Validate compliance & build campaign plan
    const campaignPlanResult = await step.run('evaluate-and-plan', async () => {
      const { niche, blueprintId, productName, productUrl, targetAudience, jurisdiction, draftMode, affiliateCode, subId, vanityCoupon, locale } = data;
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
      return { status: 'REJECTED', error: campaignPlanResult.error };
    }

    const plan = campaignPlanResult.plan as unknown as NicheVideoCampaignPlan;

    // Step 2: Stage video generation payload
    const stageSummary = await step.run('stage-video-artifacts', async () => {
      return {
        planId: plan.planId,
        blueprintId: plan.blueprint.id,
        scenesCount: plan.storyboard.scenes.length,
        durationMs: plan.storyboard.totalDurationMs,
        trackedUrl: plan.trackedUrl,
        isAllowed: plan.compliance.isAllowed,
        jurisdiction: plan.compliance.jurisdiction,
      };
    });

    // Step 3: Synthesize detailed per-scene narration script
    const script = await step.run('synthesize-script', async () => {
      return synthesizeNicheScript(plan);
    });

    // Draft-First + CEO Approval Gate: if jurisdiction is unassessed (e.g. 'GLOBAL' on crypto),
    // stage the synthesized script as a draft awaiting explicit CEO jurisdiction selection & approval
    // BEFORE spending ElevenLabs voiceover or video render budget.
    if (plan.requiresCeoApproval || !plan.compliance.isAllowed) {
      await step.run('persist-ceo-approval-row', async () => {
        const db = await getD1();
        if (db) {
          const tenantId = (data as { tenantId?: string }).tenantId ?? data.userId;
          await createCampaignApproval(db, {
            tenantId,
            campaignId: plan.planId,
            niche: data.niche,
            jurisdiction: plan.compliance.jurisdiction || 'GLOBAL',
            status: 'pending_ceo',
            payload: {
              scriptBody: script.fullNarration,
              affiliateTargetUrl: plan.trackedUrl || data.productUrl,
              jurisdiction: plan.compliance.jurisdiction || 'GLOBAL',
              disclosureText: plan.compliance.regulatoryRef || '#ad',
              maxRenderCostCents: 50,
            },
          });
        }
      });

      return {
        status: 'DRAFT_PENDING_CEO_APPROVAL',
        summary: {
          ...stageSummary,
          requiresCeoApproval: true,
        },
        plan,
        script,
      };
    }

    // Step 3b: Verify emergency kill switch and CEO approval integrity before expensive assets
    await step.run('verify-approval-and-kill-switch', async () => {
      const tenantId = (data as { tenantId?: string }).tenantId ?? data.userId;
      const killSwitchActive = await isAffiliateKillSwitchActive(tenantId);
      if (killSwitchActive) {
        throw new Error(`Affiliate emergency kill switch active for tenant ${tenantId}`);
      }

      const db = await getD1();
      const needsApproval = Boolean((data as { requiresApproval?: boolean; approvalId?: string }).requiresApproval || (data as { approvalId?: string }).approvalId);
      if (db && needsApproval) {
        const verification = await verifyAndEnforceCampaignApprovalD1(
          db,
          tenantId,
          plan.planId,
          {
            scriptBody: script.fullNarration,
            affiliateTargetUrl: plan.trackedUrl || data.productUrl,
            jurisdiction: plan.compliance.jurisdiction || 'GLOBAL',
            disclosureText: plan.compliance.regulatoryRef || '#ad',
            maxRenderCostCents: 50,
          },
          killSwitchActive,
        );
        if (!verification.ok) {
          throw new Error(`CEO approval verification failed: ${verification.error.message}`);
        }
      }
    });

    // Step 4: Generate voiceover audio track via ElevenLabs BYOK
    const voiceover = await step.run('generate-voiceover', async () => {
      return await generateNicheCampaignVoiceover({
        planId: plan.planId,
        userId: data.userId,
        narrationText: script.fullNarration,
        locale: data.locale,
      });
    });

    // Step 5: Assemble visual scenes and full render manifest
    const manifest = await step.run('assemble-render-manifest', async () => {
      const visualResult = generateSceneVisualAssets(plan.planId, script.scenes);
      return composeNicheRenderManifest({
        plan,
        script,
        visuals: visualResult.assets,
        voiceover,
      });
    });

    return {
      status: 'RENDER_READY',
      summary: stageSummary,
      plan,
      script,
      voiceover,
      manifest,
    };
  },
);
