# Sophia OPC Affiliate — Audit Matrix

> **Pinned snapshot:** `439635e1a2017c2643e013c0311631bd95409de4` (`origin/main`, branch `feat/opc-affiliate-audit-repair`).
> A verdict is valid only against this commit. Re-run the cited `grep`/source read after any rebase.
>
> **Acceptance ladder (never mix levels):**
> | Level | Meaning | Required evidence |
> |---|---|---|
> | L1 Source/Math | The code computes what it claims | source read + unit assertion |
> | L2 Local integration | Route/action/job behaves end-to-end locally | test at the real boundary |
> | L3 Provider/Production | Real third-party call succeeded | provider response, never a fixture |
> | L4 Commercial | Real click → real conversion → real commission | real network webhook |
>
> A row may not be marked PASS on L1 evidence when its invariant sits at L2. Existing test counts and file existence are not evidence.

Legend: **PASS** / **FAIL** / **BLOCKED** / **NOT VERIFIED**

---

## Part A — Video-to-affiliate-revenue engine

### A01 — Learning loop workers are registered and running

- **Invariant:** The traffic-bandit, creative-deliberation and flywheel-feedback workers that close the "feedback into the next decision" stage are dispatched by Inngest.
- **Entrypoint:** `src/app/api/inngest/serve/growth-functions.ts:48-93` (`GROWTH_INNGEST_FUNCTIONS`).
- **Production callers:** the Inngest serve route imports this array.
- **Observed:** the three workers exist but are absent from the registered array:

```bash
$ grep -rn "banditTrafficWorker\|creativeDeliberationWorker\|flywheelFeedbackDispatcher" src/ \
    | grep -v __tests__ | grep -v "\.test\.ts"
src/forest/growth-v13/creative-deliberation-worker.ts:12:export const creativeDeliberationWorker = inngest.createFunction(
src/forest/growth-v13/bandit-traffic-worker.ts:20:export const banditTrafficWorker = inngest.createFunction(
src/forest/inngest/functions/flywheel-feedback-dispatcher.ts:92:export const flywheelFeedbackDispatcherJob = inngest.createFunction(
```

  Only `socialTelemetryIngestWorker` and `priorRecalibrationWorker` (lines 46-47 / 89-90) made it into the array. The three writers that turn outcome telemetry into the next decision are never scheduled, so telemetry accumulates with no consumer.
- **Verdict:** FAIL
- **Severity:** high — the feedback stage of the engine is dead code; outcomes never change future behaviour.
- **Repro:** `grep -rn "banditTrafficWorker" src/app/api/inngest/serve/` → no match.
- **Remediation:** register the three functions in `GROWTH_INNGEST_FUNCTIONS`, then add an L2 test that imports the array and asserts each worker id is present.

### A02 — Offer EPC is a measured number, not a derived estimate

- **Invariant:** The `epc` used to rank offers is measured earnings-per-click, or is explicitly labelled as an estimate.
- **Entrypoint:** `src/land/affiliates/discovery-wave-helpers.ts:150-154`.
- **Production callers:** `src/land/affiliates/discovery-wave.ts:87` (`scoreAffiliate`), reached from the discovery wave orchestration.
- **Observed:** EPC is manufactured from the commission rate:

```typescript
const epc = offer.commissionPct != null
  ? Math.min(10, Math.max(0.5, (offer.commissionPct / 100) * 8))
  : offer.commissionFixedUsd != null
    ? Math.min(10, Math.max(0.5, offer.commissionFixedUsd * 0.05))
    : 1.0;
```

  Line 168 then returns `epc,` into the offer record. A pure-creativity commission (e.g. 100%) yields `epc = 8.0`; an offer with no commission data yields `1.0`. `scoreAffiliate` consumes this identically to a measured value, and no field marks it as derived.
- **Verdict:** FAIL
- **Severity:** high — ranking is driven by a fabricated number that looks measured, so offer choice is arbitrary while appearing data-driven.
- **Repro:** read `discovery-wave-helpers.ts:150-168`; assert `epc` field name and absence of any `epcIsEstimate`/`epcSource` sibling.
- **Remediation:** either source real EPC from campaign telemetry or rename to `epcEstimate` and carry an `epcBasis` discriminant (`'derived' | 'measured'`), and weight scoring by measured data only once it exists.

### A03 — Script facts are sourced; jurisdiction and hook selection are real

- **Invariant:** Claims in the generated script come from the offer record; the jurisdictional fallback is the conservative one; the "winning" hook is chosen on evidence.
- **Entrypoint:** three sites.
- **Production callers:** `src/forest/video/autonomous-video-orchestrator.ts:34,58-59`; `src/tree/video/prompts/crypto-script-prompt-builder.ts:27-28,58`.
- **Observed — (a) unsourced defaults become offer text:**

```typescript
// crypto-script-prompt-builder.ts:27-28
feeDiscountPct = 20,
signupBonusUsd = 1000,
// :58
`Offer: ${feeDiscountPct}% Lifetime Fee Kickback + up to $${signupBonusUsd} signup bonus ${codeText}.`,
```

  With no input, the script promises a 20% lifetime kickback and a $1000 bonus. The prompt line is emitted as offer text.

  **(b) jurisdictional fallback is GLOBAL, not US** — the master prompt's claim of a US fallback for crypto is wrong:

```typescript
// autonomous-video-orchestrator.ts:34
const effectiveJurisdiction = jurisdiction ?? targetJurisdiction ?? 'GLOBAL';
```

  **(c) first variant is claimed as the winner:**

```typescript
// autonomous-video-orchestrator.ts:58-59
const hookResult = generateHookVariants(campaignPlan, 'en');
const winningHook = hookResult.variants[0];
```

  `variants[0]` is selected with no performance evidence — there is no A/B result at this point in the flow.
- **Verdict:** FAIL
- **Severity:** critical for (a) — unsourced financial claims in customer-published video is a compliance and liability exposure; high for (b) and (c).
- **Repro:** call `buildCryptoScriptPrompt({exchangeName})` with no fee/bonus args and grep the returned prompt for `20%` / `1000`.
- **Remediation:** (a) require the fee/bonus fields on the input type instead of defaulting, and fail the build when they are absent; (b) confirm the intended fallback with the founder (GLOBAL vs US) and encode it explicitly; (c) treat `variants[0]` as a candidate and only label a hook "winning" after a split test reports a result.

---

### A08 — Budget allocation decisions use real measurements, not literals or fixtures

- **Invariant:** The Kelly/MAB allocation that spends real MCU budget is driven by measured arm performance and measured return, not by a literal default, a hardcoded dataset, or a mock fixture.
- **Entrypoint:** three sites on two paths.
  - Live money path: `src/land/growth-v14/predictive-render-actions.ts:51-56` — an authenticated server action that validates `availableMcuBudget > 0` and then writes `createPredictiveRenderJob`.
  - Display path: `src/forest/control-deck/control-deck-telemetry-service.ts:45,79,91` → `computeLiveControlDeckDataset()`.
