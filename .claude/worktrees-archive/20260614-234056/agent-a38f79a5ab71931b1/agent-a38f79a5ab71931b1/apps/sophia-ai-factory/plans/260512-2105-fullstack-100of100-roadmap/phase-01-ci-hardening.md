# Phase 1: CI Hardening

## Context Links

- Audit: `plans/reports/debugger-260512-2058-fullstack-audit-rescore.md` §4 G2/G3/G7/G12/G13/G19
- Deploy SOP: `apps/sophia-ai-factory/.claude/rules/sophia-deploy-verify.md`
- Husky hooks: `.husky/pre-commit`, `.husky/pre-push`
- Sentry upload: `scripts/ci/sentry-upload-sourcemaps.sh`
- Deploy script: `scripts/deploy-with-sha.sh`

## Overview

- **Priority:** P1
- **Status:** pending
- **Brief:** Wire lint into pre-push (deferred enforcement), bake source maps into CF-direct deploy, document RPO/RTO + manual backup SOP + Sentry alerts, add CAA DNS record.
- **Effort:** ~3h
- **Score impact:** +4 (74 → 78)

## Key Insights

| Gap | Insight |
|-----|---------|
| G2 | `lint-staged` only sees STAGED files — 274 errors across 228 files bypass pre-commit silently. `ci:lint` must run in pre-push BUT cannot block dev until Phase 3 clears errors. **Strategy: install hook now in non-enforcing mode (warn-only); flip to fail mode after Phase 3.** |
| G3 | `deploy-with-sha.sh` skips `scripts/ci/sentry-upload-sourcemaps.sh` — script only wired in disabled `test.yml`. Prod errors show minified stacks. Add ONE bash call post-wrangler-deploy. |
| G7 | RPO=24h / RTO=4h not documented anywhere. SOP entry in `docs/deployment-guide.md` needed for compliance + DR clarity. |
| G12 | No CAA record on `sophia.agencyos.network` — any CA can issue cert. Add `CAA 0 issue "letsencrypt.org"` (CF uses LE for proxied). |
| G13 | Sentry has no alert rules configured. Need at minimum: error-rate spike + new issue alerts. Document in SOP 7. |
| G19 | No manual backup SOP — operator can't manually trigger `d1-snapshot.sh` from memory. Add SOP 11. |

## Requirements

**Functional:**
- F1: Pre-push hook runs `npm run ci:lint` (warn-only initially, fail-mode flag commented out)
- F2: `deploy-with-sha.sh` uploads sourcemaps to Sentry on successful wrangler deploy
- F3: `docs/deployment-guide.md` contains RPO/RTO subsection
- F4: `docs/dev-sops.md` contains SOP 11 (manual backup) + Sentry alert SOP
- F5: CF DNS contains CAA record for sophia.agencyos.network

**Non-functional:**
- No regression to 4081 vitest pass count
- Deploy time increase < 30s (Sentry upload only)
- Source map upload failure must NOT fail deploy (`|| true` guard)

## Architecture

```
git push
  └─► .husky/pre-push
      ├─► vitest run        (existing)
      ├─► npm audit         (existing)
      └─► npm run ci:lint   (NEW — warn-only until Phase 3 done)

npm run deploy:full
  └─► scripts/deploy-with-sha.sh
      ├─► npm run build:worker
      ├─► npx wrangler deploy
      └─► bash scripts/ci/sentry-upload-sourcemaps.sh || true   (NEW)
```

## Related Code Files

**Modify:**
- `.husky/pre-push` — add `ci:lint` invocation (warn mode)
- `scripts/deploy-with-sha.sh` — add sourcemap upload call
- `docs/deployment-guide.md` — RPO/RTO section
- `docs/dev-sops.md` — SOP 11 manual backup + Sentry alert SOP entry
- `package.json` — verify `ci:lint` script exists (likely already does)

**Create:** None (no new files)

**External actions (no code):**
- CF Dashboard: Add CAA record `0 issue "letsencrypt.org"` for `sophia.agencyos.network`
- Sentry Dashboard: Create alert rules (error-rate spike >5/min, new-issue notify)

## Implementation Steps

