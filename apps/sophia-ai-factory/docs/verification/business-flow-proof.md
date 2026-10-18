# Sophia Business-Flow Proof

This procedure separates deterministic code proof, live provider proof, and observed production economics. A mock pass is never reported as a live or commercial pass.

## 1. Deterministic gates

From `apps/sophia-ai-factory` run:

```bash
npm run verify:core-video-factory
npm run verify:core-video-factory:evidence
```

The [deterministic proof runner](../../scripts/verify-core-video-factory.mjs) runs mock-provider video and proof-flow tests, checkout and NOWPayments IPN lifecycle tests, PayOS callback signature/amount/idempotency tests, proof-evidence contract tests, TypeScript, and ESLint. Its JSON report under `plans/reports/` is covered by the app `.gitignore`; it captures the commit SHA, worktree state and fingerprint, gate statuses, and limitations. These gates are deterministic only: they do not prove a live provider invoice, real MP4 download, live publishing, production SLOs, or positive contribution margin. Passing PayOS tests do not prove live PayOS operation.

## 2. Live video proof

Run `npm run verify:user-video-flow:live` against staging with an operator-confirmed, dedicated non-customer test tenant and test channels. It calls real providers, saves BYOK/HeyGen credentials to that account, can spend provider credits, and schedules multi-platform distribution. It waits for each distribution job to report one of the runner's accepted success states; that does not independently establish that a post is publicly viewable. Set `SOPHIA_LIVE_CONFIRM=run-real-provider-flow` and `SOPHIA_LIVE_TEST_TENANT=1`; a production hostname additionally requires `SOPHIA_LIVE_ALLOW_PRODUCTION=1`. The runner also requires `SOPHIA_VERSION_INTROSPECT_TOKEN` to read the full commit SHA from the protected `/api/version` response. Install `ffprobe` and `ffmpeg` on the machine running the proof.

The app `.gitignore` excludes `plans/`, including the runners' default `plans/reports/live-*.json` evidence paths. For extra isolation, use an access-controlled directory outside the repository for raw provider evidence. Set `SOPHIA_PROOF_DIR` to an absolute private path before running provider proofs, create it, and restrict access:

```bash
export SOPHIA_PROOF_DIR=/secure/private/path
mkdir -p "$SOPHIA_PROOF_DIR"
chmod 700 "$SOPHIA_PROOF_DIR"
```

The live video runner requires `SOPHIA_LIVE_EVIDENCE_PATH` to write a report; the payment and payout runners use their corresponding `SOPHIA_*_LIVE_EVIDENCE_PATH` variables.

The [live runner](../../scripts/verify-user-video-flow-live.mjs) delegates artifact checks to the [media verifier](../../scripts/live-proof/media.mjs). The v4 video step downloads the complete HTTP 200 response (512 MiB default limit; the helper permits a configured limit up to 2 GiB), compares actual bytes with a valid numeric `Content-Length` when supplied, and calculates the artifact SHA-256. A provided content type must be MP4-compatible; a missing content type is tolerated. It requires a recognized ISO BMFF MP4 `ftyp` brand, MP4 container metadata and positive duration from `ffprobe`, plus at least one video stream. `ffmpeg` fully decodes every present audio/video stream; an audio stream is optional. The runner records sanitized stream metadata. Download, `ffprobe`, and `ffmpeg` each have finite time limits. The live media request accepts only the normalized `files2.heygen.ai` hostname and manually follows at most three redirects that remain on that hostname allowlist. Hostname checks do not pin DNS answers or reject private IP resolutions; this proof relies on trusted DNS and outbound network policy. The decode proves technical decodability only; it does not rate visual/audio quality, verify playback in a browser, or prove human approval.

With the remaining live-video environment variables configured, run and validate the proof. Use `npm run verify:user-video-flow:live -- --help` to see the runner's required settings:

```bash
SOPHIA_LIVE_EVIDENCE_PATH="$SOPHIA_PROOF_DIR/live-video-proof.json" \
npm run verify:user-video-flow:live

npm run verify:user-video-flow:live-evidence -- "$SOPHIA_PROOF_DIR/live-video-proof.json"
```

