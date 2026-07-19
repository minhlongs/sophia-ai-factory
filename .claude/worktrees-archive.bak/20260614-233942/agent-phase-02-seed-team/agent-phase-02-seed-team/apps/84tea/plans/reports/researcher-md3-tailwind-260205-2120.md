# Research Report: Material Design 3 (MD3) with Tailwind CSS for 84tea

**Date:** 2026-02-05
**Context:** 84tea Franchise Website (Next.js/Tailwind)
**Goal:** 100/100 MD3 Compliance with Tailwind CSS

## 1. Technical Approach: CSS Variables + Tailwind Config
The most robust way to implement MD3 dynamic color systems and dark mode in Tailwind is using **CSS Variables** defined in a global CSS file, mapped to Tailwind's theme configuration.

### Strategy
1.  **Define Tokens**: Generate MD3 tokens (using Material Theme Builder) as CSS variables.
2.  **Tailwind Map**: Alias these variables in `tailwind.config.ts`.
3.  **Dark Mode**: Switch variable values under `.dark` class (managed by `next-themes`).

## 2. Color System Implementation (Imperial Green & Gold Leaf)

**`globals.css`**
```css
:root {
  /* Primary - Imperial Green */
  --md-sys-color-primary: #1b5e20;
  --md-sys-color-on-primary: #ffffff;
  --md-sys-color-primary-container: #a5d6a7;
  --md-sys-color-on-primary-container: #0d3911;

  /* Secondary - Gold Leaf */
  --md-sys-color-secondary: #c5a962;
  --md-sys-color-on-secondary: #3a2e00;

  /* Surface */
  --md-sys-color-surface: #fbf8f3;
  --md-sys-color-on-surface: #4e342e;
}

.dark {
  /* Dark Mode Mappings (Example) */
  --md-sys-color-primary: #a5d6a7; /* Lighter for dark mode */
  --md-sys-color-on-primary: #00390f;
  --md-sys-color-surface: #121212;
  --md-sys-color-on-surface: #e2e2e2;
}
```

**`tailwind.config.ts`**
```ts
theme: {
  extend: {
    colors: {
      primary: 'var(--md-sys-color-primary)',
      'on-primary': 'var(--md-sys-color-on-primary)',
      surface: 'var(--md-sys-color-surface)',
      // ...map all tokens
    }
  }
}
```

## 3. Typography Scale

**Packages:**
`npm install @fontsource/playfair-display @fontsource/inter`

**`tailwind.config.ts`**
```ts
fontFamily: {
  display: ['"Playfair Display"', 'serif'],
  body: ['"Inter"', 'sans-serif'],
},
fontSize: {
  'display-large': ['57px', { lineHeight: '64px', letterSpacing: '-0.25px' }],
  'display-medium': ['45px', { lineHeight: '52px', letterSpacing: '0px' }],
  'body-large': ['16px', { lineHeight: '24px', letterSpacing: '0.5px' }],
  // ...map full scale
}
```

## 4. Components & State Layers

MD3 relies heavily on state layers (opacity overlays). In Tailwind, use `bg-opacity` or `relative` positioning with pseudo-elements.

**Filled Button Example:**
```tsx
<button className="
  h-10 px-6 rounded-full
  bg-primary text-on-primary
  font-label-large
  hover:shadow-md hover:bg-opacity-92
  active:bg-opacity-88
  disabled:opacity-38
  transition-all duration-200 ease-in-out
  flex items-center gap-2
">
  <span className="material-symbols-rounded">local_cafe</span>
  <span>Mua Ngay</span>
</button>
```

## 5. Responsive Breakpoints

Map MD3 breakpoints to Tailwind `screens`.

```ts
screens: {
  'compact': {'max': '599px'},
  'medium': '600px',
  'expanded': '840px',
  'large': '1200px',
  'xl': '1400px',
}
```

## 6. Accessibility & Dark Mode

-   **Dark Mode**: Use `next-themes` to toggle the `.dark` class on the `<html>` element. The CSS variables will auto-update.
-   **Contrast**: MD3 algorithms guarantee accessiblity. Ensure custom colors (Imperial Green) pass WCAG AA on their respective containers.
-   **Focus States**: Always implement visible focus rings.
    ```css
    *:focus-visible {
      outline: 2px solid var(--md-sys-color-primary);
      outline-offset: 2px;
    }
    ```

## 7. Performance & Optimization

-   **Fonts**: Use `next/font` instead of `@fontsource` for automatic optimization and layout shift prevention.
    ```ts
    import { Playfair_Display, Inter } from 'next/font/google'
    ```
-   **Icons**: Use `material-symbols` font or SVG imports. For performance, prefer SVGs for critical icons or subset the font.
-   **Lighthouse**:
    -   Serve images in WebP/AVIF.
    -   Defer non-critical CSS/JS.
    -   Ensure buttons have accessible names (`aria-label`).

## Unresolved Questions
-   Specific customized icon set requirements beyond Material Symbols?
-   Exact dark mode color mappings for "Gold Leaf" (needs contrast check)?

