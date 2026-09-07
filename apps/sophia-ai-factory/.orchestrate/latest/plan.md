# Post-Commit Forensic Audit: db4852d50

## Overview

**Commit:** `db4852d50826b5c5a845705bc5a57483a8dca855`
**Author:** minhlongs
**Date:** Mon Sep 7 13:40:15 2026 +0800
**Subject:** `feat(ai): provider certification enforcement + image provider v1`
**Scope:** 40 files changed, +5843/-455

**Purpose:** Read-only post-commit forensic audit answering 8 questions (A through H). No edits, no commits, no production deployments.

**Work mode:** DEBUGGER agent (investigation and diagnosis focus).

**Report output:** `plans/reports/post-command-5-forensic-audit.md`

---

## Commit Manifest

Files changed (grouped by concern):

**Provider Certification (new)**
- `src/seed/ai/provider-certification.ts` — 5-state enum + enforcement logic
- `src/seed/ai/__tests__/provider-certification.test.ts` — certification tests
- `src/seed/ai/provider-registry.ts` — registry integration with certification
- `src/seed/ai/cost-estimator.ts` — cost estimation changes

**Image Generation (new)**
- `src/seed/ai/providers/openrouter-image-generation-adapter.ts` — OpenRouter image adapter
- `src/seed/ai/providers/__tests__/openrouter-image-generation-adapter.test.ts` — image adapter tests
- `src/forest/inngest/functions/creative-image-generate.ts` — Inngest image job
- `src/forest/inngest/functions/__tests__/creative-image-generate.test.ts` — Inngest image tests

**Router / Factory changes**
- `src/forest/ai/provider-factory.ts` — factory integration with certification
- `src/forest/ai/cost-aware-router.ts` — router integration with certification

**Hermes removal**
- `src/seed/ai/providers/hermes-antigravity-adapter.ts` — DELETED
- `src/seed/ai/providers/__tests__/hermes-antigravity-adapter.test.ts` — DELETED

**BYOK / API Key store**
- `src/tree/byok/user-api-key-store.ts` — key store changes
- `src/app/api/user/byok/test/route.ts` — BYOK test endpoint

**Type changes**
- `src/seed/types/creative-intelligence.ts`
- `src/seed/types/creative-storyboard.ts`
- `src/seed/types/creative.ts`
- `src/seed/types/failure-kind.ts`
- `src/seed/types/failure-kind.test.ts`

**Circuit breaker**
- `src/seed/config/circuit-breaker.ts`

**Docs (added)**
- `docs/HERMES_PROVIDER_CERTIFICATION.md`
- `docs/IMAGE_PROVIDER_V1.md`
- `docs/PROVIDER_CERTIFICATION_POLICY.md`
- `docs/HERMES_INTELLIGENCE_V2.md`
- `docs/SOPHIA_FULL_SYSTEM_RECONCILIATION.md`
- `docs/changelog/2026-Q3.md`
- `plans/reports/recon-*.md` (12 recon reports)

---

## Audit Questions (A-H)

---

### Question A: Provider Certification Enforcement

**Question:** Does the provider certification system actually enforce constraints at runtime, or is it advisory/decorative?

**Read-only files:**
- `/Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/src/seed/ai/provider-certification.ts`
- `/Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/src/seed/ai/provider-registry.ts`
- `/Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/src/forest/ai/provider-factory.ts`
- `/Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/src/forest/ai/cost-aware-router.ts`
- `/Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/src/seed/ai/__tests__/provider-certification.test.ts`

**Approach:**
1. Read `provider-certification.ts` — identify the 5-state enum values and all exported functions
2. Grep all callers of certification functions across `provider-registry.ts`, `provider-factory.ts`, `cost-aware-router.ts` — trace every call site
3. Determine: do any call sites enforce a hard gate (throw / return error / skip provider) vs. only logging/advisory behavior?
4. Read `provider-certification.test.ts` — count how many test cases assert hard enforcement vs. only advisory behavior
5. Check for missing enforcement paths: grep for places where a provider is used WITHOUT certification check

**Acceptance criteria:**
- [ ] Enum values listed with exact definitions
- [ ] Every caller of certification functions identified with enforcement behavior (hard gate vs advisory)
- [ ] Gap analysis: which providers/paths skip certification
- [ ] Test coverage assessment: hard enforcement vs advisory test ratio

