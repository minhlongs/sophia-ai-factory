# Feature Comparison: OpenMontage → Sophia AI Factory

**Source:** calesthio/OpenMontage — agentic video production system (Python)
**Local:** sophia-ai-factory — RaaS platform (Next.js 16 + CF Workers + D1)
**Mode:** `--compare` — architectural analysis, no implementation plan

---

## Source Anatomy

OpenMontage là Python pipeline orchestrator cho video production. Core patterns:

| Pattern | Location | Purpose |
|---------|----------|---------|
| Pipeline manifest (YAML) | `pipeline_defs/*.yaml` | Define stages, dependencies, quality gates |
| BaseTool + Registry | `tools/base_tool.py`, `tools/tool_registry.py` | Capability discovery, provider routing, cost estimation |
| Checkpoint | `lib/checkpoint.py` | Stage-level state persistence + resume |
| Delivery Promise | `lib/delivery_promise.py` | Lock production type early, prevent silent downgrades |
| Provider Scoring | `lib/scoring.py` | Weighted multi-dimensional provider selection |
| Cost Tracker | `tools/cost_tracker.py` | Budget enforcement with approval gates |
| Style Playbooks | `styles/*.yaml` | Visual language definitions (validated via JSON schema) |
| 3-Layer Skills | `skills/{core,creative,meta,pipelines}/` | Tool → convention → API knowledge |

Pipeline flow: `research → proposal → idea → script → scene_plan → assets → edit → compose → publish`

---

## Head-to-Head Comparison

| Aspect | OpenMontage | Sophia AI Factory | Gap |
|--------|-------------|-------------------|-----|
| **Orchestration** | Python pipeline (YAML manifest → stage execution) | D1 + Cron stepper (missions table) | Sophia có serial execution nhưng thiếu stage-level checkpoint |
| **State persistence** | JSON checkpoint per stage, resume support | D1 missions table (status: queued/running/completed) | Sophia có status tracking nhưng không có artifact persistence |
| **Provider selection** | Weighted scoring (task_fit, quality, cost, latency) | Static tier config (`@/seed/config/tiers`) | Sophia hardcodes tiers; OpenMontage dynamic scores |
| **Budget control** | Cost tracker + approval gates per action | No budget enforcement | Sophia thiếu cost tracking cho AI API calls |
| **Quality gates** | Per-stage director skills + send-back loops | Build/test gates only | Sophia không có per-feature quality gates |
| **Style/config** | YAML playbooks (validated via JSON schema) | Hardcoded config | Sophia hardcodes; OpenMontage declarative |
| **Tool discovery** | Auto-discovery via registry + capability catalog | Manual imports | Sophia không có tool registry pattern |
| **Delivery contract** | PromiseType enum locked at proposal stage | No equivalent | Sophia thiếu "lock requirements early" pattern |

---

## Decision Matrix

| Decision | OpenMontage's way | Sophia's way | Recommendation |
|----------|-------------------|--------------|----------------|
| **Checkpoint** | JSON files per stage | D1 missions table | **Adapt** — add artifact column to missions, keep D1 storage |
| **Provider scoring** | Weighted 7-dimension score | Static tier enum | **Port concept** — add `provider_score` to tier config for AI service selection |
| **Cost tracking** | Per-action budget + approval | None | **New** — add cost tracker to forest layer (usage metering already exists) |
| **Style playbooks** | YAML + JSON schema validation | Hardcoded | **Adapt** — move video style configs to YAML, validate via Zod |
| **Tool registry** | Auto-discovery + capability catalog | Manual imports | **Skip** — Sophia's import discipline (4-layer) is stricter than registry pattern |
| **Delivery promise** | PromiseType enum locked at proposal | No equivalent | **Port** — lock RaaS delivery type at org creation, prevent silent downgrades |

---

## Port Candidates (Priority Order)

