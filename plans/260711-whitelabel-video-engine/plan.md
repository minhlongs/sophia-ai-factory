---
title: "WhiteLabel Video Engine — TDD Plan (Vietnamese)"
description: "Kế hoạch triển khai WhiteLabel Video Engine cho agency SEA, theo phương pháp TDD (Test-Driven Development) — chi tiết từng phase với test-first workflow."
status: approved
verdict: GO
priority: P2
effort: "6 phases, ~40-50h"
branch: "main"
tags: [business-development, whitelabel, option-b, tdd]
blockedBy: []
blocks: [project:260711-social-rnn-module]
created: "2026-07-11"
createdBy: "ck:plan + planner validation"
source: skill
---

# WhiteLabel Video Engine — Kế hoạch TDD Chi Tiết

## Tổng quan / Overview

White-label video automation engine — agencies resell AI-generated video dưới thương hiệu riêng. Sophia cung cấp engine, agencies quản lý clients qua CRM riêng. **Tuân thủ No-Tech Doctrine**: self-service onboarding, không cần operator credentials.

## Nguyên tắc TDD / TDD Principles

Mỗi phase tuân theo Red-Green-Refactor:
1. **RED**: Viết test thất bại trước
2. **GREEN**: Viết code tối thiểu để test pass
3. **REFACTOR**: Dọn dẹp, giữ test xanh

## Dependencies giữa các phase

```
Phase 1 (Foundation) ──→ Phase 2 (Data Layer) ──→ Phase 3 (API Layer) ──→ Phase 4 (Admin UI)
                                                          └──────────────────────→ Phase 5 (Billing) ──→ Phase 6 (Tests)
```

| Phase | Name | Effort | Dependencies |
|-------|------|--------|--------------|
| 1 | [Foundation](./phase-01-foundation.md) | 2h | None |
| 2 | [Data Layer](./phase-02-data-layer.md) | 4h | Phase 1 |
| 3 | [API Layer](./phase-03-api-layer.md) | 8h | Phase 2 |
| 4 | [Admin UI](./phase-04-admin-ui.md) | 6h | Phase 3 |
| 5 | [Billing & Contracts](./phase-05-billing-contracts.md) | 5h | Phase 3 |
| 6 | [Tests & Hardening](./phase-06-tests.md) | 10h | Phase 2,3,4,5 |

**Lưu ý quan trọng / Critical Notes:**
- **Migration numbering**: 0218-0221 (không dùng 0040-0043 — đã tồn tại)
- **Test location**: `__tests__/` directory bên cạnh source file (theo convention hiện tại)
- **Layer compliance**: seed → tree → forest → land
- **Zero regression**: Existing billing, auth, video flows unchanged

---
---

## Phase 1: Foundation (2h)

**File:** [`phase-01-foundation.md`](./phase-01-foundation.md)

### TDD Workflow

**RED**: Tạo file kiểm thử trước  
**GREEN**: Triển khai code tối thiểu để test pass  
**REFACTOR**: Dọn dẹp, tối ưu

### Test-First Checklist

- [ ] Test: Agency tier config đúng giá trị (Starter: $500/5 sub-tenants/100 credits, Growth: $1500/20/500, Enterprise: $3000/unlimited)
- [ ] Test: Agency API key generation (32 bytes, base64url, unique)
- [ ] Test: Agency slug validation (lowercase, alphanumeric + hyphen, unique)

### Success Criteria

- [ ] Tier config AGENCY_TIERS thêm vào `seed/config/tiers/tier-configs.ts`
- [ ] API key generator trong `seed/db/`
- [ ] Slug validator trong `seed/validators/`
- [ ] Tất cả test pass, 0 TypeScript errors

---
---

## Phase 2: Data Layer (4h)

**File:** [`phase-02-data-layer.md`](./phase-02-data-layer.md)

### TDD Workflow

**RED**: Viết test migration + DB query tests  
**GREEN**: Viết migration SQL + repository  
**REFACTOR**: Optimize indexes, verify backward compatibility

### Test-First Checklist

- [ ] Test: Migration 0218 tạo agency table với đúng schema
- [ ] Test: Migration 0219 tạo sub_tenant + agency_id FK (nullable, cascade)
- [ ] Test: Migration 0220 tạo agency_credit_ledger
- [ ] Test: Migration 0221 tạo usage_log
- [ ] Test: Existing queries vẫn work (nullable FK)
- [ ] Test: Cross-agency isolation (agency A không thấy agency B)

