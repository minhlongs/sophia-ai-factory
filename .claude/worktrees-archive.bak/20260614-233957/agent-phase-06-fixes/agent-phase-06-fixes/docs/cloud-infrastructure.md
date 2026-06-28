# Cloud Infrastructure — Sophia AI Factory

> **Deployment:** Cloudflare Workers (Edge Computing)
> **Region:** Global via Cloudflare Edge Network
> **Database:** Cloudflare D1 (SQLite)
> **Status Page:** https://status.cloudflare.com

---

## Cloudflare Stack

### Workers (Compute)

**Service:** Cloudflare Workers (Serverless Edge Compute)

```yaml
specs:
  runtime: nodejs_compat (Node.js 18+ compatibility mode)
  memory: 128 MB (per request)
  cpu: Shared edge CPU (unlimited requests)
  timeout: 30 seconds (standard)
  cold_start: < 100ms typical
  regions: 300+ global edge locations
```

**Deploy Flow (CF-direct canonical since 2026-05-03):**
1. Commit and push first: `git push origin main`.
2. From the app package, run `npm run deploy:full`.
3. The deploy wrapper runs type-check, Next.js Turbopack build, OpenNext build, scheduled-handler injection, SHA secret injection, and Cloudflare deploy.
4. Verify `/api/version` short SHA matches `git rev-parse HEAD | cut -c1-8`.
5. Verify production HTTP 200.

GitHub Actions deploy is disabled by design. Do not report a deploy as green from `gh run list`.

```bash
cd apps/sophia-ai-factory
npm run deploy:full

LIVE_SHA=$(curl -s https://sophia.agencyos.network/api/version | jq -r .shortSha)
LOCAL_SHA=$(git rev-parse HEAD | cut -c1-8)
test "$LIVE_SHA" = "$LOCAL_SHA"
curl -sI https://sophia.agencyos.network | head -3
```

**Config:** `wrangler.toml`

```toml
name = "sophia-ai-factory"
main = ".open-next/worker.js"
compatibility_date = "2026-03-17"
compatibility_flags = ["nodejs_compat", "global_fetch_strictly_public"]

[[d1_databases]]
binding = "DB"
database_name = "sophia-raas-db"
migrations_dir = "migrations"

[[d1_databases]]
binding = "NEXT_TAG_CACHE_D1"
database_name = "sophia-tag-cache"

[[r2_buckets]]
binding = "NEXT_INC_CACHE_R2_BUCKET"
bucket_name = "sophia-ai-factory-opennext-cache"

[[r2_buckets]]
binding = "VIDEO_BUCKET"
bucket_name = "sophia-videos"

[[r2_buckets]]
binding = "BACKUPS_BUCKET"
bucket_name = "sophia-backups"

[images]
binding = "IMAGES"

[triggers]
crons = ["*/2 * * * *", "*/5 * * * *", "..."]  # 18 patterns as of 2026-05-21
```

### D1 Database

**Service:** Cloudflare D1 (SQLite)

| Binding | Database | Purpose |
|---|---|---|
| `DB` | `sophia-raas-db` | Primary product database: auth, billing, handover, missions, usage, telemetry |
| `NEXT_TAG_CACHE_D1` | `sophia-tag-cache` | OpenNext tag cache (`0108-opennext-tag-cache.sql`) |

**Schema source:** `apps/sophia-ai-factory/migrations/` contains 120 SQL files as of 2026-05-21. Highest numbered migration: `0117-refresh-video-generation-starter-sop.sql`.

**Table count:** do not hardcode. Verify with:

```bash
npx wrangler d1 execute sophia-raas-db --remote --command "SELECT COUNT(*) FROM sqlite_master WHERE type='table'"
```

**Access:**
- **From Workers:** Bound via `DB` binding in `wrangler.toml`
- **Local Dev:** `npx wrangler d1 execute sophia-raas-db --local`
- **Production:** `npx wrangler d1 execute sophia-raas-db --remote`
- **Direct URL:** `https://dash.cloudflare.com > Workers > D1 > sophia-raas-db`

**Migrations:**
- Stored in `migrations/` (D1 SQLite)
- Numbered through `0117-*`, with a few legacy branch filenames retained.
- Apply with `npm run deploy:migrations` or `bash scripts/apply-migrations.sh` from `apps/sophia-ai-factory/`.
- Backup with `/api/cron/d1-backup` → R2 `sophia-backups`.

**Founder Ops Telemetry (signals_events):**
- **Purpose:** Append-only log for operational metrics (not product analytics)
- **Events:** tier_conversion, payment_success, payment_failed, agent_dispatch, api_rate_limit_hit, byok_call, byok_timeout
- **Writers:** `src/lib/signals/track.ts` (emitted during feature execution)
- **Readers:** Weekly digest cron queries + exports to GH Issue + Telegram TL;DR

### R2 Storage

