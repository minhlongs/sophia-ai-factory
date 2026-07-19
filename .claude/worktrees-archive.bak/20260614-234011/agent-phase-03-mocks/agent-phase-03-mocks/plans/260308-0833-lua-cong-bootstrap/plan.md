---
title: "Lửa Công Bootstrap — Sophia AI Factory"
description: "Chiến dịch loại bỏ tech debt, nâng cấp quality gates, đạt 70%+ test coverage"
status: pending
priority: P1
effort: 18h
branch: main
tags: [tech-debt, quality, testing, security, performance]
created: 2026-03-08
---

# Lửa Công Bootstrap — Sophia AI Factory

> **Binh Pháp Principle**: 火攻 (Huo Gong) — Dùng "lửa" để thiêu rụi tech debt, làm sạch codebase.

## Mục Tiêu

| Metric | Hiện Tại | Mục Tiêu | Priority |
|--------|----------|----------|----------|
| console.log statements | 27 | 0 | P0 |
| `any` types (production) | 15+ | 0 | P0 |
| Test coverage | ~60% | 70%+ | P1 |
| Security headers | Thiếu | Đầy đủ | P1 |
| Build time | - | < 10s | P2 |
| LCP | - | < 2.5s | P2 |

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    LỬA CÔNG BOOTSTRAP                        │
├─────────────────────────────────────────────────────────────┤
│  Phase 1: Console Cleanup (2h) — Dọn dẹp console.log       │
│  Phase 2: Type Safety (4h) — Loại bỏ any types             │
│  Phase 3: Test Coverage (5h) — Nâng coverage lên 70%+      │
│  Phase 4: Security Hardening (3h) — Security headers       │
│  Phase 5: Performance (2h) — Build optimization            │
│  Phase 6: Final Verification (2h) — CI/CD Green            │
└─────────────────────────────────────────────────────────────┘
```

## Phases Summary

| Phase | Subject | Effort | Status | Dependencies |
|-------|---------|--------|--------|--------------|
| [phase-01-console-cleanup.md](./phase-01-console-cleanup.md) | Console Cleanup | 2h | pending | none |
| [phase-02-type-safety.md](./phase-02-type-safety.md) | Type Safety | 4h | pending | phase-01 |
| [phase-03-test-coverage.md](./phase-03-test-coverage.md) | Test Coverage | 5h | pending | phase-02 |
| [phase-04-security-hardening.md](./phase-04-security-hardening.md) | Security | 3h | pending | phase-02 |
| [phase-05-performance.md](./phase-05-performance.md) | Performance | 2h | pending | phase-01 |
| [phase-06-final-verification.md](./phase-06-final-verification.md) | Verification | 2h | pending | phase-03,04,05 |

## Critical Files

### Console.log Files (10 files)
- `src/lib/utils/logger-utility.ts` — Logger utility (keep debug logic)
- `src/lib/usage-metering/debug-logger.ts` — Debug logger (refactor)
- `src/components/analytics/*` — Analytics components (remove)
- `src/app/[locale]/dashboard/analytics/*` — Analytics pages (remove)
- `src/lib/raas-gateway-client.ts` — Gateway client (replace)

### Any Type Hotspots (15+ occurrences)
- `src/lib/analytics/roi-calculator.ts` — 4 any types
- `src/lib/analytics/graphql-resolvers.ts` — 5 any types
- `src/lib/analytics/export.ts` — 2 any types
- `src/lib/usage-metering/rollup-service.ts` — 2 any types
- `src/lib/usage-metering/aggregator.ts` — 5 any types
- `src/app/api/admin/usage/reconciliation/route.ts` — 8 any types

## Success Criteria

- [ ] `grep -r "console\." src | wc -l` = 0 (trừ logger-utility.ts)
- [ ] `grep -r ": any" src --include="*.ts" | wc -l` = 0
- [ ] `npm test` coverage report ≥ 70%
- [ ] Security headers: CSP, HSTS, X-Frame-Options, X-Content-Type-Options
- [ ] `npm run build` < 10s
- [ ] CI/CD GitHub Actions GREEN

## Dependencies

- Supabase Postgres (usage_metering tables)
- RaaS Gateway (license management)
- Polar.sh (subscription tiers)
- Upstash Redis (rate limiting)

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking changes trong analytics API | High | Viết tests trước khi refactor |
| Type safety regressions | Medium | TypeScript strict mode, no implicit any |
| Test coverage không đạt 70% | Medium | Tập trung vào critical paths trước |
| Security headers breaking UI | Low | Test CSP với report-only mode |

## Next Steps

1. Execute Phase 1: Console Cleanup
2. Execute Phase 2: Type Safety (có thể chạy song song với Phase 1)
3. Execute Phase 3: Test Coverage
4. Execute Phase 4: Security Hardening
5. Execute Phase 5: Performance
6. Execute Phase 6: Final Verification

---

## Unresolved Questions

1. Có cần giữ lại `debug-logger.ts` cho development không?
2. Analytics GraphQL endpoint có còn được sử dụng trong production?
3. Reconciliation API có cần backward compatibility không?
