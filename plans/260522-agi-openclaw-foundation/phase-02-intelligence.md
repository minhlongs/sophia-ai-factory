# Phase 2: Intelligence — Implementation Plan

**Status:** IN PROGRESS
**Depends on:** Phase 1 (complete, deployed 24bcfdc6)

---

## Tasks

### Task D: SOP DAG Execution Handler (Inngest)
Wire the DAG parallel planner into an Inngest function that executes SOP steps in waves.
- CREATE: `src/forest/inngest/functions/sop-dag-executor.ts`
  - Consumes `sop/execution.requested` event
  - Loads SOPGraph from template, calls `planExecution()`
  - Executes each wave via `step.run()` with parallel Promise.all
  - Logs each step via `logStepExecution()` from analytics repo
  - Logs completion via `logExecutionCompletion()`
  - Fires `addEpisodicFromExecution()` on creator memory repo
- MODIFY: `src/forest/inngest/index.ts` — register new function

### Task E: SOP Template Registry
Store SOP templates as SOPGraph definitions in D1 for runtime lookup.
- CREATE: `src/seed/db/migrations/20260522_sop_templates.sql` — sop_templates table
- CREATE: `migrations/0129_sop_templates.sql` — canonical copy
- CREATE: `src/seed/db/repositories/sop-template-repo.ts` — CRUD for SOPGraph templates
- Types: id, name, description, graph_json (serialized SOPGraph), version, is_active, created_by, created_at, updated_at

### Task F: Experiment Framework (SOP-level A/B)
Generic experiment schema for SOP prompt/parameter variants — separate from existing video A/B.
- CREATE: `src/seed/db/migrations/20260522_sop_experiments.sql` — sop_experiments + sop_experiment_assignments
- CREATE: `migrations/0130_sop_experiments.sql` — canonical copy
- CREATE: `src/tree/sop/experiment-framework.ts` — assignVariant, recordOutcome, evaluateExperiment
- Types: experiment (id, sop_template_id, parameter_key, variants_json, status), assignment (user_id, experiment_id, variant_key, outcome_json)

## Success Criteria
- tsc clean, npm run build passes, npm test passes
- SOP DAG executor compiles and follows Inngest function pattern
- SOP templates storable/retrievable from D1
- Experiment framework supports variant assignment + outcome tracking
