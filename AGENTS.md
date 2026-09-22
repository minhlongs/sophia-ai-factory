# AGENTS.md

This file replaces the stale ClaudeKit/OpenCode bootstrap text. It is the canonical agent contract for Sophia AI Factory.

## Working directory rule

Repo này là phạm vi làm việc duy nhất. Không cd sang dự án khác.
Nếu cần đọc/sửa dự án khác: nói cho user và chờ cho phép trước khi cd.

## Mission

Agents serve the Constitution first. Code changes are only valid when they preserve the product, deployment, payment, security, and documentation contracts below.

## Canonical Sources

Read these before substantive work:

1. `README.md` — product, stack, deploy doctrine.
2. `apps/sophia-ai-factory/CLAUDE.md` — production app rules, deploy verification, protected flows.
3. `apps/sophia-ai-factory/.claude/rules/sophia-layer-architecture.md` — seed → tree → forest → land boundaries.
4. `apps/sophia-ai-factory/.claude/rules/sophia-no-tech-doctrine.md` — no operator-managed third-party setup.
5. `apps/sophia-ai-factory/.claude/rules/sophia-deploy-verify.md` — CF-direct deploy proof.
6. `docs/admin-ops/payment-pricing-source-of-truth.md` — billing provider truth.

## Agent Roles

### CEO / Orchestrator

Owns product coherence, founder-facing decisions, roadmap trade-offs, and cross-domain synthesis. May spawn C-Level agents when work is independent and high-value.

### CTO

Owns architecture, code quality, security, deployment, observability, and risk. Must preserve CF-direct deploy doctrine and 4-layer import rules.

### CMO

Owns bilingual customer-facing copy, SEO, landing pages, pricing narrative, and conversion experiments. Must not use jargon in client-facing content.

### CSO

Owns sales motion, lead qualification, pricing experiments, churn prevention, and first-customer validation.

### COO

Owns operations, support SOPs, incident response, fulfillment, payment ops, and customer handover quality.

### Mekong CLI

Owns cross-repo business/task bridge when Mekong CLI context is needed. Does not override Sophia production rules.

## Mandatory Work Rules

- Never rewrite until this Constitution package is complete.
- Preserve protected flows: Setup Wizard, Telegram Bot, NOWPayments IPN tier activation.
- Use canonical imports:
  - Auth: `@/seed/auth/better-auth-session`
  - DB: `@/seed/db/client`
  - Tier lookup: `@/seed/db/get-user-tier`
  - Tier config: `@/seed/config/tiers`
- `createServerClient()` is synchronous; do not await it.
- Server Actions are preferred for data mutations.
- Customer-facing docs and UI copy must be bilingual Vietnamese + English.
- No hardcoded API keys. Use env vars and encryption.
- No `:any` types in TypeScript.
- No production `console.log`, `console.warn`, or `console.error`; use the logger utility.

## Deployment Rules

Production deploy is automated via GitHub Actions CI/CD on Cloudflare Workers edge:

- **Canonical Pipeline**: Automated via `.github/workflows/deploy.yml` upon push/merge to `main`.
- **Manual Trigger**: Executable via GitHub Actions `workflow_dispatch` (with `dry_run`, `force_verify`, and `skip_migrations` options).
- **Local Deploy Deprecation**: Direct deployment from developer workstations (`npm run deploy:full`) is disabled by default to eliminate environment drift.
- **Break-Glass Emergency**: In critical CI outages, local direct deploy is permitted only with an explicit override flag:
  ```bash
  EMERGENCY_CF_DIRECT=1 npm run deploy:full
  ```
- **Verification Mandate**: HTTP 200 is not proof. The live edge SHA from `https://sophia.agencyos.network/api/version` must match the commit SHA bit-for-bit.

## Payment Rules

- Primary: NOWPayments USDT.
- Backup Vietnam domestic: PayOS.
- Banned for Sophia billing: Polar.sh, PayPal.
- Stripe is not a customer billing provider unless an approved affiliate payout/KYC flow explicitly requires it.

## Archive / Delete Rules

- Delete only generated or clearly stale artifacts.
- Every DELETE recommendation must include business impact, technical impact, migration path, and risk.
- Archive historical docs when they are useful evidence but not current truth.
- Refactor stale instructions instead of leaving conflicting sources.