The [evidence validator](../../scripts/verify-user-video-flow-live-evidence.mjs) accepts only v4 full-decode artifacts. Its structure pass checks the unsigned local JSON fields; it does not cryptographically authenticate the file, attest that an operator preserved it unchanged, or re-download the artifact. Legacy v1-v3 reports remain historical evidence and cannot pass the current full-decode gate.

## 3. NOWPayments USDT checkout proof

Use a clean staging test account. The [payment runner](../../scripts/verify-saas-payment-live.mjs) creates a real invoice, checks that its HTTPS host is exactly `nowpayments.io`, prints its URL, then waits for the provider callback to complete the order and activate the requested tier. It does not pay the invoice. Before paying it externally, compare the provider page amount with the canonical tier price and set `SOPHIA_PAYMENT_LIVE_AMOUNT_CONFIRMED_USD` to the amount you confirmed.

```bash
SOPHIA_PAYMENT_LIVE_CONFIRM=run-test-payment \
SOPHIA_PAYMENT_LIVE_BASE_URL=https://<staging-host> \
SOPHIA_PAYMENT_LIVE_EMAIL=<test-account-email> \
SOPHIA_PAYMENT_LIVE_PASSWORD=<test-account-password> \
SOPHIA_PAYMENT_LIVE_TIER=BASIC \
SOPHIA_PAYMENT_LIVE_PERIOD=monthly \
SOPHIA_PAYMENT_LIVE_AMOUNT_CONFIRMED_USD=<confirmed-usd-amount> \
SOPHIA_VERSION_INTROSPECT_TOKEN=<protected-version-introspection-token> \
SOPHIA_PAYMENT_LIVE_EVIDENCE_PATH="$SOPHIA_PROOF_DIR/live-payment-proof.json" \
npm run verify:saas-payment:live
```

Production targets require the additional `SOPHIA_PAYMENT_ALLOW_PRODUCTION=1` flag. Do not use a customer account or production checkout for routine verification. Validate the saved report with `npm run verify:saas-payment:live-evidence -- "$SOPHIA_PROOF_DIR/live-payment-proof.json"`.

Webhook signature checks, amount validation, replay handling, refunds, stale locks, and DLQ behavior remain covered by deterministic tests. A live checkout pass does not replace those adversarial cases.

## 4. Existing NOWPayments USDT payout proof

The [payout verifier](../../scripts/verify-saas-payout-live.mjs) is read-only. It signs into the affiliate account and checks one existing batch through the tenant-scoped payout list. It requires `confirmed`, a real provider withdrawal reference, USDT/TRC20, the expected amount, and a finalization time. It never calls the admin execute-payout route and cannot send money.

```bash
SOPHIA_PAYOUT_LIVE_CONFIRM=verify-settled-payout \
SOPHIA_PAYOUT_LIVE_BASE_URL=https://<staging-host> \
SOPHIA_PAYOUT_LIVE_EMAIL=<affiliate-test-account-email> \
SOPHIA_PAYOUT_LIVE_PASSWORD=<affiliate-test-account-password> \
SOPHIA_PAYOUT_BATCH_ID=<existing-confirmed-batch-id> \
SOPHIA_PAYOUT_EXPECTED_USD=<confirmed-usd-amount> \
SOPHIA_VERSION_INTROSPECT_TOKEN=<protected-version-introspection-token> \
SOPHIA_PAYOUT_LIVE_EVIDENCE_PATH="$SOPHIA_PROOF_DIR/live-payout-proof.json" \
npm run verify:saas-payout:live
```

Production targets require `SOPHIA_PAYOUT_ALLOW_PRODUCTION=1`. Validate with `npm run verify:saas-payout:live-evidence -- "$SOPHIA_PROOF_DIR/live-payout-proof.json"`. The proof establishes NOWPayments confirmation recorded after signed IPN; it does not independently verify on-chain transaction finality because the current payout record does not store a transaction hash.

## 5. Production-window evidence

