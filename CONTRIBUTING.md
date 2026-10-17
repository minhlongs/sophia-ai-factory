# Contributing to Sophia AI Factory (Hướng Dẫn Đóng Góp Mã Nguồn Mở)

Thank you for contributing to **Sophia AI Factory**! We welcome pull requests, bug reports, security audits, and bilingual (Vietnamese + English) improvements from the global developer community.

---

## 1. Architecture Rules (4-Layer Mekong Standard)

All application code lives in `apps/sophia-ai-factory/src/` and strictly follows our one-way 4-layer architecture:

```text
seed   -> Foundational primitives (types, config, DB client, Web Crypto, circuit breaker)
tree   -> Reusable domain logic (BYOK store, Ask router, social pacing, Merkle audit)
forest -> Infrastructure orchestrators (Inngest durable jobs, RaaS gateway, UI portals)
land   -> Business workflows & Server Actions (billing, payouts, affiliates, growth)
```

### Mandatory Quality Gates (Run Before Every PR)
From `apps/sophia-ai-factory/`:
1. **File Size Cap:** Every executable `.ts` / `.tsx` file must be **< 180 lines of code (LOC)** (re-export facades **≤ 25 LOC**).
2. **Type Safety:** `npm run type-check` — 0 TypeScript errors, **zero `:any` types**.
3. **Layer Boundaries:** `npm run check:boundaries` — 0 upward or circular imports.
4. **Linting & Logging:** `npm run lint` — 0 errors, zero `console.log` (use `@/seed/utils/logger-utility`), zero new `eslint-disable` suppressions.
5. **Bilingual i18n:** `npm run i18n:validate` — every customer-facing string must exist in both `messages/vi.json` and `messages/en.json`.
6. **Tests:** `npm test` — all Vitest unit and integration tests must pass.

---

## 2. Protected Flows (Do Not Break)

Any PR touching these three flows must include passing integration tests:
1. **Setup Wizard (`/api/setup-wizard/*`)** — Customer BYOK API key onboarding.
2. **Telegram Bot (`src/tree/telegram/*`)** — `@Sophia_Bbot` `/campaign`, `/status`, `/results` commands.
3. **Payment Webhooks (`/api/webhooks/nowpayments/*`)** — NOWPayments IPN & PayOS tier activation.

---

## 3. Contributor License Agreement (CLA) & DCO

By submitting a Pull Request to this repository, you certify under the **Developer Certificate of Origin (DCO 1.1)** and agree that:
1. Your contribution is your original work and you have the legal right to submit it.
2. You grant **AgencyOS / Sophia AI Factory** a perpetual, worldwide, non-exclusive, royalty-free, irrevocable license to use, modify, sublicense, and distribute your contribution as part of both the **Apache-2.0 Open-Core Community Edition** and the **Commercial / Enterprise SaaS Editions**.
