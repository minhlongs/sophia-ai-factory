# Docs Manager Report — Phase 25 Changelog Entry

**Date:** 2026-04-24  
**Phase:** 25  
**Time:** 02:02  
**Task:** Logger-utility structured metadata pickup — code/details/hint extraction

---

## Changes Made

### File: `docs/project-changelog.md`

**Action:** ADD changelog entry for Phase 25 (v1.12.11)

**Summary:** 21 lines added documenting:
- Extended `LogEntry.error` interface with optional fields (code, details, hint)
- Conditional spread of error metadata in `log()` function
- Dev-mode JSON rendering of metadata details post-stack
- Phase coupling bridge closed: Phase 15 (PostgrestError preservation) → Phase 24 (logger signatures) → Phase 25 (metadata extraction)

**Version Bump:** 1.12.10 → 1.12.11

**Test Delta:** 1315 → 1318 (+3 new tests for full shape / partial / plain error unchanged)

**Quality Metrics:**
- Build: 0 new TypeScript errors
- Tests: 1318 total passing
- Code Review: 9.8/10 APPROVE SHIP
- CI/CD: GREEN
- Production: HTTP 200

---

## No Additional Updates Needed

- ✓ Roadmap: Not updated (purely additive improvement, no phase sequence change)
- ✓ Architecture: Not updated (logger internals unchanged externally)
- ✓ Code Standards: Not updated (follows existing logger patterns)

---

## Completion

**Status:** COMPLETE

Changelog now reflects Phase 25 completion. Version bumped to v1.12.11. Ready for production merge.
