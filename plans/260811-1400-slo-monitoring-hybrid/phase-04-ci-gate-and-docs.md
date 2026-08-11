---
title: "Phase 04 — CI Gate and Documentation"
description: "Add perf:check script for CI gate and create SLO runbooks/documentation"
status: pending
priority: P1
effort: 1.5h
branch: feat/slo-monitoring-hybrid
depends_on: ["phase-03-alert-rules-and-cron.md"]
---

# Phase 04 — CI Gate and Documentation

## Context Links
- Plan: `../plan.md`
- Phase 03: `./phase-03-alert-rules-and-cron.md`
- Package.json scripts: `package.json` (lines 6-35)
- CI gate: `.github/workflows/test.yml.disabled` (reference)
- Deploy verify: `.claude/rules/sophia-deploy-verify.md`

## Requirements

### Functional
- [ ] Create `perf:check` script that validates SLO targets against last 30 days
- [ ] Script reads from `slo_burn` table (D1) or WAE directly
- [ ] Exit code 0 if all SLOs met, 1 if any violated
- [ ] Add to `package.json` scripts
- [ ] Create runbook documentation for SLO incidents
- [ ] Update deployment verification to include SLO check

### Non-Functional
- [ ] Script completes in < 30 seconds
- [ ] Works in CI (GitHub Actions) and local
- [ ] Clear output showing pass/fail per SLO
- [ ] Bilingual documentation (Vietnamese + English)

## Files to Modify/Create

| Action | File | Layer | Notes |
|--------|------|-------|-------|
| Modify | `package.json` | config | Add `perf:check` script |
| Create | `scripts/perf-check.ts` | scripts | Main perf check implementation |
| Create | `docs/runbooks/slo-burn-rate.md` | docs | Incident runbook |
| Create | `docs/runbooks/slo-incident-response.md` | docs | Escalation procedures |
| Modify | `docs/slo-targets.md` | docs | Add dashboard links |
| Modify | `.claude/rules/sophia-deploy-verify.md` | config | Add SLO verification step |

## Perf Check Script (`scripts/perf-check.ts`)

