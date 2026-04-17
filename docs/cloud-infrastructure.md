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

**Deploy Flow:**
1. `git push origin main` → GitHub Actions
2. GitHub Actions runs tests (`npm test`, `npm audit`)
3. On success: triggers Cloudflare Deploy action
4. Builds Next.js: `npx opennextjs-cloudflare build`
5. Publishes worker to `main` environment
6. Auto-routes traffic to new deployment

**Config:** `wrangler.toml`

```toml
name = "sophia-ai-factory"
main = ".open-next/worker.js"
compatibility_date = "2026-03-17"
compatibility_flags = ["nodejs_compat", "global_fetch_strictly_public"]

[triggers]
crons = ["*/5 * * * *"]  # Health check every 5 min
```

### D1 Database

**Service:** Cloudflare D1 (SQLite)

```yaml
id: 78bd1961-b62d-43bb-b551-0c5d7d389506
name: sophia-raas-db
type: SQLite
region: SFO (US-West)
tables: 42 (users, orgs, missions, billing, signals, etc.)
size: ~50 MB (as of 2026-04-17)
backup: Daily (automatic + manual export)
replication: None (single-region)
```

**Tables (42 total):**

| Category | Tables |
|----------|--------|
| **Auth** | users, organizations, org_members, api_keys |
| **Features** | missions, mission_results, usage_logs |
| **Billing** | billing_settings, org_balances |
| **Growth** | referral_codes, affiliates, affiliate_content |
| **Content** | blog_posts (+ 5 hardcoded SEO posts) |
| **Telemetry** | signals_events (append-only founder ops telemetry) |
| **System** | migrations (schema history) |

**Access:**
- **From Workers:** Bound via `DB` binding in `wrangler.toml`
- **Local Dev:** `npx wrangler d1 execute sophia-raas-db --local`
- **Production:** `npx wrangler d1 execute sophia-raas-db --remote`
- **Direct URL:** `https://dash.cloudflare.com > Workers > D1 > sophia-raas-db`

**Migrations:**
- Stored in `migrations/` (D1 SQLite)
- Numbered: `0001-init.sql` → `0005-signals-events.sql`
- Applied automatically on `wrangler d1 migrations apply`

**Founder Ops Telemetry (signals_events):**
- **Purpose:** Append-only log for operational metrics (not product analytics)
- **Events:** tier_conversion, payment_success, payment_failed, agent_dispatch, api_rate_limit_hit, byok_call, byok_timeout
- **Writers:** `src/lib/signals/track.ts` (emitted during feature execution)
- **Readers:** Weekly digest cron queries + exports to GH Issue + Telegram TL;DR

### R2 Storage (Cache & Assets)

**Service:** Cloudflare R2 (S3-compatible object storage)

```yaml
bucket: sophia-ai-factory-opennext-cache
region: US auto (geo-optimized)
purpose: Next.js incremental static regeneration (ISR) cache
retention: 30 days (TTL on cache objects)
public: No (private bucket, accessed via CF Workers)
```

**Usage:**
- Caches static assets generated at build time
- ISR cache for dynamically-generated pages
- Reduces rebuild latency on content changes

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
- **Type:** Flexible (CF terminates SSL → origin uses HTTP)
- **Protocol:** TLS 1.2+
- **HSTS:** Enabled (max-age 31536000, includeSubDomains)
- **Certificate:** Auto-renewed by Cloudflare

---

## Infrastructure Layers (10-Layer Audit Score)

### Layer 1: Database (D1) — 9/10

- **Schema:** 42 tables, versioned migrations (0001-0005)
- **RLS:** Handled in application logic (JWT org_id checks)
- **Backups:** Automatic daily + manual `npx wrangler d1 export`
- **Disaster Recovery:** RPO 24h, RTO 4h (restore from D1 backup + git redeploy)
- **Gap:** Single-region only (no cross-region failover)

### Layer 2: Server (Workers) — 8/10

- **Hosting:** Cloudflare Workers (serverless, auto-scaling)
- **Edge Functions:** All routes run on edge (no centralized data center)
- **Cold Start:** < 100ms typical (negligible)
- **Performance:** Build time 8-10s, bundle 400-500 KB (gzipped)
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

### Layer 5: CI/CD — 9/10

- **Pipeline:** GitHub Actions (`.github/workflows/test.yml`)
- **Triggers:** On push to main
- **Steps:** Lint → Test (205 tests) → Audit → Deploy
- **Deployment:** Automatic to Cloudflare Workers on green build
- **Rollback:** Manual via `git revert + push` or `wrangler rollback`

### Layer 6: Security — 9/10

- **Auth:** Custom JWT (PBKDF2 hashing, 7-day expiry)
- **Secrets:** Stored in CF Worker secrets (encrypted at rest)
- **Tenant Isolation:** JWT org_id validation, no header switching
- **XSS Prevention:** DOMPurify sanitization, CSP header
- **Rate Limiting:** `/api/v1/demo` capped at 10 req/min per IP
- **Admin Enforcement:** Admin-only routes verify role='admin'

### Layer 7: Monitoring — 8/10

- **Error Tracking:** Sentry (client, server, edge)
- **Structured Logging:** JSON logger (lib/logger.ts)
- **Uptime Monitoring:** Cron-based `/api/health` check every 5 min
- **Metrics:** GitHub Actions CI/CD metrics, Cloudflare analytics
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

- **Database:** D1 daily backups, manual export via `wrangler d1 export`
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
| `POLAR_ACCESS_TOKEN` | Payment processing | As needed |
| `POLAR_WEBHOOK_SECRET` | Webhook verification | With access token |
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
- [ ] GitHub Actions passes tests & audit
- [ ] CF Workers automatically deploys
- [ ] Verify health: `curl https://sophia.agencyos.network/api/health`
- [ ] Check Sentry for errors (should be 0 new errors)
- [ ] Monitor uptime cron logs
- [ ] Verify D1 backup ran (check `.wrangler/migrations/applied`)

---

## Troubleshooting

### Workers Not Deploying
1. Check GitHub Actions status: `gh run list`
2. Check Cloudflare dashboard for deploy errors
3. Verify `wrangler.toml` syntax
4. Check secret availability: `npx wrangler secret list`

### D1 Query Failing
1. Check connection: `npx wrangler d1 execute sophia-raas-db --remote --command "SELECT 1"`
2. Verify migration applied: `SELECT * FROM migrations`
3. Check query syntax (SQLite, not PostgreSQL)

### Workers Timeout (30s)
1. Move slow operations to background jobs
2. Consider splitting into multiple routes
3. Profile with Sentry APM

---

**Last Updated:** 2026-03-26
