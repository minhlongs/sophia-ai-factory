# Phase 1: Color & Typography Upgrade

## Context
- **Plan:** [Overview](./plan.md)
- **Research:** [Premium UI Trends](../research/researcher-01-premium-ui-trends.md)
- **Target App:** `apps/sophia-proposal`

## Overview
Establish the visual foundation for the "Max WOW" upgrade. We will replace the basic dark theme with a rich "Deep Space" palette using Tailwind v4 CSS variables and upgrade typography to a premium geometric pairing.

## Key Insights
- **Deep Space Palette:** Pure black is out. We need rich, deep blues/purples (`#030014`) with noise textures.
- **Typography:** "Space Grotesk" communicates "Future/Tech/Web3" better than "Orbitron" (which feels too retro-gaming).
- **Tailwind v4:** Configuration happens in CSS variables, not `tailwind.config.ts`.

## Requirements
1.  **Color System:** Implement Deep Space background, Neon Cyan/Purple accents, and rich gradients.
2.  **Typography:** Replace `Orbitron` with `Space Grotesk` (headings) and `Inter` (body).
3.  **Base Styles:** Update `globals.css` with new CSS variables and base web font loading.

## Architecture
- **CSS-First:** Leverage Tailwind v4's CSS-first configuration in `app/globals.css`.
- **Next.js Fonts:** Use `next/font/google` for optimized loading.

## Related Code Files
- Modify: `app/layout.tsx` (Font loaders)
- Modify: `app/globals.css` (Theme variables)
- Modify: `tailwind.config.ts` (Delete if exists/unused, or migrate to CSS)

## Implementation Steps

1.  **Update Fonts in `layout.tsx`**
    - Remove `Orbitron`.
    - Import `Space_Grotesk` and `Inter` (or `Plus_Jakarta_Sans`).
    - Configure variable names: `--font-space` and `--font-inter`.

2.  **Define CSS Variables in `globals.css`**
    - `@theme` block (Tailwind v4 syntax).
    - Define colors:
        - `--color-deep-space`: `#030014`
        - `--color-surface`: `#0F0E17`
        - `--color-neon-cyan`: `#00F5FF`
        - `--color-neon-purple`: `#8B5CF6`
        - `--color-neon-pink`: `#EC4899`
    - Define gradients.

3.  **Apply Global Reset**
    - Set `body { @apply bg-deep-space text-slate-300 font-sans; }`.
    - Add noise texture overlay (optional CSS pattern).

## Code Example (globals.css)
```css
@import "tailwindcss";

@theme {
  --font-space: var(--font-space);
  --font-inter: var(--font-inter);

  --color-deep-space: #030014;
  --color-surface: #0F0E17;
  --color-neon-cyan: #00F5FF;
  --color-neon-purple: #8B5CF6;
  --color-neon-pink: #EC4899;

  --animate-float: float 6s ease-in-out infinite;
}

/* Noise Texture */
.bg-noise {
  background-image: url("data:image/svg+xml,..."); /* Add subtle noise SVG */
}
```

## Todo List
- [x] Update `app/layout.tsx` with Space Grotesk & Inter.
- [x] Update `app/globals.css` with Deep Space palette using `@theme`.
- [x] Verify Tailwind v4 compilation matches new variables.
- [x] Check contrast ratios for body text (`#A1A1AA` on `#030014`).

## Success Criteria
- [x] "Orbitron" font completely removed.
- [x] Headings render in Space Grotesk.
- [x] Background is `#030014` (Deep Space).
- [x] Neon accents visible in buttons/links.

## Risk Assessment
- **Risk:** Tailwind v4 syntax errors if `postcss` plugin not configured correctly.
- **Mitigation:** Verify `package.json` dependencies and check `postcss.config.mjs` if needed.

## Next Steps
- Proceed to [Phase 2: Glassmorphism](./phase-02-glassmorphism-effects.md).
