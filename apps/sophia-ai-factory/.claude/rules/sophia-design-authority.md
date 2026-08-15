# Sophia Design Authority

> Authoritative source-of-truth order for all design decisions in Sophia AI Factory.

## Authority Order (highest to lowest)

1. **`src/app/globals.css`** — the only file that sets CSS custom properties (`--primary`, `--background`, etc.). Every other design document, design-system file, or agent instruction that quotes a color, font, or spacing value must cite a token from this file. If it contradicts `globals.css`, `globals.css` wins.

2. **This repo's `.claude/rules/`** — project-level design rules override any skill-level guidance when they conflict.

3. **`ak-frontend-design` skill policies** — anti-slop gate, absolute bans (Inter display font, generic purple gradients, glassmorphism, mismatched icon libraries), 19-item QA checklist. Required before any design artifact is merged.

4. **`ui-ux-pro-max` lookup data** — read-only reference for facts you cannot derive (palette options, font pairings, WCAG thresholds, per-stack rules, chart types, icon sets). Treat every CSV row as a suggestion, not a mandate.

5. **Design docs** (`docs/design-guidelines.md`, `design-system/`) — derivative summaries only. If they diverge from (1), they are bugs, not design pillars.

## Prohibited Operations

- **`--design-system` flag in `ui-ux-pro-max`** — generates arbitrary palettes keyed on query wording. Forbidden in this repo. Sophia brand is amber (light default) + indigo accents, defined in `globals.css`.
- **`--persist` flag in `ui-ux-pro-max`** — writes `MASTER.md` and can duplicate orphan directories. Forbidden.
- **New `design-system/` directories outside the app source** — any new design artifact must live in `src/app/` or `docs/`.
- **`MASTER.md` authorship for color or font values** — if `MASTER.md` quotes a value not present in `globals.css`, do not paste it; reconcile against (1) first.

## Pre-Design Checklist

Before any frontend design agent run in this repo:
1. grep `globals.css` for the tokens you intend to use — confirm amber primary, indigo accent, Inter body, no display Inter.
2. grep `docs/design-guidelines.md` for any conflicting claim (Geist, zinc, dark-default). If conflict found, treat doc as stale.
3. If agent proposes a new palette or font family, confirm it derives from a `globals.css` token extension or is explicitly scoped as a one-off product variant.

## Reconciliation Rule

If `globals.css:26` declares `--primary: 35 80% 44%` (amber) and another design doc says `indigo` is primary, the amber token wins and the doc must be updated — not the token.

---

Effective: 2026-08-15.