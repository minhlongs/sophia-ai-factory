# Runtime map — canonical execution path, AS-IS → TO-BE

Scope: `apps/sophia-ai-factory/src` at `main@439635e1` (baseline) vs this branch. "Consumer" means
a registered runtime (Server Action, route handler or Inngest function) that actually reads the
value. A module with no consumer is either connected here or explicitly inactive.

## 1. AS-IS (baseline) — where the chain broke

```
[UI / Telegram / job]
  dispatchNicheVideoCampaignAction ──► inngest "niche.video.campaign.requested"
        (no tenantId, no offerId, no approvalId, no idempotencyKey, no budget)
              │
              ▼
  nicheVideoDispatcher (registered in growth-functions.ts)
        createNicheVideoCampaignPlan → synthesizeNicheScript → generateNicheCampaignVoiceover
              │
              ▼
        composeNicheRenderManifest (scene descriptors + ffmpeg filter string)
              │
              ▼
        return { status: 'RENDER_READY' }   ❌ descriptor labelled as ready media
              │
              └── NO CONSUMER, NO D1 RUN, NO ARTIFACT, NO PUBLISH, NO CLICK, NO LEDGER
```

Consequences observed in source:

- `agent_campaign_approvals`, `workspace_external_commissions`, `opc_postback_events`,
  `affiliate_execution_runs`, `affiliate_media_artifacts`, `opc_feedback_events`,
  `opc_bandit_arms` were referenced by production repositories but had **no DDL** in the checked-in
  migrations (the first three were the critical ones).
- `commission_events` (migration 0206) has a **global** `event_id` primary key, so a tenant A
  replay could suppress tenant B's postback.
- `banditTrafficWorker` was never registered as a spend path; the old flywheel dispatcher consumed
  mock analytics and was not registered in `growth-functions.ts`.
- `auto-video-service` reported skipped/errored renders as success; `auto-campaign-scaler`
  dispatched a fabricated `Winning Hook: …` offer with `tenant_<id>` as user and `GLOBAL` market.
- Dashboard showed a single summed "earnings" number and treated read errors as zero / kill-switch
  off. Landing showed `LIVE DECK`, REC, avatars, star ratings and creator counts.

## 2. TO-BE (this branch)

```
┌─ ENTRYPOINTS (server resolves identity) ─────────────────────────────────────────┐
│ dispatchNicheVideoCampaignAction  (Server Action, 'use server')                 │
│   getCurrentUser → resolveOrgId(createServerClient()) → tenantId                 │
│   getD1 + verifyOfferEligibility → termsVerified                                 │
│ Telegram / other producers MUST supply the same event shape (NOT VERIFIED here)  │
└───────────────────────────────┬────────────────────────────────────────────────┘
                                ▼  inngest.send
  event `niche.video.campaign.requested`  (src/seed/inngest/events/pipeline-autonomous-events.ts)
  { userId, tenantId, offerId, termsVerified, approvalId?, approvalHash?,
    maxRenderCostCents?, targetAccount?, idempotencyKey, niche, blueprintId,
    productName, productUrl, productUrl provenance, locale, market/jurisdiction }
                                ▼
  nicheVideoDispatcher  (REGISTERED: src/app/api/inngest/serve/growth-functions.ts)
    1. createNicheVideoCampaignPlan (compliance; VIETNAM_PROMOTIONAL_BAN etc.)
    2. synthesizeNicheScript (sourced facts, explicit locale)
    3. buildApprovalPayload(script, trackedUrl, jurisdiction, disclosure,
                            maxRenderCostCents, targetAccount) → currentHash
    4. if needsCeoApproval → createCampaignApproval(D1) →
         { DRAFT_PENDING_CEO_APPROVAL, state: approval_pending, mediaReady:false }
    5. verify-side-effect-gate step (re-runs after any retry/sleep):
         getAffiliateKillSwitchState (fail-closed)
         verifyAndEnforceCampaignApprovalD1 (re-read stored hash from D1)
         evaluateRenderGate → TENANT_REQUIRED / KILL_SWITCH_ACTIVE /
           UNVERIFIED_ELIGIBILITY / APPROVAL_INVALIDATED / BUDGET_EXCEEDED / …
    6. generateNicheCampaignVoiceover → failed or mock(non-test) ⇒
         { FAILED, state: failed, reason: PROVIDER_UNAVAILABLE }  (no manifest)
    7. beginExecutionRun(D1) + transitionRun('approval_pending' → 'render_queued')
    8. composeNicheRenderManifest →
         { RENDER_QUEUED, state: <durable state>, runId,
           manifestIsMedia:false, mediaReady:false, artifactId:null,
           nextAction:'render_worker' }
       On replay of an advanced run: { RUN_ALREADY_ADVANCED, state:<real state> }
                                ▼
  (FUTURE / REAL PROVIDER — NOT IMPLEMENTED, NOT CLAIMED)
  render worker → VerifiedArtifact (storageKey, byteSize, checksumSha256, verifiedAtMs)
      → recordVerifiedArtifact(D1) → affiliate_media_artifacts + run.artifact_id
      → state: rendered
      → evaluatePublishGate(artifact + approved link + targetAccount + halt + budget)
      → publish_queued → published | failed | blocked | cancelled
                                ▼
  click / conversion / provider webhook  (HMAC verified)
      → opc_postback_events (tenant_id, event_id)  [ingest lock, replay-safe]
      → commission_events (global PK, namespaced `${tenantId}:${eventId}`)
      → workspace_external_commissions  [CHECK platform_fee_cents = 0]
          status: pending | approved | paid_receipt | reversed
          partial refunds: external_tx_id = `<tx>#adj:<hash>` (immutable history)
                                ▼
  fetchWorkspaceDomainBReconciliation(D1, tenantId) → computeDomainBReconciliation
      → per-currency buckets; totalsAvailable:false when mixed
      → AffiliateCockpitView / AffiliatesDashboardPage (results group)
                                ▼
  observed analytics event `social.analytics.feedback_evaluated`
      → flywheelFeedbackDispatcherJob (REGISTERED in growth-functions.ts)
      → refuse isFixture / missing tenant / missing impressions
      → opc_feedback_events (once-only lock) → opc_bandit_arms (persisted posterior)
      → chooseNextArm(seededRandom(seed)) → next decision from persisted data only
