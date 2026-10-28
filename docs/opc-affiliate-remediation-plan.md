# Sophia OPC Affiliate — Remediation Plan

Status: `partially-executed`
Source audit: `docs/OPC_AFFILIATE_AUDIT_MATRIX_2026-10-27.md` (17 FAIL/BLOCKED of 18 groups)
Branch: `feat/opc-affiliate-real-<SECRET_0785f2a7>`
Original snapshot: `439635e1a2017c2643e013c0311631bd95409de4`
App root: `apps/sophia-ai-factory`

Phase status as of 2026-10-28 (post red-team, re-baselined against HEAD):

| Phase | Status | How |
|---|---|---|
| P1 ledger table | `done` + `verify-only` | table and its unique dedup index already exist in `migrations/0482_opc_affiliate_execution_truth.sql:30-55`, git-tracked. Do NOT author a second DDL — it would reuse the taken number `0482` and weaken two shipped DB invariants (`CHECK (platform_fee_cents = 0)`, the `niche` default). |
| P2 error surfacing | `done` | the silent catch is gone and `resolveDashboardViewState` returns an `error` state. Both remnants fixed on this branch: bridge-clicks now carries its own readability instead of a bare `0`, and the production metrics module that reads `campaigns` and `affiliate_referral_clicks` has real callers again. |
| P3 real publish | `done` | real HTTP executor + duplicate-delivery guard, on this branch. Three defects the red team found in the new code were fixed first (see below). |
| P4 learning loop | `open` | array has 41 entries, not 40; four target workers are not exported from the barrel. See the ownership correction below. |
| P5 credentials UI | `open` | route still accepts `z.record(z.string(), z.string())`, no UI. The only phase whose premise is fully live. |
| P6 render continuation | `done` + `verify-only` | no functional `RENDER_READY` remains — only a comment and a test name. Terminal handling already emits a `RENDER_QUEUED` continuation. |
| P7 CI guards | `mostly done` | migration coverage guard fixed (it scanned a directory with 0 `.sql` files and mis-bound `|| true`, so it never compared anything) and wired into CI as Gate 1f. Still open: the `createFunction` reachability check, so an Inngest worker with no production caller still passes CI. |

### Red-team findings fixed before ship

Four lenses ran against this plan at `38b197301`. Three found real defects **in the code this
branch authored**, all now fixed on the branch:

1. `FAILED` was in the duplicate-delivery skip set, so a provider 401 or an unreadable
   response made the job permanently un-retryable — and, because `retries: 3` sits on the
   same function, silently cancelled all three Inngest retries. `FAILED` is now excluded from
   `ALREADY_UPLOADED_STATUSES`; only `UPLOADING` (within the staleness window) and `PUBLISHED`
   block a delivery.
2. One provider failure was recorded against the circuit breaker twice — once in the
   executor and again in the adapter that only rethrows — halving the effective open
   threshold for rate-limit and server-error kinds. The redundant recording is gone.
3. The breaker key was the caller-supplied `channelId`, and an unknown breaker key returns
   `true`, so supplying a new channel string reset the accumulation. The key is now per
   platform, with `channelId` retained in logs for diagnosis.

Each fix has a test that asserts the new behaviour, including one that records the same
failure twice under two different `channelId` values and asserts it lands on one key.


## Outcome

A customer can connect an affiliate network, run a real video campaign end to end, and see
reconciled commissions in one workspace — with no fabricated success anywhere on the path.

## Non-goals (explicit)

- No architecture, framework, or provider change.
- No billing rework; no Polar/PayPal/Stripe customer billing.
- No production deploy, remote migration, paid-provider call, real content publishing,
  traffic purchase, outreach, or production customer data. All provider work uses labelled
  fixtures on local D1.
- No browser automation (Chrome/CUA/DevTools/Playwright/Puppeteer/headless/browser MCP), no
  Figma/Stitch/ImageGen.
- No `git reset`/`stash`/`clean`, no force push, no wholesale staging, no overwriting other
  sessions' work.
- The three protected flows (Setup Wizard, Telegram bot, NOWPayments IPN → tier activation)
  must not regress.

## Acceptance criteria

1. `workspace_external_commissions` exists in a tracked migration; a local D1 round-trip
   writes a postback and reads it back through `computeDomainBReconciliation`.
