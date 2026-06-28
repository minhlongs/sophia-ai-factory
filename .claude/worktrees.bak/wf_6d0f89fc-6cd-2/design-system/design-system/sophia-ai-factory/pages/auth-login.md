# Auth Login Page Design Overrides

> Page-specific design rules for the Login screen.

## Override Rules

### Layout Structure

- **Centered Card**: Fixed max-width `max-w-[440px]` with `p-8` padding on desktop, `p-4` on mobile
- **Background**: Atmospheric gradient blurs using `bg-primary/10` and `bg-secondary/5` with `blur-[120px]`
- **Card Shadow**: `shadow-lg shadow-primary/20` for subtle glow effect

### Typography

- **Title**: `font-headline-md text-headline-md` for "Sophia AI Factory" branding
- **Subtitle**: `font-body-md text-body-md text-on-surface-variant` for supporting text
- **Form Labels**: `font-label-md` with `text-on-surface`
- **Input Text**: `font-body-md` for user input

### Form Elements

- **Input Field**:
  - Prefix icons: `w-5 h-5` with `text-outline` (muted)
  - Border: Use `border-outline-variant` (subtler than full outline)
  - Focus: `focus:ring-primary/20` (20% opacity ring)
  
- **Checkbox**:
  - Size: `w-4 h-4`
  - Checked: `text-primary` with `bg-primary`
  - Border: `border-outline-variant`
  - Focus: `focus:ring-primary/20`

- **Buttons**:
  - Primary: `h-12` minimum touch height, `bg-primary` with `shadow-md shadow-primary/20`
  - Full width on mobile, auto width on desktop
  - Loading state: `Loader2` icon with `animate-spin`

### Divider

- Centered text with horizontal lines:
  ```tsx
  <div className="relative flex items-center my-xl">
    <div className="flex-grow border-t border-outline-variant" />
    <span className="flex-shrink mx-md font-label-sm text-label-sm text-outline uppercase tracking-widest">
      {t('orContinueWith')}
    </span>
    <div className="flex-grow border-t border-outline-variant" />
  </div>
  ```

### SSO Buttons

- Grid: `grid-cols-2` with `gap-md` (16px)
- Variant: `outline` with Google/GitHub brand colors embedded in SVG
- Icon alignment: `mr-2` for icon spacing

### Responsive Notes

- Mobile: `p-md` outer padding, card `max-w-full`
- Desktop: Centered with `items-center justify-center`, card `max-w-[440px]`
- Background blurs scale proportionally to viewport

### Accessibility

- Form inputs must have proper `label` with `htmlFor` matching input `id`
- Toggle password visibility button requires `aria-label` that changes based on state
- Social login buttons require `aria-label` describing the provider
- Skip to main content link for keyboard users (add to layout)

### Anti-Patterns

- ❌ No "Sign In with Apple" button unless explicitly supported
- ❌ Don't hardcode "Sophia AI Factory" — use i18n key
- ❌ Avoid inline `className="text-white"` — use `text-on-primary` token