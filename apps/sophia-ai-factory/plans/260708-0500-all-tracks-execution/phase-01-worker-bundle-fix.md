# Phase 1: Worker Bundle Fix
> Status: pending | Priority: P0 — deploy blocker

## Context
Cloudflare Workers hard limit: 10 MB gzipped. Current: 10.29 MB. Cannot deploy until under limit.

Five mitigation layers already applied but Turbopack inlines module contents into `handler.mjs` as string literals — disk-level strip cannot reach inlined code.

## Requirements
1. Non-breaking deploy gate: existing protections must remain active
2. Measure actual gzipped size after deploy (not raw)
3. Maintain all 6,882 tests passing
4. Document new secrets required (HONEYCOMB_API_KEY, BYOK_MASTER_KEY)

## Architecture
- Pre-build: `scripts/strip-ssr-bloat.sh` removes CJS→ESM bloat from disk
- Build: `next.config.ts` serverExternalPackages + `open-next.config.ts` externals
- Post-build: `scripts/inject-interop-shim.mjs` fixes CJS interop after stripping
- Deploy: `npm run deploy:full` → `deploy-with-sha.sh` → wrangler

## Files to Modify
| File | Change |
|------|--------|
| `scripts/strip-ssr-bloat.sh` | Lower Sentry chunk threshold (currently >100KB misses smaller fragments); force-strip Sentry references from handler.mjs |
| `open-next.config.ts` | Force `@opentelemetry/*` as external via esbuild `bundle: false` override |
| `next.config.ts` | Add d3 packages to serverExternalPackages with explicit per-package entries |
| `deploy-with-sha.sh` | Add `--gzip` flag to size measurement in check-bundle-size phase |
| `scripts/check-bundle-size.sh` | Add gzip measurement + actionable error messages |

## Files to Create
- `scripts/post-build-bundle-audit.mjs` — Parse handler.mjs, report top-20 inline modules by size, fail if >9.5MB

## Implementation Steps
1. Add gzip audit script (post-build): locate handler.mjs, gzip-stats, report bloat culprits
2. Audit current handler.mjs: grep for `sentry` string literals, verify SKIP_SENTRY_BUILD=1 effectiveness
3. Force OTel external: verify `@opentelemetry/api` and `@opentelemetry/semantic-conventions` do NOT appear in handler.mjs after rebuild
4. Fix d3 externals: replace wildcard `d3-*` with explicit list per d3 subpackage Turbopack resolves
5. Rebuild + measure: `npm run build` → run audit script → confirm <9.5MB gzipped
6. Deploy + verify: `npm run deploy:full` → SHA match → HTTP 200
7. Document secret requirements: update `.env.production.example` with HONEYCOMB_API_KEY note

## Todo
- [ ] Write post-build audit script
- [ ] Audit current Sentry inline chunks
- [ ] Force OTel external at esbuild level
- [ ] Fix d3 external resolution
- [ ] Rebuild + measure
- [ ] Deploy + SHA verify
- [ ] Update secrets docs

## Risk Assessment
| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Fix breaks existing SSR rendering | Low | Run full test suite + smoke test dashboard routes |
| esbuild config regression | Medium | Keep existing externals, add new ones |
| Rebuild reveals new bloat source | Medium | Audit-first approach surfaces root cause before changes |

## Rollback
If bundle fix fails: revert scripts/ + next.config.ts changes, keep SKIP_SENTRY_BUILD=1. No DB changes in this phase.
