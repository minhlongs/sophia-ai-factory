# Structurize Bridging Specification — AI Orchestrator

> Fills the gap between `structurize` output and the local `AI Orchestrator` runtime.
> Authored: 2026-07-04. Owner: CTO / Platform team.

---

## 1. Problem Statement

The `structurize` module produces high-digest plans that the AI Orchestrator must execute.
Today the boundary is implicit: the orchestrator ingests raw structurize output via ad-hoc
key lookups. This causes:

1. Silent data loss when subparsers decode with inconsistent `decoder buf var` sizes.
2. Drift between the tone engine's intended profile and what downstream composers receive.
3. No systematic trace of *why* a particular execution plan was chosen — anomalies are opaque
   to the operator (per handover: "development-mode approval" should surface reasons locally
   without annoying the user).

This specification defines a typed bridge that:

- exposes a **single, deterministic integration surface** for every structurize submodule,
- validates every structurize output *before* the orchestrator acts on it,
- logs every bridge event for local dev-mode inspection.

---

## 2. Scope

```
┌─────────────┐     typed      ┌───────────────────┐     typed      ┌─────────────┐
│  Structurize │ ──────────────▶│  Structurize Bridge│ ──────────────▶│ AI Orchestrator │
│  (ad-hoc)    │ ◀──────────────│  (validation +    │ ◀──────────────│ (runtime)      │
│              │     feedback   │   canonical I/O)  │     events     │               │
└─────────────┘                └───────────────────┘                └─────────────┘
```

In scope:

- `StructurizeBridge` class — the single entry point.
- Per-submodule **Adapter** (tone, template, audience, etc.) that normalises inputs/outputs.
- `BridgeEvent` log stream for dev-mode approval display.
- Type contract (TypeScript interfaces) shared between structurize, bridge, and orchestrator.

Out of scope:

- Changing structurize's internal generation logic (that is its own module's job).
- Changing the orchestrator's execution engine — only its input surface.

---

## 3. Type Contracts

All types live in `src/seed/types/structurize-bridge.ts` (Layer 1 — foundational).

```ts
// src/seed/types/structurize-bridge.ts

/** Canonical digest produced by any structurize submodule. */
export interface StructurizeDigest {
  moduleId: string;              // e.g. "tone-engine", "template-selector"
  profileHash: string;           // SHA-256 of input profile — change detector
  payload: Record<string, unknown>;  // module-specific output
  provenance: ProvenanceRecord; // who/what produced this digest
}

/** Provenance for dev-mode audit trail. */
export interface ProvenanceRecord {
  source: "structurize" | "orchestrator" | "user-override";
  generatedAt: string;           // ISO-8601
  configVersion: string;         // semver of submodule config used
  anomalyFlags: string[];        // empty = clean; non-empty = dev-mode alert
}

/** Bridge event — emit for every digest crossing the boundary. */
export interface BridgeEvent {
  direction: "into-bridge" | "out-of-bridge";
  moduleId: string;
  timestamp: string;
  summary: string;               // ≤120 chars for readable logs
  severity: "info" | "warn" | "error";
}
```

---

## 4. StructurizeBridge Class

Location (Layer 2 — domain reusable): `src/tree/structurize-bridge/structurize-bridge.ts`

```ts
import type {
  StructurizeDigest,
  ProvenanceRecord,
  BridgeEvent,
} from "@/seed/types/structurize-bridge";

export class StructurizeBridge {
  private adapters: Map<string, BridgeAdapter>;
  private eventLog: BridgeEvent[];

  constructor() {
    this.adapters = new Map();
    this.eventLog = [];
  }

  /** Register an adapter for a submodule. Called at orchestrator init. */
  register(moduleId: string, adapter: BridgeAdapter): void;

  /**
   * Validate + normalise incoming structurize output before passing to orchestrator.
   * Returns typed StructurizeDigest or throws BridgeValidationError.
   */
  ingest(digest: unknown, moduleId: string): StructurizeDigest;

  /** Retrieve + emit logged events (dev-mode display). */
  getEventLog(filter?: { moduleId?: string; since?: string }): BridgeEvent[];

  /** Clear log after fetch (prevent memory growth in long sessions). */
  drainLog(): void;
}
```

### Interface: `BridgeAdapter`

```ts
export interface BridgeAdapter {
  /** Human-readable name of this submodule. */
  moduleId: string;

  /**
   * Normalise raw structurize output into StructurizeDigest.
   * Throw BridgeValidationError if output is malformed.
   */
  normalise(raw: unknown): StructurizeDigest;

  /**
   * Validate that the digest's payload matches the expected profile.
   * Used for tone drift detection, schema conformance, etc.
   * Default implementation: no-op (pass).
   */
  validate(digest: StructurizeDigest): void;
}
```

---

## 5. Adapter Specifications

### 5.1 Tone Engine Adapter

**Problem solved:** Catches tone drift before downstream composers see bad data.

Location: `src/tree/structurize-bridge/adapters/tone-adapter.ts`

