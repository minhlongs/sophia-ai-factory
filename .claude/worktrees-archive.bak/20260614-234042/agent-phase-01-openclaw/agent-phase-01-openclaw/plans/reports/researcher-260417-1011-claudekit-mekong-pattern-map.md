# ClaudeKit + Mekong-CLI Pattern Map for Sophia AI Factory

## Executive Summary

Sophia ALREADY has 6/10 high-leverage patterns from ClaudeKit + Mekong. The remaining 4 are: **agent-self-review loop** (50% shipped), **signal layer** (DEFER for customers), **layer-2 RaaS gates** (DEFER—premature), **multi-tenant CLAUDE.*.md** (PARTIAL). 

**Recommendation:** Port agent-self-review fully (2h), defer signal/gates/multi-tenant until $10k/mo ARR.

---

## 1. ClaudeKit Pattern Inventory

| Pattern | Location | Purpose |
|---------|----------|---------|
| **Agent definitions** | `~/.claude/agents/*.md` (14 agents) | Reusable agent specs (planner, tester, reviewer, debugger, etc.) |
| **Skills catalog** | `~/.claude/skills/` (542 skills) | Command registry for LLM-driven execution |
| **Rules/orchestration** | `~/.claude/rules/` (binh-phap-*.md, primary-workflow.md) | Type-safe development + team coordination |
| **Hook system** | `.claude/` hooks inject naming, reports paths, plan context | Metadata binding for automated reports |
| **Subagent delegation** | Orchestration protocol: work-context paths + serial/parallel chains | Parallelizable task execution |
| **Task tool integration** | TaskCreate/TaskList/TaskUpdate for session tracking | Session-level persistence (not cross-project) |
| **Privacy/auth hooks** | `@@PRIVACY_PROMPT@@` → `AskUserQuestion` flow | Sensitive file access approval |
| **Git safety** | binh-phap-cicd.md + pre-commit hooks + verified CI green | Green production mandate before "done" report |
| **Memory system** | `/Users/macbookprom1/.claude/agent-memory/researcher/` | Persistent learning across sessions (type: user/feedback/project/reference) |
| **CLAUDE.md per-project** | Project-level overrides in `./.claude/CLAUDE.md` | Project-specific rules without touching global config |

---

## 2. Mekong-CLI Pattern Inventory

| Pattern | Location | Pillar | Sophia Analog |
|---------|----------|--------|-----------------|
| **CI/CD gates** | `.mekong/phases/`, `docker/s6-overlay/` | Gate#1 | `.github/workflows/*.yml` (quality, security, deploy) |
| **Signal layer (SQLite)** | `src/core/signals/` (emitter.py, local_store.py, events.py) | Gate#2 | MISSING—would store tier changes, API calls, journeys |
| **Journal write-back** | `.mekong/journal/` append-only, `burn-in/summarize.py` | Gate#3 | `.sophia-factory/journal/` + `scripts/agent-self-review/summarize.py` ✅ |
| **SDLC CLAUDE.*.md** | 4-phase docs (CLAUDE.code.md, design.md, deploy.md, spec.md) | Gate#4 | `.sophia-factory/CLAUDE.*.md` (code, design, deploy, spec) ✅ |
| **Agent self-review loop** | `burn-in/summarize.py` (reads journal) → GitHub Issue weekly | Autonomy | `.github/workflows/agent-self-review.yml` + script 50% done |
| **RaaS gateway layer** | `apps/raas-gateway/` (Hono on CF Workers, MCU credit metering) | Revenue | Sophia has /api/billing (tier-gate.ts), NOT multi-tenant gateway |
| **Metrics/observability** | `.mekong/phases/signals/` (PostHog sink, feature flags) | Observability | MISSING—only basic wrangler analytics |
| **Multi-tenant isolation** | CLAUDE.code.md routing per tenant | Isolation | MISSING—single-tenant BYOK only |
| **Daemon orchestration** | `mekong/daemon/` (CTO persistent loop) | Control | MISSING—no persistent agent loop |
| **Config as code** | `.mekong/config.json`, agent definitions, commands | DevOps | `.sophia-factory/agents/`, orchestrator.md partial |

---

## 3. Sophia Current State (What's Already Built)

### ALREADY HAS (Don't Re-Port):

