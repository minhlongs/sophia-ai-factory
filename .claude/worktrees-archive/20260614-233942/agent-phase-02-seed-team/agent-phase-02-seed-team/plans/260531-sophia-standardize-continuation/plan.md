# Sophia AI Factory — Standardize & Continue Development

**Ngày:** 2026-05-31
**Mục tiêu:** Chuẩn hoá codebase từ hiện trạng hiện tại, đóng kín gaps, sẵn sàng scale tiếp.

## Tình trạng hiện tại

- Production-ready: deploy qua CF-direct (`npm run deploy:full`)
- 4-layer architecture: seed (147) → tree (162) → forest (362) → land (113)
- Auth: Better Auth v1.6.2 + D1 Kysely adapter
- Payments: NOWPayments (USDT) + PayOS (VN domestic)
- Telegram bot: @Sophia_Bbot hoạt động
- Background jobs: Inngest
- i18n: Vietnamese + English (next-intl)
- BYOK model: customers tự nhập API keys

## Các phases

| # | Phase | Mô tả | Ưu tiên |
|---|-------|--------|---------|
| 1 | Architecture cleanup | Barrel exports, consolidate `lib/` legacy, enforce 4-layer imports | P0 |
| 2 | Billing hardening | IPN reliability, dunning, overage billing, reconciliation | P0 |
| 3 | SOP Creator + Marketplace | UI/UX polish, marketplace foundation, content catalog | P1 |
| 4 | Monitoring + Alerts | Quota enforcement, real-time alerts, usage metering finalize | P1 |
| 5 | Production zero-gap audit | E2E flows, checkout verification, docs update, go-live 100% | P0 |

## Liên kết phases

- [Phase 1: Architecture Cleanup](./phase-01-architecture-cleanup.md)
- [Phase 2: Billing Hardening](./phase-02-billing-hardening.md)
- [Phase 3: SOP Creator + Marketplace](./phase-03-sop-marketplace.md)
- [Phase 4: Monitoring + Alerts](./phase-04-monitoring-alerts.md)
- [Phase 5: Production Zero-Gap Audit](./phase-05-production-audit.md)

## Tech stack

| Component | Tech |
|-----------|------|
| Frontend | Next.js 16 + React 19 + TypeScript + Tailwind CSS 4 |
| Backend | Cloudflare Workers (OpenNext) |
| Database | Cloudflare D1 (SQLite) + Kysely |
| Auth | Better Auth v1.6.2 |
| Payments | NOWPayments + PayOS |
| Jobs | Inngest |
| Storage | R2 (cache + backups) |
| Bot | Telegram |
| i18n | next-intl (vi + en) |
| AI | OpenRouter, ElevenLabs, HeyGen, MuAPI (100+ models) |

## Constraints

- CF-direct deploy doctrine: `npm run deploy:full` từ `apps/sophia-ai-factory`
- No-code/No-tech doctrine: customers tự cấu hình hết, không cần operator setup
- Tier enum: BASIC | PREMIUM | ENTERPRISE | MASTER
- Canonical imports: `@/seed/auth`, `@/seed/db`, `@/seed/config/tiers`
- Banned: `@/lib/auth`, `@/lib/subscription`, `@/lib/unified-tier-config`

## Deployment target

```
PROD: https://sophia.agencyos.network
```
