# Phase 03 — Sentry DSN Configuration

## Context Links

- Forwarder (already implemented): `src/lib/observability/sentry-forwarder.ts`
- Forwarder tests: `src/lib/observability/__tests__/sentry-forwarder.test.ts`
- Health endpoint: `src/app/api/health/` (extend if exists; otherwise no-op)
- Wrangler config: `apps/sophia-ai-factory/wrangler.toml`
- Deploy doc: `apps/sophia-ai-factory/.claude/rules/sophia-deploy-verify.md`

## Overview

- **Priority:** P2
- **Status:** completed
- **Effort:** 0.5d
- **Description:** Wire `NEXT_PUBLIC_SENTRY_DSN` (and optional `SENTRY_DSN`) as Cloudflare Worker secrets so the existing fire-and-forget HTTP forwarder begins shipping events. Pure config + docs; no code changes required (forwarder reads env at runtime). Do NOT block on user pasting the DSN — provide a no-op-safe path.

## Key Insights

- `sentry-forwarder.ts` is **already production-ready**: AbortSignal 2s, PII allowlist, envelope format. No SDK install needed.
- DSN absence is a **silent no-op** (`if (!dsn) return`) — deploying without DSN is safe.
- Sophia uses **wrangler secrets**, not `vars` (CF-direct doctrine). Set via `npx wrangler secret put`.
- `NEXT_PUBLIC_` prefix means available client-side too (browser errors). Use that as the canonical env name; `SENTRY_DSN` is the server-only fallback.
- Source-map upload to Sentry (build-time) is a separate concern — defer; not required for forwarder to function. Include only DSN in this phase.
- Health endpoint can optionally surface `sentry: { configured: bool }` — minor addition, do if cheap.

## Requirements

### Functional

- `NEXT_PUBLIC_SENTRY_DSN` set as wrangler secret in production
- Optional `SENTRY_DSN` mirror for server-only contexts (forwarder already checks both)
- One smoke event delivered to Sentry after deploy (manual verification step in todo)
- `/api/health` (if it exists) reports `sentry.configured: true|false`
- Docs updated: `docs/deployment-checklist.md` notes Sentry DSN requirement

### Non-Functional

- Zero code changes to forwarder (already complete)
- No new secrets except Sentry DSN(s)
- No build-time dependencies added (no `@sentry/nextjs`)

## Architecture

```
Production runtime:
  process.env.NEXT_PUBLIC_SENTRY_DSN → forwardToSentry() → Sentry envelope endpoint

Set via:
  npx wrangler secret put NEXT_PUBLIC_SENTRY_DSN
  npx wrangler secret put SENTRY_DSN   (optional mirror)

Verification:
  curl -s https://sophia.agencyos.network/api/health | jq .sentry
  → triggers ad-hoc forwardToSentry() call from a one-off /api/dev/sentry-test
    route OR via existing error path (e.g. an intentional 500 in dev)
```

## Related Code Files

### Create
- `src/app/api/dev/sentry-test/route.ts` (≤40 LOC) — gated by `NODE_ENV !== 'production'` OR by admin auth, fires a `forwardToSentry({ level: 'warning', message: 'sentry-test' })` and returns 200. Used for one-time post-deploy verification. Optional but useful.

### Modify
- `docs/deployment-checklist.md` — add "Set `NEXT_PUBLIC_SENTRY_DSN` via `wrangler secret put`" step
- `src/app/api/health/route.ts` (if exists; otherwise skip) — add `sentry: { configured: !!process.env.NEXT_PUBLIC_SENTRY_DSN }` to response

### Delete
- None

## Implementation Steps

1. **Verify forwarder is wired into error paths** — `grep -rn "forwardToSentry" src/` to confirm callers exist (logger, error.tsx, cron handlers). If any layer logs errors but does NOT call forwarder, leave as-is for this phase (out of scope) — note as follow-up.
2. **Add `sentry-test` dev route** (optional, recommended) — `src/app/api/dev/sentry-test/route.ts`:
   - Block in prod unless `?token=<ADMIN_DEBUG_TOKEN>` matches a secret OR caller is admin via `getCurrentUser()`
   - Calls `forwardToSentry({ level: 'warning', message: 'sentry-test', tags: { source: 'manual-verify' } })`
   - Returns `{ sent: true, dsnConfigured: !!process.env.NEXT_PUBLIC_SENTRY_DSN }`
