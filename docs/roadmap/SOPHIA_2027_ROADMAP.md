# Sophia AI Factory — Roadmap 2027

> **Last updated:** 2026-08-22
> **Vision:** Hệ thống factory AI tự động hóa toàn bộ chuỗi sáng tạo nội dung — từ ý tưởng đến phân phối.
> An AI-powered factory that automates the entire creative content pipeline — from ideation to distribution.

---

## Phase 0 — Reconnaissance + Constitution (2026-08)

> Giai đoạn hiện tại / Current phase

### Muc Tieu / Objective
Thiết lập nền tảng pháp lý, kỹ thuật, và quy trình cho toàn bộ dự án.
Establish the legal, technical, and procedural foundation for the entire project.

### Deliverables — Trạng thái đã xác minh / Verified status

> Chỉ đánh dấu những gì đã được xác minh bằng bằng chứng (build/test/grep). Không đánh dấu kỳ vọng.
> Only mark what has been verified with evidence (build/test/grep). No aspirational checkmarks.

- [x] **Reconnaissance** — `docs/architecture/REPO_RECONNAISSANCE_2026-08-17.md`
  *(done 2026-08-17, refreshed 2026-08-22 via `REPO_RECONNAISSANCE_2026-08-22-REFRESH.md`)*
- [x] **Constitution** — `docs/strategy/SOPHIA_2027_CONSTITUTION.md` *(done)*
- [x] **Canonical contracts** — `src/seed/types/creative-economy/`
  (15 interfaces, 13 events, errors, ids, Zod schemas) *(done, tests green)*
- [x] **Step B** — `ICreativeMemoryStore` contract *(done)*
- [x] **Step D** — mission deprecation + barrel wiring
  *(done, verified: tsc 0 errors, lint 0 new, 7689 tests pass, build exit 0)*
- [x] **Step C** — layer-mapping ADR
  (`docs/architecture-decisions/ADR-creative-economy-layer-mapping.md`) *(done — this run)*
- [ ] **Step E** — validation gate *(in progress)*
- [ ] **Phase 1–8** — *(NOT STARTED)*

### Dependencies
- Codebase audit (đang thực hiện)
- Phân tích dependency graph giữa `land/`, `forest/`, `tree/`, `seed/`

### Risks
- R1: Codebase quá lớn để audit trong 1 tháng
- R2: Có thể phát hiện thêm hidden dependencies chưa biết

### KPIs
- 100% modules có verdict (KEEP/MERGE/DELETE)
- 0 broken production routes sau audit
- Documentation coverage > 80%

### Exit Criteria
- Tất cả modules đã được đánh dấu verdict
- Phase gates document approved
- Ready to begin Phase 1

---

## Phase 1 — Creative Foundation (2026-Q3/Q4)

### Muc Tieu / Objective
Thiết kế domain model cốt lõi: CreativeIdentity, CreativeMemory, Mission, Agent Protocol, Provenance, Provider Abstraction.
Design the core domain model: CreativeIdentity, CreativeMemory, Mission, Agent Protocol, Provenance, Provider Abstraction.

### Deliverables
- [ ] **CreativeIdentity** — identity system cho agents và content pieces
- [ ] **CreativeMemory** — centralized memory abstraction thay thế implicit memory patterns
- [ ] **Mission** — structured goal system cho creative tasks
- [ ] **Agent Protocol** — unified agent communication standard (thay thế ad-hoc agent systems)
- [ ] **Provenance** — content provenance tracking (ai-generated, human-edited, mixed)
- [ ] **Provider Abstraction** — unified AI provider layer (`seed/ai/` consolidation)
- [ ] Consolidate `land/`, `forest/`, `tree/` workflows vào `seed/inngest/`
- [ ] Unit tests cho mọi domain model (minimum 90% coverage)

### Dependencies
- Phase 0 exit criteria met
- Deprecation audit hoàn thành
- Inngest engine stable

### Risks
- R1: Domain model quá abstract → khó implement
- R2: Breaking changes khi consolidate workflows
- R3: Telegram bot + NOWPayments flow có thể bị ảnh hưởng

