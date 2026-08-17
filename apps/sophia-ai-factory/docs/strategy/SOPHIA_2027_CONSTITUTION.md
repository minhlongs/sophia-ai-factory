# Sophia 2027 Constitution

> **Version**: 1.0  
> **Effective**: 2026-08-17  
> **Codename**: Creative Economy OS  

---

## Mission

Transform Sophia from an AI Video Factory into an Autonomous Creative Economy OS that enables human creators, founders, agencies, studios, and brands to define creative/business objectives and have Sophia coordinate the entire lifecycle: Vision → Market Intelligence → Creative Strategy → IP/Story → Content Production → Quality/Provenance → Distribution → Audience → Monetization → Performance → Learning → Creative Memory → Next Iteration.

## Product Identity

### Sophia IS
- Creative Intelligence — strategic understanding of markets, audiences, trends
- Creative Memory — persistent, versioned knowledge that compounds
- IP Intelligence — character, brand, theme, universe management
- Content Orchestration — coordinated production across formats and channels
- Distribution Intelligence — smart multi-platform publishing
- Performance Learning — A/B testing, metrics, optimization
- Creative Provenance — full audit trail for all generated content
- Creative Commerce — monetization per creative unit
- Human-in-the-loop Creative Control — approval gates, autonomy levels, rollback

### Sophia IS NOT
- A video generator
- An avatar generator
- A prompt library
- A generic chatbot
- An AI slop factory
- A generic agent platform
- A clone of Mekong
- A model wrapper

### Non-Goals
- Consumer social media platform
- Generic AI chat interface
- Developer-focused API platform
- Model training or fine-tuning service
- Content moderation service

---

## North Star

**Metric**: Creative Leverage  
**Definition**: Economic output per creative unit  
**Target**: 10x improvement from 2026 baseline  

Current: Human spends 10 hours → 1 video → $100  
Target: Human defines objective → 10 optimized videos → human approves → $1000  

Every architectural decision must be evaluated against: "Does this increase creative leverage or just content volume?"

---

## Creative Economy Thesis

### The Flywheel

```
VISION (human-defined mission)
  ↓
CREATE (AI produces content, tracked via Content Graph)
  ↓
DISTRIBUTE (multi-channel posting)
  ↓
MEASURE (PerformanceEvent captures metrics)
  ↓
LEARN (recordLearning → CreativeMemory)
  ↓
COMPOUND (next mission reads memory → better decisions)
  ↓
[loops back to VISION]
```

### Why It's a Flywheel (Not a Pipeline)

A pipeline is one-way: create → done.  
A flywheel compounds: each revolution makes the next faster/better.

**Compound effects:**
1. Creative Memory grows with every mission → better content decisions
2. Provenance chains lengthen → richer audits
3. Performance patterns accumulate → higher CTR/CVR
4. Agent learning improves → fewer human interventions

---

## Human Creative Ownership

Every autonomous action must have:
- **Permission**: Defined scope (tool, maxCostCents, requiresApproval)
- **Scope**: Workspace/brand/mission boundaries
- **Audit trail**: ProvenanceRecord (append-only, immutable)
- **Rollback path**: RollbackPlan defined before execution
- **Approval level**: 0-4 autonomy scale

### 5 Autonomy Levels

| Level | Name | Auto-Approve Cost | Can Execute |
|---|---|---|---|
| 0 | OBSERVE_ONLY | 0 cents | No |
| 1 | SUGGEST | 0 cents | No |
| 2 | EXECUTE_SAFE | 500 cents | Yes (safe actions) |
| 3 | EXECUTE_BROAD | 2000 cents | Yes (medium cost) |
| 4 | FULL_AUTONOMY | ∞ | Yes (all, with policy) |

---

## Architecture Pillars

### 1. Creative Economy Domain Model

