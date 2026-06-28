# Sophia No-Code / No-Tech Doctrine

> Authoritative product positioning for Sophia AI Factory.
> Effective: 2026-05-15. Supersedes any prior assumption about operator-managed RaaS integrations.

## Positioning

Sophia AI Factory is a **no-code, no-tech platform** for non-technical CEOs running Revenue-as-a-Service (RaaS) businesses. Two core principles flow from this:

1. **User self-input everything.** Every integration (API keys, payment providers, affiliate networks, AI services) is configured by the customer via the Setup Wizard or in-app forms. No operator setup, no developer onboarding.
2. **Operator does NOT manage RaaS-side infra.** We ship and operate the platform code. We do NOT register cron jobs, observability tokens, or third-party services on behalf of customers — and we do NOT require operator credentials for the platform to function in production.

## Implications

### Customer side (BYOK — Bring Your Own Keys)
- OpenRouter / Anthropic / OpenAI keys → customer enters in Setup Wizard
- ElevenLabs / D-ID / HeyGen keys → customer enters
- NOWPayments / PayOS API keys → customer enters
- Affiliate network keys (Awin, ShareASale, etc.) → customer enters
- Telegram bot token → customer enters
- ANY third-party integration → customer-owned, customer-configured

The Setup Wizard is the single onboarding gate. After it, the platform self-serves.

### Operator side (PLATFORM-ONLY)
- We deploy the platform code via CF-direct doctrine (`npm run deploy:full`)
- We manage `wrangler.toml` bindings (D1, R2, KV, secrets)
- We DO NOT register external crons (Upstash QStash) for backup automation
- We DO NOT require third-party observability tokens (Sentry Auth Token) for source map upload
- We DO NOT operate ANYTHING that requires an OPERATOR human to provide a credential to make the platform "complete"

If a feature requires operator-side third-party setup to be "fully green", it is **out of scope** until either (a) the feature can be made self-configuring via UI, or (b) the feature is moved to the customer side.

## Implications for Backup & Monitoring

### Backup (formerly Phase 03 OP-1)
- R2 lifecycle (30-day retention) is the **de-facto backup strategy**. Each `BACKUPS_BUCKET` write is auto-rotated.
- A scheduled D1 dump (`/api/cron/d1-backup` route) exists but is NOT operator-registered with an external cron. The route is reachable via authenticated curl — useful for ad-hoc manual triggers.
- Recovery procedure: manually invoke `/api/cron/d1-backup` with `CRON_SECRET` when needed; use `wrangler d1 execute --file=<dump.sql> --remote` to restore.
- Score impact: Layer 10 stays at 7/10 — no operational track record, but route + bucket + procedure exist.

### Monitoring (formerly Phase 04 OP-2)
- Sentry SDK is wired in `sentry.client.config.ts` + `sentry.server.config.ts`. Errors flow to Sentry org with **minified** stack traces.
- Source map upload (symbolication) requires `SENTRY_AUTH_TOKEN` at deploy time — this is **optional**. Without it, errors are still captured; trace lines are minified.
- Cloudflare Worker logs (`wrangler tail`) are the canonical real-time error stream regardless of Sentry state.
- Score impact: Layer 7 stays at 8/10 — captured but not symbolicated.

### DMARC graduation (formerly Phase 05 TG-1)
- DMARC `p=none` is current. Graduation to `p=quarantine` requires 30-day monitoring of rua reports.
- If rua reports indicate clean state at 2026-06-12, operator may graduate via Cloudflare DNS API — but this is **operational discretion**, not a platform requirement.

## Score Honest Ceiling Under This Doctrine

| Layer | Score | Notes |
|-------|------:|-------|
| L1 Database | 7/10 | D1 + R2 lifecycle backup (no external cron) |
| L2 Server | 9/10 | tagCache wired, all bindings live |
| L3 Networking | 9/10 | DMARC `p=none` operational; `p=quarantine` discretionary |
| L4 Cloud | 9.5/10 | Cross-layer exemptions documented |
| L5 CI/CD | 10/10 | Pre-push fail-mode + deploy guard active |
| L6 Security | 9/10 | 0 HIGH vulns, 3 `:any` in prod (mostly migration noise) |
| L7 Monitoring | 8/10 | Sentry captures errors; sourcemaps optional |
| L8 Containers | 10/10 | Serverless — N/A by audit framework |
| L9 CDN | 9/10 | revalidateTag/Path live via tagCache D1 |
| L10 Backup | 7/10 | Route + bucket + 30d lifecycle; no external cron |
| **TOTAL** | **91.5/100** | **Final ceiling under no-tech doctrine.** Going higher requires either (a) operator infra (rejected by doctrine), or (b) sustained operational track record (months of DR drills, monthly restore tests). |

## Anti-Patterns Forbidden by This Doctrine

1. ❌ Designing a feature that requires the operator to provide a third-party credential before it "works"
2. ❌ Documenting operator setup steps in customer-facing onboarding flows
3. ❌ Blocking platform deploys on operator's QStash/Sentry/Stripe/etc. setup
4. ❌ Adding "operator action required" gates to score calculation
5. ❌ Reporting "X/100 IF operator does Y" — score must reflect what actually ships out of the box

## Resume Trigger

This doctrine is intentionally restrictive. To revise (e.g., if Sophia adds an operator dashboard for managing tenant infra):
1. Update this file with the new positioning
2. Update `apps/sophia-ai-factory/CLAUDE.md` references
3. Re-run 10-layer audit with new scoring criteria
4. Open a plan with `doctrine-change` tag

## Cross-references

- `apps/sophia-ai-factory/CLAUDE.md` — deploy doctrine + BYOK reminder
- `.claude/rules/sophia-handover-rules.md` — client-facing quality rules
- `.claude/rules/sophia-deploy-verify.md` — verification flow
- `plans/260515-0830-gap-91to93/plan.md` — archived roadmap that informed this doctrine
