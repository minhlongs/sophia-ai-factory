# Recon 03 — Section 6: Creative Cell V1 Audit (image.generate)

## 1. Is the abstraction correctly placed?

**Yes — with a known inconsistency.** `ImageGenerationProvider` is defined at `src/seed/ai/image-generation-provider.ts:1-95` (seed layer). This is the correct layer: foundational type with no domain imports. `MockImageGenerationProvider` at `src/seed/ai/providers/mock-image-generation-provider.ts:1-57` implements it correctly.

**Inconsistency:** `OpenRouterImageAdapter` at `src/seed/ai/providers/openrouter-image-adapter.ts:1-88` implements `Provider` (the text-oriented interface from `seed/ai/provider.ts`), NOT `ImageGenerationProvider`. It has `generateImage()` as an additional method, not through the standard `generate()` contract. This means the adapter cannot be plugged into the Creative Cell pipeline without modification.

**Verdict:** Abstraction is architecturally sound and correctly layered. The gap is that the one real adapter (OpenRouter) doesn't conform to the interface yet.

---

## 2. Is the event contract correct?

**Yes.** The three event types at `src/seed/inngest/event-types.ts:194-238`:
- `creative/image.requested` — carries missionId, userId, jobId, prompt, constraints
- `creative/image.completed` — carries jobId, assetRef, provider, costCents, latencyMs
- `creative/image.failed` — carries jobId, error, code, kind (FailureKind), attempt

All 43 event keys are in the canonical `Events` record at `src/seed/inngest/event-types.ts:250-294`. The handler at `src/forest/inngest/functions/creative-image-generate.ts:192-197` triggers on `creative/image.requested` and emits either `.completed` or `.failed`.

The completed event uses `assetRef` (string URL) rather than a full `CreativeAsset` — this is a conscious choice (the asset is in D1, the event carries a pointer).

**Verdict:** Contract is correct and consistent with the rest of the event system.

---

## 3. Is idempotency addressed?

**Yes.** At `src/forest/inngest/functions/creative-image-generate.ts:~100-115` (findExistingAsset):
- Before generating, the handler queries `media_jobs` by `jobId`
- If a completed row exists, it returns the existing asset immediately without re-generating
- The idempotency check runs before the circuit breaker check

**Gap:** The `idempotencyKey` field exists on `CreativeJob` (`src/seed/types/creative-job.ts:39`) but is optional and not used by the handler. The idempotency mechanism relies solely on the `jobId` lookup, which is sufficient for the current single-provider setup but may need extension when multiple providers are introduced.

**Verdict:** Idempotency is handled via jobId lookup. The idempotencyKey field is scaffolded but unused.

---

## 4. Is retry behavior correct?

**Partially.** The handler at `src/forest/inngest/functions/creative-image-generate.ts:~130-170` implements its own retry loop with `MAX_RETRIES = 3` and exponential backoff: `1000 * 2^(attempt-1) ms`. This is separate from Inngest's built-in retry mechanism (which is also set to `retries: 3` at line 196).

**Issue:** Double retry layer — Inngest retries the entire function on unhandled exceptions, while the internal loop retries individual provider calls. If the provider throws after all 3 internal retries, the function-level retry restarts the entire flow (including the idempotency check). This is redundant but not harmful since idempotency prevents duplicate work.

**Backoff:** 1s → 2s → 4s between internal retries. Reasonable for image generation latency.

**Verdict:** Retry works correctly. The dual-layer (Inngest + internal) is redundant but safe due to idempotency.

---

## 5. Is timeout behavior correct?

**Partially.** `CreativeConstraints.timeoutMs` defaults to 120,000ms (2 min) at `src/seed/types/creative-constraints.ts:28`. The `MockImageGenerationProvider` respects this in TIMEOUT mode (`mock-image-generation-provider.ts:~40-50`): it delays past `input.timeoutMs + 1000ms` then throws TIMEOUT.

**Gap:** The `InlineMockImageProvider` inside `creative-image-generate.ts:~60-80` does NOT respect timeoutMs — it always returns SUCCESS or FAILURE based on the prompt hash. This means timeout behavior is only testable via the dedicated mock provider, not via the handler's inline provider.

**No enforcement at handler level:** The Inngest function has no `setTimeout` or deadline enforcement. If a real provider hangs indefinitely, the Inngest step will wait until the function-level timeout (Inngest default: 30s per step, configurable).

