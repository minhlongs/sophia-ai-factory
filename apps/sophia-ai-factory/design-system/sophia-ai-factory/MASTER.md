# Design System Master File — Saigon Factory (reconciled)

> **AUTHORITY:** `src/app/globals.css` is the single source of truth for color,
> spacing, and typography tokens. This file is derivative — every value below
> must cite a token from `globals.css`. If conflict exists, `globals.css` wins.
>
> **Anti-slop:** Inter is the approved body font. Inter as display/headline font
> is forbidden. See `.claude/rules/sophia-design-authority.md`.

---

## Brand / Thương Hiệu

Saigon Factory: 1960s print warmth + modern AI precision. Approachable,
professional, and memorable.

## Theme / Giao Diện

- Light default (`:root`) with warm cream paper background.
- Dark mode (`.dark`) uses deep indigo surfaces — activated by `.dark` class.

## Color Palette / Bảng Màu

All values are HSL unless noted. Source: `src/app/globals.css`.

| Role | Token | Hex equivalent |
|------|-------|---|
| Primary | `var(--primary)` / `var(--color-primary)` | `#E5A340` (amber gold) |
| Primary container | `var(--primary-container)` | warm amber tint |
| Accent | `--accent` | `#6366F1` (indigo) |
| Background (light) | `var(--background)` | warm cream paper |
| Background (dark) | `.dark --background` | `#0e0e12` |
| Foreground | `var(--foreground)` | deep indigo ink |

## Typography / Kiểu Chữ

| Role | Font | Weight |
|------|------|--------|
| Body / Nội dung | Inter | 400 / 600 |
| Headline / Tiêu đề | System sans (not Inter) | 700+ |

Headlines must not use Inter as the display typeface. A system sans or
decorative weight is acceptable for hero text once it does not collide with
the body Inter stream.

## Spacing & Radius

4pt midpoint grid, radius `rounded-lg` (8px).

## Vibe / Phong Cách

Warm amber light, clear hierarchy, minimal decoration, trustworthy AI tone.

---

**Derived from:** `globals.css:26` (primary), `:26` (primary-container),
`.dark` block (dark surfaces). Updated to reflect shipped tokens, 2026-08-15.