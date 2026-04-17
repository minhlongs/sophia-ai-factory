/**
 * Error tracker — fingerprints errors and persists to D1 error_log table.
 * RED-TEAM #2: fingerprint = sha256(normalizedMsg + ':' + errorClass), never raw stack.
 * RED-TEAM #5: D1 failure path pushes fatal log directly to Better Stack.
 */

import { scrubPIIDeep } from './pii-scrubber';
import { logger } from './logger';
import { pushFatalLog } from './better-stack-client';

export interface ErrorContext {
  route?: string;
  userId?: string;
  [key: string]: unknown;
}

/** Normalize error message: lowercase, trim, collapse whitespace */
function normalizeMsg(msg: string): string {
  return msg.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Compute SHA-256 fingerprint of normalized message + error class.
 * Uses crypto.subtle (available in CF Workers and modern runtimes).
 */
export async function fingerprintError(
  err: Error
): Promise<string> {
  const raw = normalizeMsg(err.message) + ':' + err.constructor.name;
  const encoded = new TextEncoder().encode(raw);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

interface D1Env {
  DB: {
    prepare: (sql: string) => {
      bind: (...args: unknown[]) => {
        run: () => Promise<unknown>;
      };
    };
  };
  BETTER_STACK_LOGS_TOKEN?: string;
  BETTER_STACK_INGESTING_HOST?: string;
  COMMIT_SHA?: string;
}

/**
 * Report an error: fingerprint it, log via safeLog, insert into error_log.
 * On D1 failure, push fatal log directly to Better Stack (RED-TEAM #5).
 */
export async function reportError(
  err: Error,
  ctx: ErrorContext,
  env?: D1Env
): Promise<void> {
  const fingerprint = await fingerprintError(err);
  const safeCtx = scrubPIIDeep(ctx) as Record<string, unknown>;
  const msgClass = err.constructor.name;

  logger.error(`[error-tracker] ${err.message}`, {
    fingerprint,
    msgClass,
    route: ctx.route ?? 'unknown',
    ...safeCtx,
  });

  if (!env?.DB) return;

  const ts = new Date().toISOString();
  const commit = env.COMMIT_SHA ?? 'unknown';
  const ctxJson = JSON.stringify(safeCtx);
  // Scrub message before storing — no raw stacks
  const safeMsg = normalizeMsg(err.message).slice(0, 500);

  try {
    await env.DB.prepare(
      `INSERT INTO error_log (ts, level, msg, msg_class, fingerprint, ctx_json, commit_sha, route, status)
       VALUES (?, 'error', ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(ts, safeMsg, msgClass, fingerprint, ctxJson, commit, ctx.route ?? '', 500)
      .run();
  } catch (d1Err) {
    const errMsg = d1Err instanceof Error ? d1Err.message : String(d1Err);
    // RED-TEAM #5: D1 unavailable — push directly to Better Stack, skip normal path
    await pushFatalLog('D1_UNAVAILABLE', errMsg, {
      logsToken: env.BETTER_STACK_LOGS_TOKEN ?? '',
      ingestingHost: env.BETTER_STACK_INGESTING_HOST,
    });
  }
}
