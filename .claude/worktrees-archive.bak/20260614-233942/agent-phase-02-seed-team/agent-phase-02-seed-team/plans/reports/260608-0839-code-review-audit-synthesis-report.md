# Audit Tổng Hợp — Sophia AI Factory
**Ngày:** 2026-06-08 | **Phạm vi:** DB layer + TypeScript + Auth/Payment + i18n + CF Deploy

---

## 1. Executive Summary

5 cuộc review độc lập trên DB layer, TypeScript, Auth/Payment, i18n và CF Worker deploy readiness phát hiện **tổng 31 findings** (4 critical, 15 high, 9 medium, 3 low). Ba lỗ hổng chí mạng có thể gây mất dữ liệu hoặc xâm nhập bảo mật: dual-table schema confusion (`users` vs `"user"`), SQL injection trong `or()` filter, và idempotency bug trong batch-jobs-repo. Ngoài ra, payment-success page tin tưởng URL query params — vector lừa đảo thanh toán trực tiếp. i18n có 889 thiếu key và 518 hardcoded strings, trong đó 2 trang thanh toán quan trọng nhất bypass hoàn toàn hệ thống dịch. CF deploy có config drift giữa 2 wrangler files và duplicate migration numbers.

**Khuyến nghị:** Sửa 3 critical DB trước, sau đó Auth/Payment critical, rồi chạy song song các high findings.

---

## 2. Critical & High Findings Table

### CRITICAL (4) — Sửa NGAY, chặn deploy nếu chưa fix

| # | File | Vấn đề | Tác động |
|---|------|--------|----------|
| C1 | `migrations/0001` + `0003` | Hai bảng user: `users` (ghost) và `"user"` (Better Auth). Code query sai table → dữ liệu sai | Mất dữ liệu, auth failure |
| C2 | `batch-jobs-repo.ts:56-93` | Dead code sau early return; idempotencyKey path tạo duplicate row do OR IGNORE thành công rồi fall through | Duplicate batch records |
| C3 | `d1-query-builder.ts:92` + `d1-query-chain-executors.ts:139` | SQL injection: `or()` interpolate value không parameterize; `execUpsert` interpolate column name | Data breach, RCE tiềm năng |
| C4 | `payment-success/page.tsx` | Tin tưởng URL query params cho tier/order_id/email — attacker có thể render fake payment success | Fraud vector |

### HIGH (15) — Fix trong sprint hiện tại

| # | File | Vấn đề | Tác động |
|---|------|--------|----------|
| H1 | `user-purchases-repo.ts:180-208` | decrementCredits: read-modify-write không CAS. Concurrent IPN retries → credits âm | Tiền mất, data corruption |
| H2 | `resolve-user-tier.ts:59-88` | Thiếu index `(user_id, payout_status)` trên affiliate_conversions. Hot path: mỗi request authenticated | Latency tăng, DB overload |
| H3 | `client.ts` + 3 files khác | 4 implementations riêng của `getD1()` binding resolution. Drift risk | Maintenance hazard |
| H4 | `brand-kits-repo.ts:76-98` | Dead code sau early return — INSERT tạo brand kit mới CHẠY bao giờ | Feature broken cho user mới |
| H5 | `repurpose-jobs-repo.ts:88-112` | Sequential INSERT trong loop — N RTT thay vì 1 batch | Latency: 10 clips = +10s |
| H6 | `sop-marketplace/challenges.ts:101` | `SUM(completed_steps)` thiếu `COALESCE(...,0)` → NULL cho user mới | Challenge không bao giờ complete |
| H7 | `with-tenant-scope.ts:59` | Unknown table → inject tenant filter silently → query return 0 rows | Silent data loss |
| H8 | `usage-reconciliation.ts:274,299` | `require() as any` + `.select({ count: 'id' } as any)` | Type safety bypass |
| H9 | `d1-client-rpc.ts` | `await createServerClient()` — sync function bị await → type mismatch | Runtime overhead, casts |
| H10 | `app/sop-marketplace/page.tsx` | `templates as any` cast | Type safety bypass |
| H11 | `app/actions/campaigns.ts` + 2 files | FormData casts `as string` không Zod validation | Injection vector |
| H12 | `payment-history/route.ts:44` | Bare `catch {}` swallow ALL errors → return empty 200 | Silent billing failure |
| H13 | `require-master-tier.ts:43-51` | `getCurrentUser()` null → redirect nhưng không guard rõ ràng | Crash nếu redirect không throw |
| H14 | `forest/webhooks/signature.ts` + `land/webhooks/signature.ts` | Duplicate signature verification — đã diverged | Security drift |
| H15 | `forest/raas/tier-guard.ts` + `land/tier-guard.ts` | Duplicate tier guard logic | Silent divergence |
| H16 | `subscription-gate-middleware.ts:43` | Tier name reversed: ENTERPRISE → "Premium", PREMIUM → "Growth" | UX: user thấy tier name sai |
| H17 | `middleware-api-handler.ts:18-29` | Webhook version check chỉ chạy khi `INTERNAL_API_SECRET` set (default: unset) | Version bypass non-prod |
| H18 | `resolve-user-tier.ts` | Race condition: concurrent IPN + admin change → non-deterministic tier | Financial impact: sai giá |

