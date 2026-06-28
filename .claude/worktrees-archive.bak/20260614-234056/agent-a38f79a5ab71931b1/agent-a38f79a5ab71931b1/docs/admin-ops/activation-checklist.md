# Sophia Go-Live Activation Checklist

Last updated: 2026-05-13

Use this as the single operational checklist before a customer-facing launch. Fill the evidence column with links, screenshots, command output, or dashboard timestamps.

| Area | Check | Status | Evidence |
|---|---|---|---|
| Production | `https://sophia.agencyos.network` returns HTTP 200 | DONE | `curl -I`, 2026-05-13T16:04:55Z, HTTP/2 200 |
| Production | `/api/health` returns healthy status and current build metadata | DONE | 2026-05-13T16:04:56Z, `status=healthy`, sha `8d525481b1eb4b0b17f5f7791a248de2bdce90c9` |
| Cloudflare | Worker/D1/R2 resources match `wrangler.toml` | TODO | |
| Local verification | `npm run verify:green` passes from `apps/sophia-ai-factory` | DONE | 2026-05-13, 203/204 test files passed, 2055 tests passed, build passed |
| Local verification | Standalone `npm run lint` has zero errors | TODO | 2026-05-13: lint command runs but reports 305 errors and 275 warnings |
| Billing | NOWPayments live credentials configured in Cloudflare secrets | TODO | |
| Billing | PayOS live credentials configured in Cloudflare secrets | TODO | |
| Billing | Each public plan opens the correct checkout flow | TODO | |
| Billing | Webhook replay/duplicate protection verified | TODO | |
| Auth | Sign up, login, logout, and protected routes verified | TODO | |
| Video | Prompt to generated video happy path verified | TODO | |
| Telegram | `@Sophia_Bbot` onboarding and `/help` verified | TODO | |
| Support | Ticket system of record selected and linked in docs | TODO | |
| Monitoring | Better Stack/PostHog/Sentry or chosen equivalents configured | TODO | |
| Legal | Terms, privacy, refund, and AI content policy published | TODO | |
| Sales | First-customer close SOP ready for founder/operator | TODO | |

## Definition of Go-Live Green

Sophia is go-live green only when production, auth, billing, video generation, support intake, monitoring, and legal checks have evidence. A green build alone is not enough.

## Evidence Storage

Store launch evidence in `plans/reports/` or the active go-live plan folder. Keep customer private data out of screenshots and reports.
