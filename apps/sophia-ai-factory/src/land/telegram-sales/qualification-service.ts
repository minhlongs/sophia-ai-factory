/**
 * Lead Qualification FSM & Automated Sales Service
 * Milestone M2 (Requirement R2)
 * Layer: land (end-to-end sales orchestration & state machine)
 * @module land/telegram-sales/qualification-service
 */

import { logger } from '@/seed/utils/logger-utility';
import type { BudgetTier } from '@/seed/types/telegram-sales';
import {
  sendTelegramMessage,
  sendTelegramMessageWithKeyboard,
  sendTelegramVideo,
} from '@/tree/telegram/telegram-client';
import {
  notifyFounderLeadQualified,
} from '@/tree/telegram/telegram-admin-notifier';
import {
  buildNicheSelectionKeyboard,
  buildBudgetSelectionKeyboard,
  buildDemoActionKeyboard,
  buildCheckoutKeyboard,
} from '@/tree/telegram/telegram-lead-keyboards';
import { calculatePromoDiscount } from '@/land/promo/promo-discount-calculator';
import {
  upsertLead,
  getLeadByChatId,
  recordSurveyStep,
  recordDemoDelivery,
  recordCheckoutIntent,
} from './telegram-lead-repo';
import { getSampleVideoForNiche } from './sample-video-catalog';
import { createCheckout } from '@/tree/clients/nowpayments-client';
import { createPayOsInvoice, FEATURE_PAYOS } from '@/land/payments/payos';

/**
 * Calculates lead qualification score (0-100).
 */
export function calculateLeadScore(
  startPayload?: string | null,
  niche?: string | null,
  budgetTier?: BudgetTier | string | null
): number {
  let score = 0;

  // 1. Deep-link attribution (+20 points)
  if (startPayload && (
    startPayload.startsWith('vid_') ||
    startPayload.startsWith('ref_') ||
    startPayload.startsWith('demo_') ||
    startPayload.toLowerCase().includes('solo100')
  )) {
    score += 20;
  }

  // 2. Niche alignment (+15 to +30 points)
  if (niche) {
    const n = niche.toLowerCase();
    if (n === 'ai_agency' || n === 'ai_automation' || n === 'ecommerce' || n === 'solopreneur') {
      score += 30;
    } else if (n === 'real_estate' || n === 'beauty') {
      score += 25;
    } else {
      score += 15;
    }
  }

  // 3. Budget & scale intent (+25 to +50 points)
  if (budgetTier) {
    if (budgetTier === 'high') {
      score += 50;
    } else if (budgetTier === 'mid') {
      score += 40;
    } else if (budgetTier === 'low') {
      score += 25;
    }
  }

  return Math.min(100, score);
}

/**
 * Parses deep-link start payload to extract campaign or referrer.
 */
export function parseStartPayload(payload: string | null): {
  campaignId: string | null;
  referrerId: string | null;
  preferredNiche: string | null;
  isSolo100: boolean;
} {
  if (!payload) {
    return { campaignId: null, referrerId: null, preferredNiche: null, isSolo100: false };
  }

  const p = payload.trim();
  const isSolo100 = p.toLowerCase().includes('solo100');

  let campaignId: string | null = null;
  let referrerId: string | null = null;
  let preferredNiche: string | null = null;

  if (p.startsWith('vid_')) {
    campaignId = p;

    // Extract embedded referral code if present: vid_<id>_<platform>_ref_<CODE>
    const refMatch = p.match(/_ref_([a-zA-Z0-9_-]+)/);
    if (refMatch) {
      referrerId = refMatch[1];
    }

    // Delimited token matching prevents false positives (e.g. 'chair', 'daily', 'email' containing 'ai')
    if (/(^|_)(ecom|ecommerce)(_|$)/i.test(p)) {
      preferredNiche = 'ecommerce';
    } else if (/(^|_)(agency|ai_automation|ai_agency)(_|$)/i.test(p)) {
      preferredNiche = 'ai_agency';
    } else if (/(^|_)(solo|solopreneur)(_|$)/i.test(p)) {
      preferredNiche = 'solopreneur';
    }
  } else if (p.startsWith('ref_')) {
    referrerId = p.slice(4);
  } else if (p.startsWith('demo_')) {
    preferredNiche = p.slice(5);
  }

  return { campaignId, referrerId, preferredNiche, isSolo100 };
}

