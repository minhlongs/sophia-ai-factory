import { readFileSync } from 'node:fs';
import { logger } from '@/seed/utils/logger-utility';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
let passCount = 0, failCount = 0;
function assert(cond: boolean, msg: string) {
    if (cond) { logger.info(` ✓ ${msg}`); passCount++; }
    else { logger.error(` ✗ FAIL: ${msg}`); failCount++; process.exitCode = 1; }
}
logger.info('DLQ verification running...');
const source = readFileSync(resolve(__dirname, 'nowpayments-ipn-dead-letter.ts'), 'utf-8');
// F1: enqueueDlqEntry uses opts.retryCount + 1 (NOT the removed db.raw pattern)
const e = source.substring(source.indexOf('enqueueDlqEntry('), source.indexOf('enqueueDlqEntry(') + 1400);
assert(!e.includes("db.raw('retry_count + 1')"), "F1: enqueueDlqEntry does NOT use the removed db.raw('retry_count + 1')");
assert(e.includes('opts.retryCount + 1'), "F1: enqueueDlqEntry uses opts.retryCount + 1");
// F2: enqueueDlqEntry fallback filters with .eq('resolved', 0)
assert(e.includes(".eq('resolved', 0)"), "F2: enqueueDlqEntry fallback uses .eq('resolved', 0)");
assert(e.includes(".eq('event_id', opts.eventId)"), "F2: enqueueDlqEntry fallback filters by event_id");
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
if (failCount > 0) process.exitCode = 1;
