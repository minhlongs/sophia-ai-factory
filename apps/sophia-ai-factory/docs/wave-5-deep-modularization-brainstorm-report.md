# Brainstorming & Architecture Report: Wave 5 Deep Modularization (< 200 LOC)

## 1. Problem Statement & Scope
Following the successful completion of Waves 1–4, a full codebase scan identified 12 remaining monolithic production files (> 580 LOC) totaling ~7,611 lines of code across three core architectural domains:
1. **Enterprise Governance & Audit Triad** (`tree/ipo`, `tree/finance`, `land/admin`)
2. **GPU Scheduling & Inngest Video Pipelines** (`forest/inngest`, `tree/gpu`, `tree/queue`, `tree/mission`)
3. **Agency Portals & Mission Onboarding Wizards** (`forest/agency`, `forest/audit`, `components/missions`)

All 12 files currently exceed the 200 LOC per-file maintainability threshold and require decomposition into cohesive, single-responsibility submodules strictly `< 200 LOC` each.

## 2. Target Monoliths & Submodule Decomposition Blueprint

### Cluster A: Enterprise Governance & Cryptographic Auditing (4 files, 2,479 LOC → 22 submodules)
1. **`src/tree/ipo/s1-prospectus-engine.ts`** (680 LOC → `src/tree/ipo/prospectus/` + root facade)
   - `types.ts`: SEC S-1 schema, GAAP financial tables, risk classifications.
   - `financial-summarizer.ts`: Balance sheet, income statement, and unit economics normalization.
   - `cap-table-formatter.ts`: Capitalization breakdown, preferred vs common stock dilution math.
   - `risk-factor-builder.ts`: Automated risk factor taxonomy & regulatory disclosures.
   - `prospectus-assembler.ts`: Markdown & JSON-LD prospectus generation.
   - `index.ts`: Barrel export.
2. **`src/tree/ipo/sox404-control-ledger.ts`** (616 LOC → `src/tree/ipo/sox404/` + root facade)
   - `types.ts`: IT General Controls (ITGC), segregation of duties (SoD), deficiency tiers.
   - `control-definitions.ts`: Canonical COSO framework mapping and audit test catalog.
   - `sod-verifier.ts`: Role-based privilege conflict detection and unauthorized approval checks.
   - `deficiency-assessor.ts`: Material weakness vs significant deficiency scoring engine.
   - `evidence-collector.ts`: Immutable D1 audit log extraction and hash linking.
   - `index.ts`: Barrel export.
3. **`src/tree/finance/merkle-audit-vault.ts`** (580 LOC → `src/tree/finance/merkle/` + root facade)
   - `types.ts`: Merkle leaf, branch, root hash, and inclusion proof interfaces.
   - `hasher.ts`: Web Crypto SHA-256 leaf and pair hashing primitives.
   - `tree-builder.ts`: Deterministic binary Merkle tree construction.
   - `proof-generator.ts`: Cryptographic inclusion proof generation for arbitrary transactions.
   - `vault-verifier.ts`: Proof verification against published root anchor.
   - `index.ts`: Barrel export.
4. **`src/land/admin/sovereign-vault-actions.ts`** (603 LOC → `src/land/admin/vault-actions/` + root facade)
   - `types.ts`: Action inputs, validation schemas, and audit payload types.
   - `rotation-action.ts`: HSM key rotation and cryptographic envelope re-encryption.
   - `backup-action.ts`: Encrypted D1 snapshot trigger with R2 multi-region replication.
   - `attestation-action.ts`: Cryptographic state attestation and SOC2 compliance export.
   - `lockdown-action.ts`: Emergency tenant isolation and permission freeze actions.
   - `index.ts`: Barrel export.

---

### Cluster B: GPU Scheduling & Autonomous Video Pipelines (4 files, 2,443 LOC → 21 submodules)
5. **`src/forest/inngest/functions/video-voice-dubbing.ts`** (624 LOC → `src/forest/inngest/functions/voice-dubbing/` + root facade)
   - `types.ts`: Dubbing job payload, audio stem metadata, phoneme alignment schemas.
   - `transcription-aligner.ts`: Whisper word-level timestamp alignment and cadence matching.
   - `voice-synthesizer.ts`: Multi-speaker ElevenLabs API caller with circuit-breaker protection.
   - `stem-mixer.ts`: Background ducking, audio normalization, and stem concatenation.
   - `dubbing-workflow.ts`: Inngest step function chaining and retry backoff.
   - `index.ts`: Barrel export.
6. **`src/tree/gpu/workload-balancer.ts`** (607 LOC → `src/tree/gpu/balancer/` + root facade)
   - `types.ts`: GPU node health, VRAM telemetry, job priority matrix.
   - `telemetry-aggregator.ts`: Heartbeat monitoring and node availability tracker.
   - `vram-allocator.ts`: Memory footprint estimation and multi-tenant bin-packing.
   - `failover-handler.ts`: Spot-instance eviction recovery and checkpoint migration.
   - `balancer-facade.ts`: Public API for dispatching jobs to optimal GPU workers.
   - `index.ts`: Barrel export.
