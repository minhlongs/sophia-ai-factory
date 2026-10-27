# Handoff — OPC Affiliate repair PR

## 1. What to review first

1. **`migrations/0482_opc_affiliate_execution_truth.sql`** — the durable state. Check the
   `CHECK (platform_fee_cents = 0)`, tenant-scoped unique keys, and that applying it twice is
   harmless. It is allowlisted in root `.gitignore` (like 0475–0477) because `*.sql` is ignored.
2. **`src/tree/affiliate/execution/execution-contract.ts`** — the only place allowed to authorise
   a state transition. If a reviewer finds a producer using a state name not in `EXECUTION_STATES`,
   that is a bug.
3. **`src/forest/inngest/functions/niche-video-dispatcher.ts`** — canonical producer. It now
   persists `render_queued` with `transitionRun` (added during independent review), returns
   `RENDER_QUEUED` (never `RENDER_READY`), and reports `RUN_ALREADY_ADVANCED` on replay.
4. **`src/land/affiliates/reconciliation/workspace-domain-b-reconciliation.ts`** and
   **`src/land/affiliates/postbacks/saas-crypto-postback-service.ts`** — money truth.
5. **`src/forest/inngest/functions/flywheel-feedback-dispatcher.ts`** +
   **`src/tree/affiliate/optimization/feedback-repository.ts`** — exactly-once learning.
6. **`src/app/[locale]/dashboard/affiliates/page.tsx`** + **`dashboard-load-state.ts`** — operator
   honesty (error ≠ zero, unknown halt ≠ off).
7. **`src/forest/dashboard/dashboard-nav-modules.ts`** + landing hero + messages — six groups,
   exact VI/EN headline, illustrative demo, deep-link preservation.

Full list: `git diff --stat` (56 tracked files) plus 17 new files; see `runtime-map.md`.

## 2. How to run the checks

```bash
cd apps/sophia-ai-factory
npm install --legacy-peer-deps                 # CI shape: native better-sqlite3 builds
npm run type-check                            # CI Gate 1a
npm run lint                                  # CI Gate 1b (0 errors, 212 warnings < 525)
npm run check:boundaries                      # CI Gate 1c
npm run i18n:validate                         # VI/EN parity
npm test -- --coverage --maxWorkers=2         # CI Gate 1d (~19 min)
node scripts/check-diff-coverage.mjs          # CI Gate 3a: ≥70% changed lines/branches
node scripts/check-production-source-guards.mjs
```

The authoritative CI workflow is `.github/workflows/quality-gate.yml` (pull_request → main). It
also runs a secret-leak grep. There is no `build` step in that workflow; `npm run build` is a
separate deploy-time script.

Targeted OPC checks (fast, no browser):

```bash
npx vitest run src/tree/affiliate/execution/__tests__ \
  src/tree/affiliate/offers/__tests__ \
  src/land/affiliates/__tests__/domain-b-ledger-invariants.test.ts \
  src/land/affiliates/postbacks/__tests__/saas-crypto-postback-service.test.ts \
  src/forest/inngest/functions/__tests__/flywheel-feedback-dispatcher.test.ts \
  src/forest/inngest/functions/__tests__/niche-video-dispatcher.test.ts \
  src/land/affiliates/dashboard/__tests__/dashboard-load-state.test.ts \
  src/components/stitch/screens/landing-hero/__tests__/landing-honesty.test.ts \
  src/forest/dashboard/__tests__/opc-primary-nav.test.tsx
```

## 3. Deploy order (when explicitly authorised — NOT done here)

1. Apply `0482_opc_affiliate_execution_truth.sql` to the D1 database **before** deploying code that
   references these tables. It is idempotent and safe to re-run; verify with the repo's migration
   runner, not by hand on production data.
2. Deploy the app. The dispatcher will fail closed (`DB_UNAVAILABLE` / typed `FAILED`) if the
   tables are missing — it will not fabricate success.
3. Configure workspace BYOK credentials through the existing Setup Wizard. Until then, TTS returns
   `PROVIDER_UNAVAILABLE` and no media is produced. Do **not** set `NODE_ENV=test` in production to
   bypass the mock-provider guard.
4. Register/confirm the Inngest serve route includes `flywheelFeedbackDispatcherJob`
   (`growth-functions.ts`). `route-registration.test.ts` covers this.