```typescript
#!/usr/bin/env node
/**
 * SLO Performance Check — CI Gate
 * Validates that all SLO targets are met for the last 30 days.
 * Reads from D1 slo_burn table (populated by monthly cron).
 * 
 * Usage: npm run perf:check
 * Exit codes: 0 = all SLOs met, 1 = violation detected, 2 = error
 */

import { createServerClient } from '@/seed/db/client';
import { getCurrentMonthBurnRate, getBurnRateHistory } from '@/seed/db/slo-burn-ops';

interface SLOCheckResult {
  sloName: string;
  target: number;
  measured: number;
  burnRate: number;
  alertLevel: string | null;
  passed: boolean;
  operator: 'gte' | 'lte';
}

const SLO_TARGETS = [
  { name: 'availability', target: 0.995, operator: 'gte' as const },
  { name: 'api_latency_p95', target: 800, operator: 'lte' as const },
  { name: 'health_latency_p95', target: 500, operator: 'lte' as const },
  { name: 'webhook_delivery_p95', target: 300_000, operator: 'lte' as const },
  { name: 'error_rate', target: 0.01, operator: 'lte' as const },
] as const;

function checkSLO(measured: number, target: number, operator: 'gte' | 'lte'): boolean {
  return operator === 'gte' ? measured >= target : measured <= target;
}

function formatValue(name: string, value: number): string {
  if (name.includes('latency') || name.includes('delivery')) {
    return `${value.toFixed(0)}ms`;
  }
  if (name === 'availability') {
    return `${(value * 100).toFixed(2)}%`;
  }
  if (name === 'error_rate') {
    return `${(value * 100).toFixed(2)}%`;
  }
  return value.toFixed(4);
}

async function main(): Promise<number> {
  console.log('🔍 SLO Performance Check — Last 30 Days');
  console.log('==========================================\n');
  
  const db = createServerClient();
  
  // Get current month data (most recent completed month)
  const currentMonth = getCurrentMonthBurnRate(db);
  
  if (currentMonth.length === 0) {
    console.warn('⚠️  No SLO data found in slo_burn table');
    console.log('   Run the monthly cron job first: /api/cron/slo-burn-rate');
    console.log('   Or wait for the next scheduled run (1st of month 00:00 UTC)');
    return 2; // Error - no data
  }
  
  const results: SLOCheckResult[] = [];
  let allPassed = true;
  
  for (const target of SLO_TARGETS) {
    const data = currentMonth.find(d => d.slo_name === target.name);
    
    if (!data) {
      console.warn(`⚠️  ${target.name}: No data available`);
      results.push({
        sloName: target.name,
        target: target.target,
        measured: 0,
        burnRate: 0,
        alertLevel: 'unknown',
        passed: false,
        operator: target.operator,
      });
      allPassed = false;
      continue;
    }
    
    const passed = checkSLO(data.measured_value, target.target, target.operator);
    allPassed = allPassed && passed;
    
    const status = passed ? '✅' : '❌';
    const targetStr = formatValue(target.name, target.target);
    const measuredStr = formatValue(target.name, data.measured_value);
    const burnStr = `${data.burn_rate.toFixed(1)}%`;
    
    console.log(`${status} ${target.name}`);
    console.log(`   Target: ${targetStr} (${target.operator === 'gte' ? '≥' : '≤'})`);
    console.log(`   Measured: ${measuredStr}`);
    console.log(`   Burn Rate: ${burnStr}`);
    console.log(`   Alert Level: ${data.alert_level ?? 'none'}`);
    console.log('');
    
    results.push({
      sloName: target.name,
      target: target.target,
      measured: data.measured_value,
      burnRate: data.burn_rate,
      alertLevel: data.alert_level,
      passed,
      operator: target.operator,
    });
  }
  
  // Summary
  console.log('==========================================');
  const passedCount = results.filter(r => r.passed).length;
  console.log(`Summary: ${passedCount}/${results.length} SLOs met`);
  
  if (allPassed) {
    console.log('🎉 All SLO targets met!');
    return 0;
  }
  
  // Show violations
  console.log('\n❌ VIOLATIONS:');
  for (const r of results.filter(r => !r.passed)) {
    const direction = r.operator === 'gte' ? 'below' : 'above';
    console.log(`   - ${r.sloName}: measured ${formatValue(r.sloName, r.measured)} is ${direction} target ${formatValue(r.sloName, r.target)} (burn rate: ${r.burnRate.toFixed(1)}%)`);
  }
  
  console.log('\n📋 Next Steps:');
  console.log('   1. Check Sentry alerts for recent incidents');
  console.log('   2. Review Workers Analytics Engine dashboards');
  console.log('   3. Run incident response: docs/runbooks/slo-incident-response.md');
  console.log('   4. If false positive, investigate data collection');
  
  return 1;
}

// Run
main()
  .then(code => process.exit(code))
  .catch(err => {
    console.error('💥 Perf check failed:', err);
    process.exit(2);
  });
```

## Package.json Script Addition

Add to `package.json` scripts section:

```json
{
  "scripts": {
    "perf:check": "tsx scripts/perf-check.ts",
    "perf:check:ci": "npm run perf:check",
    ...
  }
}
```

Also add `tsx` to devDependencies if not present:

```bash
npm add -D tsx
```

## SLO Burn Rate Runbook (`docs/runbooks/slo-burn-rate.md`)

```markdown
# Runbook: SLO Burn Rate Alert

**Alert:** Sentry metric alert fired for SLO burn rate
**Severity:** Warning / Critical / Emergency (based on burn rate %)
**Owner:** Platform On-Call

## Symptoms

- Sentry alert: "SLO: Error Rate > 1%" or similar
- Telegram notification in #oncall channel
- `slo_burn` table shows `alert_level` = warning/critical/emergency

## Diagnosis Steps

### 1. Check Current Burn Rate (30s)
```bash
# Quick check via API
curl -H "Authorization: Bearer $CRON_SECRET" https://sophia.agencyos.network/api/cron/slo-burn-rate

