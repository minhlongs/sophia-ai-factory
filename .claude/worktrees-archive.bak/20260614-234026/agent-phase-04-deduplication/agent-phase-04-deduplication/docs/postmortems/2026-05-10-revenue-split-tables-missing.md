# INC-2026-01 — Revenue-split tables missing on remote D1

## Metadata

| Field | Value |
|---|---|
| **Incident ID** | `INC-2026-01` |
| **Title** | Revenue-split tables (`commission_ledger`, `payout_batches`, `payout_methods`) never created on remote D1 |
| **Date / Ngày** | 2026-05-10 |
| **Detected at / Phát hiện** | 2026-05-10T23:00Z (runtime audit during Phase 03 work) |
| **Resolved at / Khắc phục** | 2026-05-10T23:13Z (migration 0106 applied + deploy 57024fa7) |
| **Duration / Thời gian** | ~13min (detection → fix); root cause latent ~10 days |
| **Severity / Mức độ** | P1 degraded (zero customer impact realized — but multiple code paths silent-failing) |
| **Customer impact / Ảnh hưởng** | 0 conversions actually lost (no real conversion traffic in the window). Cron `payout-batcher-weekly` would have thrown silently each Sunday since 2026-05-01 |
| **Authors / Người viết** | @longtho638 |
| **Status / Trạng thái** | published |

---

## 1. Summary / Tóm Tắt

### English

Three foundational tables for the affiliate revenue-split system (`commission_ledger`, `payout_batches`, `payout_methods`) were declared in `src/seed/db/migrations/0038-revenue-split.sql` but never reached production D1 — the canonical `apply-migrations.sh` script only walks the `migrations/` folder at the app root, not `src/seed/db/migrations/`. The Phase 03 report had marked migration applied, but a runtime audit revealed the 3 tables did not exist on remote. Code paths that touched them (`payout-batcher.ts`, `/api/affiliate/payout-method`, `conversion-to-ledger.ts`) were silent-failing. Migration 0106 restored the tables and the VN PIT read was refactored to the canonical 0085 `tenant_settings` JSON schema.

### Tiếng Việt

Ba bảng nền tảng cho hệ thống chia hoa hồng affiliate (`commission_ledger`, `payout_batches`, `payout_methods`) được khai báo trong `src/seed/db/migrations/0038-revenue-split.sql` nhưng KHÔNG bao giờ được tạo trên D1 production — script chính `apply-migrations.sh` chỉ quét folder `migrations/` ở gốc app, không quét `src/seed/db/migrations/`. Báo cáo Phase 03 đã đánh dấu "migration applied" nhưng runtime audit phát hiện 3 bảng không tồn tại trên remote. Code đụng vào (`payout-batcher.ts`, `/api/affiliate/payout-method`, `conversion-to-ledger.ts`) silent-fail. Migration 0106 khôi phục các bảng + refactor đọc VN PIT theo schema 0085 canonical JSON.

---

## 2. Timeline / Diễn Biến (UTC)

| Time | Event |
|---|---|
| `~2026-05-01` | Phase 13 code merged referencing 3 tables. Report said "migration 0038 applied" |
| `2026-05-10 22:50` | Phase 03 Stripe Connect KYC scout starts |
| `2026-05-10 23:00` | Runtime audit `wrangler d1 execute --remote --command="SELECT name FROM sqlite_master WHERE type='table'"` returns no `commission_ledger`/`payout_batches`/`payout_methods` |
| `2026-05-10 23:03` | Root cause identified: `src/seed/db/migrations/` not walked by `apply-migrations.sh` |
| `2026-05-10 23:08` | `migrations/0106-revenue-split-tables.sql` created (verbatim 3 CREATE statements, skip `tenant_settings` which 0085 already canonicalized differently) |
| `2026-05-10 23:09` | `wrangler d1 execute --remote --file=migrations/0106...sql` → 8 queries, 16 rows written, success |
| `2026-05-10 23:11` | `conversion-to-ledger.ts` refactored: VN PIT read switched from non-existent `tenant_settings.vn_pit_enabled` column to namespaced `tenant_settings.value` JSON (matching 0085 schema) |
| `2026-05-10 23:13` | Deploy 57024fa7 → SHA-verified live. 3 tables queryable. `/api/affiliate/payout-method` returns 401 (auth) not 500 (table-missing) |

---

## 3. Root Cause — 5 Whys

