/**
 * Telegram bot harness command handler
 *
 * Handles /harness command — triggers a system health check job
 * and reports status back to the Telegram chat.
 */

import { sendTelegramMessage } from '@/tree/telegram/telegram-client';
import { handleHarnessStatus } from './telegram-bot-harness-status';

export { handleHarnessStatus };

const TARGET_HOST = process.env.NEXT_PUBLIC_APP_URL || process.env.HARNESS_TARGET_HOST || 'https://sophia.eco';

/**
 * /harness — Trigger a new harness health check job
 */
export async function handleHarness(chatId: string) {
  try {
    await sendTelegramMessage(chatId, '⚙️ *Harness Check* — Đang tạo job kiểm tra hệ thống...');

    const harnessSecret = process.env.HARNESS_SECRET || process.env.CRON_SECRET || 'dev-harness-secret';

    const res = await fetch(`${TARGET_HOST}/api/v1/harness/trigger`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-harness-secret': harnessSecret,
      },
      body: JSON.stringify({ triggered_by: 'telegram' }),
    });

    if (!res.ok) {
      const errText = await res.text();
      await sendTelegramMessage(
        chatId,
        `❌ Không thể tạo harness job: ${res.status} ${errText.substring(0, 200)}`
      );
      return;
    }

    const data = await res.json() as { success: boolean; id: string; status: string };

    if (!data.success) {
      await sendTelegramMessage(chatId, '❌ Harness trigger thất bại. Vui lòng thử lại.');
      return;
    }

    await sendTelegramMessage(
      chatId,
      `✅ *Harness Job Created*\n\n` +
      `• Job ID: \`${data.id.substring(0, 8)}…\`\n` +
      `• Status: \`${data.status}\`\n` +
      `• Triggered by: Telegram\n\n` +
      `🔄 Daemon sẽ tự động xử lý job này. Gõ /harness\\_status để xem kết quả.`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await sendTelegramMessage(
      chatId,
      `❌ Lỗi khi tạo harness job: ${message.substring(0, 200)}`
    );
  }
}
