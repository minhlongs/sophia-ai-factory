# SOPHIA 2027 Learning Loop Architecture

> **Layer:** `tree/learning` + `tree/creative-memory` + `forest/ab` + `forest/provenance`
>
> **Phase:** 2 — Creative Intelligence (first end-to-end loop)

---

## Overview (Tổng quan)

**Learning Loop** là vòng lặp tự động chuyển dữ liệu performance → insights → memory → recommendations. Nó chạy định kỳ (Inngest cron) và là **trái tim** của creative intelligence — cho phép hệ thống **càng chạy càng thông minh**.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        LEARNING LOOP PIPELINE                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────┐    ┌──────────────────┐    ┌─────────────────────┐  │
│  │ Performance  │    │   Analyze &      │    │  Creative Memory    │  │
│  │   Events     │───▶│   Extract        │───▶│  (decay + version)  │  │
│  │ + Experiments│    │   Patterns       │    │                     │  │
│  └──────────────┘    └──────────────────┘    └──────────┬──────────┘  │
│                                                          │             │
│                                                          ▼             │
│                                               ┌─────────────────────┐  │
│                                               │  Recommendations    │  │
│                                               │  (top 5 actionable) │  │
│                                               └─────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Chạy bởi:** Inngest function `learning-loop-cron` (schedule: `0 */6 * * *` — every 6 hours)

---

## Core Components

### 1. Creative Memory — `src/tree/creative-memory/`

Long-term memory store với 7 categories, versioning, và decay.

#### Categories (7 loại)
| Category | Mô tả | Ví dụ |
|----------|-------|-------|
| `identity` | Brand voice, values, visual DNA | "Tone: witty, educational, Vietnamese-first" |
| `creative` | Winning hooks, formats, structures | "Hook: '3 mistakes...' works for tech tutorials" |
| `audience` | Demographics, interests, behavior | "Core audience: 25-34, devs, VN + US" |
| `performance` | Benchmarks, KPIs, channel metrics | "Avg view velocity: 1.2k/hr first 24h" |
| `business` | Revenue patterns, conversion funnels | "Sponsorship CPM: $12-18 for tech niche" |
| `operational` | Production costs, timelines, team velocity | "Avg edit time: 4.2h per 10min video" |
| `provenance` | Source traceability, experiment lineage | "Insight from exp_abc123 (thumbnail A/B)" |

#### Versioning & Immutability
- Mỗi `upsertCreativeMemory` tạo **version mới** (auto-increment)
- Version cũ **không bao giờ xóa** — audit trail đầy đủ
- `getCreativeMemory` trả về latest version by default, có param `version` để query history

#### Decay (30-day half-life)
```typescript
// Pure function: src/tree/creative-memory/decay.ts
function applyDecay(memories: CreativeMemory[], now: number): CreativeMemory[]

// Formula: confidence_t = confidence_0 * 0.5^(daysElapsed / 30)
// Floor: 0.05 (5%) — memory never fully disappears
```

**Tại sao 30-day?**
- Creative trends move fast — 30 ngày = 1 chu kỳ trend điển hình
- Half-life exponential = smooth decay, không cliff edge
- Floor 5% = institutional knowledge vẫn usable cho context

### 2. Learning Loop — `src/tree/learning/learning-loop.ts`

Main orchestration function: `runLearningLoop(workspaceId: string)`.

#### Pipeline Steps

```typescript
async function runLearningLoop(workspaceId: string): Promise<LearningLoopResult> {
  // 1. FETCH: Recent performance events (30 days)
  const events = await getPerformanceEvents({
    workspaceId,
    from: now - 30 * 24 * 60 * 60 * 1000,
  });

  // 2. FETCH: Completed experiment results
  const experiments = await getCompletedExperiments(workspaceId);

  // 3. GROUP: By content project
  const byProject = groupByProject(events, experiments);

  // 4. ANALYZE: Each project → extract patterns
  const insights: CreativeMemoryInput[] = [];
  for (const [projectId, data] of byProject) {
    const projectInsights = analyzeProject(projectId, data.events, data.experiments);
    insights.push(...projectInsights);
  }

  // 5. WRITE: Upsert to CreativeMemory (with provenance)
  const memories = await Promise.all(
    insights.map(i => upsertCreativeMemory(workspaceId, {
      ...i,
      provenance: { source: 'learning_loop', experimentIds: i.experimentIds }
    }))
  );

  // 6. GENERATE: Top 5 recommendations
  const recommendations = generateRecommendations(memories, events);

  return { memoriesCreated: memories.length, recommendations, insights: memories };
}
```