# Or query D1 directly
npx wrangler d1 execute sophia-raas-db --command="SELECT * FROM v_slo_current_month" --remote
```

### 2. Identify Affected SLO (1min)
| SLO | Dashboard | Typical Causes |
|-----|-----------|----------------|
| `availability` | Workers Analytics > Requests | Worker crashes, D1 errors, upstream outages |
| `api_latency_p95` | Workers Analytics > Duration | Cold starts, DB contention, slow AI APIs |
| `health_latency_p95` | Workers Analytics > /api/health | Worker runtime issues, memory pressure |
| `webhook_delivery_p95` | Workers Analytics > /api/webhooks/* | Payment provider delays, queue backlog |
| `error_rate` | Sentry > Issues | New bugs, dependency failures, config errors |

### 3. Check Recent Deployments (2min)
```bash
# Last 5 deploys
curl -s https://sophia.agencyos.network/api/version
git log --oneline -5
```
- Correlate alert time with deploy time
- If recent deploy: consider rollback (`npx wrangler rollback`)

### 4. Check Worker Health (2min)
```bash
# Live logs
npx wrangler tail --format=pretty

# Health endpoint
curl https://sophia.agencyos.network/api/health
```

## Resolution Actions

### Availability < 99.5%
1. Check Sentry for spike in 5xx errors
2. Check D1 error rate: `npx wrangler d1 execute sophia-raas-db --command="SELECT * FROM query_errors ORDER BY created_at DESC LIMIT 10" --remote`
3. If D1 issues: check Cloudflare D1 status page
4. If Worker crashes: check `wrangler tail` for OOM/CPU limits

### API Latency p95 > 800ms
1. Check cold start rate in Workers Analytics
2. Check AI API latency (OpenRouter, ElevenLabs) — they dominate p95
3. Consider: increase `min_instances` in wrangler.toml (cost trade-off)
4. Check for D1 query contention (long-running queries)

### Webhook Delivery > 5min
1. Check specific webhook queue: NOWPayments, ClickBank, Telegram
2. Verify webhook handler not blocked (check Inngest function status)
3. Check payment provider status pages
4. If queue backlog: manually trigger retry via `/api/cron/dlq-retry`

## Escalation

| Burn Rate | Time to Acknowledge | Time to Resolve | Escalate To |
|-----------|---------------------|-----------------|-------------|
| 2-5% (Warning) | 30 min | 4 hours | Platform Lead |
| 5-10% (Critical) | 15 min | 2 hours | Platform Lead + CTO |
| >10% (Emergency) | 5 min | 1 hour | All Hands + Leadership |

## Post-Incident

1. Document in incident log: `docs/incidents/YYYY-MM-DD-slo-<name>.md`
2. Run `npm run perf:check` to verify recovery
3. Update SLO targets if needed (quarterly review)
4. Share learnings in team retrospective

## Việt Nam (Tiếng Việt)

### Triệu chứng
- Cảnh báo Sentry: "SLO: Tỷ lệ lỗi > 1%" hoặc tương tự
- Thông báo Telegram trong kênh #oncall
- Bảng `slo_burn` hiển thị `alert_level` = warning/critical/emergency

### Các bước chẩn đoán
1. Kiểm tra tỷ lệ burn rate hiện tại (30 giây)
2. Xác định SLO bị ảnh hưởng (1 phút)
3. Kiểm tra các lần triển khai gần đây (2 phút)
4. Kiểm tra sức khỏe Worker (2 phút)

### Hành động khắc phục
Xem bảng Resolution Actions ở trên.

### Thang leo cấp
| Tỷ lệ burn | Thời gian xác nhận | Thời gian giải quyết | Báo cáo cho |
|------------|-------------------|---------------------|-------------|
| 2-5% (Cảnh báo) | 30 phút | 4 giờ | Trưởng Platform |
| 5-10% (Nghiêm trọng) | 15 phút | 2 giờ | Trưởng Platform + CTO |
| >10% (Khẩn cấp) | 5 phút | 1 giờ | Toàn bộ team + Leadership |

### Sau sự cố
1. Ghi lại trong nhật ký sự cố
2. Chạy `npm run perf:check` để xác minh khôi phục
3. Cập nhật mục tiêu SLO nếu cần (xem xét hàng quý)
4. Chia sẻ bài học trong buổi retrospective
```

