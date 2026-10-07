/**
 * Niche Video Dispatcher
 *
 * Inngest function orchestrating campaign plan resolution, compliance validation,
 * scene-by-scene script synthesis, voiceover audio generation, and render manifest assembly.
 * Layer: forest (reusable infrastructure orchestrator)
 * @module forest/inngest/functions/niche-video-dispatcher
 */

import { inngest } from '@/seed/inngest/client';
import { logger } from '@/seed/utils/logger-utility';
import {
  createNicheVideoCampaignPlan,
  type CreateNicheVideoCampaignInput,
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
      const planInput: CreateNicheVideoCampaignInput = {
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

      const result = createNicheVideoCampaignPlan(planInput);
      if (!result.ok) {
        logger.warn('nicheVideoDispatcher: campaign plan rejected', {
          reason: result.error.code,
          message: result.error.message,
        });
        return {
          ok: false as const,
          error: result.error,
        };
      }

      return {
        ok: true as const,
        plan: result.value,
      };
    });

    if (!campaignPlanResult.ok) {
      return {
        status: 'REJECTED',
        error: campaignPlanResult.error,
      };
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