### MEDIUM (9)

| # | File | Vấn đề |
|---|------|--------|
| M1 | `d1-query-chain-executors.ts:execInsert` | N+1 SELECT sau batch INSERT — dùng `RETURNING *` |
| M2 | `d1-client-rpc.ts:debitMcuBalance` | `rows_written` aggregate không distinguish which statement failed |
| M3 | `get-user-tier.ts:50-55` | `.single()` throw khi user mới chưa có subscription → dùng `.maybeSingle()` |
| M4 | `migrations/0086` | ALTER TABLE NOT NULL column — verify có DEFAULT |
| M5 | `workflow-repository.ts:181` | `ORDER BY json_extract` — NULL cast to 0 → malformed entries first |
| M6 | `with-tenant-scope.ts` | `brand_kits` không tenant-scoped → cross-tenant access |
| M7 | `app/actions/brand-kit-action.ts` + 2 files | FormData không Zod validation |
| M8 | 10+ external API clients | `res.json() as T` không post-validation |
| M9 | `tier-guard.ts` (cả 2 copies) | `Infinity` limit — arithmetic edge case |

### i18n CRITICAL/HIGH

| # | File | Vấn đề |
|---|------|--------|
| I1 | `payment-success/page.tsx` | 24 `isVi` ternary — bypass t() hoàn toàn |
| I2 | `checkout/failure/page.tsx` | 5 `isVi` ternary — cùng vấn đề |
| I3 | `vi.json` | 889 keys missing — locale=vi hiện raw key path |
| I4 | `vi.json` | 483 keys VI == EN — chưa dịch |
| I5 | 115 files | 518 hardcoded strings — không có i18n |
| I6 | `help-tooltip.tsx` + `route-help-tooltip.tsx` | 23 uses isVi, không t() |

### CF Deploy CRITICAL/HIGH

| # | File | Vấn đề |
|---|------|--------|
| D1 | `wrangler.jsonc` vs `wrangler.toml` | Config drift — root jsonc thiếu R2/D1/KV bindings |
| D2 | `migrations/0178` × 2, `0140` × 2 | Duplicate migration number — lexicographic order có thể sai |
| D3 | `wrangler.toml:66` | Every-minute cron `"* * * * *"` — burn CF invocations |
| D4 | `stripe-connect.ts:64` | Stripe SDK v14 trong route không `runtime = 'nodejs'` |
| D5 | `wrangler.toml` | Thiếu `"ai": { "binding": "AI" }` — semantic cache crash |
| D6 | `ftc-disclosure-overlay.ts` + `crypto-disclaimer-overlay.ts` | Node.js modules (`child_process`, `fs`) trong SSR bundle path |

---

## 3. Recommended Fix Order

### Phase 1 — Ngày 1: CRITICAL (chặn mọi deploy cho đến khi pass)

```
Prio 1a: C3 — SQL injection (or() filter + execUpsert)
Prio 1b: C1 — Dual user table (drop ghost `users`, audit .from('users'))
Prio 1c: C2 — batch-jobs-repo idempotency (move dead code before early return)
Prio 1d: C4 — payment-success page (fetch order from DB, not URL params)
```

