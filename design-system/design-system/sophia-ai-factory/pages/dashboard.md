# Dashboard Page Design Overrides

> Page-specific design rules for the Dashboard screen.
> These override design-system/MASTER.md for this specific page.

## Override Rules

### Color Palette

The dashboard uses a metrics-heavy layout with cards and charts. Apply these overrides:

- **Metric Cards**: Use `bg-surface-container` with `border border-border` for subtle separation
- **Chart Area**: Background `bg-surface-container-lowest` for contrast against bars
- **Accent Colors for Charts**: 
  - Primary revenue: `bg-primary/80`
  - Hover state: `bg-primary-container`
  - Success indicators: `bg-emerald-500` (override standard success for better contrast in dark mode)

### Typography

- **Metric Values**: `font-headline-md` for large numbers (hierarchical emphasis)
- **Metric Labels**: `font-label-md` with `text-on-surface-variant` for muted secondary text
- **Chart Axis Labels**: `font-code text-sm` for tabular data alignment

### Spacing

- **Card Grid**: `gap-lg` (24px) on desktop, `gap-md` (16px) on mobile
- **Card Padding**: `padding="lg"` for main cards, `padding="md"` for compact cards
- **Section Spacing**: `mb-xl` (32px) between major sections

### Component-Specific Rules

#### Metric Cards
```css
/* Hover effect: subtle lift + shadow increase */
.card-hoverable:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}
```

#### Chart Bars
- Use `rounded-t-lg` for clean bar tops
- Bar hover: change fill from `bg-primary/10` to `bg-primary-container`
- Animation: `transition-all duration-500` on height changes

#### Table Component
- Row hover: `bg-surface-container-hover`
- Header: `bg-surface-container-lowest border-b border-outline-variant`
- Sticky header on scroll (if table height exceeds viewport)

### Responsive Breakpoints

- **Mobile (< 768px)**: Single column layout, hide less critical table columns
- **Tablet (768px - 1024px)**: 2-column metric grid, full-width table
- **Desktop (>= 1024px)**: 4-column metric grid, full table with all columns

### Accessibility Notes

- Chart bars must have `role="img"` with `aria-label` describing the value
- Table actions (edit/delete) must have `aria-label` on icon-only buttons
- Color-coded badges (success/neutral) must include text or icon, not color alone

### Anti-Patterns to Avoid

- ❌ Don't use fixed heights for chart containers that cause overflow
- ❌ Don't rely on color alone for trend indicators (up/down arrows required)
- ❌ Don't truncate metric values — use responsive font sizing instead