3. **Extend `/api/health`** (if route exists) — add `sentry: { configured: bool }` field.
4. **Set wrangler secrets** (executed manually by operator when DSN ready):
   ```bash
   cd apps/sophia-ai-factory
   echo "<dsn-from-sentry-project>" | npx wrangler secret put NEXT_PUBLIC_SENTRY_DSN
   echo "<dsn-from-sentry-project>" | npx wrangler secret put SENTRY_DSN
   ```
5. **Deploy** — `npm run deploy:full` (CF-direct doctrine).
6. **SHA verify** — `curl -s https://sophia.agencyos.network/api/version | jq .shortSha` matches local.
7. **Smoke** — `curl https://sophia.agencyos.network/api/dev/sentry-test?token=<admin-token>` → check Sentry dashboard for the event within 30s.
8. **Docs** — update `docs/deployment-checklist.md` with Sentry DSN setup step + verification command.
9. **Commit** — `chore(observability): wire Sentry DSN secret + dev verify route`

## Todo List

- [x] Confirm forwarder callers exist via grep (no code change if already wired)
- [x] Add `/api/dev/sentry-test` route (admin-gated) — optional but recommended
- [x] Extend `/api/health` with `sentry.configured` flag (if health route exists)
- [x] Update `docs/deployment-checklist.md`
- [x] `npm run build` — 0 TS errors
- [x] `npm test` — pass (no new tests required for config-only change; add 1 for sentry-test route if added)
- [ ] **Operator step:** `wrangler secret put NEXT_PUBLIC_SENTRY_DSN` (when user pastes DSN)
- [ ] **Operator step:** `wrangler secret put SENTRY_DSN`
- [ ] Deploy via `npm run deploy:full`
- [ ] Verify SHA match
- [ ] Trigger sentry-test route → confirm event in Sentry UI (operator action)

## Success Criteria

- Build + tests pass with no DSN configured (existing behavior preserved)
- Once DSN is set: one event reaches Sentry within 30s of test trigger
- `/api/health` reports `sentry.configured: true` after secret set
- Deployment checklist documents Sentry setup

## Risk Assessment

- **Operator delays DSN paste** — phase ships independently; forwarder no-ops cleanly. NOT a blocker for Phase 1 sprint completion.
- **DSN typo** — wrangler secret accepts any string; `parseSentryEndpoint` returns null on malformed DSN → forwarder silently skips. Mitigation: smoke test step catches.
- **PII leak via tags/extra** — mitigated by existing `stripPii` allowlist in forwarder. No change.
- **Quota burn on Sentry** — fire-and-forget could spam events if a hot loop logs errors. Mitigation: forwarder is called from `logger.error` only; no per-request firehose. Monitor first 24h post-deploy.

## Security Considerations

- DSN is public-by-design (it's `NEXT_PUBLIC_*`). Treat client-key as low-sensitivity; do NOT confuse with Sentry auth token (build-time secret, NOT in this phase).
- Dev sentry-test route MUST be gated (admin token OR admin user) to prevent abuse from the public.
- No PII in forwarded events — enforced by allowlist.

## Next Steps

- Phase 1 ships even if DSN not yet pasted (forwarder no-ops)
- Future: source-map upload via `@sentry/cli` in build script (separate phase)
- Future: structured `logger.error` wrapper that always forwards — currently per-call

## Unresolved Questions

- Does `/api/health` route exist in current codebase? (Did not verify in research; if absent, skip the health-extension step — purely additive.)
- Should the dev sentry-test route be removed after smoke verify, or kept admin-gated permanently? Recommendation: keep, gated by admin role, useful for ongoing chaos checks.