- **Production callers:** the server action is reachable from the render UI; the telemetry service surfaces the control deck.
- **Observed — (a) the money path defaults to literals:**

```typescript
// predictive-render-actions.ts:51-56
const kellyResult = calculateKellyAllocation(
  {
    winProbability: input.winProbability ?? 0.65,
    projectedRoas: input.projectedRoas ?? 2.5,
    halfKelly: true,
    minFraction: 0.05,
    maxFraction: 0.4,
  },
  input.availableMcuBudget
);
```

  `winProbability` and `projectedRoas` are optional on the input type (`:30`, `:29`). Every caller in production omits them — `grep -rn "winProbability" src/` outside tests/kelly/predictive returns only the control-deck calculator, the hardcoded deck data, and UI display constants. So the authenticated, budget-validated path always allocates with `p = 0.65`, `roas = 2.5`.

  **(b) `?? 2.5` also appears as the telemetry fallback**, so the display number and the spend number agree on the same unmeasured value.

  **(c) the "live" calculator is fed a hardcoded dataset** — `src/tree/control-deck/live-bandit-calculator.ts:43` computes `posteriorMean = arm.alpha / pulls` (real math), but its input comes from `stitch-deck-data.ts:17-45`:

```typescript
mabArms: [
  { armId: 'arm-alpha-01', alpha: 142, beta: 19, roasMultiplier: '4.6x' },
  { armId: 'arm-beta-02',  alpha: 89,  beta: 31, roasMultiplier: '3.2x' },
  ...
```

  and `control-deck-telemetry-service.ts:45,79,91` calls `computeLiveControlDeckDataset()` with no argument, so it always reads those hardcoded counts. No DB read supplies alpha/beta anywhere in the service.

  **(d) the bandit worker itself is a fixture:**

```typescript
// bandit-traffic-worker.ts:33
const mockArms: BanditArm[] = [ ... ];
// :58
return evaluateBanditExperiment(experimentId, mockArms, 200);
```

  **(e) non-positive expectancy still spends.** `src/tree/growth-v14/kelly-allocator.ts:57-59`:

```typescript
const rawBounded = isPositiveExpectancy
  ? Math.min(maxFraction, Math.max(minFraction, fraction))
  : minFraction;
```

  When expectancy is negative the fraction is 0, but the bound falls back to `minFraction` (0.05) — so an arm with negative expected return still receives 5% of the available budget as "exploration".
- **Verdict:** FAIL
- **Severity:** critical — real MCU budget is allocated on a literal assumption, and the arm that shows the operator the decision is a hardcoded fixture.
- **Repro:** `grep -rn "winProbability" src/ | grep -v __tests__` → no production caller supplies it; `sed -n '40,55p' control-deck-telemetry-service.ts` → `computeLiveControlDeckDataset()` with no argument.
- **Remediation:** source alpha/beta/roas from measured telemetry (the `socialTelemetryIngestWorker` in A01 is the intended producer), make `winProbability`/`projectedRoas` required on the action input rather than defaulted, and decide explicitly whether `minFraction` is granted when expectancy is negative — if yes, account for it as a labelled exploration budget rather than a Kelly result.

### A09 — The render job the budget decision creates is actually executed

- **Invariant:** A recorded predictive-render job progresses through its stages and produces a rendered asset; the budget it allocated is accounted for.
- **Entrypoint:** `src/forest/growth-v14/predictive-render-worker.ts:14` (`predictiveRenderScheduleJob`, id `growth-v14-render-schedule`) and `:54` (`predictiveRenderEvaluateJob`, id `growth-v14-render-stage1-evaluate`).
- **Production callers:** none. The worker drives `updateJobStatusInD1(jobId, 'STAGE_1_RENDERING', 0)` at `:37` and two further transitions at `:88`/`:112`, but no registration includes it:

```bash
$ grep -rn "growth-v14-render-schedule\|growth-v14-render-stage1\|predictiveRenderScheduleJob\|predictiveRenderEvaluateJob" src/ \
    | grep -v __tests__ | grep -v "\.test\.ts"
src/forest/growth-v14/predictive-render-worker.ts:14:export const predictiveRenderScheduleJob = inngest.createFunction(
src/forest/growth-v14/predictive-render-worker.ts:16:    id: 'growth-v14-render-schedule',
src/forest/growth-v14/predictive-render-worker.ts:54:export const predictiveRenderEvaluateJob = inngest.createFunction(
src/forest/growth-v14/predictive-render-worker.ts:56:    id: 'growth-v14-render-stage1-evaluate',
```

  These four lines are the only matches in the whole tree — neither `growth-functions.ts` nor `core-functions.ts` imports them.
- **Observed:** the action at `predictive-render-actions.ts:62` writes the job row and returns success to the user. Because the executing jobs are unregistered, the row stays at its initial status forever. `getJobsForUser` (`:108`) then reports a job list that never advances. So MCU is allocated, the row exists, and no render ever runs.
- **Verdict:** FAIL
- **Severity:** critical — a budget-validated, authenticated write path whose only effect is a permanently-stuck row.
- **Repro:** the grep above; read `predictive-render-worker.ts:14,54` against the 42-entry `GROWTH_INNGEST_FUNCTIONS`.
- **Remediation:** register both jobs, and add an L2 test asserting the id list in `GROWTH_INNGEST_FUNCTIONS` (plus `core-functions` if applicable) contains `growth-v14-render-schedule` and `growth-v14-render-stage1-evaluate`.

### A04 — Audio is synthesized from a real provider, and a failure is not silent

- **Invariant:** The narration is synthesized through a real TTS provider using the operator's BYOK key, and when synthesis fails the pipeline does not continue as if audio exists.
- **Entrypoint:** `src/tree/video/render/niche-voiceover-generator.ts:52` (`generateVoiceover`), called from `src/forest/inngest/functions/niche-video-dispatcher.ts:153` (`step.run('generate-voiceover')`).
- **Production callers:** the dispatcher step, which is itself registered in `GROWTH_INNGEST_FUNCTIONS`.
- **Observed — (a) the provider call is real:**

```typescript
const output: VoiceoverOutput = await generateVoiceover({
  text: narrationText, tier: 'PREMIUM', voiceId: selectedVoice, userId,
});
return { success: true, audioUrl: output.audio_url, durationSec: output.duration, provider: 'elevenlabs' };
```

  **(b) but the failure path returns a mock-labelled result with no asset, and the caller never inspects it:**

```typescript
} catch (err: unknown) {
  logger.warn('generateNicheCampaignVoiceover: ElevenLabs generation failed, falling back', {...});
  return { success: false, provider: 'mock', error: error.message };
}
```

  The dispatcher passes the result straight into the composer (`niche-video-dispatcher.ts:163-169`) without checking `success`, and the composer reads it optionally at `src/tree/video/render/niche-render-composer.ts:63`:

