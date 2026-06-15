# Phase 00: Foundation — Node.js 24+ + Quality Gates

**Priority:** P0 (Blocking)  
**Status:** Not Started  
**Estimated Duration:** 4 hours

---

## Context Links

- **Deep Research Report:** Section 2 — "Điểm nghẽn delivery/quality" #1 (Node.js 22.22.3)
- **Deep Research Report:** Section 5 — "Commands quan trọng" — quality gates commands
- **Deep Research Report:** Section 6 — "Tóm tắt verdict" — Foundation first

---

## Overview

Upgrade Node.js from 22.22.3 to >=24.0.0 (CLEO requirement) and verify all quality gates pass before any further work.

**Why this is blocking:**
- CLEO (Claude Code orchestrator) requires Node.js >= 24.0.0 for worktree isolation
- Without worktree isolation, parallel agent teams cannot safely edit files
- Quality gates must pass to ensure production readiness

---

## Key Insights

**Current state:**
- `node --version` → 22.22.3 (check via `nvm current` or `fnm current`)
- CLEO worktree isolation documented in `~/.claude/rules/sophia-handover-rules.md` requires Node 24+
- Quality gates defined in `package.json` scripts:
  - `ci:typecheck` → `tsc --noEmit`
  - `ci:test` → `vitest run`
  - `ci:lint` → `biome check` or `eslint`
  - `ci:get-side-effects` → verify no GET routes with DB writes

**Target state:**
- Node.js 24.x LTS (latest patch)
- All quality gates exit code 0
- No new warnings/errors introduced

---

## Requirements

### Functional
1. Upgrade Node.js to >=24.0.0 (use nvm, fnm, or asdf)
2. Reinstall dependencies to ensure binary compatibility
3. Run all quality gates and capture results
4. Document any issues found and fix if within scope

### Non-Functional
1. Zero downtime — local development environment only
2. Preserve existing `node_modules` lockfile integrity
3. No breaking changes to toolchain (pnpm, wrangler, etc.)
4. All commands must be reproducible (document exact steps)

---

## Architecture

**Toolchain:**
```
nvm/fnm → Node version manager
pnpm → package manager (lockfile: pnpm-lock.yaml)
tsc → TypeScript compiler (noEmit)
vitest → test runner
biome/eslint → linter
wrangler → Cloudflare CLI
```

**Quality gates pipeline:**
```
npm run ci:typecheck   → tsc --noEmit (exit 0 = no type errors)
npm run ci:test        → vitest run (all tests pass)
npm run ci:lint        → biome check (no errors)
npm run ci:get-side-effects → custom script (no violations)
```

---

## Related Code Files

**Configuration files to check:**
- `.nvmrc` or `.node-version` — Node version pin (may need update)
- `package.json` — scripts section for quality gate commands
- `tsconfig.json` — TypeScript config
- `vitest.config.ts` — test config
- `.claude/settings.json` — agent configuration (no changes needed)

**No production code changes required** — this phase is infrastructure only.

---

## Implementation Steps

### Step 1: Check current Node.js version

```bash
cd /Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory
node --version  # Expect: v22.22.3 (or similar)
nvm current      # or: fnm current
```

**Expected output:** `v22.22.3` (or any 22.x)

**If not using nvm/fnm:** Install fnm (fast, recommended):
```bash
# Install fnm if not present
curl -fsSL https://fnm.vercel.app/install | bash
# Restart shell or source ~/.zshrc
fnm install 24
fnm use 24
```

**Using nvm:**
```bash
nvm install 24
nvm use 24
nvm alias default 24  # optional: make 24 default
```

### Step 2: Verify Node.js >= 24.0.0

```bash
node --version
# Must output: v24.x.x
# Compare: echo "$(node --version | cut -d'v' -f2)" | awk '{print ($1 >= 24.0) ? "OK" : "FAIL"}'
```

**Exit 0** if `node --version` starts with `v24` or higher.

### Step 3: Reinstall dependencies (fresh sync)

```bash
# Clean install to ensure native modules rebuild correctly
rm -rf node_modules
pnpm install --frozen-lockfile=false
# --frozen-lockfile=false allows lockfile updates if needed
```

**Note:** If `better-sqlite3` or other native modules fail, run:
```bash
pnpm rebuild better-sqlite3
```

### Step 4: Run quality gates (capture outputs)

```bash
# Typecheck
npm run ci:typecheck 2>&1 | tee /tmp/typecheck.log
TYPECHECK_EXIT=${PIPESTATUS[0]}

# Tests
npm run ci:test 2>&1 | tee /tmp/test.log
TEST_EXIT=${PIPESTATUS[0]}

# Lint
npm run ci:lint 2>&1 | tee /tmp/lint.log
LINT_EXIT=${PIPESTATUS[0]}

# Side-effects check
npm run ci:get-side-effects 2>&1 | tee /tmp/side-effects.log
SIDEEFFECTS_EXIT=${PIPESTATUS[0]}
```

**Capture summary:**
```bash
echo "=== Quality Gates Summary ===" > /tmp/quality-summary.txt
echo "Node.js: $(node --version)" >> /tmp/quality-summary.txt
echo "Typecheck exit: $TYPECHECK_EXIT" >> /tmp/quality-summary.txt
echo "Test exit: $TEST_EXIT" >> /tmp/quality-summary.txt
echo "Lint exit: $LINT_EXIT" >> /tmp/quality-summary.txt
echo "Side-effects exit: $SIDEEFFECTS_EXIT" >> /tmp/quality-summary.txt
```