All entities defined in `src/seed/types/creative-domain.ts`:
- Creator, Workspace, Brand, CreativeIdentity
- CreativeGoal, MarketSignal, CreativeConcept
- Story, IP, ContentProject, ContentAsset, DerivativeAsset
- DistributionPlan, DistributionAsset, PerformanceEvent, RevenueEvent
- AgentDefinition, AgentContext, AgentDecision, AgentAction, AgentResult
- ProvenanceRecord, Experiment, ModelCapability, CostPolicy, ModelPolicy

### 2. 4-Layer Architecture

```
seed → tree → forest → land
```

Import direction strictly enforced. No reverse imports.

### 3. Creative Memory (7 Categories)

1. **identity** — brand voice, visual style, tone
2. **creative** — content formulas, formats that work
3. **audience** — persona data, engagement patterns
4. **performance** — metrics benchmarks, CVR trends
5. **business** — revenue models, pricing experiments
6. **operational** — process learnings, tool preferences
7. **provenance** — approval patterns, edit history

### 4. Provenance (Append-Only Audit Trail)

Every generated/derived asset has immutable ProvenanceRecord.

### 5. IP Graph

Hierarchical: universe → world → series → character → theme → brand

### 6. Content Graph

Mission → ContentProject → ContentAsset → DerivativeAsset

### 7. Distribution OS

Provider-agnostic channel abstraction via adapter pattern.

### 8. Performance Intelligence

A/B testing framework + metric aggregation + ROI tracking.

---

## Technical Principles

1. **Solo-founder operable** — Minimize operational complexity
2. **Cloudflare-native** — D1, R2, Workers, no external infra
3. **Model-agnostic** — No hardcoded AI models as permanent intelligence
4. **Provider-agnostic** — Customer owns all API credentials (BYOK)
5. **No-code for customers** — All integrations via Setup Wizard
6. **Platform-only for operator** — No operator credentials required for production
7. **Result<T,E> pattern** — No throws in business logic
8. **Circuit breaker** — All external HTTP calls
9. **Bilingual** — Vietnamese primary, English secondary (all customer-facing)
10. **Test-first** — 6700+ tests, zero tolerance for regressions

---

## Mekong Boundary

Mekong is the horizontal agent/control-plane layer. Sophia is the vertical Creative Economy application.

- Sophia MAY call Mekong through public interfaces only
- Sophia MUST NOT import Mekong internals
- Buzz remains autonomy/execution layer, not another app-specific framework

See `docs/architecture/MEKONG_BOUNDARY.md` and `docs/architecture/BUZZ_BOUNDARY.md`.

---

## Security & Privacy

- All API inputs: Zod validation
- All secrets: Environment variables + encryption (never in code)
- All external calls: Circuit breaker with failure kind classification
- All agent actions: Permission check + cost tracking + provenance
- All financial operations: Atomic lock pattern (D1 has no transactions)

---

## 2027 KPIs

| KPI | Target | Measurement |
|---|---|---|
| Creative Leverage | 10x | Revenue / human-hours |
| Autonomy Level | 4.0 average | Per mission |
| Learning Velocity | 20/week | Memory updates |
| Agent Interventions | <2/mission | Human approvals |
| Content Reuse | >30% | Derivatives / total |
| Economic Output | $10k/workspace/month | Revenue / workspace |

---

## Amendment Process

1. Propose change via GitHub issue with `constitution-amendment` label
2. Kongming agent reviews for alignment with North Star
3. Suntzu agent reviews for architectural consistency
4. User approval required
5. Update this file + affected architecture docs
6. Version bump (semantic)

---

## See Also

- `docs/roadmap/SOPHIA_2027_ROADMAP.md` — Phase breakdown
- `docs/architecture/` — Architecture deep dives
- `docs/architecture/REPO_RECONNAISSANCE_2026-08-17.md` — Current state
- `.claude/rules/sophia-layer-architecture.md` — Layer rules
- `.claude/rules/cross-layer-orchestration.md` — Orchestration rules
- `.claude/rules/sophia-no-tech-doctrine.md` — BYOK doctrine