/**
 * Handles inbound /start or viral deep-link greeting.
 */
export async function handleLeadGreeting(
  chatId: string,
  firstName = 'bạn',
  startPayload: string | null = null,
  username?: string
): Promise<void> {
  const parsed = parseStartPayload(startPayload);
  const initialScore = calculateLeadScore(startPayload, parsed.preferredNiche, null);

  await upsertLead({
    telegram_chat_id: chatId,
    first_name: firstName,
    username: username || null,
    source_utm: startPayload,
    campaign_id: parsed.campaignId,
    referrer_id: parsed.referrerId,
    niche: parsed.preferredNiche,
    qualification_score: initialScore,
    status: 'new',
  });

  const greetingText =
    `👋 *Xin chào ${firstName}! Chào mừng bạn đến với Sophia AI Factory.* 🚀\n\n` +
    `Cỗ máy tự động hóa sản xuất video ngắn viral dành riêng cho **Solopreneurs, Nhà sáng lập & E-commerce**:\n` +
    `✨ Tự động tạo 100+ video ngắn mỗi tháng (TikTok, Shorts, Reels)\n` +
    `✨ AI Avatar giống người thật 99% + Giọng đọc tiếng Việt/Anh chuẩn Studio\n` +
    `✨ Tiết kiệm 85% chi phí quay dựng truyền thống\n\n` +
    `👇 *Chọn lĩnh vực của bạn để nhận ngay Video Demo mẫu thiết kế riêng (miễn phí):*`;

  await sendTelegramMessageWithKeyboard(
    chatId,
    greetingText,
    buildNicheSelectionKeyboard()
  );
}

/**
 * Handles user selecting an industry niche.
 */
export async function handleNicheSelection(
  chatId: string,
  niche: string
): Promise<void> {
  const lead = await getLeadByChatId(chatId);
  const score = calculateLeadScore(lead?.source_utm, niche, lead?.budget_tier);

  await recordSurveyStep(chatId, {
    niche,
    qualification_score: score,
    status: 'survey_started',
  });

  const message =
    `📊 *Mục tiêu và quy mô sản xuất video hàng tháng của bạn là gì?*\n\n` +
    `Chọn mức ngân sách & tần suất sản xuất dự kiến để Sophia gợi ý gói giải pháp & tối ưu kịch bản:`;

  await sendTelegramMessageWithKeyboard(
    chatId,
    message,
    buildBudgetSelectionKeyboard()
  );
}

/**
 * Handles user selecting monthly budget & volume.
 */