```typescript
voiceoverUrl: voiceover?.audioUrl,
```

  `audioUrl` is absent on the failure result, so the manifest is produced with no audio track, and the dispatcher still terminates at `status: 'RENDER_READY'` (`:174`). A failed BYOK call is therefore indistinguishable from a silent render with no narration.
- **Verdict:** FAIL
- **Severity:** high — the operator is never told their video has no audio, and downstream consumers receive a manifest that cannot be assembled.
- **Repro:** `sed -n '50,80p' src/tree/video/render/niche-voiceover-generator.ts` and `sed -n '150,180p' src/forest/inngest/functions/niche-video-dispatcher.ts`.
- **Remediation:** make the dispatcher check `voiceover.success` and fail the job (or park it awaiting a key) instead of assembling a manifest without audio. An L2 test should force the ElevenLabs call to throw and assert the job does not reach `RENDER_READY`.

### A05 — Scene descriptors become real media assets

- **Invariant:** Each scene in the render manifest corresponds to a real generated/uploaded asset addressable by the renderer (an R2 key or provider URL).
- **Entrypoint:** `src/tree/video/render/niche-scene-visual-generator.ts`, consumed by `src/tree/video/render/niche-render-composer.ts`.
- **Production callers:** the dispatcher's `stage-video-artifacts` step, which is registered.
- **Observed:** the generator emits descriptors only. `SceneVisualAsset` carries `sceneId`, `order`, `aspectRatio: '9:16'`, `prompt`, `durationSec`, `assetType: 'image'`, `transition` and `captionOverlay` — there is no provider call, no upload, and no asset key. The `prompt` is a plain enriched string:

```typescript
`${scene.visualPrompt}, vertical orientation 9:16, 1080x1920, sharp focus...`
```

  No module anywhere sends that string to an image provider, and no consumer of `SceneVisualAsset` stores or retrieves a media object. The composer therefore builds a manifest whose scenes reference text prompts, not assets, and the chain ends at `RENDER_READY` — a status that, as established in B03/A04, has zero production consumers and is not an assembled video.
- **Verdict:** FAIL
- **Severity:** critical — this is the stage that turns a script into a video; it produces no media, so the engine cannot produce revenue from content.
- **Repro:** read the whole of `niche-scene-visual-generator.ts` (no provider import); `grep -rln "RENDER_READY" src/` → only the dispatcher and its test.
- **Remediation:** call a real image provider using the operator's BYOK key (`ImageGenerationProvider` in `@/seed/ai/image-generation-provider`), store the asset, and put its key on `SceneVisualAsset`; then make a real renderer consume `RENDER_READY`. Until that exists, no status in this pipeline may claim media readiness. L1/L2 only — an actual rendered asset needs L3.

### A06 — Distribution actually publishes to a real platform

- **Invariant:** A finished render is posted to a real platform through a real HTTP call, and the recorded URL is the platform's own response, not one constructed locally.
- **Entrypoint:** `src/forest/inngest/functions/social-direct-publish-job.ts` (`socialDirectPublishJob`, registered in `GROWTH_INNGEST_FUNCTIONS`), which calls `executePlatformUploadAdapter` at `src/forest/inngest/functions/social-direct-publish-steps.ts:42`.
- **Production callers:** the registered Inngest job.
- **Observed:** the adapter performs no network call. It builds a request payload for the platform, then fabricates the identifiers:

```typescript
if (data.platform === 'YOUTUBE_SHORTS') {
  buildYouTubeInitRequest({ title: data.title, description: data.description, tags: data.tags, totalSizeBytes: sizeBytes });
  calculateYouTubeChunks(sizeBytes);
  platformPostId = `yt_${data.jobId}`;
  publishedUrl = `https://youtube.com/shorts/${data.jobId}`;
} else if (data.platform === 'TIKTOK_V2') {
  buildTikTokInitPayload({ title: data.title, totalSizeBytes: sizeBytes });
  platformPostId = `tt_${data.jobId}`;
  publishedUrl = `https://tiktok.com/@${data.channelId}/video/${data.jobId}`;
}
```

  `buildYouTubeInitRequest` and `calculateYouTubeChunks` are called for their return values only; nothing POSTs them. The recorded `publishedUrl` is a string interpolation of our own `jobId`, and `recordSuccess(...)` is then called with that fabricated result. Separately, the render chain never reaches this job at all: the manifest produced in A05 terminates at `RENDER_READY` with no consumer, and `SocialPublishDispatchedEventData` carries its own `videoUrl` rather than reading a manifest.
- **Verdict:** FAIL
- **Severity:** critical — the job records a published URL that does not exist, so downstream metrics and attribution would be computed against fiction. This is the most dangerous row in the audit because it presents a fabricated success as a real distribution event.
- **Repro:** `sed -n '42,75p' src/forest/inngest/functions/social-direct-publish-steps.ts` — no `fetch`/HTTP client in the adapter; the `publishedUrl` values are template literals.
- **Remediation:** POST the built payload through the platform API via the BYOK token vault with the circuit breaker, and take `platformPostId`/`publishedUrl` from the platform response. Until a real response exists the job must fail, not synthesize. L3 is required for this row to pass — a green unit test over the fabricated string is not evidence.

### A07 — A verified postback records a commission

- **Invariant:** A postback that passes signature verification records a commission row that reconciliation can later read, under the correct tenant.
- **Entrypoint:** `src/app/api/postback/[network]/route.ts` re-exports POST from `src/app/api/postback/[network]/core/route-handler.ts`. The handler branches at `:126-127` on `DOMAIN_B_NETWORKS` (`'partnerstack', 'rewardful', 'binance', 'binance-link', 'bybit'`).
- **Production callers:** the route.
- **Observed — (a) signature enforcement is correct and fail-closed.** `verifyPostbackSignature` (`signature-verifier.ts:37-45`) returns `true` only in dev when disabled, `false` when no secret resolves, and `false` when HMAC fails. The Domain B branch resolves `secret` with a tenant fallback and passes it explicitly; the empty-secret fallback is safe because `processSaasCryptoPostback` still requires an HMAC match, so there is no raw-secret bypass.

  **(b) Domain B branch records the commission:**

```typescript
// saas-crypto-postback-service.ts:69-82
// 1. Write directly to Domain B immutable ledger (workspace_external_commissions)
INSERT INTO workspace_external_commissions (...)
```

  plus a `commission_events` idempotency row at `:104`.

  **(c) but the legacy branch records no commission at all.** For every network not in `DOMAIN_B_NETWORKS`, the handler does only this (`route-handler.ts:173`):

```typescript
await recordConversion(linkId, network, {...});
```

  and `recordConversion` (`src/land/tracking/link/click-ops.ts:68-85`) inserts into `tracking_conversions` — a raw payload row with `amount_usd`. It writes no commission row, so for those networks a real conversion never becomes an owed commission, and reconciliation has nothing to reconcile. `closed-loop-attribution-engine.ts` and `verifier/ledger-writer.ts` (which do write `commission_ledger`) have no production callers.

  **(d) the Domain B ledger it writes to does not exist** — see B07, which is now the gating defect for this row.
- **Verdict:** FAIL
- **Severity:** critical (compounded by B07) — the commission recording path is per-network inconsistent, and the half that does record writes to a table with no migration.
- **Repro:** `sed -n '126,180p' "src/app/api/postback/[network]/core/route-handler.ts"`; `sed -n '68,85p' src/land/tracking/link/click-ops.ts` → `INSERT INTO tracking_conversions`, no commission.
- **Remediation:** make every network branch converge on one ledger write (after B07's table exists), and remove the silent divergence between `tracking_conversions` and `commission_ledger`.

## Part B — OPC user platform

### B01 — Postback ingress rejects unsigned or unknown networks

- **Invariant:** A postback is credited only when the network secret resolves and the HMAC verifies; unknown networks are refused.
- **Entrypoint:** `src/app/api/postback/[network]/core/signature-verifier.ts:37-45` (`verifyPostbackSignature`), called from the network route handler.
- **Production callers:** the `/api/postback/[network]` route.
- **Observed:**

```typescript
const sigVerifyEnabled =
  (process.env.POSTBACK_SIGNATURE_VERIFICATION_ENABLED ?? '1') !== '0';

