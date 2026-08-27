# SOPHIA 2027 Creative Intelligence Architecture

> **Layer:** `tree` (domain-specific reusable) + `forest` (infrastructure orchestrators)
>
> **Phase:** 2 — Creative Intelligence (built on Phase 1 domain + agent protocol)

---

## Overview (Tổng quan)

Creative Intelligence là lớp domain logic cốt lõi cho phép Sophia **tự động khám phá, nghiên cứu, lập kế hoạch, sản xuất, đo lường, và học** từ nội dung sáng tạo. 11 component hoạt động cùng nhau để tạo ra **vòng lặp học tập end-to-end** đầu tiên:

```
Signal → Research → Concept → Content Project → Asset → Performance → Experiment → Learning → Creative Memory
```

Mọi component đều:
- **Interface-first**: Provider adapters (YouTube, RSS, OpenRouter) ẩn sau interface, test bằng **deterministic fixtures** (không gọi API thật).
- **Type-safe**: Zero `:any`, Zod validation mọi input, Result<T,E> cho mọi async operation.
- **Bilingual**: Tất cả user-facing text có cả Việt Nam + English.
- **Tier-aware**: BASIC | PREMIUM | ENTERPRISE | MASTER (uppercase only).

---

## 1. MarketSignal — `src/tree/market-signals/`

**Mục đích:** Thu thập tín hiệu thị trường từ nhiều nguồn (YouTube, RSS/Google Trends) với **dedupe** theo `(source, title-hash, day-window)`.

### Files
| File | Chức năng |
|------|-----------|
| `store.ts` | CRUD + `upsertSignalDeduped` (SHA-256 title hash, 1-day window) |
| `sources/youtube-source.ts` | YouTube Data API v3 adapter, BYOK OAuth, confidence từ view velocity |
| `sources/rss-source.ts` | Google Trends RSS adapter (public, no auth), DOMParser cho XML |
| `index.ts` | Barrel exports |

### Key API
```typescript
// Dedupe upsert — trả về { signal, isNew, dedupedFrom? }
upsertSignalDeduped(workspaceId: string, signal: Omit<MarketSignal, 'id' | 'createdAt'>)

// Fetch từ YouTube (cần BYOK token)
fetchYouTubeSignals(workspaceId: string, config: YouTubeSourceConfig)

// Fetch từ Google Trends RSS (public)
fetchGoogleTrendsSignals(workspaceId: string, config: RssSourceConfig)
```

### Test Strategy
- `store.test.ts`: 18 tests — CRUD, dedupe logic, edge cases (empty, unicode, long titles)
- `youtube-source.test.ts`: 9 tests — fixture `youtube-search-response.json`, `youtube-video-details.json`
- `rss-source.test.ts`: 7 tests — fixture `google-trends-rss.xml`

---

## 2. Trend Intelligence — `src/tree/trend-intelligence/`

**Mục đích:** Phát hiện trend cross-channel từ `market_signals` + `performance_events`, forecast bằng **Exponential Smoothing (SES)** deterministic.

### Files
| File | Chức năng |
|------|-----------|
| `detect.ts` | Pipeline: pull signals + performance → group by (channel, topic) → score momentum → persist `trend_detections` (migration 0256) |
| `forecast.ts` | Pure SES forecaster: flat projection + widening 95% CI |
| `detect-math.ts` | Pure math: `bucketEvidence`, `computeTopicMomentum`, `topicsFromText` (import multipliers từ `youtube-strategy/trend-scorer`) |
| `types.ts` | `TrendDetection`, `TrendPoint`, `ForecastResult` |

### Key Algorithm
```typescript
// SES: S_t = α·y_t + (1-α)·S_{t-1},  α=0.3 default
// Forecast: flat S_t, CI widens as sqrt(h) * σ_residual
function sesForecast(points: TrendPoint[], horizon: number, alpha = 0.3): ForecastResult
```

### Data Source
- `market_signals` table (từ MarketSignal)
- `performance_events` table (từ Performance Event Model)
- Output: `trend_detections` table (migration 0256)

### Test Strategy
- `detect.test.ts`: 14 tests — pipeline with mocked DB, momentum scoring
- `forecast.test.ts`: 12 tests — deterministic SES math, CI widening property
- `detect-math.test.ts`: 10 tests — bucketEvidence, topic extraction, multiplier mapping

---

## 3. AudienceSignal — **Consolidated into `tree/market-signals/`**

> **Note:** Audience signals được model như một loại `MarketSignal` với `source = 'audience'` và metadata chứa demographic/behavioral data. Không có directory riêng `audience-signal/` — design decision để tránh fragmentation.

### Schema Extension
```typescript
interface MarketSignal {
  source: 'youtube' | 'rss' | 'audience' | 'competitor';
  metadata: {
    // audience-specific
    demographics?: { ageRange: string; gender: string; geo: string };
    interests?: string[];
    engagementRate?: number;
  };
}
```

