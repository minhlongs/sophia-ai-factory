# DESIGN.md — Sophia AI Factory ("Director's Control Deck")

## 1. Visual Philosophy & Brand Identity

**Sophia AI Factory** combines a **Cinema Dark-Room Editing Suite** (`#090A10` / `#11131F`) with an **Executive Revenue Control Console** (`#6366F1` Director Indigo + `#F59E0B` Amber Gold + `#10B981` USDT Emerald). Every screen is bilingual (Vietnamese `vi` + English `en`) with zero technical jargon for CEOs and crystal-clear tabular telemetry for power operators.

## 2. Color Palette & Atmospheric Tokens

| Role | Token | Hex | Usage |
|------|-------|-----|-------|
| App Canvas (Dark) | `--bg-app` | `#090A10` | Primary dark-room background |
| Elevated Card Surface | `--bg-panel` | `#11131F` | Bento cards, studio docks, inspector panels |
| Secondary Well / Hover | `--bg-hover` | `#1A1C28` | Timeline tracks, table row hover, input wells |
| Hairline Border | `--border-subtle` | `#1E2235` | `1px solid` structural dividers |
| Text Primary | `--text-main` | `#F8FAFC` | Headings, active KPI numerals, primary copy |
| Text Muted | `--text-dim` | `#94A3B8` | Bilingual subtitles, axis ticks, timestamps |
| Primary Brand Accent | `--color-primary` | `#6366F1` | Director Indigo CTAs, active tabs, focus rings |
| Secondary AI Accent | `--color-secondary` | `#A855F7` | Neural Violet 4-Advisor synthesis & AI badges |
| Executive Revenue Accent | `--color-accent` | `#F59E0B` | Warm Amber Gold revenue metrics, Half-Kelly stakes |
| Verified / Healthy | `--color-success` | `#10B981` | NOWPayments USDT IPN verified, CLOSED circuit breaker |
| Destructive / Alert | `--color-error` | `#F43F5E` | AUTH_FAILURE alerts, OPEN circuit breaker |

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

- **Card Radius:** `12px` (`0.75rem`) with `1px solid #1E2235` border and subtle top specular edge (`rgba(255,255,255,0.07)`).
- **Control Radius:** `8px` for buttons, inputs, and selector pills.
- **Navigation Shell:** `240px` collapsible left sidebar + `64px` top command bar with `[VI | EN]` switcher, workspace tier pill (`ENTERPRISE`), circuit-breaker health badge (`8/8 CLOSED`), and `Cmd+K` trigger.

## 5. Component Contracts

- **Bento KPI Card:** Label + bilingual subtitle on top, tabular monospace figure in `#F8FAFC`, delta badge in `#10B981` or `#F59E0B`, and mini sparkline at bottom.
- **Growth Triad MAB Table:** Displays Variant Hook, Posterior Win Probability bar, CTR, and Half-Kelly stake allocation with 1-click rebalance CTA.
- **Cast-Light Video Stage:** `9:16` / `16:9` preview frame over `#090A10` with radial Indigo glow and frame-accurate timecode transport bar.

## 6. Stitch Prompt Design System Block (Copy Verbatim into Every Prompt)

```markdown
**DESIGN SYSTEM (REQUIRED):**
- **Theme:** Dark-First Cinema Editing Suite × Executive Revenue Console ("Director's Control Deck")
- **Canvas Background:** `#090A10` (Deep Graphite)
- **Card / Panel Surface:** `#11131F` with `1px solid #1E2235` border, `12px` border-radius, and subtle top specular highlight
- **Secondary Well / Track Surface:** `#1A1C28`
- **Primary Text:** `#F8FAFC` | **Muted Text:** `#94A3B8`
- **Primary Accent:** `#6366F1` (Director Indigo) | **Secondary AI Accent:** `#A855F7` (Neural Violet)
- **Executive / Revenue Accent:** `#F59E0B` (Amber Gold) | **Success:** `#10B981` (Emerald) | **Error:** `#F43F5E` (Crimson Rose)
- **Typography:** `Space Grotesk` (bold, tight tracking) for headings, `Inter` for bilingual Vietnamese + English UI labels, `JetBrains Mono` (`tabular-nums`) for USDT figures, Thompson Sampling probabilities, Merkle hashes, and video timecodes
- **Shell Consistency:** Keep a consistent `240px` left navigation sidebar (Dashboard, `/ask` 4-Advisor Deck, AI Video Studio, Revenue & USDT Billing, BYOK Setup Wizard, Agency Subaccounts, Mobile Bot Bridge, Pricing) and a `64px` top header with `[VI | EN]` locale toggle, `ENTERPRISE` tier badge, and `8/8 Circuit Breakers CLOSED` status pill.
```
