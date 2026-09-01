# Sophia AI Factory — Roadmap 2028

> **Version:** 1.0 · **Effective:** 2026-09-01 · **Supersedes:** `SOPHIA_2027_ROADMAP.md` (no version header — see Escrow MED-3 lineage note below)
> **Vision:** Từ nền tảng đã được xác nhận kiến trúc (architecturally validated) → hệ thống được xác nhận bằng dữ liệu thực tế (empirically validated) — hardening, vận hành phân phối, thương mại, và mở rộng quy mô.
> From an architecturally validated platform → an empirically validated system — hardening, distribution operations, commerce, and scale.

---

## Lineage / Tổ tiên

`SOPHIA_2027_ROADMAP.md` (effective 2026-08-22, **no explicit Version header** — this was Escrow MED-3 in the Sun Tzu plan-gate verdict lineage). 2028 roadmap adds the explicit `Version: 1.0` header to make lineage auditable. 2027 phases 0–10 are reclassified as **completed foundation** below; 2028 phases 1–4 are forward-looking with measurable exit criteria only.

---

## Baseline / Cơ sở

- **Production SHA:** `d7ba0c83` (2026-09-01, killer-test GREEN, escrows MED-3 + LOW-1 closed)
- **Tests:** 8679 passed / 0 failed
- **Deploy:** CF-direct, `https://sophia.agencyos.network`, SHA-verified
- **Protected flows:** Setup Wizard, Telegram Bot @Sophia_Bbot, NOWPayments IPN — zero-diff vs baseline

---

## Phase 0 — Recon + Constitution + Production Hardening (2026-09)

> Giai đoạn hiện tại / Current phase

### Muc Tieu / Objective
Nâng nền tảng từ "đã xác nhận kiến trúc" lên "đã xác nhận bằng dữ liệu thực tế" — hardening không xâm lấn, refresh hiến chương, và vận hành thực tế Reality Loop.
Raise the platform from "architecturally validated" to "empirically validated" — non-invasive hardening, constitution refresh, and Reality Loop production operations.

### Deliverables — Trạng thái đã xác minh / Verified status

> Chỉ đánh dấu những gì đã được xác minh bằng bằng chứng (build/test/grep). Không đánh dấu kỳ vọng.
> Only mark what has been verified with evidence (build/test/grep). No aspirational checkmarks.

