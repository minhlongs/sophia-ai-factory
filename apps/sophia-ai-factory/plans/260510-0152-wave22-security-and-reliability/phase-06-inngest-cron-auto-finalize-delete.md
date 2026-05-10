---
phase: 06
title: "Inngest cron auto-finalize delete after cooldown elapsed"
priority: P2/MED/UX
status: complete
effort_estimate: 3h
effort_actual: ~45m
completed: 2026-05-10
dependencies: [05]
---

# Phase 06 — Inngest Cron Auto-Finalize Delete

## Context Links

- Wave 21 P02 design gap (carryover): `plans/260510-0115-wave21-hardening-and-docs/phase-02-account-self-delete.md` line 60–62 (note: "No Inngest cron — actual delete happens on-demand when user re-confirms after 7d. Wave 22 may add automated finalize.")
- Existing cascade DELETE_ORDER: `src/app/api/account/route.ts` lines 22–35
- Cooldown table: `migrations/0102-account-deletion-cooldown.sql`
- Reference cron pattern: `src/forest/inngest/functions/auto-discover-affiliates.ts` (`cron: "0 8 * * *"`)
- Phase 05 audit informs `retries:` choice for this function

## Goal

Add Inngest cron job that runs every 6 hours, scans `account_deletion_requests` for elapsed-and-confirmed-and-not-cancelled rows, executes the same cascade delete the manual `DELETE /api/account` performs. Removes user friction (no need for second confirmation click after 7 days) while preserving the cooldown safety window.

## Key Insights

1. **Reuse cascade DELETE_ORDER** from `/api/account/route.ts:22-35` — DRY: extract to a shared land/account utility.
2. **Per-user idempotency** — cron may rescan unfinished rows (e.g., one previous run errored after deleting 3 of 11 tables). Re-running cascade is naturally idempotent (each `DELETE WHERE tenant_id=?` returns 0 rows on re-run).
3. **Cron frequency tradeoff** — every 6h: 4 invocations/day × ~zero rows usually = cheap. Every 1h would be needlessly chatty. Every 24h would extend max delay to 8 days for a 7-day cooldown.
4. **Layer placement** — cron lives in `forest/inngest/functions/` (orchestrator), cascade logic in `land/account/cascade-delete.ts` (business workflow). Forest → Land orchestration permitted per `cross-layer-orchestration.md`.
5. **Notification email** (optional, recommended): inform user after auto-finalize completes. Reuses bilingual template (post-Phase 07 ideally; but may inline for now and refactor later).

## Architecture

```
Cron schedule: 0 */6 * * *  (every 6 hours, UTC)
   ↓
fetch-pending: SELECT user_id, tenant_id FROM account_deletion_requests
                WHERE confirmed_at IS NOT NULL
                  AND cancelled_at IS NULL
                  AND scheduled_at <= unixepoch()
                LIMIT 50
   ↓
for each row:
  step: "cascade-delete-${userId}"
    → cascadeDeleteAccount(db, userId, tenantId)  ← extracted util
    → DELETE FROM account_deletion_requests WHERE user_id = ?
  step: "notify-${userId}" (optional)
    → sendEmail (best-effort; failure logged not retried)
   ↓
return { processed: N, deleted: totalRows }
```

Layer placement:
- `forest/inngest/functions/account-delete-finalize-cron.ts` — Inngest function definition
- `land/account/cascade-delete.ts` — Pure cascade logic (extracted from `/api/account/route.ts`)
- `land/account/index.ts` — Barrel export
- `app/api/account/route.ts` — Refactored to call the extracted util (DRY)

## Files to Create

| File | Purpose |
|---|---|
| `src/land/account/cascade-delete.ts` | `cascadeDeleteAccount(db, userId, tenantId): Promise<{deleted, byTable}>` |
| `src/land/account/index.ts` | `export { cascadeDeleteAccount } from './cascade-delete'` |
| `src/land/account/__tests__/cascade-delete.test.ts` | Unit tests for cascade util |
| `src/forest/inngest/functions/account-delete-finalize-cron.ts` | Inngest cron function |
| `src/forest/inngest/functions/__tests__/account-delete-finalize-cron.test.ts` | Cron behavior tests |
| `src/forest/inngest/functions/account-delete-finalize-email.ts` | Bilingual EN/VI "deletion complete" email template (interim, will be rewritten in Phase 07) |

## Files to Modify

