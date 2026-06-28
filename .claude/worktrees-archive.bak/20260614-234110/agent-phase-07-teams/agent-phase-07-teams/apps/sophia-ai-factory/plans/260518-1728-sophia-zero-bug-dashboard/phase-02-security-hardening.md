# Phase 02 — Security Hardening

## Context Links

- Plan: `./plan.md`
- Synthesis: `./tech-stack-synthesis.md` §8 (D2: tier=MASTER, D3: i18n hybrid), §9 items 5-8
- Audit: `./research/researcher-01-existing-dashboard-audit.md` §2 (rows 2, 6, 7), §5
- No-tech doctrine: `apps/sophia-ai-factory/.claude/rules/sophia-no-tech-doctrine.md`
- Layer arch: `apps/sophia-ai-factory/.claude/rules/sophia-layer-architecture.md`

## Overview

- **Priority:** P1 (security gap; blocks GREEN)
- **Status:** pending
- **Duration:** 3-5 dev-days
- **Goal:** close all auth/admin/i18n gaps from audit. 6 client pages get server gate; 14 admin pages get `tier=MASTER` gate; customer-touched admin pages migrate to `t()`; ops-internal pages get documented EN-only policy.

## Key Insights

- Decision D2 binds: admin gate = `tier=MASTER` (reuse existing enum; 0 schema change)
- Decision D3 binds: i18n hybrid — customer-touched admin = bilingual; ops-internal admin = EN-only with documented policy + ESLint exception
- Server gating MUST use canonical `getCurrentUser()` from `@/lib/better-auth-session` (NOT banned `@/lib/auth`)
- Help pages are intentionally anon-accessible; audit confirms + documents — no code change unless policy says gate

## Requirements

**Functional**
- 6 named client pages wrapped by server component that calls `getCurrentUser()` and redirects to `/login` if null
- 14 admin pages call `requireMasterTier()` reusable helper
- ~25 strings in customer-touched admin pages routed through `useTranslations()` with keys in `messages/{vi,en}.json`
- Ops-internal admin pages annotated with ESLint disable + reference to policy doc

**Non-functional**
- Helper colocated under `seed/auth/` per 4-layer arch
- No new banned imports introduced
- All migrated strings preserve current EN copy verbatim; VI copy via translator-pass review

## Architecture

```
seed/auth/require-master-tier.ts   ← NEW; pure function (userId|user) → redirect or no-op

Page server wrapper pattern:
  <ServerPage>             ← server component, calls getCurrentUser()
    <ClientPage user={…}/> ← existing 'use client', receives user as prop
  </ServerPage>

i18n split:
  customer-touched admin → t() everywhere; keys under messages/{vi,en}.json#admin.customer-touched.*
  ops-internal admin     → EN literal allowed; file header: /* eslint-disable react/jsx-no-literals — see docs/code-standards.md#admin-i18n */
```

## Related Code Files

**Modify (6 client pages — add server wrapper)**
- `src/app/[locale]/dashboard/missions/page.tsx`
- `src/app/[locale]/dashboard/workflows/page.tsx`
- `src/app/[locale]/dashboard/api-keys/page.tsx`
- `src/app/[locale]/dashboard/system-health/page.tsx`
- `src/app/[locale]/dashboard/billing/page.tsx`
- `src/app/[locale]/dashboard/proposals/page.tsx`

**Modify (14 admin pages — add requireMasterTier)**
- `src/app/[locale]/dashboard/admin/page.tsx`
- `src/app/[locale]/dashboard/admin/{audit-log,deploy-status,crons,cost,storage,refunds,pricing,tenant-lookup,webhook-deliveries,email-outbox,handover-wizard}/page.tsx`
- Plus 2 more under `admin/*` discovered by `find` (verify exact list)

**Create**
- `src/seed/auth/require-master-tier.ts`
- New keys in `messages/vi.json` + `messages/en.json` (admin.customer-touched.* namespace)
- `docs/code-standards.md` — new section `#admin-i18n` (CREATE if missing; respect 800-line cap)

**Customer-touched admin (bilingual t() migration)**
- `admin/tenant-lookup/page.tsx`
- `admin/handover-wizard/page.tsx`
- `admin/pricing/page.tsx`

**Ops-internal admin (EN-only annotation)**
- `admin/webhook-deliveries`, `admin/email-outbox`, `admin/audit-log`, `admin/crons`, `admin/cost`, `admin/storage`, `admin/refunds`, `admin/deploy-status`

## Implementation Steps

1. Verify 6-page list still accurate: `grep -rln "'use client'" src/app/\[locale\]/dashboard | xargs grep -L "getCurrentUser"`.
2. For each client page: extract current content into `<Name>Client.tsx`; convert original `page.tsx` to async server component that calls `getCurrentUser()`, redirects to `/login` if null, then renders `<NameClient user={user} />`.
3. Discover full admin list: `find src/app/\[locale\]/dashboard/admin -name page.tsx -type f`. Record in commit body.
4. Create `src/seed/auth/require-master-tier.ts`:
   - imports `getUserTier` from `@/lib/db/get-user-tier`
   - exports `async requireMasterTier(): Promise<User>` — fetches current user, fetches tier, redirects to `/dashboard?error=admin_required` if `tier !== 'MASTER'`
   - unit test colocated: `__tests__/require-master-tier.test.ts`
