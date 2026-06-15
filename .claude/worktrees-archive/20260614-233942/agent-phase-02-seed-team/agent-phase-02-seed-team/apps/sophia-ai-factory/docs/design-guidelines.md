# Design Guidelines

## Design Philosophy

Sophia AI Video Factory follows a **"Geist-inspired"** design language: minimal, monochromatic, and deeply functional. The interface prioritizes content and data over decoration, ensuring a professional and high-performance environment for content creators.

## 1. Typography

We use the **Geist** font family, optimized for legibility and modern aesthetics.

- **Primary Font**: `Geist Sans` (Variable)
  - Usage: UI elements, headings, body text.
  - Weights: Regular (400), Medium (500), Semibold (600).
- **Monospace Font**: `Geist Mono` (Variable)
  - Usage: Code snippets, API keys, data tables, metrics.

```css
/* Applied via CSS Variables in layout.tsx */
font-family: var(--font-geist-sans);
font-family: var(--font-geist-mono);
```

## 2. Color Palette

The color system is built on **Tailwind CSS 4** defaults with semantic CSS variables for theming (Light/Dark mode support).

### Neutrals (Core)
- **Background**: `white` / `zinc-950`
- **Foreground**: `zinc-950` / `zinc-50`
- **Muted**: `zinc-100` / `zinc-800` (Backgrounds for cards, sidebars)
- **Muted Foreground**: `zinc-500` / `zinc-400` (Secondary text)
- **Border**: `zinc-200` / `zinc-800`

### Accents (Functional)
- **Primary**: `zinc-900` / `zinc-50` (Buttons, active states)
- **Destructive**: `red-500` / `red-900` (Errors, dangerous actions)
- **Success**: `emerald-500` / `emerald-900` (Verification checks, success toasts)

## 3. UI Components

We use a component-first architecture located in `src/app/components/ui`.

### Buttons
- **Default**: Solid background, contrasting text.
- **Outline**: Bordered, transparent background.
- **Ghost**: Transparent background, hover effect only.

### Cards
- Used for grouping content (e.g., Affiliate Programs, Dashboard Stats).
- Style: Thin border, subtle background (optional), rounded corners (`rounded-xl`).

### Inputs
- Minimalist borders.
- Distinct focus states (ring).
- Error states with red borders and descriptive text.

## 4. Layout & Spacing

### Grid System
- We use CSS Grid and Flexbox for layouts.
- **Dashboard**: Sidebar navigation + Main Content area.
- **Wizard**: Centered, single-column focus layout.

### Spacing
- Based on Tailwind's 4px scale.
- Common padding: `p-4` (16px), `p-6` (24px), `p-8` (32px).
- Gap: `gap-4` for tight groups, `gap-8` for section separation.

## 5. Feedback & Interaction

- **Loading States**: Use Skeletons or Spinners. Never leave the user wondering if an action triggered.
- **Validation**: Real-time feedback in the Setup Wizard.
  - Green Check: Valid API Key.
  - Red X: Invalid Key (with error message).
- **Transitions**: Subtle `transition-all duration-200` on interactive elements (hover, focus).

## 6. Iconography
- Use **Lucide React** icons.
- Attributes: `stroke-width={1.5}`, consistent sizing (`w-4 h-4` for buttons, `w-6 h-6` for headings).

## 7. Accessibility (a11y)
- **Contrast**: Ensure sufficient contrast ratios for text.
- **Focus**: Never suppress outline on focusable elements without providing an alternative.
- **Semantic HTML**: Use `<button>`, `<input>`, `<main>`, `<nav>` appropriately.
