# Phase 02: Design System Polish & UI Primitives Adoption

## Context Links
- Plan: [plan.md](./plan.md)
- Design tokens: `apps/sophia-ai-factory/src/app/globals.css:12`
- Button primitive: `apps/sophia-ai-factory/src/seed/components/ui/button.tsx:1`
- Card primitive: `apps/sophia-ai-factory/src/seed/components/ui/card.tsx:1`
- Alert primitive: `apps/sophia-ai-factory/src/seed/components/ui/alert.tsx:1`
- Badge primitive: `apps/sophia-ai-factory/src/seed/components/ui/badge.tsx:1`

## Overview
- Priority: P1
- Status: completed
- Effort: 3h
- Description: Modernize components across dashboard views and forest UI components by replacing raw unstyled HTML elements (`<button>`, custom card divs, hardcoded badges/alerts) with standardized Obsidian Cyber-Glass `@/seed/components/ui/` primitives.

## Key Insights
- Several dashboard views (e.g., `whatsapp-templates`, `publish/queue`, `youtube/trigger-pipeline-button`, `creative-economy/memory-list`) and forest components (e.g., `community-cta-banner`, `guide-code-block`, `byok-key-form`) still use ad-hoc raw `<button>` elements with inconsistent hover/focus/active states.
- The Design Authority (`globals.css`) mandates tokens: `--primary` (#6366F1 indigo), `--accent` (#F59E0B amber), `--background` (#08090D obsidian), `--card` (#12141F).
- `@/seed/components/ui/button.tsx` supports variants: `default`, `destructive`, `outline`, `secondary`, `ghost`, `link`, `primary`, `glow`, `glass`.
- `@/seed/components/ui/badge.tsx` supports variants: `default`, `secondary`, `destructive`, `outline`, `success`, `warning`.
- Adopting primitives standardizes focus rings, active scaling (`active:scale-[0.98]`), and transitions across the entire platform.

## Requirements
### Functional
- Replace raw `<button>` tags with `<Button>` primitive in designated dashboard and forest component files.
- Replace raw status indicators with `<Badge>` primitive.
- Standardize glassmorphism/card panels with `<Card>`, `<CardHeader>`, `<CardTitle>`, `<CardContent>`.
- Use `<Alert>` / `<AlertTitle>` / `<AlertDescription>` for callouts and error banners.

### Non-Functional
- Strictly adhere to 4-layer architecture (`seed` imported by `forest` / `land`).
- Zero `:any` types introduced.
- Preserve all existing callbacks, event handlers, and mutation state.
- Keep individual files under 200 lines.

## Architecture
```
Components Layer (forest/components, app/[locale]/dashboard)
  └── imports UI Primitives from @/seed/components/ui/
        ├── Button   (cva with Obsidian glow / glass / primary variants)
        ├── Card     (Obsidian card surface #12141F, border #222536)
        ├── Badge    (status tags with theme-aligned colors)
        └── Alert    (resilient user notifications)
```

## File Ownership
This phase strictly owns and modifies the following files:

### Files to Modify
1. `apps/sophia-ai-factory/src/app/[locale]/dashboard/setup/whatsapp-templates/WhatsAppTemplatesClient.tsx`
2. `apps/sophia-ai-factory/src/app/[locale]/dashboard/publish/queue/PublishQueueClient.tsx`
3. `apps/sophia-ai-factory/src/app/[locale]/dashboard/youtube/trigger-pipeline-button.tsx`
4. `apps/sophia-ai-factory/src/app/[locale]/dashboard/creative-economy/memory-list.tsx`
5. `apps/sophia-ai-factory/src/app/[locale]/dashboard/system-health/components/harness-health-card.tsx`
6. `apps/sophia-ai-factory/src/forest/components/community-cta-banner.tsx`
7. `apps/sophia-ai-factory/src/forest/components/guide/guide-code-block.tsx`
8. `apps/sophia-ai-factory/src/forest/components/guide/floating-help-button.tsx`
9. `apps/sophia-ai-factory/src/forest/components/byok/byok-key-form.tsx`
10. `apps/sophia-ai-factory/src/forest/components/byok/byok-provider-picker.tsx`
11. `apps/sophia-ai-factory/src/forest/components/dashboard/cross-sell-banner.tsx`
12. `apps/sophia-ai-factory/src/forest/components/dashboard/affiliate-cta-banner.tsx`
13. `apps/sophia-ai-factory/src/forest/components/dashboard/mission-control-widget.tsx`
14. `apps/sophia-ai-factory/src/forest/components/audit/audit-runner-button.tsx`
15. `apps/sophia-ai-factory/src/forest/components/audit/audit-check-row.tsx`

## Implementation Steps
1. In `WhatsAppTemplatesClient.tsx`:
   - Replace raw category pill buttons and pagination controls with `<Button variant="ghost" size="sm">` or `<Button variant="default">`.
   - Use `<Badge>` for template tags.
2. In `PublishQueueClient.tsx`:
   - Replace action buttons (publish now, cancel, retry) with `<Button variant="primary">`, `<Button variant="outline">`, and `<Button variant="destructive">`.
3. In `trigger-pipeline-button.tsx`:
   - Convert raw button with inline styles to `<Button variant="glow" size="lg">`.
4. In `memory-list.tsx` and `harness-health-card.tsx`:
   - Use `<Button size="sm">` and `<Badge variant="warning" | "success">`.
5. In `forest/components/byok/byok-key-form.tsx` and `byok-provider-picker.tsx`:
   - Standardize save/test/dismiss buttons with `<Button>`.
6. In `forest/components/dashboard/` banners (`cross-sell-banner.tsx`, `affiliate-cta-banner.tsx`, `mission-control-widget.tsx`):
   - Replace ad-hoc CTA buttons with `<Button variant="glow">` or `<Button variant="glass">`.
7. Verify build and types with `npm run type-check`.

## Todo List
- [x] Refactor dashboard action buttons in `WhatsAppTemplatesClient.tsx` & `PublishQueueClient.tsx`
- [x] Refactor pipeline trigger button in `trigger-pipeline-button.tsx`
- [x] Refactor system health & memory list buttons in `memory-list.tsx` & `harness-health-card.tsx`
- [x] Refactor BYOK components in `byok-key-form.tsx` & `byok-provider-picker.tsx`
- [x] Refactor dashboard widget banners in `cross-sell-banner.tsx`, `affiliate-cta-banner.tsx`, `mission-control-widget.tsx`
- [x] Refactor audit components in `audit-runner-button.tsx` & `audit-check-row.tsx`
- [x] Verify `npm run type-check` passes

## Success Criteria
- [x] No raw `<button>` elements in the targeted files (with documented exceptions for FAB & ARIA listbox)
- [x] All interactive buttons possess unified focus ring, hover transition, and disabled styles
- [x] TypeScript check clean (0 errors)

## Risk Assessment & Mitigations
- **Risk:** Unintentional layout shifts due to differing default padding in `<Button>`.
  - **Mitigation:** Match sizes (`size="sm"`, `size="default"`, `size="icon"`) to existing dimensions.
- **Risk:** Type conflicts with `ButtonProps` vs native HTML button attributes.
  - **Mitigation:** Use `ButtonProps` and spread remaining props cleanly.

## Security Considerations
- Ensure button handlers preserve CSRF protection and do not expose sensitive params in DOM attributes.

## Next Steps
- Pass modified components to Phase 03 for WCAG 2.1 AA accessibility auditing.