#### Pattern Extraction Logic (analyzeProject)

| Pattern Type | Detection Method | Output Category |
|--------------|------------------|-----------------|
| **Winning Hook** | Top-performing asset's first 3s script segment | `creative` |
| **Optimal Format** | Format (short/long/live) với highest engagement rate | `creative` |
| **Topic Cluster** | Topics (from trend_detections) correlating with high views | `audience` |
| **Posting Time** | Hour-of-day/day-of-week với best velocity | `operational` |
| **Thumbnail Style** | AB experiment winner (chi-square p<0.05) | `creative` |
| **CTA Variant** | AB experiment winner (conversion rate) | `business` |
| **Cost Efficiency** | actualCostCents / views ratio vs baseline | `operational` |

#### Recommendation Generation

```typescript
function generateRecommendations(memories: CreativeMemory[], events: PerformanceEvent[]): Recommendation[] {
  // Score each memory by: confidence * recency * impact
  // Return top 5 với actionable format:
  return [
    { type: 'content', title: 'Use "3 mistakes" hook for tutorials', confidence: 0.87, action: 'apply_to_next_script' },
    { type: 'schedule', title: 'Post at 19:00 ICT on Tuesdays', confidence: 0.72, action: 'update_schedule' },
    { type: 'format', title: 'Short-form (<60s) outperforms long-form 2.3x', confidence: 0.91, action: 'shift_format' },
    { type: 'thumbnail', title: 'Face + text overlay wins 68% vs brand-only', confidence: 0.83, action: 'update_thumbnail_template' },
    { type: 'budget', title: 'Reduce edit time by using template X', confidence: 0.65, action: 'optimize_workflow' },
  ];
}
```

### 3. AB Experiment Integration — `src/forest/ab/`

Experiments feed learning loop với **statistically significant** results.

#### Winner Picker Gates (Chi-square + Sample Size)
```typescript
// src/forest/ab/winner-picker.ts
function pickWinner(expId: string): Promise<ABVariant | null> {
  // Gate 1: Minimum 100 views per variant
  // Gate 2: Chi-square p < 0.05
  // Gate 3: Minimum detectable effect 5% lift
}
```

Chỉ winner qua gates mới ghi vào CreativeMemory (provenance = experiment ID).

### 4. Provenance Bridge — `src/forest/provenance/provenance-bridge.ts`

Inngest function bridging **agent runs** → `provenance_records` + **CreativeMemory learning**.

```typescript
// Triggered by: agent_run.completed event
// Writes: provenance_records (full trace) + CreativeMemory (extracted insights)
```

**Flow:**
```
agent_run.completed
      │
      ▼
provenance-bridge.ts (Inngest step)
      │
      ├──▶ provenance_records table (immutable audit log)
      │
      └──▶ CreativeMemory upsert (category: 'provenance', versioned)
```

---

## Scheduling & Orchestration

| Component | Schedule | Trigger | Owner |
|-----------|----------|---------|-------|
| `learning-loop-cron` | `0 */6 * * *` (6h) | Time | `forest/inngest/functions/learning-loop-cron.ts` |
| `ab-schedule` | `*/2 * * * *` (2h) | Time | `forest/ab/schedule.ts` |
| `provenance-bridge` | Event-driven | `agent_run.completed` | `forest/provenance/provenance-bridge.ts` |
| `approval-timeout-cron` | `*/15 * * * *` | Time | `forest/inngest/functions/approval-timeout-cron.ts` |

**Tại sao 6h cho learning loop?**
- Cần đủ performance events accumulate (min ~100 views/project)
- 6h = 4 runs/ngày = balance giữa freshness và signal quality
- Có thể tune per workspace sau (future: adaptive schedule)

---

## Data Models

### LearningLoopResult
```typescript
interface LearningLoopResult {
  memoriesCreated: number;        // số CreativeMemory records mới/cập nhật
  recommendations: Recommendation[]; // top 5 actionable
  insights: CreativeMemory[];     // full memory records created
  workspaceId: string;
  runAt: number;                  // unix timestamp
}
```

