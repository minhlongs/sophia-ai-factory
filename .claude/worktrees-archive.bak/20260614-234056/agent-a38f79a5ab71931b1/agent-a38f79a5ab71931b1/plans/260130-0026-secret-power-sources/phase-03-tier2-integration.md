# Phase 3: Tier 2 Integration (HIGH VALUE)

**Priority**: MEDIUM
**Status**: IN_PROGRESS
**Phase**: core

---

## Context Links

- Plan: `./plan.md`
- Script: `~/mekong-cli/scripts/power-source-syncer.sh`
- Tier 2 Sources: RAGFlow, Pathway, Agno, Pydantic AI, AgentFlow

---

## Overview

Integrate Tier 2 "High Value" power sources. These tools provide specific high-leverage capabilities: RAG, real-time data pipelines, multimodal agents, type safety, and workflow definition.

---

## Key Insights

- **RAGFlow**: Deep RAG capabilities (OCR, layout analysis) - critical for "reading" documentation.
- **Pathway**: Real-time data processing - essential for live "awareness".
- **Agno**: Multimodal agents - expands AgencyOS sensory input.
- **Pydantic AI**: Type-safe agent construction - ensures robustness.
- **AgentFlow**: Workflow orchestration - verify which implementation is the "canonical" one for our needs.

---

## Requirements

### Functional
- Verify/Update URLs for all Tier 2 sources.
- Sync Tier 2 sources using `power-source-syncer.sh`.
- Apply DNA transformation.
- Analyze capabilities.

### Non-Functional
- Maintain repo isolation.
- Ensure efficient cloning (shallow clones).

---

## Implementation Steps

### 1. Validate Sources
- `infiniflow/ragflow`: Likely correct.
- `pathwaycom/pathway`: Likely correct.
- `agno-agi/agno`: Likely correct.
- `pydantic/pydantic-ai`: Likely correct.
- `agentflow`: Need to identify the correct "AgentFlow". There are multiple (guangzhengli, Enigmatisms, etc.). We want the one that best aligns with "markdown workflows" or "agentic workflows".

### 2. Update Syncer Script
- Update `SOURCES_TIER2` array in `scripts/power-source-syncer.sh`.

### 3. Execute Sync
- Run `SYNC_TIER=2 ./scripts/power-source-syncer.sh`.

### 4. Analysis
- Generate `reports/tier2-analysis.md`.

---

## Todo List

- [ ] Validate AgentFlow URL
- [ ] Update `power-source-syncer.sh`
- [ ] Sync Tier 2
- [ ] Analyze Tier 2 capabilities
- [ ] Update Integration Log

---

## Success Criteria

- ✅ All 5 Tier 2 sources cloned.
- ✅ `AGENCYOS_DNA.md` present in all 5 repos.
- ✅ Analysis report created.

---

## Next Steps

- Execute Phase 4 (Tier 3 Integration)
