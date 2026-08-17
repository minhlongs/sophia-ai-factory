# Data Flywheel — Creative Economy Learning Loop

> **Status**: Design + partial implementation  
> **Core principle**: Every output feeds the next input

## The Flywheel

```
VISION (human-defined mission)
  ↓
CREATE (AI produces content, tracked via Content Graph)
  ↓
DISTRIBUTE (multi-channel posting, tracked via DistributionAsset)
  ↓
MEASURE (PerformanceEvent captures metrics)
  ↓
LEARN (recordLearning → CreativeMemory)
  ↓
COMPOUND (next mission reads memory → better creative decisions)
  ↓
[loops back to VISION with accumulated intelligence]
```

## Why It's a Flywheel (Not a Pipeline)

A pipeline is one-way: create → done.  
A flywheel compounds: each revolution makes the next faster/better.

**Compound effects:**
1. **Creative Memory** grows with every mission → better content decisions
2. **Provenance chains** get longer → richer audit trails, better IP tracking
3. **Performance patterns** accumulate → higher CTR/CVR over time
4. **Agent learning** improves → fewer human interventions needed

## Data Ownership per Layer

| Data | Owner Layer | Why |
|---|---|---|
| Mission objectives, brand identity | land (business) | Customer-defined business context |
| Content graph (projects/assets) | tree (domain) | Creative production core |
| Performance metrics | tree (domain) | Raw measurement data |
| Creative memory (learnings) | tree (domain) | Versioned knowledge |
| Agent execution logs | forest (infra) | Runtime/operational |
| Billing/quota usage | land (business) | Financial tracking |
| Provenance chains | tree (domain) | Audit/compliance |

## Flywheel Metrics

Track these to measure flywheel health:

| Metric | Target | Current (est.) |
|---|---|---|
| Memory entries per mission | >5 | ~2 |
| Performance events per asset | >10 | ~3 |
| Agent autonomy level | Level 3+ by mission 5 | Level 2 |
| Human interventions per mission | <2 | ~4 |
| Creative reuse rate | >30% | ~10% |
| Learning velocity (memory updates/week) | >20 | ~8 |

## Anti-Patterns to Avoid

- ❌ **Content spam**: Maximizing video count instead of economic output per creative unit
- ❌ **Memory hoarding**: Storing everything without curation (degrade signal)
- ❌ **Metric gaming**: Optimizing for vanity metrics (views) over business metrics (revenue)
- ❌ **Black box AI**: Agents making decisions without traceable provenance
- ❌ **Disconnected systems**: Performance data not feeding back into creative decisions

## Integration Checklist

Every new feature must answer:
1. Does it produce data that feeds Creative Memory?
2. Does it record provenance?
3. Does it generate PerformanceEvents?
4. Does it enable higher autonomy levels over time?

If the answer is "no" to all four → it's not part of the flywheel. Rethink.

## See Also

- `CREATIVE_MEMORY.md` — Memory layer
- `PERFORMANCE_INTELLIGENCE.md` — Metrics layer
- `PROVENANCE.md` — Audit layer
- `AGENT_PROTOCOL.md` — Execution layer
- `SOPHIA_2027_CONSTITUTION.md` — Product thesis