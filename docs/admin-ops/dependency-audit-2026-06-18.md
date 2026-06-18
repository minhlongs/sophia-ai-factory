# Dependency Audit Report - 2026-06-18

## Summary
- Date: 2026-06-18T11:20:00Z (approx)
- Project: sophia-ai-factory (apps/sophia-ai-factory/)
- HIGH vulnerabilities: **0** (target achieved)
- Moderate: 30
- Low: 2

## Changes Applied to package.json

### DevDependencies
- `wrangler`: `^4.101.0` (upgraded from `^4.0.0` to satisfy peer of `@opennextjs/cloudflare@^1.19.9`)
- Added: `@types/webpack`: `^5.0.0` (restore type-check after reinstall)
- No other dev deps changed.

### Dependencies
- Added: `react-is`: `^18.3.1` (peer for `recharts`, fixed failing tests)

### Overrides (npm) & pnpm.overrides
Forced safe versions for transitive dependencies:

| Package | Override version | Reason |
|---|---|---|
| `@grpc/grpc-js` | `^1.14.4` | GHSA-5375-pq7m-f5r2, GHSA-99f4-grh7-6pcq |
| `protobufjs` | `^8.6.0` | GHSA-wcpc-wj8m-hjx6, GHSA-94rc-8x27-4472 |
| `ws` | `^8.19.0` | GHSA-96hv-2xvq-fx4p |
| `vite` | `^8.0.16` | GHSA-fx2h-pf6j-xcff (fs.deny bypass) |
| `form-data` | `^4.0.6` | GHSA-hmw2-7cc7-3qxx (CRLF injection) |
| `glob` | `^13.0.6` | GHSA-5j98-mcp5-4vw2 (cmd injection) |
| `undici` | `^7.25.0` | Multiple high CVEs (decompression, smuggling, CRLF) |
| `@babel/core` | `^7.29.7` | GHSA-4x5r-pxfx-6jf8 (arbitrary file read) |
| `posthog` | `^1.0.0-rc5` | ReDoS |

Note: `@opentelemetry/otlp-transformer` nested protobufjs override not needed; top-level `protobufjs` covers.

## Verification Results

### Audit
```bash
npm audit --audit-level=high
# 0 HIGH, 0 CRITICAL
```

### Type-check
```bash
npm run type-check
# PASSED (0 errors)
```

### Tests
```bash
npm test -- --run
# Test Files: 598 passed, 1 skipped
# Tests: 5829 passed, 34 skipped
```

## Installation Notes

- Used `--legacy-peer-deps` to bypass peer conflict between `wrangler~3.108.0` and `@opennextjs/cloudflare^1.19.9`.
- Resolved by upgrading `wrangler` to `^4.101.0` (latest), which satisfies peer and includes security fixes for its own deps.
- Deleted `package-lock.json` initially to ensure overrides applied cleanly; new lock generated.
- Added missing `@types/webpack` and `react-is` to satisfy type-check and runtime peer deps revealed by fresh install.

## Risk Assessment

- **Breaking changes**: None observed. All tests pass.
- **Deploy impact**: `wrangler` upgrade aligns with `@opennextjs/cloudflare` peer requirement; CF-direct deploy should continue working.
- **Future maintenance**: Overrides will keep transitive deps safe until upstream releases fixed versions that satisfy semver ranges.

## Recommendation

Commit changes to `package.json` and `package-lock.json` with message `fix(T005): upgrade vulnerable dependencies to eliminate HIGH CVEs`.