## SLO Incident Response Runbook (`docs/runbooks/slo-incident-response.md`)

```markdown
# Runbook: SLO Incident Response Procedure

**Scope:** All SLO violations requiring coordinated response
**Audience:** Platform Engineers, On-Call, Leadership
**Last Updated:** 2026-08-11

## Incident Command Structure

```
Incident Commander (IC)     → Platform Lead / On-Call Primary
Communications Lead         → Platform Engineer (rotating)
Technical Lead              → Senior Engineer (domain expert)
Stakeholder Liaison         → Product / Leadership (if customer-facing)
```

## Phase 1: Detection & Triage (0-15 min)

### Automatic Detection
- Sentry metric alerts → Telegram #oncall
- Better Stack uptime alerts → Telegram #oncall
- Monthly cron burn-rate → `slo_burn` table + alert

### Manual Detection
- Customer reports via support
- `npm run perf:check` fails in CI
- Dashboard anomaly (Grafana/Sentry)

### Triage Checklist
- [ ] Acknowledge alert in Telegram (react with 👀)
- [ ] Identify affected SLO(s) from alert
- [ ] Check `slo_burn` table for current burn rate
- [ ] Determine severity: Warning / Critical / Emergency
- [ ] Assign IC if not self

## Phase 2: Investigation (15-60 min)

### Data Sources (in priority order)
1. **Sentry Issues** — New errors, regressions, error rate trends
2. **Workers Analytics Engine** — Request volume, latency percentiles, error rates by route
3. **Wrangler Tail** — Live logs, cold starts, OOM kills
4. **D1 Query Logs** — Slow queries, lock contention, errors
5. **Cloudflare Status** — D1, Workers, R2, KV incidents
6. **Upstream Status** — OpenRouter, ElevenLabs, D-ID, HeyGen, NOWPayments

### Investigation Commands
```bash
# Sentry: recent errors for route
# (use Sentry UI: Discover > Events > filter by route, last 1h)

# Workers Analytics: latency by route
# (use CF Dashboard: Workers > Analytics Engine > sophia_slo_metrics)

# Live logs
npx wrangler tail --format=pretty --status=error

# D1 slow queries
npx wrangler d1 execute sophia-raas-db --command="SELECT * FROM query_log WHERE duration_ms > 1000 ORDER BY created_at DESC LIMIT 20" --remote

# Deploy correlation
git log --oneline --since="2 hours ago"
```

### Common Root Causes
| SLO | Top 3 Causes |
|-----|--------------|
| Availability | 1. D1 outage 2. Worker crash (OOM) 3. Upstream AI API down |
| API Latency | 1. Cold starts 2. Slow AI API 3. D1 contention |
| Health Latency | 1. Worker runtime issue 2. Memory pressure 3. CPU throttle |
| Webhook Delivery | 1. Payment provider delay 2. Inngest queue backlog 3. Handler timeout |
| Error Rate | 1. New deploy regression 2. Config error 3. Dependency version mismatch |

## Phase 3: Mitigation (30 min - 4 hours)

### Immediate Mitigations (choose based on root cause)

#### Rollback Deploy
```bash
# If deploy < 2h ago and correlates with alert
npx wrangler rollback --name sophia-ai-factory --message "Rollback: SLO violation after deploy <sha>" --yes
```

#### Scale Workers (cost: ~$5/mo per min_instance)
```toml
# wrangler.toml - add to main env
[env.min_instances]
value = "3"
```
Then `npm run deploy:full`

#### Circuit Breaker / Degrade Gracefully
- Feature flag: disable non-critical AI features
- Increase timeouts for webhook handlers
- Return cached responses for read-heavy routes

#### Database
- Check for missing indexes on hot queries
- Kill long-running D1 transactions (not directly possible — wait for timeout)
- Reduce query complexity

### Communication
- Update #oncall every 15 min during active incident
- Post to #incidents channel with: SLO affected, severity, suspected cause, ETA
- If customer-facing: Stakeholder Liaison updates status page / support

## Phase 4: Resolution & Recovery

### Verification
```bash
# Run perf check
npm run perf:check

