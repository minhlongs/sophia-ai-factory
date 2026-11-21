# Option A Core Remediation Verification / Kiểm chứng khắc phục lõi Option A

Date / Ngày: 2026-11-20 (Asia/Saigon). Supersedes prior uncommitted 20,796-test / no-coverage snapshot in this file. / Thay thế bản chụp 20.796 kiểm thử chưa đo bao phủ trước đó trong tệp này.

## Delivery Status / Trạng thái bàn giao

- **Overall Status / Trạng thái chung:** `BLOCKED` (no commit, no push, no Draft PR created / chưa commit, chưa đẩy nhánh, chưa tạo Draft PR).
- `CORE_CODE_DELIVERY: BLOCKED` — blocked solely by full-candidate Secretlint (`FAIL`: 3 preexisting findings in `apps/sophia-ai-factory/docs/handover/sentry-alerts-setup-runbook-260512.md`, lines 128, 134, 167; token provenance unproven after one authorized boolean-only local read; no ignore/rule relaxation and no concealment edit performed). / Bị chặn duy nhất bởi Secretlint toàn bộ ứng viên (3 phát hiện sẵn có trong tài liệu runbook chưa sửa; chưa chứng minh được tính giả lập của phần token; không nới lỏng luật quét và không tự ý sửa để che giấu).
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
- The final staged tree differs from tested tree `187e63d7307bf75ffb586e7a98bdd09e32d34515` only in this report and the Slack alerts runbook. The executable source, tests, dependencies, and build/test configuration are unchanged. / Cây staged cuối chỉ khác cây đã kiểm thử ở báo cáo này và hướng dẫn cảnh báo Slack. Mã, kiểm thử, thư viện và cấu hình không đổi.
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

## Fresh Gate Evidence (Frozen Source, Node v22.23.1) / Bằng chứng kiểm tra mới trên mã đã đóng băng

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
| Full Secretlint (14,214 tracked + new candidate inputs, `.secretlintignore` unchanged) | **FAIL** (exit 1): 3 errors in 1 unchanged file (`apps/sophia-ai-factory/docs/handover/sentry-alerts-setup-runbook-260512.md`, lines 128, 134, 167, `@secretlint/secretlint-rule-slack` `IncomingWebhook`); 1 failed batch; all remaining batches clean. |

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
- No commit, push, Draft PR, merge, deployment, remote D1 mutation, payment activation, live AI call, or paid cohort execution performed. PR #177, Issue #178, and PR #179 remain untouched.
- All 11 `.github/workflows/*.yml` triggers inspected: `deploy.yml` triggers only on `push` to `main` or `workflow_dispatch`; `quality-gate.yml`, `security-scan.yml`, and `dependency-audit.yml` filter `pull_request` on `branches: [main]` only (so a stacked Draft PR targeting `fix/sophia-10-6-option-a-revenue-closure` would be `NOT_TRIGGERED_BY_BASE_FILTER` when opened).

## Runbook sanitization / Loại bỏ URL nhúng trong hướng dẫn