---

### Question B: Hermes Architectural Decision

**Question:** Was the Hermes adapter deleted entirely, or are there dangling references, orphaned imports, or dead code paths still pointing to it?

**Read-only files:**
- Verify `hermes-antigravity-adapter.ts` is deleted from `src/seed/ai/providers/`
- Verify `hermes-antigravity-adapter.test.ts` is deleted from `src/seed/ai/providers/__tests__/`
- `src/seed/ai/provider-registry.ts` — check for Hermes references
- `src/forest/ai/provider-factory.ts` — check for Hermes references
- `src/seed/ai/index.ts` — check exports

**Approach:**
1. `grep -r "hermes" --include="*.ts" --include="*.tsx"` across entire `src/` tree
2. `grep -r "antigravity" --include="*.ts" --include="*.tsx"` across entire `src/` tree
3. Check `provider-registry.ts` for any Hermes entries in provider maps/enums
4. Check `provider-factory.ts` for Hermes case branches or type guards
5. Check `src/seed/ai/index.ts` for re-exports of deleted file
6. Check `docs/` for stale Hermes references that contradict deletion

**Acceptance criteria:**
- [ ] Zero references to Hermes/antigravity in compiled code paths (docs excluded)
- [ ] Registry has no Hermes entry in provider map
- [ ] Factory has no Hermes case branch
- [ ] No broken imports that would cause compile errors
- [ ] Docs accurately reflect deletion (not stale)

---

### Question C: OpenRouter Image Capability Truth

**Question:** Does the OpenRouter image generation adapter actually work, or does it have untested/incorrect claims about capabilities?

**Read-only files:**
- `/Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/src/seed/ai/providers/openrouter-image-generation-adapter.ts`
- `/Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/src/seed/ai/providers/__tests__/openrouter-image-generation-adapter.test.ts`
- `/Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/src/seed/ai/provider-interface.ts` — interface the adapter must satisfy
- `/Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/src/seed/ai/provider-certification.ts` — certification state assigned

**Approach:**
1. Read adapter source — identify: supported models, capabilities declared, error handling, actual API call structure
2. Read adapter tests — identify: what is actually tested vs mocked, coverage gaps
3. Compare declared capabilities against what the test actually exercises
4. Check if the adapter implements the full provider interface or has stub/TODO methods
5. Trace the actual HTTP call path — is it a real OpenRouter API endpoint or a mock?
6. Verify the adapter correctly implements any certification state it claims

**Acceptance criteria:**
- [ ] Declared capabilities listed with evidence (file:line)
- [ ] Test cases enumerated with what each actually validates
- [ ] Gap analysis: declared vs tested capabilities
- [ ] Assessment: working adapter vs prototype vs stub

---

### Question D: Cloudflare Compatibility

**Question:** Can all new code run in Cloudflare Workers/Pages (no Node.js-only APIs)?

**Read-only files:**
- `/Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/src/seed/ai/provider-certification.ts`
- `/Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/src/seed/ai/providers/openrouter-image-generation-adapter.ts`
- `/Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/src/forest/inngest/functions/creative-image-generate.ts`
- `/Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/src/seed/ai/cost-estimator.ts`
- `/Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/src/tree/byok/user-api-key-store.ts`

**Approach:**
1. Grep new/changed files for Node.js-only APIs: `fs.`, `path.`, `require(`, `__dirname`, `__filename`, `process.env` (in non-cron context), `Buffer.from` (verify usage), `crypto.randomUUID` (CF-compatible), `child_process`
2. Check for `import` of Node.js built-in modules (`node:fs`, `node:path`, `node:crypto`)
3. Verify the image generation adapter uses only `fetch()` and CF-compatible APIs
4. Check creative-image-generate.ts for any Node.js-only patterns in the Inngest function body
5. Check if provider-certification.ts uses any platform-specific code
6. Verify no `process.exit()`, `process.cwd()`, or similar Worker-incompatible calls

**Acceptance criteria:**
- [ ] Zero Node.js-only API usage in new files (or documented exceptions)
- [ ] All fetch calls use CF-compatible patterns
- [ ] No blocking I/O (fs.readFileSync, etc.)
- [ ] Environment variable access uses CF-compatible pattern (env.VAR_NAME, not process.env)
- [ ] Assessment: safe for CF Workers/Pages deployment