# Wait for next cron cycle (or trigger manually)
curl -H "Authorization: Bearer $CRON_SECRET" https://sophia.agencyos.network/api/cron/slo-burn-rate

# Verify SLOs met
curl -H "Authorization: Bearer $CRON_SECRET" https://sophia.agencyos.network/api/cron/slo-burn-rate | jq '.results[] | select(.status=="ok")'
```

### Resolution Criteria
- [ ] `npm run perf:check` exits 0
- [ ] Sentry alerts resolved (no firing for 15 min)
- [ ] Burn rate < 2% for affected SLO
- [ ] No customer impact for 30 min

## Phase 5: Post-Incident (within 48 hours)

### Incident Report Template
```markdown
# Incident: SLO <name> Violation - YYYY-MM-DD

**Duration:** Xh Ym (from alert to resolution)
**Severity:** Warning / Critical / Emergency
**SLO Affected:** <name>
**Burn Rate Peak:** XX%
**Root Cause:** <one sentence>
**Customer Impact:** <number of users affected, revenue impact>

## Timeline
- HH:MM - Alert fired
- HH:MM - IC assigned
- HH:MM - Root cause identified
- HH:MM - Mitigation deployed
- HH:MM - SLOs recovered
- HH:MM - Incident closed

## Root Cause Analysis
<5 Whys analysis>

## Action Items
- [ ] Fix: <specific fix> (Owner, Due Date)
- [ ] Prevent: <monitoring/alerting improvement> (Owner, Due Date)
- [ ] Process: <runbook/update> (Owner, Due Date)

## Lessons Learned
<what worked, what didn't>
```

### Việt Nam (Tiếng Việt)

## Cấu trúc chỉ huy sự cố
- **Chỉ huy sự cố (IC)** → Trưởng Platform / On-Call chính
- **Trưởng truyền thông** → Kỹ sư Platform (luân phiên)
- **Trưởng kỹ thuật** → Kỹ sư cấp cao (chuyên gia domain)
- **Liên lạc liên quan** → Product / Leadership (nếu ảnh hưởng khách hàng)

## Giai đoạn 1: Phát hiện & Triage (0-15 phút)
- Xác nhận cảnh báo trên Telegram (react 👀)
- Xác định SLO bị ảnh hưởng
- Kiểm tra bảng `slo_burn` cho burn rate hiện tại
- Xác định mức độ nghiêm trọng
- Gán IC nếu không phải bản thân

## Giai đoạn 2: Điều tra (15-60 phút)
Nguồn dữ liệu theo thứ tự ưu tiên: Sentry Issues → Workers Analytics → Wrangler Tail → D1 Query Logs → Cloudflare Status → Upstream Status

## Giai đoạn 3: Giảm thiểu (30 phút - 4 giờ)
- Rollback deploy nếu deploy < 2h và tương quan
- Scale Workers (thêm min_instances)
- Circuit breaker / degrade gracefully
- Kiểm tra database

## Giai đoạn 4: Khôi phục & Xác minh
- Chạy `npm run perf:check` → exit 0
- Cảnh báo Sentry resolved 15 phút
- Burn rate < 2%
- Không ảnh hưởng khách hàng 30 phút

## Giai đoạn 5: Sau sự cố (trong 48 giờ)
Viết báo cáo theo template, xác định root cause (5 Whys), tạo action items, chia sẻ lessons learned.
```