### Step 5: Analyze failures (if any)

**If TYPECHECK_EXIT != 0:**
- Read `/tmp/typecheck.log` tail: `tail -50 /tmp/typecheck.log`
- Count errors: `grep -c "error" /tmp/typecheck.log`
- Document in summary

**If TEST_EXIT != 0:**
- Extract test failure count from vitest output
- Example: `grep -E "FAIL|✓" /tmp/test.log | tail -20`
- Note: Some tests may be skipped (environmental) — distinguish

**If LINT_EXIT != 0:**
- Count lint errors: `biome check --formatter=json 2>/dev/null | jq '.errors | length'`
- Or parse log: `grep -c "error" /tmp/lint.log`

**If SIDEEFFECTS_EXIT != 0:**
- Review violations: `cat /tmp/side-effects.log`
- Must fix any GET routes with DB writes before ship

### Step 6: Document results

Create `plans/260614-arch-debug-fixes/phase-00-results.md`:

```markdown
# Phase 00 Results

**Node.js version:** v24.x.x  
**Timestamp:** $(date -u +%Y-%m-%dT%H:%M:%SZ)

## Quality Gates

| Gate | Exit Code | Tests Passed | Failures | Notes |
|------|-----------|--------------|----------|-------|
| Typecheck | $TYPECHECK_EXIT | — | — | See /tmp/typecheck.log |
| Test | $TEST_EXIT | (extract from log) | (extract) | |
| Lint | $LINT_EXIT | — | (count) | |
| Side-effects | $SIDEEFFECTS_EXIT | — | — | |

## Decision

- [ ] All gates passed (exit 0) → proceed to Phase 1
- [ ] Some gates failed but within acceptable threshold (document exceptions)
- [ ] Critical failures — block ship, escalate to CTO

## Next Steps

If all gates pass: notify Phase 1 (OpenClaw executor) to start.
If failures: assign remediation tasks to appropriate specialists.
```

---

## Todo List

- [ ] Check current Node.js version (expect 22.x)
- [ ] Install Node.js 24+ (nvm/fnm)
- [ ] Switch to Node 24
- [ ] Verify `node --version` >= 24.0.0
- [ ] Reinstall dependencies (`pnpm install`)
- [ ] Run `npm run ci:typecheck` → capture exit code
- [ ] Run `npm run ci:test` → capture exit code + test summary
- [ ] Run `npm run ci:lint` → capture exit code
- [ ] Run `npm run ci:get-side-effects` → capture exit code
- [ ] Document results in `phase-00-results.md`
- [ ] Decision: proceed or remediate

---

## Success Criteria

**Definition of Done:**
- `node --version` outputs v24.x.x (>=24.0.0)
- All quality gates exit 0 OR failures documented and approved by CTO
- `phase-00-results.md` created with complete summary
- Dependencies successfully installed with pnpm

**Validation methods:**
1. `node --version | grep -E '^v24|^v25'` → exit 0
2. `npm run ci:typecheck` → exit 0
3. `npm run ci:test` → exit 0, output shows "Test Files X passed | Y failed" with Y=0 or within threshold
4. `npm run ci:lint` → exit 0
5. `npm run ci:get-side-effects` → exit 0
6. File `plans/260614-arch-debug-fixes/phase-00-results.md` exists and is populated

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Native module rebuild fails (better-sqlite3) | Medium | High | Run `pnpm rebuild`; if still fails, use prebuilt binaries or switch to `better-sqlite3` compatible version |
| pnpm lockfile update causes CI drift | Low | Medium | Commit lockfile changes immediately after Phase 0; notify team |
| Quality gates fail due to environmental differences | Medium | Medium | Ensure test env vars loaded (`.env.test`); run from project root |
| Node 24 breaks some toolchain (wrangler) | Low | Medium | Verify `wrangler --version` still works; if not, upgrade wrangler |
| Some tests are flaky under Node 24 | Low | Low | Re-run failed tests individually to identify flakes; document |

---

## Security Considerations

- **Node.js source:** Download from official nodejs.org; verify checksums if possible
- **Version pinning:** Record exact version in `.nvmrc` or `.node-version` for reproducibility
- **No secrets exposed:** Quality gate logs should not contain API keys, DB URLs, or tokens
- **Lockfile integrity:** Keep `pnpm-lock.yaml` committed; review changes before push

---

## Next Steps

1. After Phase 00 complete and gates passing → notify Phase 1, 2, 3 to start in parallel
2. Record Node version in `.nvmrc` for team consistency
3. Update `docs/deployment-guide.md` with Node 24 requirement
4. If any quality gate failures require code fixes, create subtasks and assign before proceeding

---

## Commands Reference

```bash
# Node version check
node --version

# Install Node 24 (fnm)
fnm install 24
fnm use 24

# Or nvm
nvm install 24
nvm use 24

# Reinstall deps
rm -rf node_modules
pnpm install

# Quality gates
npm run ci:typecheck
npm run ci:test
npm run ci:lint
npm run ci:get-side-effects
```

---

**END OF PHASE 00**
