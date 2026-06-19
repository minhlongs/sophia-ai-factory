# Auth Register Page Design Overrides

> Page-specific design rules for the Registration screen.

## Override Rules

### Layout Structure

- Same centered card layout as login page (`max-w-[440px]`)
- Success state uses full-width card with centered content
- Atmospheric background blurs consistent with login

### Form Fields Order

1. Company Name (optional for registration — consider making it optional)
2. Email Address (required, `type="email"`)
3. Password (required, `type="password"` with strength indicator placeholder)
4. Confirm Password (required, validation on submit)
5. Terms of Service checkbox (required)

### Terms Checkbox

- Use flex items with `items-start` for checkbox alignment
- Checkbox `mt-0.5` to align with text baseline
- Terms links use `text-primary hover:underline`
- Wrap links with proper sentence structure via i18n

### Success State

- Checkmark icon in `w-16 h-16` circle with `bg-emerald-100` background
- Icon color: `text-emerald-600`
- Title: `font-headline-lg`
- Message: `font-body-md text-on-surface-variant`
- Button: `fullWidth` with `href="/login"`

### Validation

- Client-side: Password match check before submission
- Server-side: Email uniqueness, password strength
- Error display: Inline below relevant field (use `text-destructive` for errors)

### Responsive

Same as login page.

### Anti-Patterns

- ❌ Don't require company name if targeting individual creators
- ❌ Don't show password in plain text by default (toggle required)
- ❌ Don't allow registration without terms acceptance