### KPIs
- 0 TypeScript errors
- Test coverage > 90% cho domain models
- Telegram bot responds within 2s
- NOWPayments IPN → tier activation < 5s

### Exit Criteria
- Tất cả domain models có tests + documentation
- Old agent systems (land/agent-chat, tree/agents) đã bị remove hoặc merge
- Provider abstraction covers OpenRouter, ElevenLabs, D-ID
- `npm run build` passes, `npm test` passes all

---

## Phase 2 — Creative Intelligence (2027-Q1)

> **Status update 2026-08-26:** Phase 2 execution complete (lanes A–H). Checkmarks below are evidence-backed only: each item has code + passing tests on the working tree. Production migration apply + deploy happen after this roadmap update; backtest KPI remains unvalidated against real data.

### Muc Tieu / Objective
Xây dựng hệ thống phân tích thị trường, xu hướng, graph relationships, và performance modeling cho nội dung sáng tạo.
Build market analysis, trend intelligence, graph relationships, and performance modeling for creative content.

### Deliverables
- [x] **Market Signals** — real-time market signal ingestion *(done 2026-08-26: `tree/market-signals/` store + YouTube BYOK source + Google Trends RSS source, hourly cron `market-signals-ingest` registered in Inngest route (functions array 34), migrations 0255, 51+10 tests)*
- [x] **Trend Intelligence** — trend detection + forecasting engine *(done 2026-08-26: `tree/trend-intelligence/` detect + SES 7-day forecast, pure math ≥90% branch coverage, signals→detections integration test, migration 0256, 46 tests)*
- [x] **IP Graph** — intellectual property relationship graph *(pre-existing `tree/ip-graph/` since earlier phases; Phase 2 added read-only exposure via `land/graphs/actions.ts` + `GET /api/graphs/ip-lineage`, auth-gated 401, 23 action tests)*
- [x] **Content Graph** — content relationship mapping *(pre-existing `tree/content-graph/`; Phase 2 added `getContentPerformance` export + read-only exposure via `/api/graphs/content-lineage` and `content-performance`)*
- [x] **Experiment Engine** — A/B testing framework *(production `forest/ab/` pre-existing; Phase 2 closed schema debt: migration 0254 creates missing `experiments`/`experiment_variants`/`experiment_results` tables, aligned `tree/performance/experiment.ts`, added read-only `forest/ab/engine-bridge.ts` unified view; learning-loop E2E + 12-concurrent-experiments KPI green, 85 tests)*
- [x] **Performance Model** — predictive performance scoring *(done 2026-08-26: `tree/performance/scoring.ts` deterministic heuristic + `scripts/backtest-performance-model.ts` CLI, 26 tests. ⚠️ Backtest precision validated only on synthetic fixture (100%); production replay pending — model ships low-confidence until real-data validation. See `docs/architecture/PERFORMANCE_INTELLIGENCE.md`)*
- [x] Provider abstraction mở rộng cho thêm AI services *(done 2026-08-26: OpenRouter image-generation adapter in `seed/ai/providers/openrouter-image-adapter.ts` — BYOK-keyable, circuit breaker wired, 16 contract tests)*

### Dependencies
- Phase 1 domain models complete ✅ (shipped 2026-08-26, SHA 1df573d8)
- Provider abstraction stable ✅
- Database schema supports graph relationships ✅ (migrations 0254–0256 additive)

### Risks
- R1: Market signal data quality varies wildly
- R2: Graph relationships có thể quá complex cho early stage
- R3: Performance model cần training data chưa có

### KPIs
- Trend detection latency < 1 hour *(by construction: hourly ingest cron; real-data confirmation pending post-deploy)*
- Content graph query response < 500ms *(soft-asserted in tests on seeded fixtures; prod measurement pending)*
- Experiment engine supports 10+ concurrent experiments *(✅ verified: 12 concurrent creations, 0 failures)*
- Performance model accuracy > 70% (top quartile) *(⚠️ NOT yet validated — synthetic fixture only; production replay pending)*

