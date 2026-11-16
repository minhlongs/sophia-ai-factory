# Phase 1 report — Token source truth

Executed 2026-11-07 on branch `feat/sophia-anatomy-workflow-explainer`.
Scope: remove unreachable token layers and a false customer-facing claim. No visual redesign.

## Changes

| File | Change |
|---|---|
| `apps/sophia-ai-factory/src/app/globals.css` | `:root` reduced from **112** to **1** declaration (`--radius`). 111 color tokens were unreachable because `.dark` overrode every one of them and `<html className="dark">` is unconditional. File 849 → 714 lines. `.dark` block and `@theme inline` untouched. |
| `apps/sophia-ai-factory/src/app/globals.css:25` | Corrected a false comment: `--background: 234 53% 4%` resolves to `#050610`, not `#090A10`. |
| `apps/sophia-ai-factory/src/tree/control-deck/stitch-deck-secondary-screens.ts:69` | Replaced the untrue claim that tokens are "exported to design-tokens.css and tailwind-theme.css for zero-drift rendering" with the real source of truth (bilingual en/vi). |
| `apps/sophia-ai-factory/tailwind.config.ts` | **Deleted.** Tailwind v4 never loads it — `globals.css` has no `@config` directive, and no script references it. |
| `design-tokens.css` (repo root) | **Deleted.** Zero imports; 190 lines of dead tokens. |
| `tailwind-theme.css` (repo root) | **Deleted.** Zero imports. |
| `apps/sophia-ai-factory/src/forest/components/providers/theme-provider.tsx` | **Deleted.** The `next-themes` provider was never mounted; no theme toggle UI exists anywhere. |
| `apps/sophia-ai-factory/scripts/capture-ui-foundation-shots.mjs` | **Created.** Reusable before/after screenshot capture; falls back to a cached Chromium build when the pinned one is absent. |

**Kept deliberately:** `next-themes` remains in `package.json`. Removing it rewrites `package-lock.json`
inside a worktree that already carries another session's uncommitted work. The dependency is inert and
the reason is recorded here rather than paid for with lockfile churn.

**Kept deliberately:** the `.dark` block and `<html className="dark">`. **1,043** `dark:` utilities across
**242** files depend on that class existing.

## Gate results

| Gate | Result | Attribution |
|---|---|---|
| `npm run lint` | **0 errors**, 205 warnings (budget 525) | clean |
| `tsc --noEmit` | **3 errors**, all in `src/components/stitch/screens/landing-hero/__tests__/v3-core-landing.test.tsx` | **pre-existing** — file is untracked (`??`) and references i18n key `v3Core`, absent from both `messages/*.json` |
| `npm run i18n:validate` | exit 1, 3 files | **pre-existing** — all three offenders are untracked: `sophia-artifact-canvas.tsx`, `dashboard-sources-drawer.tsx`, `sophia-agent-chat-replay.tsx` |
| `grep design-tokens.css\|tailwind-theme.css src` | 0 hits | clean |

Neither failing gate is attributable to this phase. **Not fixed here** — they belong to another
session's in-flight work and touching them would mix unrelated changes into this scope.

## Render verification

Method: 5 routes × 2 viewports (`/vi`, `/en`, `/vi/pricing`, `/vi/login`, `/vi/features`; 1440×900 and
390×844), captured before the change, twice after, then compared against the app's own run-to-run
render variance measured on identical code.

| Comparison | diff pixels (min / median / max) |
|---|---|
| `after` vs `after2` (same code) | 0 / 32 / **532** |
| `after2` vs `after3` (same code) | 0 / 0 / **532** |
| `after` vs `after3` (same code) | 0 / 32 / **364** |
| **`before` vs `after` (under test)** | 0 / 36 / **812** |

- 9 of 10 shots fall inside the same-code noise band.
- `en-desktop` is marginally above it at 812 px, but **no pixel anywhere shifted by more than 6/255**.
  A token substitution produces a channel step of ≥20 (e.g. `#4338CA` → `#6366F1` is ~30–40). Every
  differing region is an isolated 22×22 px glyph patch — anti-aliasing of small icons, not an area fill.
- `vi/login` is pixel-identical in both viewports, which is the expected signature of a change that
  affects no color.

**Verdict:** rendering is unchanged at the palette level. Sub-pixel glyph variance is bounded by the
app's own run-to-run noise. The route set is public only; `/vi/setup-wizard` and `/vi/dashboard`
redirect (307) without a session, so they are **not** covered by this verification.

## Artifacts

- `reports/ui-foundation/before/` — 10 baselines
- `reports/ui-foundation/after/`, `after2/`, `after3/` — post-change runs (after2/after3 are the noise control)

## Recovery

The removed light palette is recoverable from git: `git show <sha>:apps/sophia-ai-factory/src/app/globals.css`.
The values were deleted, not rewritten, and no commit exists yet — the removal is in the working tree only.

## Open item passed to Phase 3

`DESIGN.md` documents the canvas as `#090A10`; the code renders `#050610`. 72 components hardcode
`#090a10`. Mapping them to `bg-background` therefore shifts them to `#050610`, and fixing
`--background` to `#090A10` would shift the whole app. This is a **product decision on which hex is
canonical**, not a mechanical migration — it needs a decision before Phase 3 touches canvas colors.