---

### Question E: Image Job End-to-End Truth

**Question:** Does the image generation pipeline work end-to-end from Inngest trigger to provider call to result storage, or are there broken links?

**Read-only files:**
- `/Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/src/forest/inngest/functions/creative-image-generate.ts`
- `/Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/src/forest/inngest/functions/__tests__/creative-image-generate.test.ts`
- `/Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/src/seed/ai/providers/openrouter-image-generation-adapter.ts`
- `/Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/src/seed/ai/provider-registry.ts`
- `/Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/src/seed/ai/provider-certification.ts`
- `/Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/src/forest/ai/provider-factory.ts`

**Approach:**
1. Read `creative-image-generate.ts` — trace the full function body from entry to provider call to result handling
2. Map the data flow: trigger -> provider selection -> image generation -> result storage
3. Identify any broken links: missing function calls, undefined variables, unimplemented branches
4. Read the test file — determine if the test exercises the full path or only isolated units
5. Check if the Inngest function is properly registered in the Inngest client (grep for `createFunction` or `inngest.createFunction`)
6. Verify provider selection in the function uses the certification system correctly
7. Check error handling: what happens when the provider call fails? Retry? Dead letter? Silent drop?

**Acceptance criteria:**
- [ ] Complete data flow map from trigger to storage (with file:line references)
- [ ] Every step in the pipeline has a concrete implementation (no TODO/placeholder)
- [ ] Error handling paths identified and assessed (retry strategy, dead letter)
- [ ] Test coverage assessment: full-path integration test vs isolated unit tests
- [ ] Registration verified: function is reachable from Inngest trigger

---

### Question F: Test Baseline Reconciliation

**Question:** Why did the test count drop from 8855 to 8841 (delta -14), and is this loss fully explained by the Hermes deletion or are there other causes?

**Read-only files:**
- `src/seed/ai/providers/__tests__/hermes-antigravity-adapter.test.ts` — DELETED (count tests)
- `src/seed/ai/providers/__tests__/openrouter-image-generation-adapter.test.ts` — NEW (count tests)
- `src/seed/ai/__tests__/provider-certification.test.ts` — NEW (count tests)
- `src/forest/inngest/functions/__tests__/creative-image-generate.test.ts` — NEW (count tests)
- `src/seed/types/failure-kind.test.ts` — CHANGED (count delta)
- `src/seed/ai/provider-certification.ts` — changes may affect existing tests

**Approach:**
1. `git show db4852d50~1:src/seed/ai/providers/__tests__/hermes-antigravity-adapter.test.ts | grep -c "it("` — count deleted Hermes tests
2. `grep -c "it(" src/seed/ai/providers/__tests__/openrouter-image-generation-adapter.test.ts` — count new image adapter tests
3. `grep -c "it(" src/seed/ai/__tests__/provider-certification.test.ts` — count certification tests
4. `grep -c "it(" src/forest/inngest/functions/__tests__/creative-image-generate.test.ts` — count image job tests
5. Run `git diff db4852d50~1..db4852d50 -- src/seed/types/failure-kind.test.ts` — check if test count changed
6. Grep for `describe.skip`, `it.skip`, `xit(`, `test.skip` in new files — count skipped tests
7. Check if any existing tests broke due to certification changes (grep for test files that import changed modules)
8. Mathematical reconciliation: old_count - deleted + new + delta_existing = expected_new_count vs actual 8841

**Acceptance criteria:**
- [ ] Hermes test count (deleted) documented with exact number
- [ ] New test counts documented (image adapter, certification, image job)
- [ ] Mathematical reconciliation showing exact delta explanation
- [ ] Any unexplained delta identified with probable cause
- [ ] Skipped/newly-skip tests documented
- [ ] Whether delta -14 is: (a) fully explained, (b) partially explained, or (c) unexplained

---

### Question G: Security Regression

**Question:** Does this commit introduce any security regressions (exposed keys, broken auth, injection vectors, unsafe deserialization)?

