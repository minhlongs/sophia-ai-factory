# Phase 1: Project Scaffolding

**Status:** Pending
**Priority:** Critical

## Overview
Initialize the Next.js application and configure the foundational technologies compliant with 84tea's strict technical stack.

## Requirements
- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Fonts:** `@fontsource/playfair-display`, `@fontsource/inter`
- **Linting:** ESLint + Prettier

## Implementation Steps

1.  **Initialize Project**
    - Run `npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"` (in `apps/84tea`)
    - *Note: Ensure directory is empty or use `.` if valid.*

2.  **Install Dependencies**
    - `npm install @fontsource/playfair-display @fontsource/inter clsx tailwind-merge`
    - `npm install -D prettier prettier-plugin-tailwindcss`

3.  **Configure Fonts**
    - Modify `src/app/layout.tsx` to load fonts.
    - Set up CSS variables for fonts in Tailwind config.

4.  **Configure Tailwind for MD3**
    - Clean up default Tailwind colors.
    - Prepare `tailwind.config.ts` to use CSS variables (we will define values in Phase 2).

5.  **Setup Project Structure**
    - Create directories: `src/components/ui`, `src/components/layout`, `src/lib`, `src/styles`, `src/types`.

## Validation
- [ ] `npm run dev` starts successfully.
- [ ] Fonts load correctly in browser.
- [ ] Tailwind classes work.