- [x] **Reconnaissance** — `docs/architecture/REPO_RECONNAISSANCE_2026-08-17.md` + refresh `REPO_RECONNAISSANCE_2026-08-22-REFRESH.md` *(done 2026-08-17, refreshed 2026-08-22)*
- [x] **Constitution v1.1** — `docs/strategy/SOPHIA_2027_CONSTITUTION.md` *(done 2026-08-25, versioned)*
- [x] **Reality Loop v1 — 13 canonical event types** — `src/tree/performance/loop-events.ts:40-54` *(done 2026-08-29, 11 wired / 2 deferred by design: `creative.edited`, `memory.corrected`)*
- [x] **Reality Loop — 11 emitters wired to production call sites** — `land/creative-mission/actions.ts`, `forest/inngest/functions/production-graph-runner.ts`, `agent-context.ts`, `tree/mission/repository.ts` *(done 2026-08-29, verified by grep)*
- [x] **Structured human feedback (4 checkpoints)** — `land/reality-loop/feedback-store.ts` + migration `0262_reality_feedback.sql` *(done 2026-08-29, 9/9 tests, idempotent, privacy-safe)*
- [x] **Design Partner archetypes (FOUNDER / AGENCY / CREATOR)** — `src/tree/production-graph/design-partner-bundles.ts` *(done 2026-08-29, 17 tests, pure-data metadata route)*
- [x] **Economic snapshot writer** — `src/land/creative-economy/snapshot-writer.ts` + migration `0263_creative_economic_snapshot.sql` *(done 2026-08-29, NULL-propagating, no fabricated ROI)*
- [x] **12-class autonomy failure taxonomy** — `src/tree/performance/loop-events.ts` `classifyAutonomyFailure()` + `docs/reality-loop/AUTONOMY_FAILURE_TAXONOMY.md` *(done 2026-08-29)*
- [x] **Creative Memory validation suite** — `src/tree/creative-memory/__tests__/reality-loop-validation.test.ts` *(done 2026-08-29, 8/8 tests)*
- [x] **3 deterministic reality missions** — `src/forest/inngest/functions/__tests__/reality-loop-missions.test.ts` *(done 2026-08-29)*
- [x] **Internal product-learning dashboard** — `src/app/[locale]/dashboard/reality-loop/page.tsx` + `src/land/reality-loop/insights.ts` *(done 2026-08-29, admin-gated, bilingual)*
- [x] **Killer Test acceptance flight** — `src/forest/inngest/functions/__tests__/killer-mission-e2e.test.ts` *(done 2026-08-29, 12/12 tests, 10 success criteria)*
- [x] **Circuit breaker — 4-state machine** — `src/seed/types/failure-kind.ts:28-37` (CLOSED/DEGRADED/OPEN/HALF_OPEN) + `src/seed/security/circuit-breaker.ts` *(pre-existing, verified in `/api/health` authenticated component view)*
- [x] **Health endpoint** — `src/app/api/health/route.ts` *(pre-existing, reports DB + KV + R2 + circuit breaker components)*
- [x] **Alert dispatch path** — `src/tree/alerts/realtime-alert-mutations.ts:7` `createRealtimeAlert()` → `user_alerts` D1 table *(pre-existing, verified)*
- [x] **Governance docs** — `docs/INCIDENT_RESPONSE.md`, `docs/disaster-recovery.md`, `docs/apm-runbook.md`, `docs/observability-runbook.md`, `docs/ops-runbook.md` *(pre-existing, refresh status TBD in Phase 1)*
- [x] **Escrow MED-3 closed** — insights.ts rewritten to read `creative_missions` status (source of truth) instead of non-existent `performance_events` event_type *(done 2026-09-01, `land/reality-loop/insights.ts:69-80`)*
- [x] **Escrow LOW-1 closed** — `listFeedbackByMission` now workspace-scoped (`feedback-store.ts:209,216`)*(done 2026-09-01)*
- [ ] **Sentry symbolication opt-in path** — `src/seed/observability/sentry-symbolication-opt-in.ts` *(NOT STARTED — Phase 3 hardening)*
- [ ] **CF-native alert wrappers (3)** — circuit-breaker trip, billing anomaly, mission-abandon spike in `src/forest/alerts/` *(NOT STARTED — Phase 3 hardening)*
- [ ] **Reality Loop emitter-health endpoint** — `src/app/api/reality-loop/health/route.ts` + `src/tree/performance/emitter-health.ts` *(NOT STARTED — Phase 3 hardening)*
- [ ] **Constitution v2.0** — `docs/SOPHIA_2028_CONSTITUTION.md` *(NOT STARTED — Phase 1)*

### Dependencies
- 2027 phases 0–10 complete (evidence-backed below)
- Reality Loop v1 shipped (11/13 wired)
- No-tech doctrine ceiling 91.5/100 (no operator-side creds)

### Risks
- R1: Alert storm (no throttle) → KV throttle: 1 alert/service/15min
- R2: Sentry opt-in accidentally becomes blocker → regression test asserts deploy-success-without-token
- R3: New crons overload CF Worker → within existing 23-cron budget
- R4: ESLint suppression creep → freeze enforced, 0 new eslint-disable
- R5: Protected flow regression → explicit smoke: Setup Wizard, Telegram, NOWPayments
- R6: Docs aspirational checkmarks → rule: only mark verified-with-evidence
- R7: `:any` / `console.log` in new code → quality gate + code-reviewer
- R8: Deploy on broken base → pre-deploy gate (type-check + test + build) blocks

### KPIs
- 0 production behavior change on protected flows
- 13 canonical event types registered, 11 wired / 2 deferred (by design)
- 0 new eslint-disable comments
- 0 `:any` types in new code
- Test count ≥ 8679 (no regression)

