# Brainstorm Report: Zero-Bug Systemic Quality Transformation

**Date:** 2026-06-29
**Status:** Approved → Plan Phase
**Scope:** Toàn bộ hệ thống chất lượng Sophia AI Factory

---

## Problem Statement

Sau deploy, bug vẫn xuất hiện tràn lan. 70% commits gần đây là fix commits. Tỉ lệ fix:feature là 1.2:1 — mỗi feature sinh ra hơn 1 bug fix. Đây không phải là vấn đề ngẫu nhiên mà là **systemic quality failure** với 5 root causes cụ thể.

## Scout Data Summary

| Metric | Value |
|--------|-------|
| Fix commits / last 50 | 35/50 (70%) |
| Fix commits / total history | 694/1785 (38.9%) |
| Fix:Feature ratio | ~1.2:1 |
| Hottest file | `middleware.ts` (47 fixes) |
| Error swallowing patterns | 127 `.catch(() => '')` |
| Layer violations | 23 (12 seed→tree, 8 tree→land, 3 land→forest) |
| Critical untested modules | 121 files with 0 tests |

## 5 Systemic Root Causes (Priority Order)

### P1 — CRITICAL: Payment Pipeline Reliability

**Files:** `nowpayments-ipn-subscription.ts` (648 lines), `nowpayments-ipn-handlers.ts` (217 lines), 4 more IPN files

**Bugs found:**
- TOCTOU race: insert check và status read không cùng transaction (D1 SQLite)
- Refund lifetime subscription không idempotent
- DLQ overflow 1000 → silent drop, chỉ 1 dòng log
- 127 pattern `.catch(() => '')` nuốt error không metric
- `forest/worker/` billing reconciler: 32 files, 0 tests
- Fire-and-forget PostHog tracking không error handling

**Impact:** Mất tiền thật nếu IPN xử lý sai. Không phát hiện được failure cho đến khi khách complaint.

### P2 — HIGH: Architecture Layer Violations (23 violations)

**Violations:**
- 12 `seed` → `tree/forest/land` (foundational importing domain)
- 8 `tree` → `land` (domain importing workflows)
- 3 `land` → `forest` (CIRCULAR dependency)
- `land/alerts/` và `forest/alerts/` duplicated (16 files each), both untested

**Impact:** Import cycles gây ra runtime errors khó debug. Layer violations làm code không predictable, gây regression khi refactor. Kiến trúc 4-layer mất tác dụng.

### P3 — HIGH: Middleware Monolith (47 fix commits)

**File:** `src/middleware.ts` (333 lines)

**Bugs:**
- Locale routing + auth guard + CSP + rate limiting dồn vào 1 chỗ
- Mỗi API route mới → risk redirect loop
- Regex matching fragile, sửa đi sửa lại

**Impact:** Single point of failure cho mọi request. Mỗi thay đổi nhỏ có thể gây redirect loop toàn bộ app.

### P4 — MEDIUM: Deploy Script Fragility (29 fix commits)

**File:** `scripts/deploy-with-sha.sh` (646 lines)

**Bugs:**
- `|| true` và `2>/dev/null` nuốt legitimate errors
- Curl fallback che dấu DNS failures
- Shell glob không expand đúng trong `wait_for_file`
- `deploy-full-verified.sh` đòi E2E password → phá automated deploy

**Impact:** Deploy script là gate cuối cùng trước production. Khi nó fail silently, bug lọt ra production.

### P5 — MEDIUM: Test Coverage Gaps (121 critical files untested)

**Zero-test modules:**
| Module | Files | Risk |
|--------|-------|------|
| `forest/worker/` (billing reconciler) | 32 | Mất tiền |
| `seed/types/` (foundational types) | 34 | Type errors across all layers |
| `land/alerts/` + `forest/alerts/` | 32 | Alert failure không phát hiện |
| `land/openclaw/` (AI routing) | 13 | AI cost runaway |
| `forest/hooks/` | 10 | Cascading UI bugs |

---

## Recommended Approach: Priority-Sequential

Xử lý từng root cause một, P1 → P5. Mỗi priority có design + plan + implement riêng.

**Rationale:**
- Mỗi root cause độc lập tương đối — fix P1 không block P2
- P1 (Payment Pipeline) xong trước → giảm risk mất tiền ngay
- Có thể deploy từng phần, không cần big bang release
- Scope manageable: mỗi priority là 1 dự án con

## P1 Design Preview: Payment Pipeline Hardening

### P1.1 — Fix TOCTOU Race in IPN Handler
- Wrap insert + status check trong D1 batch transaction
- Add idempotency key check BEFORE processing, not during

### P1.2 — Refund Idempotency
- Record payment_id in refund events
- Check for existing refund before processing duplicate

### P1.3 — Error Handling Overhaul
- Replace 127 `.catch(() => '')` patterns → structured error logging + metric emission
- Create `src/seed/utils/safe-catch.ts` utility
- Add D1 event emission for all payment error paths

### P1.4 — DLQ Protection
- Add metric alert when DLQ > 500 (before 1000 cap)
- Auto-recovery: attempt reprocessing oldest DLQ items periodically
- Add dead letter UI in admin dashboard

### P1.5 — Test the Billing Reconciler
- Add contract tests for IPN schema validation
- Add integration tests for subscription lifecycle (create → activate → expire → refund)
- Add race condition tests (concurrent IPN processing)
- Test `forest/worker/` metering reconciler with mock D1

### P1.6 — PostHog/Webhook Fire-and-Forget
- Add error callbacks for PostHog tracking failures
- Emit metric when webhook sender fails

---

## Implementation Roadmap

| Priority | Scope | Estimated Effort | Dependencies |
|----------|-------|-----------------|--------------|
| **P1** | Payment Pipeline Hardening | ~1-2 weeks | None |
| **P2** | Layer Violation Cleanup | ~1 week | None (can parallel with P1) |
| **P3** | Middleware Decomposition | ~1 week | None |
| **P4** | Deploy Script Hardening | ~3-5 days | None |
| **P5** | Test Coverage Expansion | Ongoing | After P1-P4 |

---

## Success Metrics

- Fix:Feature commit ratio drops from 1.2:1 → < 0.3:1 within 2 months
- Zero payment processing errors go undetected (all error paths emit D1 events)
- IPN idempotency: 0 duplicate charges/refunds after P1
- Deploy script: 0 shell-related fixes after P4
- Test coverage on critical paths: 0% → > 80%

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| P1 refactor breaks payment flow | Medium | Contract tests first, phased rollout |
| Layer fix breaks imports | Medium | Automated import analysis before commit |
| Middleware split causes perf regression | Low | Benchmark before/after |
| Scope creep | High | Strict priority order, say no to non-P1 until done |

---

## Next Steps

1. `/ck:plan` for P1 (Payment Pipeline Hardening) — with TDD approach since it modifies critical financial logic
2. P2-P5 planned after P1 completes and verified in production
