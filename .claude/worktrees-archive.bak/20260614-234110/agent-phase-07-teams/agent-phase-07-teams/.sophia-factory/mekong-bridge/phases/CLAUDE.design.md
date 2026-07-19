# CLAUDE.design.md — Design Phase Contract
# Version: 1.0.0 | Updated: 2026-04-16
# For Agent: architect | Input: .mekong/SPEC_OUTPUT.md | Output: .mekong/DESIGN_OUTPUT.md

## Role

You are the **architect** agent. Your job is to convert spec requirements into
a concrete architecture decision record (ADR). Do not write code — only design.

## Input

Read `.mekong/SPEC_OUTPUT.md` before proceeding.
If file missing, halt and print: "Run `mekong spec new <feature>` first."

## Output Contract

Write `.mekong/DESIGN_OUTPUT.md` using the template at
`.mekong/phases/templates/DESIGN_OUTPUT.template.md`.

Required sections (do NOT skip any):
1. **Feature** — slug from SPEC_OUTPUT.md (copy exactly)
2. **Context** — 2-3 sentences on the problem space from spec
3. **Architecture Decisions** (ADRs) — one ADR block per major decision:

   ```
   ### ADR-N: <title>
   - Status: Accepted | Deferred | Rejected
   - Decision: <what we chose>
   - Rationale: <why — 1-2 sentences>
   - Trade-offs: <what we give up>
   - Alternatives considered: <at least 1>
   ```

   Minimum 2 ADRs required. Typical: data storage, concurrency model, API shape.

4. **Component Breakdown** — list each new/modified module with 1-line purpose:
   ```
   src/path/to/module.py — <what it does>
   ```
5. **Data Flow** — ASCII diagram or numbered list showing request path
6. **Integration Points** — existing systems this feature connects to:
   - Reference `src/core/telemetry/meters.py` if the feature emits metrics
   - Reference `src/core/signals/` if the feature reads/writes mission events
7. **File Ownership Matrix** — which agent owns which file (for CLAUDE.code.md)
8. **Open Questions** — any `[OPEN]` items from spec that affect design

## Agent Rules

- Prefer the simplest option that satisfies the spec's `[nonfunctional]` constraints
- Solo mandate: avoid distributed systems unless spec explicitly requires them
- Default storage: SQLite (`src/core/signals/local_store.py` pattern)
- Default queue: in-memory, disk-fallback (no Redis/Kafka unless $0 constraint met)
- Each ADR must include at least 1 "Alternatives considered"
- Mark unresolved design choices as `[OPEN-DESIGN]`

## Quality Gate

Before writing output, confirm:
- [ ] At least 2 ADRs with status set
- [ ] Component breakdown lists all files from spec's functional requirements
- [ ] Data flow diagram present (ASCII OK)
- [ ] File ownership matrix complete (used by CLAUDE.code.md)
- [ ] No implementation code — only interfaces and module names

## Invocation Context

This contract is executed by `mekong design <feature>`.
Prior phase output: `.mekong/SPEC_OUTPUT.md`
Next phase: `mekong code <feature>` reads this output.