### Success Criteria

- [ ] 4 migrations apply thành công (`bash scripts/apply-migrations.sh`)
- [ ] Repositories: `seed/db/repositories/agency-repo.ts`, `sub-tenant-repo.ts`
- [ ] Test coverage ≥ 90% cho data layer
- [ ] D1 console confirms all tables

---
---

## Phase 3: API Layer (8h)

**File:** [`phase-03-api-layer.md`](./phase-03-api-layer.md)

### TDD Workflow

**RED**: Viết test cho từng component trước  
**GREEN**: Triển khai agency middleware, credit meter, BYOK inheritance  
**REFACTOR**: Consolidate, remove duplication

### Test-First Checklist

**Agency Middleware** (`forest/sub-tenant/agency-middleware.ts`)
- [ ] Test: Valid API key → inject agency_id vào context
- [ ] Test: Invalid API key → 401 Unauthorized
- [ ] Test: Missing header → 401 (no key leakage)
- [ ] Test: Expired agency account → 403

**Credit Meter** (`forest/sub-tenant/credit-meter.ts`)
- [ ] Test: Reserve credits on job start (balance - reserved)
- [ ] Test: Commit credits on completion (reserved → used)
- [ ] Test: Refund on failure (reserved → balance)
- [ ] Test: Insufficient credits → reject job
- [ ] Test: Concurrent jobs → no double-spend

**BYOK Inheritance** (`forest/sub-tenant/byok-inheritance.ts`)
- [ ] Test: Sub-tenant nhận agency credentials (scoped)
- [ ] Test: Sub-tenant KHÔNG nhận credentials của agency khác
- [ ] Test: Sub-tenant KHÔNG nhận raw API key (chỉ scoped token)

**Agency Onboarding** (`land/agency-onboarding/`)
- [ ] Test: Zod schema validate registration payload
- [ ] Test: Duplicate slug → 409
- [ ] Test: Registration → agency created → API key returned

### Success Criteria

- [ ] `X-Agency-Key` header authentication hoạt động
- [ ] Credit meter chính xác (reserve/commit/refund)
- [ ] BYOK: zero credential leakage
- [ ] Agency onboarding Server Action hoạt động
- [ ] All tests pass

---
---

## Phase 4: Admin UI (6h)

**File:** [`phase-04-admin-ui.md`](./phase-04-admin-ui.md)

### TDD Workflow

**RED**: Component test (render + interaction)  
**GREEN**: Build UI components  
**REFACTOR**: Extract shared patterns

### Test-First Checklist

- [ ] Test: Onboarding wizard renders (step 1: agency info)
- [ ] Test: Wizard navigates to payment step
- [ ] Test: After payment, wizard shows API key
- [ ] Test: Dashboard hiển thị credit meter
- [ ] Test: Sub-tenant list renders từ API
- [ ] Test: Agency branding (CSS variables) áp dụng đúng
- [ ] Test: Responsive layout (mobile < 768px)

### Success Criteria

- [ ] Onboarding wizard end-to-end flow
- [ ] Dashboard với credit meter + sub-tenant table
- [ ] CSS variable injection cho agency branding
- [ ] Toàn bộ text bilingual VN+EN
- [ ] Responsive mobile layout

---
---

## Phase 5: Billing & Contracts (5h)

**File:** [`phase-05-billing-contracts.md`](./phase-05-billing-contracts.md)

### TDD Workflow

**RED**: Contract test cho payment flow  
**GREEN**: Extend NOWPayments IPN + fulfillment  
**REFACTOR**: Extract agency-specific logic

### Test-First Checklist

- [ ] Test: IPN handler detects agency tier payment
- [ ] Test: Agency payment → tier activation → email sent
- [ ] Test: Agency payment → Telegram onboarding link
- [ ] Test: Individual payment flow UNCHANGED (zero regression)
- [ ] Test: Agency tier upgrade/downgrade hoạt động
- [ ] Test: PayOS backup payment path

### Success Criteria

- [ ] Agency payment → activation → email + Telegram
- [ ] Individual billing flow regression-free (verify existing tests pass)
- [ ] API docs published

---
---