2. A reconciliation failure surfaces to the operator instead of rendering zeros.
3. `check-migration-coverage.sh` runs in CI as Gate 1f, and a newly authored migration is
   visible to git without a manual allowlist entry.
4. The publish step performs a real HTTP upload through a labelled fixture adapter and
   records a genuine failure when it fails; it never fabricates a URL or a post ID.
5. The three learning-loop workers are registered and served; a real result updates the
   posterior exactly once and changes the next decision.
6. A customer can enter affiliate credentials from the product surface, keyed by the same
   tenant value reconciliation reads.
7. After `RENDER_READY` the chain either completes a render/publish continuation or records
   an explicit terminal failure; a stalled job is visible on the dashboard.
8. All L1/L2 work verified with `type-check`, `lint`, `check-layer-boundaries.sh`,
   `i18n:validate`, `npm test`, `build` from `apps/sophia-ai-factory/`.

L3 (provider/production) and L4 (commercial) stay out of this plan by scope and authority.

## File ownership (strict — no phase edits another phase's files)

| Phase | Owns |
|---|---|
| P1 schema | no files — nothing to author. The table lives in `migrations/0482_opc_affiliate_execution_truth.sql`. If a genuine delta is ever required it must be numbered `0483_*` and must only add constraints. |
| P2 error surfacing | `src/app/[locale]/dashboard/affiliates/page.tsx` (the file is `affiliates-dashboard-sections.tsx`, not `.ts`) |
| P3 publish | `src/forest/inngest/functions/social-direct-publish-steps.ts`, `src/tree/social/publisher/upload-executor.ts`, their `__tests__/` |
| P4 registration | `src/app/api/inngest/serve/growth-functions.ts`, `src/forest/inngest/functions/index.ts`, `src/forest/growth-triad-registry.ts` — the last two are required because the target workers are not barrel-exported today, so "only the array changes" will not compile |
| P5 credentials UI | `src/app/api/v1/integrations/affiliate-networks/route.ts`, `src/app/[locale]/dashboard/affiliates/**` (NEW subroute — `dashboard/integrations/` does not exist today; the connections surface is added under the existing affiliates shell), `src/tree/affiliates/credentials/storage.ts`, `messages/vi.json`, `messages/en.json` |
| P6 render continuation | `src/forest/inngest/functions/niche-video-dispatcher.ts` |
| P7 CI guards | `.github/workflows/deploy.yml`, `scripts/check-migration-coverage.sh` |

`messages/vi.json` and `messages/en.json` are owned solely by P5. If any other phase needs a
key, it hands the key name to P5 rather than editing the catalogues.

## Phases

### P1 — Create the missing ledger table (fixes the critical B07/B09 defect)

**Why first:** it is the only defect where the production read path *cannot* execute, and
`page.tsx:73-86` turns it into silent zeros. Every other phase produces data that lands in
this table.

Files: `migrations/0482_workspace_external_commissions.sql`.

Columns taken from the writer (`saas-crypto-postback-service.ts:73-79`) and reader
(`workspace-domain-b-reconciliation.ts:185-188`) — the union must satisfy both exactly:

```sql
CREATE TABLE IF NOT EXISTS workspace_external_commissions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  campaign_id TEXT,
  network TEXT NOT NULL,
  niche TEXT,
  external_tx_id TEXT NOT NULL,
  sub_id TEXT,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending','approved','reversed','paid_receipt')),
  gross_amount_cents INTEGER NOT NULL DEFAULT 0,
  commission_cents INTEGER NOT NULL DEFAULT 0,
  platform_fee_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  is_recurring INTEGER NOT NULL DEFAULT 0,
  raw_payload TEXT,
  occurred_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_wec_dedup
  ON workspace_external_commissions(tenant_id, network, external_tx_id, status);
CREATE INDEX IF NOT EXISTS idx_wec_tenant_time
  ON workspace_external_commissions(tenant_id, occurred_at);
```

