# CEO KPI Dashboard — Reference Doc

**Version**: 1.0 | **Date**: 2026-06-12
**Source**: Auto-generated weekly email + on-demand via `/dashboard/ceo`

---

## 5 KPIs (the only numbers CEO needs)

### 1. Revenue Impact 💰

**Definition**: Total revenue attributed to content published via Sophia in the period.

**Formula**:
```
Σ (conversion_value × attribution_weight)
where attribution_weight = 1.0 for direct link, 0.4 for assisted
```

**Measurement**:
- UTM-tagged links in published content
- Conversion pixel on customer's site
- Multi-touch attribution model (linear default)

**Targets**:
- Week 1-2: $0 (still in setup)
- Week 3-4: $1K-5K (first content live)
- Week 5-12: trending up, $5K-50K/week at scale

**Data source**: `attribution_events` table + customer CRM webhook

**Display**:
```
Revenue impact: $47,300
Trend: ↑ 12% vs last week
Sparkline: ▁▂▃▅▇█▇▅
```

---

### 2. Active Users 👥

**Definition**: Unique team members who logged in + created ≥1 content in the period.

**Formula**:
```
COUNT(DISTINCT user_id WHERE 
  last_login >= period_start 
  AND content_created_count >= 1)
```

**Targets**:
- Adoption rate (active / licensed seats): ≥70% by week 4
- Power users (≥10 content/week): ≥20% of active
- Dormant users (no login 14+ days): ≤10%

**Data source**: `user_activity` materialized view (refreshed hourly)

**Display**:
```
Active users: 23/28 (82%)
Power users: 7 (25% of active)
Dormant: 2 (7%)
```

---

### 3. Uptime ⏱️

**Definition**: Percentage of HTTP requests returning 2xx/3xx in the period.

**Formula**:
```
(successful_requests / total_requests) × 100
```

**Measurement**:
- Edge request logs (Cloudflare)
- Synthesized: 5 health-check endpoints every 60s
- Excludes: planned maintenance (announced 7 days ahead)

**Targets**:
- SLA: 99.9% (8.7 hours downtime/year allowed)
- Top quartile target: 99.95%
- Stretch: 99.99%

**Data source**: Cloudflare Workers Analytics + custom uptime monitor

**Display**:
```
Uptime: 99.94%
SLA: 99.9% (target met)
Incidents: 1 P2 (47min downtime)
MTBF: 14 days
```

---

### 4. Support Response Time 🎧

**Definition**: Median time to first human response by severity.

**Formula**:
```
MEDIAN(first_response_at - ticket_created_at) GROUP BY severity
```

**Targets**:
| Severity | Definition | Target |
|----------|------------|--------|
| P0 | Service down, all users | 15 min |
| P1 | Critical feature broken | 2 hours |
| P2 | Non-critical bug | 24 hours |
| P3 | Question / how-to | 48 hours |

**Data source**: Support ticket system (Intercom or Zendesk)

**Display**:
```
Support response:
  P0: 8min (target: 15min) ✅
  P1: 1.2hr (target: 2hr) ✅
  P2: 18hr (target: 24hr) ✅
  P3: 36hr (target: 48hr) ✅

Open tickets: 4 (1 P1, 3 P3)
CSAT: 4.6/5 (last 30 days)
```

---

### 5. Client Retention 📈

**Definition**: For agencies using Sophia to serve their end-clients: % of agency clients still active at period end.

**Formula**:
```
(clients_at_period_end / clients_at_period_start) × 100
```

**For SaaS-to-SaaS** (if Sophia is your direct customer): your retention of Sophia itself.

**Targets**:
- Monthly logo churn: <3% (good), <1% (excellent)
- Annual NRR: >100% (good), >120% (excellent)
- Pilot-to-paid conversion: >70%

**Data source**: `client_grants` table + customer's CRM

**Display**:
```
Client retention: 96%
Trend: stable
Churned this month: 1 (voluntary, low usage)
NRR: 108% (last 12 months)
```

---

## Dashboard Layout

```
┌─────────────────────────────────────────────────────────┐
│  SOPHIA — CEO Dashboard                  [period: W12]  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  💰 Revenue        👥 Active Users                      │
│  $47,300           23/28 (82%)                          │
│  ↑ 12%             ↑ 3 this week                        │
│                                                         │
│  ⏱️ Uptime          🎧 Support                          │
│  99.94%            P0: 8m ✅                            │
│  1 P2 incident     P1: 1.2h ✅                          │
│                                                         │
│  📈 Retention                                            │
│  96% monthly       NRR: 108%                            │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  📊 Trend (last 12 weeks)                               │
│  Revenue: ▁▂▃▅▇█▇▅▆▇█                                  │
│  Users:   ▂▂▃▃▄▄▅▅▆▆▇                                  │
│  Uptime:  ████████████████████████████████████          │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  🎯 QBR Action Items                                     │
│  • [ ] Review enterprise tier upgrade (Q3 decision)     │
│  • [ ] Approve new integration (HubSpot sync)           │
│  • [ ] Sign off on expansion pilot (1-month extension)  │
└─────────────────────────────────────────────────────────┘
```

---

## Refresh Cadence

| Component | Refresh |
|-----------|---------|
| Revenue impact | Daily 6am UTC |
| Active users | Hourly |
| Uptime | Real-time (5-min rolling avg) |
| Support response | Real-time |
| Client retention | Daily |
| Trends | Daily |
| QBR items | Manual update |

---

## Access

- **Email**: Auto-sent every Friday 9am UTC to CEO + delegates
- **Web**: https://sophia.agencyos.network/dashboard/ceo (auth required)
- **API**: `GET /api/dashboards/ceo?period=week-12` (JSON, for BI integration)
- **PDF export**: button on dashboard, useful for board reporting

---

## Privacy & Permissions

- CEO dashboard shows **aggregate metrics only**, no individual user activity
- Drill-down (per-user) requires ops lead role + audit log entry
- Customer may opt out of specific KPI tracking (e.g., revenue) but loses that signal

---

## Source Data

- `attribution_events` — Revenue tracking
- `user_activity` materialized view — Active users
- Cloudflare Workers Analytics — Uptime
- Intercom/Zendesk API — Support tickets
- `client_grants` — Client retention

**Audit**: All KPI data points are write-once to `kpi_snapshots` table for historical accuracy and dispute resolution.

---

**Last reviewed**: 2026-06-12
**Next review**: Quarterly or after first customer pilot