### Exit Criteria
- Constitution v2.0 ratified (supersedes v1.1)
- 3 CF-native alert wrappers shipped + tested
- Sentry symbolication = optional (absent token never fails build/deploy)
- Emitter-health endpoint reports wired/deferred/lag per event type
- Governance docs refreshed to 2028 baseline
- `npm run build` 0 errors, `npm test` 0 failed, `npm run lint` 0 errors in touched files

---

## Phase 1 — Foundation Hardening (2026-Q4)

### Muc Tieu / Objective
Củng cố nền tảng kỹ thuật: quan sát khả nụng hoàn chỉnh, cảnh báo tự động, quản trị vận hành, và đo lường Reality Loop ổn định.
Solidify the technical foundation: complete observability, automated alerting, operations governance, and stable Reality Loop measurement.

### Deliverables
- [ ] **Sentry symbolication opt-in** — sourcemap upload only when `SENTRY_AUTH_TOKEN` present; skip (not error) when absent
- [ ] **CF-native alert wrappers (3)** — circuit-breaker trip, billing anomaly (>3× median spend), mission-abandon spike (>20% rate); reuse `tree/alerts/createRealtimeAlert` → `user_alerts` D1 table
- [ ] **Reality Loop emitter-health endpoint** — public (status only) + authenticated (per-event wired/deferred/lag counts)
- [ ] **Governance docs refresh** — `INCIDENT_RESPONSE.md`, `disaster-recovery.md`, `apm-runbook.md` updated to 2028 baseline
- [ ] **Constitution v2.0** — `docs/SOPHIA_2028_CONSTITUTION.md` (vision, product doctrine, architecture principles, layer governance)
- [ ] **Reality Loop emitter-lag metric** — wired emitters report `now - last-emitted-at`; stale detection > 24h
- [ ] **Alert throttle tests** — assert 1 alert/service/15min KV throttle suppresses duplicates
- [ ] **Billing anomaly tests** — assert fires when spend > 3× median, no fire when normal
- [ ] **Mission-abandon spike tests** — assert fires when abandon rate > 20%

### Dependencies
- Phase 0 exit criteria met
- Reality Loop v1 stable (11/13 wired)
- `tree/alerts/` dispatch path verified

### Risks
- R1: Alert fatigue from over-sensitive thresholds → start conservative, tune after 30 days
- R2: Sentry token accidentally committed → pre-commit hook + CI guard
- R3: Governance docs drift from code reality → quarterly refresh cadence

### KPIs
- Alert latency < 5 min from incident to `user_alerts` write
- Emitter-health endpoint p95 < 200ms
- 0 false-positive billing alerts in 30-day window
- Governance docs 100% cite current file:line (no stale refs)

### Exit Criteria
- 3 alert wrappers shipped with passing tests
- Sentry opt-in regression: deploy-without-token succeeds
- Emitter-health endpoint live + authenticated component accurate
- Constitution v2.0 ratified
- All governance docs refreshed to 2028 baseline

---

## Phase 2 — Distribution Operations (2027-Q1)

### Muc Tieu / Objective
Vận hành hệ thống phân phối nội dung đa kênh ổn định — từ production graph đến publish thực tế.
Operate the multi-channel content distribution system reliably — from production graph to actual publish.

### Deliverables
- [ ] **Distribution adapter hardening** — YouTube, TikTok, Instagram, Facebook adapters with retry + circuit breaker
- [ ] **Publish pipeline monitoring** — track publish success rate, latency, failure taxonomy per channel
- [ ] **Audience intelligence v1** — audience analysis + targeting engine (≥ 3 major markets)
- [ ] **Distribution analytics dashboard** — per-channel performance, reach, engagement metrics
- [ ] **Cross-channel deduplication** — prevent duplicate publishes across platforms

### Dependencies
- Phase 1 hardening complete
- Production graph stable (3 templates: article-factory, video-brief, repurpose-derivative)
- Distribution-fanout.ts operational

### Risks
- R1: Platform API changes break adapters → adapter abstraction layer + circuit breaker
- R2: Rate limiting across platforms → per-channel rate limiter + backoff
- R3: Content policy violations per platform → pre-publish policy check

### KPIs
- Publish success rate > 95%
- Distribution to ≥ 4 platforms
- Publish latency < 30s (p95)
- 0 cross-channel duplicate publishes