### Recommendation
```typescript
interface Recommendation {
  type: 'content' | 'schedule' | 'format' | 'thumbnail' | 'budget' | 'audience';
  title: string;                  // human-readable (bilingual ready)
  confidence: number;             // 0-1 (post-decay)
  action: string;                 // machine-actionable key
  metadata?: Record<string, unknown>;
}
```

### CreativeMemory (core)
```typescript
interface CreativeMemory {
  id: string;                     // mem_<uuid>
  workspaceId: string;
  category: 'identity' | 'creative' | 'audience' | 'performance' | 'business' | 'operational' | 'provenance';
  content: string;                // natural language insight
  confidence: number;             // 0-1 (decayed at read time)
  version: number;                // auto-increment
  provenance: {
    source: 'learning_loop' | 'provenance_bridge' | 'manual';
    experimentIds?: string[];
    projectIds?: string[];
    agentRunIds?: string[];
  };
  createdAt: number;
  updatedAt: number;
}
```

---

## Querying Learning Output (Dashboard API)

### GET `/api/learning/insights?workspaceId=<id>&category=<cat>`
```json
{
  "memories": [
    { "id": "mem_abc", "category": "creative", "content": "Hook '3 mistakes' drives 2.3x retention", "confidence": 0.87, "version": 3, "provenance": {...}, "createdAt": 1724000000 }
  ],
  "recommendations": [
    { "type": "content", "title": "Use '3 mistakes' hook for tutorials", "confidence": 0.87, "action": "apply_to_next_script" }
  ],
  "lastRunAt": 1724000000
}
```

### GET `/api/learning/summary?workspaceId=<id>&maxTokens=2000`
Returns **token-bounded context summary** for LLM prompting (via `CreativeMemoryStore.summarize()`).

```json
{
  "summary": "## Creative Identity\nTone: witty, educational, Vietnamese-first\n\n## Winning Patterns\n- Hook '3 mistakes...' works for tech tutorials (confidence 0.87)\n- Short-form <60s outperforms long-form 2.3x (confidence 0.91)\n- Post at 19:00 ICT Tuesdays (confidence 0.72)\n\n## Audience\nCore: 25-34 devs, VN+US\n\n## Performance Benchmarks\nAvg view velocity: 1.2k/hr first 24h\nSponsorship CPM: $12-18",
  "tokenCount": 1847,
  "truncated": false
}
```

---

## End-to-End Example Trace

**Scenario:** User tạo campaign "TypeScript Tips Series"

```
1. MARKET SIGNAL
   ├─ YouTube API: "TypeScript tutorial" search → 15 signals (deduped)
   └─ Google Trends: "TypeScript" rising → 3 signals

2. TREND DETECTION
   ├─ Group by (channel=youtube, topic=typescript)
   ├─ Momentum score: 0.82 (velocity + acceleration)
   └─ SES forecast: +15% views next 7 days (CI: +8% to +22%)

3. RESEARCH ARTIFACT
   └─ Create "topic_brief" v1: "TypeScript trending, focus on beginner mistakes"

4. CREATIVE CONCEPT
   ├─ LLM generates: hook="3 TypeScript mistakes that cost you hours"
   ├─ Beats: [intro, mistake1, mistake2, mistake3, summary]
   └─ Promote → ContentProject "TS-Tips-Ep1"

5. CONTENT GRAPH
   ├─ Project: TS-Tips-Ep1
   ├─ Asset: video_final.mp4 (ast_xyz)
   └─ Derivative: thumbnail_v1.jpg, short_clip_1.mp4

6. PERFORMANCE EVENTS (first 24h)
   ├─ view: 1,247 (YouTube)
   ├─ like: 89
   ├─ comment: 12
   └─ revenue: $0 (not monetized yet)

7. AB EXPERIMENT (thumbnail)
   ├─ Variant A: Face + "3 MISTAKES" text
   ├─ Variant B: Code screenshot only
   ├─ After 2h: A=340 views, B=180 views
   ├─ Chi-square p=0.012, lift=89% → WINNER: A
   └─ Write CreativeMemory (creative, confidence 0.83, provenance=exp_abc)

8. LEARNING LOOP (next 6h cron run)
   ├─ Pull events + experiment results
   ├─ Analyze: "Face+text thumbnail wins", "Mistake hook works"
   ├─ Write 2 CreativeMemory records (creative, performance)
   ├─ Generate recommendations: [use face+text, use mistake hook, post Tue 19:00]
   └─ Dashboard shows insights + recommendations
```