**Read-only files:**
- `/Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/src/tree/byok/user-api-key-store.ts`
- `/Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/src/app/api/user/byok/test/route.ts`
- `/Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/src/seed/ai/provider-certification.ts`
- `/Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/src/seed/ai/providers/openrouter-image-generation-adapter.ts`
- `/Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/src/forest/inngest/functions/creative-image-generate.ts`
- `/Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/src/seed/config/circuit-breaker.ts`

**Approach:**
1. Read `user-api-key-store.ts` — check for: key encryption, key exposure in logs/errors, proper access control, no plaintext storage
2. Read `byok/test/route.ts` — check for: auth enforcement, input validation, rate limiting, no key leakage in responses
3. Grep all changed files for: `console.log` with sensitive data, hardcoded secrets, `eval(`, `new Function(`, unsanitized user input in queries
4. Check `openrouter-image-generation-adapter.ts` for: API key handling, no key in URL params, proper headers
5. Check `creative-image-generate.ts` for: injection via user-supplied prompts, image URL handling, resource exhaustion
6. Check `circuit-breaker.ts` for: state mutation safety, no race conditions in state transitions
7. Check if any Zod validation was removed or weakened in changed files
8. `grep -r "process.env\." src/ --include="*.ts"` in new files — verify no hardcoded keys

**Acceptance criteria:**
- [ ] API key handling assessed across all key store and adapter files
- [ ] No hardcoded secrets in any changed file
- [ ] Auth enforcement verified on BYOK test endpoint
- [ ] Input validation assessed for injection vectors
- [ ] Console.log audit: no sensitive data in production logging
- [ ] Overall security assessment: REGRESSION / SAFE / CONDITIONAL

---

### Question H: Architecture Integrity

**Question:** Does this commit maintain or violate the existing architecture (import hierarchy, module boundaries, type safety, tier constraints)?

**Read-only files:**
- `/Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/src/seed/ai/index.ts` — module boundary
- `/Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/src/seed/ai/provider-registry.ts` — registry
- `/Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/src/forest/ai/provider-factory.ts` — factory
- `/Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/src/forest/ai/cost-aware-router.ts` — router
- `/Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/src/seed/ai/provider-certification.ts` — new module
- `/Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/src/seed/ai/provider-interface.ts` — interface contract
- `/Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/CLAUDE.md` — architecture rules
- `/Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/docs/` — architecture docs

**Approach:**
1. Check import hierarchy: does `seed/` import from `forest/`? (forbidden direction) — grep for violations
2. Check if `provider-certification.ts` lives in the correct module boundary (`seed/ai/`)
3. Check if `openrouter-image-generation-adapter.ts` follows the adapter pattern established by other providers
4. Verify the provider interface contract is not broken — check for `:any` types, missing interface methods
5. Check for banned imports: `@/lib/auth`, `@/lib/subscription`, `@/lib/unified-tier-config`, `@/lib/tier-gate`
6. Verify tier enum compliance: all tier references use `BASIC | PREMIUM | ENTERPRISE | MASTER` (uppercase)
7. Check for `:any` types in all changed files
8. Verify the adapter correctly extends/implements the provider interface
9. Check if the 5-state certification enum introduces a new state that conflicts with existing states

**Acceptance criteria:**
- [ ] Import hierarchy violations: 0 (or documented exceptions)
- [ ] Module boundary compliance: certification in seed/ai, not forest/
- [ ] Adapter pattern followed consistently with existing providers
- [ ] Zero `:any` types in changed files
- [ ] Tier enum compliance verified
- [ ] Banned import check: zero violations
- [ ] Interface contract: provider implements full interface
- [ ] Overall architecture assessment: CONSISTENT / DEGRADED / VIOLATED

---

## Execution Plan

### Phase 1: Test Baseline Reconciliation (Question F)

**Rationale:** Start here because understanding the test delta is foundational to all other audit questions. If tests were broken, it affects certification enforcement (A), image adapter quality (C), and end-to-end flow (E).

**Agent:** `debugger`
**Steps:**
1. Run `git show db4852d50~1:src/seed/ai/providers/__tests__/hermes-antigravity-adapter.test.ts | grep -c "it("` to count deleted tests
2. Count new tests in `provider-certification.test.ts`, `openrouter-image-generation-adapter.test.ts`, `creative-image-generate.test.ts`
3. Run `git diff db4852d50~1..db4852d50 -- src/seed/types/failure-kind.test.ts` for delta
4. Grep for skipped tests in new files
5. Mathematical reconciliation
6. Document findings

