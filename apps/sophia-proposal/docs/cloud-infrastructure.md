# Cloud Infrastructure

Sophia Proposal runs entirely on Cloudflare's edge platform — zero traditional servers.

## Services Used

| Service | Purpose | Limit / Notes |
|---|---|---|
| **Cloudflare Workers** | Next.js runtime via OpenNext | 100k req/day free; auto-scales |
| **Cloudflare D1** | SQLite database (edge-local reads) | 5 GB storage, 25M rows/day free |
| **Cloudflare R2** | Object storage (assets, exports) | 10 GB free; $0.015/GB after |
| **Cloudflare DNS** | Domain resolution + CAA records | Included with zone |
| **Vercel** | Preview deploy / CI integration | Used for PR previews only |

## Monthly Cost Estimates

| Scale | Requests/day | Estimated Cost |
|---|---|---|
| 10 users | ~1k req | **$0** (free tier covers all) |
| 100 users | ~10k req | **$0–$5** (Workers free tier = 100k/day) |
| 1,000 users | ~100k req | **$5–$25** (Workers Paid $5/mo + D1 reads) |

Workers Paid plan ($5/mo) unlocks 10M req/day — sufficient to ~10k active users.

## Scaling Strategy

- **Workers**: Auto-scale globally with zero config. No cold-start tuning needed.
- **D1**: Read-heavy workloads stay fast (edge-local). Write throughput cap: ~1,000 writes/sec per DB. Shard if needed at scale.
- **R2**: No egress fees. Scales linearly with storage only.
- **Cron triggers**: Cloudflare Workers cron — no external scheduler needed.

## Vendor Lock-in Risks & Mitigation

| Risk | Mitigation |
|---|---|
| D1 is SQLite-only (no Postgres) | Schema uses standard SQL; migrations are plain `.sql` files portable to Turso or libSQL |
| OpenNext Cloudflare adapter | Next.js code is framework-standard; switching to Vercel or self-host requires only config change |
| R2 API is S3-compatible | Any S3 client works; migration to AWS S3 or Backblaze B2 is straightforward |
| Workers runtime differences | Edge-compatible code only (no Node.js-specific APIs); tested via `@cloudflare/workers-types` |

## Budget Alerts

Set Cloudflare billing alerts at: **$10** (warning) and **$50** (hard cap).
Navigate to: Cloudflare Dashboard → Billing → Notifications.
