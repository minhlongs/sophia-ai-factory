# Pricing Page Design Overrides

> Page-specific design rules for the Pricing/Plans screen.

## Override Rules

### Layout

- **Header**: Centered text with `max-w-2xl mx-auto`
- **Toggle**: Monthly/Annual toggle with pill-style buttons
- **Pricing Cards**: 3-column grid on desktop (`grid-cols-3`), single column on mobile
- **Popular Badge**: Absolute positioned `-top-1/2` with gradient background

### Typography

- **Page Title**: `font-headline-xl text-headline-xl text-primary`
- **Plan Names**: `font-headline-md text-headline-md`
- **Prices**: `font-headline-xl` for amount, `font-body-md` for period
- **Feature List**: `font-body-sm` with checkmark icons

### Color Palette

- **Primary Plan**: Standard `primary` token
- **Popular Badge**: Gradient `popular-badge-gradient` (defined in CSS):
  ```css
  .popular-badge-gradient {
    background: linear-gradient(135deg, #EC4899 0%, #DB2777 100%);
  }
  ```
- **Checkmarks**: `text-emerald-500` for included features
- **Disabled Features**: `text-on-surface-variant/50` with line-through

### Card Structure

```tsx
<Card className="relative" hoverable>
  {isPopular && (
    <Badge className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
      Most Popular
    </Badge>
  )}
  <CardHeader>
    <h3>{plan.name}</h3>
    <p>{plan.description}</p>
    <div className="price">
      <span className="font-headline-xl">${plan.price}</span>
      <span className="font-body-md">/month</span>
    </div>
  </CardHeader>
  <CardContent>
    <ul features>
      <li><CheckCircle className="w-4 h-4" /> {feature}</li>
    </ul>
    <Button fullWidth>{currentPlan === plan ? 'Current Plan' : 'Get Started'}</Button>
  </CardContent>
</Card>
```

### Responsive

- Mobile: Cards stack, full width
- Tablet: 2-column layout for 3 plans (one spans 2 cols?)
- Desktop: 3 equal columns with `gap-lg`

### Annual Toggle

- Pill-style segmented control
- Savings badge: `(Save 20%)` in `text-emerald-600 font-label-sm`
- Toggle state persists in localStorage

### Accessibility

- Cards must be keyboard focusable (`tabIndex={0}` or `<button>` wrapper)
- Pricing toggle requires `aria-pressed` on buttons
- Feature lists use `ul` with `li`, not just checkmark icons
- Current plan indicator: visually distinct (border or badge) + `aria-current="plan"`

### Anti-Patterns

- ❌ Don't hide features behind tooltips — show all features clearly
- ❌ Don't use price formatting that breaks for different locales
- ❌ Don't omit annual equivalent pricing if showing monthly