export async function handleBudgetSelection(
  chatId: string,
  budgetTier: BudgetTier
): Promise<void> {
  const lead = await getLeadByChatId(chatId);
  const niche = lead?.niche || 'other';
  const score = calculateLeadScore(lead?.source_utm, niche, budgetTier);

  // Update lead in D1
  await recordSurveyStep(chatId, {
    budget_tier: budgetTier,
    qualification_score: score,
    status: 'demo_sent',
  });
  await recordDemoDelivery(chatId, 'SOLO100');

  const sampleVideo = getSampleVideoForNiche(niche);

  const caption =
    `🎬 *Video AI Mẫu cho ngành ${sampleVideo.nicheNameVi}*\n\n` +
    `⏱️ Thời gian tạo: ${sampleVideo.durationSec} giây\n` +
    `🎙️ Giọng đọc AI tự nhiên chuẩn studio tiếng Việt/Anh\n` +
    `📈 Tỷ lệ giữ chân người xem trung bình: ${sampleVideo.retentionRate}\n` +
    `💡 Chi phí truyền thống: ${sampleVideo.traditionalCost} ➔ Với Sophia: chỉ từ ${sampleVideo.sophiaCost}/video!`;

  // Attempt to deliver video natively
  const sentVideo = await sendTelegramVideo(chatId, sampleVideo.videoUrl, {
    caption,
    supports_streaming: true,
    reply_markup: buildDemoActionKeyboard(sampleVideo.videoUrl),
  });

  // Fallback to text + keyboard if sendVideo fails
  if (!sentVideo) {
    await sendTelegramMessageWithKeyboard(
      chatId,
      caption + `\n\n🔗 Xem video tại: ${sampleVideo.videoUrl}`,
      buildDemoActionKeyboard(sampleVideo.videoUrl)
    );
  }

  // Deliver SOLO100 offer promo message
  const offerText =
    `🎁 *ƯU ĐÃI ĐỘC QUYỀN: MÃ GIẢM GIÁ SOLO100*\n\n` +
    `Dành riêng cho 10 khách hàng đầu tiên tham gia thử nghiệm Cỗ máy Tăng trưởng:\n` +
    `🔥 Giảm ngay *$100/tháng* cho gói Starter ($199/tháng ➔ chỉ còn *$99/tháng* ~ 2.475.000đ)\n` +
    `🔥 Tự động sản xuất lên tới 30 video ngắn AI chất lượng 1080p/tháng\n` +
    `🔥 Kèm trọn bộ 100+ Hook Scripts viral chuyển đổi cao\n\n` +
    `Chọn phương thức thanh toán trực tiếp bên dưới để kích hoạt ngay:`;

  await sendTelegramMessageWithKeyboard(
    chatId,
    offerText,
    buildCheckoutKeyboard()
  );

  // Alert founder if qualified lead (score >= 70)
  if (score >= 70 && lead) {
    await notifyFounderLeadQualified({
      chatId,
      firstName: lead.first_name || 'Khách tiềm năng',
      username: lead.username || undefined,
      niche,
      budgetTier,
      leadScore: score,
      sourceUtm: lead.source_utm || undefined,
      campaignId: lead.campaign_id || undefined,
    });
  }
}

/**
 * Handles automated checkout trigger (NOWPayments USDT or PayOS VietQR).
 */
export async function handleCheckoutTrigger(
  chatId: string,
  provider: 'nowpayments' | 'payos',
  tier: 'BASIC' | 'PREMIUM' = 'BASIC',
  promoCode = 'SOLO100'
): Promise<void> {
  const orderId = `sophia_tg_${chatId.replace(/[^a-zA-Z0-9]/g, '')}_${Date.now()}`;
  await recordCheckoutIntent(chatId, provider, orderId);

  const discount = calculatePromoDiscount(tier, promoCode);

  if (provider === 'payos') {
    const formattedVnd = discount.finalVnd.toLocaleString('vi-VN');
    let checkoutUrl: string | undefined;

    if (FEATURE_PAYOS) {
      try {
        const payosResult = await createPayOsInvoice({
          tier,
          period: 'monthly',
          userId: `tg_${chatId}`,
          orderId,
          amountVndOverride: discount.finalVnd,
        });
        checkoutUrl = payosResult.checkoutUrl;
      } catch (err) {
        logger.warn('[qualification-service] PayOS API invoice generation failed (falling back to payment instructions)', {
          error: String(err),
          orderId,
        });
      }
    }

    const payosMessage =
      `💳 *THANH TOÁN VIETQR (PAYOS) — GÓI ${tier}*\n\n` +
      `• Gói đăng ký: *Sophia AI Factory ${tier}*\n` +
      `• Giá gốc: $199/tháng (4.975.000đ)\n` +
      `• Ưu đãi độc quyền (${promoCode}): *-$100 (Đã giảm 2.500.000đ)*\n` +
      `• Số tiền thanh toán: *${formattedVnd} VNĐ*\n` +
      `• Mã đơn hàng: \`${orderId}\`\n\n` +
      `_Nhấn nút bên dưới để mở giao diện quét mã VietQR tự động:_`;

    await sendTelegramMessageWithKeyboard(
      chatId,
      payosMessage,
      buildCheckoutKeyboard({ payosUrl: checkoutUrl })
    );
    return;
  }

  if (provider === 'nowpayments') {
    let checkoutUrl: string | undefined;

    try {
      const nowpaymentsResult = await createCheckout({
        tierId: tier,
        userId: `tg_${chatId}`,
        orderId,
        priceAmountOverride: discount.finalUsd,
      });
      checkoutUrl = nowpaymentsResult.invoiceUrl;
    } catch (err) {
      logger.warn('[qualification-service] NOWPayments createCheckout failed (falling back to direct base link)', {
        error: String(err),
        orderId,
      });
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sophia.agencyos.network';
      checkoutUrl = `${appUrl}/pricing?promo=${promoCode}&tier=${tier}`;
    }

    const nowpaymentsMessage =
      `🪙 *THANH TOÁN CRYPTO USDT (NOWPAYMENTS) — GÓI ${tier}*\n\n` +
      `• Gói đăng ký: *Sophia AI Factory ${tier}*\n` +
      `• Giá gốc: $199/tháng\n` +
      `• Ưu đãi (${promoCode}): *-$100*\n` +
      `• *Số tiền thanh toán: ${discount.finalUsd} USDT*\n` +
      `• Mạng lưới: TRC20 / BEP20 / Polygon\n` +
      `• Mã đơn hàng: \`${orderId}\`\n\n` +
      `_Nhấn nút bên dưới để chuyển đến cổng thanh toán bảo mật NOWPayments:_`;

    await sendTelegramMessageWithKeyboard(
      chatId,
      nowpaymentsMessage,
      buildCheckoutKeyboard({ nowpaymentsUrl: checkoutUrl })
    );
  }
}