5. Only then consider a real render worker. **There is currently no render/publish provider
   consumer**: `evaluateArtifactGate` and `evaluatePublishGate` deliberately block `rendered` /
   `publish_queued` until verified bytes and an approved link/account exist.

## 4. Open items / honest blockers

| Item | Status | Why / next step |
| --- | --- | --- |
| Real render + publish worker | NOT IMPLEMENTED | Needs a provider (BYOK) and a durable job that calls `recordVerifiedArtifact` then `evaluatePublishGate`. Do not shortcut the state machine. |
| Real analytics provider correctness | BLOCKED | `flywheelFeedbackDispatcherJob` refuses `isFixture:true`; connect a real observed-metrics source with cohort/window/impressions before switching on learning. |
| Telegram entrypoint contract | NOT VERIFIED | Event shape was extended; re-test the Telegram producer with `tenantId`, `offerId`, `termsVerified`, `idempotencyKey`. |
| Multi-writer budget reservation | NOT VERIFIED | CAS state transitions tested; a true concurrent cost reserve/release ledger needs a D1 transaction boundary test. |
| Visual / responsive / a11y in browser | NOT VERIFIED | Mandate forbids browser tooling. Component tests cover semantics only. |
| Real provider / commercial validation | NOT VERIFIED | No credentials, no paid spend, no real posts, no customer data. |
| Full `tsc --noEmit` locally | NOT VERIFIED | OOM in 4 GB sandbox; CI full run is authoritative. |
| `next build` locally | see `verification.md` §6 | Not part of quality-gate; sandbox memory limited. |

## 5. Vocabulary guard for future changes

Do not reintroduce: `RENDER_READY`, `LIVE DECK`, `SUCCESS` for an evaluation, `tenant_<id>` as a
user id, `GLOBAL`/`US` as a default jurisdiction, hardcoded bonus/discount claims, `Winning Hook:`
as a product name, summed multi-currency totals, `Math.random()` in the posterior, mock metrics
without `isFixture`, or a `default` tenant write.

Preferred: `RENDER_QUEUED`, `ILLUSTRATIVE PREVIEW`, `EVALUATED` + `dispatchedCount`, explicit
`JURISDICTION_UNKNOWN`, verified `offerId`, seeded RNG, `totalsAvailable:false`, `isFixture:true`,
server-resolved `tenantId`.

## 6. Commercial / legal posture

- Domain B external affiliate earnings stay 100 % workspace-owned: `commission_sophia = 0`,
  `platform_fee_cents = 0` enforced by CHECK. Subscription billing, Refer Sophia and partner
  payouts remain separate systems.
- CEX here means affiliate marketing only — no custody, trading, withdrawals or profit promises.
- No global legal certification is claimed; jurisdiction checks are conservative fail-closed
  gates, not legal advice.
- Demo content is labelled illustrative. No revenue, creator-count, star-rating, "zero
  hallucination" or "LIVE" claim is made.

## 6b. Dependency note (CI Gate 2a)

`better-auth` was bumped from `^1.6.14` (locked 1.6.29) to `^1.7.14` because advisory
`GHSA-44jh-23m7-hpcf` (critical, PostgreSQL rate-limit bypass in the bundled drizzle/kysely
adapters) made `npm audit --audit-level=high --omit=dev` fail on the first CI run. This was a
newly published advisory, not a regression from this branch. The bump stays inside the existing
semver range, changes only `package.json` + `package-lock.json`, keeps all canonical auth imports
unchanged, and was validated with 36 auth/session/middleware tests plus the wider scoped tsc.
`npm audit --omit=dev` now reports 0 vulnerabilities.

## 7. Issue / PR bookkeeping note

Tracking issue: **#62** — "OPC Affiliate: repair execution truth + usable operator journey". It was
created with `ready to cook` requested, but the GitHub App token in this session returns
`403 Resource not accessible by integration` for label mutations, so **the issue has no labels**.
A maintainer with label permission should apply `in progress` (and later `ready to ship stable`)
manually. The PR references #62.

## 8. Scope boundary of this handoff

Stop at a **reviewed PR with green checks**. No merge, no deploy, no remote migration. A founder
must explicitly add `--ship` in a new run for any of those actions.