**Verdict:** Timeout is defined in the type system but not enforced at the handler level. Inline mock ignores it.

---

## 6. Is failure persisted correctly?

**Yes.** On failure, the handler at `src/forest/inngest/functions/creative-image-generate.ts:~180-190`:
- Updates `media_jobs` row with `status: 'failed'` and `error` message
- Emits `creative/image.failed` with `error`, `code`, `kind` (FailureKind), and `attempt` count
- The FailureKind classification (`src/seed/types/failure-kind.ts`) categorizes errors for circuit breaker behavior

The migration at `migrations/0267_creative_media_jobs_metadata.sql` added `mission_id`, `provider`, `mime`, `size`, `prompt_hash`, `generated_at`, `metadata` columns to support the full asset metadata on the media_jobs row.

**Verdict:** Failure is persisted to D1 and emitted as a typed event with failure classification.

---

## 7. Is the result gate authoritative?

**Yes.** `verifyImageResult` at `src/forest/inngest/functions/creative-image-generate.ts:~85-98` validates:
1. Provider returns non-null result
2. URL matches `^(https?:\/\/|mock:\/\/)` pattern
3. MIME type matches `^image\/`
4. Size > 0
5. Full schema validation via `validateCreativeAsset()` (Zod at `src/seed/types/creative-asset.ts:27-37`)

Only after all checks pass does the handler write the asset to D1 and emit `creative/image.completed`.

**Verdict:** Result gate is authoritative — 5-layer validation before persist.

---

## 8. Can this abstraction support multiple real image providers?

**Yes, architecturally.** The `ImageGenerationProvider` interface at `src/seed/ai/image-generation-provider.ts:30-88` defines `generate()`, `capabilities()`, and `health()`. The handler at `creative-image-generate.ts:~55-80` has `mapJobInputToProviderInput` as a single mapping point (Escrow MED-2 pattern). Adding a new provider requires:
1. Implement `ImageGenerationProvider` (one file)
2. Register it in a provider factory/registry
3. No changes to the handler

**Current limitation:** The handler currently hardcodes `InlineMockImageProvider` (line ~65). There is no factory/registry to select providers at runtime. The `providerId` field on `CreativeJob` is optional and unused.

**Verdict:** The interface supports multiple providers. The wiring (factory/registry) is missing — that is the minimum change needed.

---

## 9. Is image.edit intentionally absent?

**Yes — confirmed absent by design.**

- No handler for any image.edit event exists
- No Inngest function for edit operations
- No server action for edit
- The only reference is at `src/seed/ai/scoring-contextual.ts:106` — a generic capability check (`tool.supports?.image_edit`) that scores providers but never invokes edit
- `CreativeJobType = 'image.generate'` only (`src/seed/types/creative-job.ts:18`)

**Verdict:** image.edit is NOT implemented. This is intentional — the type system allows it to be added later as a new `CreativeJobType`.

---

## 10. Minimum change to introduce a real provider

**Option A (clean path):** Implement `ImageGenerationProvider` for one service (e.g., Replicate flux-schnell). One new file in `src/seed/ai/providers/`. Add a factory function to `creative-image-generate.ts` that selects the provider based on `providerId` or user's BYOK key. Estimated: 1 file created, 1 file modified (~30 lines changed).

**Option B (OpenRouter fast path):** Refactor `OpenRouterImageAdapter` to implement `ImageGenerationProvider` instead of `Provider`. Then wire it into the handler. Estimated: 2 files modified (~50 lines changed).

**Minimum viable:** Option A is cleaner and doesn't break the existing text provider interface.

---

## Cell Implementation Status

### Video Cell — IMPLEMENTED

Multi-step pipeline fully wired:

| Component | Location | Evidence |
|---|---|---|
| Video Create (Server Action) | `land/video/` | Orchestrator at `land/video/generation/campaign-orchestrator.ts` |
| Script Generation | `forest/inngest/functions/video-scripting.ts:79` | Trigger: `video.requested`, emits `video.script.ready` |
| TTS | `forest/inngest/functions/video-tts.ts:62` | Trigger: `video.script.ready`, emits `video.tts.ready` |
| Visual Generation | `forest/inngest/functions/video-visual.ts:63` | Trigger: `video.tts.ready`, emits `video.visual.ready` |
| Composition | `forest/inngest/functions/video-compose.ts:60` | Trigger: `video.visual.ready`, emits `video.composed` |
| Upload | `forest/inngest/functions/video-upload.ts:25` | Trigger: `video.composed`, emits `video.uploaded` |
| Publish | `forest/inngest/functions/video-publish.ts:30` | Trigger: `video.uploaded`, emits final status |
| Batch Fanout | `forest/inngest/functions/batch-video-fanout.ts:14` | Trigger: `batch/video.fanout` |
| Video Generate | `forest/inngest/functions/video-generate.ts:45` | Trigger: `video/generate.requested` |

