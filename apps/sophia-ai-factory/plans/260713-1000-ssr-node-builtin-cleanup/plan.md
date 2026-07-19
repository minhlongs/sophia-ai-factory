---
status: in_progress
created: 2026-07-13T10:00:00Z
priority: critical
---

# Plan: SSR Node Builtin Cleanup — Fix Worker Crash

## Problem
Cloudflare Workers returns HTTP 500. Root cause: Node.js builtins (`node:child_process`, `node:fs`, `node:path`, `node:os`, `node:crypto`) are pulled into SSR `handler.mjs` by Turbopack bundler.

## Phases

### P1: `dlq-verification-script.ts`
- Move top-level `node:fs`/`node:url`/`node:path` code into `function run()`
- Add `if (import.meta.url === url.pathToFileURL(process.argv[1]).href)` guard
- Export `run` for programmatic use

**Files:** `src/land/billing/dlq-verification-script.ts`
**Risk:** Low (script-only, no public API change)

### P2: `ftc-disclosure-overlay.ts`
- Keep all imports at top-level (same pattern as `hash-chain-verification`)
- Move FFmpeg pipeline body behind existing lazy-exec pattern

**Files:** `src/land/video/assembly/ftc-disclosure-overlay.ts`
**Risk:** None (unchanged behavior, just deferred execution)

### P3: `crypto-disclaimer-overlay.ts`
- Same fix as P2

**Files:** `src/land/video/assembly/crypto-disclaimer-overlay.ts`
**Risk:** None

### P4: Verify + Deploy
- Run `git diff --check`, lint affected files
- `bash scripts/deploy-with-sha.sh SKIP_TSC=1 SKIP_TESTS=1`
- Verify `curl https://sophia.agencyos.network` → HTTP 200
- Commit: `fix(ssr): defer node:builtin imports to avoid worker crash`

## Acceptance Criteria
- [ ] No `node:child_process`/`node:fs`/`node:path`/`node:os`/`node:util` in SSR handler
- [ ] `npm run lint` passes on modified files
- [ ] Production returns HTTP 200
- [ ] `/api/version` returns matching shortSHA