if (!sigVerifyEnabled) {
  logger.warn('[postback] Signature verification DISABLED — dev mode', { network });
  return true;
}

const secret = await resolveNetworkSecret(db, network, linkId);
if (!secret) {
  logger.warn('[postback] No network secret found — rejecting', { network, linkId });
  return false;
}
```

  Fail-closed when no secret. Per-network branches read the right header/param (`x-signature` for CEX, `pstack-signature` for PartnerStack, `x-rewardful-signature`, `signature` query for Awin, `cbreceipt` for ClickBank, `x-tiktok-signature`). `default:` logs and rejects. The handler resolves `const tenantId = linkRow?.tenant_id ?? 'default';`.
- **Verdict:** PASS (L2) for signature enforcement; the `?? 'default'` tenant fallback is tracked under A07.
- **Severity:** info on this row.
- **Repro:** `sed -n '37,110p' src/app/api/postback/[network]/core/signature-verifier.ts`.
- **Remediation:** none for signature policy. Keep the env kill-switch off in production.

### B04 — Approved content is hash-pinned and enforced before publish

- **Invariant:** What gets published matches what was approved; the approval cannot be edited after signing.
- **Entrypoint:** `src/tree/affiliate/approval/campaign-approval-repo.ts` (`createCampaignApproval`, `approveCampaignApproval`, `verifyAndEnforceCampaignApprovalD1`).
- **Production callers:** `src/forest/inngest/functions/niche-video-dispatcher.ts`, `src/tree/affiliate/approval/campaign-approval-guard.ts`, `src/land/missions/auto-video/mission-scheduler.ts`.
- **Observed:** the repo computes a SHA-256 payload hash via `computeApprovalPayloadHash(input.payload)`
  (`src/tree/affiliate/approval/campaign-approval-repo.ts:55`) over the JSON payload it stores in
  `campaign_approvals.approval_payload_hash`, and `verifyAndEnforceCampaignApprovalD1` re-verifies that
  hash. Three production call sites exist and are real: `niche-video-dispatcher.ts:94,131-132`,
  `mission-scheduler.ts:14,39`, and the dispatcher's own draft-first branch at
  `niche-video-dispatcher.ts:86-115`, which creates the approval when `plan.requiresCeoApproval` or
  `!plan.compliance.isAllowed`.
- **Boundary the row must state honestly:** the guard is enforced on the **render** boundary, not the
  **publish** boundary. `verifyAndEnforceCampaignApprovalD1` is never called by
  `src/forest/inngest/functions/social-direct-publish-steps.ts` (`grep -n "verifyAndEnforce\|Approval"`
  on that file → no match). The publish step that fabricates `publishedUrl` (see A06/B05) is therefore
  not covered by the hash pin. This is the same gap that cross-cutting scenario 4 exists to catch.
- **Verdict:** PASS (L2) **for the approval artefact and its hash pin**; the pin's enforcement
  boundary is the render step only, so it does not yet satisfy the mutation-after-approval invariant
  end to end.
- **Severity:** medium — the mechanism is correct and enforced, but on a boundary that A06 shows does
  not perform a real side effect, so the strongest enforcement currently guards the weakest step.
- **Repro:** read `campaign-approval-repo.ts:55` for the hash computation, `mission-scheduler.ts:39` for
  the render-boundary enforcement, then `grep -n "Approval" src/forest/inngest/functions/social-direct-publish-steps.ts`
  → no match, proving the publish side is unguarded.
- **Remediation:** call `verifyAndEnforceCampaignApprovalD1` inside `social-direct-publish-steps.ts`
  immediately before the upload adapter (after A06 replaces the adapter with a real HTTP call), and
  add the L2 negative test: mutate script after approval → guard rejects.

### B06 — Commission ledger never double-counts a reversed conversion

- **Invariant:** A conversion contributes to owed commission exactly once across its lifecycle, and totals are not summed across currencies.
- **Entrypoint:** `src/land/affiliates/reconciliation/workspace-domain-b-reconciliation.ts`.
- **Production callers:** `src/land/affiliates/dashboard/affiliate-cockpit-service.ts` → `src/app/[locale]/dashboard/affiliates/page.tsx`.
- **Observed:** lifecycle is `pending → approved → reversed → paid_receipt`, and a status-precedence map avoids double-counting:

```typescript
{ pending: 1, approved: 2, reversed: 3, paid_receipt: 4 }
```

  When no FX rate exists, totals are segregated per currency rather than summed at a fabricated rate.
- **Verdict:** PASS (L1) for the math — but the read path that carries this math into production is BLOCKED; see B07 immediately below.
- **Severity:** n/a alone; the severity sits on B07.
- **Repro:** read the reducer that applies the precedence map; assert per-currency segregation with a mixed-currency fixture.
- **Remediation:** none for the arithmetic.

### B07 — The reconciliation read path actually returns ledger rows

- **Invariant:** `fetchWorkspaceDomainBReconciliation` reads real commission rows for the workspace, tenant-isolated.
- **Entrypoint:** `src/land/affiliates/reconciliation/workspace-domain-b-reconciliation.ts:171` (`fetchWorkspaceDomainBReconciliation`), called from `src/app/[locale]/dashboard/affiliates/page.tsx:54-57`.
- **Production callers:** the affiliates dashboard page (a real call passing raw D1).
- **Observed:** the read is a genuine SELECT, not a placeholder:

```sql
SELECT id, tenant_id as tenantId, network, external_tx_id as externalTxId,
       gross_amount_cents as grossAmountCents, commission_cents as commissionCents,
       status, currency, occurred_at as occurredAt
