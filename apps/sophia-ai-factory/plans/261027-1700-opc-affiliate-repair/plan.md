# Sophia OPC Affiliate — audit → repair → usable product → reviewed PR

**Branch:** `arena/0c751328-sophia-ai-factory` (branched from `main@439635e1a2017c2643e013c0311631bd95409de4`)
**Snapshot date:** 2026-10-28 (Asia/Ho_Chi_Minh)
**Status:** implementation complete; PR opened; merge/deploy explicitly out of scope.

## 1. Mandate and scope

The founder replaced the earlier "audit only / do not push" scope with an execution mandate:
ship **code + tests + a usable operator journey + a reviewed PR with green checks**. This folder is
evidence, not the deliverable. Two halves had to work together:

- **A — Video-to-affiliate-revenue engine.** offer with provenance → script with sourced facts →
  audio/timeline → real media → approval → distribution → click/conversion → commission →
  cost reconciliation → feedback into the next decision. A canonical execution path must be named,
  and every module without a consumer must either be connected (with a test) or kept inactive
  with the truth about its state.
- **B — OPC user platform.** one golden journey (choose niche → valid offer → prepare campaign →
  review/approve → follow production/publishing → reconcile commission) inside the existing
  workspace dashboard, with at most six primary nav groups, honest VI/EN landing copy and real
  routes, using server contracts rather than a parallel dashboard.

### Hard limits (observed, not waived)

- No browser / CUA / DevTools / Playwright / Puppeteer / screenshot / Figma / Stitch / image gen.
  **Visual and responsive QA = NOT VERIFIED.** Component tests only.
- No paid provider calls, no real publishing, no traffic purchase, no outreach, no remote
  migration, no production customer data, no trading/withdrawal features. Missing credentials are
  reported as BLOCKED / NOT VERIFIED, never simulated as success.
- No `--ship`: stop at a reviewed PR with green checks. No merge, no deploy.
- No `git reset` / `stash` / `clean` / force-push / blanket staging, no editing another session's
  work. Session branch is fixed; no extra worktree was possible.
- Architecture unchanged: seed / tree / forest / land boundaries; canonical imports
  `@/seed/auth/better-auth-session`, `@/seed/db/client`, `@/seed/db/get-user-tier`,
  `@/seed/config/tiers`; synchronous `createServerClient()`; no `:any`; no production `console`;
  VI/EN through next-intl; Server Actions for small mutations, durable jobs for long work.
- Domain B (external affiliate earnings) belongs to the workspace: `commission_sophia = 0`,
  `platform_fee_cents = 0`. Never mixed with subscription billing, Refer Sophia or partner payouts.
  BYOK credentials are workspace-owned. Setup Wizard / Telegram Bot / NOWPayments IPN → tier
  activation and the license/edition boundaries stay intact.

### Deviations from the requested workflow (honest record)

| Requested | Reality in this checkout | What was done instead |
| --- | --- | --- |
| `ak-vibe` official skill, `/plan`, `/cook`, `/fix`, `/review-pr --fix --reply`, `/ship` | No `ak-vibe` skill, no `ak:*` commands. Only `/cook`, `/plan`, `/worktree`, `/review`, `/auto-pr`, `/test` exist. | Followed the workflow semantics manually (plan → red-team/consistency review → implementation → independent diff review → PR). Did **not** claim any nonexistent command ran. |
| Two reference docs (`SOPHIA_TWO_TRACK_AUDIT_SCOPE_2026-10-27.md`, `SOPHIA_OPC_UX_PRESCRIPTION_2026-10-27.md`) | Absent from the repo and not provided as attachments. | A01–A09 / B01–B09 IDs below are **reconstructed from the prompt**, not validated from those documents. |
| Clean feature worktree via ak-worktree | Session policy pins one branch; checkout was a single clean worktree at baseline. | Worked directly on the session branch; nothing was reset or overwritten. |
| Separate implementation agents | No agent-orchestration tool was available in this session. | Single integrator; independent diff review performed as a separate read-only pass over `git diff`. |
| Issue labels `ready to cook → in progress` | Issue #62 was created, but `gh issue edit --add-label` and `gh api .../labels` both return `403 Resource not accessible by integration` (App token cannot modify labels). | Issue #62 exists and is linked from the PR; it is currently unlabelled. This is recorded, not hidden. |
| Full `tsc --noEmit` / `next build` locally | 4 GB sandbox OOM (`tsc` mark-compact; `next build` killed with 137). | Scoped `tsc` over all 71 changed/global TS files → 0 errors; full CI `tsc` and PR checks are authoritative. |

