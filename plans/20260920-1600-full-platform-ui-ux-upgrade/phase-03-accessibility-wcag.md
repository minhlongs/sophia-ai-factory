# Phase 03: Accessibility (WCAG 2.1 AA)

## Context Links
- Plan: [plan.md](./plan.md)
- Skip nav: `apps/sophia-ai-factory/src/components/skip-nav.tsx:1`
- Root layout: `apps/sophia-ai-factory/src/app/layout.tsx:14`
- Locale layout: `apps/sophia-ai-factory/src/app/[locale]/layout.tsx:33`
- Button primitive: `apps/sophia-ai-factory/src/seed/components/ui/button.tsx:1`
- Form primitive: `apps/sophia-ai-factory/src/seed/components/ui/form.tsx:1`
- Input primitive: `apps/sophia-ai-factory/src/seed/components/ui/input.tsx:1`

## Overview
- Priority: P1
- Status: pending
- Effort: 2h
- Description: Achieve WCAG 2.1 AA compliance across all public and dashboard views by adding ARIA labels, skip-to-content focus management, form error bindings, and heading hierarchy.

## Key Insights
- `SkipNav` component exists at `src/components/skip-nav.tsx` but is not wired to a `main` element with `id="main-content"` in the root layout.
- Icon-only buttons (e.g., in `agent-sidebar.tsx`, `share-buttons.tsx`, `floating-help-button.tsx`) lack `aria-label`.
- Form inputs in `byok-key-form.tsx`, `signup-form.tsx`, and `create-workflow-form.tsx` lack `aria-invalid` and `aria-describedby` bindings for error states.
- Heading hierarchy is inconsistent across dashboard pages (some skip `h1` -> `h3`).

## Requirements
### Functional
- Add `id="main-content"` to the `<main>` wrapper in root layout and ensure `SkipNav` focuses it.
- Add `aria-label` to all icon-only buttons across dashboard and forest components.
- Bind form error messages to inputs via `aria-invalid="true"` and `aria-describedby`.
- Audit heading hierarchy: every page must have exactly one `<h1>` and logical order.

### Non-Functional
- WCAG 2.1 AA contrast ratio >= 4.5:1 for text, >= 3:1 for UI components.
- Keyboard navigation must work for all interactive elements.
- Screen reader announcements for dynamic content (loading, errors).

## Architecture
```
Root Layout
  └── <main id="main-content" tabindex="-1">
        └── SkipNav (focus target)

Icon-Only Buttons
  └── aria-label="Descriptive action"

Form Inputs
  └── aria-invalid={hasError}
  └── aria-describedby={errorId}
  └── <span id={errorId} role="alert">
```

## File Ownership
This phase strictly owns and modifies the following files:

### Files to Modify
1. `apps/sophia-ai-factory/src/app/layout.tsx`
2. `apps/sophia-ai-factory/src/app/[locale]/layout.tsx`
3. `apps/sophia-ai-factory/src/forest/components/agent-sidebar/agent-sidebar.tsx`
4. `apps/sophia-ai-factory/src/forest/components/share/share-buttons.tsx`
5. `apps/sophia-ai-factory/src/forest/components/guide/floating-help-button.tsx`
6. `apps/sophia-ai-factory/src/forest/components/byok/byok-key-form.tsx`
7. `apps/sophia-ai-factory/src/forest/components/auth/signup-form.tsx`
8. `apps/sophia-ai-factory/src/forest/components/workflows/create-workflow-form.tsx`
9. `apps/sophia-ai-factory/src/forest/components/handover/handover-acceptance-client.tsx`
10. `apps/sophia-ai-factory/src/forest/components/handover/handover-admin-console-client.tsx`
11. `apps/sophia-ai-factory/src/forest/components/pricing/coupon-input.tsx`
12. `apps/sophia-ai-factory/src/forest/components/pricing/pricing-card.tsx`
13. `apps/sophia-ai-factory/src/forest/components/dashboard/licenses-client.tsx`
14. `apps/sophia-ai-factory/src/forest/components/dashboard/handover-client.tsx`
15. `apps/sophia-ai-factory/src/app/[locale]/dashboard/page.tsx`
16. `apps/sophia-ai-factory/src/app/[locale]/dashboard/campaigns/page.tsx`
17. `apps/sophia-ai-factory/src/app/[locale]/dashboard/missions/page.tsx`
18. `apps/sophia-ai-factory/src/app/[locale]/dashboard/youtube/page.tsx`

