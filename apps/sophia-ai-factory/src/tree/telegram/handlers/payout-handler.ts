/**
 * Telegram Payout Command Handler
 * Displays executive financial metrics: unencumbered balance, pending payouts, payout methods.
 *
 * Layer: tree/telegram/handlers | Max LOC: < 160 | Zero :any
 */
import { sendMessage } from './utils';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';

/**
 * Handles the /payout command for authorized creators/CEOs
 */
export async function handlePayout(chatId: string): Promise<void> {
  const db = await getD1();
  if (!db) {
    await sendMessage(
      chatId,
      '⚠️ Database connection temporarily unavailable. Please try again later.\n\n' +
      '⚠️ Kết nối cơ sở dữ liệu tạm thời gián đoạn. Vui lòng thử lại sau.'
    );
    return;
  }
  try {
    // Look up associated user ID from paired chats table
    const pairedChat = await db
      .prepare('SELECT paired_by FROM telegram_paired_chats WHERE chat_id = ? LIMIT 1')
      .bind(chatId)
      .first<{ paired_by?: string }>();
    const userId = pairedChat?.paired_by || 'usr_default';

    // Query creator profile
    const profile = await db
      .prepare(
        `SELECT total_earnings_cents, total_paid_cents
         FROM creator_profiles
         WHERE id = ? OR user_id = ?
         LIMIT 1`
      )
      .bind(userId, userId)
      .first<{ total_earnings_cents?: number; total_paid_cents?: number }>();

    const totalEarningsCents = profile?.total_earnings_cents ?? 0;
    const totalPaidCents = profile?.total_paid_cents ?? 0;
    const availableCents = Math.max(0, totalEarningsCents - totalPaidCents);

    // Query pending withdrawals
    const pendingRow = await db
      .prepare(
        `SELECT COALESCE(SUM(amount_cents), 0) as locked_cents
         FROM creator_withdrawal_requests
         WHERE creator_id = ? AND status IN ('pending', 'processing')`
      )
      .bind(userId)
      .first<{ locked_cents?: number }>();

    const lockedCents = pendingRow?.locked_cents ?? 0;
    const unencumberedCents = Math.max(0, availableCents - lockedCents);

    const availableFormatted = ((unencumberedCents || 0) / 100).toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
    });
    const pendingFormatted = ((lockedCents || 0) / 100).toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
    });
    const totalFormatted = ((totalEarningsCents || 0) / 100).toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
    });

    const message =
      `💼 *SOPHIA CREATOR PAYOUT DESK*\n\n` +
      `💵 *Available for Withdrawal:* \`${availableFormatted}\`\n` +
      `⏳ *Pending Processing:* \`${pendingFormatted}\`\n` +
      `📈 *Lifetime Accumulated:* \`${totalFormatted}\`\n\n` +
      `💳 *Settlement Rails:*\n` +
      `• Domestic: *VietQR Instant 24/7* (0% fee)\n` +
      `• Global: *USDT TRC20 / ERC20* (Instant On-Chain)\n\n` +
      `_To request a withdrawal, visit your Creator Portal at sophia.agencyos.network or use the Web App._\n\n` +
      `🇻🇳 *TỔNG QUAN THU NHẬP CREATOR*\n` +
      `• Số dư khả dụng: \`${availableFormatted}\`\n` +
      `• Đang xử lý: \`${pendingFormatted}\`\n` +
      `• Phương thức: VietQR hoặc USDT`;
    await sendMessage(chatId, message);
  } catch (error) {
    logger.error('Error executing /payout command in Telegram', { chatId, error: String(error) });
    await sendMessage(
      chatId,
      '❌ Failed to retrieve payout metrics. Please try again later.\n\n' +
      '❌ Không thể tải thông tin thanh toán. Vui lòng thử lại sau.'
    );
  }
}
