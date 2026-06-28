# Phase 01 — Email Infrastructure Audit + Template Hardening

## Context Links
- `apps/sophia-ai-factory/src/lib/email/sender.ts` — Resend wrapper
- `apps/sophia-ai-factory/src/lib/email/email-templates.ts` — shared HTML templates
- `apps/sophia-ai-factory/src/lib/handover/handover-email-service.ts` — auto/upgrade variants
- `apps/sophia-ai-factory/src/app/api/welcome/resend/route.ts` — resend endpoint

## Overview
- **Priority:** P1 (foundation — every other phase ships emails through this)
- **Status:** pending
- **Effort:** 30m

Resend integration exists. Audit DKIM/SPF/DMARC for `mekongmind.com` (current `EMAIL_FROM`) and decide whether to migrate sender to `sophia.agencyos.network` subdomain to consolidate brand. Centralise template tokens (`BRAND_COLOR`, `BASE_URL`, `SUPPORT_URL`) into a single module — currently duplicated across `onboarding-emails.ts` and `handover-email-service.ts`.

## Key Insights
- `RESEND_API_KEY` falls back to dry-run logging — fine for dev; production must reject if missing in IPN handler path
- Multiple ad-hoc HTML strings exist; unify via single `renderEmail({ template, data })` to keep CSP/inline-style consistent
- Welcome email already i18n-aware (vi/en) — keep that contract

## Requirements
- DKIM, SPF, DMARC (`p=quarantine` minimum) verified on whichever sender domain we use
- `EMAIL_FROM` env var documented in `wrangler.toml` + `.env.example`
- Single template registry under `src/lib/email/templates/` with one file per template (kebab-case)
- All templates render with zero external resources (no remote images — inline SVG or skip)

## Architecture
```
src/lib/email/
├── sender.ts                  (existing — Resend transport)
├── templates/
│   ├── shared-layout.ts       NEW — header/footer/CTA helpers
│   ├── welcome-magic-link.ts  REFACTOR from handover-email-service
│   ├── onboarding-nudge.ts    NEW (D+1)
│   ├── first-week-summary.ts  NEW (D+7)
│   └── tier-upgrade.ts        REFACTOR
└── render-email.ts            NEW — unified render({template, locale, data})
```

## Related Files
**Modify:**
- `src/lib/handover/handover-email-service.ts` — delegate to new template registry
- `src/lib/email/email-templates.ts` — split into per-template files
- `src/lib/email/onboarding-emails.ts` — move `onboardingVideoReadyEmailHtml` into template registry

**Create:**
- `src/lib/email/templates/shared-layout.ts`
- `src/lib/email/templates/welcome-magic-link.ts`
- `src/lib/email/templates/onboarding-nudge.ts`
- `src/lib/email/templates/first-week-summary.ts`
- `src/lib/email/render-email.ts`

**Document:**
- `docs/email-deliverability.md` (new) — DKIM/SPF/DMARC setup + sender domain decision

## Implementation Steps
1. Add `dig TXT mekongmind.com` + `dig TXT _dmarc.mekongmind.com` to `scripts/check-email-dns.sh`; capture current state
2. Decide sender: `noreply@sophia.agencyos.network` (recommended, matches PROD_URL) or stay on `mekongmind.com`
3. If switching: add Resend domain in dashboard, copy DNS records into Cloudflare DNS, document in `email-deliverability.md`
4. Extract `shared-layout.ts` (header, footer, button, locale helper) — ~80 LOC
5. Migrate welcome HTML from `handover-email-service.ts` to `templates/welcome-magic-link.ts`, keep i18n contract
6. Add `renderEmail({ template: 'welcome-magic-link', locale, data })` returning `{ html, text, subject }`
7. Update `handover-email-service.ts` to call `renderEmail` instead of inline HTML
8. Run `pnpm -C apps/sophia-ai-factory tsc --noEmit` — fix type errors
9. Snapshot test: render each template with fixture data, snapshot to `__tests__/__snapshots__/`

## Todo
- [ ] DNS audit script + report
- [ ] Sender domain decision documented
- [ ] `shared-layout.ts` extracted
- [ ] All 4 templates in registry
- [ ] `renderEmail` returns `{html, text, subject}`
- [ ] handover-email-service refactored to use registry
- [ ] Snapshot tests pass

## Success Criteria
- `dig` shows DKIM + SPF + DMARC pass for chosen sender
- 0 inline `<style>` duplication across templates
- Snapshot tests: 4 templates × 2 locales = 8 snapshots stable

## Risk Assessment
- **DNS propagation lag** → run audit on day 1 to start clock; templates can be built in parallel
- **Resend domain switch breaks existing flows** → keep `mekongmind.com` as fallback in env until verified

## Security Considerations
- No user data in template URLs except signed magic-link tokens (already 1-time-use, 24h TTL — verified in `handover-magic-link.ts`)
- `text/plain` alt-body required for spam-filter scoring

## Next
Phase 02 wires the welcome trigger into the IPN handler that GAP2 hardens.