---

## 4. CompetitorSignal — **Consolidated into `tree/youtube-strategy/competitor-analyzer.ts`**

> **Note:** Competitor analysis đã tồn tại từ Phase 1 (`youtube-strategy/competitor-analyzer.ts`) — Phase 2 reuse và extend thay vì tạo mới.

### Key Functions
```typescript
// Analyze competitor channel: content cadence, topic clusters, performance benchmarks
analyzeCompetitor(workspaceId: string, competitorChannelId: string): Promise<CompetitorReport>

// Track competitor content gaps vs our IP
findContentGaps(workspaceId: string, ourIpIds: string[]): Promise<ContentGap[]>
```

---

## 5. ResearchArtifact — `src/tree/research/`

**Mục đích:** Lưu trữ kết quả nghiên cứu có cấu trúc (topic briefs, competitor reports, audience insights) có versioning và provenance.

### Files
| File | Chức năng |
|------|-----------|
| `types.ts` | `ResearchArtifact` (7 loại: `topic_brief`, `competitor_report`, `audience_insight`, `trend_analysis`, `content_gap`, `keyword_map`, `creative_brief`) |
| `store.ts` | CRUD + `upsertWithVersion` (auto-increment version, immutable history) |
| `index.ts` | Barrel exports |

### Key API
```typescript
createResearchArtifact(workspaceId: string, artifact: ResearchArtifactInput): Promise<ResearchArtifact>
getResearchArtifact(id: string): Promise<ResearchArtifact | null>
listResearchArtifacts(workspaceId: string, type?: ResearchArtifact['type']): Promise<ResearchArtifact[]>
```

### Test Strategy
- `store.test.ts`: 15 tests — versioning, immutability, query by type

---

## 6. CreativeConcept — `src/tree/creative-concept/`

**Mục đích:** Đại diện cho một ý tưởng nội dung hoàn chỉnh: hook, structure, visual/audio cues, estimated production cost.

### Files
| File | Chức năng |
|------|-----------|
| `types.ts` | `CreativeConcept` (hook, beats[], visualCues[], audioCues[], estimatedDurationSec, estimatedCostCents, status) |
| `store.ts` | CRUD + `linkToResearch(artifactIds)` + `promoteToProject()` |
| `generator.ts` | BYOK OpenRouter generation + deterministic fallback (template-based) |
| `index.ts` | Barrel exports |

### Key API
```typescript
// Generate concept từ research artifacts (LLM + fallback)
generateConcept(workspaceId: string, researchArtifactIds: string[], brief: string): Promise<CreativeConcept>

// Promote thành ContentProject (tạo record trong content_graph)
promoteToProject(conceptId: string, missionId: string): Promise<ContentProject>
```

### Test Strategy
- `generator.test.ts`: 11 tests — fixture `openrouter-concept-response.json`, fallback path
- `store.test.ts`: 9 tests — CRUD, research linking, promotion

---

## 7. IP Graph — `src/tree/ip-graph/`

**Mục đích:** Quản trị intellectual property entities: **Universe → Series → Character → Theme → Brand** (parentId graph).

### Files
| File | Chức năng |
|------|-----------|
| `types.ts` | Full CRUD + `getIPDerivatives(ipId)` — BFS traversal descendants |

### Key API
```typescript
createIP(entity: IP): Promise<IP>
getIP(id: string): Promise<IP | null>
listIP(workspaceId: string, type?: IP['type']): Promise<IP[]>
getIPChildren(parentId: string): Promise<IP[]>
getIPDerivatives(ipId: string): Promise<IP[]>  // recursive descendants
updateIPStatus(id: string, status: ContentStatus): Promise<IP | null>
```

### Entity Types
`universe` | `series` | `character` | `theme` | `brand`

### Test Strategy
- `types.test.ts`: 16 tests — CRUD, graph traversal, status transitions

---

## 8. Content Graph — `src/tree/content-graph/`

**Mục đích:** Track production lifecycle: **Project → Assets → Derivatives** với lineage queries cho performance attribution.

### Files
| File | Chức năng |
|------|-----------|
| `types.ts` | CRUD cho `ContentProject`, `ContentAsset`, `DerivativeAsset` + `getContentLineage(projectId)` + `getContentPerformance(projectId)` |

### Key API
```typescript
// Project
createProject(project: ContentProject): Promise<ContentProject>
listProjects(workspaceId: string, missionId?: string): Promise<ContentProject[]>

// Asset
createAsset(asset: ContentAsset): Promise<ContentAsset>
listAssets(projectId: string): Promise<ContentAsset[]>

// Derivative
createDerivative(derivative: DerivativeAsset): Promise<DerivativeAsset>
getDerivativesOf(assetId: string): Promise<DerivativeAsset[]>

// Lineage — full trace project → assets → derivatives → performance
getContentLineage(projectId: string): Promise<ContentLineage | null>
getContentPerformance(projectId: string): Promise<PerformanceEvent[]>
```

