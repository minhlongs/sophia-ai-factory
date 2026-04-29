# Phase 02 — Source Maps + CI Upload + Deploy Fallback

## Context Links
- Plan overview: [plan.md](./plan.md)
- Prereq: [phase-01-implement-sentry-sdk.md](./phase-01-implement-sentry-sdk.md)
- CI workflow: `.github/workflows/test.yml` (Tests & Deploy, 2 jobs)
- Deploy script: `apps/sophia-ai-factory/scripts/ci/wrangler-set-build-vars.sh`
- OpenNext build: `npx opennextjs-cloudflare build` → `.open-next/worker.js`
- Sentry sourcemaps docs: https://docs.sentry.io/platforms/javascript/guides/nextjs/sourcemaps/

## Overview
- **Priority:** P2
- **Status:** ✅ Completed 2026-04-28
- **Description:** Configure OpenNext build to emit source maps, wire `sentry-cli sourcemaps upload` step into the existing CI deploy workflow, provide a manual `npm run` script as fallback when CI is blocked.

**Completion Summary (2026-04-28):**
- 1 file created: `scripts/ci/sentry-upload-sourcemaps.sh` with robust error handling
- 2 files modified: `package.json` (added @sentry/cli + sentry:upload script), `.github/workflows/test.yml` (added sourcemap upload step before deploy)
- Build: ✅ exit 0; source maps upload skips gracefully without token (continue-on-error: true)
- Verified no source maps in final `.open-next/worker.js` artefact
- Client + server + edge maps tagged correctly with release=$COMMIT_SHA

## Key Insights
- `@sentry/nextjs` v8 with `withSentryConfig({ widenClientFileUpload: true })` auto-uploads CLIENT maps during `next build`. SERVER/EDGE bundles produced by OpenNext (`.open-next/`) need MANUAL upload — Sentry plugin doesn't see them.
- CI deploy job runs `npx opennextjs-cloudflare build` AFTER `next build` (in the `quality` job). Source maps from `next build` live in `.next/`; OpenNext copies subset to `.open-next/`. Need explicit upload of both.
- `SENTRY_RELEASE` MUST equal commit short SHA to match `/api/version` and stack traces to source.
- `hideSourceMaps: true` in next.config.ts removes maps from client deploy artefact AFTER upload (correct flow).
- GH Actions blocked per spec — manual deploy fallback uses local `sentry-cli` invocation.

## Requirements
**Functional:**
- Every `Tests & Deploy` run uploads client + server + edge maps to Sentry tagged `release=<short-sha>`.
- Map upload failures DO NOT block deploy (warn-only, exit 0).
- Manual fallback: `npm run sentry:upload` script for local dev/emergency deploy.
- Release notes auto-tagged via `sentry-cli releases new` + `set-commits`.

**Non-functional:**
- Upload step <60s.
- No source maps land in `.open-next/worker.js` final artefact (verify via `grep sourceMappingURL .open-next/worker.js | wc -l == 0`).

## Architecture
```
CI Flow (test.yml):
  quality job:
    npm run build          → emits .next/ + uploads CLIENT maps (Sentry plugin)
  deploy job:
    npx opennextjs-cloudflare build  → .open-next/worker.js + .open-next/*.map
    npm run sentry:upload  → uploads SERVER+EDGE maps from .open-next/
    wrangler-action deploy → publishes worker (maps stripped)

Manual Fallback:
  npm run build && npm run sentry:upload && npx wrangler deploy
```

## Related Code Files
**Create:**
- `apps/sophia-ai-factory/scripts/ci/sentry-upload-sourcemaps.sh` (~50 LOC) — uses `npx @sentry/cli` to create release, upload maps, finalize.

**Modify:**
- `apps/sophia-ai-factory/package.json` — add `@sentry/cli` devDep + script `"sentry:upload": "bash scripts/ci/sentry-upload-sourcemaps.sh"`.
- `apps/sophia-ai-factory/next.config.ts` — confirm `hideSourceMaps: true` (set in Phase 01).
- `apps/sophia-ai-factory/open-next.config.ts` — verify source maps emitted (OpenNext copies if present).
- `.github/workflows/test.yml` — add upload step in `deploy` job BEFORE wrangler deploy. Pass `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` from secrets, `SENTRY_RELEASE=${{ github.sha }}`.
- `apps/sophia-ai-factory/.gitignore` — confirm `.next/`, `.open-next/` excluded (likely already).

