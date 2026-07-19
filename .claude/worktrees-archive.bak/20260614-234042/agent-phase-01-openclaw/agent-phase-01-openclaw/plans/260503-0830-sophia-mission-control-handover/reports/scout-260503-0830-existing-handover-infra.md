# Scout Report — Existing Handover Infrastructure

Date: 2026-05-03 0830
Plan: `plans/260503-0830-sophia-mission-control-handover/`

## What's Already Built (Reuse)

| Capability | Path | Status |
|---|---|---|
| Resend email transport | `src/lib/email/sender.ts` | Working, dry-run fallback |
| Email templates (welcome) | `src/lib/handover/handover-email-service.ts` | i18n vi/en, inline HTML |
| Onboarding video email | `src/lib/email/onboarding-emails.ts` | Working |
| Magic-link issue + validate | `src/lib/handover/handover-magic-link.ts` | Working, 24h TTL, 1-time |
| `/welcome/[token]` page | `src/app/[locale]/welcome/[token]/page.tsx` | Working |
| Welcome validate API | `src/app/api/welcome/validate/[token]/route.ts` | GET + POST consume |
| Welcome status API | `src/app/api/welcome/status/route.ts` | Returns milestones |
| Welcome resend API | `src/app/api/welcome/resend/route.ts` | Working |
| Auto-handover orchestrator | `src/lib/handover/auto-handover.ts` | Wired in IPN |
| NOWPayments IPN | `src/app/api/webhooks/nowpayments/route.ts` | Validates HMAC, dispatches |
| API key validator | `src/lib/security/api-key-validator{-db,-crypto,-types}.ts` | Postgres backend |
| API key UI | `src/components/raas/api-key-{list,create-modal}.tsx` | Working |
| API keys dashboard | `src/app/[locale]/dashboard/api-keys/page.tsx` | Working |
| Quota usage bar | `src/components/dashboard/quota-usage-bar.tsx` | Bound to props |
| Health indicator | `src/components/dashboard/health-indicator.tsx` | 30s polling |
| Plan upgrade widget | `src/components/dashboard/plan-upgrade-widget.tsx` | Working |
| Handover onboarding banner | `src/components/dashboard/handover-onboarding-banner.tsx` | Shows on dashboard |
| Uptime check cron | `src/app/api/cron/uptime-check/route.ts` | 5-min, alert-only |
| Email drip cron | `src/app/api/cron/email-drip/route.ts` | Day 1/3/7 marketing |
| Cron auth | `src/lib/security/cron-auth.ts` | Working |
| Auto-handover plan (prior) | `plans/260502-2350-auto-handover-from-payment/` | Done |
| GAP2 self-serve plan | `plans/260503-0830-sophia-self-serve-checkout-flow/` | In progress (dependency) |

## What's Missing (Build)

| Capability | Why Missing | Phase |
|---|---|---|
| Durable email outbox | Sends are best-effort try/catch | 02 |
| `/onboarding` 3-step flow | Only `/welcome` magic-link landing | 03 |
| Welcome milestone POST endpoint | No way to mark onboarding step complete | 03 |
| API keys on D1 | Schema only in Postgres (Supabase legacy) | 04 |
| Mission control composite widget | Widgets exist but no composite hero | 05 |
| Public `/status` page | Internal health pill only | 06 |
| Status data tables + rollup | Uptime cron alerts but doesn't persist | 06 |
| Milestone-aware lifecycle emails | Drip is time-only | 07 |
| Lifecycle email log (dedup) | No idempotency table | 07 |

## Stack Confirmed
- Next.js 16 + Cloudflare Workers (OpenNext)
- D1 SQLite (TEXT ids, INTEGER timestamps convention)
- Better Auth for sessions
- Resend for email (`RESEND_API_KEY`, `EMAIL_FROM=Sophia AI <noreply@mekongmind.com>`)
- Wrangler crons listed in `wrangler.toml` lines ~67-87
- i18n: `messages/en.json` + `messages/vi.json`, namespace pattern `dashboard.*`, `pricing.*`

## Cron Slots Available
Current crons (16 total): `*/5`, `5 *`, `0 1`, `0 2`, `0 3`, `0 4`, `0 5`, `*/10`, `0 6 * * 1`, `*/15`, `*/1`, `0 7`, `0 0`, `10 *`, `0 0 1 * *`, `7 *`. Cloudflare allows up to 5 cron triggers per worker on free, 100 on paid — verify plan limit before adding 2 more (outbox flush + status rollup).

## Risks / Unknowns
- Cloudflare Worker cron limit — verify with `wrangler whoami` plan tier
- Email deliverability for `mekongmind.com` sender on `sophia.agencyos.network` site — DKIM alignment may fail SPF check
- Existing API keys in Postgres need migration script if production has any rows

## Unresolved Questions
- Does Postgres `raas_api_keys` table have production rows that need D1 migration, or is it greenfield?
- Is `/api/v1/agent-chat` streaming-compatible on Cloudflare Workers? (Phase 03 step 3 depends on it)
- Should the `/status` page live under `[locale]` or be locale-agnostic English-default? (Plan assumes locale-agnostic)