### Exit Criteria
- Market signals ingesting từ ≥ 3 sources *(pending — 2 sources shipped: YouTube trending BYOK + Google Trends RSS; deploy + workspace config required before first real ingestion cycle)*
- IP graph và content graph có visualization *(pending — read-only JSON API shipped (`/api/graphs/[type]`); UI visualization not in Phase 2 scope)*
- Experiment engine đã chạy ≥ 5 real experiments *(pending — schema debt closed (0254), engine ready; needs production data)*
- Performance model validated against historical data *(⚠️ pending — see deliverable note above)*

---

## Phase 3 — Autonomous Factory (2027-Q2)

### Muc Tieu / Objective
Triển khai hệ thống multi-agent production graph — agents tự động sản xuất nội dung với human approval checkpoints.
Deploy multi-agent production graph — agents autonomously produce content with human approval checkpoints.

### Deliverables
- [x] **Multi-Agent Production Graph** — orchestrated agent workflows cho content production *(✅ DONE 2026-08-27 — Lane E: 5 source files + 79 tests; 3 templates article-factory / video-brief / repurpose-derivative; runner `src/forest/inngest/functions/production-graph-runner.ts`; 3 graph agents in `src/tree/agent-protocol/graph-agents.ts`; validate rejects cycle/unknown-agent/multi-sink; migration 0257)*
- [x] **Human Approval Gates** — configurable approval checkpoints trước khi publish *(✅ DONE 2026-08-27 — Lane C: `requestApprovalAndAwait` filter-loop adapter + `agent.approval.requested` first sender + `*/15` timeout cron; 29 scoped tests, 128 broader; zero new UI — approvals render on existing `/dashboard/approvals`)*
- [x] **Autonomy Levels** — tiered autonomy (Level 0: full human, Level 3: full auto) *(✅ DONE 2026-08-27 — Lane B: L0–L3 → AutonomyLevel 0–4 mapping; fail-closed resolver `src/tree/autonomy/effective-autonomy.ts` (18 tests); per-mission-type policy table + CRUD; executor surgical edit, 100/100 tests)*
- [x] **Retry/Resume** — automatic retry + resume cho failed production runs *(✅ DONE 2026-08-27 — Lane D: exponential backoff `min(30′, 5′·2^n)` + terminal `RETRIES_EXHAUSTED` + wide-window scan; 37 tests; rollback cron reuses same runId)*
- [x] **Creative Learning** — agents học từ feedback loops (performance data + human edits) *(Phase 4 modules: performance-aggregation, learning-velocity, experiment-feedback, winner-picker, ROI tracker — 70 tests, schema bug fixed, production SQL bug fixed)*
- [x] Production monitoring + alerting dashboard *(✅ DONE 2026-08-27 — Lane G: `/dashboard/system-health` page + 6 KPIs + pending approvals + HarnessHealthCard; `src/land/production-monitoring/` (15 tests); 3 alert triggers; i18n `productionMonitoring` 27 keys symmetric VN/EN; build exit 0)*

### Dependencies
- Phase 2 intelligence systems complete
- Agent protocol stable
- CreativeMemory + Provenance systems operational

### Risks
- R1: Autonomous agents có thể tạo nội dung không phù hợp
- R2: Human approval bottleneck nếu automation cao
- R3: Feedback loops cần thời gian để收敛

### KPIs
- Production pipeline完成率 > 90% (không cần human intervention) *(now measured: dashboard KPI `completionPct` from `production_graph_runs`; production baseline pending real run data post-deploy)*
- Human approval turnaround < 4 hours *(now measured: dashboard KPI `approvalTurnaroundMedianHours` from `agent_approvals` resolved durations; production baseline pending)*
- Retry success rate > 85% *(now measured: dashboard KPI `retrySuccessPct` = completed runs with `retry_count > 0` / completed; production baseline pending)*
- Content quality score improvement > 20% over baseline *(pending — requires production run data)*

