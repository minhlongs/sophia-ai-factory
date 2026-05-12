# Changelog Sync: 8-Wave Entry (2026-05-12)

## Summary

Updated `docs/project-changelog.md` with v1.24.0 entry covering 8 waves shipped 2026-05-12 (non-tech VIP partner self-serve UX cycle).

## Changes Made

**File:** `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/docs/project-changelog.md`

**Insertion:** Lines 7–34 (new v1.24.0 section inserted before v1.23.0)

**Net LOC delta:** +26 LOC (477 → 503 total)

**Version bump:** 1.23.0 → 1.24.0 | Last Updated: 2026-05-11 → 2026-05-12

## Content Structure

New section lists 8 waves with commit hashes + type + brief description:
1. Wave 1 (4422ef9a) — Help Center bilingual pages
2. Wave 2 (8ddc0b69) — Onboarding tour refactor to Help Center
3. Wave 3 (31980da6) — SOP callout on marketplace + /sops
4. Wave 4 (2af113e3) — BYOK surface on /dashboard/byok
5. Wave 5 (fa08db9a) — FREE100 provenance pill (layout.tsx helper)
6. Wave 6 (bbbc7d9e) — Quick-start launcher (ETA cards)
7. Wave 7 (f372fa89) — bash script + D1 free100 analysis tooling
8. Wave 8 (bd0bfc62) — i18n validator (dynamic prefix detection)

Includes bilingual validation pass rate (4078/4110) and cross-links to partner handover docs + gap analysis report.

## Cross-References (4/4 verified)

- `./handover/founder-cheat-sheet-260512.md` ✅
- `./handover/free100-partner-outreach-template-260512.md` ✅
- `./handover/free100-distribution-tracker-260512.md` ✅
- `../plans/reports/research-260512-0727-gap-analysis.md` ✅

All files confirmed exist at specified paths (relative to `docs/project-changelog.md`).

## Metrics

| Metric | Value |
|--------|-------|
| New LOC | 26 |
| Insertion lines | 7–34 |
| File size before | 477 LOC |
| File size after | 503 LOC |
| Breached docs.maxLoc? | No (503 << 800) |

## Quality Checks

- [x] Commit hashes match supplied list (8/8)
- [x] Wave descriptions consistent with task brief
- [x] Bilingual notation (EN+VI) marked where applicable
- [x] Test pass rate documented (4078/4110 + 32 skipped)
- [x] Cross-links in relative markdown format
- [x] Version bump reflects scope (8-wave polish = minor bump)
- [x] "Last Updated" timestamp synchronized

## Unresolved

None. All cross-references verified, LOC under limit, ready to ship.
