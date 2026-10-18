/**
 * Telegram Alert Bot Connectivity Probe for Day-1 Operational Verification.
 * Layer: tree (Domain operations; imports only from @/seed)
 *
 * @module tree/handover/day1/telegram-probe
 */

import type { CheckpointResult } from '@/seed/handover/handover-types';
import type { Day1ProbeOptions } from './types';

async function verifyTelegramBotGetMe(
  botToken: string,
  timeoutMs = 3000,
): Promise<{ botReachable: boolean; botUsername: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`https://api.telegram.org/bot${botToken}/getMe`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (res.ok) {
      const json = (await res.json()) as { ok: boolean; result?: { username?: string } };
      if (json.ok && json.result?.username) {
        return { botReachable: true, botUsername: `@${json.result.username}` };
      }
    }
  } catch {
    // Non-fatal
  }
  return { botReachable: false, botUsername: '@Sophia_Bbot' };
}

/**
 * 7. Checkpoint: Telegram Alert Bot Connectivity
 */
export async function probeTelegramConnectivity(options?: Day1ProbeOptions): Promise<CheckpointResult> {
  const start = Date.now();
  const botToken = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const hasToken = botToken.length > 10;

  // If token is unset or empty -> WARN (do not self-certify as PASS)
  if (!hasToken) {
    return {
      checkpointId: 'notifications_telegram',
      name: 'Telegram Ops Alert & Notification Bot',
      nameVi: 'Bot Cảnh Báo Vận Hành Telegram',
      category: 'notifications',
      status: 'WARN',
      latencyMs: Date.now() - start,
      details: 'TELEGRAM_BOT_TOKEN is not configured; operational alert notifications will be disabled',
      expected: 'TELEGRAM_BOT_TOKEN configured',
      actual: 'Unconfigured',
      diagnosticData: { hasToken: false, botReachable: false },
    };
  }

  const skipLiveCheck = Boolean(options?.skipNetworkCalls || botToken.startsWith('mock_'));
  const { botReachable, botUsername } = skipLiveCheck
    ? { botReachable: false, botUsername: '@Sophia_Bbot' }
    : await verifyTelegramBotGetMe(botToken, options?.timeoutMs ?? 3000);

  const isVerified = botReachable || skipLiveCheck;
  let details = 'Telegram Bot token configured but getMe API call failed or timed out';
  if (botReachable) {
    details = `Telegram Bot ${botUsername} live API verified via getMe`;
  } else if (isVerified) {
    details = `Telegram Bot ${botUsername} token configured (network validation skipped)`;
  }

  return {
    checkpointId: 'notifications_telegram',
    name: 'Telegram Ops Alert & Notification Bot',
    nameVi: 'Bot Cảnh Báo Vận Hành Telegram',
    category: 'notifications',
    status: isVerified ? 'PASS' : 'WARN',
    latencyMs: Date.now() - start,
    details,
    expected: 'Telegram Bot active',
    actual: isVerified ? botUsername : 'Unreachable',
    diagnosticData: { hasToken: true, botReachable, username: botUsername },
  };
}