| File | Change |
|---|---|
| `src/app/api/account/route.ts` | Replace inline cascade loop with `cascadeDeleteAccount(db, user.id, tenantId)`; preserve response shape |
| `src/forest/inngest/functions/index.ts` | Export new `accountDeleteFinalizeCron` |
| `src/inngest/route.ts` (or wherever Inngest functions are registered) | Add `accountDeleteFinalizeCron` to served functions array |
| `messages/en.json` + `messages/vi.json` | +3 keys: `account.delete.completion_email_subject`, `account.delete.completion_email_body`, `account.delete.completion_email_signoff` |

## Implementation Steps

1. **Extract cascade util** to `src/land/account/cascade-delete.ts`:
   ```ts
   export const ACCOUNT_DELETE_ORDER = [
     'audit_log', 'publishing_results', 'publishing_jobs', 'publishing_channels',
     'payout_batches', 'commission_ledger', 'conversion_events', 'affiliate_links',
     'video_jobs', 'sessions', 'users',
   ] as const;

   export async function cascadeDeleteAccount(
     db: D1Database, userId: string, tenantId: string
   ): Promise<{ totalDeleted: number; byTable: Record<string, number> }> {
     const byTable: Record<string, number> = {};
     let total = 0;
     for (const table of ACCOUNT_DELETE_ORDER) {
       try {
         const r = await db.prepare(`DELETE FROM ${table} WHERE tenant_id = ?`).bind(tenantId).run();
         const c = r.meta?.rows_written ?? 0;
         byTable[table] = c;
         total += c;
       } catch {
         byTable[table] = 0;
       }
     }
     // Cleanup cooldown row
     try {
       await db.prepare(`DELETE FROM account_deletion_requests WHERE user_id = ?`).bind(userId).run();
     } catch { /* non-fatal */ }
     return { totalDeleted: total, byTable };
   }
   ```
2. **Refactor `/api/account/route.ts`** — replace lines 76–101 with call to `cascadeDeleteAccount(db, user.id, tenantId)`.
3. **Write `account-delete-finalize-cron.ts`**:
   ```ts
   import { inngest } from '@/forest/inngest/client';
   import { getD1Raw } from '@/seed/db/client';
   import { cascadeDeleteAccount } from '@/land/account';
   import { sendEmail } from '@/forest/email/sender';
   import { logger } from '@/seed/utils/logger-utility';
   import { buildDeletionCompleteHtml } from './account-delete-finalize-email';

   interface PendingRow { user_id: string; tenant_id: string; user_email: string | null; }

   export const accountDeleteFinalizeCron = inngest.createFunction(
     { id: 'account-delete-finalize-cron', retries: 1 },
     { cron: '0 */6 * * *' },
     async ({ step }) => {
       const pending = await step.run('fetch-pending', async (): Promise<PendingRow[]> => {
         const db = await getD1Raw();
         const rs = await db.prepare(`
           SELECT adr.user_id, adr.tenant_id, u.email AS user_email
           FROM account_deletion_requests adr
           LEFT JOIN user u ON u.id = adr.user_id
           WHERE adr.confirmed_at IS NOT NULL
             AND adr.cancelled_at IS NULL
             AND adr.scheduled_at <= unixepoch()
           LIMIT 50
         `).all<PendingRow>();
         return (rs.results ?? []) as PendingRow[];
       });

       let processed = 0;
       let totalDeleted = 0;
       for (const row of pending) {
         const result = await step.run(`cascade-${row.user_id}`, async () => {
           const db = await getD1Raw();
           return cascadeDeleteAccount(db, row.user_id, row.tenant_id);
         });
         totalDeleted += result.totalDeleted;
         processed++;

         if (row.user_email) {
           await step.run(`notify-${row.user_id}`, async () => {
             try {
               await sendEmail({
                 to: row.user_email!,
                 subject: 'Sophia AI account deleted · Tài khoản đã xoá',
                 html: buildDeletionCompleteHtml(),
                 tags: [{ name: 'kind', value: 'account-delete-complete' }],
               });
             } catch (err) {
               logger.warn('[delete-cron] notify failed', { userId: row.user_id, error: String(err) });
             }
           });
         }
       }

       logger.info('[delete-cron] run complete', { processed, totalDeleted });
       return { processed, totalDeleted };
     },
   );
   ```
4. **Register cron** — add to `src/forest/inngest/functions/index.ts` exports. Verify Inngest serve route auto-picks up via barrel.
5. **Email template** — `account-delete-finalize-email.ts`: bilingual, no CTA (one-way). Reuse style from existing delete confirm template.
6. **Tests:**
   - Unit: `cascadeDeleteAccount` deletes from each table, returns correct counts, idempotent on second call.
   - Integration: cron query selects only confirmed+elapsed+uncancelled rows.
   - Integration: cron run with 0 pending → returns `{processed:0, totalDeleted:0}`.
   - Integration: cron run with 2 pending → both processed; rows + cooldown row gone afterward.