1. **G2 prep** — Verify `ci:lint` script in `package.json`. Add to `.husky/pre-push` with prefix `# WARN MODE — flip to fail after Phase 3 errors=0`:
   ```bash
   npm run ci:lint || echo "⚠️  Lint errors present (Phase 3 backlog) — not blocking push"
   ```
2. **G3** — Edit `scripts/deploy-with-sha.sh`, after wrangler deploy success:
   ```bash
   if [ -x scripts/ci/sentry-upload-sourcemaps.sh ]; then
     bash scripts/ci/sentry-upload-sourcemaps.sh || echo "⚠️  Sentry sourcemap upload failed (non-fatal)"
   fi
   ```
3. **G7** — Append to `docs/deployment-guide.md`:
   - RPO = 24h (daily D1 backup target)
   - RTO = 4h (restore from R2 snapshot)
   - Recovery procedure: see SOP 11
4. **G19** — Add SOP 11 to `docs/dev-sops.md`: "Emergency D1 Backup" — `bash scripts/dr/d1-snapshot.sh && aws s3 cp ... R2`
5. **G13** — Add Sentry Alert SOP entry to `docs/dev-sops.md` referencing Sentry rules:
   - Rule A: Error rate >5 events/min → Slack/email
   - Rule B: New issue first-seen → digest daily
6. **G12** — Open CF DNS dashboard for `sophia.agencyos.network`, add:
   - Type: CAA, Name: `@`, Flags: 0, Tag: `issue`, Value: `letsencrypt.org`
7. **Verify** — `dig CAA sophia.agencyos.network +short` returns the record (TTL propagation may take 5min).
8. **Commit** — `git add` modified files, conventional commit `chore(ci): harden pre-push + bake sourcemaps + DR docs`.
9. **Deploy** — `npm run deploy:full`, verify SHA match per sophia-deploy-verify.md.

## Todo List

- [ ] G2 prep: Add `ci:lint` warn-only call to `.husky/pre-push`
- [ ] G3: Add `sentry-upload-sourcemaps.sh` call to `deploy-with-sha.sh`
- [ ] G7: Document RPO=24h / RTO=4h in `docs/deployment-guide.md`
- [ ] G19: Add SOP 11 "Emergency D1 Backup" to `docs/dev-sops.md`
- [ ] G13: Add Sentry alert rule SOP entry to `docs/dev-sops.md`
- [ ] G13: Configure Sentry rules in dashboard (error-rate spike, new-issue)
- [ ] G12: Add CAA record in CF DNS dashboard
- [ ] G12: Verify with `dig CAA sophia.agencyos.network +short`
- [ ] Run `npm test` — verify 4081+ pass
- [ ] `npm run deploy:full` + SHA match verify
- [ ] **DEFERRED to Phase 3 end:** Flip `.husky/pre-push` lint from warn to fail mode

## Success Criteria

- Pre-push runs `ci:lint` (warn output visible on test push)
- `deploy-with-sha.sh` calls sourcemap upload; next prod error in Sentry shows source-mapped stack
- `dig CAA sophia.agencyos.network` returns record
- `docs/deployment-guide.md` contains "## Disaster Recovery — RPO/RTO" heading
- `docs/dev-sops.md` contains SOP 11 + Sentry alert SOP
- Vitest still passes 4081+
- SHA match verified post-deploy

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Pre-push ci:lint in fail mode blocks all commits (274 errors still present) | Use warn-only mode now; flip to fail at Phase 3 close |
| Sentry sourcemap upload requires `SENTRY_AUTH_TOKEN` env var | Script `sentry-upload-sourcemaps.sh` already reads from env; document in deploy SOP |
| CAA record blocks future CA changes | LE only; if Sophia ever moves CA, update CAA first |
| Sentry alert rules too noisy | Start conservative (5/min); tune after week 1 |

## Security Considerations

- `SENTRY_AUTH_TOKEN` must be in `.dev.vars` or shell env — NEVER committed
- Sourcemaps are uploaded to Sentry only; not exposed publicly
- CAA record reduces cert mis-issuance risk

## Next Steps

- **Phase 2** (DNS/Security) can start in parallel — no code dependency
- **Phase 3** (Code Quality) MUST complete before flipping G2 to fail mode
- **Phase 4** (Backup/DR) depends on G7 RPO/RTO docs from this phase