### 1. Checkpoint/Resume Pattern (HIGH value, LOW effort)
**Why:** Sophia's supervisor agent runs 3-step workflows (plan → execute → test) but has no artifact persistence. If a step fails, the agent re-runs from scratch.
**What to port:** `lib/checkpoint.py` pattern — stage artifacts stored as JSON, resume from last checkpoint.
**Adaptation:** Store artifacts in D1 `missions.params` column (already exists as JSON). Add `artifact_name` field to CANONICAL_STAGE_ARTIFACTS mapping.
**Risk:** Low — D1 already handles JSON, no schema change needed.

### 2. Delivery Promise Pattern (HIGH value, LOW effort)
**Why:** Sophia's RaaS customers can silently downgrade (e.g., from motion-led video to slideshow) without knowing. OpenMontage's `PromiseType` prevents this.
**What to port:** `lib/delivery_promise.py` — enum + rules matrix, locked at proposal stage.
**Adaptation:** Map to Sophia's tier system. Lock `delivery_type` at org creation in D1 `orgs` table. Compose stage checks promise before rendering.
**Risk:** Low — adds one column + validation logic.

### 3. Provider Scoring (MEDIUM value, MEDIUM effort)
**Why:** Sophia selects AI providers (OpenRouter, ElevenLabs, D-ID) statically. OpenMontage's weighted scoring picks the best provider per task context.
**What to port:** `lib/scoring.py` — `ProviderScore` dataclass with 7 weighted dimensions.
**Adaptation:** Replace static tier config with scored provider selection for AI services. Keep tier enum for billing.
**Risk:** Medium — changes provider selection logic, needs testing.

### 4. Cost Tracker (MEDIUM value, MEDIUM effort)
**Why:** Sophia has no budget enforcement. Customers can rack up API costs without warning.
**What to port:** `tools/cost_tracker.py` — per-action cost estimation + approval gates.
**Adaptation:** Integrate with existing usage metering (forest/usage-metering). Add budget warnings to BYOK store.
**Risk:** Medium — requires API cost data for each provider.

### 5. Style Playbooks (LOW value, LOW effort)
**Why:** Sophia's video output has no declarative style system.
**What to port:** `styles/*.yaml` + `schemas/styles/playbook.schema.json`.
**Adaptation:** YAML → Zod-validated config, stored in D1 or KV.
**Risk:** Low — purely additive.

---

## What NOT to Port

| Pattern | Reason |
|---------|--------|
| **Tool Registry** | Sophia's 4-layer import discipline is stricter and more maintainable than auto-discovery |
| **Pipeline YAML manifests** | Sophia uses D1 + Cron, not YAML-driven execution. Adding YAML would be over-engineering |
| **3-Layer Skills architecture** | Sophia already has `.claude/skills/` + `.sophia-factory/agents/` — different pattern, not compatible |
| **FFmpeg/Remotion composition** | Sophia uses Remotion already (in `services/`), OpenMontage's FFmpeg layer is redundant |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Stack mismatch (Python → TS) | Medium | Low | Patterns are language-agnostic (checkpoint, promise, scoring) |
| Over-engineering | Medium | Medium | YAGNI — port only checkpoint + promise first |
| D1 schema changes | Low | High | Use existing JSON columns, no migrations needed |
| Breaking existing workflows | Low | High | All ports are additive, no breaking changes |

---

## Recommendation

**Port #1 (Checkpoint) + #2 (Delivery Promise) first.** Both are:
- Additive (no breaking changes)
- Low effort (~2-4h each)
- High value for Sophia's RaaS context
- Align with existing D1 schema

Defer #3-#5 until after T002 (agent orchestration upgrade) completes — those patterns need the checkpoint foundation first.

---

## Unresolved Questions

1. Should `delivery_promise` lock at org creation or at first campaign creation?
2. Should checkpoint artifacts be in `missions.params` or a new `workflow_artifacts` table?
3. Provider scoring — should it replace or augment existing tier config?