- **DONE.** Replaced three embedded Slack URLs with `SLACK_OPS_WEBHOOK_URL` instructions and interactive secret entry; no runtime changes. / Đã bỏ ba URL nhúng và hướng dẫn dán URL khi được hỏi; không đổi hệ thống đang chạy.
- S1 `128:3`, S2 `134:24`, S3 `167:6` (original positions): `@secretlint/secretlint-rule-slack` → `IncomingWebhook`. All three were the same URL. / Cả ba vị trí chứa cùng một URL Slack Incoming Webhook.
- `CREDENTIAL_EXPOSURE_STATUS`: origin and validity **UNKNOWN**; exposure confirmed in the original working file, original staged tree, base commit, and both current remote tips (`main` at `67374b44b`, PR #179 head at `e8f06eac0`). The oldest locally reachable file-change commit `f7f9578ba` also contains it. No verified official example or fixture provenance; GitHub reports secret scanning disabled (404). No webhook request sent. / Chưa xác minh được nguồn gốc hoặc hiệu lực; đã xác nhận URL có trong lịch sử và trên hai nhánh GitHub. Không gửi yêu cầu đến webhook.
- `CREDENTIAL_CONTAINMENT: OWNER_ACTION_REQUIRED`. The Slack workspace owner should identify the matching incoming webhook, revoke it if present, and coordinate replacement of `SLACK_OPS_WEBHOOK_URL` if used for Sophia alerts. Provide redacted admin evidence of revocation or verified non-credential provenance; do not share the URL. / Chủ workspace Slack cần đối chiếu webhook, thu hồi nếu còn tồn tại và phối hợp thay cấu hình nếu Sophia đang dùng để gửi cảnh báo. Chỉ cung cấp bằng chứng quản trị đã che dữ liệu.
- The outgoing patch would contain the URL on removed lines, and the remote base already contains it. No verified containment exception; no commit, push, or Draft PR. PR #179 remains open and draft against `main`; no hosted runs observed for the core branch. / Bản so sánh sẽ hiện URL ở dòng bị xóa; chưa có ngoại lệ đã xác minh để xuất bản. Không commit, push hoặc mở PR.
- `CURRENT_CANDIDATE_SECRET_SCAN`: focused runbook and full tracked app scan (14,220 paths, existing ignore rules) **PASS**. `git diff --check` and `git diff --cached --check` passed; no dedicated docs lint found in package scripts or workflows. / Quét hướng dẫn và toàn bộ tệp app được theo dõi đều đạt; không tìm thấy cổng lint tài liệu riêng.

- `npm run ci:secrets`: **PASS** (tracked command exit 0). / Lệnh quét bắt buộc đã đạt (mã thoát 0).

### Bounded official-document comparison, 2026-11-21 / Đối chiếu tài liệu chính thức có giới hạn

- Downloaded only the public Slack documentation page `https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks/` (HTTP 200). Compared the one distinct historical URL, extracted locally from the HEAD runbook, against samples extracted from both raw HTML and HTML-stripped, entity-decoded text using exact whole-string equality. No historical URL was transmitted or printed. Neither comparison matched. / Chỉ tải trang tài liệu công khai của Slack, sau đó so sánh nguyên chuỗi tại máy với mẫu trong HTML và văn bản đã bỏ thẻ, giải mã ký tự. Không gửi hoặc in URL lịch sử; cả hai phép so sánh đều không trùng.
- `CREDENTIAL_EXPOSURE_STATUS: UNKNOWN`; `DOCUMENTED_PLACEHOLDER_VERIFIED` is not established. `CREDENTIAL_CONTAINMENT: OWNER_ACTION_REQUIRED` remains unchanged. No broader search or webhook request was performed. / Chưa có bằng chứng đây là placeholder chính thức; vẫn cần chủ tài khoản xử lý. Không tìm kiếm mở rộng hoặc gọi webhook.
- Required owner evidence: identify the Slack app and workspace associated with the single webhook represented by S1–S3, and confirm its revocation/deactivation or provide verifiable non-credential provenance, without sharing its URL. Any owner-only confirmation must be recorded as `OWNER_ATTESTED`, not independent API verification. If currently used, replacement of `SLACK_OPS_WEBHOOK_URL` must be coordinated to avoid interrupting Slack operational alerts. / Chủ tài khoản cần xác định app và workspace của webhook chung S1–S3 rồi xác nhận đã thu hồi/vô hiệu hoặc cung cấp nguồn gốc chứng minh không phải credential, không gửi URL. Xác nhận chỉ từ chủ tài khoản sẽ ghi `OWNER_ATTESTED`, không phải kiểm chứng API độc lập. Nếu đang dùng, cần phối hợp thay cấu hình để tránh gián đoạn cảnh báo Slack.
- Delivery remains blocked only at this credential disposition boundary; prior core fixes, coverage, build and scan evidence remain valid. No commit/push/PR was performed. / Chỉ bước bàn giao qua GitHub còn chờ xử lý định danh webhook; kết quả sửa core, coverage, build và scan trước đó vẫn được giữ nguyên. Không commit, push hoặc mở PR.