Status: **IMPLEMENTED** — Full pipeline from request through 5-step generation to publish.

---

### Audio Cell — PARTIAL

| Component | Location | Status |
|---|---|---|
| Voice Clone | `land/voice/clone-voice.ts` + `forest/voice/missions/voice-clone.ts` | IMPLEMENTED (clone flow) |
| TTS Client | `land/video/generation/tts-client.ts` | IMPLEMENTED (inside video pipeline) |
| Audio Upload | `land/r2/audio-upload.ts`, `land/storage/audio-upload.ts` | IMPLEMENTED (storage) |
| Standalone Audio Generation | N/A | MISSING — no independent audio workflow |

Audio is a dependency of the video pipeline, not a standalone creative cell. Voice clone exists but there is no "audio.generate" job type or event.

---

### Render Cell — IMPLEMENTED

| Component | Location | Status |
|---|---|---|
| Provider Interface | `land/video/generation/video-render-provider.ts` | IMPLEMENTED |
| BYOK Renderer | `land/video/generation/render-byok-video.ts` | IMPLEMENTED (HeyGen) |
| Benchmark | `land/analytics/video-render-benchmark.ts` | IMPLEMENTED |

Status: **IMPLEMENTED** — Render is tightly coupled to the video pipeline (HeyGen BYOK).

---

### QA Cell — PARTIAL

| Component | Location | Status |
|---|---|---|
| Quality Drift Alert | `forest/alerts/creative-quality-drift-alert.ts` | IMPLEMENTED |
| Drift Scan Cron | `app/api/cron/creative-quality-drift-scan/route.ts` | IMPLEMENTED |
| Automated QA Gate | N/A | MISSING — no automated quality gate blocking publish |
| Human Review Queue | N/A | MISSING — no review queue for creative output |

Status: **PARTIAL** — Monitoring exists but no automated QA gate or human review workflow.

---

### Delivery Cell — PARTIAL

| Component | Location | Status |
|---|---|---|
| Quota Alert Delivery | `land/alerts/quota/alert-delivery-service.ts` | IMPLEMENTED |
| Email Delivery | `land/billing/email/email-delivery-service.ts` | IMPLEMENTED |
| Bundle Failed Email | `land/billing/email/send-bundle-render-failed-email.ts` | IMPLEMENTED |
| Asset Delivery to Customer | N/A | MISSING — no explicit "deliver asset to customer" flow |

Status: **PARTIAL** — Internal alerting exists but no customer-facing asset delivery workflow.

---

## Summary

```
SECTION 6 — CREATIVE CELL V1 (image.generate)
═══════════════════════════════════════════════
Abstraction placement:  ✅ Correct (seed layer)
Event contract:         ✅ Correct (3 events, typed)
Idempotency:            ✅ Handled (jobId lookup)
Retry behavior:         ⚠️  Dual-layer (Inngest + internal) — safe but redundant
Timeout behavior:       ⚠️  Defined in type, not enforced at handler level
Failure persistence:    ✅ D1 + typed event + FailureKind
Result gate:            ✅ Authoritative (5-layer validation)
Multi-provider support: ⚠️  Interface ready, factory/registry missing
image.edit:             ✅ Confirmed absent (intentional)
Real provider intro:    → Implement ImageGenerationProvider + factory (~1 file + 30 lines)

Cell Status:
  Video:    IMPLEMENTED (full pipeline)
  Audio:    PARTIAL (video dependency only)
  Render:   IMPLEMENTED (HeyGen BYOK)
  QA:       PARTIAL (monitoring only, no gate)
  Delivery: PARTIAL (internal only, no customer delivery)

Key Gaps:
  1. No provider factory/registry — handler hardcodes InlineMockImageProvider
  2. OpenRouterImageAdapter implements wrong interface (Provider not ImageGenerationProvider)
  3. Timeout not enforced at handler level
  4. InlineMockImageProvider ignores timeoutMs
  5. No automated QA gate or human review workflow
  6. No customer-facing asset delivery flow
```