The dedup index matches the writer's `ON CONFLICT(tenant_id, network, external_tx_id,
status) DO NOTHING` — without it that clause has no effect and duplicate postbacks would
insert.

Steps:
1. `git check-ignore -v migrations/0482_workspace_external_commissions.sql` — expected
   `gitignore:86:*.sql`, i.e. still ignored. Add the `!` line to `.gitignore`.
2. Author the DDL above; confirm the table name is on a single unquoted line so
   `check-migration-coverage.sh`'s `CREATE TABLE (IF NOT EXISTS )?[a-zA-Z_]+` regex sees it.
3. `bash scripts/check-migration-coverage.sh` → must pass.
4. Back up D1 **before** any apply (repo rule: always back up before a schema change), then
   apply against the local/remote database per the deploy contract, recording the backup
   path in the PR.

Risk: LOW for local D1. The remote apply is a Stage 2a delta action, authorized by `--ship`;
the pre-flight in `apply-migrations.sh` (ledger existence, `sqlite_master` presence, the
hard-coded `sop_installs` drift checks) runs first and fails closed.

Rollback: drop the two indexes and the table, or revert the commit before the delta runs.

### P2 — Surface reconciliation failures instead of zero metrics

Files: `page.tsx` only.

The headline defect is already fixed at HEAD: the silent `catch { tenantId = user.id }` is
gone, the failure path captures the error, and `resolveDashboardViewState`
(`land/affiliates/dashboard/dashboard-load-state.ts`) returns an `error` state that renders
"Earnings are unavailable right now — this is not zero" with `data-testid="earnings-
unavailable"` at `page.tsx:200` instead of `$0.00`.

The one live remnant is narrower than this phase originally described. `metrics.totalBridgeClicks`
is spread from `EMPTY_AFFILIATE_METRICS` and never overridden, so `page.tsx:213` renders a
`text-3xl font-bold` **0** under the label "Bridge Page Clicks" in *every* state — including
`error`, where the sibling earnings card correctly refuses to show a number. So the error
state is honest for the headline card and dishonest for this one.

Work: give the bridge-clicks figure the same unavailable treatment as the earnings card when
the state is not `ready`. i18n keys route through P5; do not edit the catalogues here.

Acceptance: when the dashboard state is `error`, the bridge-clicks card renders no numeric
figure and carries the same unavailable marker as the earnings card.

Risk: LOW — one conditional render on an existing card. No route contract changes.

Note for scope, not for this phase: a *tenant-key* mismatch between the credential writer and
the reconciliation reader renders real commission rows as a legitimate-looking "no commission
statements recorded yet." Nothing errors, so no amount of error-surfacing work catches it. That
belongs to P5's key alignment and is documented there.

### P3 — Make the publish adapter real — DONE, verify-only

Files: `src/tree/social/publisher/upload-executor.ts` (new) and
`src/forest/inngest/functions/social-direct-publish-steps.ts`, plus both `__tests__/`.

`executePlatformUpload` performs the real HTTP exchange per platform, returns only a
provider-supplied post id and URL, and throws `ProviderResultUnverifiableError` when the
provider's response cannot yield a real id. The access token is threaded from a
`decrypt-vault-token` step rather than being reachable from the event payload. Duplicate
delivery is guarded so a re-delivered event does not reach the provider twice, with a
staleness carve-out so a worker killed mid-upload leaves a resumable job.

Three defects the red team found in this code are fixed on the branch and enumerated in the
table above: `FAILED` blocking legitimate retries, a double-counted breaker failure, and a
breaker key that a caller could reset by changing the channel string.

Remaining work is verification, not implementation. This phase's original acceptance wording
("a failure must reach the DLQ and the operator") has no substrate in the repo: there is no
`onFailure` handler on any Inngest function, `dlq-reaper` is NOWPayments-IPN-scoped only, and
`land/affiliates/commission-dlq.ts` has no production caller. A `FAILED` publishes row is
written to `social_publish_jobs.error_message` and read by nothing — no UI surface and no
cron reconciles that table. Making an operator visible failure real is therefore P7-scope
work with a precondition, not a footnote here.

Acceptance (met): an adapter failure records a classified failure exactly once and records no
success, never fabricates a URL; a duplicate delivery for a terminal job does not upload
again, while a stale `UPLOADING` and a previously `FAILED` job are both allowed to retry.

Risk: HIGH — this is the row where fabricated success is most dangerous. It ships behind a
labelled fixture at L2; no real YouTube credential is used.

