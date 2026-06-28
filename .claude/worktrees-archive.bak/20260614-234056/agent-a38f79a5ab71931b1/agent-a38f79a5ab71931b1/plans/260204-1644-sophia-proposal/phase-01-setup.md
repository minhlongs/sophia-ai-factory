# Phase 1: Project Setup & Foundation

## Context
Initialize the Next.js application within the `mekong-cli` monorepo structure (or standalone if preferred, but brief implies `apps/sophia-proposal`). Establish the visual foundation using Tailwind CSS v4.

## Requirements
- **Framework:** Next.js 14+ (App Router)
- **Styling:** Tailwind CSS v4 (Alpha/Beta or latest stable if v4 is not ready, assume v3.4+ with v4 config style if needed, strictly follow brief for v4)
- **Language:** TypeScript
- **Theme:** Dark mode default, Cyberpunk aesthetic (black, neon blue, neon purple)

## Implementation Steps

1.  **Initialize Project**
    ```bash
    cd /Users/macbookprom1/mekong-cli/apps/
    npx create-next-app@latest sophia-proposal --typescript --tailwind --eslint
    # Select: App Router, No src directory (optional), Import alias @/*
    ```

2.  **Configure Tailwind CSS v4**
    - Update `globals.css` with v4 directives if applicable or standard Tailwind config.
    - Define color palette:
        - Background: `#050505` (Deep Black)
        - Surface: `#0A0A0A` (Dark Gray)
        - Primary: `#3B82F6` (Neon Blue)
        - Secondary: `#8B5CF6` (Neon Purple)
        - Accent: `#F472B6` (Pink/Magenta)

3.  **Setup Fonts**
    - Import fonts in `layout.tsx`:
        - `Inter` for body text
        - `Orbitron` or `Space Grotesk` for headings (Cyberpunk feel)

4.  **Global Styles**
    - Reset margins/paddings
    - Set default background color and text color
    - Add utility classes for glassmorphism (`backdrop-blur`, `bg-opacity`)

5.  **Project Structure**
    ```
    app/
      components/
        ui/          # Atomic components (Button, Card)
        sections/    # Page sections (Hero, Pricing)
      lib/           # Utilities (utils.ts)
      hooks/         # Custom hooks
      layout.tsx
      page.tsx
    ```

## Success Criteria
- [ ] Next.js app running at `http://localhost:3000`
- [ ] Tailwind CSS working (test with a styled div)
- [ ] Dark theme applied by default
- [ ] Fonts loaded correctly
