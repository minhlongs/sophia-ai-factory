# Design System Master File — Zen Design OS v1.0 (reconciled to `src/app/globals.css`)

> **AUTHORITY:** `src/app/globals.css` is the single source of truth for color,
> spacing, and typography tokens, paired with `src/seed/design-tokens/zen-design-tokens.dtcg.json`
> and root `DESIGN.md`. This file is derivative — every value below cites `src/app/globals.css`.
> If any conflict exists, `src/app/globals.css` wins.

---

## Brand / Thương Hiệu

Sophia AI Factory — Zen Design OS v1.0 (Direction B: Expressive AI-Native).

## Theme / Giao Diện

- Dark default (`.dark` — *Director's Control Deck*) via `ZenThemeProvider` (`defaultTheme="dark"`).
- First-class Light mode (`:root` — *Executive Studio Ivory*) and High-Contrast override (`@media (prefers-contrast: more)`).

## Color Palette / Bảng Màu

Source: `src/app/globals.css` & `src/seed/design-tokens/zen-design-tokens.dtcg.json`.

| Role | Token | Light (`:root`) | Dark (`.dark`) |
|------|-------|---|---|
| Primary | `var(--primary)` | `#4338CA` | `#6366F1` (`--primary-text: #818CF8`) |
| Primary container | `var(--primary-container)` | `#E0E7FF` | `#211966` |
| Secondary | `var(--secondary)` | `#7E22CE` | `#A855F7` |
| Accent / Warning | `var(--accent)` | `#B45309` | `#F59E0B` |
| Background | `var(--background)` | `#F8F9FC` | `#090A10` |
| Card | `var(--card)` | `#FFFFFF` | `#11131F` |
| Foreground | `var(--foreground)` | `#0B0F19` | `#F8FAFC` |

## Typography / Kiểu Chữ

| Role | Font | Weight |
|------|------|--------|
| Product UI & Headings (`--font-sans`) | `Inter` | 400–800 |
| Telemetry & Code (`--font-mono`) | `JetBrains Mono` | 400–600 (`tabular-nums`) |
| Scoped `.v3-core` Display (`--font-display` in `v3-core.css`) | `Archivo` | 400–800 (`wdth` 100–112) |

`Satoshi` and `Instrument Serif` are explicitly excluded from this release.

## Spacing & Radius

4pt midpoint grid, radius `rounded-lg` (8px).

## Vibe / Phong Cách

Warm amber light, clear hierarchy, minimal decoration, trustworthy AI tone.

---

**Derived from:** `globals.css:26` (primary), `:26` (primary-container),
`.dark` block (dark surfaces). Updated to reflect shipped tokens, 2026-08-15.