## 2. Baseline findings (checkpoint 1)

At `439635e1` all eighteen groups were FAIL. The decisive break was in the middle of the chain:
`niche-video-dispatcher.ts` returned `RENDER_READY` with a scene/filter **descriptor** while there
was no consumer, no stored run and no media artifact. Downstream code therefore had nothing
truthful to reconcile. Three production repositories (`campaign-approval-repo`,
`saas-crypto-postback-service`, `workspace-domain-b-reconciliation`) referenced tables with no DDL
in this repository. `banditTrafficWorker` and the old flywheel feedback consumer were effectively
inactive. See `audit-matrix.md` and `runtime-map.md`.

The eleven historical leads were re-checked against the current source rather than copied:

1. Render dispatcher / descriptor / manifest — verified: descriptor only; changed to `RENDER_QUEUED`.
2. Crypto script claim invention — verified: hardcoded "20% fee discount / $1000 bonus"; removed.
3. Discovery EPC — verified: commission heuristic presented as measured EPC; tagged as estimate.
4. mockArms / posterior — verified: mock analytics and unpinned RNG; seeded + persisted once.
5. Inngest registration / payload — verified: feedback job not registered; registered in `growth-functions.ts`.
6. Predictive render / Kelly — verified: unknown expectancy still allocated `minFraction`; now 0.
7. Orchestrator US fallback / hook — verified: implicit `US`/`GLOBAL`; now explicit or blocks.
8. Auto-video skipped/error/caption — verified: skips reported as success; now typed, caption keeps link.
9. Auto-campaign scaler placeholders — verified: fake `Winning Hook` offer; now requires verified offer.
10. Reconciliation currencies/replay/reversal — verified: paid receipt hid reversal, FX mixing; fixed.
11. Approval persistence/payload binding — verified: no DDL and event-carried hash; fixed with DDL + D1 re-verify.

Previously-fixed WIP (tenant BYOK, category propagation, approval guard, HMAC, Domain B ledger)
was re-read and re-tested; nothing was silently copied from an unverified dirty tree.

## 3. Architecture decision: one canonical execution path

```
Server Action / Telegram / registered job  (server resolves tenant + permissions)
   └─ event `niche.video.campaign.requested`  (tenantId, offerId, termsVerified,
        approvalId/hash, maxRenderCostCents, idempotencyKey, locale, market)
        └─ nicheVideoDispatcher  (draft → approval_pending | blocked | failed | render_queued)
             ├─ evaluateRenderGate()   re-checks tenant, halt, budget, approval hash, TTS
             ├─ beginExecutionRun() + transitionRun()  D1: affiliate_execution_runs
             └─ RENDER_QUEUED (manifestIsMedia:false, mediaReady:false, artifactId:null)
        └─ render worker (future/real provider) → recordVerifiedArtifact()
             D1: affiliate_media_artifacts → run.state = rendered
        └─ evaluatePublishGate()  (artifact + link + account + halt + budget, at side effect)
             → publish_queued → published | failed | blocked
        └─ click/conversion → opc_postback_events → workspace_external_commissions
             → fetchWorkspaceDomainBReconciliation() → cockpit / results page
        └─ observed analytics event → flywheelFeedbackDispatcherJob (registered)
             → opc_feedback_events (once) → opc_bandit_arms → seeded next decision
```

The contract lives in `src/tree/affiliate/execution/execution-contract.ts` (pure state machine) and
`execution-repo.ts` (D1, tenant-scoped, CAS transitions). State names are the only vocabulary
allowed at boundaries: `draft, approval_pending, render_queued, rendered, publish_queued,
published, blocked, failed, cancelled`. A queue acceptance is never `rendered`; a manifest is
never media; an accepted webhook is never revenue.

Anything without a consumer is either connected (feedback dispatcher, with a registration test) or
explicitly inactive and fail-closed (`banditTrafficWorker` returns `NOT_AVAILABLE`). No module is
left in a "looks active" state.

