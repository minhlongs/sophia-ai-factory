# Deploy Log — 2026-05-30 02:37 UTC-7

## Deployment Details

| Field | Value |
|---|---|
| **Commit** | `449cecc6` — fix(sop): sweep 10 bugs in SOP Dashboard |
| **Branch** | `main` |
| **Platform** | Cloudflare Workers (OpenNext v1.19.9) |
| **Worker** | `sophia-ai-factory` |
| **Version ID** | `c8a05f8f-c31c-4ce8-87d1-1ed66d56d756` |
| **URL** | https://sophia-ai-factory.agencyos-openclaw.workers.dev |
| **Upload time** | 18.34 sec |
| **Trigger deploy** | 1.74 sec |
| **Bundle size** | 38,740 KiB / gzip: 9,150 KiB |
| **Worker startup** | 35 ms |
| **Static assets** | 272 files (23 new/modified) |

## Bindings Verified

- ✅ D1: `sophia-raas-db`
- ✅ D1: `sophia-tag-cache`
- ✅ R2: `sophia-ai-factory-opennext-cache`
- ✅ R2: `sophia-videos`
- ✅ R2: `sophia-backups`
- ✅ KV: experiment namespace
- ✅ Worker self-reference
- ✅ Images binding

## Scheduled Triggers (18 active)

- `*/2 * * * *` — every 2 min
- `*/5 * * * *` — every 5 min
- `*/10 * * * *` — every 10 min
- `*/15 * * * *` — every 15 min
- Plus daily cron jobs at 01:00-07:00 UTC

## Warnings (non-blocking)

1. `usage_model` field in wrangler.toml — deprecated but harmless
2. `html2canvas` duplicate case clause — third-party library, not our code
3. `-0 === 0` comparison — third-party library, not our code
