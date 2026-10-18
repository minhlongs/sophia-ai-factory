# Sophia Business-Flow Proof

This procedure separates deterministic code proof, live provider proof, and observed production economics. A mock pass is never reported as a live or commercial pass.

## 1. Deterministic gates

From `apps/sophia-ai-factory` run:

```bash
npm run verify:core-video-factory
npm run verify:core-video-factory:evidence
```

The first command runs mock-provider video tests, checkout/IPN lifecycle tests, evidence-contract tests, TypeScript, and ESLint. It writes ignored JSON under `plans/reports/`. The report captures the commit SHA, whether the worktree is dirty, a fingerprint of its current contents, actual gate statuses, and explicit limitations. It proves deterministic behavior only; it does not prove a provider invoice, a real MP4, publishing, production SLOs, or positive contribution margin.

## 2. Live video proof

Run `npm run verify:user-video-flow:live` against staging with a dedicated non-customer test tenant and test channels. The script calls real providers, writes BYOK/HeyGen credentials to that account, spends provider credits, and publishes content. Set `SOPHIA_LIVE_CONFIRM=run-real-provider-flow` and `SOPHIA_LIVE_TEST_TENANT=1`; a production hostname additionally requires `SOPHIA_LIVE_ALLOW_PRODUCTION=1`. The runner also requires `SOPHIA_VERSION_INTROSPECT_TOKEN` to read the full commit SHA from the protected `/api/version` response. Install `ffprobe` and `ffmpeg` on the machine running the proof. Save evidence outside tracked source files and use non-customer credentials. The v4 evidence proves a complete HTTP download up to 512 MiB, an ISO BMFF MP4 `ftyp` box with an accepted MP4-compatible brand, compatible media type, valid stream/container metadata and duration from `ffprobe`, and full audio/video stream decoding by `ffmpeg`; it records the artifact SHA-256 and sanitized stream metadata. Download and each decoder step have finite time limits; the helper has a 2 GiB hard maximum. The live media request accepts only the exact `files2.heygen.ai` host and manually follows at most three redirects that remain on that allowlist. A successful decode proves technical decodability; it does not rate visual/audio quality or prove human approval.

Validate the saved report with:

```bash
npm run verify:user-video-flow:live-evidence -- plans/reports/live-video-proof.json
```

The evidence validator accepts only v4 full-decode artifacts. Its “structure pass” checks the unsigned local JSON fields; it does not cryptographically authenticate that file or attest that an operator preserved it unchanged. Legacy v1-v3 reports remain historical evidence and cannot pass the current full-decode gate.

## 3. NOWPayments USDT checkout proof

Use a clean staging test account. The script creates a real invoice, checks that its HTTPS host is exactly `nowpayments.io`, prints its URL, then waits for the provider callback to complete the order and activate the requested tier. It does not pay the invoice. Before paying it externally, compare the provider page amount with the canonical tier price and set `SOPHIA_PAYMENT_LIVE_AMOUNT_CONFIRMED_USD` to the amount you confirmed.

```bash
SOPHIA_PAYMENT_LIVE_CONFIRM=run-test-payment \
SOPHIA_PAYMENT_LIVE_BASE_URL=https://<staging-host> \
SOPHIA_PAYMENT_LIVE_EMAIL=<test-account-email> \
SOPHIA_PAYMENT_LIVE_PASSWORD=<test-account-password> \
SOPHIA_PAYMENT_LIVE_TIER=BASIC \
SOPHIA_PAYMENT_LIVE_PERIOD=monthly \
SOPHIA_PAYMENT_LIVE_AMOUNT_CONFIRMED_USD=<confirmed-usd-amount> \
SOPHIA_VERSION_INTROSPECT_TOKEN=<protected-version-introspection-token> \
npm run verify:saas-payment:live
```

Production targets require the additional `SOPHIA_PAYMENT_ALLOW_PRODUCTION=1` flag. Do not use a customer account or production checkout for routine verification. Validate the saved report with `npm run verify:saas-payment:live-evidence -- <evidence-file>`.

Webhook signature checks, amount validation, replay handling, refunds, stale locks, and DLQ behavior remain covered by deterministic tests. A live checkout pass does not replace those adversarial cases.