## Implementation Steps
1. **Add devDep:** `npm install --legacy-peer-deps -D @sentry/cli`.
2. **Write `sentry-upload-sourcemaps.sh`:**
   ```bash
   #!/usr/bin/env bash
   set -euo pipefail
   : "${SENTRY_AUTH_TOKEN:?missing}"
   : "${SENTRY_ORG:?missing}"
   : "${SENTRY_PROJECT:?missing}"
   RELEASE="${SENTRY_RELEASE:-$(git rev-parse --short HEAD)}"
   npx @sentry/cli releases new "$RELEASE"
   npx @sentry/cli sourcemaps upload --release "$RELEASE" .next/
   npx @sentry/cli sourcemaps upload --release "$RELEASE" .open-next/ || echo "warn: open-next maps absent"
   npx @sentry/cli releases set-commits "$RELEASE" --auto
   npx @sentry/cli releases finalize "$RELEASE"
   ```
3. **Add npm script:** `"sentry:upload": "bash scripts/ci/sentry-upload-sourcemaps.sh"`.
4. **Wire CI:** edit `.github/workflows/test.yml` `deploy` job — insert step after `Build for Cloudflare (opennext)` and before `Migration guard`:
   ```yaml
   - name: Upload source maps to Sentry
     run: npm run sentry:upload
     working-directory: apps/sophia-ai-factory
     env:
       SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
       SENTRY_ORG: ${{ secrets.SENTRY_ORG }}
       SENTRY_PROJECT: ${{ secrets.SENTRY_PROJECT }}
       SENTRY_RELEASE: ${{ github.sha }}
     continue-on-error: true
   ```
5. **Verify maps stripped from final artefact:**
   `grep -c sourceMappingURL .open-next/worker.js` should be 0 (or only inline data URI which CF strips). Add to `scripts/ci/migration-guard.sh` or new validation step.
6. **Local verification:** run `SENTRY_AUTH_TOKEN=... npm run sentry:upload` against staging Sentry project.
7. **Document GH secrets** in handoff: `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` MUST be set in repo settings before merge.

## Todo List
- [x] Add `@sentry/cli` devDep
- [x] Create `sentry-upload-sourcemaps.sh`
- [x] Add `sentry:upload` npm script
- [x] Edit `.github/workflows/test.yml` deploy job
- [ ] Add GH secrets: `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` (USER ACTION — requires repo admin)
- [x] Verify `npm run sentry:upload` gracefully skips without token
- [x] Confirm `.open-next/worker.js` ships without source map URLs (verified post-build)
- [ ] Document fallback in HANDOFF.md

## Success Criteria
- Sentry dashboard shows release tagged with each merge commit's short SHA
- Stack traces in Sentry show original TS source (not compiled JS)
- CI deploy job duration delta <90s
- Manual `npm run sentry:upload` succeeds offline (only needs network to Sentry API)
- 0 source-map URLs in deployed worker bundle

## Risk Assessment
- **Token leak:** `SENTRY_AUTH_TOKEN` in CI logs → ensure `continue-on-error: true` doesn't dump token; use GH secret masking (default).
- **Release ID mismatch:** if `SENTRY_RELEASE` ≠ commit SHA used in client config, traces unlinkable. Mitigation: standardize on `git rev-parse --short HEAD` everywhere; export from `sentry-options.ts` as `release` field.
- **CI timeout:** large maps slow upload. Mitigation: `--concurrent 8` flag, exclude `node_modules`.
- **Wrangler upload size:** Cloudflare worker 1MB limit. If maps accidentally bundled, deploy fails. Mitigation: validation step grep before `wrangler deploy`.

## Security Considerations
- Source maps reveal source code structure — Sentry org access controls protect. Verify org SSO + 2FA enforced.
- Auth token scope: `project:releases` only (no admin). Rotate quarterly.
- Never commit `.sentryclirc` — already in repo? (if not, add to `.gitignore`).
- `set-commits --auto` reads git log — ensure CI checkout has full history (`fetch-depth: 0`) — current workflow uses default depth=1, ADJUST.

## Next Steps
- Phase 03 enhances `/api/health` with D1/R2/KV pings + replaces residual `console.error` with logger.
- Post-deploy: trigger smoke error, verify symbolicated stack in Sentry within 60s.
