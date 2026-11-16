# Phase 2 report — Primitive tokenization + dual-system ADR

Executed 2026-11-07. **Scope was re-decided mid-phase** — recorded here rather than silently narrowed.

## What changed from the original phase-02 spec

The spec assumed `src/components/stitch/ui` was a legacy duplicate to delete. It is not:

- `src/components/stitch/screens/**` is imported by **42** files under `src/app`, **26** of them inside
  `[locale]` — so the Stitch tree renders public routes as well as the authenticated shell.
- Its `Table<T>` takes `ColumnDef`, its `Button` exports `renderButtonLink`/`ButtonVariant`, and its
  `Badge` is span-based while `seed`'s is div-based. These are different components sharing names.

Deleting or path-swapping would change rendering on live screens that cannot be visually verified
without an authenticated session. On user decision (2026-11-07) the merge is deferred to its own plan,
and this phase delivers what is verifiable: primitive-level tokenization, a mechanical ratchet, and a
recorded ADR.

## Changes

| File | Change |
|---|---|
| `src/components/stitch/ui/{card,input,stat-card,table,table-rows,data-state-boundary,stitch-route-banner}.tsx` | Dropped redundant `dark:bg-[#11131F]` overrides (base `bg-card` already supplies the surface, Δ1 per channel); `text-[#F8FAFC]` → `text-foreground`; `text-[#94A3B8]` → `text-muted-foreground`. Literals **33 → 17**. |
| `src/components/stitch/ui/__tests__/stitch-ui-elements.test.tsx` | Assertion updated: it pinned the removed literal class. Now asserts the token class and `not.toMatch(/#[0-9a-fA-F]{6}/)` — same intent (opaque surface), stronger guard. 22/22 pass. |
| `scripts/check-hardcoded-color.mjs` | **Created.** Ratchet guardrail: per-file literal counts vs baseline; fails on growth or a new offending file; `--update` to ratchet down. |
| `scripts/ui-color-baseline.json` | **Created.** Frozen baseline: **196 files, 1,129 literals** (`.tsx`, excluding `__tests__`). |
| `package.json` | `check:color-tokens` added and appended to `ci`. |
| `ADR/ADR-0011-dual-ui-systems.md` | **Created.** Records the two-system split, why merging is deferred, and the ratchet as the enforcement mechanism. |
| `DESIGN.md` | Corrected against measurement — see below. |

## Remaining 17 literals (intentionally kept)

No token exists at those values: `#0B0E14` (stage/iframe chrome), `#121722` + `#1E2638` (banner
gradient endpoints and pill border), `#0D0F19` (input well), `#090A10` (sidebar), `#1E2235` (2 borders),
`#11131F` (gradient stop). Minting seven single-use tokens to delete them would add more indirection
than it removes. The ratchet freezes them at 17 and no new ones can appear.

## DESIGN.md corrections

Documentation was describing a system that does not exist:

| Claim before | Reality |
|---|---|
| Tokens `--bg-app`, `--bg-panel`, `--bg-hover`, `--border-subtle`, `--text-main`, `--text-dim` | None are defined. Real names: `--background`, `--card`, `--muted`, `--border`, `--foreground`, `--muted-foreground` |
| `--color-success` / `--color-error` tokens | Do not exist; only the `--emerald-*` scale and `--destructive` |
| Canvas `#090A10`, card `#11131F`, secondary `#A855F7` | Render as `#050610`, `#10121E`, `#9167E4` |

Root cause of the hex drift: tokens are stored as **HSL triplets**, and integer H/S/L rounding shifts
every token by 1–6 units — `--primary` declares `239 84% 67%` and renders `#6467F2`, not the
documented `#6366F1`. `DESIGN.md` now states measured values and explains why.

## Verification

| Check | Result |
|---|---|
| `vitest run src/components/stitch/ui` | 22/22 pass |
| `tsc --noEmit` | 3 errors — **unchanged**, all in the untracked WIP file `v3-core-landing.test.tsx` |
| `eslint src/components/stitch/ui` | 0 problems |
| `check:color-tokens` | 1,129 = baseline, pass; probe file with one literal → **exit 1** as designed |
| Public screenshots, before vs after tokenization | worst 784 px, max channel Δ **6/255**; `/vi/login` identical; same profile as the pre-tokenization control |

**Limitation:** authenticated `(app)` routes were not screenshotted — no session. The tokenization
touches primitives those routes render, so their visual result is verified by unit tests and the
Δ≤6 bound, not by screenshot.

## Follow-ups this phase surfaced

1. **HSL triplet rounding** makes every token 1–6 units off spec and makes hex→token mapping lossy.
   Fixing it means storing hex and switching `@theme inline` to `var()`, plus 18 direct
   `hsl(var(--…))` consumers. Not done here — it is a palette-format decision, not a consolidation.
2. **No `--success`/`--error` semantic tokens**, while 46 components hardcode `#10B981`.
3. **`src/components` sits outside the layer-boundary checker**; `layer-violations-report.json` reports
   0 because it never scans that tree.