## Deploy Verification Update (`.claude/rules/sophia-deploy-verify.md`)

Add to mandatory verify sequence (after Step 4):

```bash
# Step 5: SLO Performance Check (NEW)
echo "🔍 Running SLO performance check..."
cd apps/sophia-ai-factory
npm run perf:check
PERF_EXIT=$?
if [ $PERF_EXIT -eq 0 ]; then
  echo "✅ All SLO targets met"
elif [ $PERF_EXIT -eq 1 ]; then
  echo "⚠️  SLO violations detected — review before considering deploy healthy"
  # Don't fail deploy for SLO violations (they reflect past month)
  # But warn loudly
else
  echo "❌ Perf check error (no data or script failure)"
fi
```

## Implementation Steps

1. **Add tsx dependency**
   ```bash
   cd /Users/macbook/sophia-ai-factory/apps/sophia-ai-factory
   npm add -D tsx
   ```

2. **Create perf-check script**
   ```bash
   mkdir -p /Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/scripts
   cat > /Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/scripts/perf-check.ts << 'EOF'
   # [content from above]
   EOF
   chmod +x /Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/scripts/perf-check.ts
   ```

3. **Update package.json**
   ```bash
   # Add to scripts section:
   # "perf:check": "tsx scripts/perf-check.ts",
   ```

4. **Create runbook docs**
   ```bash
   mkdir -p /Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/docs/runbooks
   cat > /Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/docs/runbooks/slo-burn-rate.md << 'EOF'
   # [content from above]
   EOF
   
   cat > /Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/docs/runbooks/slo-incident-response.md << 'EOF'
   # [content from above]
   EOF
   ```

5. **Update slo-targets.md with dashboard links**
   ```bash
   # Add to docs/slo-targets.md:
   ## Dashboards
   - Workers Analytics: https://dash.cloudflare.com/<account>/workers/analytics/sophia_slo_metrics
   - Sentry Metrics: https://sentry.io/organizations/sophia-ai-factory/metrics/
   - Grafana (if configured): https://grafana.sophia.agencyos.network/d/slo-burn-rate
   ```

6. **Update deploy verify rules**
   ```bash
   # Edit .claude/rules/sophia-deploy-verify.md to add Step 5
   ```

7. **Test perf check locally**
   ```bash
   cd /Users/macbook/sophia-ai-factory/apps/sophia-ai-factory
   npm run perf:check
   ```

8. **Verify type-check passes**
   ```bash
   npm run type-check
   ```

## Tests / Validation

- [ ] `npm run perf:check` runs without TypeScript errors
- [ ] Script exits 0 when SLOs met (mock data)
- [ ] Script exits 1 with clear violations when SLOs missed
- [ ] Script exits 2 with helpful message when no data
- [ ] Runbooks render correctly in docs site
- [ ] Bilingual content accurate (Vietnamese + English)
- [ ] Deploy verify updated and documented

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Perf check false positive (stale data) | Medium | Medium | Cron runs monthly; document data freshness expectations |
| Script fails in CI (no D1 access) | High | Medium | CI should have D1 binding; mock in CI if needed |
| Runbooks become outdated | Medium | Low | Link runbooks from alert descriptions; review quarterly |
| Deploy verify adds noise | Low | Low | SLO check is informational (warn only, not fail) |

## Success Criteria

- [ ] `npm run perf:check` integrated in CI (optional gate)
- [ ] Runbooks accessible and bilingual
- [ ] Team can follow runbook to resolve SLO incident in < 30 min
- [ ] Monthly burn-rate data visible in `slo_burn` table
- [ ] Sentry alerts firing correctly on thresholds

## Next Steps (Post-Implementation)

1. **Week 1-2:** Monitor alert noise, tune Sentry thresholds
2. **Month 1:** Review first monthly burn-rate report, adjust targets if needed
3. **Quarterly:** SLO target review with stakeholders
4. **Ongoing:** Add new SLOs as product evolves (e.g., video generation latency)