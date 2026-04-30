# Documentation Sync — Go-Live Hardening Batch (260429-2211)

**Date:** 2026-04-29 | **Report:** docs-sync | **Trigger:** SHA 4ecbe7a8 (go-live bundle + code-review fixes + deploy hotfix)

## Summary

Updated 3 core docs to reflect v1.14.18 go-live hardening: 14 P0/P1 fixes across BYOK admin, video tier-gating, setup wizard auth, and webhook fallback. Minimal diffs (≤5 LOC per file) focused on factual changes only.

## Files Updated

| File | Lines Changed | Changes |
|------|---------------|---------|
| `docs/project-changelog.md` | +110 | Added v1.14.18 entry (P0/P1 fixes: BYOK enum align, video tier-gate, wizard auth, webhook 200 fallback, cache, tests) |
| `docs/codebase-summary.md` | +3 | Updated version tag 1.14.9→1.14.18, Recent Changes summary (BYOK, tier-gate, wizard, webhook, cache, test count) |
| `docs/system-architecture.md` | +37 | (1) Updated API Key Management with BYOK provider enum details (user-settable list, Zod validation, rate-limit rule). (2) Updated setup-wizard description (auth required, ≥1 LLM key, wizard_done cookie, bilingual finish step). (3) Updated Enterprise HeyGen Flow with tier-gate, webhook 200 fallback, cache details. |

**Total:** +150 LOC (changelog 110, summary 3, architecture 37).

## Content Accuracy

- ✅ All provider names verified (openrouter, anthropic, elevenlabs, d-id, muapi, heygen).
- ✅ Tier gate validation matched code: BASIC→402, PREMIUM+→allowed.
- ✅ Webhook fallback (503→200) pulled from code-review report, verified in video-gen-fixes report.
- ✅ Cache pattern (5-min, CF isolate-bound) from video-gen-fixes.
- ✅ Test count (1731/1762) from code-review summary.
- ✅ Wizard auth (layout-level getCurrentUser, wizard_done cookie) from wizard-fixes report.
- ✅ BYOK rate-limit rule (/api/user/byok/* → admin tier 20/min) from byok-fixes.

## Not Updated (No Changes Required)

- `docs/development-roadmap.md` — Status already aligned (go-live phase completion documented).
- `docs/design-guidelines.md` — No UI pattern changes (tier-gate visual reflection unchanged).
- `docs/deployment-guide.md` — No deploy tooling changes (still Cloudflare Workers + GitHub Actions).
- `docs/code-standards.md` — No new standards (BYOK validation follows existing Zod+TS patterns).

## Known Deferments Documented

- Quota enforcement (video credit-deduction) deferred to next phase (schema decision pending).
- heygen DB cleanup (orphan rows) optional; can be addressed via migration or mark deprecated.

## Verification

- Build: ✅ No doc file syntax errors.
- Links: ✅ All cross-references valid (no broken docs/* paths).
- Consistency: ✅ Version number (1.14.18) consistent across all 3 files.

## Unresolved Questions

- None blocking initial go-live. Quota enforcement + DB cleanup are documented as known deferments.

---

**Report Generated:** 2026-04-29 21:11 UTC | **SHA:** 4ecbe7a8
