# DESIGN.md — Sophia AI Factory ("Director's Control Deck")

## 1. Visual Philosophy & Brand Identity

**Sophia AI Factory** combines a **Cinema Dark-Room Editing Suite** (`#050610` / `#10121E`) with an **Executive Revenue Control Console** (`#6467F2` Director Indigo + `#F59F0A` Amber Gold + `#10B981` USDT Emerald). Every screen is bilingual (Vietnamese `vi` + English `en`) with zero technical jargon for CEOs and crystal-clear tabular telemetry for power operators.

> **Hex values below are measured from rendered output, not from design intent.** Tokens are stored as
> HSL triplets in `src/app/globals.css`, and integer H/S/L rounding shifts every one of them by 1–6
> units. The app is dark-only: `<html className="dark">` is unconditional in `src/app/layout.tsx`, and
> the light palette was removed because no route could reach it.

## 2. Color Palette & Atmospheric Tokens

Token names are the ones that actually exist in `globals.css`. Earlier revisions listed
`--bg-app`/`--bg-panel`/`--text-main`, which were never defined.

| Role | Token | Renders as | Usage |
|------|-------|-----|-------|
| App Canvas (Dark) | `--background` | `#050610` | Primary dark-room background |
| Elevated Card Surface | `--card` | `#10121E` | Bento cards, studio docks, inspector panels |
| Secondary Well / Hover | `--muted` | `#1A1A23` | Timeline tracks, table row hover, input wells |
| Hairline Border | `--border` | `#191C2E` | `1px solid` structural dividers |
| Text Primary | `--foreground` | `#F9FAFB` | Headings, active KPI numerals, primary copy |
| Text Muted | `--muted-foreground` | `#97A3B4` | Bilingual subtitles, axis ticks, timestamps |
| Primary Brand Accent | `--primary` | `#6467F2` | Director Indigo CTAs, active tabs, focus rings |
| Secondary AI Accent | `--secondary` | `#9167E4` | Neural Violet 4-Advisor synthesis & AI badges |
| Executive Revenue Accent | `--accent` | `#F59F0A` | Warm Amber Gold revenue metrics, Half-Kelly stakes |
| Verified / Healthy | no semantic token — `--emerald-*` scale only | `#10B981` | NOWPayments USDT IPN verified, CLOSED circuit breaker |
| Destructive / Alert | `--destructive` | `#F43E5C` | AUTH_FAILURE alerts, OPEN circuit breaker |

Two gaps are recorded rather than papered over: there is no `--color-success`/`--color-error` semantic
token, so "verified" states reach for the emerald scale or a literal, and `--secondary` renders
`#9167E4`, not the `#A855F7` earlier revisions claimed.

## 3. Typography Scale

- **Headings (`Space Grotesk`, 600–700, `-0.02em` tracking):**
  - `H1`: `32px / 38px`
  - `H2`: `24px / 30px`
  - `H3`: `18px / 24px`
- **Bilingual UI & Body (`Inter`, 400–600):**
  - Body: `14px / 20px`
  - Compact Label: `12px / 16px`
- **Financial & Telemetry Monospace (`JetBrains Mono`, 500–600):**
  - KPI Numerals & Timecodes: `13px–24px` (`tabular-nums`)

## 4. Layout & Geometry

- **Card Radius:** `12px` (`0.75rem`) with `1px solid #191C2E` border and subtle top specular edge (`rgba(255,255,255,0.07)`).
- **Control Radius:** `8px` for buttons, inputs, and selector pills.
- **Navigation Shell:** `240px` collapsible left sidebar + `64px` top command bar with `[VI | EN]` switcher, workspace tier pill (`ENTERPRISE`), circuit-breaker health badge (`8/8 CLOSED`), and `Cmd+K` trigger.

## 5. Component Contracts

- **Bento KPI Card:** Label + bilingual subtitle on top, tabular monospace figure in `#F8FAFC`, delta badge in `#10B981` or `#F59E0B`, and mini sparkline at bottom.
- **Growth Triad MAB Table:** Displays Variant Hook, Posterior Win Probability bar, CTR, and Half-Kelly stake allocation with 1-click rebalance CTA.
- **Cast-Light Video Stage:** `9:16` / `16:9` preview frame over `#050610` with radial Indigo glow and frame-accurate timecode transport bar.

## 6. Stitch Prompt Design System Block (Copy Verbatim into Every Prompt)

```markdown
**DESIGN SYSTEM (REQUIRED):**
- **Theme:** Dark-First Cinema Editing Suite × Executive Revenue Console ("Director's Control Deck")
- **Canvas Background:** `#050610` (Deep Graphite)
- **Card / Panel Surface:** `#10121E` with `1px solid #191C2E` border, `12px` border-radius, and subtle top specular highlight
- **Secondary Well / Track Surface:** `#1A1A23`
- **Primary Text:** `#F9FAFB` | **Muted Text:** `#97A3B4`
- **Primary Accent:** `#6467F2` (Director Indigo) | **Secondary AI Accent:** `#9167E4` (Neural Violet)
- **Executive / Revenue Accent:** `#F59F0A` (Amber Gold) | **Success:** `#10B981` (Emerald) | **Error:** `#F43E5C` (Crimson Rose)
- **Typography:** `Space Grotesk` (bold, tight tracking) for headings, `Inter` for bilingual Vietnamese + English UI labels, `JetBrains Mono` (`tabular-nums`) for USDT figures, Thompson Sampling probabilities, Merkle hashes, and video timecodes
- **Shell Consistency:** Keep a consistent `240px` left navigation sidebar (Dashboard, `/ask` 4-Advisor Deck, AI Video Studio, Revenue & USDT Billing, BYOK Setup Wizard, Agency Subaccounts, Mobile Bot Bridge, Pricing) and a `64px` top header with `[VI | EN]` locale toggle, `ENTERPRISE` tier badge, and `8/8 Circuit Breakers CLOSED` status pill.
```
