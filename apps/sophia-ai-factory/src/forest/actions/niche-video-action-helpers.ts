/**
 * Validation schema, types, and shared plan builder for Niche Video Server Actions
 *
 * Layer: forest (Server Actions helpers)
 * @module forest/actions/niche-video-action-helpers
 */

import { z } from 'zod';
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
  /** Id of the persisted offer this campaign promotes. Verification is server-side. */
  offerId: z.string().min(1).optional(),
  /** Approved channel/account id; bound into the approval payload hash. */
  targetAccount: z.string().min(1).optional(),
  /** Approved render budget cap in cents; the server clamps this to the tier cap. */
  maxRenderCostCents: z.number().int().min(0).max(5000).optional(),
});

export type CreateNicheVideoCampaignActionInput = z.input<typeof createNicheVideoCampaignSchema>;
export type ValidatedNicheVideoActionInput = z.output<typeof createNicheVideoCampaignSchema>;

export interface NicheVideoActionResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export function validateAndBuildNichePlan(
  rawInput: CreateNicheVideoCampaignActionInput,
):
  | { ok: true; planInput: CreateNicheVideoCampaignInput; input: ValidatedNicheVideoActionInput; plan: NicheVideoCampaignPlan }
  | { ok: false; response: NicheVideoActionResponse<never> } {
  const parsed = createNicheVideoCampaignSchema.safeParse(rawInput);
  if (!parsed.success) {
    const issue = parsed.error.issues[0]?.message ?? 'Invalid input data';
    return {
      ok: false,
      response: { success: false, error: issue, code: 'VALIDATION_ERROR' },
    };
  }

  const planInput = parsed.data as CreateNicheVideoCampaignInput;
  const planResult = createNicheVideoCampaignPlan(planInput);
  if (!planResult.ok) {
    return {
      ok: false,
      response: {
        success: false,
        error: planResult.error.message,
        code: planResult.error.code,
      },
    };
  }

  return { ok: true, planInput, input: parsed.data, plan: planResult.value };
}