Files: `growth-functions.ts`, plus `src/forest/inngest/functions/index.ts` and
`src/forest/growth-triad-registry.ts`, which the ownership table above now grants. The barrel
grant is not optional: `banditTrafficWorker`, `creativeDeliberationWorker`,
`predictiveRenderScheduleJob` and `predictiveRenderEvaluateJob` live under
`forest/growth-v13/` and `forest/growth-v14/` and are not exported today, so adding them to
the serve array alone will not compile.

`flywheelFeedbackDispatcherJob` is already registered, so the live work is the two v13
workers plus the v14 pair, not the three this phase originally listed.

Acceptance: `src/app/api/inngest/serve/index.ts` serves every `inngest.createFunction` export
in `src/forest/`; a test asserts that reachability over the real export list rather than a
hand-counted number, because the count has already drifted once (40 → 41).

Risk: MEDIUM — newly registered jobs start running. Each must be idempotent and derive its
inputs from real rows, not `mockArms` (`bandit-traffic-worker.ts:33,58`). Open question for
the founder: registering the whole v14 pair consumes render budget that A09 only budgeted for
its own write, so it needs explicit intent before it is switched on.

### P5 — Customer-affecting credential surface + tenant key alignment

Files: `route.ts`, `src/app/[locale]/dashboard/affiliates/**` (new connections subroute),
`src/tree/affiliates/credentials/storage.ts`, `messages/vi.json`, `messages/en.json`.
`dashboard/integrations/` does not exist in this tree, so P5 creates the route it owns rather
than claiming a pre-existing one.

Add a connections section that POSTs to `/api/v1/integrations/affiliate-networks`, replace
the `z.record(z.string(), z.string())` payload at `route.ts:33` with a per-network
discriminated schema (the `as unknown as NetworkCredentialPayload[typeof network]` cast at
`:82` is where all shape validation is currently skipped), and align the tenant key with
`resolveOrgId(user.id, db) ?? user.id` so credentials and reconciliation agree.

**The alignment must ship with a migration, or it silently orphans every existing
credential.** The writer keys rows on raw `user.id` (`route.ts:82`) while the reader resolves
`orgId ?? user.id` (`page.tsx:63-64`). Storage upserts on `(tenant_id, network)`
(`storage.ts:26`) and every read filters `tenant_id = ?`, so the moment the write side
switches to the org key, a pre-existing row keyed on `user.id` becomes unreadable and the UI
renders that network as unconfigured — with no error. The acceptance test cannot catch this
because a fresh fixture is written and read under the new key and passes.

So P5 must, in the same change: backfill `affiliate_network_credentials.tenant_id` from the
old key to the resolved one, or read through both keys, and surface an operator-visible
"credential exists but under a different key" state.

Acceptance: a local fixture credential saves and is read back by the reconciliation path
under the same tenant value; a *pre-existing* row under the old key is still reachable after
the change; i18n keys added to both catalogues; `/login`, `/vi/login`, Setup Wizard,
Telegram and NOWPayments IPN smoke unchanged.

Risk: HIGH — touches the onboarding-gated surface, the i18n catalogues (Gate 1d goes red on
any one-sided key), and a BYOK store where an orphaned row means the customer has to
reconnect a network that is already connected.

### P6 — Continue the chain after RENDER_READY — DONE, verify-only

The premise no longer exists. `niche-video-dispatcher.ts` contains no functional `RENDER_READY`
path — the two remaining occurrences are a comment and a test name. The terminal handling at
`:300-318` returns `RENDER_QUEUED` with `nextAction: 'render_worker'` and `manifestIsMedia:
false`, so a job that cannot proceed hands off to a render worker rather than stalling.

This phase's budget-gating risk note (gate the continuation on the approved content hash and the
BYOK credential, not a default) is still the right principle, but it now belongs to whatever
phase owns the render worker's credential resolution, not to a dispatcher that no longer
terminates there.

Acceptance (met): no job ends at `RENDER_READY` without a continuation. A stalled job being
*dashboard-visible* is not met and is tracked under P7, not here, because it needs the
publish-job operator surface described in P3.

### P7 — CI guards that make the failure class impossible to repeat

Files: `deploy.yml`, `check-migration-coverage.sh`.