---

## Configuration

### Environment Variables (Customer BYOK — Setup Wizard)
| Variable | Required | Description |
|----------|----------|-------------|
| `OPENROUTER_API_KEY` | Yes | LLM cho concept generation, variant generation |
| `YOUTUBE_OAUTH_TOKEN` | Yes | YouTube Data API cho MarketSignal |
| `ELEVENLABS_API_KEY` | No | TTS cho asset generation (Phase 3+) |
| `DID_API_KEY` | No | Avatar video (Phase 3+) |

### Feature Flags (Tier-gated)
| Feature | BASIC | PREMIUM | ENTERPRISE | MASTER |
|---------|-------|---------|------------|--------|
| MarketSignal (YouTube) | ✅ | ✅ | ✅ | ✅ |
| MarketSignal (RSS) | ✅ | ✅ | ✅ | ✅ |
| Trend Intelligence | ❌ | ✅ | ✅ | ✅ |
| ResearchArtifact | ❌ | ✅ | ✅ | ✅ |
| CreativeConcept Gen | ❌ | 3/mo | Unlimited | Unlimited |
| IP Graph | ❌ | ✅ | ✅ | ✅ |
| Content Graph | ✅ | ✅ | ✅ | ✅ |
| AB Experiment | ❌ | 2 concurrent | 10 concurrent | Unlimited |
| Performance Events | ✅ | ✅ | ✅ | ✅ |
| Creative Memory | ❌ | 100 records | 1000 records | Unlimited |
| Learning Loop | ❌ | Manual | Auto (6h) | Auto (adaptive) |

---

## Testing Strategy

### Unit Tests (Deterministic Fixtures)
| File | Tests | Fixtures |
|------|-------|----------|
| `creative-memory-store.test.ts` | 14 | In-memory D1 mock |
| `decay.test.ts` | 10 | Pure function inputs |
| `learning-loop.test.ts` | 12 | Mocked DB, fixed timestamps |
| `events.test.ts` | 16 | Idempotency scenarios |
| `experiment.test.ts` | 18 | Status transitions |
| `winner-picker.test.ts` | 18 | Chi-square math, edge cases |

### Integration Tests
- `learning-loop.integration.test.ts`: Full pipeline với test D1 (requires `DATABASE_URL`)
- `ab-schedule.integration.test.ts`: Cron simulation với Inngest test helper

### Fixture Files (No Live API Calls)
```
src/tree/market-signals/__fixtures__/
  youtube-search-response.json
  youtube-video-details.json
  google-trends-rss.xml

src/tree/creative-concept/__fixtures__/
  openrouter-concept-response.json

src/forest/ab/__fixtures__/
  openrouter-variants.json
```

---

## Quality Gates (Verified 2026-08-27)

| Gate | Result |
|------|--------|
| Typecheck | ✅ 0 errors |
| Build | ✅ exit 0 |
| Tests | ✅ 8393 passed (1 pre-existing C1 failure unrelated) |
| Lint | ✅ 11/335 = frozen baseline |
| Zero `:any` | ✅ 0 |
| Zero `console.*` | ✅ 0 |
| Canonical imports | ✅ 0 banned |
| Suppression freeze | ✅ 0 new |

---

## Related Documentation

- `docs/architecture/CREATIVE_INTELLIGENCE.md` — 11 components overview
- `docs/architecture/CREATIVE_MEMORY.md` — Memory detail
- `docs/architecture/PERFORMANCE_INTELLIGENCE.md` — Performance + AB detail
- `docs/architecture/PROVENANCE.md` — Provenance bridge detail
- `docs/architecture/IP_GRAPH.md` — IP graph detail
- `docs/architecture/CONTENT_GRAPH.md` — Content graph detail

---

## Next Phase (Phase 3+)

| Feature | Status | Dependency |
|---------|--------|------------|
| Autonomous publishing (schedule → publish) | Planned | Phase 3 production graph |
| Adaptive learning schedule | Planned | Phase 3 monitoring |
| Cross-workspace learning (anonymized) | Research | Privacy review |
| Revenue attribution to creative patterns | Planned | Phase 4 commerce |
| Multi-language content adaptation | Planned | Phase 4 distribution |