```

## 3. State vocabulary (single source of truth)

`src/tree/affiliate/execution/execution-contract.ts` → `EXECUTION_STATES`:

`draft → approval_pending → render_queued → rendered → publish_queued → published`,
with `blocked`, `failed`, `cancelled` as explicit non-success terminals. `transitionExecutionState`
is the only function allowed to authorise a transition; `transitionRun` performs it as a D1 CAS
(`WHERE state = ?`).

| Producer output | Meaning | Forbidden interpretation |
| --- | --- | --- |
| `DRAFT_PENDING_CEO_APPROVAL` | draft staged, no spend | "approved", "queued" |
| `RENDER_QUEUED` | durable queue row exists; manifest is a descriptor | "rendered", "media exists", "succeeded" |
| `FAILED` / `BLOCKED` | typed failure reason persisted | "0 results" / "success" |
| `EVALUATED` (scaler) | decision computed; `dispatchedCount` may be 0 | "campaigns launched" |
| `NOT_AVAILABLE` (bandit worker) | module intentionally inactive | "winner promoted" |

## 4. Durable state — migration 0482

`migrations/0482_opc_affiliate_execution_truth.sql` (idempotent, D1/SQLite compatible; applied
twice in tests against a DB that already has migration 0206).

| Table | Key / constraint | Consumer |
| --- | --- | --- |
| `workspace_external_commissions` | `UNIQUE(tenant_id, network, external_tx_id, status)`, `CHECK(platform_fee_cents = 0)`, currency per row | postback service, reconciliation, cockpit/results |
| `agent_campaign_approvals` | payload hash + status + `invalidated_reason` | `campaign-approval-repo.ts` |
| `opc_postback_events` | `PRIMARY KEY(tenant_id, event_id)` | `processSaasCryptoPostback` ingest lock |
| `affiliate_execution_runs` | `UNIQUE(tenant_id, idempotency_key)`, state `CHECK` | dispatcher, `execution-repo.ts` |
| `affiliate_media_artifacts` | `UNIQUE(tenant_id, run_id, storage_key)`, `is_fixture` | `recordVerifiedArtifact` |
| `opc_feedback_events` | `PRIMARY KEY(tenant_id, event_id)` | `recordFeedbackOnce` exactly-once lock |
| `opc_bandit_arms` | `PRIMARY KEY(tenant_id, arm_id)` | persisted posterior / seeded selection |
| `commission_events` (0206) | global PK — **namespaced by tenant in code** | legacy idempotency mirror |

Root `.gitignore` ignores `*.sql`; a specific exception was added for 0482 (repo convention, cf.
0475–0477). Plan docs live under an ignored `plans/` directory and were force-added.

## 5. Registered runtimes vs inactive modules

| Module | Where registered | Status | Test |
| --- | --- | --- | --- |
| `nicheVideoDispatcher` | `growth-functions.ts` via Inngest serve route | ACTIVE, produces queue entry only | `niche-video-dispatcher.test.ts` |
| `flywheelFeedbackDispatcherJob` | `growth-functions.ts` (added) | ACTIVE, consumes `social.analytics.feedback_evaluated` | `route-registration.test.ts`, `flywheel-feedback-dispatcher.test.ts` |
| `autonomousCampaignScalingFlow` | `growth-functions.ts` | ACTIVE, but dispatch requires verified offer + approval | `autonomous-campaign-scaling-flow.test.ts` |
| `agentMissionExecutor` / auto-video mission | existing Inngest registration | ACTIVE, typed skip/error now | `auto-video-mission-proof.test.ts` |
| `banditTrafficWorker` | not registered as a spend path | **INACTIVE**, `NOT_AVAILABLE` | `bandit-traffic-worker.test.ts` |
| Real render/publish provider worker | — | **NOT IMPLEMENTED** | `evaluateArtifactGate` / `evaluatePublishGate` block until it exists |
| Real analytics provider correctness | — | **BLOCKED** (no credentials) | labelled `isFixture:true` mock events |

## 6. UI surface map (no parallel dashboard)

| Route / component | Server contract | Notes |
| --- | --- | --- |
| `src/app/[locale]/page.tsx` → `landing-hero` | `buildSignupEntryHref` | preserves `offerId`, `locale`, `returnTo`, tier; illustrative preview |
| `src/forest/dashboard/dashboard-nav-modules.ts` → `dashboard-nav-items.tsx` | existing auth/permission helpers | 6 primary groups + "More tools" (16 legacy links) + separate Refer Sophia |
| `src/app/[locale]/dashboard/affiliates/page.tsx` | `getCurrentUser`, `resolveOrgId`, `createServerClient`, `fetchWorkspaceDomainBReconciliation`, `getAffiliateKillSwitchState` | `resolveDashboardViewState` → unauthenticated / unconnected / empty / error / ready |
| `src/land/affiliates/dashboard/affiliate-cockpit-service.ts` | `DomainBReconciliationSummary` | `financialsAvailable`, `currencies` |
| `src/forest/actions/niche-video-actions.ts` | Inngest event | server-resolved tenant + verified offer |

No new database was introduced for the UI; no mock success path was added to the operator surface.
Browser/render-level verification was not performed (mandate).