### Phase 2: Provider Certification Enforcement (Question A)

**Agent:** `debugger`
**Steps:**
1. Read `provider-certification.ts` — full source
2. Trace all call sites in registry, factory, router
3. Read certification test file — count enforcement vs advisory tests
4. Gap analysis: which paths lack certification checks
5. Document findings

### Phase 3: Hermes Cleanup Verification (Question B)

**Agent:** `debugger`
**Steps:**
1. `grep -r "hermes" --include="*.ts" --include="*.tsx"` across `src/`
2. `grep -r "antigravity" --include="*.ts" --include="*.tsx"` across `src/`
3. Check registry, factory, index.ts for references
4. Check docs for stale references
5. Document findings

### Phase 4: OpenRouter Image Adapter (Question C)

**Agent:** `debugger`
**Steps:**
1. Read adapter source — full source
2. Read adapter tests — full source
3. Compare declared capabilities vs tested capabilities
4. Check interface implementation completeness
5. Document findings

### Phase 5: Cloudflare Compatibility (Question D)

**Agent:** `debugger`
**Steps:**
1. Grep all new/changed files for Node.js-only APIs
2. Check fetch usage patterns
3. Verify env access patterns
4. Check for blocking I/O
5. Document findings

### Phase 6: Image Job End-to-End (Question E)

**Agent:** `debugger`
**Steps:**
1. Read `creative-image-generate.ts` — trace full data flow
2. Verify Inngest function registration
3. Check error handling paths
4. Compare test coverage vs actual flow
5. Document findings

### Phase 7: Security Audit (Question G)

**Agent:** `debugger`
**Steps:**
1. Read key store and BYOK endpoint — check for key exposure
2. Grep for hardcoded secrets, console.log with sensitive data
3. Check input validation and auth enforcement
4. Assess circuit breaker for race conditions
5. Document findings

### Phase 8: Architecture Integrity (Question H)

**Agent:** `debugger`
**Steps:**
1. Check import hierarchy violations
2. Verify module boundaries
3. Check for banned imports and `:any` types
4. Verify adapter pattern and interface contracts
5. Document findings

### Phase 9: Final Report

**Agent:** `debugger`
**Steps:**
1. Compile all findings from Phases 1-8
2. Write comprehensive report to `plans/reports/post-command-5-forensic-audit.md`
3. Include: TL;DR, per-question findings, risk assessment, recommendations

---

## Guardrails

- **READ-ONLY:** No file edits, no commits, no production deployments
- **No git operations:** Only `git show`, `git diff`, `git log` for historical inspection
- **No test execution:** Do not run tests — use grep and source analysis only
- **No dependency changes:** Do not install, update, or remove packages
- **Work context:** `/Users/macbook/sophia-ai-factory/apps/sophia-ai-factory`
- **Reports path:** `/Users/macbook/sophia-ai-factory/plans/reports/`

---

## Agent Configuration

| Phase | Agent Type | Description |
|-------|-----------|-------------|
| 1-8 | `debugger` | Read-only investigation and diagnosis |
| 9 | `debugger` | Report compilation and writing |

**Total estimated tokens:** High (40 files to read, comprehensive grep operations)
**Estimated time:** 15-20 minutes (parallel phases where possible)

---

## Success Criteria

The audit is complete when:
1. All 8 questions (A-H) have documented findings with evidence (file:line references)
2. Each question has a clear verdict: PASS / CONDITIONAL / FAIL
3. Mathematical test reconciliation is complete (Phase 1)
4. Final report written to `plans/reports/post-command-5-forensic-audit.md`
5. Zero edits to production code

---

## Notes

- Commit db4852d50 is already deployed (40 files, +5843/-455)
- Test baseline dropped from 8855 to 8841 (delta -14)
- Hermes adapter fully deleted from source
- New files: provider-certification, openrouter-image-generation-adapter, creative-image-generate
- Production deployment is FORBIDDEN for this audit
- All recon reports in `plans/reports/recon-*.md` are part of this commit but are documentation only
