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
import {
  NICHE_VIDEO_HELP_MESSAGE,
  formatNicheDispatchedMessage,
  parseNicheVideoCommand,
  type NicheTelegramCommandResult,
} from '@/tree/telegram/niche-video-command-parser';

export { parseNicheVideoCommand };
export type { NicheTelegramCommandResult };

export async function handleNicheVideoTelegramCommand(
  chatId: string,
  command: string,
  args: string,
  userId: string = 'telegram_user',
): Promise<NicheTelegramCommandResult> {
  if (!args || args.trim().length === 0) {
    await sendTelegramMessage(chatId, NICHE_VIDEO_HELP_MESSAGE);
    return { ok: false, error: 'MISSING_ARGUMENTS' };
  }

  const { niche, blueprintId, productName, productUrl } = parseNicheVideoCommand(command, args);

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

    await sendTelegramMessage(
      chatId,
      formatNicheDispatchedMessage(niche, productName, productUrl),
    );

    return { ok: true, niche, productName };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error('handleNicheVideoTelegramCommand: dispatch failed', { error: errorMsg });
    await sendTelegramMessage(chatId, `❌ Lỗi khi khởi tạo video: ${errorMsg}`);
    return { ok: false, error: errorMsg };
  }
}
