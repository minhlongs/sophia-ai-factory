/**
 * Telegram Sales Survey & Step Flow
 * Layer: land/telegram-sales
 */

import type { BudgetTier } from '@/seed/types/telegram-sales';
import {
  sendTelegramMessageWithKeyboard,
  sendTelegramVideo,
} from '@/tree/telegram/telegram-client';
import { notifyFounderLeadQualified } from '@/tree/telegram/telegram-admin-notifier';
import {
  buildNicheSelectionKeyboard,
  buildBudgetSelectionKeyboard,
  buildDemoActionKeyboard,
  buildCheckoutKeyboard,
} from '@/tree/telegram/telegram-lead-keyboards';
import {
  upsertLead,
  getLeadByChatId,
  recordSurveyStep,
  recordDemoDelivery,
} from '../telegram-lead-repo';
import { getSampleVideoForNiche } from '../sample-video-catalog';
import { calculateLeadScore, parseStartPayload } from './lead-scorer';

/**
 * Handles inbound /start or viral deep-link greeting.
 */
export async function handleLeadGreeting(
  chatId: string,
  firstName = 'bạn',
  startPayload: string | null = null,
  username?: string,
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
    buildNicheSelectionKeyboard(),
  );
}

/**
 * Handles user selecting an industry niche.
 */
export async function handleNicheSelection(chatId: string, niche: string): Promise<void> {
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
    buildBudgetSelectionKeyboard(),
  );
}

/**
 * Handles user selecting monthly budget & volume.
 */
export async function handleBudgetSelection(
  chatId: string,
  budgetTier: BudgetTier,
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

  const sentVideo = await sendTelegramVideo(chatId, sampleVideo.videoUrl, {
    caption,
    supports_streaming: true,
    reply_markup: buildDemoActionKeyboard(sampleVideo.videoUrl),
  });

  if (!sentVideo) {
    await sendTelegramMessageWithKeyboard(
      chatId,
      caption + `\n\n🔗 Xem video tại: ${sampleVideo.videoUrl}`,
      buildDemoActionKeyboard(sampleVideo.videoUrl),
    );
  }

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
    buildCheckoutKeyboard(),
  );

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
