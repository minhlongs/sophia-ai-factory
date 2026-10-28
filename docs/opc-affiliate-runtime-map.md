# Sophia OPC Affiliate — Runtime, Data and ID Map

Companion to `OPC_AFFILIATE_AUDIT_MATRIX_2026-10-27.md`. Read-only source inspection; no
files changed, no builds, no tests run, no migrations applied, no production endpoint
probed.

- **Pinned snapshot:** `439635e1a2017c2643e013c0311631bd95409de4`
- **Branch:** `feat/opc-affiliate-audit-repair` (tracking `origin/main`)
- **App root:** `/Users/macbook/sophia-opc-audit/apps/sophia-ai-factory`

## Canonical paths (verified, not assumed)

| Concern | Path |
|---|---|
| Inngest serve | `src/app/api/inngest/serve/index.ts` |
| Core registrations | `src/app/api/inngest/serve/core-functions.ts` (47 functions) |
| Growth registrations | `src/app/api/inngest/serve/growth-functions.ts` (40 functions) |
| Function barrel | `src/forest/inngest/functions/index.ts` (51 `export *` lines) |
| Migrations | `migrations/` (432 top-level `.sql` + `_archive/` 5) |
| Migration applier | `scripts/apply-migrations.sh` |
| Orphan-table guard (NOT wired to CI) | `scripts/check-migration-coverage.sh` |
| Affiliates dashboard | `src/app/[locale]/dashboard/affiliates/page.tsx` |
| Affiliate network credential API | `src/app/api/v1/integrations/affiliate-networks/route.ts` |
| Affiliate credential store | `src/tree/affiliates/credentials/storage.ts` |
| Postback ingress | `src/app/api/postback/[network]/core/route-handler.ts` |
| Domain B reconciliation | `src/land/affiliates/reconciliation/workspace-domain-b-reconciliation.ts` |

`serve/index.ts:14-15` spreads `...CORE_INNGEST_FUNCTIONS, ...GROWTH_INNGEST_FUNCTIONS`, so
87 functions are served in total. The barrel is the import surface, which is why a module
absent from the barrel is dead regardless of how well-tested it is.

## Producer → consumer chains, traced to a registered runtime

| Stage | Producer | Consumer | Traced to | Result |
|---|---|---|---|---|
| Offer discovery | `discoverAffiliateOffersAction` | `runAgenticDiscoveryWave` | none | orphaned |
| Offer → campaign | `convertOfferToCampaignAction` | `convertOfferToCampaign` | none | orphaned |
| Campaign dispatch | `dispatchNicheVideoCampaignAction` | `nicheVideoDispatcher` | registered | live, ends at `RENDER_READY` |
| Voiceover | `generateNicheCampaignVoiceover` | `generateVoiceover` | dispatcher | live, failure → `provider:'mock'`, no `audioUrl` |
| Render manifest | `nicheRenderComposer` | — | dispatcher | live, `voiceoverUrl` optional |
| Publish | `socialDirectPublishJob` → `executePlatformUploadAdapter` | — | registered | **fabricates** `publishedUrl` / `platformPostId` |
| Postback | `/api/postback/[network]` | `processSaasCryptoPostback` / `recordConversion` | route | live; writes a table with no DDL |
| Commission read | `fetchWorkspaceDomainBReconciliation` | `affiliates/page.tsx:54-57` | route | path throws; swallowed to zeros |
| Learning loop | `banditTrafficWorker`, `creativeDeliberationWorker`, `flywheelFeedbackDispatcherJob` | — | **not registered** | dead code |
| Traffic scheduling | `scheduleSyndicationJob` | — | **not registered** | dead code |
| Commission DLQ | `enqueueCommissionDlq` | — | **never called** | dead code |
| Live metrics | `loadLiveAffiliateMetrics` | — | **never called** | dead code |
| Predictive render | `predictiveRenderScheduleJob`, `predictiveRenderEvaluateJob` | — | **not registered** | dead code |

## Confirmed-inactive modules (definition + test only)

Verified with `grep -rl "<symbol>" src`; the second file is always a `__tests__/` file.

| Symbol | Files | Definition second reference |
|---|---:|---|
| `banditTrafficWorker` | 2 | `src/forest/growth-v13/__tests__/growth-v13-workers.test.ts` |
| `creativeDeliberationWorker` | 2 | test only |
| `flywheelFeedbackDispatcherJob` | 1 | definition only, no test |
| `predictiveRenderScheduleJob` | 2 | `src/forest/growth-v14/__tests__/predictive-render-worker.test.ts` |
| `predictiveRenderEvaluateJob` | 2 | same test file |
| `scheduleSyndicationJob` | 1 | definition only |
| `enqueueCommissionDlq` | 1 | definition only |
| `loadLiveAffiliateMetrics` | 1 | definition only |

A test-only consumer is not a production caller. All eight rows above are therefore
functionally absent from the shipped product, and every quality gate (type-check, lint,
layer boundaries, i18n, vitest) is green with them absent — the gates compile and test dead
code as happily as live code.

## State and ID flow

- **Credential IDs:** written by `saveCredentials(db, user.id, network, …)` into
  `affiliate_network_credentials`. Reconciliation reads with
  `resolveOrgId(user.id, db) ?? user.id`, so an org-scoped customer's credentials and their
  reconciliation aggregate are keyed by **different tenant values**.
- **Commission IDs:** dedup key `${rec.network}:${rec.externalTxId}`, precedence
  `pending(1) < approved(2) < reversed(3) < paid_receipt(4)` then `occurredAt` tie-break.
  Sound arithmetic — on a table (`workspace_external_commissions`) that no migration
  creates.
- **Job IDs:** `mnf_${crypto.randomUUID()}` in the render composer; the publish adapter
  derives a fake `yt_${data.jobId}` post ID and a `youtube.com/shorts/${jobId}` URL from it,
  so the fabricated URL is *structurally* indistinguishable from a real one on the dashboard.

## Release map (see matrix B09 for verdicts)

- Gate 1a–1e wired in `.github/workflows/deploy.yml:58-70` (type-check, lint, layer
  boundaries, i18n, vitest).
- Stage 2a validates the live ref but never the schema; `check-migration-coverage.sh` is not
  referenced anywhere under `.github/`.
- `.gitignore:86` ignores `*.sql` with only 4 per-file `!` allowlist entries, so a newly
  authored migration is invisible to git and therefore to the CI delta (proven by probe).
- Stage 4 smoke asserts 4 liveness endpoints; no affiliate path is exercised.