### Exit Criteria
- ≥ 4 distribution adapters operational with circuit breaker
- Publish pipeline monitoring live
- Audience intelligence covers ≥ 3 major markets
- Distribution analytics dashboard operational

---

## Phase 3 — Commerce (2027-Q2)

### Muc Tieu / Objective
Kết nối hệ thống sáng tạo với thương mại — từ nội dung đến monetization có thể đo lường được.
Connect creative systems to commerce — from content to measurable monetization.

### Deliverables
- [ ] **Revenue event pipeline** — event-driven revenue tracking (ad revenue, sponsorships, affiliate)
- [ ] **Commerce interfaces v1** — e-commerce integration for digital products
- [ ] **Creative Economics v2** — ROI modeling for creative investments (validated against actual revenue)
- [ ] **Billing consolidation** — multi-tier support (BASIC/PREMIUM/ENTERPRISE/MASTER) with usage metering
- [ ] **Revenue attribution** — tie revenue events back to missions + creative outputs

### Dependencies
- Phase 2 distribution operations stable
- NOWPayments + PayOS billing operational
- Economic snapshot writer (mig 0263) stable

### Risks
- R1: Revenue tracking accuracy hard to validate → reconcile against platform reports monthly
- R2: Privacy regulations vary by region → workspace-scoped data + regional compliance
- R3: Attribution complexity (multi-touch) → start with last-touch, iterate

### KPIs
- Revenue event accuracy > 95% (vs platform reports)
- Billing system handles 4 tiers without manual intervention
- Creative ROI model validated against ≥ 3 months actual revenue
- Revenue attribution covers ≥ 80% of tracked revenue

### Exit Criteria
- Revenue pipeline operational with ≥ 3 revenue sources
- Commerce interfaces handle digital product sales
- Billing consolidation complete (4 tiers)
- Creative economics model validated against actual revenue

---

## Phase 4 — Scale (2027-Q3/Q4)

### Muc Tieu / Objective
Mở rộng quy mô — multi-tenant, hiệu năng, và ecosystem APIs.
Scale the platform — multi-tenant, performance, and ecosystem APIs.

### Deliverables
- [ ] **Multi-tenant scaling** — support multiple organizations/creators with data isolation
- [ ] **Performance optimization** — p95 response time < 200ms, throughput ≥ 100 concurrent missions
- [ ] **Ecosystem APIs v1** — public APIs for third-party integrations (documented + versioned)
- [ ] **Template library expansion** — ≥ 10 creator/business templates
- [ ] **Observability maturity** — mature monitoring, alerting, governance policies

### Dependencies
- Phase 3 commerce stable
- All previous phases exit criteria met
- Infrastructure scaling ready (CF Workers + D1 + R2 + KV)

### Risks
- R1: Multi-tenant complexity increases exponentially → strict data isolation testing
- R2: Public API requires extensive documentation + versioning → API-first design
- R3: Performance degradation at scale → load testing + circuit breaker tuning

### KPIs
- Multi-tenant supports ≥ 100 concurrent organizations
- System response time < 200ms (p95)
- Public API uptime > 99.9%
- Template library covers ≥ 10 creator types
- 0 data leakage incidents across tenants

### Exit Criteria
- Multi-tenant isolated (no data leakage)
- Performance targets met (p95 < 200ms, ≥ 100 concurrent missions)
- Public API documented + tested + versioned
- Template library validated by ≥ 3 real creators
- Observability + governance policies enforced

---

## 2027 Phases — Completed Foundation / Nền tảng đã hoàn thành

> SOPHIA_2027_ROADMAP.md khai báo 6 giai đoạn (0–5). Tất cả đã ship với bằng chứng (evidence-backed).
> SOPHIA_2027_ROADMAP.md declares 6 phases (0–5). All shipped with evidence-backed proof.