**Service:** Cloudflare R2 (S3-compatible object storage)

| Binding | Bucket | Purpose |
|---|---|---|
| `NEXT_INC_CACHE_R2_BUCKET` | `sophia-ai-factory-opennext-cache` | OpenNext incremental cache |
| `VIDEO_BUCKET` | `sophia-videos` | Generated/customer video storage |
| `BACKUPS_BUCKET` | `sophia-backups` | D1 SQL dumps from `/api/cron/d1-backup`, 30-day lifecycle |

### DNS & Domain

**Domain:** `sophia.agencyos.network`

```yaml
registrar: Cloudflare
nameservers: CloudFlare NS (ns1/ns2/ns3...)
record:
  type: Worker route
  target: sophia.agencyos.network/* → sophia-ai-factory Worker
  note: workers.dev subdomain is OFF (custom domain only)
status: Active, resolves globally
ssl_certificate: Auto-issued by Cloudflare (auto-renewal)
ttl: 3600 (1 hour)
```

**SSL/TLS:**
- **Type:** Cloudflare-managed TLS for Workers custom domain
- **Protocol:** TLS 1.2+
- **HSTS:** Enabled (max-age 31536000, includeSubDomains)
- **Certificate:** Auto-renewed by Cloudflare

---

## Infrastructure Layers (10-Layer Audit Score)

### Layer 1: Database (D1) — 9/10

- **Schema:** 120 SQL migration files as of 2026-05-21; count tables from D1 before reporting.
- **RLS:** D1 has no RLS; app enforces ownership through Better Auth session/org context and explicit query filters.
- **Backups:** `/api/cron/d1-backup` writes daily SQL dumps to R2 `sophia-backups`; manual `npx wrangler d1 export` remains available.
- **Disaster Recovery:** RPO 24h, RTO 4h (restore from D1 backup + git redeploy)
- **Recent Improvements:** rate limits, cron run logging, API keys, wallet/payout tables, OpenNext tag cache.
- **Gap:** Single-region only (no cross-region failover)

### Layer 2: Server (Workers) — 8/10

- **Hosting:** Cloudflare Workers (serverless, auto-scaling)
- **Edge Functions:** All routes run on edge (no centralized data center)
- **Cold Start:** < 100ms typical (negligible)
- **Performance:** build is hardware-dependent; deploy wrapper uses Turbopack to avoid M1 webpack OOM.
- **Availability:** 99.99% SLA

### Layer 3: Networking (DNS/SSL) — 8/10

- **DNS:** Cloudflare DNS (sophia.agencyos.network)
- **SSL:** Auto-issued, auto-renewed TLS certificates
- **HSTS:** Enforced (max-age 1 year)
- **Headers:** CSP, X-Frame-Options, X-Content-Type-Options configured
- **Gap:** No email DNS records (SPF/DKIM/DMARC) — handled by Resend

### Layer 4: Cloud Infrastructure — 8/10

- **Providers:** Cloudflare (primary), GitHub (code), Anthropic (AI API)
- **Services Used:** Workers, D1, R2, DNS, Tunnel (optional)
- **Auto-scaling:** Workers auto-scale globally
- **Cost:** Metered per request + D1 usage (low for current load)
- **Vendor Lock-in:** Medium (CF Workers, D1 are proprietary)

### Layer 5: Deploy & Release — 8/10

- **Pipeline:** CF-direct via `apps/sophia-ai-factory/scripts/deploy-with-sha.sh`
- **Preconditions:** local HEAD pushed to `origin/main`; working tree clean
- **Steps:** Type-check → Turbopack build → OpenNext build → SHA secret injection → Cloudflare deploy
- **Verification:** `/api/version` SHA match + production HTTP 200
- **Rollback:** Cloudflare Workers rollback or `git revert` followed by `npm run deploy:full`

### Layer 6: Security — 9/10

- **Auth:** Better Auth v1.6.2 with D1 Kysely adapter and session cookies
- **Secrets:** Stored in CF Worker secrets (encrypted at rest)
- **Tenant Isolation:** JWT org_id validation, no header switching
- **XSS Prevention:** DOMPurify sanitization, CSP header
- **Rate Limiting:** route-level rate limiting + tier/quota enforcement on protected APIs
- **Admin Enforcement:** Admin-only routes verify role='admin'

### Layer 7: Monitoring — 8/10

- **Error Tracking:** Sentry (client, server, edge)
- **Structured Logging:** JSON logger (lib/logger.ts)
- **Uptime Monitoring:** Cron-based `/api/health` check every 5 min
- **Metrics:** Cloudflare analytics, Sentry, PostHog, cron heartbeat routes
- **Gap:** No real-time APM (response times per endpoint)

### Layer 8: Containers — N/A

- **Note:** Serverless architecture (Workers) eliminates need for Docker
- **Local Dev:** Supabase CLI provides containerized local environment