## 4. Phases and checkpoints

| Phase | Work | Checkpoint |
| --- | --- | --- |
| P0 — Truth foundation | D1 migration 0482; execution contract/repo; portable `createFakeD1`; DB-boundary tests (upgrade twice, tenant A/B, idempotency, concurrency, `platform_fee_cents = 0`) | 14 DB/state tests green |
| P1 — Producer & inputs | dispatcher rewrite; event/action boundary; offer eligibility; sourced claims + locale; EPC provenance | 8 dispatcher + 8 offer + 4 fact tests green |
| P2 — Money truth | postback service tenant scoping + HMAC + partial refunds; reconciliation lifecycle, currency isolation; cockpit availability flags | 21 reconciliation/postback/cockpit/e2e tests green |
| P3 — Mission + learning | auto-video typed skip/failure; Kelly/predictive/scaler gates; seeded RNG; persisted once-only feedback; Inngest registration; fixtures labelled | 4 feedback + 9 route/bandit + mission/optimizer tests green |
| P4 — Usable product | six primary nav groups + 16 preserved deep links; Refer Sophia separated; landing VI/EN headline & honest demo; CTA deep links; dashboard load states | 46+3 nav + 8 landing + 3 state + 2 page tests green; i18n parity green |
| P5 — Independent review | read-only pass over full `git diff`; fixed durable `render_queued` transition, tenant-null offer fail-open, maturity fail-open, legacy fail-open kill switch in scaler | targeted tests re-run green |
| P6 — Verification + PR | exact repo scripts, full vitest, coverage gate, scoped tsc (full tsc OOM locally), docs, force-add ignored artifacts, commit/push/PR | see `verification.md` |
| P7 — CI iteration | first CI run exposed 4 downstream type errors in an unchanged auth-cockpit test and a newly published critical `better-auth` advisory. Fixed the fixtures, widened the scoped tsc program to 2,374 downstream files, and applied the minimal in-range `better-auth` security bump. Re-ran auth tests + scoped tsc + audit. | see `verification.md` §8 |

## 5. Acceptance criteria (what "done" means here)

- [x] Canonical path documented and enforced by a single state machine + D1 repository.
- [x] Manifest/descriptor never labelled rendered/published/succeeded; real media required for `rendered`.
- [x] Approval binds script, offer, link, account, market and budget; mutation invalidates; halt,
      permission and budget re-checked at the side-effect boundary and after retry.
- [x] Idempotency keys, durable state and recovery for uncertain outcomes; no `:any` / production console.
- [x] External earnings ledger tenant-scoped, replay-safe, `platform_fee_cents = 0` at the DB
      boundary, pending/approved/paid/reversed separated, adjustment history kept, no FX mixing.
- [x] Optimizer uses persisted observed data only, applies feedback exactly once, seeded RNG,
      refuses fixtures, no immature winner, no auto-spend without verified upstream evidence.
- [x] Six-group nav, real routes, Refer Sophia separated, exact VI/EN headline, illustrative demo,
      CTA deep links preserve `offerId`/`locale`/`returnTo`/tier.
- [x] Dashboard distinguishes unauthenticated/unconnected/empty/loading-error/ready; error is not
      zero earnings; unknown kill switch is not "off".
- [x] ≥ 8 scenario tests at route/action/registered-runtime/DB boundaries (see `verification.md`).
- [x] Migration runs on D1-compatible local SQLite, twice, with tenant and concurrency tests.
- [ ] Visual/responsive browser QA — **NOT VERIFIED** (forbidden by mandate).
- [ ] Real provider correctness / commercial validation — **BLOCKED** (no credentials, no paid spend).
- [ ] Merge / deploy — intentionally not done.

## 6. Cost and risk posture

No new commercial threshold was invented. Kelly exploration defaults to **zero** unless an
explicitly approved exploration fraction is supplied; scaling requires measured positive
contribution, ≥ 24 h supplied maturity, cost known, and explicit workspace permission. The demo
is labelled illustrative and makes no revenue/profit promise. `totalsAvailable:false` is returned
for multi-currency ledgers instead of a fabricated headline number.

**This is source-level and local-fixture evidence only.** It is not a claim that OPC is 100 %,
production-ready, or currently earning money.