7. **Run** `npm run build && npm test`.

## Migration

None (table already exists from W21 P02 migration 0102; index `idx_acct_del_pending` already supports the cron WHERE clause).

## i18n Keys

```json
// messages/en.json (add to "account.delete" namespace)
{
  "completion_email_subject": "Sophia AI account deleted",
  "completion_email_body": "Your Sophia AI Factory account has been permanently deleted. All data associated with your account has been erased.",
  "completion_email_signoff": "If you did not request this, please contact support immediately."
}
// messages/vi.json — VI translations
```

(Note: Phase 07 may relocate these into the shared component; for now, ship inline.)

## Test Strategy

| Test | Type | Expected |
|---|---|---|
| `cascadeDeleteAccount` deletes 11 tables | unit (D1 in-memory) | byTable has all 11 keys, total>=0 |
| `cascadeDeleteAccount` idempotent on re-run | unit | second call returns 0 |
| `cascadeDeleteAccount` cleans up cooldown row | unit | row gone after call |
| Cron query selects only ready rows | integration | filters confirmed+elapsed+uncancelled |
| Cron with 0 pending → `{processed:0}` | integration | OK |
| Cron with 2 pending → both finalized | integration | both rows deleted |
| Cron email best-effort (send fails) → still completes | integration | logged, no throw |
| `/api/account` DELETE still works (regression) | integration | calls cascadeDeleteAccount, returns same shape |

Target: +8 new tests.

## Success Criteria

- [ ] Cascade util extracted; `/api/account/route.ts` refactored
- [ ] Cron registered + appears in Inngest dashboard after deploy
- [ ] Cron schedule: every 6h
- [ ] Best-effort email sent on completion (failure non-fatal)
- [ ] `/api/account` DELETE existing tests still green (regression)
- [ ] +8 new tests pass
- [ ] Deploy SHA match
- [ ] Manual: trigger cron via Inngest dashboard "Run Now" → verify processed count matches expectation
- [ ] i18n parity test passes

## Risk Assessment

- **R1: Cron + manual finalize race** — User clicks `/api/account` DELETE simultaneously with cron firing. Mitigation: cascade is idempotent; second runner does nothing harmful. Cooldown row deletion at end is also idempotent.
- **R2: Cron error mid-cascade** — If `audit_log` deleted but `users` not (e.g., D1 timeout), retry on next cron picks up. Acceptable: data marked-for-delete from user perspective.
- **R3: Notification email leaks deletion** — User who manually canceled mid-cooldown but lost the cancel-click race could receive deletion email. Mitigation: cancel-click TOCTOU is small; cron only picks `cancelled_at IS NULL` at fetch time. Acceptable.
- **R4: Layer rule** — `forest` calls `land` per `cross-layer-orchestration.md` allowed exception. `app/api/account/route.ts` calling `land/account` also allowed (api routes can call any layer).
- **R5: Inngest `retries: 1`** — picked because the cron is mostly read-then-cascade; one retry is enough. Phase 05 audit may revisit if needed.

## Security Considerations

- Cron must NOT delete unconfirmed or cancelled accounts. Test coverage explicitly verifies WHERE clause guards.
- D1 deletes are non-recoverable; the 7-day cooldown is the only safety net. Document this in inline comments.
- Email containing "your account was deleted" must NOT include sensitive data (no tenantId, no PII other than greeting).

## Verification Steps

```bash
cd apps/sophia-ai-factory
npm run build               # 0 TS errors
npm test                    # all pass + 8 new
npm run deploy:full
LOCAL_SHA=$(git rev-parse HEAD | cut -c1-8)
LIVE_SHA=$(curl -s https://sophia.agencyos.network/api/version | grep -o '"shortSha":"[^"]*"' | cut -d'"' -f4)
[ "$LOCAL_SHA" = "$LIVE_SHA" ] && echo "✅ SHA match"

# Manual smoke (Inngest dashboard):
# 1. Open Inngest dashboard
# 2. Find "account-delete-finalize-cron"
# 3. Click "Run Now"
# 4. Inspect step output → expect {processed:N, totalDeleted:M}
```

## Next Steps

- Phase 07 will refactor the deletion-complete email to use the shared bilingual CTA component.
- Wave 23 candidate: per-user "deletion completed" status endpoint (`GET /api/account/delete/status` already exists; verify behavior post-cron).