### Layer 9: CDN — 8/10

- **Global Edge:** Cloudflare Workers serve from 300+ locations
- **Caching:** Cache-Control headers on static assets (immutable for build artifacts)
- **HTTP/2:** Enabled by default
- **Compression:** Brotli + gzip
- **Cache Hit Rate:** > 90% typical

### Layer 10: Backup & DR — 8/10

- **Database:** D1 daily SQL dumps to R2 plus manual export via `wrangler d1 export`
- **Code:** Git repository (full history, branch protection)
- **Secrets:** Encrypted in CF Worker secrets (no export, manual rotation)
- **DR Plan:** Documented in `docs/disaster-recovery.md`
- **RTO/RPO:** 4h / 24h

---

## Scaling & Limits

### Cloudflare Workers Limits

| Resource | Limit | Notes |
|----------|-------|-------|
| **Requests/day** | Unlimited | (enterprise) |
| **CPU time** | 50ms (shared) | Most routes < 20ms |
| **Memory** | 128 MB | Per-request isolation |
| **Request size** | 100 MB | File uploads via presigned R2 URLs |
| **Response size** | 6 MB | (gzipped to < 1 MB typical) |

### D1 Limits

| Resource | Limit | Notes |
|----------|-------|-------|
| **Storage** | 500 MB | (free tier) |
| **Concurrent connections** | 10 | Per query |
| **Query timeout** | 30 seconds | Matches Workers timeout |
| **Row size** | 1 MB | Per row |

### R2 Limits

| Resource | Limit | Notes |
|----------|-------|-------|
| **Bucket size** | Unlimited | Pay-per-GB |
| **Object size** | 5 GB max | Multipart uploads for larger |
| **Request rate** | Unlimited | Metered |

---

## Cost Breakdown (Estimated Monthly)

| Service | Cost | Notes |
|---------|------|-------|
| **Workers** | $5-20 | Bundled (includes first 100k req/day) |
| **D1** | $0.75 | Writes: 10M/mo @ $0.75 per million |
| **R2** | $2-5 | Storage @ $0.015/GB, class B @$0.006 per million ops |
| **DNS** | Free | Included with account |
| **Total** | ~$8-25 | Highly cost-efficient for current load |

---

## Environment Variables (CF Worker Secrets)

All secrets managed via `npx wrangler secret put <NAME>`:

| Variable | Service | Rotation |
|----------|---------|----------|
| `JWT_SECRET` | Auth | 90 days |
| `ANTHROPIC_API_KEY` | Claude AI | As needed |
| `OPENROUTER_API_KEY` | Multi-model AI | As needed |
| `HEYGEN_API_KEY` | Video generation | As needed |
| `RESEND_API_KEY` | Email delivery | As needed |
| `NOWPAYMENTS_API_KEY` | Payment processing | As needed |
| `NOWPAYMENTS_IPN_SECRET` | Webhook verification | With API key rotation |
| `PAYOS_CLIENT_ID` | Vietnam domestic payments | As needed |
| `PAYOS_API_KEY` | Vietnam domestic payments | As needed |
| `PAYOS_CHECKSUM_KEY` | PayOS callback verification | With API key rotation |
| `SENTRY_DSN` | Error tracking | Permanent (public URL) |

**Rotation Procedure:**
1. Generate new secret in external service
2. `npx wrangler secret put <NAME>`
3. Paste new value
4. Test in staging (if available)
5. Deploy to production
6. Revoke old secret in external service

---

## Deployment Checklist

- [ ] Code committed to `main` branch
- [ ] Local gates pass (`npm run type-check`, `npm run build`, targeted tests)
- [ ] `npm run deploy:full` exits 0
- [ ] `/api/version` short SHA matches local HEAD
- [ ] Verify health: `curl https://sophia.agencyos.network/api/health`
- [ ] Check Sentry for errors (should be 0 new errors)
- [ ] Monitor uptime cron logs
- [ ] Verify D1 backup route/R2 object freshness: `npx wrangler r2 object list sophia-backups --prefix='d1-'`

---

## Troubleshooting

### Workers Not Deploying
1. Read the `npm run deploy:full` failure output.
2. Check Cloudflare dashboard for deploy errors.
3. Verify `apps/sophia-ai-factory/wrangler.toml` syntax and bindings.
4. Check secret availability: `npx wrangler secret list`.
5. If the deploy wrapper refuses to run, push HEAD first or commit/stash local changes.

### D1 Query Failing
1. Check connection: `npx wrangler d1 execute sophia-raas-db --remote --command "SELECT 1"`
2. Verify migration applied: `SELECT * FROM migrations`
3. Check query syntax (SQLite, not PostgreSQL)

### Workers Timeout (30s)
1. Move slow operations to background jobs
2. Consider splitting into multiple routes
3. Profile with Sentry APM

---

**Last Updated:** 2026-05-21
