# Sophia AI Factory — Infrastructure Audit: Layers 4–6
**Date:** 2026-03-26 | **Auditor:** debugger subagent
**Scope:** Cloud Infrastructure, CI/CD, Security
**Production:** https://sophia.agencyos.network
**Stack:** Cloudflare Workers + D1 + R2 / Next.js (OpenNext) / Polar.sh

---

## Layer 4: Cloud Infrastructure — 7/10

### Cloudflare Services Used (from `wrangler.jsonc`)
| Service | Binding | Purpose |
|---------|---------|---------|
| Workers | — | Runtime (OpenNext CF adapter) |
| D1 | `DB` → `sophia-raas-db` | Primary database |
| R2 | `NEXT_INC_CACHE_R2_BUCKET` → `sophia-ai-factory-opennext-cache` | ISR cache |
| Assets | `ASSETS` | Static file serving |
| Service Binding | `WORKER_SELF_REFERENCE` | Fire-and-forget self-calls (mission execution) |
| Images | `IMAGES` | Cloudflare Images binding |

- [x] Serverless/Edge runtime — Workers handles auto-scaling, no infra to manage
- [x] Bindings documented in `wrangler.jsonc` — D1 database_id is non-secret (correct)
- [x] R2 bucket for ISR cache — appropriate CF-native solution for OpenNext
- [x] Self-referencing service binding for async mission execution (clever CF pattern)
- [x] `compatibility_date: 2026-03-17` — current, avoids deprecated behavior
- [x] `nodejs_compat` + `global_fetch_strictly_public` flags — correct for CF Workers
- [ ] **No KV** — rate limiter is in-memory per-isolate (per-isolate, not global). Acknowledged in code comment as V1 limitation. Risk: high-volume abuse across isolates bypasses limits
- [ ] **No Cloudflare R2 for user uploads** — not applicable for current feature set, but noted as gap if file uploads added
- [ ] **Cost estimate not documented** — no `docs/cost-estimate.md` or equivalent
- [ ] **Vendor lock-in risk not documented** — deeply CF-native (D1, Workers, R2, service bindings). Migration to another provider would require significant rework

**Cost Estimate (rough):**
- Workers: Free tier likely sufficient at <100 clients (100k req/day free)
- D1: Free tier (5GB storage, 5M reads/day) — likely sufficient for V1
- R2: $0.015/GB storage, free egress — minimal cost for ISR cache
- Images: Free tier 1k transforms/month
- **Total estimated: ~$0–$10/month at current scale**

**Vendor Lock-in Risk: HIGH** — D1 (no standard SQL migration path), Service Bindings, and R2 are CF-proprietary. Exit requires rewriting DB layer + async execution model.

---

## Layer 5: CI/CD — 6/10

### Workflows
| File | Trigger | Purpose |
|------|---------|---------|
| `test.yml` | push, pull_request | Lint + Build |
| `daily-repo-status.lock.yml` | daily cron (17:58 UTC) | Repo status report (gh-aw generated) |

### Recent Runs (last 5 as of 2026-03-26)
All 5 runs: `completed / success` — pipeline is green and stable.
Average duration: ~1m17s

- [x] CI runs on every push AND pull_request — fast feedback loop
- [x] Node.js 20 — current LTS
- [x] Lint step (`npm run lint`) before build
- [x] Build step (`npm run build`) — validates TypeScript compilation
- [x] `actions/checkout@v4`, `actions/setup-node@v4` — pinned major versions
- [x] Pipeline is green — 5/5 recent runs successful
- [ ] **No automated tests in CI** — `test.yml` only runs `lint` + `build`, no `npm test`. Unit/integration tests not executed in CI
- [ ] **No Cloudflare Workers deploy step** — no `wrangler deploy` in CI. Deploy mechanism unknown (manual? separate CF dashboard integration?)
- [ ] **No PR preview deployments** — no preview environment per PR
- [ ] **No post-deploy smoke tests** — no production health check after deploy
- [ ] **No security scanning** — no `npm audit`, no Snyk, no dependency vulnerability check in pipeline
- [ ] **No test coverage reporting** — even if tests exist locally, no coverage gate in CI

**Critical gap:** CI validates code compiles but does NOT run tests. A regression could ship if tests only exist locally.

---

## Layer 6: Security — 7/10

### Authentication
- [x] Custom JWT (PBKDF2 100K iterations) — strong KDF for password hashing
- [x] 7-day cookie-based auth (`auth-token` httpOnly cookie assumed)
- [x] JWT verified on every protected request via `verifyJwt()` in middleware
- [x] Admin role checked in D1 (not just JWT claim) — correct approach, prevents privilege escalation via forged tokens
- [x] `org_id` derived from verified JWT, not from `x-org-id` header — explicit SECURITY FIX comment in middleware confirms awareness of header injection attack
- [x] Unauthenticated page requests redirect to `/login?redirect=<path>`
- [x] `JWT_SECRET=REDACTED` absence handled gracefully (503 or /status redirect)

