# Phase 04 — Hypothesis Resolution (conditional, only if Phase 02 FAIL)

## Context Links
- Debugger report: `plans/reports/debugger-260503-setup-wizard.md` (H1/H2/H3 definitions)
- Phase 02 output JSON
- Phase 03 filtered tail log

## Overview
- Priority: P1 (only runs if Phase 02 verdict = FAIL)
- Status: pending (conditional)
- Description: Pattern-match log evidence against the three hypotheses from the debugger report and produce a one-page fix recommendation. NO code fixes in this phase — pure analysis output to feed a follow-up debugger/coder spawn.

## Key Insights
- The three hypotheses are mutually distinguishable via log signatures:
  - **H1 (cookie name mismatch):** `[Welcome/Consume] Signed session cookie set` present, but layout log shows `cookieNames` array MISSING `__Secure-better-auth.session_token`. Indicates the cookie was set but with wrong name OR the browser didn't store it.
  - **H2 (cookie domain/path scope):** Cookie present in Phase 02 `page.cookies()` snapshot but `cookieNames` array in layout log empty/missing it. Indicates browser stored cookie under different domain/path scope than `/setup-wizard` request.
  - **H3 (D1 cold-start):** `[Welcome/Consume] Signed session cookie set` present, layout log `hasSessionCookie: true`, but still got null user. Indicates `getSession()` ran but D1 lookup returned null (either D1 binding unavailable or row not yet committed).

## Requirements
**Functional**
- Compare Phase 02 `page.cookies()` snapshot vs Phase 03 layout log `cookieNames`
- Inspect `[Welcome/Consume]` log: was it written? what `cookieName` value?
- Match pattern → single H1/H2/H3 verdict (or escalate to "H4: unknown" if no match)
- Produce `plans/reports/hypothesis-resolution-260503-magic-link.md`

**Non-functional**
- Pure analysis, no code changes
- Recommendation must include exact file:line references and the minimal fix delta

## Architecture
```
Phase 02 cookies[] ─┐
                    ├─> compare ──> matched hypothesis ──> fix recommendation
Phase 03 log ──────┘
```

## Decision Matrix
| Symptom | Diagnosis | Fix Path |
|---------|-----------|----------|
| Phase 02: cookie absent in `page.cookies()` | Server never sent Set-Cookie | Check `[Welcome/Consume] Signed session cookie set` log; if missing → `createSessionForUser` failed → escalate to `debugger` agent with `internalAdapter.createSession` instrumentation |
| Phase 02: cookie present, name = `better-auth.session_token` (no `__Secure-`) | NODE_ENV !== production at runtime | Verify `wrangler.toml` `vars.NODE_ENV` or build-time inlining; fix in `welcome/validate/route.ts:152` |
| Phase 02: cookie present + correct name; Phase 03: layout `cookieNames` MISSING it | H2 (browser stored but didn't send) — domain/path scope | Inspect `Set-Cookie` raw header for `Domain=` attribute; align with deployed domain |
| Phase 02: cookie correct + Phase 03: `hasSessionCookie: true` + still null user | H3 (D1 lookup failure) | Add explicit log in `better-auth-session.ts` getCurrentUser catch; spawn `debugger` to trace `auth.api.getSession()` D1 query |
| `[Welcome/Consume]` log absent | `createSessionForUser` returned null | Check `[Welcome/Consume] Could not create Better Auth session via internalAdapter` warn log; root cause = Better Auth context resolution |

## Related Code Files
- Read-only inspection: `route.ts:138-186`, `layout.tsx:32-41`, `better-auth-server.ts`, `better-auth-session.ts`

## Implementation Steps
1. Load Phase 02 JSON output
2. Load Phase 03 filtered log
3. Run decision matrix above
4. Write `plans/reports/hypothesis-resolution-260503-magic-link.md` with:
   - Matched hypothesis + confidence (HIGH/MED/LOW)
   - Exact log lines as evidence
   - Fix recommendation: file:line + proposed change (1-3 line diff)
   - Suggested next agent: `debugger` (root-cause) or `code-reviewer` (sanity check before patching)

## Todo List
- [ ] Parse Phase 02 cookies output
- [ ] Parse Phase 03 filtered log
- [ ] Apply decision matrix → matched hypothesis
- [ ] Write hypothesis-resolution report
- [ ] Recommend next agent + concrete next steps

## Success Criteria
- A single hypothesis identified with HIGH/MED confidence
- Fix recommendation is actionable (file:line cited, delta sketched)
- Report written to `plans/reports/hypothesis-resolution-260503-magic-link.md`

## Risk Assessment
- **R1:** Evidence ambiguous → multiple hypotheses fit → mitigation: re-run Phase 02 with extra logging temporarily added (not in this plan; spawn coder agent)
- **R2:** Symptom doesn't match any of H1/H2/H3 → declare H4 (unknown) and escalate to debugger with full context bundle

## Security Considerations
- Report contains cookie NAMES only (no values) — safe to commit
- Synthetic test user ID is OK in report

## Next Steps
- Hand recommendation to user / spawn `debugger` agent if needed
- Phase 06 captures the FAIL verdict