7. **`src/tree/queue/fair-share-gpu-scheduler.ts`** (592 LOC → `src/tree/queue/scheduler/` + root facade)
   - `types.ts`: Tenant quota brackets, deficit counter state, queue priority tiers.
   - `deficit-counter.ts`: Deficit Round-Robin (DRR) quantum tracking and replenishment.
   - `tenant-weight-resolver.ts`: Dynamic tier priority weight calculation (Enterprise vs Free).
   - `queue-selector.ts`: Fair-share candidate selection with starvation prevention.
   - `scheduler-engine.ts`: Execution orchestrator and D1 queue lock updates.
   - `index.ts`: Barrel export.
8. **`src/tree/mission/agent-run-repo.ts`** (620 LOC → `src/tree/mission/agent-repo/` + root facade)
   - `types.ts`: Agent mission record, step snapshot, and token budget types.
   - `run-queries.ts`: D1 queries for mission creation, step logging, and status transitions.
   - `checkpoint-recorder.ts`: State serialization and fault-tolerant resumption snapshots.
   - `log-buffer.ts`: High-throughput in-memory log batching before D1 flush.
   - `repo-facade.ts`: Backward-compatible agent run repository methods.
   - `index.ts`: Barrel export.

---

### Cluster C: Agency Portals & Mission Wizards UI (4 files, 2,689 LOC → 22 submodules)
9. **`src/forest/agency/agency-admin-portal.tsx`** (724 LOC → `src/forest/agency/admin-portal/` + root facade)
   - `types.ts`: Portal state, agency settings, tenant account types.
   - `use-portal-state.ts`: Custom hook managing active tabs, agency config, dirty state.
   - `tenant-table-card.tsx`: Sub-account tenant list with status badges and quota controls.
   - `seat-manager-card.tsx`: Team member invitation, role management, and access revocation.
   - `branding-editor-card.tsx`: Custom whitelabel logo, color tokens, and domain configuration.
   - `index.ts`: Barrel export.
10. **`src/forest/audit/audit-vault-explorer.tsx`** (677 LOC → `src/forest/audit/vault-explorer/` + root facade)
    - `types.ts`: Explorer props, tree navigation state, receipt filter schemas.
    - `use-explorer-state.ts`: Custom hook for Merkle tree browsing and proof verification.
    - `tree-visualization.tsx`: Interactive tree graph node renderer with zoom & highlight.
    - `proof-inspector-card.tsx`: Step-by-step cryptographic hash path validator card.
    - `receipt-export-modal.tsx`: JSON-LD and PDF audit certificate exporter modal.
    - `index.ts`: Barrel export.
11. **`src/components/missions/first-run-wizard.tsx`** (675 LOC → `src/components/missions/first-run/` + root facade)
    - `types.ts`: Wizard step types, form data, BYOK test status interfaces.
    - `use-wizard-flow.ts`: Step navigation, persistent state, validation orchestrator.
    - `byok-step.tsx`: API key inputs with real-time test probes (OpenRouter, ElevenLabs, D-ID).
    - `template-step.tsx`: Pre-built viral video campaign template selector card.
    - `review-step.tsx`: Final summary review, initial quota grant, and launch trigger.
    - `index.ts`: Barrel export.
12. **`src/forest/agency/client-video-review-portal.tsx`** (613 LOC → `src/forest/agency/review-portal/` + root facade)
    - `types.ts`: Video review state, frame annotation markers, approval payload types.
    - `use-review-state.ts`: Video playback sync, annotation drafts, action dispatchers.
    - `video-player-card.tsx`: Adaptive video player with timeline annotation overlay.
    - `annotation-timeline.tsx`: Interactive timestamp comment list with author badges.
    - `approval-actions-card.tsx`: One-click client approval, revision request, and feedback form.
    - `index.ts`: Barrel export.

---

## 3. Strict Quality & Architectural Invariants
1. **Strict File Size**: Max allowed lines per file is 200 LOC.
2. **Layer Separation**:
   - `seed`: primitives, types, config (no dependencies on upper layers).
   - `tree`: domain-reusable business logic (imports `seed` only).
   - `forest`: orchestrators, Inngest jobs, and UI components (imports `seed`, `tree`).
   - `land`: domain workflows & server actions (imports `seed`, `tree`, `forest`).
3. **100% Backward Compatibility**: Root files preserved as thin facades (`export * from './...'`).
4. **Zero `:any` & Zero `console.log`**: Full type safety with Zod schemas and `@/seed/utils/logger-utility`.
5. **Zero Test Regressions**: All 337 existing unit & integration tests must pass continuously.

---

## 4. Next Steps & Execution Strategy
- Run parallel execution via `/plan:parallel` or `/plan:fast` to execute the modularization across the 3 clusters.
- Run comprehensive quality gates: `npm run type-check`, `npm run lint`, `bash scripts/check-layer-boundaries.sh`, `npm run i18n:validate`, `npm test`.
