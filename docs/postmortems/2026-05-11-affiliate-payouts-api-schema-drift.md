# INC-2026-03 — `/api/affiliate/payouts` selected non-existent column

## Metadata

| Field | Value |
|---|---|
| **Incident ID** | `INC-2026-03` |
| **Title** | `GET /api/affiliate/payouts` SQL referenced `total_usd` column that does not exist in `payout_batches` schema |
| **Date / Ngày** | 2026-05-11 |
| **Detected at / Phát hiện** | 2026-05-10 23:13 (post-fix code review of INC-2026-01) |
| **Resolved at / Khắc phục** | 2026-05-11 06:44 (commit `8762c26e` + deploy) |
| **Duration / Thời gian** | ~7h between detection and fix; latent ~10 days; pre-customer-impact |
| **Severity / Mức độ** | P2 — endpoint not yet wired to UI, but would have 500'd on first call |
| **Customer impact / Ảnh hưédng** | 0 — endpoint had no production consumers |
| **Authors / Người viết** | @longtho638 |
| **Status / Trạng thái** | published |

---

## 1. Summary / Tóm Tắt

### English

`GET /api/affiliate/payouts` selected a `total_usd` column from `payout_batches`. The canonical schema (migration 0106 / 0038) has `total_cents` instead — all money in the system is stored as integer cents and converted at API boundaries. The route would have returned HTTP 500 with `"no such column: total_usd"` on its first real call. Because no UI consumed it yet (the new payout-methods picker only landed 2026-05-11), customer impact was zero. Fix: select `total_cents`, expose both `total_cents` and `total_usd` (computed via `fromCents()`) in the JSON response. Added 5 unit tests covering auth gate, cents→USD math, limit cap, empty list, and stripe_connect rail rows.

### Tiếng Việt

`GET /api/affiliate/payouts` chọn cột `total_usd` từ bảng `payout_batches`. Schema canonical (migration 0106 / 0038) có `total_cents` — toàn bộ tiền trong hệ thống lưu dạng integer cents và convert ở biên API. Route sẽ trả HTTP 500 với `"no such column: total_usd"` ngay lần gọi thật đầu tiên. Vì chưa có UI nào consume (picker payout-methods mới landed 2026-05-11), customer impact = 0. Fix: select `total_cents`, expose cả `total_cents` lẫn `total_usd` (tính qua `fromCents()`) trong JSON. Thêm 5 unit tests phủ auth gate, math cents→USD, limit cap, list rỗng, rail stripe_connect.

---

## 2. Timeline / Diễn Biến (UTC)

| Time | Event |
|---|---|
| `~2026-05-01` | Route shipped referencing `total_usd` (assumed convention before INTEGER-cents standard solidified) |
| `2026-05-10 23:13` | Post-INC-2026-01 code review notices `total_usd` SELECT against canonical `total_cents` schema |
| `2026-05-11 06:42` | Fix authored: SQL switched to `total_cents`, response includes both `total_cents` (canonical) + `total_usd` (display) |
| `2026-05-11 06:43` | 5 unit tests added (`__tests__/payouts.test.ts`) — all pass |
| `2026-05-11 06:44` | Deploy `8762c26e` → SHA-verified live. Smoke test: `curl https://sophia.agencyos.network/api/affiliate/payouts` → HTTP 401 (auth gate, no longer 500) |

---

## 3. Root Cause — 5 Whys

| # | Question | Answer |
|---|---|---|
| 1 | Why did the route reference a non-existent column? | Author assumed `total_usd` based on the public API convention (USD floats in JSON) rather than reading the actual table schema |
| 2 | Why did the assumption not surface during testing? | The route had no unit tests; type checking does not verify SQL column names against runtime schema |
| 3 | Why was there no test? | API routes added in a sprint where test coverage was deferred for velocity; the file landed without follow-up |
| 4 | Why was the file not caught in code review? | Single-developer team, no second reviewer; mental model treated the JSON public shape as the schema, not the storage |
| 5 | Why did SQL/schema validation fall through? | D1 binds are runtime — `wrangler dev` would have caught it locally but the route was never exercised before this audit |

**Root cause statement:** Money columns standardized on INTEGER cents (per `commission-cents.ts`) but one route written before that convention crystallized still assumed USD floats at the storage layer; no test forced a live D1 round-trip that would have failed the assumption immediately.

---

## 4. What Went Well

- **Detected before customer impact:** the audit caught it while the endpoint was still consumer-less
- **Test-first fix:** 5 tests landed alongside the change, including the previously absent auth gate coverage
- **Backward-compat response shape:** new payload includes BOTH `total_cents` (canonical) and `total_usd` (display), so any future consumer can pick the convenient field

## 5. What Went Wrong

- API route shipped without unit tests
- Money-column convention (`*_cents`) not enforced via lint/typed-SQL or a code-review checklist
- Endpoint was never smoke-tested before being declared "ready"

## 6. Where We Got Lucky

- The new payout-methods UI (`/dashboard/affiliate/payouts`, 2026-05-11) consumed `payout_methods` not `payout_batches`, so the unwired `/api/affiliate/payouts` never got called
- Phase 03 audit chain naturally surfaced this immediately after INC-2026-01 fix

---

## 7. Action Items

| # | Action | Owner | Due | Type |
|---|---|---|---|---|
| 1 | Code review checklist: any new file SELECTing from a `*_cents` column → must convert via `fromCents()` at the boundary | @longtho638 | 2026-05-15 | Prevent |
| 2 | Sweep all `app/api/` SELECT statements for `*_usd` columns against actual schema | @longtho638 | 2026-05-25 | Detect |
| 3 | New API routes must ship with at least: auth gate + happy path + one error path unit tests | @longtho638 | 2026-05-15 | Prevent |
| 4 | Pitfall §6.7 "`total_cents` vs `total_usd`" added to `contributor-handover.md` | @longtho638 | 2026-05-11 | Mitigate (done) |

---

## 8. Customer Comms

- [ ] Status page incident — N/A (no production impact)
- [x] Internal: documented in this postmortem

---

## 9. References

- Route: `apps/sophia-ai-factory/src/app/api/affiliate/payouts/route.ts`
- Tests: `apps/sophia-ai-factory/src/app/api/affiliate/payouts/__tests__/payouts.test.ts`
- Schema: `apps/sophia-ai-factory/migrations/0106-revenue-split-tables.sql` (`payout_batches.total_cents INTEGER`)
- Cents helpers: `apps/sophia-ai-factory/src/land/payouts/commission-cents.ts`
- Commit: `8762c26e`
- Companion incident: INC-2026-01 (uncovered this during follow-up review)

---

## Author Checklist

- [x] Blameless tone — no person named as cause
- [x] Timeline UTC, accurate to nearest minute
- [x] 5-Whys reaches a system/process root cause (test-first discipline + convention enforcement)
- [x] Every action item has owner + due date
- [x] Customer impact quantified (0 — endpoint had no consumers)
- [x] Filed in `docs/postmortems/` + indexed in README