```
Raw structurize output (example):
  { tone: "professional", intensity: 0.8, keywords: [...], ... }

↓ normalise()

StructurizeDigest:
  moduleId: "tone-engine"
  profileHash: <sha-256 of original tone config object>
  payload: { canonicalTone: ToneProfile, keywords: string[], intensity: number }
  provenance: { source, generatedAt, configVersion, anomalyFlags }

↓ validate()

- intensity must be in [0, 1]
- canonicalTone must be one of the known enum values
- If keywords.length === 0 → anomalyFlag: "empty-keywords"
```

### 5.2 Template Selector Adapter

- Validates that selected template slug is in the approved registry.
- Checks that template parameters are complete (no null required fields).
- Anomaly flag: "missing-params" if required params absent.

### 5.3 Audience Segment Adapter

- Validates that the selected audience segment exists in the active segments list.
- Anomaly flag: "segment-not-found" if segment ID is stale.

### 5.4 New Modules (Future)

- Any new submodule gets an adapter registered at orchestrator init.
- Untyped adapter = bridge rejects input with `BridgeValidationError("no-adapter")`.

---

## 6. BridgeEvent Log (Dev-Mode Approval)

Events are **local-only** — not sent to production logging.
In dev, the `ApprovalPanel` UI reads this log to show the operator:

- Which submodule crossed the boundary and when.
- Whether any anomaly flags fired (warn / error level).
- The *why* behind each execution path decision (summary field).

Log rotation: drain after 500 events to prevent memory growth in long sessions.

---

## 7. Decoder Buffer Variable Standardization

> From handover item #8: "When decoding messages, the decoder buf var must be deterministic
> across all subparsers."

Each subparser must use the same buffer initialisation:

```ts
// src/seed/utils/decoder-buf.ts
export function createDecoderBuf(size: number = 4096): Uint8Array {
  return new Uint8Array(size);
}
```

Constraint: subparsers MUST NOT allocate buffers of different sizes for the same message type.
Enforcement: add `buffer-size` header to `BridgeEvent` telemetry during the structurize phase
and warn in dev mode if sizes diverge.

---

## 8. SEC5 Declaration Verification

Every `StructurizeDigest` MUST carry a `ProvenanceRecord` with `source` and `configVersion`.
This is the Sec5 verification: the orchestrator refuses to act on a digest whose provenance
is missing or stale (configVersion not matching the registered adapter version).

Enforcement point: `StructurizeBridge.ingest()` validates provenance before returning.

---

## 9. Integration Sequence (Do First, Then Build)

### Phase A — Types (Layer 1)

- [ ] Create `src/seed/types/structurize-bridge.ts` with interfaces in §3.
- [ ] Create `src/seed/utils/decoder-buf.ts` with standardised buffer factory (§7).
- [ ] Add runes for `BridgeValidationError` in `src/seed/errors/`.

### Phase B — Bridge Core (Layer 2)

- [ ] Create `src/tree/structurize-bridge/structurize-bridge.ts` — class skeleton.
- [ ] Create `src/tree/structurize-bridge/adapters/bridge-adapter.ts` — interface.
- [ ] Create `src/tree/structurize-bridge/adapters/tone-adapter.ts` — first adapter.
- [ ] Create `src/tree/structurize-bridge/adapters/template-adapter.ts`.
- [ ] Create `src/tree/structurize-bridge/adapters/audience-adapter.ts`.

### Phase C — Orchestrator Integration (Layer 2/3)

- [ ] Replace ad-hoc structurize ingest in orchestrator with `bridge.ingest()`.
- [ ] Wire `getEventLog()` → dev-mode `ApprovalPanel` UI.
- [ ] Add Sec5 provenance check to orchestrator's digest acceptance gate.

### Phase D — Validation & Tests

- [ ] Unit tests for each adapter (valid input → digest, invalid input → error).
- [ ] Integration test: full structurize → bridge → orchestrator round trip.
- [ ] Drift test: feed tone engine out-of-range output → adapter catches it.
- [ ] Run `npm test`, `npm run build`, fix any regressions.

### Phase E — Production Readiness

- [ ] Strangle ad-hoc paths: remove old structurize ingest code.
- [ ] Document adapter registration contract for new modules.
- [ ] Update `docs/developer-onboarding.md` with "Adding a new adapter" section.

---

## 10. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Bridge adds latency to orchestrator hot path | Medium | Profile; target <5ms per ingest. Buffer pool for `decoderBuf`. |
| Adapter proliferation — every new submodule needs one | Low | Scaffold generator script (`scripts/gen-bridge-adapter.ts`). |
| Loose typing in `payload: Record<string, unknown>` re-introduces drift | Medium | Each adapter declares a narrower payload type internally; `StructurizeDigest` stays generic at the boundary. |
| Dev-mode log growing unbounded in long sessions | Low | `drainLog()` after 500 events; wire to session cleanup. |

---

## 11. Out of Scope (Backlog)

- Persisting BridgeEvent to D1 for cross-session audit (future: Phase 7+).
- Bridge-as-a-service (HTTP endpoint for external submodules) — not needed today.
- Automatic adapter generation from structurize config schema (nice-to-have).