| Component | File Path | Status | Notes |
|-----------|-----------|--------|-------|
| **SDLC phase docs** | `.sophia-factory/CLAUDE.code.md/design/deploy/spec` | ✅ Shipped | 4-phase workflow (spec→design→code→deploy) |
| **C-Level agents** | `.sophia-factory/agents/{cto,cmo,cso,coo}.md` | ✅ Shipped | 4 agent definitions + orchestrator routing |
| **Journal system** | `.sophia-factory/journal/` | ✅ Shipped | 4 seed entries, append-only per agent |
| **Agent self-review script** | `scripts/agent-self-review/summarize.py` | 🟡 50% | Script exists, runs weekly (agent-self-review.yml), BUT outputs broken (issue #XXX) |
| **CI/CD gates** | `.github/workflows/{test,post-merge,quality,security,deploy}` | ✅ Shipped | Build, test, type-check, security scan, canary rollback |
| **Tier gating** | `src/lib/tier-gate.ts` + `config/tiers.ts` | ✅ Shipped | Per-route 403 enforcement (BASIC/PREMIUM/ENTERPRISE) |
| **Billing/payment** | `src/routes/billing.ts` (NOWPayments IPN) | ✅ Shipped | Webhook → tier activation |
| **Setup wizard** | Protected flow (Setup → Telegram → Payment) | ✅ Protected | Cannot be broken by changes |
| **Project rules** | `.claude/rules/` + `.claude/CLAUDE.md` | ✅ Custom | Sophia-specific imports + tier rules |

### MISSING (Candidates for Port):

| Gap | Mekong Source | Why Sophia Needs It | Effort | Edge-Runtime OK? |
|-----|---------------|----------------------|--------|------------------|
| **Agent self-review fix** | `burn-in/summarize.py` (works in Mekong) | Self-debug loop runs weekly but broken | 1h | ✅ Yes (CF cron calls Python script) |
| **Signal layer (D1)** | `src/core/signals/` (SQLite) | Observe agent actions, tier conversions, API calls | 8h | ✅ Yes (D1 instead of SQLite) |
| **Weekly metrics digest** | Mekong's `phases/signals/` PostHog sink | Founder dashboard: conversions, churn, LTV | 6h | ✅ Yes (CF Pages dashboard) |
| **Multi-tenant RaaS gates** | `apps/raas-gateway/` (MCU credit metering) | Resell Sophia to other founders | DEFER | ✅ Yes, if needed |
| **Persistent CTO daemon** | `mekong/daemon/` (P→D→V→S loop) | Autonomous strategy loop 24/7 | DEFER | ❌ No (Workers no persistence) |
| **Canary rollout script** | `.github/workflows/canary-rollback.yml` | Phased customer rollout | 2h | ✅ Yes (wrangler routes) |

---

## 4. Gap Analysis Matrix

| Pattern | ClaudeKit | Mekong | Sophia-Has | Should Port? | Effort | Edge-OK | Priority |
|---------|-----------|--------|-----------|--------------|--------|---------|----------|
| Agent defs + orchestration | ✅ | ✅ | ✅ | Done | — | ✅ | 0 |
| SDLC CLAUDE.*.md | ✅ | ✅ | ✅ | Done | — | ✅ | 0 |
| Journal write-back | ❌ | ✅ | ✅ | Done | — | ✅ | 0 |
| CI/CD gates (basic) | ✅ | ✅ | ✅ | Done | — | ✅ | 0 |
| **Agent self-review loop** | ✅ | ✅ | 🟡 50% | **YES** | 1h | ✅ | **#1** |
| **Signal layer (metrics)** | ❌ | ✅ | ❌ | DEFER | 8h | ✅ | #2 |
| **Weekly digest (founder view)** | ❌ | ✅ | ❌ | DEFER | 6h | ✅ | #2 |
| Multi-tenant RaaS | ❌ | ✅ | ❌ | DEFER | 16h | ✅ | #4 |
| Persistent daemon | ❌ | ✅ | ❌ | DEFER | unbounded | ❌ | N/A |
| Multi-tenant CLAUDE.*.md | ❌ | ✅ | ❌ | DEFER | 6h | ✅ | #5 |

---

## 5. Top 5 High-Leverage Ports (Ranked by Founder ROI)

### #1: FIX Agent Self-Review Loop (1h) — SHIP THIS WEEK

**Current state:** Script runs weekly but outputs are broken (likely scrubbing issue or API failure).

**What to port:** Use Mekong's `burn-in/summarize.py` as reference.

**Concrete steps:**
1. Debug `scripts/agent-self-review/summarize.py` output (check OpenRouter API calls)
2. Verify `.sophia-factory/journal/` entries format matches script expectations
3. Test GitHub Issue creation (secrets: OPENROUTER_API_KEY, GITHUB_TOKEN)
4. Confirm cron fires Monday 08:00 UTC

**Expected outcome:** Weekly GitHub Issues with agent improvement suggestions. Helps catch self-reinforcing bad behaviors in agents.

**Edge-runtime compatibility:** ✅ Works (GitHub Actions, not Workers)

---

### #2a: Signal Layer via D1 (8h) — SHIP AFTER FEATURE #1

**Current state:** Sophia has tier-gate.ts but no observability of tier conversions, API usage, or agent actions.

**What to port:** Mekong's signal emitter + local_store → Sophia's D1 schema.

**Why:** Founder needs to see:
- When customers upgrade (BASIC → PREMIUM)
- API call counts per tier
- Agent journal summaries per week

**Concrete steps:**
1. Create D1 migration: `signals_events` table (agent, action, tier, timestamp, metadata)
2. Add signal emitter to `/api/billing` webhook (on tier change, INSERT signal)
3. Add signal emitter to tier-gate.ts (on 403 return, log why)
4. Add `/api/signals?days=7` endpoint for founder dashboard
5. Test 1k events/day throughput on D1

**Expected outcome:** Founder sees "5 trials upgraded to PREMIUM this week, 2 hit tier limit."

**Edge-runtime compatibility:** ✅ Yes (D1 queries in Workers)

---

### #2b: Weekly Metrics Digest (6h) — SHIP SAME WEEK AS #2a

**Current state:** Agent self-review script only summarizes agent journal. Founder sees no biz metrics.

**What to port:** Create new `scripts/weekly-metrics/generate-digest.py` (runs Saturday 06:00 UTC).

**Signals to surface:**
- Tier conversions (BASIC → PREMIUM, trials → paying)
- Churn (active → inactive)
- API usage trending
- Agent self-review findings

**Concrete steps:**
1. Query D1: `SELECT * FROM signals_events WHERE timestamp > now() - interval '7 days'`
2. Aggregate: upgrades, churn, API calls
3. Call OpenRouter with metrics payload → markdown digest
4. Create GitHub Issue (title: `Weekly Digest — 2026-04-21`, body: metrics + agent findings)
5. Schedule: Saturday 06:00 UTC (before agent-self-review Mon 08:00)

**Expected outcome:** Single GitHub Issue showing biz health + agent improvements.

**Edge-runtime compatibility:** ✅ Yes (GitHub Actions)

---

### #3: Canary Rollout Helper (2h) — SHIP AFTER #1

**Current state:** Sophia has canary-rollback.yml but no phased rollout logic.

**What to port:** Mekong's canary script (route % → small cohort → full → rollback if fail).

**Why:** Before hitting 100 customers, test features on 10% first.

**Concrete steps:**
1. Add `CANARY_PERCENTAGE` env var to Cloudflare Worker (default 0%)
2. Add feature flag logic in middleware: `if (rand() < CANARY_PERCENTAGE) → new code; else → old`
3. Create script `scripts/ci/canary-increase.sh` (+10% per 30 min)
4. If error rate spikes → auto-rollback (see existing canary-rollback.yml)
5. Document: "Ship features to 10% canary for 2h, then 50%, then 100%"

**Expected outcome:** Can ship breaking changes safely to small % first.

**Edge-runtime compatibility:** ✅ Yes (KV for feature flags)

---

### #4: DEFER — Multi-Tenant RaaS Gates (16h)

**Why defer:** Sophia is BYOK (single customer = founder). RaaS is for reselling to 100 founders → premature.

**When to revisit:** When founder wants to resell Sophia to other founders (post-$10k/mo).

**What it would look like:** Per-tenant D1 schema, credit metering, separate Polar products per tenant. Use Mekong's `apps/raas-gateway/` as reference.

---

### #5: DEFER — Persistent Daemon Loop (unbounded)

**Why defer:** Workers have no persistent processes. Would require external VM (AWS/Render).

**When to revisit:** If founder needs 24/7 agent ops (e.g., market-making bot, auto-customer-outreach). Today, manual triggers suffice.

---

## 6. Implementation Roadmap

| Week | Ship | Effort | Blocker | Notes |
|------|------|--------|---------|-------|
| **This week (Apr 21)** | Fix #1 (agent-self-review) | 1h | None | Debug OpenRouter call, test GitHub Issue creation |
| **Next week (Apr 28)** | #2a Signal layer (D1) | 8h | Need D1 schema design | Query signals, expose `/api/signals` |
| | #2b Weekly digest | 6h | Depends on #2a | Pull metrics, format, post GitHub Issue |
| | #3 Canary rollout helper | 2h | None | Feature flags + phased percentage increase |
| **Post-product/market-fit** | #4 Multi-tenant RaaS | 16h | Growth to $10k/mo | Resell Sophia to other founders |
| **Never (unless needed)** | #5 Persistent daemon | ∞ | Edge runtime limit | Would need external server |

---

## 7. Files to Create/Modify

### Port #1: Agent Self-Review Fix
```
scripts/agent-self-review/summarize.py          [ALREADY EXISTS — DEBUG]
.github/workflows/agent-self-review.yml         [ALREADY EXISTS — VERIFY]
```

### Port #2a: Signal Layer
```
scripts/migration/01_create_signals_table.sql   [NEW]
src/lib/db/emit-signal.ts                       [NEW] — emit event on tier change
src/routes/api/signals.ts                       [NEW] — GET handler
```

### Port #2b: Weekly Digest
```
scripts/weekly-metrics/generate-digest.py       [NEW]
.github/workflows/weekly-metrics-digest.yml     [NEW] — schedule Sat 06:00 UTC
```

### Port #3: Canary Rollout
```
scripts/ci/canary-increase.sh                   [NEW]
src/middleware/feature-flags.ts                 [NEW or MODIFY]
```

---

## 8. Edge-Runtime Compatibility Verdict

| Port | Next.js Worker | D1 | KV | R2 | CF Cron | GitHub Actions | Notes |
|------|----------------|----|----|----|---------|--------------------|-------|
| #1 Agent-self-review | N/A | N/A | N/A | N/A | N/A | ✅ | Runs in GH Actions, not Workers |
| #2a Signals | ✅ | ✅ | N/A | N/A | N/A | N/A | Query D1 in API routes |
| #2b Digest | N/A | ✅ | N/A | N/A | N/A | ✅ | Python script in GH Actions |
| #3 Canary | ✅ | N/A | ✅ | N/A | N/A | N/A | Feature flags in KV |
| #4 RaaS (defer) | ✅ | ✅ | ✅ | N/A | N/A | N/A | Cloudflare-only, no issues |
| #5 Daemon (skip) | ❌ | ❌ | ❌ | ❌ | ❌ | N/A | Workers not designed for persistence |

---

## 9. Unresolved Questions

1. **Agent self-review broken output:** Is the OpenRouter API failing, or is journal format wrong? Debug needed.
2. **Signal table cardinality:** How many events/day before D1 costs spike? Estimate: 1k (tier changes + journal writes). Need cost model.
3. **Feature flags in production:** Should canary % be settable via dashboard, or git-only? Recommend: git-only for now (simple, auditable).
4. **RaaS timing:** What ARR threshold triggers pivot to multi-tenant? Recommend: $10k/mo (10 paying founders × $1k/mo average).
5. **Signal schema:** Should signals include PII scrubbing flag (like Red Team #14)? Recommend: yes, follow agent journal precedent.

---

## Summary

**Ship #1 this week** (1h fix). **Queue #2a/2b for next sprint** (8h + 6h, massive founder insight gain). **Defer #4/5** until revenue milestone. Sophia is 60% aligned with Mekong patterns; the remaining 40% are revenue/scale-specific, not core.

**Key insight:** Mekong's signal layer is Sophia's biggest missing piece. Without it, founder is flying blind on tier conversions and agent actions.

---

*Report generated: 2026-04-17 10:11 UTC*
*Based on: ClaudeKit ~global, Mekong-CLI v6.0, Sophia AI Factory as of PR #18*