5. Apply `requireMasterTier()` at top of every admin page server component (replace any existing `getCurrentUser()` call; helper does both).
6. Help-page audit: list `help/`, `help/faq`, `help/getting-started`, `help/troubleshooting`; document in `docs/code-standards.md#help-anon-policy` that intentional anon access is approved (no code change).
7. Customer-touched vs ops-internal split:
   - **Customer-touched** (page renders data customer might see in support context): `tenant-lookup`, `handover-wizard`, `pricing`
   - **Ops-internal**: `webhook-deliveries`, `email-outbox`, `audit-log`, `crons`, `cost`, `storage`, `refunds`, `deploy-status`
   - Confirm split with stakeholders before string migration starts
8. Migrate ~25 hardcoded strings in 3 customer-touched admin pages: replace literal JSX text with `t('admin.customer-touched.<key>')`; add VI + EN keys in `messages/{vi,en}.json` (preserve EN verbatim; VI from translator review).
9. Create `docs/code-standards.md#admin-i18n` policy section: rationale (operator-internal UI, no customer eyeballs, lower translation burden), scope (lists all ops-internal admin paths), revocation criteria.
10. Add ESLint exception comment at top of each ops-internal admin file:
    ```
    /* eslint-disable react/jsx-no-literals — ops-internal EN-only per docs/code-standards.md#admin-i18n */
    ```

## Todo List

- [ ] Re-grep 6 client pages and confirm list
- [ ] Wrap missions/page.tsx with server gate
- [ ] Wrap workflows/page.tsx with server gate
- [ ] Wrap api-keys/page.tsx with server gate
- [ ] Wrap system-health/page.tsx with server gate
- [ ] Wrap billing/page.tsx with server gate
- [ ] Wrap proposals/page.tsx with server gate
- [ ] Enumerate full admin/* page list via find
- [ ] Implement `seed/auth/require-master-tier.ts` + unit tests
- [ ] Apply requireMasterTier to all 14 admin pages
- [ ] Confirm customer-touched vs ops-internal split
- [ ] Migrate hardcoded strings in 3 customer-touched admin pages
- [ ] Add VI+EN keys to messages/*.json
- [ ] Author `docs/code-standards.md#admin-i18n` + `#help-anon-policy` sections
- [ ] Add ESLint disable annotation to 8 ops-internal admin files
- [ ] Run `npm run build` + `npm test` + pre-push green
- [ ] Verify admin pages reject non-MASTER tier locally

## Success Criteria

- All 6 client pages have server-side `getCurrentUser()` gate
- All 14 admin pages enforce `tier=MASTER`
- Help-page anon access audited + documented
- 3 customer-touched admin pages render bilingual VI+EN via `t()`
- 8 ops-internal admin pages annotated with ESLint exception
- `npm run build` + `npm test` exit 0
- `npm run lint` no increase over 341 baseline

## Risk Assessment

| Risk | Likelihood | Mitigation |
|---|---|---|
| Existing admin tests break when `requireMasterTier` enforces gate | High | Stub `getCurrentUser` + `getUserTier` in test setup; mock returns MASTER tier |
| Server wrapper double-renders client component on hydration | Medium | Pass user as serializable prop; verify with React DevTools |
| i18n key collisions with existing namespace | Low | Use distinct `admin.customer-touched.*` prefix; lint-check duplicate keys |
| VI translations inaccurate (no native reviewer) | Medium | Stub initial VI with English + flag in `messages/vi.json` for follow-up; do not block phase |
| Wrong customer-touched split | Medium | Stakeholder check before string migration; revisable post-hoc |

## Security Considerations

- This IS the security phase. Closes:
  - **Client-side auth assumption** (XSS hole if session corrupted on client)
  - **Missing admin role check** (any logged-in user could see `admin/*`)
- All gates server-side; no reliance on client middleware
- `requireMasterTier` MUST query DB on every call (no client cache) until proven hot path
- Help pages remain anon — confirm no PII rendered

## Next Steps

- Unblocks Phase 03 a11y/visual/contract test runs against now-gated routes
- Defer queue: ops-internal i18n full migration (P4), NOWPayments handover wizard doctrine fix (P7)

## Unresolved Questions

1. Customer-touched vs ops-internal split — `admin/pricing` is borderline (operator sees, but copy could leak in support). Confirm classification.
2. `requireMasterTier` redirect target — `/dashboard?error=admin_required` shows toast or silently dashboard? Need UX call.
3. Help pages — should `help/troubleshooting` require login for IP-rate-limit? Or keep anon for SEO?
4. VI translation source — translator-pass deferred. Acceptable risk to ship stub VI in this phase?
5. `requireMasterTier` perf — fetches user + tier sequentially. Combine in single D1 query for hot pages?
