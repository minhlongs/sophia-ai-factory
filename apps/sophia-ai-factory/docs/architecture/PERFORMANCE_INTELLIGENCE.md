# Performance Intelligence Architecture

> **Layer**: tree  
> **Module**: `src/tree/performance/` (Phase 3 — in progress)  
> **Database Tables**: `performance_events`, `experiments`, `experiment_variants`, `experiment_results`

## Purpose

Performance Intelligence turns raw metrics into actionable creative decisions. It answers:
- Which content formats drive the highest engagement?
- Do CTAs in video descriptions increase click-through?
- What audience segments respond to which creative approaches?
- Which A/B test variant won, and why?

## Data Model

### PerformanceEvent
```
Workspace → Project → Asset → PerformanceEvent
```
Each event captures a metric snapshot at a point in time:
- `views`, `likes`, `shares`, `comments`, `clicks`, `conversions`
- `revenue` (direct + attributed)
- `cost` (generation cost for ROI calculation)
- `channel` (youtube, telegram, tiktok...)
- `audience_segment` (if known)

### Experiment
Structured A/B or multivariate tests:
- `hypothesis`: "CTA in first 3s increases CTR by 20%"
- `metric`: `ctr` | `conversion_rate` | `engagement_rate` | `revenue_per_view`
- `variants`: 2+ content variants with distinct parameters
- `status`: draft → running → completed → cancelled
- `results`: per-variant outcome data

## Learning Loop

```
RECORD performance event
    ↓
AGGREGATE by project/channel/audience
    ↓
DETECT patterns (which formats work)
    ↓
WRITE to CreativeMemory (recordLearning)
    ↓
NEXT mission reads memory → better creative decisions
    ↓
LOOP
```

## Key Metrics

| Metric | Formula | Use |
|---|---|---|
| CTR | clicks / views | Hook effectiveness |
| CVR | conversions / clicks | CTA effectiveness |
| ER | (likes+comments+shares) / views | Engagement quality |
| RPM | revenue / 1000 views | Monetization efficiency |
| Cost Ratio | generation_cost / revenue | ROI |
| Learning Velocity | memory_updates_per_mission | How fast we improve |

## Integration

- **Tree → Forest**: Performance events trigger Inngest jobs for aggregation
- **Forest → Land**: Aggregated metrics feed billing/quota decisions
- **Tree → Tree**: CreativeMemory.recordLearning() stores insights
- **Forest → Agent Protocol**: Agents query performance before content generation

## See Also

- `src/seed/types/creative-domain.ts` — Experiment, PerformanceEvent types
- `src/tree/creative-memory/` — Where learning is stored
- `CREATIVE_MEMORY.md` — Memory architecture