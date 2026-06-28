# Phase 04 — OP-2 SENTRY_AUTH_TOKEN Deploy Export

**Priority:** P1 (closes L7 Monitor score gap)
**Status:** blocked (waiting for user SENTRY_AUTH_TOKEN)
**Effort:** 10min post-cred
**Score Δ:** +1 (Layer 7 Monitoring)

## Context

`scripts/ci/sentry-upload-sourcemaps.sh` runs at end of `deploy-with-sha.sh` step 5. Reads `SENTRY_AUTH_TOKEN` from shell env at deploy time. Without it, gracefully skips with warning:

```
warn: SENTRY_AUTH_TOKEN not set — skipping Sentry source map upload
```

Currently every deploy logs this warning. Sentry shows errors but stack traces are minified (e.g., `b.tsx:1:2345`) instead of symbolicated (`PageHome.tsx:42:7 inside useEffect`).

## Requirements

User provides `SENTRY_AUTH_TOKEN` — obtain from Sentry org settings:
- https://sentry.io → Organization → Settings → Auth Tokens → Create New Token
- Scopes needed: `project:releases` + `project:read`

## Key Insights

- Sentry tokens are PER-USER on free plan, PER-ORG on paid. Sophia uses sentry.io free.
- Source map upload happens AFTER worker deploy. If upload fails, worker is still live — production unaffected, just no symbolication for new errors until next successful upload.
- Releases auto-created via `sentry-cli releases new ${COMMIT_SHA}` then `sentry-cli releases files ${COMMIT_SHA} upload-sourcemaps`.

## Architecture

```
[npm run deploy:full]
   ├── Step 1-4: build + inject SHA + wrangler deploy (worker LIVE)
   └── Step 5: sentry-upload-sourcemaps.sh
       │
       ├── if SENTRY_AUTH_TOKEN set:
       │   └── sentry-cli releases new ${COMMIT_SHA}
       │   └── sentry-cli releases files upload-sourcemaps .next
       │   └── sentry-cli releases finalize ${COMMIT_SHA}
       │
       └── else: log warn, exit 0 (non-fatal)
```

## Related Files

- `scripts/ci/sentry-upload-sourcemaps.sh` (the upload script)
- `scripts/deploy-with-sha.sh` lines 77-80 (invocation)
- `sentry.client.config.ts` (frontend init — already wired)
- `sentry.server.config.ts` (backend init — already wired)
- `apps/sophia-ai-factory/docs/dev-sops.md` SOP 12

## Implementation Steps

### Option A — One-shot deploy with env export

```bash
SENTRY_AUTH_TOKEN=sntrys_... npm run deploy:full
# Watch for: "Sentry release ${SHA} created" and "files uploaded: N"
```

### Option B — Persist in shell rc (recommended for repeated deploys)

```bash
# Append to ~/.zshrc or ~/.bashrc
echo 'export SENTRY_AUTH_TOKEN="sntrys_..."' >> ~/.zshrc
source ~/.zshrc

# Future deploys auto-pick up
npm run deploy:full
```

### Option C — `.env.local` (per-project)

```bash
# apps/sophia-ai-factory/.env.local — NEVER commit
echo 'SENTRY_AUTH_TOKEN=sntrys_...' >> .env.local

# Update deploy-with-sha.sh to source .env.local at top:
# set -a; [ -f .env.local ] && source .env.local; set +a
```

### Verification

```bash
# 1. After deploy, check Sentry dashboard
open "https://sentry.io/organizations/<org>/releases/"
# Latest release should be the deployed SHA

# 2. Spot-check: trigger a known error in prod, check Sentry shows symbolicated trace
# (Easiest: hit /api/__debug-error route if it exists, or a 500-prone route)

# 3. Verify deploy script log no longer warns
npm run deploy:full 2>&1 | grep -i sentry
# Should see: "✅ Sentry release uploaded" not "skipping"
```

## Todo List

- [ ] User: create Sentry auth token with `project:releases` + `project:read` scopes
- [ ] User: choose persistence option (A/B/C) — recommended B (~/.zshrc) for solo dev, C for shared team
- [ ] Run `npm run deploy:full` with token in env
- [ ] Verify Sentry release page shows new SHA
- [ ] Trigger a controlled error, confirm symbolicated stack trace appears
- [ ] Update SOP 12 with the chosen persistence option

## Success Criteria

- Deploy log shows `✅ Sentry release ${SHA} uploaded with N source maps`
- Sentry dashboard release page lists current commit SHA
- New errors in Sentry show symbolicated source locations (not minified)

## Risk Assessment

- **Wrong token scopes** → upload step fails with 403, but deploy already succeeded. Non-fatal. Re-issue token with correct scopes.
- **Token leaked in shell history** → revoke + reissue. Use Option C (`.env.local`) for highest hygiene.
- **Sentry quota** → free plan has limits on transactions + replays, not on releases/source maps.

## Security Considerations

- `SENTRY_AUTH_TOKEN` is a sensitive secret — treat like `OPENAI_API_KEY`.
- DO NOT commit `.env.local` (already in `.gitignore`).
- Token rotation: every 90d minimum per security best practice.

## Next Steps

- Once OP-1 + OP-2 done → score 91 → 93/100
- Phase 05 (DMARC) only time-gated, no human work
- Then audit framework re-run for honest 93/100 verification
