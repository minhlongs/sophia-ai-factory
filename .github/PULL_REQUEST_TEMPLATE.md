<!--
Pull Request — Sophia AI Factory
GitHub Actions is intentionally disabled on this account; this template is the gate.
Required reading: apps/sophia-ai-factory/.claude/rules/sophia-deploy-verify.md
-->

## Summary

<!-- 1–3 bullets describing what changed and why. Avoid duplicating the commit message verbatim. -->

-

## Scope

- [ ] **Code** — `src/**`
- [ ] **Migration** — `migrations/**` (D1 schema change)
- [ ] **Infra/config** — `wrangler.jsonc`, env, secrets
- [ ] **Docs only** — `docs/**`, `*.md`
- [ ] **Tests only** — `**/*.test.ts`, `__tests__/**`

## Test plan

<!-- For every new code path: how did you verify it works? -->

- [ ] `npm test` passes locally (or test-skip justified below)
- [ ] `npm run build` exits 0
- [ ] Manual UI check OR `curl` smoke test included below (for routes/UI changes)

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

## Deploy (CF-direct doctrine)

GitHub Actions is disabled on this account — deploys are local-wrangler-only.

- [ ] Already deployed via `npm run deploy:full` — SHA: `__________`
- [ ] OR will deploy after merge — reviewer assigns
- [ ] OR docs/tests-only — no deploy needed

If deployed, verify report attached below:

```
Local SHA:  __________
Live SHA:   __________   (curl -s $PROD_URL/api/version | jq .shortSha)
HTTP:       200 / __________
```

## Risk + rollback

- [ ] Low risk (docs, tests, internal-only)
- [ ] Medium risk (route, cron, UI flow)
- [ ] High risk (auth, payments, migrations)

Rollback plan if shipped breaks production:

> `npx wrangler rollback --name sophia-ai-factory --yes` OR `git revert <sha> && npm run deploy:full`

## Linked issues / postmortems

- Closes #
- Related postmortem: `docs/postmortems/<file>.md`
- Phase: `~/plans/<plan-dir>/phase-XX-<name>.md`