### Test Strategy
- `types.test.ts`: 22 tests — full CRUD, lineage queries, performance join

---

## 9. Experiment Engine — `src/forest/ab/` + `src/tree/performance/experiment.ts`

**Mục đích:** A/B testing framework cho content variants (thumbnail, caption, hook, CTA) với statistical significance gating.

### Files (Forest Layer - Orchestration)
| File | Chức năng |
|------|-----------|
| `ab-types.ts` | `ABExperiment`, `ABVariant` (contentType: `thumbnail\|caption\|hook\|cta`), `ABResult` |
| `experiment-store.ts` | CRUD cho `ab_experiments` D1 table + atomic increments |
| `winner-picker.ts` | Chi-square test + minimum sample size gate |
| `content-variant-generator.ts` | Generalized generator cho 4 contentType (BYOK OpenRouter + deterministic fallback) |
| `variant-generator.ts` | Original thumbnail-only generator (legacy) |
| `schedule.ts` | Inngest cron `*/2h` — automated lifecycle (start→collect→pick winner→promote) |
| `engine-bridge.ts` | Map `ab_experiments` → unified `Experiment` type cho unified reporting |

### Files (Tree Layer - Core Domain)
| File | Chức năng |
|------|-----------|
| `src/tree/performance/experiment.ts` | Unified `Experiment`, `ExperimentVariant`, `ExperimentResult` CRUD + status transitions |

### Key API
```typescript
// Forest: AB Experiment
createABExperiment(exp: ABExperiment): Promise<ABExperiment>
recordABVariantView(expId: string, variantId: string): Promise<void>
recordABVariantConversion(expId: string, variantId: string, valueCents?: number): Promise<void>
pickWinner(expId: string): Promise<ABVariant | null>  // chi-square + min sample

// Tree: Unified Experiment
createExperiment(exp: Experiment): Promise<Experiment>
updateExperimentStatus(id: string, status: ExperimentStatus): Promise<Experiment | null>
recordExperimentResult(result: ExperimentResult): Promise<ExperimentResult>
```

### Statistical Gates (winner-picker.ts)
- **Chi-square test**: p < 0.05
- **Minimum sample**: 100 views per variant
- **Minimum detectable effect**: 5% lift

### Test Strategy
- `winner-picker.test.ts`: 18 tests — chi-square math, sample size gates, edge cases
- `content-variant-generator.test.ts`: 14 tests — fixture `openrouter-variants.json`, all 4 contentTypes
- `schedule.test.ts`: 8 tests — cron timing, state transitions
- `experiment-store.test.ts`: 12 tests — atomic increments, CRUD

---

## 10. Performance Event Model — `src/tree/performance/events.ts`

**Mục đích:** Record performance events idempotent (views, likes, revenue, conversions) — `INSERT OR IGNORE` trên composite key.

### Files
| File | Chức năng |
|------|-----------|
| `events.ts` | `recordPerformanceEvent`, `getPerformanceEvents`, `aggregatePerformance` |

### Key API
```typescript
// Idempotent: key = (project_id, channel, event_type, recorded_at_day, asset_id?)
recordPerformanceEvent(event: PerformanceEventInput): Promise<PerformanceEvent>

getPerformanceEvents(filter: {
  projectId?: string;
  channel?: string;
  eventType?: string;
  from?: number;
  to?: number;
}): Promise<PerformanceEvent[]>

aggregatePerformance(projectId: string): Promise<{
  totalViews: number;
  totalEngagement: number;
  totalRevenueCents: number;
  byChannel: Record<string, { views: number; revenueCents: number }>;
}>
```

### Event Types
`view` | `like` | `comment` | `share` | `click` | `conversion` | `revenue`

### Test Strategy
- `events.test.ts`: 16 tests — idempotency, aggregation, filtering, composite key uniqueness

---

## 11. Creative Learning Primitives — `src/tree/creative-memory/` + `src/tree/learning/`

**Mục đích:** Long-term memory cho creative intelligence với decay, versioning, và learning loop tự động.

### Files
| File | Chức năng |
|------|-----------|
| `creative-memory/types.ts` | `CreativeMemory` (7 categories: `identity`, `creative`, `audience`, `performance`, `business`, `operational`, `provenance`) + CRUD với versioning |
| `creative-memory/creative-memory-store.ts` | Adapter `ICreativeMemoryStore` + `summarize()` — **deterministic token-bounded truncation** |
| `creative-memory/decay.ts` | **30-day half-life exponential decay**: `confidence * 0.5^(days/30)` |
| `learning/learning-loop.ts` | `runLearningLoop()` — analyzes `performance_events` + `experiment_results` → writes `CreativeMemory` + generates recommendations |

