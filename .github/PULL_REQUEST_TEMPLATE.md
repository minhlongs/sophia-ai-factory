<!--
Pull Request — Sophia AI Factory
GitHub Actions runs PR validation and deploys to production after merge to `main`.
Required reading: apps/sophia-ai-factory/.claude/rules/sophia-deploy-verify.md
-->

## Summary

<!-- 1–3 bullets describing what changed and why. Avoid duplicating the commit message verbatim. -->

-

## Product and architecture checks

- [ ] No Polar.sh code/config/docs added (Polar is REJECTED for this product)
- [ ] No operator-side third-party setup gate introduced (BYOK pattern preserved)
- [ ] Tier values are UPPERCASE (`BASIC | PREMIUM | ENTERPRISE | MASTER`)
- [ ] No `:any` in production code; no `console.*` outside `seed/utils/logger-utility` + `sdk/examples/`
- [ ] No banned imports (`@/lib/auth`, `@/lib/subscription`, `@/lib/unified-tier-config`, `@/lib/tier-gate`)
- [ ] 4-layer arch direction respected (`seed → tree → forest → land`, never reverse — see `.claude/rules/cross-layer-orchestration.md`)
- [ ] i18n keys exist in BOTH `messages/vi.json` AND `messages/en.json` (Rule 8)
- [ ] Zod validation on all new API inputs

## Scope

- [ ] **Code** — `src/**`
- [ ] **Migration** — `migrations/**` (D1 schema change)
- [ ] **Infra/config** — `wrangler.jsonc`, env, secrets
- [ ] **Docs only** — `docs/**`, `*.md`
- [ ] **Tests only** — `**/*.test.ts`, `__tests__/**`

## Validation

<!-- For every new code path: how did you verify it works? -->

- [ ] `npm run type-check` passes on Node.js 22
- [ ] `npm run lint` passes
- [ ] `npm run check:boundaries` passes
- [ ] `npm run i18n:validate` passes
- [ ] `npm test` passes
- [ ] UI/route behavior checked for changed flows

```
# Paste smoke test command(s) + observed output, e.g.
# curl -sI https://sophia.agencyos.network/api/<path> | head -3
```

## Test discipline (INC-2026-03 lesson)

Every new API route MUST ship with at least:

- [ ] Auth-gate test (401 when unauthenticated)
- [ ] One happy-path test
- [ ] One error-path test (invalid input OR upstream failure)

If this PR adds an API route without these, justify here:

> _N/A or reason_

## D1 schema changes (INC-2026-01 lesson)

If this PR adds/modifies SQL:

- [ ] All new `CREATE TABLE` statements live in **canonical `migrations/`** folder (NOT `src/seed/db/migrations/`)
- [ ] `bash scripts/apply-migrations.sh` planned for remote apply post-merge
- [ ] `npm test` passes — `migration-coverage-guard.test.ts` validates folder discipline

If touching money columns:

- [ ] Followed convention in `contributor-handover.md` §6.8 (cents-new vs USD-float-legacy)

## Deploy and production proof

Merge to `main` triggers the canonical GitHub Actions pipeline in `.github/workflows/deploy.yml`.
Do not deploy locally unless a critical CI outage is declared and the break-glass override is approved.

- [ ] PR quality and security checks passed
- [ ] Deploy workflow passed after merge
- [ ] Live `/api/version` short SHA matches the merged commit exactly
- [ ] Production smoke passed (`/api/health`, `/login`, `/vi/login`)
- [ ] Docs/tests-only — no deploy needed

If deployed, verify report attached below:

```
Merged SHA: __________
Live SHA:   __________
Smoke:      __________
```

## Risk + rollback

- [ ] Low risk (docs, tests, internal-only)
- [ ] Medium risk (route, cron, UI flow)
- [ ] High risk (auth, payments, migrations)

Rollback plan if shipped breaks production:

> Revert the production Worker version through the approved Cloudflare rollback procedure, or revert the commit on `main` and verify the resulting CI deployment.

## Linked issues / postmortems

- Closes #
- Related postmortem: `docs/postmortems/<file>.md`
- Phase: `~/plans/<plan-dir>/phase-XX-<name>.md`
