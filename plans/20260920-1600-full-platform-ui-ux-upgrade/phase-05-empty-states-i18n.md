# Phase 05: Empty States & Bilingual i18n Unification

## Context Links
- Plan: [plan.md](./plan.md)
- EmptyState primitive: `apps/sophia-ai-factory/src/seed/components/ui/empty-state.tsx:37`
- English messages: `apps/sophia-ai-factory/messages/en.json`
- Vietnamese messages: `apps/sophia-ai-factory/messages/vi.json`
- Locale provider: `apps/sophia-ai-factory/src/app/[locale]/layout.tsx:47`

## Overview
- Priority: P1
- Status: pending
- Effort: 3h
- Description: Standardize zero-data views using the unified `<EmptyState>` primitive across all dashboard tables and lists, and perform a complete bilingual audit ensuring all customer-facing UI strings exist in both `messages/en.json` and `messages/vi.json`.

## Key Insights
- Several list/table components currently render ad-hoc plain text or custom `<div>` zero-data states (`InstallationListTable`, `MemoryList`, `payouts-client`, `licenses-client`, `audit-history-table`) instead of the standardized `<EmptyState>` primitive.
- The `<EmptyState>` primitive (`@/seed/components/ui/empty-state`) includes icon, title, description, and optional CTA button/link aligned with Obsidian Cyber-Glass styling.
- Non-technical CEO customers rely on clear bilingual guidance (Vietnamese default, English toggle). Any missing translation key falls back to raw keys or broken English.

## Requirements
### Functional
- Replace all ad-hoc zero-data blocks in dashboard lists and tables with `<EmptyState>`.
- Provide an actionable CTA in empty states where applicable (e.g., "Create Campaign", "Browse Marketplace", "Add API Key", "Run Health Check").
- Add missing translation keys to both `messages/en.json` and `messages/vi.json` for empty states and newly polished components.
- Ensure 100% key parity between `messages/en.json` and `messages/vi.json`.

### Non-Functional
- No hardcoded customer-facing strings.
- Empty states must render smoothly without flash of unstyled content.
- Keep component files modular and under 200 lines.

## Architecture
```
Zero-Data Condition (data.length === 0)
  └── <EmptyState
        icon={LucideIcon}
        title={t('empty_title')}
        description={t('empty_description')}
        cta={{ label: t('empty_cta'), href: '/dashboard/...' }}
      />
  └── Translations resolved via next-intl (messages/en.json + messages/vi.json)
```

## File Ownership
This phase strictly owns and modifies the following files:

### Files to Modify
1. `apps/sophia-ai-factory/messages/en.json`
2. `apps/sophia-ai-factory/messages/vi.json`
3. `apps/sophia-ai-factory/src/forest/components/sop/installation-list-table.tsx`
4. `apps/sophia-ai-factory/src/forest/components/sop/installation-runs-tab.tsx`
5. `apps/sophia-ai-factory/src/app/[locale]/dashboard/creative-economy/memory-list.tsx`
6. `apps/sophia-ai-factory/src/forest/components/dashboard/licenses-client.tsx`
7. `apps/sophia-ai-factory/src/forest/components/dashboard/payouts-client.tsx`
8. `apps/sophia-ai-factory/src/forest/components/dashboard/referral-stats-section.tsx`
9. `apps/sophia-ai-factory/src/forest/components/audit/audit-history-table.tsx`
10. `apps/sophia-ai-factory/src/forest/components/sop/creator-payouts-section.tsx`
11. `apps/sophia-ai-factory/src/app/[locale]/dashboard/publish/queue/PublishQueueClient.tsx`

## Implementation Steps
1. Add unified empty-state keys to `messages/en.json` and `messages/vi.json` under `dashboard`, `sop`, `creativeEconomy`, `payouts`, `licenses`, `audit`, and `publish` namespaces.
2. In `installation-list-table.tsx`:
   - Replace custom zero-state with `<EmptyState icon={Package} title={t('emptyTitle')} description={t('emptyDesc')} cta={{ label: t('emptyAction'), href: '/dashboard/sop-marketplace' }} />`.
3. In `installation-runs-tab.tsx`:
   - Replace empty table with `<EmptyState icon={Play} title={...} description={...} />`.
4. In `memory-list.tsx`:
   - Replace ad-hoc empty box with `<EmptyState icon={Brain} title={t('noMemoryTitle')} description={t('noMemoryDesc')} />`.
5. In `licenses-client.tsx` and `payouts-client.tsx`:
   - Standardize empty states with `<EmptyState>`.
6. In `referral-stats-section.tsx` and `audit-history-table.tsx`:
   - Standardize zero-row tables with `<EmptyState>`.
7. In `PublishQueueClient.tsx`:
   - Use `<EmptyState icon={Send} title={t('emptyQueueTitle')} description={t('emptyQueueDesc')} />` when queue is empty.
8. Verify JSON syntax and key parity between `messages/en.json` and `messages/vi.json`.
9. Run `npm run type-check`.

## Todo List
- [ ] Add empty state translation keys to `messages/en.json`
- [ ] Add matching translation keys to `messages/vi.json`
- [ ] Unify empty state in `installation-list-table.tsx`
- [ ] Unify empty state in `installation-runs-tab.tsx`
- [ ] Unify empty state in `memory-list.tsx`
- [ ] Unify empty state in `licenses-client.tsx`
- [ ] Unify empty state in `payouts-client.tsx`
- [ ] Unify empty state in `referral-stats-section.tsx`
- [ ] Unify empty state in `audit-history-table.tsx`
- [ ] Unify empty state in `creator-payouts-section.tsx`
- [ ] Unify empty state in `PublishQueueClient.tsx`
- [ ] Verify i18n JSON validity and run `npm run type-check`

## Success Criteria
- [ ] All 10 targeted data lists and tables use `<EmptyState>` when data array is empty
- [ ] Every empty state has bilingual titles, descriptions, and CTA labels
- [ ] `messages/en.json` and `messages/vi.json` are valid JSON with matching keys
- [ ] TypeScript type-check passes with 0 errors

## Risk Assessment & Mitigations
- **Risk:** Malformed JSON breaking NextIntlClientProvider during hydration.
  - **Mitigation:** Validate JSON syntax via linter / build parse step.
- **Risk:** Missing translation key causing raw key string display in UI.
  - **Mitigation:** Ensure fallback strings and complete vi/en parity.

## Security Considerations
- Ensure user-supplied data in empty states or suggestions is properly sanitized (no raw HTML injection).

## Next Steps
- Hand off to Phase 06 for end-to-end verification, test runs, and build checks.
