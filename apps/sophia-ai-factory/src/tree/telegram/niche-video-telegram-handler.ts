/**
 * Niche Video Telegram Handler
 *
 * Dispatches high-converting SaaS & Crypto affiliate video generation workflows
 * directly from Telegram Bot commands (/niche_video, /saas_video, /crypto_video).
 * Layer: tree (domain reusable logic)
 * @module tree/telegram/niche-video-telegram-handler
 */

import { inngest } from '@/seed/inngest/client';
import { logger } from '@/seed/utils/logger-utility';
import { sendTelegramMessage } from '@/tree/telegram/telegram-client';
import { evaluateJurisdictionCompliance } from '@/tree/video/compliance/jurisdiction-compliance-guard';

export interface NicheTelegramCommandResult {
  ok: boolean;
  niche?: 'saas_global' | 'crypto_global';
  productName?: string;
  error?: string;
}

const CRYPTO_KEYWORDS = ['binance', 'bybit', 'okx', 'coinbase', 'crypto', 'bitcoin', 'trade', 'futures'];

export function parseNicheVideoCommand(
  command: string,
  args: string,
): {
  niche: 'saas_global' | 'crypto_global';
  blueprintId: string;
  productName: string;
  productUrl: string;
} {
  const trimmed = args.trim();
  const lower = trimmed.toLowerCase();

  let isCrypto = command === '/crypto_video';
  if (!isCrypto && command === '/niche_video') {
    isCrypto = CRYPTO_KEYWORDS.some((kw) => lower.includes(kw));
  }

  const niche = isCrypto ? 'crypto_global' : 'saas_global';
  const blueprintId = isCrypto
    ? 'crypto_fee_discount_signup_bonus'
    : 'saas_problem_agitation_solution';

  let productUrl = trimmed;
  let productName = trimmed;

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const parsed = new URL(trimmed);
      productName = parsed.hostname.replace(/^www\./, '').split('.')[0];
      productName = productName.charAt(0).toUpperCase() + productName.slice(1);
    } catch {
      productName = trimmed;
    }
  } else {
    productUrl = `https://${trimmed.toLowerCase().replace(/\s+/g, '')}.com`;
  }

  return { niche, blueprintId, productName, productUrl };
}

export async function handleNicheVideoTelegramCommand(
  chatId: string,
  command: string,
  args: string,
  userId: string = 'telegram_user',
): Promise<NicheTelegramCommandResult> {
  if (!args || args.trim().length === 0) {
    await sendTelegramMessage(
      chatId,
      '🎬 *Hướng dẫn tạo Video Chuyển Đổi Cao:*\n\n' +
      '• `/saas_video <tên hoặc link>`: Tạo video SaaS MRR 20-40%\n' +
      '• `/crypto_video <sàn hoặc link>`: Tạo video Crypto Fee Rebate + Bonus\n' +
      '• `/niche_video <link>`: Tự động phân tích sản phẩm và tạo video\n\n' +
      'Ví dụ: `/saas_video linear.app` hoặc `/crypto_video binance.com`',
    );
    return { ok: false, error: 'MISSING_ARGUMENTS' };
  }

  const { niche, blueprintId, productName, productUrl } = parseNicheVideoCommand(command, args);

  // Quick jurisdiction compliance pre-check (Crypto is banned in VN)
  const compliance = evaluateJurisdictionCompliance(niche, 'GLOBAL');
  if (!compliance.isAllowed) {
    const errorMsg = `⚠️ Không thể tạo video: ${compliance.regulatoryRef || compliance.reason}`;
    await sendTelegramMessage(chatId, errorMsg);
    return { ok: false, error: compliance.reason };
  }

  logger.info('handleNicheVideoTelegramCommand: dispatching campaign', {
    chatId,
    niche,
    productName,
    blueprintId,
  });

  try {
    await inngest.send({
      name: 'niche.video.campaign.requested',
      data: {
        userId,
        niche,
        blueprintId,
        productName,
        productUrl,
        jurisdiction: 'GLOBAL',
        affiliateCode: 'SOPHIA_VIP',
        subId: `tg_${chatId}`,
        locale: 'vi',
      },
    });

    const nicheLabel = niche === 'crypto_global' ? '🪙 Crypto Global (Fee Discount)' : '🚀 SaaS Global (Recurring MRR)';
    const complianceBadge = niche === 'crypto_global' ? '⚖️ MiCA & SEC 15s End-Card' : '⚖️ FTC 16 C.F.R. § 255';

    await sendTelegramMessage(
      chatId,
      `✅ *Khởi tạo Video Chiến dịch Thành Công!*\n\n` +
      `📦 *Sản phẩm:* \`${productName}\`\n` +
      `🏷️ *Phân khúc:* ${nicheLabel}\n` +
      `🛡️ *Tuân thủ:* ${complianceBadge}\n` +
      `📊 *Tracking:* \`${productUrl}\`\n\n` +
      `⏳ Hệ thống đang sinh kịch bản chi tiết, tạo voiceover ElevenLabs và xuất manifest render 9:16.\n` +
      `Gõ /status để kiểm tra tiến độ.`,
    );

    return { ok: true, niche, productName };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error('handleNicheVideoTelegramCommand: dispatch failed', { error: errorMsg });
    await sendTelegramMessage(chatId, `❌ Lỗi khi khởi tạo video: ${errorMsg}`);
    return { ok: false, error: errorMsg };
  }
}
