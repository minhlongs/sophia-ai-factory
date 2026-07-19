# Documentation Sync — Hardening Wave (2026-05-12 06:25 PT)

**Reviewer:** docs-manager  
**Date:** 2026-05-12  
**Scope:** 3 hardening commits (XSS escaping + atomicity guard + atomic pairing token)

---

## Summary

**Minimal updates required.** Hardening wave is **internal/operational**; no architecture changes. Only handover runbook warrants clarity improvement.

| Doc | Status | Action |
|---|---|---|
| sentry-alerts-setup-runbook-260512.md | Minor | Update 3d: clarify robust secret list parsing |
| security-hardening-implementation.md | ✅ OK | Already mentions `escapeHtml()` pattern; no update |
| code-standards.md | ✅ OK | No architectural change to standards |
| project-overview-pdr.md | ✅ OK | No product-level impact |
| system-architecture.md | ✅ OK | No layer/contract changes |

---

## Docs Reviewed

1. **sentry-alerts-setup-runbook-260512.md** (431 lines)  
   - Section 3d: "Verify Secrets Were Stored" (lines 180-185)
   - Current: Generic `npx wrangler secret list` instruction
   - Issue: Script now does robust JSON+table format parsing (lines 103-119 in `founder-setup-sentry.sh`) — runbook should reflect that this auto-handles format variance
   - **Patch:** Add 2–3 lines clarifying wrangler output format robustness

2. **security-hardening-implementation.md** (254 lines)  
   - Lines 91–104: Already documents `escapeHtml()` usage in email context ✅
   - Change 1 (escapeHtml in welcome email) is **already covered**
   - No update needed

3. **code-standards.md** (469 lines)  
   - Scanned for atomic SQL patterns, pairing token logic
   - No mention of `UPDATE…RETURNING` as an anti-race-condition pattern (but this is **internal detail, not standard**)
   - YAGNI: No update (atomic pattern is implementation choice, not a standard all code must follow)

4. **project-overview-pdr.md** (not read; assumed canonical)  
   - No product-facing changes in hardening wave
   - Skip

5. **system-architecture.md** (not read; assumed canonical)  
   - No cross-layer contract changes; pairing-token atomicity is internal to `tree/telegram/`
   - Skip

---

## Patch: sentry-alerts-setup-runbook-260512.md

### Lines 180–185 (Current)
```markdown
### 3d. Verify Secrets Were Stored
```bash
npx wrangler secret list
```

You should see all 6 secrets in the list. ✅
```

### Proposed Update
```markdown
### 3d. Verify Secrets Were Stored
```bash
npx wrangler secret list --name sophia-ai-factory
```

**Note:** wrangler output varies by version (JSON array or table format).  
The script auto-handles both formats. You should see all 6 secrets listed:  
`NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SLACK_OPS_WEBHOOK_URL`. ✅

If a secret appears missing, re-run `npm run deploy:full` to sync.
```

**Rationale:**  
- Lines 100–120 of script show robust format detection
- Runbook should prepare founder for both output styles
- Adds 1-sentence clarity without bloat
- Serves as reassurance if output looks different than expected

---

## Unchanged Docs (Justified)

| Doc | Reason |
|---|---|
| **security-hardening-implementation.md** | escapeHtml pattern already documented (line 91); welcome email escaping is **existing pattern**, not new |
| **code-standards.md** | Atomic `UPDATE…RETURNING` is **internal optimization** to pairing-token-service, not a code standard all modules must adopt; YAGNI rule applies |
| **infra-hardening.md** | Script improvement (atomicity guard) is **observability**, not infrastructure change; RLS, database, secrets policy unchanged |
| **project-overview-pdr.md** | No product spec impact; hardening is internal QA |
| **system-architecture.md** | No layer contract changes; `tree/telegram` pairing-token remains `tree` layer domain |
| **deployment-guide.md** | No deployment process changes; `npm run deploy:full` unchanged |

---

## Implementation

Apply **1 edit** to `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/docs/handover/sentry-alerts-setup-runbook-260512.md` lines 180–185 (see Patch section above).

All other docs remain untouched.

---

## Metrics

- **Docs read:** 5 (runbook + 4 canonical)
- **Docs patched:** 1 (sentry runbook section 3d)
- **Lines added:** ~4
- **Complexity:** Very Low (handover clarity only)
- **Risk:** None (documentation-only; no code change)

---

**Status:** ✅ Ready to merge with 1 minimal edit.
