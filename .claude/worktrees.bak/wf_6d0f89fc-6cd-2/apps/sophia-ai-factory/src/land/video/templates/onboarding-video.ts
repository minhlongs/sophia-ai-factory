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

const ONBOARDING_SCRIPTS: Record<string, { vi: string; en: string }> = {
  ENTERPRISE: {
    vi: `Chào mừng bạn đến với Sophia AI Factory! Chúng tôi rất vui mừng khi bạn chọn gói Premium.

Sophia AI Factory là nền tảng tạo video AI hàng đầu, giúp bạn tự động hóa toàn bộ quy trình sản xuất video từ A-Z.

Với gói Premium, bạn có thể:
- Tạo video không giới hạn mỗi tháng
- Sử dụng pipeline "Zero Manual" - tự động hoàn toàn
- Tích hợp API vào hệ thống của bạn
- Hỗ trợ 24/7 với Account Manager riêng

Hãy bắt đầu bằng cách truy cập Dashboard để tạo video đầu tiên của bạn. Chúng tôi luôn sẵn sàng hỗ trợ bạn qua Telegram @Sophia_Bbot hoặc email.`,

    en: `Welcome to Sophia AI Factory! We're excited to have you on the Premium plan.

Sophia AI Factory is the leading AI video creation platform that automates your entire video production pipeline from A to Z.

With the Premium plan, you get:
- Unlimited videos per month
- "Zero Manual" pipeline - fully automated
- API access to integrate with your systems
- 24/7 support with a dedicated Account Manager

Get started by visiting your Dashboard to create your first video. We're always here to help via Telegram @Sophia_Bbot or email.`,
  },
  MASTER: {
    vi: `Chào mừng bạn đến với Sophia AI Factory! Bạn đã sở hữu gói Master - gói cao cấp nhất.

Với gói Master, bạn sở hữu toàn bộ hệ thống:
- Mã nguồn đầy đủ
- Tùy chỉnh không giới hạn
- Hỗ trợ kỹ thuật ưu tiên
- Không phí hàng tháng - trả một lần duy nhất

Chúng tôi sẽ liên hệ với bạn trong 24h để bàn giao mã nguồn và hướng dẫn cài đặt chi tiết. Đội ngũ kỹ thuật của chúng tôi luôn sẵn sàng hỗ trợ bạn.`,

    en: `Welcome to Sophia AI Factory! You now own the Master tier - our ultimate package.

With Master, you get full system ownership:
- Complete source code
- Unlimited customization
- Priority technical support
- No monthly fees - one-time payment

We'll contact you within 24 hours to deliver the source code and provide detailed installation guidance. Our technical team is ready to support you.`,
  },
};

function getOnboardingScript(tier: string): string {
  const scripts = ONBOARDING_SCRIPTS[tier];
  if (!scripts) return ONBOARDING_SCRIPTS.ENTERPRISE!.vi;
  return scripts.vi; // Default to Vietnamese
}

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

export const ONBOARDING_TIERS = new Set(['ENTERPRISE', 'MASTER']);