| # | Question | Answer |
|---|---|---|
| 1 | Why were the 3 tables missing on remote D1? | `apply-migrations.sh` never executed their `CREATE TABLE` statements |
| 2 | Why didn't it execute them? | The script only walks `migrations/` at the app root, not `src/seed/db/migrations/` |
| 3 | Why did the SQL live outside the canonical folder? | The Phase 13 implementer placed it inside the source tree (next to the model code), not realizing the deploy script's folder discipline |
| 4 | Why didn't a CI guard catch the divergence? | No CI guard exists comparing `CREATE TABLE` SQL strings in the codebase against files in `migrations/` |
| 5 | Why was the Phase 13 report's "migration applied" checkbox trusted? | The report relied on `apply-migrations.sh` exit code 0, which is meaningless if the script silently found 0 files to apply. No runtime `SELECT count(*) FROM <table>` verification was performed |

**Root cause statement:** Phase report verification is a syntactic check (script exited 0), not a semantic check (target tables exist + are queryable). Combined with two SQL folders being structurally indistinguishable to a contributor, this allowed three tables to vanish from production for ~10 days undetected.

---

## 4. What Went Well

- **Audit before scaling Phase 03:** scouting Phase 03 KYC work triggered a remote-schema inspection that surfaced the gap
- **Idempotent fix:** `CREATE TABLE IF NOT EXISTS` made 0106 safe to re-apply
- **Deterministic batch IDs in payout-batcher:** even if the cron had fired before the fix, the rollback path (`status='paying' → 'payable'`) would have prevented duplicate payouts on retry
- **Zero customer impact:** caught during a window with no real conversion traffic

## 5. What Went Wrong

- Phase 13 implementer placed SQL outside canonical folder; no enforcement caught this
- Phase 13 report marked "migration applied" without runtime verification
- Two `tenant_settings` schemas (0038 column-flag vs 0085 namespaced JSON) coexisted, masking the real source-of-truth
- No alerting on Inngest `payout-batcher-weekly` errors → cron would silent-fail every Sunday

## 6. Where We Got Lucky

- The 10-day gap happened during low-traffic period; first real conversion would have thrown immediately
- Phase 03 work happened to start with a remote D1 inspection; otherwise the gap could have persisted until first paying conversion

---

## 7. Action Items

| # | Action | Owner | Due | Type |
|---|---|---|---|---|
| 1 | Pre-commit/CI grep: every `CREATE TABLE` referenced from `src/(land\|forest)` must have a matching filename in `migrations/` | @longtho638 | 2026-05-25 | Prevent ✅ done 2026-05-11 — `scripts/check-migration-coverage.sh` + `src/__tests__/migration-coverage-guard.test.ts` (vitest wrapper). Skips Postgres files via syntax heuristic. Passes cleanly on current tree. |
| 2 | Phase reports MUST include `SELECT count(*) FROM <table>` runtime verification, not just `apply-migrations.sh exit 0` | @longtho638 | 2026-05-15 | Detect |
| 3 | Add `-- DEPRECATED: superseded by migrations/0106 + 0085` header to `src/seed/db/migrations/0038-revenue-split.sql` to prevent future restore-by-accident | @longtho638 | 2026-05-15 | Prevent ✅ done 2026-05-11 — DEPRECATED banner added to both `0038-revenue-split.sql` AND alias `20260506_revenue_split.sql` (date-format duplicate). Coverage guard still PASS. |
| 4 | Sentry alert: Inngest `payout-batcher-weekly` non-zero error count → Slack | @longtho638 | 2026-06-01 | Detect |
| 5 | Documented in `contributor-handover.md` §6 pitfalls + `payout-operations-runbook.md` | @longtho638 | 2026-05-11 | Mitigate (done) |

---

## 8. Customer Comms

- [ ] Status page incident posted — N/A (caught before customer impact)
- [ ] Affected users emailed — N/A
- [x] Internal: incident logged in this postmortem + linked from gap plan Phase 03

---

## 9. References

- Fix report: `apps/sophia-ai-factory/plans/reports/fix-260510-2310-migration-0105-schema-gap.md`
- Migration 0106: `apps/sophia-ai-factory/migrations/0106-revenue-split-tables.sql`
- Commits: `57024fa7` (initial fix), follow-up routing `17b4b6b5`
- Dead schema: `apps/sophia-ai-factory/src/seed/db/migrations/0038-revenue-split.sql`
- Apply script: `apps/sophia-ai-factory/scripts/apply-migrations.sh`
- Phase plan: `~/plans/260510-0603-sophia-gap-plan/phase-03-stripe-kyc.md`

---

## Author Checklist

- [x] Blameless tone — no person named as cause
- [x] Timeline UTC, accurate to nearest minute
- [x] 5-Whys reaches a system/process root cause (verification discipline + folder convention)
- [x] Every action item has owner + due date
- [x] Customer impact quantified (0 conversions lost)
- [x] Filed in `docs/postmortems/` + indexed in README
