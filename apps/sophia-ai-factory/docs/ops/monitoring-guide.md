# Monitoring Guide

> **Audience:** Solo operator (non-technical CEO)
> **Last verified:** 2026-08-19 against production codebase

---

## Overview

Sophia AI Factory uses three monitoring layers. All are optional in the no-tech doctrine — the platform works without any operator credentials configured.

| Tool | Purpose | Required? |
|---|---|---|
| Sentry | Error tracking, alerting | Optional (captures errors without `SENTRY_AUTH_TOKEN`) |
| Cloudflare Workers Logs | Real-time live logs | Always available (no config needed) |
| `perf:check` script | SLO performance validation | Runs locally via `npm run perf:check` |

**Vietnamese:** Sophia AI Factory su dung 3 lop giam sat. Tat ca deu tuy chon theo giao ly no-tech — san pham hoat dong ma khong can bat ky thong tin xac thuc nao cua operator.

---

## 1. Sentry Dashboard

**Bang dieu khien Sentry**

### What Sentry Does

Sentry captures runtime errors from both client and server. Errors flow via a minimal HTTP forwarder (`src/seed/observability/sentry-forwarder.ts`) — no heavy SDK, no blocking calls.

**Vietnamese:** Sentry bat loi chay tu ca client va server. Loi duoc chuyen qua forwarder HTTP nhe (`src/seed/observability/sentry-forwarder.ts`) — khong su dung SDK nang, khong chan luong xu ly.

### How to Access

1. Go to https://sentry.io
2. Select your organization → Sophia project
3. Click **Issues** tab

### Key Views

| View | What It Shows | When to Use |
|---|---|---|
| **Issues** | Grouped error instances | Daily check, after deploy |
| **Performance** | Page load times, API latency | Weekly review |
| **Releases** | Errors per deploy version | After deploy, to confirm new code has no new errors |
| **Alerts** | Active alert rules | To verify alerts are configured |

### Setting Up Alerts (One-Time)

Go to **Alerts → Create Alert Rule**:

**Critical Error Alert:**
- Condition: Issue is new AND level = error or fatal
- Frequency: Immediately
- Action: Send email to your ops address

**Error Spike Alert:**
- Condition: Unhandled errors > 10/min for 5 minutes
- Frequency: Immediately
- Action: Send email + Telegram notification

**Vietnamese:** Tao canh bao: Loi nghiem trong → thong bao ngay lap tuc; So luong loi tang cao → thong bao ngay + Telegram.

### Understanding Error Groups

Each error in Sentry shows:
- **Title**: What went wrong (e.g., "TypeError: Cannot read property 'id' of undefined")
- **First/Last Seen**: When the error first and last occurred
- **Events**: How many times it happened
- **Users**: How many unique users were affected
- **Stack trace**: The code path that caused the error

**Action rule:**
- 1 event, 0 users → likely a one-off, monitor
- 10+ events, 1+ users → investigate immediately
- 100+ events → P1 incident, fix within 1 hour

---

## 2. Cloudflare Workers Logs (wrangler tail)

**Nhat ky Worker Cloudflare (wrangler tail)**

This is your real-time window into what is happening in production RIGHT NOW. No configuration needed — just run the command.

### How to Use

```bash
cd apps/sophia-ai-factory
npx wrangler tail sophia-ai-factory --format=pretty
```

This streams live logs from the Cloudflare Worker. Press `Ctrl+C` to stop.

### What to Look For

| Pattern | Meaning | Action |
|---|---|---|
| `200` status codes | Request succeeded | No action needed |
| `429` status codes | Rate limited | Normal for aggressive clients; concerning if from same IP |
| `500` status codes | Server error | Check Sentry for the specific exception |
| `circuit_breaker_open` | External API blocked | Normal after multiple failures; check if external service is down |
| `CRITICAL` / `FATAL` | Severe error | Investigate immediately |
| `auth_rate_limit` | Auth rate limit hit | Normal for brute-force attempts; concerning if from legitimate users |

### Useful Wrangler Commands

```bash
# View logs for last 5 minutes only (filter noise)
npx wrangler tail sophia-ai-factory --format=pretty --since=5m

# View logs in JSON format (for analysis)
npx wrangler tail sophia-ai-factory --format=json

# Filter by status code (pipe through grep)
npx wrangler tail sophia-ai-factory --format=pretty | grep "500"
```

**Vietnamese:** Lenh tren truc tiep xem nhat ky tu Cloudflare Worker. Khong can cau hinh — chi can chay lenh. Nhan `Ctrl+C` de dung.

---

## 3. Performance Check (perf:check)

**Kiem tra hieu suat (perf:check)**