### API Auth Guards
- [x] `/api/org`, `/api/billing`, `/api/onboarding`, `/api/admin` — protected in middleware
- [x] `/api/v1/*` — API key auth via `validateApiKey()` with Bearer token
- [x] `/api/raas/missions` — `getAuthContext()` JWT check
- [x] `/api/raas/execute` — internal secret (`x-internal-secret` header)
- [x] `/api/webhooks/polar` — webhook signature verification (`x-polar-signature`)
- [x] `/api/cron/process-emails` — `x-cron-secret` header guard
- [x] `/api/referral/earn` — internal secret (server-to-server)
- [x] `/api/affiliate/content` — `getAuthContext()` JWT check

### Secrets Management
- [x] `.env.local` is gitignored (confirmed: `apps/sophia-proposal/.env.local` not in git)
- [x] `.env.example` committed (safe template with placeholder values)
- [x] No actual secrets found hardcoded in source — all `Bearer` matches are docs/examples
- [x] Secrets expected via CF Workers secrets (`JWT_SECRET=REDACTED`, `POLAR_API_KEY`, `INTERNAL_API_SECRET`, etc.)
- [ ] **`CRON_SECRET` is optional** — cron endpoint skips auth check if `CRON_SECRET` env var is unset. If not configured in CF secrets, the cron endpoint is open to unauthenticated POST

### Security Headers (`next.config.ts`)
- [x] `X-Frame-Options: DENY` — clickjacking protection
- [x] `X-Content-Type-Options: nosniff` — MIME sniffing protection
- [x] `Referrer-Policy: strict-origin-when-cross-origin`
- [x] CORS on `/api/v1/*` — `Access-Control-Allow-Origin: *` (public API, acceptable)
- [ ] **No `Strict-Transport-Security` (HSTS)** — not set in next.config or wrangler. CF dashboard may enforce HTTPS but no header guarantee
- [ ] **No `Content-Security-Policy` (CSP)** — missing. Increases XSS risk surface

### XSS Risk
- [ ] **`dangerouslySetInnerHTML` without sanitization** in `/app/(dashboard)/proposals/new/page.tsx` — AI-generated HTML (executiveSummary, problemStatement, proposedSolution, timeline, investment, nextSteps) rendered directly without DOMPurify or equivalent sanitization. **Risk: if AI output or upstream data is compromised, stored XSS possible**
- [x] JSON-LD `dangerouslySetInnerHTML` in layout + blog — low risk (server-controlled structured data)

### SQL Injection
- [x] All D1 queries use `prepare().bind()` parameterized pattern — no string interpolation in SQL found
- [x] Query builder (`d1-query-builder.ts`) uses parameterized statements throughout

### Rate Limiting
- [x] Per-API-key rate limiting on all `/api/v1/*` routes (`checkRateLimit`, `rateLimitHeaders`)
- [ ] **In-memory rate limiter** — per CF Worker isolate, not globally coordinated. High-traffic clients can exceed limits by hitting different isolates. Acknowledged in code as V1 limitation

### Admin Route
- [x] `/api/admin/provision` — JWT cookie + D1 role check enforced
- [x] Admin role verified by querying D1, not trusting JWT claim alone

---

## Summary Scores

| Layer | Score | Status |
|-------|-------|--------|
| Layer 4: Cloud Infrastructure | 7/10 | Functional, vendor lock-in undocumented |
| Layer 5: CI/CD | 6/10 | No test execution, no deploy step in CI |
| Layer 6: Security | 7/10 | Solid auth, missing HSTS/CSP, XSS in proposals |

**Combined: 20/30**

---

## Priority Fixes

### P0 — Fix Before Handover
1. **XSS in proposals page** — wrap all `dangerouslySetInnerHTML` AI outputs with DOMPurify: `DOMPurify.sanitize(html)`. Install `dompurify` + `@types/dompurify`.
2. **`CRON_SECRET` must be set** — document in deployment guide as required CF secret. Add startup check or make the guard unconditional.

### P1 — Fix Within 2 Weeks
3. **Add `npm test` to CI** (`test.yml`) — even if test suite is thin, gate deploys on test pass
4. **Add `npm audit --audit-level=high`** to `test.yml`
5. **Add HSTS header** to `next.config.ts`: `{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }`
6. **Document deploy process** — is deploy triggered by CF dashboard git integration? Add deploy step to CI or document manual process

### P2 — Nice to Have
7. Add basic CSP header (`default-src 'self'` with appropriate exceptions)
8. Document vendor lock-in exit strategy for D1 → PostgreSQL migration path
9. Document monthly cost estimate in `docs/deployment-guide.md`
10. Consider D1-backed global rate limiting for V1+ scale

---

## Unresolved Questions
- How is Cloudflare Workers deploy triggered? No `wrangler deploy` found in CI workflows. CF dashboard git integration? Manual?
- Are all required CF secrets (`JWT_SECRET=REDACTED`, `POLAR_API_KEY`, `POLAR_WEBHOOK_SECRET`, `INTERNAL_API_SECRET`, `CRON_SECRET`) actually set in CF Workers environment? No verification mechanism found.
- Is the production domain `sophia.agencyos.network` or `sophia-ai-factory.workers.dev`? Stack says agencyos.network but CLAUDE.md references sophia-ai-factory.vercel.app.
- Is DID/ElevenLabs integration still active (referenced in handover rules)? Not found in current codebase routes.
