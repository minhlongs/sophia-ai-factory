# Plan: T005 Dependency Audit Triage — Security Patch Application

## Status
**Completed** - All HIGH vulnerabilities eliminated, tests passing.

## Actual Changes (vs plan)

- wrangler: upgraded to `^4.101.0` (resolved peer conflict with @opennextjs/cloudflare^1.19.9)
- Added dependencies: `react-is@^18.3.1` (recharts peer), `@types/webpack@^5.0.0` (type-check)
- Overrides applied for: @grpc/grpc-js, protobufjs, ws, vite, form-data, glob, undici, @babel/core, posthog
- Used `--legacy-peer-deps` to install; lockfile regenerated.

## Verification
- `npm audit --audit-level=high`: 0 HIGH/CRITICAL
- `npm run type-check`: PASSED
- `npm test`: 5829 passed, 34 skipped

## Implementation Notes
- Nested override `@opentelemetry/otlp-transformer>protobufjs` not needed; top-level `protobufjs` sufficed.
- Wrangler upgrade satisfied peer dependency from @opennextjs/cloudflare.
- Overrides placed in both `overrides` (npm) and `pnpm.overrides` (pnpm) for consistency.
- Report generated: `docs/admin-ops/dependency-audit-2026-06-18.md`

## Acceptance Criteria
- `npm audit --audit-level=high` → 0 vulnerabilities
- `npm run type-check` → 0 errors
- `npm test` → 844+ tests pass
- Changes limited to `package.json` and `package-lock.json`
- No new lint/type/build errors

## Risks
- Breaking changes from transitive upgrades: mitigated by overrides (pinning exact safe versions).
- wrangler downgrade may conflict with @opennextjs/cloudflare: verify `npm run deploy:build` still works after.
- If overrides insufficient, may need to upgrade direct dependents (e.g., inngest, @next/bundle-analyzer).

## Rollback
- Revert commit or `git checkout -- package.json package-lock.json`.