# Sophia OPC Affiliate — Cross-Cutting Scenario Verification

The scope doc (`SOPHIA_TWO_TRACK_AUDIT_SCOPE_2026-10-27.md`) requires 8 cross-cutting
scenarios. Each is proven at the real route / action / registered-runtime boundary — a
test-only consumer does **not** satisfy a scenario. Acceptance levels are never mixed: no
row below is marked PASS on L1 evidence when its invariant sits at L2 or higher.

Read-only inspection. No builds, no tests run, no migrations applied, no production
endpoint probed, no external service called.

- **Snapshot:** `439635e1a2017c2643e013c0311631bd95409de4`

## Scenario 1 — SaaS: workspace → verified offer → VI/EN draft → approval → render/publish fixtures → click → pending → approved → paid

Every ID, currency and piece of evidence must connect.

**Verdict: FAIL (L2).** The chain breaks at four independent points, and each break is
provable rather than inferred:

1. **Verified offer never enters the product** — `discoverAffiliateOffersAction` and
   `convertOfferToCampaignAction` have zero production callers (`grep -rn` outside the
   defining files returns only their own tests), and the Stitch panel holding the picked
   offer is not mounted in any route.
2. **Approval artefact exists and is hash-pinned** — this link *is* real
   (`campaign-approval-repo.ts:55`, enforced at `mission-scheduler.ts:39`).
3. **Render stops at `RENDER_READY`** (`niche-video-dispatcher.ts:173-179`) with no render
   continuation and no publish continuation.
4. **Commission read cannot execute** — `fetchWorkspaceDomainBReconciliation` selects from
   `workspace_external_commissions`, a table no migration among 432 creates, and
   `page.tsx:73-86` converts the resulting throw into silent all-zero metrics.

The currency guarantee that *does* hold: reconciliation segregates per currency
unconditionally with no FX conversion path, so no fabricated-rate summation is possible
(`workspace-domain-b-reconciliation.ts:105-116`), and `platformFeeCents: 0` at `:164`.
VI/EN parity also holds (`1408/1408` keys, `0` missing in either direction). But a chain
with four severed links does not connect its IDs.

## Scenario 2 — CEX: evidence-permitted case vs unverified jurisdiction/terms

The unverified case must be staged as draft and must not publish or incur cost.

**Verdict: BLOCKED (L1 for the gate, FAIL for the outcome).** The gate logic is genuinely
correct: `niche-video-dispatcher.ts:86-89` branches to `createCampaignApproval` when
`plan.requiresCeoApproval || !plan.compliance.isAllowed`, and the crypto prompt builder
bakes in the compliance constraints (CFTC 4.41, FTC 16 C.F.R. § 255, EU MiCA Art. 7/53,
the 70–80% retail-loss risk reminder, mandatory affiliate disclosure, and a reserved
`0:45–1:00` legal end-card). So an unverified jurisdiction is correctly *staged*.

But "staged as draft" only means something if the draft cannot publish, and it can —
`social-direct-publish-steps.ts` never consults the approval guard (see Scenario 4), and it
records a fabricated success regardless. The unverified case therefore reaches a
`publishedUrl` that was never uploaded, which is worse than publishing: it is a *false
claim* of a compliant outcome.

## Scenario 3 — Failure: TTS/render/network fail, duplicate callback, ledger failure mid-chain, restart, uncertain external result

No fake success, no double charge/publish/commission.

**Verdict: FAIL (L1).** The one place that must never fabricate is exactly where it does:

- **TTS failure** returns `{ success: false, provider: 'mock', error }` with no `audioUrl`
  (`niche-voiceover-generator.ts:70-74`). Honest at the function level; but the failure is
  labelled a *provider* downgrade rather than a failure, so "mock" becomes an outcome state
  the pipeline carries forward instead of a terminal error.
- **Render failure** — no render step exists to fail. `RENDER_READY` is the terminal return.
  A job that never renders is indistinguishable from a job still rendering.