### Phase 2 — Ngày 2: Auth/Payment Critical + CF Deploy Blockers

```
Prio 2a: D3 — Remove every-minute cron
Prio 2b: D1 — Delete wrangler.jsonc (dead config), sync wrangler.toml
Prio 2c: D2 — Renumber duplicate migrations (0178→0178+0179, 0140→0140+0141)
Prio 2d: D5 — Add AI binding to wrangler.toml
Prio 2e: H12 — Remove bare catch in payment-history/route.ts
Prio 2f: H13 — Add null guard in requireMasterTier
Prio 2g: I1 + I2 — Refactor payment-success + checkout-failure to use t()
```

### Phase 3 — Ngày 3-4: High Findings (parallel)

```
Prio 3a: H1 — CAS pattern cho decrementCredits
Prio 3b: H2 — Add index trên affiliate_conversions(user_id, payout_status)
Prio 3c: H3 — Consolidate getD1() ra client.ts
Prio 3d: H4 — Fix brand-kits dead code (else block)
Prio 3e: H5 — Batch INSERT cho repurpose-jobs
Prio 3f: H14 + H15 — Extract signature.ts + tier-guard.ts to seed/
Prio 3g: H16 — Fix tier name reversal
Prio 3h: D4 — Add runtime=nodejs cho Stripe routes
```

### Phase 4 — Ngày 5-6: Medium + i18n

```
Prio 4a: I3 — Add 889 missing keys to vi.json
Prio 4b: I4 — Translate 483 untranslated values
Prio 4c: I5 + I6 — Migrate 115 hardcoded files to useTranslations
Prio 4d: M1-M9 — Medium DB/TS findings
Prio 4e: H8-H11 — TypeScript :any + Zod gaps
```

---

## 4. Quick Wins (< 30 min mỗi cái)

| # | Action | File | Thời gian |
|---|--------|------|-----------|
| Q1 | Xóa `wrangler.jsonc` (dead config) | repo root | 5 min |
| Q2 | Xóa `"* * * * *"` cron | wrangler.toml:66 | 2 min |
| Q3 | `.maybeSingle()` thay `.single()` | get-user-tier.ts:50 | 3 min |
| Q4 | Xóa `@polar-sh/nextjs` từ dependencies | package.json:20 | 2 min |
| Q5 | `COALESCE(SUM(...), 0)` | challenges.ts:101 | 3 min |
| Q6 | Xóa `process.env.COMMIT_SHA` fallback (dead code path) | version/route.ts:42 | 3 min |
| Q7 | Scope eslint-disable trong local-d1-mock.ts | seed/db/local-d1-mock.ts:1 | 3 min |
| Q8 | Rename `004_error_log` → `0004-error-log` | migrations/ | 5 min |
| Q9 | Thêm `tenant_id` filter cho brand_kits | brand-kits-repo.ts | 10 min |
| Q10 | `// @edge-runtime-allowed` annotation cho 3 files | ftc-disclosure, crypto-disclaimer, dlq-verification | 10 min |

---

## 5. Unresolved Questions

1. **C1 follow-up:** Có code nào production đang query `.from('users')` (plural) — ghost table? Nếu có, data trả về là stale schema.
2. **H7 follow-up:** `brand_kits` table intentionally unscoped by tenant hay là gap? Cần confirm với business logic owner.
3. **D5 follow-up:** `env.AI` (Workers AI) có thực sự được dùng trong production paths hay declared sớm cho Phase 4E?
4. **D4 follow-up:** Stripe Connect routes (`/api/connect/onboard`, `/api/webhooks/stripe-connect`) là dead code hay deferred feature cần maintain?
5. **D2 follow-up:** Duplicate migrations `0178`/`0140` — đã apply đúng thứ tự trong live D1 DB chưa? Cần verify schema hiện tại.
6. **H18 follow-up:** Tier race condition — có nên implement request-scoped tier cache hay D1 advisory lock cho tier changes?
7. **i18n:** 483 keys có ENGLISH placeholder values — đây là template-generated entries chưa từng được translate, hay có VN copy riêng cần import?