## Phase 6: Tests & Hardening (10h)

**File:** [`phase-06-tests.md`](./phase-06-tests.md)

### TDD Workflow

**RED**: Security audit + comprehensive test suite  
**GREEN**: Fix vulnerabilities  
**REFACTOR**: Optimize, document

### Test-First Checklist

**Unit Tests** (+150 tests target)
- [ ] Agency CRUD: create, read, update, delete with agency_id filter
- [ ] Credit meter: reserve, commit, refund, limit enforcement
- [ ] BYOK inheritance: scoped credentials, no leakage
- [ ] IPN agency handler: tier detection, activation
- [ ] API key validation: valid, invalid, expired, missing

**Integration Tests** (+20 tests target)
- [ ] End-to-end: register → payment → fulfill → onboard → generate → credit delta
- [ ] Cross-agency isolation: agency A cannot access agency B data
- [ ] BYOK security: no credential leakage between tenants
- [ ] Load test: 100 concurrent agency requests

**Security Audit**
- [ ] Enumerate ALL agency-scoped queries
- [ ] Verify agency_id filter enforced on EVERY write path
- [ ] Verify API key hashing (bcrypt, not plaintext)
- [ ] Verify no PII in logs

### Success Criteria

- [ ] 170+ new tests pass
- [ ] 0 TypeScript errors (`npm run build`)
- [ ] i18n validation pass (`npm run i18n:validate`)
- [ ] Zero cross-agency data leaks
- [ ] Security audit: PASS

---

## Risk Assessment & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Migration conflict với Social RNN | Low | High | Đã phân bổ range: 0218-0221 vs 0222-0224 |
| Credential leakage (BYOK) | Medium | Critical | Test-first approach, security audit phase 6 |
| IPN regression (existing billing) | Low | High | Contract tests, run existing test suite post-change |
| Cross-agency data leak | Medium | Critical | Middleware enforcement + DB-level FK + test coverage |
| Agency CRM scope creep | Medium | Medium | **Out of scope** — agencies manage clients via external CRM |
| 170 test target quá aggressive | Medium | Low | Prioritize critical paths (credit, auth, BYOK) |

## Rollback Strategy

| Phase | Rollback Method |
|-------|----------------|
| Phase 1 | Revert tier config changes (no DB changes) |
| Phase 2 | D1 rollback không native — prepare down migrations |
| Phase 3 | Disable agency routes via feature flag |
| Phase 4 | Remove agency routes, dashboard unchanged |
| Phase 5 | Revert IPN handler to subscription-only path |
| Phase 6 | Revert test files only (no production impact) |

## File Ownership (No Conflicts)

| Phase | Files Modified | Files Created |
|-------|---------------|---------------|
| 1 | `seed/config/tiers/tier-configs.ts` | `seed/db/agency-api-key.ts`, `seed/validators/agency-slug.validator.ts` |
| 2 | None | `migrations/0218-0221-agency-*.sql`, `seed/db/repositories/agency-repo.ts`, `sub-tenant-repo.ts` |
| 3 | None | `forest/sub-tenant/agency-middleware.ts`, `credit-meter.ts`, `byok-inheritance.ts`, `land/agency-onboarding/*` |
| 4 | None | `app/[locale]/agency/*`, `components/white-label-*.tsx` |
| 5 | `land/billing/nowpayments-ipn-dispatch.ts` | `land/billing/agency-billing.ts`, `land/fulfillment/agency-fulfillment.ts`, `docs/api-agency.md` |
| 6 | None | `tests/**/*.test.ts` |

## Backwards Compatibility

- **Migrations**: Nullable agency_id FK — existing rows unaffected
- **IPN Handler**: Agency branch only triggers cho agency-tier invoices; individual flow unchanged
- **API**: Existing endpoints unchanged; agency routes mới dưới `/api/agency/*` và `/[locale]/agency/*`
- **DB**: No column removals, no renamed tables

## Unresolved Questions

1. Agency branding logo storage: R2 bucket mới hay dùng existing?
2. Agency sub-tenant limit enforcement: soft warning hay hard block ở credit meter?
3. Telegram onboarding message template: Reuse existing hay tạo mới?
4. PayOS integration: Agency-specific invoice IDs hay dùng chung?
5. Agency API key rotation: Tần suất? Auto-expire?