### Key API
```typescript
// Creative Memory
upsertCreativeMemory(workspaceId: string, memory: CreativeMemoryInput): Promise<CreativeMemory>
getCreativeMemory(workspaceId: string, category?: CreativeMemory['category']): Promise<CreativeMemory[]>
summarizeForContext(workspaceId: string, maxTokens: number): Promise<string>  // token-bounded

// Decay
applyDecay(memories: CreativeMemory[], now: number): CreativeMemory[]  // pure function

// Learning Loop (runs via Inngest cron)
runLearningLoop(workspaceId: string): Promise<LearningLoopResult>
// LearningLoopResult: { memoriesCreated, recommendations, insights }
```

### Decay Formula
```typescript
// 30-day half-life
confidence_t = confidence_0 * Math.pow(0.5, daysElapsed / 30)
// Minimum confidence floor: 0.05
```

### Learning Loop Pipeline
```
1. Pull recent performance_events (last 30 days)
2. Pull experiment_results (completed experiments)
3. For each content project:
   - Compute performance vs baseline
   - Extract winning patterns (hook, format, topic, timing)
   - Write to CreativeMemory (category: 'performance' | 'creative' | 'audience')
4. Generate actionable recommendations (top 5)
5. Return summary for dashboard
```

### Test Strategy
- `creative-memory-store.test.ts`: 14 tests — CRUD, versioning, summarize truncation
- `decay.test.ts`: 10 tests — half-life math, floor, edge cases
- `learning-loop.test.ts`: 12 tests — mocked DB, pattern extraction, recommendation generation

---

## Data Flow Diagram

```
┌─────────────────┐
│  MarketSignal   │  ← YouTube API, Google Trends RSS (BYOK / public)
│  (dedupe store) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Trend Intelligence │  ← market_signals + performance_events
│  (SES forecast)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│ ResearchArtifact │     │ CreativeConcept │
│  (versioned)     │────▶│  (LLM + fallback)│
└─────────────────┘     └────────┬────────┘
                                 │ promote
                                 ▼
                    ┌────────────────────────┐
                    │    Content Graph       │
                    │ Project → Asset → Deriv│
                    └───────────┬────────────┘
                                │
                                ▼
                    ┌────────────────────────┐
                    │ Performance Events     │
                    │ (idempotent recording) │
                    └───────────┬────────────┘
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
         ┌─────────────────┐     ┌─────────────────┐
         │  AB Experiment  │     │ Creative Memory │
         │ (statistical    │     │ (decay + version)│
         │  significance)  │     └────────┬────────┘
         └────────┬────────┘              │
                  │                       │
                  └───────────┬───────────┘
                              ▼
                   ┌─────────────────────┐
                   │  Learning Loop      │
                   │ (cron → insights →  │
                   │  CreativeMemory)    │
                   └─────────────────────┘
```

---

## Migrations (Phase 2)

| Migration | Tables | Purpose |
|-----------|--------|---------|
| `0243_performance_events.sql` | `performance_events` | Idempotent event recording |
| `0245_performance_events_indexes.sql` | indexes on `performance_events` | Query optimization |
| `0256_trend_detections.sql` | `trend_detections` | Trend intelligence output |

All migrations: **additive-only**, `IF NOT EXISTS`, no protected-table changes.

---

## Quality Gates (All Passed)

| Gate | Command | Result |
|------|---------|--------|
| Typecheck | `node --max-old-space-size=6144 node_modules/typescript/bin/tsc --noEmit` | ✅ 0 errors |
| Build | `npm run build` | ✅ exit 0 |
| Tests | `npx vitest --run` | ✅ 8393 passed (1 pre-existing C1 failure) |
| Lint | `npx eslint src --ext .ts,.tsx` | ✅ 11 errors / 335 warnings = frozen baseline |
| Zero `:any` | grep strict | ✅ 0 hits |
| Zero `console.*` | grep production | ✅ 0 hits |
| Canonical imports | grep banned paths | ✅ 0 hits |
| Suppression freeze | grep eslint-disable | ✅ 0 new |

---

## Related Documentation

- `docs/architecture/LEARNING_LOOP.md` — End-to-end learning loop specification
- `docs/architecture/IP_GRAPH.md` — IP graph detail
- `docs/architecture/CONTENT_GRAPH.md` — Content graph detail
- `docs/architecture/CREATIVE_MEMORY.md` — Creative memory detail
- `docs/architecture/PERFORMANCE_INTELLIGENCE.md` — Performance + experiment detail
- `docs/architecture/PROVENANCE.md` — Provenance bridge detail