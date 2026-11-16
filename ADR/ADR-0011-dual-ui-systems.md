# ADR-0011 — Two UI Systems Are Recorded, Not Merged

**Status:** Accepted
**Date:** 2026-11-07
**Owner:** CTO

## Context

The product ships two independent UI systems, one per product half:

| | Public / marketing `[locale]/*` | Authenticated `(app)/*` |
|---|---|---|
| Primitives | `src/seed/components/ui` — 36 files, **0** hardcoded hex, **169** importers | `src/components/stitch/ui` — 19 files, 17 hardcoded hex, 10 importers |
| Consumers | landing, pricing, blog, solutions | 170 screens under `src/components/stitch/screens`, rendered by 42 route files |
| `Table` | row/cell primitives | `Table<T>` with `ColumnDef` — a different component, not a variant |
| `Button` | `class-variance-authority` variants | custom `renderButtonLink` + `ButtonVariant` exports |
| Boundary checking | inside the 4-layer model | outside it — `layer-violations-report.json` reports 0 because it never scans `src/components` |

An earlier read of this state called `src/components/stitch/ui` a legacy duplicate. That was wrong:
42 files under `src/app` import the Stitch screens, so the second system is the live implementation of
the authenticated product, not dead code.

The two systems share component *names* (`Button`, `Card`, `Badge`, `Input`, `Table`) while differing in
props and semantics. That name collision is the real defect: a developer importing `Card` cannot tell
which system they get, and the compiler cannot help.

## Decision

Record the split instead of merging it now.

1. `src/seed/components/ui` is the canonical primitive library for new code in the four-layer model.
2. `src/components/stitch/ui` remains the authenticated-route primitive layer until a dedicated
   migration moves its consumers. No new screens are added to `src/components/stitch`.
3. Hardcoded colors are frozen by ratchet, not by policy prose:
   `npm run check:color-tokens` fails when any file grows its literal count or a new file introduces one.
   It runs as part of `npm run ci`.
4. Merging the two systems requires a plan of its own, with per-screen visual verification behind an
   authenticated session. It is not a refactor that can be validated from source alone.

## Consequences

- The token layer now has authority through a mechanical gate rather than through documentation.
- Primitive-level tokenization was applied where an existing token matched (`bg-card`, `text-foreground`,
  `text-muted-foreground`): `src/components/stitch/ui` went from 33 to 17 literals.
- The remaining 17 literals sit in one-off shades with no token equivalent (`#0B0E14` stage chrome,
  `#121722`/`#1E2638` banner gradient, `#0D0F19` input well, `#090A10` sidebar). Minting seven
  single-use tokens to delete them would add more indirection than it removes; they stay, and the
  ratchet prevents growth.
- The `(app)` route tree stays outside the layer-boundary checker. Closing that gap is a separate
  decision about whether `src/components/stitch` should move into the four layers at all.

## Evidence

- `src/app/(app)/**` imports `@/components/stitch/screens/*` in 42 files.
- `src/components/stitch/screens` holds 170 `.tsx` files.
- `src/seed/components/ui` contains 0 `#rrggbb` literals; `src/components/stitch/ui` contained 33.
- `scripts/ui-color-baseline.json` records the frozen count: 196 files, 1,129 literals.