### Exit Criteria
- ≥ 3 complete production pipelines operational *(✅ 3 templates shipped: article-factory, video-brief, repurpose-derivative — each a validated linear DAG with publish sink; plus the two pre-existing live pipelines)*
- Autonomy levels configurable per mission type *(✅ `mission_type_policies` table + resolver + UI on `/dashboard/settings/autonomy`)*
- Creative learning shows measurable improvement *(pending — learning loop shipped in Phase 4 modules; improvement measurement requires production data)*
- Production dashboard operational *(✅ `/dashboard/system-health` + `/vi/dashboard/system-health` bilingual, 6 KPIs, pending approvals, HarnessHealthCard)*

---

## Phase 4 — Distribution + Commerce (2027-Q3)

### Muc Tieu / Objective
Kết nối hệ thống sáng tạo với các kênh phân phối và thương mại — từ tạo nội dung đến monetization.
Connect creative systems to distribution channels and commerce — from content creation to monetization.

### Deliverables
- [ ] **Distribution Adapters** — plugins cho YouTube, TikTok, Instagram, Facebook, etc.
- [ ] **Audience Intelligence** — audience analysis + targeting engine
- [ ] **Revenue Events** — event-driven revenue tracking (ad revenue, sponsorships, etc.)
- [ ] **Commerce Interfaces** — e-commerce integration cho digital products
- [ ] **Creative Economics** — ROI modeling cho creative investments
- [ ] Billing consolidation + multi-tier support

### Dependencies
- Phase 3 production pipelines stable
- Content quality validated
- NOWPayments billing system operational

### Risks
- R1: Platform API changes có thể break adapters
- R2: Revenue tracking accuracy khó validate
- R3: Audience data privacy regulations vary by region

### KPIs
- Distribution to ≥ 5 platforms
- Revenue event accuracy > 95%
- Audience intelligence covers ≥ 3 major markets
- Creative ROI model validated against actual revenue

### Exit Criteria
- ≥ 5 distribution adapters operational
- Revenue tracking verified against platform reports
- Creative economics model validated
- Billing system handles multi-tier (BASIC/PREMIUM/ENTERPRISE/MASTER)

---

## Phase 5 — Creative Economy OS (2027-Q4)

### Muc Tieu / Objective
Hệ thống hoàn chỉnh — autonomous creative missions, templates cho creators/businesses, ecosystem APIs, multi-tenant scaling.
Complete system — autonomous creative missions, creator/business templates, ecosystem APIs, multi-tenant scaling.

### Deliverables
- [ ] **Autonomous Missions** — fully autonomous creative missions (idea → publish → optimize)
- [ ] **Creator/Business Templates** — pre-built templates cho different creator types
- [ ] **Ecosystem APIs** — public APIs cho third-party integrations
- [ ] **External Integrations** — Shopify, WooCommerce, WordPress, etc.
- [ ] **Multi-Tenant Scaling** — support multiple organizations/creators
- [ ] **Observability/Governance** — mature monitoring, alerting, governance policies

### Dependencies
- Phase 4 distribution + commerce stable
- All previous phases exit criteria met
- Infrastructure scaling ready

### Risks
- R1: Multi-tenant complexity increases exponentially
- R2: Public API requires extensive documentation + versioning
- R3: Governance policies cần balance automation + control

### KPIs
- Autonomous mission completion rate > 80%
- Template library covers ≥ 10 creator types
- Public API uptime > 99.9%
- Multi-tenant supports ≥ 100 concurrent organizations
- System response time < 200ms (p95)

### Exit Criteria
- ≥ 5 autonomous missions completed end-to-end
- Template library validated by ≥ 3 real creators
- Public API documented + tested
- Multi-tenant isolated (no data leakage)
- Governance policies enforced
- System monitoring + alerting operational

---

## Timeline Summary

| Phase | Period | Focus |
|-------|--------|-------|
| 0 | 2026-08 | Reconnaissance + Constitution |
| 1 | 2026-Q3/Q4 | Creative Foundation |
| 2 | 2027-Q1 | Creative Intelligence |
| 3 | 2027-Q2 | Autonomous Factory |
| 4 | 2027-Q3 | Distribution + Commerce |
| 5 | 2027-Q4 | Creative Economy OS |

> **Luu y / Note:** Timeline thay đổi tùy thuộc velocity và discovery trong mỗi phase.
> Timeline may shift depending on velocity and discovery in each phase.