| Phase | Period | Focus | Status | Evidence |
|-------|--------|-------|--------|----------|
| 0 | 2026-08 | Recon + Constitution | ✅ Complete | `REPO_RECONNAISSANCE_2026-08-17.md`, `SOPHIA_2027_CONSTITUTION.md v1.1`, `SOPHIA_2027_ROADMAP.md` Step B/C/D ✅ |
| 1 | 2026-Q3/Q4 | Creative Foundation | ✅ Complete | SHA `1df573d8` (Sophia 2027 Phase 1 Domain Shipped) — identity/memory/mission/agent-protocol models |
| 2 | 2027-Q1 | Creative Intelligence | ✅ Complete | SHA `7f0b33347` — signals/trend/graphs/experiment-rescue, migs 0254-0256, 8213 tests |
| 3 | 2027-Q2 | Autonomous Factory | ✅ Complete | SHA `90bb9d0e` — production graph engine + graph agents + runner wiring (`production-graph-runner.ts`); approval gates, autonomy levels, retry/resume shipped in same phase |
| 4 | 2027-Q3 | Distribution + Commerce | ✅ Complete | SHA `fd37f3534` — distribution adapters (YouTube/TikTok/Instagram/X/Bluesky/Reddish/Threads/Facebook), audience engine, revenue ingestion, commerce, migs 0258-0261, 8546 tests, COMMERCE.md |
| 5 | 2027-Q4 | Creative Economy OS | ✅ Complete | Phase 4 distribution + creative economics (`fd37f3534`); Reality Loop v1 (13 canonical events, 11 wired), Killer Test (8679 tests), design-partner bundles, economic snapshot (mig 0262+0263) |

---

## NON-GOALS / Không phải mục tiêu (binding)

> Những gì 2028 roadmap KHÔNG làm. Không ngoại trừ.
> What the 2028 roadmap does NOT do. No exceptions.

- ❌ **No new product feature** — hardening + measurement only in Phase 0–1
- ❌ **No marketplace** — no creator marketplace, no exchange
- ❌ **No new agent framework** — reuse existing `agent-protocol/` + `graph-agents.ts`
- ❌ **No new memory system** — reuse existing `CreativeMemoryStore` (validated 8/8)
- ❌ **No operator-side credentials** — no-tech doctrine: operator manages PLATFORM ONLY
- ❌ **No Shopify/WooCommerce yet** — commerce integrations deferred to Phase 3+
- ❌ **No DB schema changes** — mig budget 0262+0263 already consumed; new needs require explicit approval
- ❌ **No new orchestration engine** — Inngest + graph runner only
- ❌ **No 20-platform integration** — focus on ≤ 4 core platforms in Phase 2

---

## Timeline Summary / Tóm tắt thời gian

| Phase | Period | Focus |
|-------|--------|-------|
| 0 | 2026-09 | Recon + Constitution + Production Hardening |
| 1 | 2026-Q4 | Foundation Hardening |
| 2 | 2027-Q1 | Distribution Operations |
| 3 | 2027-Q2 | Commerce |
| 4 | 2027-Q3/Q4 | Scale |

> **Luu y / Note:** Timeline thay đổi tùy thuộc velocity và discovery trong mỗi phase.
> Timeline may shift depending on velocity and discovery in each phase.

---

## Escrow Log / Nhật ký Escrow

| Escrow | Severity | Status | Resolution |
|--------|----------|--------|------------|
| MED-1 | MEDIUM | ✅ Closed | `learning.emit` + `feedback.received` declared only, no emitter — by design |
| MED-3 | MEDIUM | ✅ Closed | insights.ts rewritten to read `creative_missions` status (2026-09-01) |
| LOW-1 | LOW | ✅ Closed | `listFeedbackByMission` workspace-scoped (2026-09-01) |

---

## Cross-references / Tham chéo

- `SOPHIA_2027_ROADMAP.md` — 2027 lineage (no version header)
- `SOPHIA_2027_CONSTITUTION.md` v1.1 — superseded by v2.0 in Phase 1
- `docs/reality-loop/REALITY_LOOP_REPORT.md` — Reality Loop v1 measurement report
- `docs/reality-loop/SOPHIA_VALUE_SCORECARD.md` — 8-group metric scorecard
- `.claude/rules/sophia-no-tech-doctrine.md` — no-tech doctrine (91.5/100 ceiling)
- `.claude/rules/sophia-handover-rules.md` — bilingual client-facing quality rules