- **Publish failure** — `executePlatformUploadAdapter` performs no HTTP call, fabricates
  `platformPostId = yt_${jobId}` and `publishedUrl =
  https://youtube.com/shorts/${jobId}`, then calls `recordSuccess(...)`. This is the
  fabricated success the scenario forbids, and it is unconditional.
- **Duplicate callback** — this part is genuinely correct: atomic
  `ON CONFLICT(tenant_id, network, external_tx_id, status) DO NOTHING` at
  `saas-crypto-postback-service.ts:78`, with `ledgerRes.meta.changes === 0` read as the
  duplicate signal at `:99`, and `ON CONFLICT(event_id) DO UPDATE SET processed = 1` at
  `:106`. No double-count on replay.
- **Ledger failure mid-chain** — unobservable. There is no read path for `error_log`, and no
  alert for a stalled RENDER_READY job. The only error text on the affiliates dashboard is
  the kill-switch toggle's own local state.
- **Restart / uncertain result** — no idempotency key or receipt is retained for the
  publish step, so a restart cannot tell "published" from "not published", and the fabricated
  ID is regenerable from `jobId` anyway, which makes re-drive silently re-report success.

## Scenario 4 — Mutation: changing offer/link/media/account/budget after approval must be re-reviewed at the side-effect boundary

**Verdict: FAIL (L2).** The mechanism exists and works — SHA-256 over the approval payload,
re-verified by `verifyAndEnforceCampaignApprovalD1` — but it is bound to the **render**
boundary only (`mission-scheduler.ts:39`, `niche-video-dispatcher.ts:131-132`). The
**publish** boundary, which is where link/account/media side effects actually occur, never
calls the guard: `grep -n "Approval" src/forest/inngest/functions/social-direct-publish-steps.ts`
→ no match. So a post-approval edit to the offer URL or the target account is not
re-reviewed at the boundary that matters, and because that same boundary performs no real
upload, the edit produces nothing observable either way.

## Scenario 5 — Isolation: two workspaces on the same provider/offer must not read or use each other's credentials, approvals, resources or earnings

**Verdict: FAIL (L2).** Isolation is enforced in three of four places, and the one gap is
the one that matters:

- **Credential store** — every statement is `tenant_id`-scoped (`storage.ts:24,26,43,65,78`),
  including the upsert conflict key `ON CONFLICT(tenant_id, network)`.
- **Reconciliation read** — `if (rec.tenantId !== workspaceId) continue;` at
  `workspace-domain-b-reconciliation.ts:75`, with dedup keyed on
  `${rec.network}:${rec.externalTxId}` — which is *not* tenant-qualified, though it is only
  ever compared within the already-filtered set.
- **Approval** — `tenant_id` is a stored column and a query predicate.
- **The gap** — the credential *ingress* uses `user.id` as the tenant while reconciliation
  uses `resolveOrgId(user.id, db) ?? user.id` (`route.ts:44,82` vs `page.tsx:44-45`). Two
  different keys denote "the same" customer, so an org-scoped customer's credentials are
  written under a key their own reconciliation never reads. This is not cross-tenant
  leakage — the direction is wrong for that — but it is the same class of defect the
  scenario exists to prevent, and it silently denies that customer their own credentials.

## Scenario 6 — Economics: high video CTR but negative net contribution must not self-scale; new/immature data must not be counted as failed or as won

**Verdict: FAIL (L1).** Three separate sites prove the claim is not honored:

1. `discovery-wave-helpers.ts:150-168` derives EPC from the commission rate by formula
   (`Math.min(10, Math.max(0.5, (commissionPct / 100) * 8))`), not from measurement, and
   feeds it into `scoreAffiliate` with no estimate label — so a commission rate *is* the
   measured yield.