/**
 * Handles interactive qualification callback queries from inline keyboards.
 */
export async function handleQualificationCallback(
  chatId: string,
  callbackData: string
): Promise<void> {
  // 1. Niche selection
  if (callbackData.startsWith('lead_niche:')) {
    const niche = callbackData.replace('lead_niche:', '');
    await handleNicheSelection(chatId, niche);
    return;
  }

  // 2. Budget selection
  if (callbackData.startsWith('lead_budget:')) {
    const budget = callbackData.replace('lead_budget:', '') as BudgetTier;
    await handleBudgetSelection(chatId, budget);
    return;
  }

  // 3. Direct checkout payment trigger
  // Format: checkout_pay:<provider>:<tier>:<promo>
  if (callbackData.startsWith('checkout_pay:')) {
    const parts = callbackData.split(':');
    const provider = (parts[1] || 'payos') as 'nowpayments' | 'payos';
    const tier = (parts[2] || 'BASIC') as 'BASIC' | 'PREMIUM';
    const promo = parts[3] || 'SOLO100';
    await handleCheckoutTrigger(chatId, provider, tier, promo);
    return;
  }

  // 4. Action callbacks
  if (callbackData === 'lead_action:start_survey') {
    await sendTelegramMessageWithKeyboard(
      chatId,
      '🎯 *Chọn lĩnh vực của bạn để nhận mẫu video phù hợp:*',
      buildNicheSelectionKeyboard()
    );
    return;
  }

  if (callbackData === 'lead_action:watch_demo') {
    const lead = await getLeadByChatId(chatId);
    const niche = lead?.niche || 'other';
    const sample = getSampleVideoForNiche(niche);

    await sendTelegramVideo(chatId, sample.videoUrl, {
      caption: `🎬 *Video AI Mẫu (${sample.nicheNameVi})*\n\n${sample.descriptionVi}`,
      supports_streaming: true,
      reply_markup: buildDemoActionKeyboard(sample.videoUrl),
    });
    return;
  }

  if (callbackData === 'lead_action:get_starter') {
    await handleCheckoutTrigger(chatId, 'payos', 'BASIC', 'SOLO100');
    return;
  }

  if (callbackData === 'lead_action:chat_founder') {
    await sendTelegramMessage(
      chatId,
      `💬 Bạn có thể nhắn tin trực tiếp với Founder Minh Long tại: https://t.me/minhlongdo\n\nSophia luôn sẵn sàng hỗ trợ bạn 24/7!`
    );
  }
}
