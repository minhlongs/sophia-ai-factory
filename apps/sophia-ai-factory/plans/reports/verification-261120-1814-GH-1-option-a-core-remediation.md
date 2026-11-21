# Option A Core Remediation Verification / Kiểm chứng khắc phục lõi Option A

Date / Ngày: 2026-11-21 (Asia/Saigon). Supersedes prior 2026-11-20 pre-Telegram snapshot in this file while preserving pre-Telegram baseline evidence separately. / Cập nhật bản chụp 2026-11-20 trước Telegram trong tệp này và giữ riêng bằng chứng nền trước Telegram.

## Delivery Status / Trạng thái bàn giao

- **Overall Status / Trạng thái chung:** `READY_FOR_STACKED_DRAFT_PR` — prior core remediation, runbook sanitization, and Telegram operations alerts are verified locally on frozen integrated source. / Khắc phục lõi, làm sạch runbook và cảnh báo vận hành Telegram đã được kiểm chứng cục bộ trên mã tích hợp đóng băng.
- `CORE_CODE_LOCAL: PASS` (pre-Telegram baseline tree `187e63d7307bf75ffb586e7a98bdd09e32d34515`, staged pre-Telegram tree `f59715b7066dcaf776ba0d1a5d4192528c58381b`).
- `TELEGRAM_OPS_LOCAL: PASS` (final integrated source verified under Node v22.23.1: 20,835 passed / 0 failed, diff coverage 93.92% lines / 85.52% branches, all static/build/secretlint gates PASS, independent code review PASS).
- `TELEGRAM_LIVE: NOT_CONFIGURED / NOT_TESTED` (disabled by default; no bot token configured, no live Telegram calls made).
- `SLACK_OPS_FALLBACK: REMOVED / DISABLED` (legacy internal `slack-alert.ts` removed; migrated internal callers use `sendOpsAlert` with no Slack fallback; tenant/customer Slack integrations outside internal ops scope are preserved unchanged).
- `SLACK_SETUP_BY_FOUNDER: NEVER_CONFIGURED — OWNER_REPORTED`
- `HISTORICAL_SLACK_WEBHOOK_ORIGIN: UNKNOWN`
- `HISTORICAL_SLACK_FINDING: UNKNOWN_ORIGIN`
- `CREDENTIAL_CONTAINMENT: UNKNOWN`
- `CORE_ALGORITHM_VALUE: INSUFFICIENT_EVIDENCE`
- `LIVE_MODEL_EVAL: NOT_RUN / NOT_AUTHORIZED`
- `PAID_SCRIPT_CONSUMPTION: NOT_ESTABLISHED`
- Live output quality, customer value, unit economics, BYOK token costs, and true MCU ledger reconciliation: `NOT_MEASURED`. / Chất lượng đầu ra thật, giá trị khách hàng, kinh tế đơn vị, chi phí token BYOK và đối soát sổ cái MCU thật: `NOT_MEASURED`.

## Candidate Identity & Scope / Định danh ứng viên và phạm vi