1. Add Gate 1f: `bash scripts/check-migration-coverage.sh`.
2. Add a guard that resolves the live `/api/version` shortSha and diffs the applied migration
   set against the tables the code references, so an untracked-and-ignored migration cannot
   reach `main` unnoticed.
3. Add a static check that every `inngest.createFunction` export is reachable from
   `src/app/api/inngest/serve/` (catches the A01/P4 class permanently).
4. Extend `scripts/post-deploy-smoke.mjs` with an authenticated affiliates probe so green CI
   exercises at least one affiliate path.

Risk: MEDIUM — a new red gate blocks unrelated work, so each guard must be proven
false-positive-free against `HEAD` before merge.

## Execution order and dependencies

```
P1 ─┬─> P2 (needs a table to fail on) ──┐
    └─> P3 (publish needs a ledger) ────┤
P4 (independent) ───────────────────────┼─> P6 (needs registration + real publish)
P5 (independent) ───────────────────────┘
P7 (after P1 lands; independent of P3–P6)
```

P1 is the only hard blocker. P3 and P5 are the two high-risk rows and are the reason this
plan is sequenced rather than parallelized beyond strict file ownership.

## Verification per phase

Each phase runs, from `apps/sophia-ai-factory/`:
`npm run type-check` → `npm run lint` → `bash scripts/check-layer-boundaries.sh` →
`npm run i18n:validate` → `npm test <touched>` → `npm test` → `npm run build`.
The audit worktree has an empty `node_modules`; run `npm ci --legacy-peer-deps` first.
Node locally is 26 while CI is 22 — a local test failure involving `window.localStorage`
under jsdom does not reproduce in CI and must not be "fixed" by weakening the test.

## Rollback

Per phase: revert that phase's commit. For P1, additionally drop the two indexes and the
table if a rollback to the pre-migration schema is required, after a fresh backup.

---

## Validation Log

### Session 1 — Step 2.5 Verification Pass (Full tier; 7 phases)

Tier chosen because the plan carries 7 phases. Method: a read-only verifier re-checked every
factual premise the plan asserts about the codebase, against the pinned snapshot
`439635e1a2017c2643e013c0311631bd95409de4`. Plan premises were graded, not implementation.

Corrections applied to this plan from that pass:

- **P5 file ownership was wrong and has been fixed.** The plan claimed
  `src/app/[locale]/dashboard/integrations/**` as an owned path. That directory does not
  exist (`ls "src/app/[locale]/dashboard/"` → no `integrations` entry). P5 now creates its
  route under the existing affiliates shell and says so explicitly.
- **i18n key count corrected from 1408 to 7210 per catalogue.** The 1408 figure was the
  `affiliates*`/`dashboard*` namespace subset, not the catalogue total. Both catalogues are
  7210 keys and are equal — the parity claim holds, the count did not.
- **`check-migration-coverage.sh` regex premise restated.** The guard matches
  `CREATE TABLE (IF NOT EXISTS )?[a-zA-Z_]+` against `migrations/*.sql`, so the new DDL keeps
  its table name unquoted and on one line — otherwise the guard cannot see it and P7 wires a
  guard that stays blind.

`[UNVERIFIED]` tags: none remaining.

### Whole-Plan Consistency Sweep

Swept `plan.md` against the audit matrix, the runtime map and the cross-cutting verification
after the above corrections:

- The 40-entry growth-function count appears in P4 and agrees with `growth-functions.ts`;
  the barrel is confirmed as `export *`, so P4 changes only the array.
- P1's column list is the exact union of the writer's INSERT bind order and the reader's
  SELECT list — both copies were re-read and match.
- Every phase's acceptance criterion maps to a matrix row: P1→B07/B09, P2→B08/B05, P3→A06,
  P4→A01, P5→B02, P6→A09/B05, P7→B09. No orphan criterion.
- No phase claims L3 or L4 evidence, and no phase edits another phase's files. The two
  `messages/*.json` files remain P5-owned, and P2's new error copy is routed through P5.
- Unresolved contradictions: none.

---

### Session 2 — Red-team pass, re-baselined against HEAD

