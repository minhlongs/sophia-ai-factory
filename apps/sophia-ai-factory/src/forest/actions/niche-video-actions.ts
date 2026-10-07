/**
 * Server Actions for Niche Video Campaign Generation
 *
 * Validates requests with Zod, checks session authorization,
 * calculates storyboard plans, and dispatches background Inngest jobs.
 *
 * Layer: forest (Server Actions)
 * @module forest/actions/niche-video-actions
 */

'use server';

import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { inngest } from '@/seed/inngest/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import {
  createNicheVideoCampaignPlan,
  type CreateNicheVideoCampaignInput,
  type NicheVideoCampaignPlan,
} from '@/tree/video/blueprints/niche-video-service';

export const createNicheVideoCampaignSchema = z.object({
  niche: z.enum(['saas_global', 'crypto_global']),
  blueprintId: z.string().min(1, 'Blueprint ID is required'),
  productName: z.string().min(1, 'Product name is required'),
  productUrl: z.string().url('Must be a valid product URL'),
  targetAudience: z.string().optional(),
  jurisdiction: z.string().optional().default('GLOBAL'),
  affiliateCode: z.string().optional().default('sophia_partner'),
  subId: z.string().nullable().optional(),
  vanityCoupon: z.string().nullable().optional(),
  locale: z.enum(['en', 'vi']).optional().default('en'),
});

export type CreateNicheVideoCampaignActionInput = z.input<typeof createNicheVideoCampaignSchema>;

export interface NicheVideoActionResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export async function previewNicheVideoPlanAction(
  rawInput: CreateNicheVideoCampaignActionInput,
): Promise<NicheVideoActionResponse<NicheVideoCampaignPlan>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Unauthorized: authentication required', code: 'UNAUTHORIZED' };
    }

    const parsed = createNicheVideoCampaignSchema.safeParse(rawInput);
    if (!parsed.success) {
      const issue = parsed.error.issues[0]?.message ?? 'Invalid input data';
      return { success: false, error: issue, code: 'VALIDATION_ERROR' };
    }

    const result = createNicheVideoCampaignPlan(parsed.data as CreateNicheVideoCampaignInput);
    if (!result.ok) {
      return {
        success: false,
        error: result.error.message,
        code: result.error.code,
      };
    }

    return {
      success: true,
      data: result.value,
    };
  } catch (err: unknown) {
    const error = toError(err);
    logger.error('previewNicheVideoPlanAction failed', { error: error.message });
    return { success: false, error: error.message, code: 'INTERNAL_ERROR' };
  }
}

export async function dispatchNicheVideoCampaignAction(
  rawInput: CreateNicheVideoCampaignActionInput,
): Promise<NicheVideoActionResponse<{ planId: string; dispatched: boolean }>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Unauthorized: authentication required', code: 'UNAUTHORIZED' };
    }

    const parsed = createNicheVideoCampaignSchema.safeParse(rawInput);
    if (!parsed.success) {
      const issue = parsed.error.issues[0]?.message ?? 'Invalid input data';
      return { success: false, error: issue, code: 'VALIDATION_ERROR' };
    }

    const planInput = parsed.data as CreateNicheVideoCampaignInput;
    const planResult = createNicheVideoCampaignPlan(planInput);
    if (!planResult.ok) {
      return {
        success: false,
        error: planResult.error.message,
        code: planResult.error.code,
      };
    }

    const plan = planResult.value;

    await inngest.send({
      name: 'niche.video.campaign.requested',
      data: {
        userId: user.id,
        niche: planInput.niche,
        blueprintId: planInput.blueprintId,
        productName: planInput.productName,
        productUrl: planInput.productUrl,
        targetAudience: planInput.targetAudience,
        jurisdiction: planInput.jurisdiction,
        affiliateCode: planInput.affiliateCode,
        subId: planInput.subId,
        vanityCoupon: planInput.vanityCoupon,
        locale: planInput.locale,
      },
    });

    logger.info('dispatchNicheVideoCampaignAction: event sent to Inngest', {
      userId: user.id,
      planId: plan.planId,
      blueprintId: plan.blueprint.id,
    });

    return {
      success: true,
      data: {
        planId: plan.planId,
        dispatched: true,
      },
    };
  } catch (err: unknown) {
    const error = toError(err);
    logger.error('dispatchNicheVideoCampaignAction failed', { error: error.message });
    return { success: false, error: error.message, code: 'INTERNAL_ERROR' };
  }
}