## 4. Existing NOWPayments USDT payout proof

The payout verifier is read-only. It signs into the affiliate account and checks one existing batch through the tenant-scoped payout list. It requires `confirmed`, a real provider withdrawal reference, USDT/TRC20, the expected amount, and a finalization time. It never calls the admin execute-payout route and cannot send money.

```bash
SOPHIA_PAYOUT_LIVE_CONFIRM=verify-settled-payout \
SOPHIA_PAYOUT_LIVE_BASE_URL=https://<staging-host> \
SOPHIA_PAYOUT_LIVE_EMAIL=<affiliate-test-account-email> \
SOPHIA_PAYOUT_LIVE_PASSWORD=<affiliate-test-account-password> \
SOPHIA_PAYOUT_BATCH_ID=<existing-confirmed-batch-id> \
SOPHIA_PAYOUT_EXPECTED_USD=<confirmed-usd-amount> \
SOPHIA_VERSION_INTROSPECT_TOKEN=<protected-version-introspection-token> \
npm run verify:saas-payout:live
```

Production targets require `SOPHIA_PAYOUT_ALLOW_PRODUCTION=1`. Validate with `npm run verify:saas-payout:live-evidence -- <evidence-file>`. The proof establishes NOWPayments confirmation recorded after signed IPN; it does not independently verify on-chain transaction finality because the current payout record does not store a transaction hash.

## 5. Production-window evidence

The final aggregator requires video/payment/payout live proofs and two ignored JSON summaries covering the same 28-day window. Each economics/SLO summary must point to its raw source export with `sourcePath` and provide a matching SHA-256 in `sourceSha256`:

- `sophia-production-economics-evidence-v1`: `dataMode: "observed"`, `revenueScope: "sophia-saas"`, an SHA-256 of its source export, settled transactions, completed video jobs, collected revenue, refunds, payment fees, AI/render/storage costs, `cryptoAffiliatePayoutsUsd`, and other variable costs.
- `sophia-production-slo-evidence-v1`: `dataMode: "observed"`, `sourceName` of `cloudflare-worker-logs` or `cloudflare-metrics`, source SHA-256, API availability/p95/5xx, video completion rate/p95, declared video targets, and unresolved P0/P1 counts.

The aggregator checks the documented API baseline (availability ≥99.9%, p95 <500 ms, 5xx <0.1%), the declared video SLO, no unresolved P0/P1, and positive SaaS contribution margin after refunds, fees, AI/render/storage costs, crypto affiliate payouts, and other variable costs. That margin is before fixed operating expenses and CAC. Creator affiliate revenue is separate from Sophia subscription receipts; payouts are included as cash costs. SLO/economics values remain operator-attested summaries: the verifier binds them to supplied raw export hashes but does not independently authenticate export origin or recalculate those metrics from raw rows. The output status labels this distinction.

```bash
npm run verify:business-flow:evidence -- \
  --video plans/reports/live-video-proof.json \
  --payment plans/reports/live-payment-proof.json \
  --payout plans/reports/live-payout-proof.json \
  --expected-sha <full-40-to-64-character-SHA-from-the-approved-deployment> \
  --economics plans/reports/production-economics.json \
  --slo plans/reports/production-slo.json \
  --out plans/reports/sophia-business-flow-proof-latest.json
```

The output report hashes provider/resource references and source files; raw evidence stays in ignored local report files. This procedure does not configure Honeycomb or require operator-held third-party observability credentials.

## What a pass does not claim

- Mock-provider success is not live-provider availability.
- One paid transaction is not a statistically meaningful conversion, retention, or LTV:CAC result.
- Positive contribution margin is not net profit after fixed costs.
- The payout proof establishes provider confirmation recorded by Sophia, not independent on-chain transaction finality.
- The v4 video proof downloads and fully decodes the artifact, but does not rate visual/audio quality or test playback in a user's browser.
- Legacy v1-v3 video evidence does not prove a complete download or full decode.
- A live video evidence structure pass does not authenticate the unsigned JSON report's origin or integrity.
- Operator-provided SLO/economics summaries are bound to raw source hashes but are not independently recalculated by the verifier.
- A production-window pass applies only to its recorded SHA, window, inputs, and measured SLO targets.