The [business-flow evidence aggregator](../../scripts/verify-sophia-business-flow-evidence.mjs) requires video/payment/payout live proofs and two JSON summaries bound to raw source exports. Set `--expected-sha` to the approved full deployment SHA; all three live proofs must target that same SHA. The economics and SLO windows must each cover at least 28 days and have matching start/end boundaries within 60 seconds. Each summary must point to its raw source export with `sourcePath` and provide a matching SHA-256 in `sourceSha256`:

- `sophia-production-economics-evidence-v1`: `dataMode: "observed"`, `revenueScope: "sophia-saas"`, an SHA-256 of its source export, at least one settled transaction and completed video job, collected revenue, refunds, payment fees, AI/render/storage costs, `cryptoAffiliatePayoutsUsd`, and other variable costs.
- `sophia-production-slo-evidence-v1`: `dataMode: "observed"`, `sourceName` of `cloudflare-worker-logs` or `cloudflare-metrics`, source SHA-256, API availability/p95/5xx, video completion rate/p95, declared video targets, at least one eligible video job, and zero unresolved P0/P1 counts.

Accepting a Cloudflare source name in the summary schema does not prove the collection path is active. Current repository state has only an isolate-local `/api/metrics` ring buffer, no configured `WAE` binding in `wrangler.toml`, and middleware timings that stop before downstream route handlers finish. Until those gaps are closed and the raw Cloudflare export is validated, the SLO window is unproven; see [SLO status and evidence requirements](../slo.md).

The aggregator checks the API baseline (availability ≥99.9%, p95 <500 ms, 5xx <0.1%), the declared video SLO, zero unresolved P0/P1, and positive Sophia SaaS contribution margin after refunds, fees, AI/render/storage costs, crypto affiliate payouts, and other variable costs. The confirmed payout must fall inside the economics window, and `cryptoAffiliatePayoutsUsd` must cover it within $0.01. The margin is before fixed operating expenses and CAC. Creator affiliate revenue is separate from Sophia subscription receipts; payouts are included as costs. SLO/economics values remain operator-attested summaries: the verifier binds them to supplied raw export hashes but does not authenticate export origin or recalculate metrics from raw rows. The aggregator labels its result `passed-source-bound-operator-attestation`.

```bash
npm run verify:business-flow:evidence -- \
  --video "$SOPHIA_PROOF_DIR/live-video-proof.json" \
  --payment "$SOPHIA_PROOF_DIR/live-payment-proof.json" \
  --payout "$SOPHIA_PROOF_DIR/live-payout-proof.json" \
  --expected-sha <full-40-to-64-character-SHA-from-the-approved-deployment> \
  --economics "$SOPHIA_PROOF_DIR/production-economics.json" \
  --slo "$SOPHIA_PROOF_DIR/production-slo.json" \
  --out "$SOPHIA_PROOF_DIR/sophia-business-flow-proof-latest.json"
```

The output report hashes proof and source files and emits hashed provider/resource references; raw evidence stays in the access-controlled directory. The JSON reports are unsigned; hashes bind the supplied bytes but do not prove who created them or where source data came from. This procedure does not configure Honeycomb or require operator-held third-party observability credentials.

## What a pass does not claim

- Mock-provider success is not live-provider availability.
- One paid transaction is not a statistically meaningful conversion, retention, or LTV:CAC result.
- Positive contribution margin is not net profit after fixed costs.
- The payout proof establishes provider confirmation recorded by Sophia, not independent on-chain transaction finality.
- The v4 video proof downloads and fully decodes the artifact, but does not rate visual/audio quality or test playback in a user's browser.
- A passing distribution-job status does not independently prove that a post is publicly viewable on its destination platform.
- These business-flow live gates cover NOWPayments checkout and payout; PayOS remains an active domestic method but currently has deterministic tests only, not a live staging proof. A PayOS live pass must create a real staging payment link, confirm the displayed VND amount, complete payment with a dedicated test account, observe the body-signed callback, and verify exactly one order completion and tier activation on the same SHA.
- Legacy v1-v3 video evidence does not prove a complete download or full decode.
- A live video evidence structure pass does not authenticate the unsigned JSON report's origin or integrity.
- Operator-provided SLO/economics summaries are bound to raw source hashes but are not independently recalculated by the verifier.
- A production-window pass applies only to its recorded SHA, window, inputs, and measured SLO targets.
