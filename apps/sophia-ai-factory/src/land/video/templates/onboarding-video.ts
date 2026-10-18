/**
 * Onboarding Video — post-purchase auto video generation
 *
 * Triggered when a new customer buys ENTERPRISE or MASTER tier.
 * Creates a HeyGen video with a templated onboarding script,
 * stores in the videos table for dashboard display.
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { createHeyGenVideo } from '@/land/video/templates/heygen-helpers';
import { getOnboardingScript, ONBOARDING_TIERS } from './onboarding-scripts';

export { ONBOARDING_TIERS };

interface CreateOnboardingVideoInput {
  userId: string;
  orgId?: string;
  tier: string;
  paymentId: string;
  userEmail: string;
}

interface CreateOnboardingVideoResult {
  success: boolean;
  videoId?: string;
  error?: string;
}

export async function createOnboardingVideo(
  input: CreateOnboardingVideoInput,
): Promise<CreateOnboardingVideoResult> {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) {
    logger.warn('[OnboardingVideo] No HEYGEN_API_KEY, skipping');
    return { success: false, error: 'No HEYGEN_API_KEY configured' };
  }

  const script = getOnboardingScript(input.tier);
  const title = `Welcome to Sophia AI — ${input.tier}`;
  const db = createServerClient();

  // Idempotency: check if onboarding already triggered for this payment
  const { data: existingEvent } = await db.from('video_onboarding_events')
    .select('id, video_id, delivery_status')
    .eq('payment_id', input.paymentId)
    .single();
  const existing = existingEvent as { id: string; video_id: string | null; delivery_status: string } | null;
  if (existing) {
    logger.info('[OnboardingVideo] Already exists for payment', {
      paymentId: input.paymentId,
      videoId: existing.video_id,
      status: existing.delivery_status,
    });
    return { success: true, videoId: existing.video_id ?? undefined };
  }

  // Insert onboarding event — MUST succeed before creating video
  try {
    await db.from('video_onboarding_events').insert({
      user_id: input.userId,
      org_id: input.orgId ?? null,
      payment_id: input.paymentId,
      tier: input.tier,
      delivery_status: 'generating',
      email_recipient: input.userEmail,
    });
  } catch (err) {
    logger.error('[OnboardingVideo] Failed to insert event — aborting', err instanceof Error ? err : undefined);
    return { success: false, error: 'Failed to create onboarding event' };
  }

  // Create HeyGen video
  try {
    const { videoId: heygenJobId } = await createHeyGenVideo({
      script,
      title,
      apiKey,
    });

    // Store in videos table for dashboard display
    const videoResult = await db.from('videos').insert({
      user_id: input.userId,
      heygen_job_id: heygenJobId,
      title,
      status: 'processing',
      is_onboarding: 1,
      created_at: Math.floor(Date.now() / 1000),
    }).select('id').single();

    const videoId = (videoResult.data as { id?: string } | null)?.id;
    if (videoId) {
      await db.from('video_onboarding_events')
        .update({ video_id: videoId, delivery_status: 'generating' })
        .eq('payment_id', input.paymentId);
    }

    logger.info('[OnboardingVideo] Created', { userId: input.userId, tier: input.tier, heygenJobId, videoId });
    return { success: true, videoId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[OnboardingVideo] Failed', err instanceof Error ? err : undefined, { userId: input.userId });
    await db.from('video_onboarding_events')
      .update({ delivery_status: 'failed', error: message })
      .eq('payment_id', input.paymentId);
    return { success: false, error: message };
  }
}
