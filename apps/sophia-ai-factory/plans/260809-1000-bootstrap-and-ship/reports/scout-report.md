# Scout Report — Sophia AI Factory Bootstrap & Ship

**Date:** 2026-08-09
**Scouted by:** Manual investigation (researcher agent timed out)
**Project:** /Users/macbook/sophia-ai-factory/apps/sophia-ai-factory

---

## 1. Project Structure

```
apps/sophia-ai-factory/
├── src/
│   ├── seed/           # 147 files - foundational primitives
│   ├── tree/           # 162 files - domain-specific reusable
│   ├── forest/         # 362 files - infrastructure orchestrators
│   ├── land/           # 113 files - business workflows
│   ├── app/            # Next.js App Router pages
│   ├── middleware.ts   # Auth, CSRF, CORS, MFA, locale
│   └── navigation.ts   # Locale-aware navigation
├── migrations/         # 195 D1 migration files
├── scripts/            # 99 deployment, verification, utility scripts
├── tests/              # Playwright E2E, load tests
├── docs/               # 96 documentation files
├── plans/              # 122 plan directories
├── wrangler.toml       # Cloudflare Workers config
├── package.json        # Scripts, deps, devDeps
└── tsconfig.json       # TypeScript config
```

---

## 2. Package.json Key Scripts

| Script | Purpose |
|--------|---------|
| `dev` | Next.js dev server |
| `build` | Production build (0 TS errors required) |
| `type-check` | `tsc --noEmit` |
| `lint` | ESLint on src/ |
| `test` | Vitest (pretest: i18n:validate) |
| `test:e2e` | Playwright E2E |
| `verify` | Full verification (build + tests + secrets) |
| `deploy:full` | CF-direct deploy with SHA verification |
| `deploy:verify` | sophia-doctor health checks |
| `ci` | Full CI gate |

---

## 3. Current Test Status

```
Test Files:  1 failed | 660 passed | 1 skipped (662)
Tests:       6557 passed | 34 skipped | 10 todo (6601)

FAIL: src/forest/missions/__tests__/api-key-auth.test.ts
Error: Cannot resolve import "../api-key-auth"
```

---

## 4. TypeScript Status

**30+ errors** primarily in:
- `src/tree/audit/` — 24 errors (unknown types, missing properties, type mismatches)
- `src/forest/missions/__tests__/api-key-auth.test.ts` — 1 error (import)
- `src/tree/audit/crypto-utils-signing.test.ts` — 6 errors
- `src/tree/audit/crypto-utils.test.ts` — 8 errors
- `src/tree/audit/gdpr-redaction.ts` — 7 errors
- `src/tree/audit/logger/audit-event-builder.ts` — 1 error
- `src/tree/audit/logger/audit-writer-extended.ts` — 2 errors
- `src/tree/audit/logger/audit-writer.ts` — 3 errors
- `src/tree/audit/right-to-erasure-legal-hold.ts` — 2 errors
- `src/tree/audit/right-to-erasure.ts` — 7 errors

---

## 5. Build Status

**PASS** — Build completes successfully
- All routes generated (100+ pages)
- Postbuild: source map upload to R2 (1 warning: 1 upload failed)

---

## 6. i18n Status

**PASS** — `npm run i18n:validate` 
- 2766 t() calls scanned
- 1227 unique static keys
- 0 missing keys
- 0 unresolved dynamic prefixes

---

## 7. Protected Flows — File Locations

### Setup Wizard (BYOK)
- Pages: `src/app/[locale]/setup/`
- Logic: `src/tree/byok/`, `src/tree/credentials/`
- API: `src/app/api/setup/`

### Telegram Bot (@Sophia_Bbot)
- Webhook: `src/app/api/telegram/webhook/`
- Commands: `src/tree/telegram/commands/`
- Bot logic: `src/tree/telegram/bot.ts`

### Payment Flow (NOWPayments)
- Webhook: `src/app/api/webhooks/nowpayments/`
- Billing: `src/land/billing/`
- Tier activation: `src/seed/db/get-user-tier.ts`, `src/land/billing/actions/`

---

## 8. Database Migrations

- **195 migration files** in `migrations/`
- Latest: check `git log --oneline -1 -- migrations/`
- Apply via: `bash scripts/apply-migrations.sh`

---

## 9. Deployment Config

- **wrangler.toml** — production config with D1, R2, KV bindings
- **Deploy script:** `scripts/deploy-with-sha.sh` (CF-direct)
- **Verification:** `scripts/sophia-doctor.mjs`
- **Production URL:** https://sophia.agencyos.network
- **SHA verification:** `/api/version` endpoint

---

## 10. Issues Found

| Issue | Severity | Location |
|-------|----------|----------|
| TypeScript errors (30+) | CRITICAL | src/tree/audit/*, missions test |
| Broken test import | CRITICAL | src/forest/missions/__tests__/api-key-auth.test.ts |
| Source map upload warning | LOW | postbuild script |
| Lint not yet run | UNKNOWN | — |

---

## 11. Recommended Fix Order

1. Fix TypeScript errors in audit module (core type debt)
2. Fix test import path in api-key-auth.test.ts
3. Run full test suite + lint
4. Validate protected flows
5. Deploy & verify