## Implementation Steps
1. In `src/app/layout.tsx`:
   - Wrap `{children}` in `<main id="main-content" tabindex="-1" className="flex-1">`.
2. In `src/app/[locale]/layout.tsx`:
   - Ensure `<LocaleHtmlLang>` sets `lang` attribute correctly.
3. In `agent-sidebar.tsx`:
   - Add `aria-label` to all icon-only toggle buttons.
4. In `share-buttons.tsx`:
   - Add `aria-label="Copy link"`, `aria-label="Share on X"`, etc.
5. In `floating-help-button.tsx`:
   - Add `aria-label="Open help guide"`.
6. In `byok-key-form.tsx`:
   - Add `aria-invalid` to inputs with errors.
   - Add `aria-describedby` pointing to error message `<span>`.
7. In `signup-form.tsx` and `create-workflow-form.tsx`:
   - Bind `aria-invalid` and `aria-describedby` to all validated inputs.
8. In `handover-acceptance-client.tsx` and `handover-admin-console-client.tsx`:
   - Add `aria-label` to icon-only action buttons.
9. In `coupon-input.tsx` and `pricing-card.tsx`:
   - Add `aria-label` to submit buttons.
10. In `licenses-client.tsx` and `handover-client.tsx`:
    - Add `aria-label` to icon buttons.
11. In dashboard page files (`page.tsx` for campaigns, missions, youtube, dashboard home):
    - Ensure exactly one `<h1>` per page.
    - Verify heading order (h1 -> h2 -> h3).

## Todo List
- [ ] Add `id="main-content"` to root layout `<main>`
- [ ] Add `aria-label` to icon-only buttons in `agent-sidebar.tsx`
- [ ] Add `aria-label` to icon-only buttons in `share-buttons.tsx`
- [ ] Add `aria-label` to `floating-help-button.tsx`
- [ ] Add `aria-invalid` and `aria-describedby` to `byok-key-form.tsx`
- [ ] Add `aria-invalid` and `aria-describedby` to `signup-form.tsx`
- [ ] Add `aria-invalid` and `aria-describedby` to `create-workflow-form.tsx`
- [ ] Add `aria-label` to `handover-acceptance-client.tsx` icon buttons
- [ ] Add `aria-label` to `handover-admin-console-client.tsx` icon buttons
- [ ] Add `aria-label` to `coupon-input.tsx` and `pricing-card.tsx`
- [ ] Add `aria-label` to `licenses-client.tsx` and `handover-client.tsx`
- [ ] Audit heading hierarchy in dashboard page files
- [ ] Run `npm run type-check`

## Success Criteria
- [ ] All icon-only buttons have `aria-label`
- [ ] All form inputs with errors have `aria-invalid` and `aria-describedby`
- [ ] Skip nav focuses `main` content
- [ ] Every dashboard page has exactly one `<h1>`
- [ ] TypeScript check clean

## Risk Assessment & Mitigations
- **Risk:** Adding `tabindex="-1"` to `<main>` may interfere with browser defaults.
  - **Mitigation:** Only add `tabindex="-1"` to the main wrapper, not nested elements.
- **Risk:** `aria-describedby` IDs may collide if multiple forms on same page.
  - **Mitigation:** Use unique IDs per form (e.g., `byok-key-error`, `signup-email-error`).

## Security Considerations
- ARIA labels must not expose sensitive data (e.g., API keys, user emails) in DOM.

## Next Steps
- Pass to Phase 04 for mobile responsive polish.
