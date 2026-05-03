---
title: "Sophia setup-wizard fix + go-live"
description: "Fix session cookie reject (BLOCKER) + i18n placeholder (UX) → deploy GREEN production."
status: pending
priority: P1
effort: 4h30m
branch: main
tags: [sophia, bug-fix, auth, i18n, go-live, cloudflare-workers]
created: 2026-05-03
---

# Sophia Setup-Wizard Fix + Go-Live

## Context

- **Project:** Sophia AI Factory — Next.js 16 + Cloudflare Workers + D1 + Better Auth + next-intl + NOWPayments
- **Production:** https://sophia.agencyos.network/setup-wizard
- **Deploy SHA:** `2d057bc6` (live) — i18n fix commits already deployed
- **Blocker:** Magic-link → /setup-wizard → 307 redirect to /login (session cookie rejected by `auth.api.getSession()`)
- **Secondary:** 15 i18n keys missing in vi.json/en.json → English placeholders in wizard UI (autofill uncommitted)

## Reports

- Debugger root-cause: [`plans/reports/debugger-260503-setup-wizard.md`](../reports/debugger-260503-setup-wizard.md)

## Phases

| # | Phase | Status | ETA | Goal |
|---|-------|--------|-----|------|
| 01 | [Instrument logging](phase-01-instrument-logging.md) | ✅ complete | 30m | Surface silent catch errors → diagnose H1/H2/H3 in prod |
| 02 | [Fix cookie chain](phase-02-fix-cookie-chain.md) | ✅ complete | 90m | Set explicit `cookiePrefix` + verify Wrangler secrets + align manual cookie params with Better Auth |
| 03 | [Fix i18n keys](phase-03-fix-i18n-keys.md) | ✅ complete | 30m | Commit autofilled keys + manual VN review for 15 keys |
| 04 | [Test verification](phase-04-test-verification.md) | pending | 60m | Unit tests + manual smoke + `wrangler tail` clean |
| 05 | [Deploy + verify GREEN](phase-05-deploy-verify.md) | pending | 45m | Push → poll all CI jobs → curl prod → browser checkout test |
| 06 | [Finalize](phase-06-finalize.md) | pending | 15m | Update runbook + changelog + tag release |

## Critical Dependencies

- Cloudflare secret `BETTER_AUTH_SECRET` MUST exist (sessions silently fail without it)
- Cloudflare secret `BETTER_AUTH_URL` SHOULD = `https://sophia.agencyos.network`
- Wrangler CLI access for `wrangler tail` (Phase 4) and `wrangler secret put` (Phase 2)
- D1 binding `DB` available in Worker context

## Quality Gates (NON-NEGOTIABLE)

- 0 `:any` types (Sophia rule)
- 0 `console.log` in production code (use `logger`)
- `npm run build` passes (apps/sophia-ai-factory)
- `npm test` passes (no skipped failing tests)
- CI/CD all jobs GREEN (Lint+Build+Test → Deploy to CF Workers)
- Browser test PASS for: cold visit (307 expected) + magic-link flow (200 + page loads) + checkout tier redirect

## Stack Reminders

- App code: `apps/sophia-ai-factory/`
- Run build/test from app dir
- Auth import: `@/lib/better-auth-session`
- DB import: `@/lib/db/client` (sync `createServerClient()`)
- NO Polar (rejected) — NOWPayments + PayOS only
- Deploy: push to `main` → GH Actions → wrangler deploy (NOT direct CLI)

## Top Risks

1. **Fix 2 (cookie name) blast radius** — wrong name = ALL magic-link sessions break. Mitigation: stage with `wrangler dev --remote` before push.
2. **D1 cold start (H3)** — transient failures invisible. Mitigation: Phase 1 logging surfaces this immediately on prod.
3. **CI deploy job lag** — `gh run list -L 1` may show test job GREEN but deploy job still pending. Mitigation: explicit `gh run view <ID> --json jobs` per Rule binh-phap-cicd.

## Success Criteria

- Magic-link → /setup-wizard loads page (no 307 to /login)
- Wizard renders Vietnamese strings (no "Ai Keys", "Launch", "Title" placeholders)
- All 6 phases complete, prod GREEN, runbook updated
