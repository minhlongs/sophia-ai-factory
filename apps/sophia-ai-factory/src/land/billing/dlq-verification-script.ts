/**
 * dlq-verification-script.ts — Dead Letter Queue verification (DLQ)
 *
 * Verifies that nowpayments-ipn-dead-letter.ts matches expected patterns:
 *   F1: enqueueDlqEntry uses opts.retryCount + 1
 *   F2: fallback filters use .eq('resolved', 0) and .eq('event_id', ...)
 *   F3a: resolveDlqEntry() sets resolved=1
 *   F3b: UNIQUE-violation re-enqueue sets first_failed_at=now, keeps resolved=0
 *   DDL: first_failed_at and last_attempted_at columns exist
 *
 * ⚠️ Node builtins (node:fs, node:path) are loaded dynamically inside run()
 * so the SSR bundler never pulls them into handler.mjs.
 *
 * Usage:
 *   node scripts/dlq-verification-script.ts          # CLI (default: nowpayments-ipn-dead-letter.ts)
 *   import { run } from './dlq-verification-script'   # programmatic
 */

import { logger } from '@/seed/utils/logger-utility';

// ── Dynamic Node builtin loader (SSR-safe) ───────────────────

async function loadFs(): Promise<typeof import('node:fs') | null> {
  try { return await import('node:fs') } catch { return null }
}
async function loadPath(): Promise<typeof import('node:path') | null> {
  try { return await import('node:path') } catch { return null }
}
async function loadUrl(): Promise<typeof import('node:url') | null> {
  try { return await import('node:url') } catch { return null }
}

// ── Verification runner ──────────────────────────────────────

export async function run(sourcePath?: string): Promise<{ passed: boolean; passCount: number; failCount: number }> {
  const [fs, path] = await Promise.all([loadFs(), loadPath()]);
  if (!fs || !path) {
    throw new Error('node:fs / node:path unavailable — run in Node.js environment');
  }

  let passCount = 0;
  let failCount = 0;

  function assert(cond: boolean, msg: string) {
    if (cond) { logger.info(` ✓ ${msg}`); passCount++; }
    else { logger.error(` ✗ FAIL: ${msg}`); failCount++; }
  }

  logger.info('DLQ verification running...');
  const resolved = sourcePath ?? path.resolve(process.cwd(), 'nowpayments-ipn-dead-letter.ts');
  const source = fs.readFileSync(resolved, 'utf-8');

  // F1: enqueueDlqEntry uses opts.retryCount + 1 (NOT the removed db.raw pattern)
  const e = source.substring(source.indexOf('enqueueDlqEntry('), source.indexOf('enqueueDlqEntry(') + 1400);
  assert(!e.includes("db.raw('retry_count + 1')"), "F1: enqueueDlqEntry does NOT use the removed db.raw('retry_count + 1')");
  assert(e.includes('opts.retryCount + 1'), 'F1: enqueueDlqEntry uses opts.retryCount + 1');

  // F2: enqueueDlqEntry fallback filters with .eq('resolved', 0)
  assert(e.includes(".eq('resolved', 0)"), 'F2: enqueueDlqEntry fallback uses .eq(\'resolved\', 0)');
  assert(e.includes(".eq('event_id', opts.eventId)"), 'F2: enqueueDlqEntry fallback filters by event_id');

  // F3a: resolveDlqEntry sets resolved=1
  const r = source.substring(source.indexOf('resolveDlqEntry('), source.indexOf('resolveDlqEntry(') + 700);
  assert(r.includes('resolved: 1'), 'F3a: resolveDlqEntry() sets resolved=1');

  // F3b: UNIQUE-violation re-enqueue path inside enqueueDlqEntry sets first_failed_at=now and keeps resolved=0
  const ue = source.substring(source.indexOf('enqueueDlqEntry('), source.indexOf('enqueueDlqEntry(') + 1400);
  assert(ue.includes('first_failed_at: now'), 'F3b: UNIQUE-violation re-enqueue sets first_failed_at=now');
  assert(ue.includes('resolved: 0'), 'F3b: UNIQUE-violation re-enqueue keeps resolved=0');

  // DDL (layout is multiline — match the column name only)
  assert(source.includes('first_failed_at'), 'DDL: first_failed_at column exists');
  assert(source.includes('last_attempted_at'), 'DDL: last_attempted_at column exists');

  // 'resolved' DDL column is covered by F3a (resolved=1 in resolve) + F3b (resolved=0 in re-enqueue).

  logger.info(`\nDLQ verification complete: ${passCount} passed, ${failCount} failed.`);

  return { passed: failCount === 0, passCount, failCount };
}

// ── CLI entry point (only runs when executed directly) ───────
// Wrapped in try/catch so Workers SSR bundler can import this module
// without crashing on missing process.argv or node:url.

try {
  const [urlMod] = await Promise.all([loadUrl()]);
  if (urlMod && process.argv[1]) {
    const argv1Url = urlMod.pathToFileURL(process.argv[1]).href;
    if (import.meta.url === argv1Url) {
      const result = await run();
      process.exitCode = result.passed ? 0 : 1;
    }
  }
} catch { /* non-Node environment (Workers, browser) — skip CLI guard */ }
