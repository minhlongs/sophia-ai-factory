# Independent-style audit of PR #63 / PR #64 — evidence

Date: 2026-10-30. Snapshot reviewed: `09ea3791` (origin/main at audit start;
PR #63 = `00edba0a`, PR #64 = `03f22ae8`, both merged; later main adds #65/#66/#68/#71).
Live at audit start: `/api/version` → `{"shortSha":"09ea3791","deployedAt":"2026-10-30T00:33:34Z"}`,
`/api/health` → healthy. Latest deploy run `40978523127` success.

INDEPENDENT REVIEW: NOT VERIFIED — no second reviewer agent/human exists in this
runtime (checked: claude, codex, opencode, aider, gemini, amp, copilot, gh-aw,
cursor-agent, tabnine — all NOT FOUND). What follows is the deepest same-agent
source-to-sink trace possible, with every finding tied to file + snapshot and,
for fixes, a failing-first or behavior-pinning test.

## A. Artifact / media verification (P0)

- `recordVerifiedArtifact`, `evaluateArtifactGate`, `evaluatePublishGate` have
  ZERO production callers at `09ea3791` (only doc-comment mentions + tests).
  `affiliate_media_artifacts` is therefore always empty in production.
- The only execution producer, `niche-video-dispatcher`, stops at
  `render_queued` (manifest/descriptor, `manifestIsMedia:false`,
  `mediaReady:false`). No render worker exists.
- The #64 `hasVerifiedMedia` gate is correct defense-in-depth for a LATENT
  path: it rejects zero-byte/empty-checksum descriptors at both pure gates and
  the repo boundary, but no caller can reach it yet.
- Verdict: PARTIAL. Gates correct, unwired. Bytes-existence, checksum-from-bytes,
  MIME/playability, replay/out-of-order provider callbacks: NOT VERIFIED (no
  real provider/worker). No fix — building a render worker from fixtures would
  fake completeness.

## B. Tenant / postback (P0)

Traced `handlePostbackRoute` → `resolveNetworkSecret` → per-tenant encrypted
BYOK credential → HMAC over raw body → `processSaasCryptoPostback` →
tenant-scoped ledger + idempotency.

1. Secret is resolved AFTER reading link/tenant id, scoped per
   (tenant, network). No shared/global secret, no default fallback.
2. Signature covers the full raw body. Tenant selection uses client input, but
   verification requires THAT tenant's secret.
3. Cross-tenant replay PROVEN SAFE by new route-level tests on real fake-D1
   (see Fix F-B below): A-signed payload claiming B → 401, nothing written;
   linked postback ignores body `tenant_id` (link row wins).
4. Link-less mapping evidence = knowledge of the claimed tenant's network
   secret; missing credentials → 401 fail-closed.
5. Dedup keys correctly scoped: `(tenant_id, event_id)`,
   tenant-namespaced global `commission_events.event_id`,
   `(tenant_id, network, external_tx_id, status)`.
6. Partial-failure recovery is idempotent (ledger row written but event marker
   missing → retry lands on `ON CONFLICT DO NOTHING` → duplicate, no double
   commission). No false success: exceptions → `DB_WRITE_FAILED`.
7. Legacy divergence (BLOCKER, needs founder/CTO decision): PR #63 commit
   `27c3fa1a` added `TENANT_REQUIRED`, which makes the legacy global-secret
   route `/api/webhooks/saas-crypto/[network]` answer 422 on every request when
   D1 is up (previously it wrote tenant-'' global rows). Its tests mock
   `getD1 → null`, masking this. The customer guide still documents that URL
   (`seed/guide/guide-backend-pillars-part1.ts`). No provider-traffic truth
   available to this agent; the route was NOT removed or rewired. Its silent
   200-skip was made loud (see Fix F-D).

## C. Approval / ledger / budget

- Approval hash binds script/link/jurisdiction/disclosure/budget/account
  (SHA-256, canonicalized); re-verified at the side-effect boundary with
  revocation-by-status/mutation handling and kill-switch abort. Sound.
- BUT the lifecycle is incomplete: `approveCampaignApproval` has ZERO callers,
  nothing ever sets `executed`, no expiry/revocation path is wired, and no
  mission producer sets `requireCeoApproval`/`campaignId`/`approvalPayload`.
  Approvals can only ever be `pending_ceo`; the render gate past draft is
  unreachable in production. Fail-closed by incompleteness, NOT by enforcement.
  No code change (product decisions required).
- Latent P2 (recorded, NOT changed — deliberate degradation design, unreachable
  today): dispatcher trusts event `approvalHash` when `approvalId` is absent or
  D1 is down; reports `RENDER_QUEUED` with `runId:null` when the run cannot be
  persisted; hardcodes `credentialsConnected:true`; reserved==max budget with
  no workspace spend ledger (BYOK spend, client input capped $50 by Zod).
- Domain B reconciliation: lifecycle rank (reversed wins), `#adj:` adjustments
  subtracted, multi-currency single totals zeroed with `totalsAvailable:false`,
  tenant-filtered. `affiliate-live-metrics` does not mix commission. Sound.
- `commission_ledger` (Sophia referral, keyed by affiliate user, NO tenant) vs
  `workspace_external_commissions` (Domain B, tenant-scoped): two ledgers BY
  DESIGN. `payout-batcher` reads only `commission_ledger`; Domain B never flows
  to payouts. Separation verified at source level.

## D. Fixes shipped in this branch

F-A (P1) kill-switch fail-closed at 5 side-effect sites (the legacy boolean
helper fails OPEN on read errors; replaced with `getAffiliateKillSwitchState`
+ `active || !known` abort):
`social-direct-publish-job.ts` (real provider upload), `execute.ts` (scheduled
publish), `social-syndication-job.ts`, `auto-video-service.ts`,
`mission-scheduler.ts` (+ `KILL_SWITCH_UNKNOWN` code in `types.ts`).
Tests: unknown/active abort pinned for all five paths.

F-B (P1 proof) new route-level tenant-isolation tests
(`route-handler-tenant-isolation.test.ts`, 4 tests, real migrations on fake D1):
link-wins, wrong-secret 401, owner-secret 200, unknown-tenant 401. All pass on
unmodified code — proves §B.3, no exploit.

F-C (P2 hardening) `processSaasCryptoPostback`: reject empty secret
(`SECRET_NOT_CONFIGURED`) before crypto — HMAC-with-empty-key is
attacker-computable on runtimes that allow zero-length keys (Node refuses,
edge runtimes differ; verified Node throws `DataError: Zero-length key is not
supported`) — and reject non-finite commission (`INVALID_COMMISSION`) since
NaN sails past `<= 0`. Both loud (route → 500/422), both tested incl. zero-row
ledger assertion.

F-D (P1 loudness) legacy webhook silent 200-skips → 503:
`webhooks/saas-crypto` secret-missing, `webhooks/affiliate` secret-missing and
D1-missing. A 200 would tell the provider "delivered" while dropping the
conversion. Tests updated/added.

## E. CI root cause #64 (NOT VERIFIED)

- Iteration #1 Gate 1 run `40614177303` (head `c01d3665`): steps via API show
  1a/1b/1c success, 1d Vitest FAILURE, 3a–3c skipped. Failure isolated to the
  vitest step — but WHICH tests failed is unrecoverable: log download fails
  (EOF), 0 artifacts retained.
- Local mechanism repro: restored `__dirname`-style root resolution in
  `deploy-env-consistency.test.ts` and ran it WITH `--coverage`: 5/5 PASS.
  The claimed "`__dirname` broke under coverage" mechanism does NOT reproduce.
- Verdict: ROOT CAUSE NOT VERIFIED. The `process.cwd()` change is harmless
  hardening, unproven as the fix. Revert verified clean (`git diff` empty).

## F. Deploy-config drift

- At `09ea3791`: no executable `--env health` in `deploy.yml` or
  `deploy-with-sha.sh`; three metadata `secret put` fail loud; drift
  regression test intact. #64 fix holds.
- `wrangler.toml [[env]]` topology (health + ultracode) UNCHANGED — still emits
  the non-fatal multi-env warning on top-level `secret put` (proven in prior
  session from run `40626464036` logs; current-run logs not fetchable from this
  sandbox). No topology change (needs CTO/founder decision + non-prod verify).
- `apply-migrations.sh` was rewritten post-#64 (`3ef7d6d7`); deploys since are
  green (incl. `40978523127`). Not re-audited line-by-line (out of scope).

## G. Verification of this branch

- Targeted vitest batches: 26 + 7 + 11 + 155 + 42 + 16 + 6 + 15 + 10-file
  coverage batch — ALL GREEN (see turn log for exact file lists).
- `npm run i18n:validate`: exit 0. `check-production-source-guards.mjs`: exit 0.
  `check-layer-boundaries.sh`: exit 0. Full-repo ESLint: 0 errors (212
  warnings, 2 pre-existing complexity warnings touched: 20→22 and 19→23).
- Diff coverage vs working tree: 21/21 lines, 36/36 branches (100%).
- Full `tsc --noEmit`: OOM/abort locally (4GB sandbox, same as prior session) —
  Gate 1a on CI is the real check. Changed hunks manually reviewed for type
  safety (`ClaimResult.error?: string` accepts the widened `error` var;
  `KILL_SWITCH_UNKNOWN` added to the mission error union; mock shapes match
  `KillSwitchState`).
- No browser, no paid providers, no real publishes, no remote D1 writes, no
  secret values printed. Full-suite local run NOT attempted (OOM risk);
  required checks run on the PR.

## H. Post-merge (addendum, session branch only)

- PR: `https://github.com/minhlongs/sophia-ai-factory/pull/72` — MERGED.
- CI iteration #1 failed at Gate 1a: `campaign-bridge.ts:67` forwards
  `err.code` into `CampaignBridgeError`, whose union lacked the new
  `KILL_SWITCH_UNKNOWN` (diagnosed via check-run annotations; CI logs
  unfetchable from sandbox). Fixed by adding the member to
  `CampaignBridgeErrorCode` (commit `9650b717`); downstream status mapping
  defaults to 500. Iteration #2: all gates green (run `40995429850`:
  1a/1b/1c/1d + 3a/3b/3c success; Gates 2, 4 success).
- Merge commit (main): `e9147a1b980fa911682afa33ea0efe6aeee78093`.
- Post-merge deploy run `40998215398`: success (Stage 1, Stage 2&3, Stage 4).
- Live smoke 2026-10-30 ~04:04Z: `/api/version` →
  `{"shortSha":"e9147a1b","deployedAt":"2026-10-30T04:01:20Z"}` (8-char prefix
  matches merge commit; full 40-char SHA not exposed publicly);
  `/api/health` → healthy; `/vi/login` → VI login page 200.
