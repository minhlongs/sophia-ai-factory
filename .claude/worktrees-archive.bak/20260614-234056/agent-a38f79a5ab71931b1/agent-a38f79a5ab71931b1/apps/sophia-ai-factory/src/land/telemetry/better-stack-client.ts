/**
 * Better Stack client — direct fetch, no SDK (CF Workers compatible).
 * pushBatch: ships log payloads to Logtail HTTPS endpoint.
 * pushHeartbeat: pings a Better Stack heartbeat URL to confirm cron ran.
 * pushFatalLog: emergency path when D1 is unavailable (RED-TEAM #5).
 */

import type { SafeLogPayload } from './safe-log';

const DEFAULT_INGESTING_HOST = 'https://in.logtail.com/';

export interface BetterStackConfig {
  logsToken: string;
  ingestingHost?: string;
  heartbeatUrl?: string;
}

/**
 * Ship a batch of log payloads to Better Stack Logtail.
 * Single HTTP POST with JSON array body — 1 subrequest total.
 * Best-effort: swallows network errors to never block caller.
 */
export async function pushBatch(
  payloads: SafeLogPayload[],
  config: BetterStackConfig
): Promise<void> {
  if (!payloads.length || !config.logsToken) return;

  const host = config.ingestingHost ?? DEFAULT_INGESTING_HOST;
  try {
    await fetch(host, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.logsToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payloads),
    });
  } catch {
    // Swallow — logging must never break the request path
  }
}

/**
 * Ping a Better Stack heartbeat URL to confirm a cron ran successfully.
 * Silence (missed ping) triggers Better Stack missed-heartbeat alert.
 */
export async function pushHeartbeat(heartbeatUrl: string): Promise<void> {
  if (!heartbeatUrl) return;
  try {
    await fetch(heartbeatUrl, { method: 'POST' });
  } catch {
    // Best-effort; missed ping = alert fires naturally
  }
}

/**
 * Emergency path: push a single fatal log directly to Better Stack.
 * Used when D1 is unavailable and normal buffered path cannot be used.
 * RED-TEAM #5: D1 blind spot self-monitoring.
 */
export async function pushFatalLog(
  msg: string,
  err: string,
  config: BetterStackConfig
): Promise<void> {
  if (!config.logsToken) return;
  const host = config.ingestingHost ?? DEFAULT_INGESTING_HOST;
  const payload = [{
    ts: Date.now(),
    level: 'fatal',
    msg,
    err,
  }];
  try {
    await fetch(host, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.logsToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch {
    // Last resort; if this fails, wrangler tail is the backup
  }
}
