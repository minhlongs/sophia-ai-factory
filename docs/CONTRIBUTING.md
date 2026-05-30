# Contributing to Sophia AI Factory

Thank you for contributing to the Sophia AI Factory project. This guide outlines development practices, coding standards, and repository workflows to maintain code quality.

---

## 1. Core Tech Stack

* **Frontend Framework**: Next.js 16.1.6 (utilizing App Router and React Server Components)
* **Programming Language**: TypeScript (strict compilation mode)
* **UI Styling**: Tailwind CSS 4.0
* **Deployment Runtime**: Cloudflare Workers Pages via direct wrangler integration (`pnpm run deploy:full`)
* **Primary Database**: Cloudflare D1 (accessed via SQLite-compatible synchronized client using `createServerClient()`)
* **Session Authentication**: Better Auth v1.6.2 (utilizing `better-auth-session-token` secure cookies)
* **Payment integrations**: NOWPayments (for USDT cryptocurrency) and PayOS (for fiat VietQR integrations)

---

## 2. Repository Layout & Architecture (4-Layer Boundaries)

The repository follows a strict 4-layer architectural model. Code must only import inward (e.g. outer layers import from inner layers, not vice-versa).

```
src/
├── seed/    # Foundational primitives (database clients, configurations, logger, auth base)
├── tree/    # Domain-specific helpers (BYOK store, Telegram bots, handover models)
├── forest/  # Infrastructure orchestration (Inngest background runners, rate limiters, quota enforcers)
├── land/    # Core business logic workflows (billing modules, payouts processing, affiliate splits)
├── app/     # Next.js App Router endpoints, pages, and server actions
└── lib/     # Legacy aliases and common utilities
```

### Import Rules
The strict dependency path is: `seed ← tree ← forest ← land`. 
If a circular import or backward reference occurs, resolve it by using a dynamic import at runtime:
```typescript
const { addCredits } = await import('@/lib/mcu/credits-repo');
```

---

## 3. Strict Coding Conventions

* **Filenames**: Use `kebab-case` for all source files. Keep individual file lengths under 300 lines of code.
* **Code Purity**: Avoid using `any` types. Avoid leaving active debug commands (`console.log`, `alert`) in production-ready files.
* **Data Safety**: Validate all API inputs using Zod schemas at request boundaries.
* **Tier Enumerations**: Use only uppercase characters for user membership tiers: `BASIC`, `PREMIUM`, `ENTERPRISE`, or `MASTER`.
* **Prohibited Imports**: Do not import legacy modules from `@/lib/auth`, `@/lib/subscription`, `@/lib/unified-tier-config`, or `@/lib/tier-gate`.

---

## 4. Local Verification Workflow

Before proposing or pushing any changes:
1. **Lint Checks**: Ensure linting rules pass with `pnpm run lint -- --fix`.
2. **Type Compilations**: Check TypeScript compilation via `pnpm run type-check`.
3. **Tests Run**: Run the unit and integration suite with `pnpm run ci:test`.
4. **Secret Scan**: Scan codebase for hardcoded keys with `pnpm run ci:secrets`.