2. `kelly-allocator.ts:46-59` grants `minFraction` on non-positive expectancy
   (`: minFraction` in the else-branch), so a negative-expectancy arm still receives
   allocation rather than zero.
3. `live-bandit-calculator.ts:43` and `stitch-deck-data.ts:17-45` feed real posterior math
   with literal counts (`arm-alpha-01, alpha: 142, beta: 19, roasMultiplier: '4.6x'`), and
   `control-deck-telemetry-service.ts:45,79,91` calls `computeLiveControlDeckDataset()` with
   **no argument**. The "live" deck is a hardcoded dataset, and `bandit-traffic-worker.ts:33,58`
   ships `mockArms` into the experiment evaluator itself.

With the learning loop unregistered (A01), there is no path by which "new data" could update
a posterior at all — so immature data is neither failed nor won; it is ignored, and the
displayed numbers are literals.

## Scenario 7 — Learning: new results update the posterior/metrics durably exactly once, influence the next decision, are compared to baseline, and provably use no fixtures in the production path

**Verdict: FAIL (L1).** `banditTrafficWorker`, `creativeDeliberationWorker` and
`flywheelFeedbackDispatcherJob` are exported but absent from
`src/app/api/inngest/serve/growth-functions.ts` (40 growth entries; the other direction —
47 core functions — is separately wired). Their only other reference anywhere is a test
file. So:

- no posterior is updated from a real result, once or otherwise;
- the next decision is influenced by whatever `live-bandit-calculator.ts` is handed, which
  `computeLiveControlDeckDataset()` supplies as literals;
- there is no baseline comparison in the live path;
- and the fixtures claim is proven *against* the product: `mockArms` in the worker is never
  reached in production because the worker never runs. That makes the production path
  fixture-free by being *absent*, not by being honest — a distinction this audit keeps.

## Scenario 8 — Money: recurring renewal, partial refund/reversal after paid, duplicate statements, multiple currency/asset — none may inflate or blend balances

**Verdict: BLOCKED (L1 arithmetic correct, L2 unexecutable).** The arithmetic is right:
`STATUS_SEVERITY = {pending:1, approved:2, reversed:3, paid_receipt:4}` with
severity-wins-then-`occurredAt` dedup, tenant filter, `platformFeeCents: 0`, per-currency
segregation with no FX path, and
`effectiveCommissionCents = totalApprovedUnpaidCents + totalPaidReceiptCents` correctly
excluding pending and reversed. A `paid_receipt` superseding an `approved`, and a
`reversed` superseding a `paid_receipt`, both resolve deterministically.

But the SELECT targets `workspace_external_commissions`, which no migration among 432
creates, and `page.tsx:73-86` swallows the throw into `EMPTY_AFFILIATE_METRICS`. In
production the read *cannot* run, so the reversal-precedence and no-inflation properties are
unexercised at L2. An absent table renders identically to an empty ledger
(`t.emptyLedgerText`), which is precisely how a blended or inflated balance would hide.

## Scenario summary

| # | Scenario | Verdict | Governing defect |
|---|---|---|---|
| 1 | SaaS end-to-end | FAIL (L2) | four severed links |
| 2 | CEX unverified jurisdiction | BLOCKED (L1) / FAIL (outcome) | draft gate correct, publish unguarded |
| 3 | Failure & idempotency | FAIL (L1) | fabricated publish success |
| 4 | Mutation after approval | FAIL (L2) | guard bound to render, not publish |
| 5 | Isolation | FAIL (L2) | `user.id` vs `resolveOrgId` tenant key |
| 6 | Economics | FAIL (L1) | derived EPC, minFraction on negative EV, literal dataset |
| 7 | Learning loop | FAIL (L1) | three workers unregistered |
| 8 | Money / multi-currency | BLOCKED (L1) | ledger table has no DDL; read swallowed |

The idempotency half of scenario 3 and the arithmetic half of scenario 8 are the only
parts of these eight rows that are correct, and both are correct in code that production
never reaches.