- Branch / Nhánh: `fix/option-a-core-remediation-1-5`
- Stacked parent base / Nhánh gốc xếp chồng: `fix/sophia-10-6-option-a-revenue-closure` (PR #179, OPEN Draft, base `main`), commit `e8f06eac07ffde492f63e449b83fd09e1d3172fd`, tree `b15353cdb1a69a19959bbcf805cab30c8f9a6bdb`.
- Frozen 38-file executable/source/benchmark candidate (tested by full suite & diff gate):
  - Git tree: `187e63d7307bf75ffb586e7a98bdd09e32d34515`
  - Staged binary diff SHA256 vs `e8f06eac0`: `3c3b40697baabf9cff88b2b7b2c6e00cdc5668710fb94e675cb077f6bb19d751`
  - Executable parity verified: `git diff --exit-code` clean across `src/`, `tests/`, `scripts/`, `package.json`, `package-lock.json`, `pnpm-lock.yaml`, and Vitest configs; `git ls-files --others --exclude-standard src tests scripts` empty.
- Pre-Telegram staged checkpoint tree: `f59715b7066dcaf776ba0d1a5d4192528c58381b` (differs from tested baseline tree `187e63d7307bf75ffb586e7a98bdd09e32d34515` only in this report and the sanitized Slack alerts runbook; executable source, tests, dependencies, and build/test configuration are unchanged in that pre-Telegram checkpoint). / Mốc staged trước Telegram chỉ khác cây nền ở báo cáo này và runbook Slack đã làm sạch.
- Final integrated candidate adds the Telegram operations alerts implementation, tests, telemetry scrubbing, `.env.example`, and `docs/handover/telegram-ops-alerts.md` on top of the preserved core baseline (see Telegram Verification section below). / Ứng viên tích hợp cuối bổ sung cảnh báo vận hành Telegram, kiểm thử, lọc telemetry, `.env.example` và `docs/handover/telegram-ops-alerts.md` trên nền core đã bảo toàn.
- Working tree is **not** clean overall; unrelated inherited/out-of-scope files are intentionally preserved unstaged:
  - `apps/sophia-ai-factory/docs/project-changelog.md` (stale inherited edit)
  - `apps/sophia-ai-factory/docs/project-roadmap.md` (stale inherited edit)
  - `apps/sophia-ai-factory/docs/journals/2026-11-20-checkout-fixture-repair.md`
  - `pnpm-lock.yaml` (root untracked; canonical CI uses `npm ci --legacy-peer-deps` with `apps/sophia-ai-factory/package-lock.json`)
  - `apps/sophia-ai-factory/reports/phase10-9-3/` and root `reports/core-algorithm-acceptance/`, `reports/phase10-6-1/`, `reports/phase10-9/`, `reports/phase10-9-3/`, `reports/phase10-9-5/`

## Three Closure Gates Verified / Ba hạng mục đóng cổng đã kiểm chứng

1. **Changed-branch coverage for `campaign-card-details.tsx`:** Diagnosed original LCOV (`LF:3 LH:0`, `BRF:4 BRH:0`) as unrendered parent component rather than broken LCOV mapping. Added behavioral render/interaction tests (`src/components/stitch/screens/campaigns/campaign-card-details.test.tsx`, 4 cases, no whole-component mocks, real `CampaignCardDetails` + `CampaignScriptReview`). Full canonical LCOV now records `LF:3 LH:3` (100.00%) and `BRF:4 BRH:4` (100.00%, both lines 36 and 53 hit 4/1).
2. **Offline benchmark scorer & tests (`tests/core-algorithm-benchmark/offline-harness.mjs`, `offline-harness.test.mjs`, `docs/core-algorithm-benchmark.md`):** Enforced shared `validAsset()` eligibility and strict human review schema so failed/empty/invalid/critical records cannot earn high-quality credit even with synthetic score 5; failed slots remain in comparison denominator; controlled faults (`A05`–`A09`, 30 slots) stay excluded from creative quality; 50 frozen briefs (dataset SHA256 `c22beaeebe1b20df3c8c547a5f613ad50cecee413e39d7cb788480fa7405d2d0`), 300 planned slots, per-arm 6-stage counts (`planned`, `attempted`, `completed`, `valid`, `reviewed`, `highQuality`) preserved. All live `targetVerdicts` remain `NOT_MEASURED`. `node --test`: 12/12 PASS.
3. **MCU provenance validation:** Any measured numeric `mcu` (including `0`) requires a non-blank, non-`NOT_MEASURED` `mcuDebitRef` string; non-finite/negative/invalid numeric values rejected. Explicitly documented as reference syntax validation only — no true wallet/ledger reconciliation in offline runner.

Independent read-only review (`code-reviewer` `aef5db0aefa376e71`) of the 4 closure files returned **no blocking findings**; SHA256 hashes of all 4 files remain unchanged since review. Focused UI LCOV was controller-verified (not independently read by the reviewer).

## Pre-Telegram Baseline Gate Evidence (Frozen Core Source `187e63d7`, Node v22.23.1) / Bằng chứng nền trước Telegram trên mã lõi đóng băng

| Gate / Cổng | Result / Kết quả |
|---|---|
| `npm test -- --coverage --maxWorkers=2` | **PASS** (exit 0): 2,175 test files passed, 1 skipped (2,176); 20,806 tests passed, 34 skipped, 10 todo (20,850); 874.96s. Overall: 56.86% stmts, 50.20% branches, 56.47% funcs, 57.99% lines. Warning retained: mixed `vitest@4.1.12` and `@vitest/coverage-v8@4.1.6`. |
| `node scripts/check-diff-coverage.mjs` (vs `HEAD = e8f06eac0`) | **PASS**: changed executable lines 185/203 (91.13%), changed branches 164/200 (82.00%); threshold 70%; 0 missing/zero-hit files. |
| `node --test tests/core-algorithm-benchmark/offline-harness.test.mjs` | **PASS**: 12 passed, 0 failed/skipped/todo. |
| `SKIP_SYMBOL_UPLOAD=1 npm run build` | **PASS** (exit 0): compiled in 7.9s; postbuild symbol upload skipped. Caveats: Next.js custom `Cache-Control` warning; `[LandingSSG]` fail-closed error logs for missing OpenRouter key during SSG (no key configured, no paid calls made). |
| `npm run type-check` | **PASS** (exit 0). |
| `npm run lint` | **PASS** (exit 0): 0 errors, 261 warnings. |
| `npm run i18n:validate` | **PASS**: 5,776 `t()` calls, 2,560 static keys, 45 dynamic prefixes, 0 missing/empty/unresolved. |
| Static & guard gates (`check:boundaries`, `check:migrations`, `verify:open-core`, `ci:get-side-effects`, `check:color-tokens`, `check-production-source-guards.mjs`, `git diff --check`, `git diff --cached --check`) | **PASS** (exit 0). |
| Historical pre-sanitization Secretlint (14,214 tracked + candidate inputs, before runbook edit) | **FAIL (historical, remediated)** (exit 1): 3 errors in 1 unchanged file (`apps/sophia-ai-factory/docs/handover/sentry-alerts-setup-runbook-260512.md`, lines 128, 134, 167, `@secretlint/secretlint-rule-slack` `IncomingWebhook`); subsequently remediated and verified PASS in post-sanitization and final integrated scans below. |

### Per-File LCOV Coverage (Changed Production `src/**/*.{ts,tsx}`)

| File | Lines | Branches |
|---|---|---|
| `src/app/actions/campaigns-helpers.ts` | 21/21 (100.00%) | 5/6 (83.33%) |
| `src/app/actions/campaigns.ts` | 29/42 (69.05%) | 18/30 (60.00%) |
| `src/app/api/campaigns/[id]/export/route.ts` | 62/68 (91.18%) | 54/72 (75.00%) |
| `src/app/api/scripts/generate/route.ts` | 44/46 (95.65%) | 23/26 (88.46%) |
| `src/components/stitch/screens/campaigns/campaign-card-details.tsx` | 3/3 (100.00%) | 4/4 (100.00%) |
| `src/components/stitch/screens/campaigns/campaign-script-review.tsx` | 19/25 (76.00%) | 14/18 (77.78%) |
| `src/forest/inngest/functions/campaign/campaign-finalizer.ts` | 22/26 (84.62%) | 5/10 (50.00%) |
| `src/forest/inngest/functions/campaign/campaign-function.ts` | 39/40 (97.50%) | 12/14 (85.71%) |
| `src/forest/inngest/functions/campaign/types.ts` | 0/0 (n/a) | 0/0 (n/a) |
| `src/land/video/generation/generate-campaign-db.ts` | 15/16 (93.75%) | 9/16 (56.25%) |
| `src/seed/ai/script-generator-helpers.ts` | 49/55 (89.09%) | 63/70 (90.00%) |
| `src/seed/ai/script-generator.ts` | 34/39 (87.18%) | 31/38 (81.58%) |
| `src/seed/ai/script-prompt-builders.ts` | 19/19 (100.00%) | 21/26 (80.77%) |
| `src/seed/inference/openrouter/openrouter-caller.ts` | 49/59 (83.05%) | 35/46 (76.09%) |
| `src/tree/usage-metering/idempotency.ts` | 17/17 (100.00%) | 14/14 (100.00%) |
| `src/tree/usage-metering/tracker-db-helpers.ts` | 21/39 (53.85%) | 16/39 (41.03%) |
| `src/tree/usage-metering/tracker.ts` | 14/14 (100.00%) | 13/14 (92.86%) |

## Safety, Workflow & Policy Limits / Giới hạn an toàn và quy trình

- `FEATURE_PAYOS = "false"` verified in `apps/sophia-ai-factory/wrangler.toml:227`.
- No merge, deployment, remote D1 mutation, payment activation, live AI call, live Telegram call, or paid cohort execution performed. PR #177, Issue #178, and PR #179 remain untouched.
- All 11 `.github/workflows/*.yml` triggers inspected: `deploy.yml` triggers only on `push` to `main` or `workflow_dispatch`; `quality-gate.yml`, `security-scan.yml`, and `dependency-audit.yml` filter `pull_request` on `branches: [main]` only (so a stacked Draft PR targeting `fix/sophia-10-6-option-a-revenue-closure` would be `NOT_TRIGGERED_BY_BASE_FILTER` when opened).

## Runbook sanitization / Loại bỏ URL nhúng trong hướng dẫn

- **DONE.** Replaced three embedded Slack URLs with `SLACK_OPS_WEBHOOK_URL` instructions and interactive secret entry; no runtime changes. / Đã bỏ ba URL nhúng và hướng dẫn dán URL khi được hỏi; không đổi hệ thống đang chạy.
- S1 `128:3`, S2 `134:24`, S3 `167:6` (original positions): `@secretlint/secretlint-rule-slack` → `IncomingWebhook`. All three were the same URL. / Cả ba vị trí chứa cùng một URL Slack Incoming Webhook.
- `CREDENTIAL_EXPOSURE_STATUS`: origin and validity **UNKNOWN**; exposure confirmed in the original working file, original staged tree, base commit, and both current remote tips (`main` at `67374b44b`, PR #179 head at `e8f06eac0`). The oldest locally reachable file-change commit `f7f9578ba` also contains it. No verified official example or fixture provenance; GitHub reports secret scanning disabled (404). No webhook request sent. / Chưa xác minh được nguồn gốc hoặc hiệu lực; đã xác nhận URL có trong lịch sử và trên hai nhánh GitHub. Không gửi yêu cầu đến webhook.
- `SLACK_SETUP_BY_FOUNDER: NEVER_CONFIGURED — OWNER_REPORTED`. `HISTORICAL_SLACK_WEBHOOK_ORIGIN: UNKNOWN`; `HISTORICAL_SLACK_FINDING: UNKNOWN_ORIGIN`; `CREDENTIAL_CONTAINMENT: UNKNOWN`. The founder reports never configuring Slack for Sophia. This does not establish that the historical URL is fake, inactive, or revoked. No revocation task is assigned to the founder for an unidentified workspace. / Founder xác nhận chưa từng cấu hình Slack cho Sophia; điều này không chứng minh URL cũ là giả, vô hiệu hoặc đã thu hồi. Không giao founder thao tác thu hồi trong workspace chưa xác định.
- Independent publication review (`code-reviewer` `abbb49c1461a9417c`) returned **CONDITIONAL ALLOW** for publishing the sanitized remediation as a stacked Draft PR: repository `minhlongs/sophia-ai-factory` is public and the same historical value already exists in the public base (`main` and PR #179 head); outgoing additions contain zero occurrences (removed lines only); no accessible repo policy requires proven historical revocation prior to removal-only remediation; conditions met (pass real gates/hooks without bypass, no raw URL in PR body/report/logs, preserve `UNKNOWN_ORIGIN` / `CREDENTIAL_CONTAINMENT: UNKNOWN`, do not assign founder Slack revocation, target stacked parent `fix/sophia-10-6-option-a-revenue-closure`). / Đánh giá xuất bản độc lập cho phép có điều kiện mở stacked Draft PR sau khi đạt đầy đủ cổng kiểm tra và không vượt hook.
- `CURRENT_CANDIDATE_SECRET_SCAN`: focused runbook and full tracked app scan (14,220 paths, existing ignore rules) **PASS**. `git diff --check` and `git diff --cached --check` passed; no dedicated docs lint found in package scripts or workflows. / Quét hướng dẫn và toàn bộ tệp app được theo dõi đều đạt; không tìm thấy cổng lint tài liệu riêng.

- `npm run ci:secrets`: **PASS** (tracked command exit 0). / Lệnh quét bắt buộc đã đạt (mã thoát 0).

### Bounded official-document comparison, 2026-11-21 / Đối chiếu tài liệu chính thức có giới hạn

- Downloaded only the public Slack documentation page `https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks/` (HTTP 200). Compared the one distinct historical URL, extracted locally from the HEAD runbook, against samples extracted from both raw HTML and HTML-stripped, entity-decoded text using exact whole-string equality. No historical URL was transmitted or printed. Neither comparison matched. / Chỉ tải trang tài liệu công khai của Slack, sau đó so sánh nguyên chuỗi tại máy với mẫu trong HTML và văn bản đã bỏ thẻ, giải mã ký tự. Không gửi hoặc in URL lịch sử; cả hai phép so sánh đều không trùng.
- `CREDENTIAL_EXPOSURE_STATUS: UNKNOWN`; `DOCUMENTED_PLACEHOLDER_VERIFIED` is not established. No broader search or webhook request was performed. / Chưa có bằng chứng đây là placeholder chính thức. Không tìm kiếm mở rộng hoặc gọi webhook.
- The earlier owner-action request is superseded by the founder's explicit report above. Unknown historical ownership does not block local Telegram implementation or mock verification. Publication requires a separate assessment of actual policy and outgoing exposure, not an assumed obligation to access Slack. / Yêu cầu founder thao tác Slack trước đây không còn áp dụng theo xác nhận phía trên. Chưa rõ chủ sở hữu lịch sử không chặn triển khai Telegram và kiểm thử local. Việc xuất bản cần đánh giá quy định và phơi lộ thực tế riêng.

## Telegram Operations Alerts Verification (2026-11-21) / Kiểm chứng cảnh báo vận hành Telegram

### Alert Routing Table / Bảng định tuyến cảnh báo

| Alert Origin / Nơi phát cảnh báo | Previous Channel / Kênh cũ | Change Applied / Thay đổi đã thực hiện |
|---|---|---|
| `src/app/api/cron/smoke-one-time/smoke-one-time-helpers.ts` | Legacy internal Slack (`src/land/monitoring/slack-alert.ts`, deleted) | Migrated to `sendOpsAlert` (`high`, `synthetic_fulfillment_stale`); cleanup preserved on alert failure; no Slack fallback |
| `src/app/api/cron/uptime-check/uptime-check-helpers.ts` | Direct legacy `TELEGRAM_BOT_TOKEN` / `ADMIN_TELEGRAM_CHAT_ID` | Migrated to `sendOpsAlert` (`uptime_incident` / `uptime_recovered`); fixed allowlisted payload only |
| `src/app/api/cron/error-digest/digest-core/dispatchers.ts` | Direct legacy Telegram send | Migrated to `sendOpsAlert` (`medium`, `error_digest`); raw digest/model output excluded from Telegram; existing founder email path preserved |
| `src/forest/inngest/functions/ops-telegram-alert.ts` | Shared customer Telegram client / event destination override | Migrated to `sendOpsAlert` (`mission_auth_failure`, `mission_rate_limit`, `mission_failed`); `retries: 0`; server-derived `chat_id` only; unsafe raw formatter removed |
| Sentry / OpenTelemetry (`options-builders.ts`, `sanitizer.ts`, `opentelemetry-setup.ts`) | Error tracking retained | Added `scrubTelegramTelemetry` on Sentry events/breadcrumbs/spans/transactions and `TELEGRAM_FETCH_IGNORE` on OTel fetch instrumentation; external Sentry/Cloudflare account alert rules not modified |
| Customer Telegram bot, Setup Wizard, tenant Slack integrations, weekly BI digest | Customer / non-ops flows | Preserved unchanged (out of internal ops alert scope) |

### Final Integrated Gate Evidence (Frozen Source, Node v22.23.1) / Bằng chứng kiểm tra cuối trên mã tích hợp đóng băng

| Gate / Cổng | Result / Kết quả |
|---|---|
| Independent code review (`code-reviewer` `adb77e9a4ff45a30d`) | **PASS** (0 remaining blockers after `recordOpsFailure` fix; verified across 9 concurrent in-flight failure/success orderings against real `circuit-breaker`) |
| Focused Telegram & accounting tests (7 files) | **PASS**: 54 passed, 0 failed (2.70s) |
| `npm test -- --coverage --maxWorkers=2` | **PASS** (exit 0): 2,178 test files passed, 1 skipped (2,179); 20,835 tests passed, 34 skipped, 10 todo (20,879); 1089.50s. Overall: 56.91% stmts, 50.25% branches, 56.51% funcs, 58.04% lines. Warning retained: mixed `vitest@4.1.12` and `@vitest/coverage-v8@4.1.6`. |
| `node scripts/check-diff-coverage.mjs` (vs `HEAD = e8f06eac0`) | **PASS**: changed executable lines 278/296 (93.92%), changed branches 248/290 (85.52%); threshold 70%; `ops-alert.ts` 100.00% lines / 92.00% branches, `telegram-telemetry-filter.ts` 100.00% lines / 100.00% branches |
| `node --test tests/core-algorithm-benchmark/offline-harness.test.mjs` | **PASS**: 12 passed, 0 failed |
| `SKIP_SYMBOL_UPLOAD=1 npm run build` | **PASS** (exit 0); postbuild symbol upload skipped |
| `npm run type-check`, `npm run lint`, `npm run i18n:validate`, `check:boundaries`, `check:migrations`, `verify:open-core`, `ci:get-side-effects`, `check:color-tokens`, `check-production-source-guards.mjs`, `git diff --check`, `git diff --cached --check` | **PASS** (exit 0) |
| Focused Secretlint (all 21 Telegram/doc/report paths) | **PASS** (exit 0, 0 findings) |
| `npm run ci:secrets` (mandatory tracked secret scan) | **PASS** (exit 0) |

### Operational Limits & Runbook / Giới hạn vận hành và hướng dẫn

- Runbook added: `docs/handover/telegram-ops-alerts.md` (bilingual setup instructions for future dedicated BotFather bot, private/group `chat_id`, safe secret storage, and future approved one-message smoke test).
- Process-local circuit-breaker cooldown honors Telegram `retry_after` within a single Worker isolate; no cross-isolate durable queue, scheduler, dedup, or exactly-once delivery claim. Timeout after provider acceptance yields uncertain delivery.
- `TELEGRAM_OPS_LOCAL: PASS`; `TELEGRAM_LIVE: NOT_CONFIGURED / NOT_TESTED`; `SLACK_OPS_FALLBACK: REMOVED / DISABLED`; `HISTORICAL_SLACK_FINDING: UNKNOWN_ORIGIN`.

## Pre-Review Security Triage, Hosted CI & Worker Packaging Closure (2026-11-21) / Đóng triage bảo mật, CI hosted và đóng gói Worker

### Commit-Bound Code Snapshot (`S_code`) / Ảnh chụp mã gắn commit

- **PR:** Draft PR `#180` (`https://github.com/minhlongs/sophia-ai-factory/pull/180`), branch `fix/option-a-core-remediation-1-5`, stacked base `fix/sophia-10-6-option-a-revenue-closure` (`e8f06eac07ffde492f63e449b83fd09e1d3172fd`, parent Draft PR `#179`).
- **Code Commit (`S_code`):** `a535b376910c53d94c0079726ab5c3dd84435a54` (`fix(security,ci): sanitize script generation logs and trigger PR CI on stacked base`).
- **Scoped Files in `S_code`:** `apps/sophia-ai-factory/src/app/api/scripts/generate/route.ts`, `apps/sophia-ai-factory/src/app/api/scripts/generate/route.test.ts`, `.github/workflows/quality-gate.yml`, `.github/workflows/security-scan.yml`, `.github/workflows/dependency-audit.yml` (`.github/workflows/deploy.yml` untouched).

### Security Triage & Disposition / Phân loại và xử lý bảo mật

- **Finding:** `Secrets/PII in Logs` in `apps/sophia-ai-factory/src/app/api/scripts/generate/route.ts` — **Disposition: `CONFIRMED` and fixed in `S_code`**.
- **Root Cause:** `route.ts` logged raw user-supplied `topic` (up to 500 chars) on start and error paths and passed raw `error` objects to `log.error`. In `src/seed/utils/logger/logger-internals.ts`, `entry.error.message` only runs `scrubPII` (not `redactSecrets`) and raw `error` is forwarded directly to `captureToSentry(error, entry.metadata)`.
- **Fix Applied (`S_code`):** Replaced raw `topic` with `topicLength: topic.length` and replaced raw `error` objects with `errorName` (`error.name` or `"UnknownError"`) across all log calls in `route.ts`.
- **Regression Test:** Added synthetic-marker test in `route.test.ts` verifying synthetic email, phone, and token markers never appear in emitted logger calls across success (200), `InvalidScriptStructureError` (502), `Error` (500), and non-`Error` throw (500) paths (`29 passed / 0 failed`; `route.ts` coverage `93.61%` stmts / `92.3%` branches / `95.65%` lines).
- **Out-of-Scope Hardening Tracked:** Defense-in-depth scrubbing in `src/seed/utils/logger/logger-internals.ts` (scrubbing `error.message`/`stack` with `redactSecrets` + `scrubPII` and scrubbing before `captureToSentry`) filed separately as `ai-handle` issue `#183` (`https://github.com/minhlongs/sophia-ai-factory/issues/183`).
- **Isolated Code Review:** Independent read-only review on `e8f06eac07ffde492f63e449b83fd09e1d3172fd...HEAD` returned **PASS** with 0 blocking findings.

### Hosted CI Verification on `S_code` (`a535b376910c53d94c0079726ab5c3dd84435a54`) / Kiểm chứng CI hosted

All 3 pull-request-only workflows (`permissions: contents: read`, `pull_request` trigger only; `deploy.yml` untouched) ran natively on Draft PR `#180` against stacked base `fix/sophia-10-6-option-a-revenue-closure` and passed:

| Workflow / Check | Conclusion | Evidence / Run URL |
|---|---|---|
| `Quality Gate (Gates 1 + 3)` — `Gate 1 — Validation (tsc + eslint + boundaries + vitest)` | **PASS (`SUCCESS`)** | `https://github.com/minhlongs/sophia-ai-factory/actions/runs/44859146447` (Gate 1a–1f PASS; Gate 3a diff coverage `280/298` = `93.96%` lines, `250/292` = `85.62%` branches vs `BASE_SHA=e8f06eac07ffde492f63e449b83fd09e1d3172fd`; Gate 3b source guards PASS; Gate 3c live secret leaks = `0`) |
| `Security Scan (Gate 2)` — `Gate 2 — Security (npm audit + trufflehog + csp-evaluator)` | **PASS (`SUCCESS`)** | `https://github.com/minhlongs/sophia-ai-factory/actions/runs/44859146454` (production `npm audit --audit-level=high --omit=dev` PASS; TruffleHog `--only-verified` PASS; CSP evaluator PASS) |
| `Dependency Audit (Gate 4)` — `Gate 4 — Dependency (outdated + license check)` | **PASS (`SUCCESS`)** | `https://github.com/minhlongs/sophia-ai-factory/actions/runs/44859146423` (license gate PASS) |

### Non-Deploying Cloudflare Worker Packaging Verification / Kiểm chứng đóng gói Worker không deploy

- **Command (Node v22, `apps/sophia-ai-factory/`):** `env -u SENTRY_AUTH_TOKEN -u CLOUDFLARE_API_TOKEN SKIP_SYMBOL_UPLOAD=1 SKIP_SENTRY_BUILD=1 npm run deploy:build`
- **Result:** **PASS** (zero deployment, zero R2/Sentry/Cloudflare remote side effects).
- **Artifact:** `.open-next/worker.js` — `6,903` bytes, SHA-256 `0aaecc813a45a598e2fd557b492d032d78faad8fe9d029ce18b6bda6bde59940`, contains `/* __SCHEDULED_HANDLER_INJECTED__ */` at line 46 (`23 patterns, 40 routes`).
- **Workspace Hygiene:** All 10 inherited dirty/untracked paths outside PR `#180` scope remain untouched and unstaged (`git status --short` verified before and after build).

### Preserved Truthful Status Invariants / Bất biến trạng thái trung thực

- `TELEGRAM_LIVE: NOT_CONFIGURED / NOT_TESTED` (`OPS_ALERT_PROVIDER` disabled by default; no live Telegram calls made).
- `SLACK_OPS_FALLBACK: REMOVED / DISABLED` for migrated internal ops alerts.
- `SLACK_SETUP_BY_FOUNDER: NEVER_CONFIGURED — OWNER_REPORTED`; `HISTORICAL_SLACK_WEBHOOK_ORIGIN: UNKNOWN`; `HISTORICAL_SLACK_FINDING: UNKNOWN_ORIGIN`; `CREDENTIAL_CONTAINMENT: UNKNOWN`.
- `FEATURE_PAYOS: "false"` (`apps/sophia-ai-factory/wrangler.toml:227`).
- `CORE_ALGORITHM_VALUE: INSUFFICIENT_EVIDENCE`; `LIVE_MODEL_EVAL: NOT_RUN / NOT_AUTHORIZED`; `PAID_SCRIPT_CONSUMPTION: NOT_ESTABLISHED`.
- No merge, no production deployment, no remote D1 mutation, no production secret changes, no PayOS activation, and no paid AI calls were performed.

---

## Post-Deploy Runtime Triage (2026-11-21) / Điều tra vận hành sau phát hành

### 1. Current Production Version & Health / Phiên bản và sức khỏe hiện tại

- **Full SHA:** `84d81654849c9d9d3ea2d8862c15b35c9621f292` (Run `44869506376` — `success`).
- **Deployment ID:** `6773e523-78be-4e2f-9472-cade83340102` | **Active Version:** `1c41a8d5-5d6d-40b3-b8db-afaf7beb2cc7` | **Deploy Timestamp:** `2026-11-21T05:45:06.498099Z`.
- **Prior Live Source:** `bbf37047800f06fa9b1e95e0eaf142b2d3525cb7` | **Conditional Rollback Version (not executed):** `1d74ca52-a2cd-4cb5-b97b-47d13291e6b2`.
- **Live Read-Only Verification:** `/api/version` returns `shortSha: "84d81654"`; `/api/health` returns HTTP `200`; 7/7 low-traffic read-only probe rounds (28/28 requests across `/api/health`, `/api/version`, `/login`, `/vi/login`) passed with `0` failures (cold `/api/health` TTFB `3.33s–3.94s`, warm `0.28s–0.34s`).
- **Preserved Invariants:** `FEATURE_PAYOS=false`, `PAID_COHORT_NOT_AUTHORIZED`, 18 ledger rows (9 migrations) untouched, 10 inherited dirty/untracked paths in the legacy worktree untouched.

### 2. Reconciled Metrics & Sampling Limits / Số liệu đã đối chiếu và giới hạn mẫu

- **602-second post-deploy sample (`05:46:45–05:56:47 UTC`):** `70` Worker invocation records (`event` = 1 Worker invocation, not log lines; `0` missing/`UNKNOWN` outcomes; `0` duplicate records).
- **Exact Breakdown (non-overlapping):**
  - `18` scheduled invocations (`outcome: "exception"`): `* * * * *` fired 10 times = `10` invocations; `*/2 * * * *` fired 5 times = `5`; `*/5 * * * *` fired twice = `2`; `*/10 * * * *` fired once = `1`.
  - `29` internal `WORKER_SELF_REFERENCE` HTTP subrequests (`outcome: "canceled"`): dispatched by `scheduled()` to `/api/cron/*` routes and canceled when `inject-scheduled-handler.mjs` calls `await res.body.cancel().catch(() => {})`.
  - `18 + 29 = 47` `non_ok` invocations (exact match — `18` exceptions are a subset of `47` non-ok, **not** additive).
  - `23` `ok` invocations (~21 `/api/health` probes + ~2 healthy HTTP requests).
- **Sampling & Interpretation Limits:**
  - `47/70` is **not** a customer-facing error rate; all 47 `non_ok` records are internal cron scheduler dispatches and their self-referenced HTTP subrequests.
  - Deploy used `--upload-source-maps=false`, `SKIP_SENTRY_BUILD=1`, `SKIP_SYMBOL_UPLOAD=1`, so runtime stack frames are minified (`worker.js:18781:3407`), mapped offline to `scripts/inject-scheduled-handler.mjs:234-241`.
  - `BASELINE_UNAVAILABLE` for historical pre-deploy Cloudflare tail counts on `bbf37047`; pre/post comparison is established from source diff between `bbf37047` and `84d81654`.

### 3. Sanitized Error-Group Table / Bảng nhóm lỗi đã đối chiếu

| fingerprint | số invocation | số exception object | route template/cron | outcome | HTTP status nếu có | message đã che dữ liệu | stack frame nếu có | ảnh hưởng | evidence reference |
|---|---:|---:|---|---|---|---|---|---|---|
| `cron-scheduled-http-401` | 18 (602s sample) | 18 (1 per scheduled invocation) | `scheduled()` → `* * * * *`, `*/2 * * * *`, `*/5 * * * *`, `*/10 * * * *` (`/api/cron/*`, 38 of 40 routes) | `exception` | `401` (from middleware `handleApiRoute`) | `Error: /api/cron/<route> failed with HTTP 401` | `worker.js:18781:3407` (maps to `scripts/inject-scheduled-handler.mjs:234-241`) | 38 of 40 scheduled background jobs blocked before handler execution; customer HTTP routes unaffected | Targeted live `wrangler tail --version-id 1c41a8d5-5d6d-40b3-b8db-afaf7beb2cc7` + `src/forest/middleware/guard/public-routes.ts` |
| `cron-self-ref-body-cancel` | 29 (602s sample) | 0 | Internal `WORKER_SELF_REFERENCE` HTTP GET `/api/cron/<route>` | `canceled` | `401` (38 blocked routes) / `200` (2 allowlisted routes) | None (no exception; client canceled response body via `res.body.cancel()`) | N/A | Expected Cloudflare `canceled` status when `scheduled()` cancels subrequest body after reading status; not a customer outage | Targeted live `wrangler tail --version-id 1c41a8d5-5d6d-40b3-b8db-afaf7beb2cc7` + `scripts/inject-scheduled-handler.mjs:234` |
| `health-probe-single-failure` | 1 (602s sample) | 0 (client-side probe) | `GET /api/health` | `UNKNOWN` (monitor script discarded output) | `UNRECOVERABLE / NOT_LOGGED` | `UNRECOVERABLE / NOT_LOGGED` (monitor script ran `curl -fsS --max-time 15` every 30s without capturing exit code, HTTP status, timing, or timestamp) | N/A | Single non-recurring probe failure during post-deploy window; 0 failures across Stage 4b/4c smoke and 7/7 subsequent live probe rounds (28/28 expected endpoint outcomes succeeded; `/api/health` returned HTTP 200, while login routes may redirect as expected) | Monitor script `bdesym7gc` recovery + `src/app/api/health/*` diff (`bbf37047..84d81654`: unchanged) |

### 4. Health Probe Failure Diagnosis / Chẩn đoán lần health thất bại

- **Recovered Monitor Command:** `curl -fsS --max-time 15 https://sophia.agencyos.network/api/health` every 30s (`bdesym7gc`), discarding stdout, stderr, exit code, HTTP status, timing, and failure timestamp.
- **Classification & Uncertainty:** Exact failure mode (HTTP 5xx vs 401/403/429 vs DNS/TLS/connect vs 15s client timeout) and Worker invocation correlation are **`UNRECOVERABLE / NOT_LOGGED`** due to monitor script observability loss (`OBSERVABILITY_GAP`).
- **Code & Recurrence Evidence:** `src/app/api/health/route.ts`, `health-probes.ts`, `probe-d1.ts` (3000ms timeout), and `probe-r2.ts` (1500ms timeout) are identical between `bbf37047` and `84d81654`. Stage 4b/4c smoke passed (`05:45:41–05:45:43 UTC`), and 7/7 read-only probe rounds (28/28 requests) met their expected endpoint outcomes with zero failures; `/api/health` returned HTTP `200`, while login routes may return expected redirects.

### 5. Pre/Post Release Relationship & Operational Impact / Quan hệ trước-sau phát hành và ảnh hưởng

- **Root Cause (`bbf37047` vs `84d81654`):**
  - `src/forest/middleware/guard/public-routes.ts` and `src/middleware/api-pipeline.ts` are **unchanged** between `bbf37047` and `84d81654`. Only 5 `/api/cron/*` routes were pinned in `exactPublic` while `if (pathname.startsWith('/api/cron/')) return false` default-denied the other 38 routes in `CRON_ROUTES` with Better Auth middleware HTTP `401` (even after `validateCronRequest` succeeded).
  - Thus the 38-route cron `401` lockout was **pre-existing** before `84d81654`.
  - Release `84d81654` (via `fe391c2a4`) hardened `scripts/inject-scheduled-handler.mjs` to call `res.body.cancel()` and throw `Error(<route> failed with HTTP <status>)` on non-2xx instead of silently logging `→ 401`. This surfaced the pre-existing lockout as explicit Worker `exception` records.
- **Operational Impact:** Customer-facing HTTP endpoints (`/api/health`, `/api/version`, `/login`, `/vi/login`) are unaffected; 38 of 40 scheduled background jobs (e.g., `workflow-stepper`, `fulfillment-retry`, `email-outbox-flush`, `uptime-check`, `heartbeat`, `billing-anomaly-scan`) fail with middleware HTTP `401` until the hotfix is deployed.

### 6. Evidence-Based Decision / Quyết định theo bằng chứng

- **Release Disposition:** **`DEPLOYED_VERIFIED_WITH_DISCLOSED_RUNTIME_ISSUES`** — **Keep `84d81654` live** (do **not** execute conditional rollback to `1d74ca52-a2cd-4cb5-b97b-47d13291e6b2`).
  - **Why not rollback:** Rolling back to `bbf37047` / `1d74ca52` would **not** fix the 38 cron `401` failures—it would only silence their error reporting while critical health/version/login endpoints are healthy on `84d81654`.
- **Minimal Hotfix Prepared (`HISTORICAL / SUPERSEDED` — broad 38-route restoration superseded by backup-only PR #184 policy below):**
  - `apps/sophia-ai-factory/src/forest/middleware/guard/public-routes.ts`: pin all 38 missing scheduled routes from `CRON_ROUTES` (total 43 pinned `/api/cron/*` paths) while preserving default-deny for unlisted `/api/cron/*` paths; every scheduled route retains `validateCronRequest` in middleware and per-route `verifyCronAuth` / `CRON_SECRET` enforcement.
  - `apps/sophia-ai-factory/src/app/api/cron/smoke-one-time/route.ts`: move `verifyCronAuth(request)` ahead of the existing `SYNTHETIC_ENABLED === 'false'` no-op branch so handler authentication is unconditional; the flag condition itself is unchanged.
  - `apps/sophia-ai-factory/src/middleware/__tests__/cron-reachability.test.ts`: regression tests verifying 100% `CRON_ROUTES` parity in `isPublicApiRoute`, default-deny for unlisted `/api/cron/*`, middleware pass-through without browser session lookup across all 40 scheduled routes, `403` rejection on missing/invalid `CRON_SECRET`, and `401` rejection on unauthenticated `smoke-one-time` even when disabled.
- **Independent Review (`HISTORICAL / SUPERSEDED`):** Static review confirmed all 40 scheduled routes map to existing `GET` handlers, all 38 newly pinned entries are in `CRON_ROUTES`, and each handler enforces cron secret authentication (including delegated facade implementations). Review also found the disabled `smoke-one-time` no-op returned before checking the secret; the hotfix fixes this, with a regression test. The regression test proves middleware pass-through, not execution of every job; rate limiting is mocked. No production calls were made during review.
- **Hotfix Verification (`HISTORICAL / SUPERSEDED`):**
  - Focused regression suite (`16` test files, `190` tests): **PASS**.
  - `eslint` on all 3 changed files: **PASS** (`0` errors).
  - `npm run type-check`: **PASS** (`0` errors).
  - Full `npm test`: `20,791 passed | 67 failed` (all `67` failures across `5` files verified identical on untouched `84d81654` baseline: `67 failed | 1 passed`).
  - Local `next build`: blocked in temporary worktree: Turbopack could not resolve the symlinked `next` package; retrying with Node 22 and webpack reached a pre-existing Edge dynamic-code-evaluation error importing `@better-auth/passkey`. Reviewer's isolated environment also could not resolve its Vitest dependency. Full Worker packaging remains to be checked by hosted PR CI; no build failure was hidden.

### 7. One Concrete Remaining Action (`HISTORICAL / SUPERSEDED`) / Hành động còn lại

- Merge and deploy the reviewed hotfix only after the Draft PR's hosted quality and packaging checks pass, then perform a short, bounded observation of frequent cron schedules. This smoke observation cannot verify hourly, daily, weekly, or monthly routes; those remain pending natural schedule runs or separately authorized non-mutating validation. The current run will not merge or deploy the hotfix.

### PR #184 Final Backup-Safe Policy & Verification / Chính sách sao lưu an toàn & Kiểm chứng PR #184

Supersedes the earlier broad-restoration hotfix (Sections 6–7 above) and the intermediate 40-route skip snapshot (`05789c6`). The final PR #184 candidate permits **exactly 1** scheduled route (`/api/cron/d1-backup`, cadence `0 5 * * *`) and keeps the other **39** scheduled routes blocked (including `/api/cron/email-drip` and `/api/cron/error-digest`). / Thay thế bản khôi phục rộng trước đó và bản chặn toàn bộ 40 route (`05789c6`). Bản cuối PR #184 chỉ cho phép **đúng 1** tác vụ định kỳ (`/api/cron/d1-backup`, lịch `0 5 * * *`) và chặn **39** tác vụ còn lại (bao gồm `/api/cron/email-drip` và `/api/cron/error-digest`).

| Schedule / Lịch | Route / Đường dẫn | Outcome / Kết quả |
|---|---|---|
| `* * * * *` | `/api/cron/workflow-stepper` | SKIP / BỎ QUA |
| `*/2 * * * *` | `/api/cron/fulfillment-retry` | SKIP / BỎ QUA |
| `*/2 * * * *` | `/api/cron/email-outbox-flush` | SKIP / BỎ QUA |
| `*/5 * * * *` | `/api/cron/uptime-check` | SKIP / BỎ QUA |
| `*/5 * * * *` | `/api/cron/video-status-sync` | SKIP / BỎ QUA |
| `*/5 * * * *` | `/api/cron/sop-scheduler` | SKIP / BỎ QUA |
| `*/5 * * * *` | `/api/cron/mission-reaper` | SKIP / BỎ QUA |
| `*/10 * * * *` | `/api/cron/heartbeat` | SKIP / BỎ QUA |
| `*/15 * * * *` | `/api/cron/smoke-one-time` | SKIP / BỎ QUA |
| `*/15 * * * *` | `/api/cron/circuit-breaker-scan` | SKIP / BỎ QUA |
| `*/15 * * * *` | `/api/cron/distribution-pipeline-scan` | SKIP / BỎ QUA |
| `*/15 * * * *` | `/api/cron/agent-cost-overrun-scan` | SKIP / BỎ QUA |
| `0 * * * *` | `/api/cron/creative-quality-drift-scan` | SKIP / BỎ QUA |
| `5 * * * *` | `/api/cron/hourly-rollup` | SKIP / BỎ QUA |
| `7 * * * *` | `/api/cron/handover-status-sync` | SKIP / BỎ QUA |
| `7 * * * *` | `/api/cron/ab-winner-picker` | SKIP / BỎ QUA |
| `10 * * * *` | `/api/cron/wallet-rebuild` | SKIP / BỎ QUA |
| `0 */4 * * *` | `/api/cron/affiliate-scout` | SKIP / BỎ QUA |
| `0 0 * * *` | `/api/cron/clearance-promote` | SKIP / BỎ QUA |
| `0 0 * * *` | `/api/cron/promo-trial-expiry` | SKIP / BỎ QUA |
| `0 0 * * *` | `/api/cron/status-rollup` | SKIP / BỎ QUA |
| `0 0 * * *` | `/api/cron/promo-cleanup` | SKIP / BỎ QUA |
| `0 0 * * *` | `/api/cron/pending-orders-cleanup` | SKIP / BỎ QUA |
| `0 0 1 * *` | `/api/cron/mcu-monthly-reset` | SKIP / BỎ QUA |
| `0 0 1 * *` | `/api/cron/slo-burn-rate` | SKIP / BỎ QUA |
| `0 1 * * *` | `/api/cron/dunning-advance` | SKIP / BỎ QUA |
| `5 1 * * *` | `/api/cron/daily-rollup` | SKIP / BỎ QUA |
| `0 2 * * *` | `/api/cron/subscription-reminders` | SKIP / BỎ QUA |
| `0 2 * * *` | `/api/cron/memory-consolidation` | SKIP / BỎ QUA |
| `0 3 * * *` | `/api/cron/scheduled-campaigns` | SKIP / BỎ QUA |
| `30 3 * * *` | `/api/cron/hash-chain-verification` | SKIP / BỎ QUA |
| `0 4 * * *` | `/api/cron/email-drip` | SKIP / BỎ QUA |
| `0 5 * * *` | `/api/cron/d1-backup` | ALLOW (local-only: D1 read + R2 write + `cron_run_log`; external telemetry suppressed) / CHO PHÉP (chỉ nội bộ) |
| `0 5 * * *` | `/api/cron/error-digest` | SKIP / BỎ QUA |
| `0 5 * * *` | `/api/cron/quota-check` | SKIP / BỎ QUA |
| `0 6 * * *` | `/api/cron/fulfillment-reconcile` | SKIP / BỎ QUA |
| `0 6 * * 1` | `/api/cron/weekly-signals-digest` | SKIP / BỎ QUA |
| `0 7 * * *` | `/api/cron/llm-cache-purge` | SKIP / BỎ QUA |
| `0 7 * * *` | `/api/cron/billing-anomaly-scan` | SKIP / BỎ QUA |
| `*/30 * * * *` | `/api/cron/mission-abandon-scan` | SKIP / BỎ QUA |

#### Backup-Safe Execution Boundary & Runtime Fixes / Ranh giới thực thi sao lưu an toàn & Sửa lỗi runtime

- **HISTORICAL / SUPERSEDED — header-based isolation / Cách cô lập bằng tiêu đề HTTP đã được thay thế:** The earlier candidate used an HTTP marker with the cron credential. A network-denied retest showed that the self-fetch still entered the normal HTTP pipeline. / Bản trước dùng dấu hiệu HTTP cùng thông tin xác thực cron. Kiểm thử lại khi chặn mạng cho thấy lời gọi nội bộ vẫn đi qua luồng HTTP thông thường.
- **Rate-limit root cause / Nguyên nhân ghi bộ đếm:** `handleApiPipeline` validates the cron credential before `handleApiRoute` calls `checkRateLimit`; the SQL limiter then calls `incrementRateLimit` and the `increment_rate_limit` D1 operation. / Luồng HTTP xác thực cron trước, sau đó bộ giới hạn gọi thao tác cập nhật bộ đếm trên D1.
- **Honeycomb root cause / Nguyên nhân gửi Honeycomb:** The app's Next.js HTTP path invokes `src/instrumentation.ts` → `src/instrumentation-node.ts` → `initializeOTel` in `src/seed/telemetry/opentelemetry-setup.ts`, which installs the OTLP exporter. With full sampling in the offline fixture, the scheduler with a stub response attempted no exports; forwarding into the real backup HTTP handler and invoking it directly each attempted 10 trace exports. Seven attempts on the scheduled self-fetch occurred during HTTP execution and three after the HTTP response resolved; `waitUntil` ancestry was not established. / Luồng HTTP của ứng dụng khởi tạo bộ gửi OTLP. Trong kiểm thử ngoại tuyến lấy mẫu đầy đủ, lịch với phản hồi giả lập không gửi; qua handler thật hoặc gọi trực tiếp đều có 10 lần thử gửi trace. Bảy lần trong lúc xử lý HTTP, ba lần sau phản hồi; chưa xác định có bắt nguồn từ `waitUntil` hay không.
- **Middleware session boundary / Ranh giới xác thực:** Existing exact exemptions for backup and email-drip are unchanged. Scheduled denial does not remove legacy direct access. / Giữ nguyên quyền gọi trực tiếp hiện hữu; chặn lịch chạy không thay đổi quyền HTTP.
- **Cloudflare runtime bugs caught & fixed during real workerd verification:**
  1. `src/app/api/cron/d1-backup/route.ts` now resolves OpenNext Cloudflare bindings via `globalThis[Symbol.for('__cloudflare-context__')]?.env` (with `__env__` / `__env` / `globalThis` fallback) instead of assuming direct `globalThis.DB` / `globalThis.BACKUPS_BUCKET` properties.
  2. `src/forest/dr/d1-dump-builder.ts` now skips `_cf_METADATA` and any `_cf_*` Cloudflare D1 internal tables so `buildD1Dump` does not fail with `D1_ERROR: access to _cf_METADATA.key is prohibited: SQLITE_AUTH`.

#### HISTORICAL / SUPERSEDED: Earlier Local Candidate / Ứng viên cục bộ trước đó

- **Focused unit tests (Vitest, Node v22.23.1):** **PASS** — `4` test files, `72` tests passed (`0` failed): `inject-scheduled-handler.test.ts`, `cron-reachability.test.ts`, `src/app/api/cron/d1-backup/route.test.ts`, `src/forest/dr/d1-dump-builder.test.ts`.
- **Static gates:** `npm run type-check` **PASS** (`0` errors); `npx eslint` on all changed files **PASS** (`0` errors, `3` pre-existing/config warnings); `npm run check:boundaries` **PASS**.
- **Canonical Worker build (`SKIP_SYMBOL_UPLOAD=1 npm run deploy:build`):** **PASS** (exit 0; injected `23` patterns, `40` routes).
  - `.open-next/worker.js` SHA-256: `1893206c58a3f27cf3d583af5c4fb8c463cd449adb8ba26529fbbdef2ce893f1`.
  - `npx wrangler deploy --dry-run --outdir /tmp/pr184-wrangler-out`: **PASS** (exit 0).
- **Cloudflare workerd / Miniflare v4 packaged Worker integration test (local D1 + local R2 + `WORKER_SELF_REFERENCE`, `outboundService` throwing on any outbound network call, with synthetic `BACKUP_HEARTBEAT_URL`, `SENTRY_DSN`, `BETTER_STACK_SOURCE_TOKEN` configured):** **PASS**
  - `worker.scheduled({ cron: '0 5 * * *' })` (1st run): `outcome: "ok"`, `/api/cron/d1-backup -> 200`, skipped `/api/cron/error-digest` & `/api/cron/quota-check`, wrote `d1-2026-11-21.sql` (`568` bytes, valid SQL dump of fixture rows) to local R2 `BACKUPS_BUCKET`, recorded `cron_run_log` (`last_status: "success"`, `run_count: 1`).
  - `worker.scheduled({ cron: '0 5 * * *' })` (2nd run within 12h): `outcome: "ok"`, `/api/cron/d1-backup -> 200`, 12-hour idempotency guard skipped duplicate upload (`last_status: "skipped"`, `run_count: 2`).
  - Blocked schedules (`*/5 * * * *`, `0 10 * * *`): `outcome: "ok"`, 0 routes dispatched.
  - Separate HTTP matrix: `GET`/`POST /api/cron/d1-backup` with valid `CRON_SECRET` -> `200`; missing or wrong auth (even with `x-sophia-backup-local-only: 1`) -> `403`; `/api/cron/email-drip`, `/api/cron/error-digest`, `/api/cron/d1-backup/extra`, `/api/cron/d1-backup/` even with valid `CRON_SECRET` -> `401` (session boundary enforced).
  - Outbound network calls observed across entire run: **`0`** (`outboundCalls: []`).
- **Hosted CI on base commit `05789c6`:** all 3 workflows **PASS** — Gate 1 Validation (`https://github.com/minhlongs/sophia-ai-factory/actions/runs/44886665211`), Security Scan (`https://github.com/minhlongs/sophia-ai-factory/actions/runs/44886665208`), CI (`https://github.com/minhlongs/sophia-ai-factory/actions/runs/44886665401`). Final patch is local/uncommitted and awaiting independent review before commit and Draft PR push. No production hostnames, remote D1, live providers, or deployments were touched. / Không kiểm thử trên tên miền sản xuất, D1 thật, dịch vụ bên ngoài hay triển khai lên production.

#### Final Execution Evidence — 2026-11-21 / Bằng chứng thực thi cuối

Earlier local runtime results above are HISTORICAL / SUPERSEDED, not final-head evidence. In particular, the header-marker isolation, email-drip 401, and skipped/run_count 2 observations do not describe the final candidate. / Kết quả cũ không đại diện bản cuối, đặc biệt cơ chế đánh dấu tiêu đề HTTP, quyền email-drip và số lần ghi trạng thái bỏ qua.

- **Trusted scheduled-local backup boundary / Ranh giới thực thi nội bộ cho lịch sao lưu:** `scripts/inject-scheduled-handler.mjs` bundles the pure binding-only `src/forest/dr/scheduled-d1-backup.ts` (importing only `./d1-dump-builder`, zero HTTP/Next/logger/telemetry imports) inline via `esbuild` and invokes it directly with `{ DB: env.DB, BACKUPS_BUCKET: env.BACKUPS_BUCKET }` for `/api/cron/d1-backup` after `CRON_SECRET` fail-fast. Scheduled backup no longer enters Next.js HTTP middleware or `instrumentation.ts`, eliminating both the D1 `rate_limits` write and Honeycomb OTLP export attempts without disabling global tracing or altering HTTP middleware/rate limits. The HTTP route (`route.ts` / `d1-backup-runner.ts`) removes `x-sophia-backup-local-only` and delegates to the same backup core while preserving HTTP auth, rate limiting, and telemetry. / Trình chạy lịch nhúng trực tiếp lõi sao lưu thuần dùng binding `DB`/`BACKUPS_BUCKET`, không đi qua middleware HTTP hay `instrumentation.ts`, loại bỏ hoàn toàn ghi bộ đếm `rate_limits` và gửi Honeycomb mà không tắt tracing toàn cục hay đổi giới hạn HTTP.
- **Policy & HTTP parity / Chính sách & tương đương HTTP:** 23 cron patterns, 40 unique routes, **1 permitted** (`/api/cron/d1-backup`), **39 blocked** before Worker-binding invocation. Direct HTTP retains `GET`/`POST /api/cron/d1-backup` (`200` with valid `CRON_SECRET` and ordinary `rate_limits` write; `403` without/invalid auth), legacy direct `/api/cron/email-drip` access (`403` without auth; passes middleware session guard with valid `CRON_SECRET`), and `401` on all 38 private scheduled routes plus 3 unlisted/variant paths. / Giữ 23 lịch, 40 đường dẫn, cho phép 1 và chặn 39; xác thực HTTP trực tiếp và quyền `email-drip` giữ nguyên.
- **Backup correctness & concurrency / Tính đúng đắn & đồng thời:** R2 create-only conditional writes (`onlyIf: { etagDoesNotMatch: '*' }`) + artifact validation before reuse; conditional `cron_run_log` failure UPSERT cannot overwrite a concurrent recent success (no new migration); only recent `success` skips without mutating `last_run_at`/`run_count`; failed runs remain retryable; tracking failure after artifact creation returns `backup_tracking_failed` with `artifactPresent: true` (HTTP `500` / scheduled exception) and retry reuses the existing valid artifact. Residual limit: D1 and R2 do not share a single atomic transaction, so competing triggers can both dump D1 before R2 create-only selects one winner (no exactly-once claim). / Ghi R2 có điều kiện và kiểm tra bản sao trước khi tái sử dụng; lỗi ghi trạng thái không ghi đè thành công đồng thời gần đây; không có khóa giao dịch nguyên tử giữa D1 và R2.
- **Static & focused unit gates (Node v22.23.1):** Focused Vitest suites **76 passed / 0 failed** across 5 files (`inject-scheduled-handler.test.ts`, `scheduled-d1-backup.test.ts`, `d1-dump-builder.test.ts`, `route.test.ts`, `cron-reachability.test.ts`); `tsc --noEmit` **PASS**; scoped ESLint **0 errors, 0 warnings**; `npm run check:boundaries` **PASS**; `check-production-source-guards.mjs` **PASS**; scoped `secretlint` **PASS** (exit 0). / Toàn bộ kiểm thử tập trung 76/76 qua, kiểm tra kiểu, lint 0 lỗi 0 cảnh báo, ranh giới lớp, guard nguồn và quét bí mật đều qua.
- **Canonical build & artifacts (Node v22.23.1):** `SKIP_SYMBOL_UPLOAD=1 npm run deploy:build` **PASS** (exit 0; 23 patterns, 40 routes); `npx wrangler deploy --dry-run` **PASS** (exit 0).
  - `.open-next/worker.js` SHA-256: `4fb797010c80e1a603f72380956da33e2235c5dd934836387a36affb7f55745f`
  - Bundled Worker (`/tmp/pr184-wrangler-final/worker.js`) SHA-256: `5931ef2a87199fd166a5d4c8c9e7cd6486548bf151896946fc035dc03ff998c1`
- **OS-network-denied packaged Worker verification (`sandbox-exec` + Miniflare/workerd, `OTEL_SAMPLERATE=1`, synthetic telemetry env vars):** **PASS** (`ALL_OFFLINE_PACKAGED_WORKER_CHECKS_PASSED`)
  - Scheduled isolated matrix: 23 patterns, 40 routes, 1 permitted / 39 blocked, `selfRefCalls: 0`, `rateLimitWrites: 0`, `outboundAttempts: 0` (including Honeycomb).
  - Deterministic competing-claims concurrency barrier: 2 concurrent `scheduled({ cron: '0 5 * * *' })` runs both passed `SELECT` (`selectHits: 2`), both reached R2 `put` (`putAttempts: 2`), `putCreated: 1`, `putConditionFailed: 1`, 1 final R2 artifact, `rateLimitWrites: 0`, `outboundAttempts: 0`.
  - Direct HTTP parity: `GET`/`POST /api/cron/d1-backup` `200` (`httpRateLimitCount: 1`), invalid auth `403`, tracking partial failure `500` (`backup_tracking_failed`, `artifactPresent: true`), `email-drip` legacy access preserved, 38 private routes + 3 variants `401`.
- **Independent read-only code review:** **PASS** (0 blocking findings; 76/76 targeted tests, 0 TypeScript errors, 0 ESLint errors, generated snippet `11,693` bytes with zero `next/server`, `Honeycomb`, `globalThis.fetch`, or spoofable HTTP marker references). / Đánh giá độc lập chỉ đọc: ĐẠT (0 lỗi chặn).
- **Draft PR delivery & hosted CI:** Ready for commit and Draft PR #184 push (no merge, deploy, rollback, or production execution). / Sẵn sàng commit và đẩy lên Draft PR #184 (không merge, deploy hay chạy production).
