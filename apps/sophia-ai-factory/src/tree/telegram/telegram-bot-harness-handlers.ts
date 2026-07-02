/**
 * Telegram bot harness command handler
 *
 * Handles /harness command — triggers a system health check job
 * and reports status back to the Telegram chat.
 */

import { sendTelegramMessage } from '@/tree/telegram/telegram-client';
import { getD1Raw } from '@/seed/db/client';

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

/**
 * /harness_status — Show latest harness job status and results
 */
export async function handleHarnessStatus(chatId: string) {
  try {
    const db = await getD1Raw();

    // Get latest job
    const latestJob = await db.prepare(
      "SELECT id, status, triggered_by, created_at, updated_at FROM harness_jobs ORDER BY created_at DESC LIMIT 1"
    ).first<{ id: string; status: string; triggered_by: string; created_at: string; updated_at: string }>();

    if (!latestJob) {
      await sendTelegramMessage(chatId, '📋 Chưa có harness job nào. Gõ /harness để bắt đầu.');
      return;
    }

    // Get results for latest job
    const resultsQuery = await db.prepare(
      "SELECT test_name, status, duration_ms, error_message FROM harness_results WHERE job_id = ?"
    ).bind(latestJob.id).all<{
      test_name: string;
      status: string;
      duration_ms: number;
      error_message: string | null;
    }>();

    const results = resultsQuery.results || [];

    const statusEmoji: Record<string, string> = {
      pending: '⏳',
      processing: '🔄',
      completed: '✅',
      failed: '❌',
    };

    const testNames: Record<string, string> = {
      d1_ping: 'D1 Database',
      r2_storage: 'R2 Storage',
      api_openrouter: 'OpenRouter API',
      api_elevenlabs: 'ElevenLabs API',
      api_heygen: 'HeyGen API',
      remotion_render: 'Remotion Render',
    };

    let msg = `${statusEmoji[latestJob.status] || '❓'} *Harness Status*\n\n`;
    msg += `• Job: \`${latestJob.id.substring(0, 8)}…\`\n`;
    msg += `• Status: *${latestJob.status.toUpperCase()}*\n`;
    msg += `• Triggered: ${latestJob.triggered_by}\n`;
    msg += `• Created: ${latestJob.created_at}\n`;

    if (results.length > 0) {
      msg += `\n*Test Results:*\n`;
      for (const r of results) {
        const icon = r.status === 'success' ? '✅' : '❌';
        const name = testNames[r.test_name] || r.test_name;
        msg += `${icon} ${name} — ${r.duration_ms}ms`;
        if (r.error_message) {
          msg += `\n   _${r.error_message.substring(0, 100)}_`;
        }
        msg += '\n';
      }

      const passed = results.filter(r => r.status === 'success').length;
      const total = results.length;
      msg += `\n📊 Score: ${passed}/${total}`;
    } else if (latestJob.status === 'pending' || latestJob.status === 'processing') {
      msg += '\n⏳ Đang chờ daemon xử lý...';
    }

    await sendTelegramMessage(chatId, msg);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await sendTelegramMessage(
      chatId,
      `❌ Lỗi khi lấy harness status: ${message.substring(0, 200)}`
    );
  }
}