FROM workspace_external_commissions
WHERE tenant_id = ?
ORDER BY occurred_at ASC
```

  **But the table has no migration.** Across all 433 files in `apps/sophia-ai-factory/migrations/`, `grep -rl "external_commissions"` returns nothing. The nearest analog, `0452_affiliate_ecosystem_ledger.sql`, creates a different table (`affiliate_commissions`). The writer's own comment at `saas-crypto-postback-service.ts:70` cites "migration 0480" for its dedup constraint, which is false — `0480_auth_2027_clean_slate.sql` contains no such table.
- **Consequence chain, verified line by line:** in production the SELECT throws, `fetchWorkspaceDomainBReconciliation` returns `failure`, and at `page.tsx:57` `domainBSummary` becomes `undefined`. Then `page.tsx:73-86` swallows the failure:

```typescript
} catch {
  tenantId = user.id;
}
```

  and the loader falls through to `return { domainBSummary: undefined, metrics: EMPTY_AFFILIATE_METRICS, killSwitchActive: false };`. Every figure renders as zero with no error, and the UI's `domain-b-empty-state` branch renders `t.emptyLedgerText` — so a missing table is **visually indistinguishable from a genuinely empty ledger**.
- **Verdict:** BLOCKED
- **Severity:** **critical** — the highest-leverage single defect in this audit. B06's math is correct but unreachable, A07's writer path writes to a table that does not exist, and the silence means no operator can tell.
- **Repro:** `grep -rl "external_commissions" apps/sophia-ai-factory/migrations/` → no output, against 433 files; `sed -n '54,86p' "src/app/[locale]/dashboard/affiliates/page.tsx"`.
- **Remediation:** add the `workspace_external_commissions` DDL migration and apply it to `sophia-raas-db` (back up D1 before the schema change, per repo rule); correct the stale "migration 0480" comment; and make the `catch` at `page.tsx:73-86` surface a real error instead of silently emitting all-zero metrics.

### B05 — A failed or stalled job is visible to the operator

- **Invariant:** When a render, publish or postback step fails, the operator sees it in the workspace and can act (the kill switch is the emergency lever).
- **Entrypoint (intended):** `src/forest/inngest/functions/niche-video-dispatcher.ts:31` (registered as `nicheVideoDispatcher`), triggered by `{ event: 'niche.video.campaign.requested' }`, dispatched client-side from `src/forest/actions/niche-video-actions.ts` (`dispatchNicheVideoCampaignAction`). Intended error surface: `/api/cron/error-digest`.
- **Production callers:** the dispatcher itself is registered — but every helper that would record or surface a failure is not.

```bash
$ grep -rn "scheduleSyndicationJob\|enqueueCommissionDlq\|loadLiveAffiliateMetrics" src/ \
    | grep -v __tests__ | grep -v "\.test\.ts"
src/forest/social/syndication-manager.ts:13: export ... scheduleSyndicationJob   # definition only
src/land/affiliates/commission-dlq.ts:30:          # definition only
src/land/affiliates/affiliate-live-metrics.ts:9:   # definition only
```

  `scheduleSyndicationJob` listens to the same `niche.video.campaign.requested` event and emits `publish.scheduled`, but it is never registered or invoked. `/api/cron/error-digest` also has no caller and no Inngest registration.

```bash
$ grep -rn "cron/error-digest" src/ | grep -v __tests__ | grep -v "\.test\.ts" | grep -v "api/cron/error-digest/"
(no output)

$ grep -rn "errorDigest\|error-digest" src/app/api/inngest/
(no output)
```

  Nothing in `src/` references the route, and neither `growth-functions.ts` nor `core-functions.ts` registers it. Note this is also the no-tech doctrine's known state: the digest route explicitly "is NOT operator-registered with an external cron", so even the route alone cannot fire on a schedule.

  The operator-facing workspace has no error surface at all. `src/app/[locale]/dashboard/affiliates/page.tsx:18-19` imports only `generateExecutiveCockpitSnapshot` and `mapDomainBToReconciliationSummary`; `affiliate-cockpit-service.ts` exports exactly three derivation functions (`deriveNicheBreakdownFromDomainB`, `mapDomainBToReconciliationSummary`, `generateExecutiveCockpitSnapshot`) and contains no reference to failures. `grep -rln error_log src/land/affiliates/` returns nothing.
- **Observed:** the full chain from `dispatchNicheVideoCampaignAction` onward is: dispatch event → `RENDER_READY` → no render step → no publish step → no failure record. The only error text anywhere on the affiliates dashboard is the kill-switch toggle's own local failure state (`AffiliateCockpitView.tsx:26,42,71`). The concrete silent failures this hides, all found elsewhere in this audit: a mission that reports `status: 'succeeded'` with no video (B03); two predictive-render jobs that never run because they are unregistered (A09); three learning-loop workers never dispatched (A01); a render chain that stops at `RENDER_READY` (A05); every postback rejected as `INVALID_SIGNATURE` because no network credential can be entered (B02); and a reconciliation read that throws because its table has no migration (B07). The kill switch itself is properly implemented — `toggleAffiliateKillSwitchAction` at `src/land/affiliates/actions/toggle-kill-switch-action.ts:34` and `getAffiliateKillSwitchAction` at `:94`, consumed by `runAutoVideoMission` — but it is an emergency stop, not an error surface.
- **Verdict:** FAIL
- **Severity:** high — the product's answer to "what is broken right now" is: nothing.
- **Repro:** the two greps above; `grep -n "export" src/land/affiliates/dashboard/affiliate-cockpit-service.ts` → three derivations, none error-related.
- **Remediation:** register the error-digest as an Inngest job, and add a "Cần duyệt / Có lỗi" section to the affiliates workspace that lists failed and stalled jobs derived from mission, predictive-render and postback state. An L2 test should fail a step and assert the row reaches that list.

### B02 — An operator can self-connect their affiliate network accounts

- **Invariant:** Per the no-tech doctrine, the operator enters their own network credentials in-app; no operator-side setup by the Sophia team is required.
- **Entrypoint (storage):** `src/tree/affiliates/credentials/types.ts:2` (9-network union: impact_radius, partnerstack, cj, shareasale, clickbank, binance, bybit, bitget, coinbase) and `storage.ts:11` (`saveCredentials`).
- **Entrypoint (HTTP):** `src/app/api/v1/integrations/affiliate-networks/route.ts` — GET lists, POST upserts. POST has `getCurrentUserFromHeaders` auth, `UpsertSchema` Zod validation, a rate limit of 20/min, and calls `saveCredentials(db, user.id, network, payload)`.
- **Production callers:** none.

```bash
$ grep -rn "v1/integrations/affiliate-networks" src/
src/app/api/v1/integrations/affiliate-networks/route.ts:2: * GET  /api/v1/integrations/affiliate-networks — list configured networks for tenant
src/app/api/v1/integrations/affiliate-networks/route.ts:3: * POST /api/v1/integrations/affiliate-networks — upsert network credentials
src/app/api/v1/integrations/affiliate-networks/route.ts:4: * @module app/api/v1/integrations/affiliate-networks/route
```

  Those four lines are the whole result — the route has no in-app consumer. The Setup Wizard cannot supply these credentials either: its provider union is `user-credentials-helpers.ts:17`, which is `'heygen' | 'heygen_webhook_secret' | 'resend' | 'nowpayments' | 'local_llm' | 'kling' | 'assemblyai' | 'openai' | 'openrouter' | 'replicate'` — no affiliate network appears, and both wizard pages contain zero occurrences of the string `affiliate`.
- **Observed:** the storage layer, the encryption path and the network union are all real, but the write path is an API with no UI, so a non-technical operator cannot reach it. Since `resolveNetworkSecret` (`src/land/postback/network-secret-resolver.ts:50-68`) reads these same credentials, the consequence compounds: with no credential entered, the postback route returns `false` at `signature-verifier.ts:56` ("No network secret found — rejecting"), so every postback is rejected and no commission can ever be recorded.
- **Verdict:** FAIL
- **Severity:** critical — the platform's commission ingestion is unreachable for the intended user, and the failure mode is silent rejection.
- **Repro:** the grep above; `grep -c affiliate "src/app/[locale]/setup-wizard/page.tsx"` → `0`.
- **Remediation:** add the six-group "Kết nối" surface (nav group 6 of the UX prescription) that calls GET/POST on this route, and add the affiliate step to the Setup Wizard. Also tighten `POST`: the two-step cast at `route.ts:76-82` bypasses the per-network payload shape and should become a discriminated Zod schema per network.

### B03 — A picked offer becomes a runnable campaign

- **Invariant:** A discovered affiliate offer, once picked by the operator, becomes a durable campaign that the video pipeline acts on.
- **Entrypoint:** `src/land/affiliates/actions/discover-offers-action.ts:51` (`discoverAffiliateOffersAction`) and `src/land/affiliates/actions/convert-offer-action.ts:37` (`convertOfferToCampaignAction`) → `src/land/affiliates/campaign-bridge.ts:43` → `src/land/missions/auto-video/auto-video-service.ts:24`.
- **Production callers:** **NONE.**

```bash
$ grep -rn "convertOfferToCampaignAction\|discoverAffiliateOffersAction" src/ \
    | grep -v __tests__ | grep -v "\.test\.ts"