This script validates that production SLO (Service Level Objective) targets are met. It queries D1 directly via wrangler and checks response time thresholds.

### How to Run

```bash
cd apps/sophia-ai-factory
npm run perf:check
```

**Expected output:** Exit code 0 with all SLOs passing.

### What It Checks

The script (`scripts/perf-check.ts`, 226 lines) queries D1 for the last 30 days of performance data and validates:

| SLO | Target | Measurement |
|---|---|---|
| API p95 latency | < 500ms | D1 performance_events table |
| Error rate | < 1% | D1 error events |
| Uptime | > 99.9% | Health check response history |

### If perf:check Fails

1. Note which SLO failed
2. Check Sentry for the specific error or slow route
3. Run `npx wrangler tail` to see live traffic
4. If the issue is deploy-related → rollback
5. If the issue is external (e.g., OpenRouter slow) → circuit breaker should handle; monitor

---

## 4. D1 Query Patterns

**Mau truy van D1**

You can query the D1 database directly using wrangler. This is useful for debugging specific issues.

### Common Diagnostic Queries

```bash
# Recent payment events (last 10)
npx wrangler d1 execute sophia-raas-db --remote \
  --command "SELECT id, event_id, payment_status, created_at FROM payment_events ORDER BY created_at DESC LIMIT 10"

# Active subscribers count
npx wrangler d1 execute sophia-raas-db --remote \
  --command "SELECT tier, COUNT(*) as count FROM users WHERE subscription_status = 'active' GROUP BY tier"

# Recent errors in audit log
npx wrangler d1 execute sophia-raas-db --remote \
  --command "SELECT action, details, created_at FROM audit_logs WHERE action LIKE '%error%' ORDER BY created_at DESC LIMIT 10"

# Video processing jobs status
npx wrangler d1 execute sophia-raas-db --remote \
  --command "SELECT status, COUNT(*) as count FROM video_jobs GROUP BY status"

# Creative missions by status
npx wrangler d1 execute sophia-raas-db --remote \
  --command "SELECT status, COUNT(*) as count FROM creative_missions GROUP BY status"
```

### Important Notes About D1

- **D1 is SQLite** — all queries are SQL syntax
- **No transactions** — use atomic locks (`INSERT ... ON CONFLICT DO NOTHING`) for financial data
- **Synchronous** — the app uses `createServerClient()` (no await); wrangler CLI is separate
- **Never delete production data** without a backup first

**Vietnamese:** D1 la SQLite — tat ca truy van dung cu phap SQL. Khong co giao dich — dung khoa nguyen tang cho du lieu tai chinh. KHONG XOA du lieu production ma khong sao luu truoc.

---

## 5. Circuit Breaker Monitoring

**Giam sat nguon dien tu dong**

The circuit breaker (`src/seed/security/circuit-breaker.ts`) protects against cascading failures from external APIs (OpenRouter, ElevenLabs, D-ID, HeyGen, NOWPayments, etc.).

### How to Check Circuit Breaker State

```bash
npx wrangler tail sophia-ai-factory --format=pretty | grep "circuit_breaker"
```

| Log Message | Meaning | Action |
|---|---|---|
| `circuit_breaker_open: telegram` | Telegram API calls blocked | Check if Telegram is having an outage; circuit will auto-recover |
| `circuit_breaker_open: openrouter` | OpenRouter API calls blocked | Check OpenRouter status; customers can use other providers |
| `recordFailure: AUTH_FAILURE` | API key rejected | Customer needs to update their API key in Setup Wizard |
| `recordSuccess` after open | Circuit recovering | Normal auto-recovery; no action needed |

### Circuit Breaker States

| State | Behavior | What It Means |
|---|---|---|
| **CLOSED** | All requests allowed | Normal operation |
| **OPEN** | All requests blocked | Too many failures; circuit is protecting the system |
| **HALF_OPEN** | One probe request allowed | Testing if the external service has recovered |

---

## 6. Alert Reference

**Tham chieu canh bao**

| Alert | Severity | Where to Look | Response |
|---|---|---|---|
| Sentry: New fatal error | P0 | Sentry Issues tab | Rollback, investigate |
| Sentry: Error spike >10/min | P1 | Sentry Issues tab | Investigate, may need rollback |
| wrangler tail: 500 errors | P0/P1 | Live logs | Check Sentry for root cause |
| perf:check fails | P1 | Script output | Check specific SLO violation |
| Circuit breaker open | P1 | Live logs | Check external service status |
| Payment webhook missing | P0 | Admin billing summary | Check NOWPayments dashboard |
| D1 connection error | P0 | Live logs + Cloudflare status | Check if Cloudflare is down |