Four adversarial lenses ran at `38b197301`: security adversary, assumption destroyer, failure
mode analyst, and scope/complexity critic. Three independently identified the same root cause —
the plan's pinned snapshot `439635e1` is an ancestor of HEAD, so its premises described work
that has since landed. Each finding below was re-verified against source before being accepted;
where a lens overstated its case, that is recorded too.

**Corrected in this pass:**

- **P1 must not author a DDL.** Confirmed: `migrations/0482_opc_affiliate_execution_truth.sql:30-55`
  already creates `workspace_external_commissions` with the same tenant-leftmost dedup index, is
  git-tracked, and enforces `CHECK (platform_fee_cents = 0)` plus a `niche` default the plan's
  DDL lacked. Authoring `0482_workspace_external_commissions.sql` would reuse a taken migration
  number and *downgrade* two real DB invariants. The plan's own DDL was verified correct in
  column union; it was the premise that was wrong, not the shape.
- **P3's own code had three real defects, now fixed on the branch.** The `FAILED` skip set
  cancelled all three Inngest retries as well as operator re-dispatch (verified: `retries: 3`
  on the function, `FAILED` written on first attempt before rethrow); the adapter
  double-recorded one provider failure (verified by grep: `recordFailure` at both
  `upload-executor.ts:246` and `steps.ts`); and the breaker key was the caller-supplied
  `channelId`, which resets an unnormalized key that returns `true` when unknown (verified
  against `circuit-breaker-ops.ts:38-45`). All three carry tests.
- **P2 is narrowed to one live defect.** The silent-catch premise was replaced upstream by
  `resolveDashboardViewState`; the real remnant is `page.tsx:213` rendering a bare `0` for
  `totalBridgeClicks` in the error state, where the sibling earnings card at `:200` correctly
  shows an unavailable marker. `totalVideosGenerated` is not rendered at all, so half the
  original complaint was moot.
- **P6's premise is gone.** Zero functional `RENDER_READY` remains — only a comment and a test
  name. Terminal handling already returns a `RENDER_QUEUED` continuation.
- **P4's count and ownership were both wrong.** The array has 41 entries, not 40, and
  `flywheelFeedbackDispatcherJob` was already registered upstream. More importantly, the barrel
  does not export the four target workers, so the ownership table had to grant
  `forest/inngest/functions/index.ts` and `growth-triad-registry.ts` or the phase could not
  compile under strict ownership.
- **P5 gained a required backfill.** Aligning the write key from `user.id` to
  `resolveOrgId(...) ?? user.id` would orphan every existing credential row, because storage
  upserts on `(tenant_id, network)` and every read filters `tenant_id = ?`. The network would
  render as unconfigured with no error. Verified against `route.ts:82`, `page.tsx:63-64`,
  `storage.ts:26`, and the DDL's `UNIQUE(tenant_id, network)` in migration 0084.
- **P3's "reach the DLQ and the operator" has no substrate.** Verified: no `onFailure` exists on
  any `inngest.createFunction` in the repo; `dlq-reaper` is NOWPayments-IPN scoped only;
  `land/affiliates/commission-dlq.ts` has no production caller. Restated as P7-scoped work with
  a precondition instead of a footnote.

**Verified rather than accepted:**

- The security adversary found the tenant-crossing design sound (four independent layers, none
  dependent on the DDL) and reported token handling clean across all seven sites. Its Instagram
  fabricated-success finding (F6) was retracted mid-audit because the fallback had already been
  removed on this branch.
- The credential table does exist in tracked migrations (0084 and 0248) — a lens implied it might
  not, and the repo says otherwise.
- The migration-coverage guard's regex premise is character-exact, but the guard scans only
  `src/**/*.sql` and finds zero files, so it passes trivially. That is exactly why P7 is now the
  highest-value remaining phase.

**[UNVERIFIED], carried forward deliberately:** the precise failure mode of two `0482_*` files
under `apply-migrations.sh` (collision is real at filename level; behaviour inferred, not
executed); whether Inngest memoizes the `evaluate-pacing` step on retry, which the fix above
makes moot by not depending on it; and how often real uploads exceed the `UPLOADING` staleness
window, which decides whether that window is generous or tight.

Every phase's acceptance criterion still maps to a matrix row; no phase claims L3 or L4 evidence;
no phase edits another phase's files.