src/land/affiliates/actions/discover-offers-action.ts:51:export async function discoverAffiliateOffersAction(
src/land/affiliates/actions/convert-offer-action.ts:37:export async function convertOfferToCampaignAction(
```

  Both lines are definitions; no caller exists. A second path exists but is also clientless: `src/app/api/affiliate-discovery/affiliate-discovery-helpers.ts:117` calls `runAgenticDiscoveryWave` in a POST handler, but no UI component fetches `/api/affiliate-discovery` — the only non-test references are a sample command in `src/seed/guide/guide-backend-catalog.ts:55` and `src/tree/aeo/resolve-aeo-route.ts:77`. The Stitch panel that would hold the picked offer, `src/components/stitch/screens/affiliates/discovery/use-affiliate-discovery.ts`, keeps `selectedOffer` as client state with no persistence call and is not mounted in any route.
- **Observed:** the conversion logic itself is written and unit-tested — `runAutoVideoMission` inserts a mission row, checks the tenant kill switch, then runs script generation, an affiliate-enriched description, a video submit and a publish schedule. Two of those steps are optional and their absence is swallowed rather than surfaced (`mission-scheduler.ts:83-89`):

```typescript
} catch (err) {
  if (err instanceof RenderByokVideoError && err.code === 'BYOK_REQUIRED') {
    logger.info('[auto-video-mission] HeyGen render skipped (no BYOK key)', { missionId });
    return undefined;
  }
```

  `submitMissionVideo` returns `undefined` when no HeyGen key is configured and `scheduleMissionPublish` returns `undefined` when `input.channelId` is absent, while `runAutoVideoMission` still records `status: 'succeeded'` at `:69`. So even the correct-looking downstream chain would report success with neither media nor a publish.
- **Verdict:** FAIL
- **Severity:** **critical** — the entry point is unreachable. An offer never leaves the discovery list, so no campaign is created at all. (My earlier note that "offer → campaign record works" was wrong: it is correct about the code that exists, but that code has no production caller, which by the acceptance ladder is the same as absent.)
- **Repro:** the grep above; `grep -rn "convertOfferToCampaignAction" src/` outside the definition and its test returns nothing.
- **Remediation:** mount a discovery/pick UI wired to `convertOfferToCampaignAction` (or the `/api/affiliate-discovery` POST), confirm a campaign row is written to D1, and give the mission a distinct terminal status when video or publish is skipped. Add an L2 test that runs the mission without a BYOK key and asserts the status is not plain `succeeded`.

### B08 — One workspace holds offers, campaigns, approvals, results and connections

- **Invariant:** The prescribed six-group navigation (Hôm nay / Offers / Chiến dịch / Cần duyệt / Kết quả / Kết nối) is reachable from one affiliate workspace, so a single operator runs everything without leaving the surface.
- **Entrypoint:** `src/app/[locale]/dashboard/affiliates/page.tsx` (171 lines).
- **Production callers:** the authenticated dashboard route.
- **Observed:** none of the six nav groups exist. `grep -rn "Cần duyệt" src/` returns zero nav-related hits; `grep -rn "Hôm nay" src/` returns three unrelated matches (an email template and two script templates). The page renders only a bilingual header (`page.tsx:111-120`), `AffiliateCockpitView` (`:123`), three KPI cards (`:129-165`) and `AffiliateHookRankingTable` (`:168`). Three further defects:
  1. Two of the three KPI cards are structurally always zero, because `EMPTY_AFFILIATE_METRICS` is spread in and only one field is overridden (`affiliates-dashboard-sections.ts:15`):

```typescript
metrics: {
  ...EMPTY_AFFILIATE_METRICS,
  totalCommissionUsd,
},
```

     leaving `totalBridgeClicks` and `totalVideosGenerated` hardcoded at 0, under labels promising "Bridge Page Clicks" and "Syndicated Videos".
  2. `AffiliateHookRankingTable` is rendered with no `hooks` prop, so it is permanently in an empty state.
  3. There is no approval queue: the `DRAFT_PENDING_CEO_APPROVAL` branch that exists in the dispatcher at `niche-video-dispatcher.ts:112` is never surfaced to the operator.
- **Verdict:** FAIL
- **Severity:** high — the domain logic exists, but the workspace is not assembled, so the product is not usable as specified even where the underlying rows are correct.
- **Repro:** `wc -l "src/app/[locale]/dashboard/affiliates/page.tsx"` → 171; `grep -n "approvals"` on that page → no match; `ls "src/app/[locale]/dashboard/affiliates/portal/"` → `page.tsx` only.
- **Remediation:** implement the six-group navigation as the single affiliates shell, and route each group at the existing data: Offers at discovery, Chiến dịch at missions, Cần duyệt at the existing approval queue, Kết quả at reconciliation, Kết nối at the B02 credential surface.

---

### B09 — Release structure and support-capability evidence back the claims

- **Invariant:** The release structure and support evidence must be real: four-layer
  boundaries hold, Next/CF runtime compatibility is demonstrated, D1 delta migrations are
  git-tracked and reachable, build artifacts exist, registered routes/functions match the
  docs, VI/EN parity holds, capability docs/AEO match the code, the three protected flows
  are intact, rollback and env flags work. A green CI or HTTP 200 does **not** prove the
  money flow or customer readiness. Ship/live SHA verification is a separate gate that runs
  only under authorization; if unchecked it is recorded NOT VERIFIED, never PASS.
- **Entrypoint:** `.github/workflows/deploy.yml` (`stage-1-quality-gate` → `stage-2-3-build-and-deploy` → `stage-4-post-deploy-verification`), plus `scripts/apply-migrations.sh`, `scripts/check-layer-boundaries.sh`, `scripts/check-migration-coverage.sh`, `scripts/post-deploy-smoke.mjs`, and `scripts/validate-i18n-keys.mjs`.
- **Production callers:** the workflow itself, on push to `main` and on `workflow_dispatch`.

Observed, sub-item by sub-item.

**(1) Four-layer boundaries — PASS at L1, verified by the exact CI command.**
`bash scripts/check-layer-boundaries.sh` is Gate 1c at `deploy.yml:65` and enforces the
forbidden directions declared in `.claude/rules/sophia-layer-architecture.md`
(`seed → tree/forest/land`, `tree → forest/land`, `land → forest`), with the documented
`forest → land` orchestration exception. This gate has teeth and runs on every push.

**(2) D1 delta migrations are git-tracked — PASS, but the tracking mechanism is a
per-file allowlist that silently excludes new files.**
`ls migrations/*.sql | wc -l` → **432** top-level files on disk (433 entries including
`_archive/`, which holds 5 more); `git ls-files migrations | wc -l` → **437**
(432 top-level + 5 `_archive/`). The historical set is fully tracked: `comm -23` of the disk
list against the tracked list is empty, and `git status --porcelain --ignored --untracked-files=all
-- migrations` reports **0** ignored and 0 untracked. That however is a property of files
already in the index, not of the rules. The mechanism is `.gitignore:86-90`:
```
*.sql
!apps/sophia-ai-factory/migrations/0188_add_amount_vnd_to_pending_orders.sql
!apps/sophia-ai-factory/migrations/0475_nowpayments_refund_barriers.sql
!apps/sophia-ai-factory/migrations/0476_subscriptions_org_status_idx.sql
!apps/sophia-ai-factory/migrations/0477_payos_contract_fulfillment.sql
```
i.e. `*.sql` is ignored by default and only 4 explicit `!` lines make specific migrations
visible to git. `git check-ignore -v` on an existing file returns `rc=1` (not ignored)
purely because it is already tracked — **tracked files are exempt from ignore rules**, which
is exactly why the 432-file set looks healthy. The design is proven broken by probe: I
created `migrations/9999_probe_tmp.sql` containing a real `CREATE TABLE`, ran
`git check-ignore -v`, and got
```
.gitignore:86:*.sql  apps/sophia-ai-factory/migrations/9999_probe_tmp.sql
```
with `git status --ignored --untracked-files=all` listing it as `!!`. The probe was then
deleted; no file was added to the index. **A new migration authored without a matching `!`
line is therefore invisible to git, invisible to the CI delta at
`scripts/apply-migrations.sh:993` (`git diff --name-only ... "$REF" HEAD -- migrations/`),
and silently never applied to production D1** — the CI delta only sees *changed tracked*
files, so an untracked-and-ignored migration is doubly invisible. This is the exact mechanism behind the
B07 gating defect — `workspace_external_commissions` has no migration among 433 files, and
nothing in CI would have caught it, because the delta is computed by
`scripts/apply-migrations.sh:993`:
```bash
MIGRATIONS=$(git diff --name-only --diff-filter=d --relative "$REF" HEAD -- migrations/ ...)
```
which only ever sees *changed* files. A table never declared in any migration is not a
"changed" file — it is simply absent, and the guard has no opinion on absence.
There is a guard that would catch the orphan-table shape,
`scripts/check-migration-coverage.sh` (its own header cites the incident it was written
for: "SQL files in src/ that declare CREATE TABLE but live OUTSIDE the canonical
migrations/ folder ... Those tables never reach production D1"), but
`grep -rn "migration-coverage" .github/workflows/` returns **nothing**. It is not wired into
Gate 1. The release structure therefore has a detector for the failure class that actually
bit this build, and it is not running.
**(3) The guard that *is* wired covers the wrong half of the problem.** Stage 2a
(`deploy.yml:122-143`) is genuinely strict about the *shape* of the delta — it fetches the
live `/api/version`, refuses to proceed on a missing or malformed `shortSha`, and refuses to
proceed if the live SHA does not resolve to a commit in the checkout. That is real
defensive engineering on the deploy-arithmetic side. But it validates the *ref*, never the
*schema*, so a missing-table regression passes cleanly.

**(4) VI/EN parity — PASS, verified by running the gate, not by trusting it.**
`npm run i18n:validate` (`scripts/validate-i18n-keys.mjs`) → 5390 `t()` calls, 2392 unique
static keys, 41 dynamic prefixes, **0 missing static keys, 0 unresolved dynamic prefixes**.
Independently flattened both catalogues and compared the `affiliates*` / `dashboard*`
namespaces: **1408 keys in `vi.json` and 1408 in `en.json`, 0 missing in either direction.**
Note the contract this establishes for the remediation: any new affiliates UI copy must add
keys to *both* files or Gate 1d goes red.

**(5) Registered routes/functions — FAIL, and it is the same defect as A01.**
`GROWTH_INNGEST_FUNCTIONS` registers 40 functions; `banditTrafficWorker`
(`src/forest/growth-v13/bandit-traffic-worker.ts:20`), `creativeDeliberationWorker`
(`src/forest/growth-v13/creative-deliberation-worker.ts:12`), and
`flywheelFeedbackDispatcherJob`
(`src/forest/inngest/functions/flywheel-feedback-dispatcher.ts:92`) are exported but
absent from `src/app/api/inngest/serve/growth-functions.ts`. Both
`predictiveRenderScheduleJob` and `predictiveRenderEvaluateJob`
(`src/forest/growth-v14/predictive-render-worker.ts:14,54`) are likewise unregistered.
CI compiles and lints all of them because they are perfectly valid TypeScript — an
unregistered Inngest function is invisible to every quality gate. Nothing in the release
structure detects "exported but never served".

**(6) Protected flows — present at L1, not proven at L2/L3.**
Setup Wizard at `src/app/[locale]/setup-wizard/page.tsx` with `src/app/api/setup-wizard/` and
`src/app/api/setup/` behind it; Telegram at `src/app/api/webhooks/telegram/route.ts` with
`__tests__/route-sales-bifurcation.test.ts`; NOWPayments at
`src/app/api/webhooks/nowpayments/`, PayOS at `src/app/api/webhooks/payos/ipn/route.ts`
with its own route test. All three flows have code and the payment path has tests. But
`grep -rln "affiliate" "src/app/[locale]/setup-wizard/"` returns **nothing**, which is the
B02 defect seen from the release side: the doctrine says affiliate-network keys are entered
by the customer in the Setup Wizard, and the Setup Wizard has no affiliate step. So the
release structure preserves the protected flows while the product's own onboarding gate
never opens the affiliate door.

**(7) Rollback and environment flags — PASS at L1.** Rollback is documented in
`.claude/rules/sophia-deploy-verify.md` as `npx wrangler rollback --name sophia-ai-factory
--yes` or revert-and-push. Flags exist and are respected by the workflow:
`dry_run` and `skip_migrations` gate Stage 2a (`deploy.yml:119`), `dry_run` gates the
Worker deploy and secret injection (`:158`, `:162`), and Stage 4 post-deploy verification is
gated on `${{ !inputs.dry_run && (github.event_name != 'workflow_dispatch' ||
inputs.force_verify) }}` (`:183`) so a manual dry run does not fail on stale SHA comparison.
`post-deploy-smoke.mjs` additionally documents a `SKIP_SMOKE_TEST=1` bypass. The
break-glass path is closed: the workflow never calls `EMERGENCY_CF_DIRECT=1 npm run
deploy:full`, and that flag is absent from `deploy.yml` entirely.

**(8) What green CI actually proves — this is the sub-item the scope doc calls out.**
The smoke suite asserts exactly four things (`scripts/post-deploy-smoke.mjs:199-209`):
`/api/health` → 200, `/api/version` shortSha == expected, `/login` → {200,302,307,308},
`/vi/login` → 200. That is liveness and deploy-freshness. It does not exercise a single
affiliate path: no postback, no commission write, no render, no publish, no reconciliation
read. Combined with B07, the consequence is precise: **the pipeline can deploy a build in
which every affiliate figure on the customer dashboard is zero and every gate is green.**
Green CI/HTTP 200 is therefore not evidence of money-flow or customer readiness, and I have
not treated it as such anywhere in this matrix.

**(9) Ship/live SHA verification — NOT VERIFIED (deliberately, and by scope).**
The mechanism is present and strict (`deploy.yml:198-224` polls the live SHA against
`github.sha` for up to 75 seconds and fails hard on mismatch; Stage 4a is the "Live SHA
Match" line the deploy rule says is the only line that proves the deploy). I did not run a
deploy, and the master prompt forbids remote migrations and operator-side production
actions, so **no live SHA was read and no live endpoint was probed in this audit.** Per the
acceptance ladder this row is NOT VERIFIED, and I am explicitly not recording it as PASS.

**(10) Capability docs/AEO vs code — FAIL.** The affiliate capability is advertised in the
product surface (the affiliates dashboard, the bilingual copy, the discovery and conversion
actions) while the runtime that would produce the claimed outcome is unregistered (A01) or
terminates early (A05 `RENDER_READY`, A06 fabricated publish). The docs claim a
video-to-commission engine; the code has 17 of 18 audit rows in FAIL or BLOCKED state. A
green build does not reconcile that gap, and no AEO route makes it honest.
- **Verdict:** FAIL
- **Severity:** high — the release mechanics themselves are largely sound (strict Stage 2a ref
  validation, real gates 1a–1e, working rollback, honest flags, genuine VI/EN parity), but
  three structural gaps let a broken money flow ship green: (a) new migrations are excluded
  from git by default, so a missing table is invisible to the delta guard; (b) the guard
  that detects orphan `CREATE TABLE` statements exists but is not wired into CI; (c) no gate
  detects an exported-but-unregistered Inngest function, and the smoke suite covers no
  affiliate path at all.
- **Blocking interaction with B07:** B09(b) is the *reason* B07 could happen. Adding the
  `workspace_external_commissions` migration fixes the instance; wiring
  `check-migration-coverage.sh` into Gate 1 and requiring a `!` allowlist entry for every
  new migration fixes the class.
- **Repro (read-only):** `grep -rn "migration-coverage" .github/workflows/` → empty;
  `printf 'CREATE TABLE IF NOT EXISTS probe_tmp_check(id TEXT PRIMARY KEY);\n' >
migrations/9999_probe_tmp.sql && git check-ignore -v migrations/9999_probe_tmp.sql` →
matched by `.gitignore:86:*.sql`;
`git ls-files migrations | wc -l` → 437 against `ls migrations/*.sql | wc -l` → 432;
  `node scripts/validate-i18n-keys.mjs` → 0 missing keys;
  `grep -n "runSmokeChecks\|/api/health" scripts/post-deploy-smoke.mjs` → 4 assertions, no
  affiliate endpoint.
- **Remediation:** (i) wire `bash scripts/check-migration-coverage.sh` into Gate 1 as 1f;
  (ii) add a CI check that every `inngest.createFunction` export in `src/forest/` is
  reachable from `src/app/api/inngest/serve/`; (iii) extend `post-deploy-smoke.mjs` with an
  authenticated affiliates smoke that proves at least one postback → commission →
  reconciliation read end to end; (iv) replace the per-file `.gitignore` allowlist with a
  tracked-manifest rule so new migrations are visible to git by default.

---

## Rows still open

| Row | Subject | Status |
|---|---|---|
| A04 | real TTS audio → real uploaded asset | FAIL — written below |
| A05 | scene descriptor → real image asset | FAIL — written below |
| A06 | render manifest → real publish | FAIL — written below |
| A07 | verified postback → real commission row | FAIL — written below |
| B07 | reconciliation reads real ledger rows | BLOCKED (critical) — written below |

**All 18 groups written:** A01 FAIL · A02 FAIL · A03 FAIL · A04 FAIL · A05 FAIL · A06 FAIL · A07 FAIL · A08 FAIL · A09 FAIL · B01 PASS · B02 FAIL · B03 FAIL · B04 PASS (L2, render boundary only) · B05 FAIL · B06 PASS (L1 math only) · **B07 BLOCKED (critical)** · B08 FAIL · B09 FAIL.

---
