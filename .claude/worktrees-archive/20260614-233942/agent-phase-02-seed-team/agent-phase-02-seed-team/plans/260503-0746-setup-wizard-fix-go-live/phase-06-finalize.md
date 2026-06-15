# Phase 06 — Finalize (Docs + Tag)

## Context Links

- All prior phases GREEN
- Documentation rules: `./.claude/rules/documentation-management.md`
- Sophia handover rule: bilingual docs (VN + EN)

## Overview

- **Priority:** P2 (housekeeping, post-go-live)
- **Status:** pending
- **ETA:** 15m
- **Brief:** Update customer-handover-runbook + project-changelog, tag release if appropriate.

## Key Insights

- Runbook is client-facing — non-tech CEO audience — must stay simple + bilingual
- Changelog records: what changed, severity, customer impact
- Tag release only if this fix represents a significant milestone (e.g., go-live readiness)

## Requirements

**Functional:**
- `docs/customer-handover-runbook.md` updated with magic-link → /setup-wizard flow notes
- `docs/project-changelog.md` records: bug-fix entry with severity = HIGH (auth blocker)
- `docs/development-roadmap.md` reflects "setup-wizard go-live" milestone status

**Non-functional:**
- Bilingual entries (VN + EN)
- No technical jargon in customer-facing runbook
- Changelog uses conventional format

## Architecture

```
docs/
  ├── customer-handover-runbook.md   ← user-facing, bilingual
  ├── project-changelog.md            ← technical record
  ├── development-roadmap.md          ← milestone status
  └── system-architecture.md          ← (no change needed unless cookie chain doc'd)
```

## Related Code Files

**Modify:**
- `apps/sophia-ai-factory/docs/customer-handover-runbook.md` (or wherever it lives — verify path)
- `docs/project-changelog.md`
- `docs/development-roadmap.md`

## Implementation Steps

1. **Locate runbook:**
   ```bash
   find /Users/macbook/projects/sophia-ai-factory -iname "*handover-runbook*" -o -iname "*customer-handover*"
   ```
2. **Update runbook** with magic-link flow notes:
   - Section: "Sau khi click magic link / After clicking magic link"
   - Step: page should load /setup-wizard automatically; if redirected to login → contact admin
   - Add troubleshooting: cookie blocking, browser privacy mode warnings
3. **Update changelog:**
   ```markdown
   ## [Unreleased] — 2026-05-03
   ### Fixed
   - **CRITICAL — auth:** Magic-link → /setup-wizard session cookie now correctly recognized by Better Auth (was 307-looping to /login)
   - **i18n:** Completed 15 missing setupWizard.* keys in vi.json and en.json (previously rendered English placeholders)
   ### Changed
   - **observability:** Added structured logging in `getSession()`/`getCurrentUser()` catch blocks for prod diagnostics
   ```
4. **Update roadmap:**
   - Mark "Setup Wizard Go-Live" milestone → COMPLETE
   - Update progress percentage if tracked
5. **Tag release (optional):**
   ```bash
   git tag -a v1.0-setup-wizard-go-live -m "Setup wizard production-ready: magic-link auth fixed + i18n complete"
   git push origin v1.0-setup-wizard-go-live
   ```
6. **Final commit:** `docs: handover runbook + changelog for setup-wizard fix`

## Todo List

- [ ] Locate runbook file
- [ ] Update runbook (bilingual, simple language)
- [ ] Update project-changelog.md
- [ ] Update development-roadmap.md milestone
- [ ] Tag release (if milestone)
- [ ] Final docs commit + push
- [ ] Verify CI passes for docs commit
- [ ] Send handover summary to client (if requested)

## Success Criteria

- Runbook reflects current (working) magic-link flow
- Changelog entry committed
- Roadmap milestone updated
- (Optional) tag pushed
- Client handover material ready for non-tech CEO

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Runbook drift from actual UX | Low | Low | Re-test flow after final docs |
| Tag conflict with existing tag | Low | Low | `git tag -l` first |
| Docs commit triggers needless CI deploy | Low | Low | Acceptable; deploy is idempotent |

## Security Considerations

- Do NOT include API endpoints, secrets, or internal infra paths in customer runbook
- Changelog OK to mention "auth fix" without exposing implementation details

## Next Steps

- This is the last phase. After completion:
  - Notify user of go-live status
  - Monitor `wrangler tail` for next 24h (passive)
  - Review customer feedback channel
- Any new bugs → new plan, NOT amending this one
