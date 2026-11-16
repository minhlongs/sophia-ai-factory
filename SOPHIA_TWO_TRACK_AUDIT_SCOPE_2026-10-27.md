# Sophia — Phạm vi audit hai phần: Video → Affiliate Revenue và OPC Platform

Ngày: 2026-10-27. Phương pháp: đọc source/Git local, không browser, không HTTP, không credentials, không production DB. Đây là phạm vi và tiêu chí audit; không phải chứng nhận hoàn thành hoặc có lợi nhuận.

Repo: `/Users/macbook/sophia-ai-factory`.
APP: `/Users/macbook/sophia-ai-factory/apps/sophia-ai-factory`.
Các đường `src/...` tính từ APP.

## Baseline phải khóa trước mỗi lần audit

- Khi đọc: HEAD `30cfbdd95`, branch anatomy, có nhiều WIP và local tracking ref khác HEAD. Không coi WIP là source đang live.
- Định danh từng kết luận bằng commit hoặc snapshot working-tree cụ thể; nếu file đổi trong lúc audit, kiểm tra lại kết luận bị ảnh hưởng.
- Phân biệt active runtime, registered worker, helper-only, demo/mock và planned code.
- Không dùng test count, README, manifest hoặc tên thuật toán làm bằng chứng vận hành.
- WIP đã có cập nhật category producers/consumers, tenant BYOK, approval persistence và Domain B ledger; không lặp danh sách lỗi cũ mà không đọc lại.

## Những đầu mối xác nhận được từ source hiện tại

1. `src/forest/inngest/functions/niche-video-dispatcher.ts:137` trả `RENDER_READY` và manifest. `src/tree/video/render/niche-scene-visual-generator.ts:29` tạo descriptors, không tạo media asset bằng provider. Phải audit đoạn tiếp nối tới renderer, callback, asset thật và publisher.
2. `src/tree/video/render/niche-script-synthesizer.ts:39` dùng câu mẫu theo role; không tự chứng minh nội dung được cá nhân hóa hoặc kiểm chứng facts. `src/tree/video/prompts/crypto-script-prompt-builder.ts:26` có mặc định fee discount 20% và signup bonus 1000 khi thiếu input.
3. `src/land/affiliates/discovery-wave-helpers.ts:149` suy EPC từ commission với default 1.0; `discovery-wave.ts:87` chuyển giá trị đó vào scorer. Đây là estimate/heuristic, chưa phải observed EPC. NETWORK_CTX cũng chứa giả định cookie/approval cần tách khỏi account-specific facts.
4. `src/forest/growth-v13/bandit-traffic-worker.ts:33` dùng mockArms. `src/forest/inngest/functions/flywheel-feedback-dispatcher.ts:39` dựng arm với impressions/prior/conversions cố định, thay vì đọc posterior đã lưu. Audit cả tính đúng và việc worker có được đăng ký/tiêu thụ event thực không.
5. `src/land/growth-v14/predictive-render-actions.ts:49` có default winProbability=0.65, projectedRoas=2.5; `kelly-allocator.ts:56` vẫn cấp minFraction khi expectancy không dương. Phải xác định đây có phải exploration được chủ duyệt, nguồn probability/ROAS, hard budget và actual-cost reconciliation.
6. `src/forest/video/autonomous-video-orchestrator.ts:36` có fallback jurisdiction US cho crypto và lấy hook đầu danh sách tại line 58. Không mặc định rằng tên winningHook chứng minh đã chọn bằng performance.

## PHẦN A — Audit thuật toán tạo video và vòng kiếm tiền affiliate

Đối tượng nghiệm thu: **offer đúng → nội dung đúng → media thật → phân phối đúng → attribution đúng → commission có nguồn → chi phí được đối soát → feedback quay lại quyết định**.

### A01. Đường chạy thực và đăng ký runtime — P0

Source: `src/app/api/inngest/serve/{index,core-functions,growth-functions}.ts`; `src/forest/inngest/functions/{niche-video-dispatcher,autonomous-campaign-scaling-flow,flywheel-feedback-dispatcher}.ts`; `src/land/missions/auto-video/`.

Audit entrypoints UI/Telegram/cron, registered functions, event producers/consumers và callback. Lập DAG với persisted IDs. Xác định engine nào canonical, module nào chưa được gọi.

Đạt khi một request đi xuyên actual registered runtime tới đầu ra có thể truy vết; missing registration/consumer không được đánh PASS chỉ từ unit test gọi trực tiếp hàm.

### A02. Offer matching và dữ liệu economics — P0

Source: `src/land/affiliates/{discovery-wave,discovery-wave-helpers}.ts`; `scout/scoring/`; `src/tree/affiliate/smart-link-yield-engine.ts`; catalog/selected-offer producers/loaders.

Audit network/category/product/enrollment riêng biệt; offer provenance; giá/phí/bonus/commission/window; observed EPC so với forecast; chuẩn hóa USD/cents/per-click/per-100-clicks; score assumptions; cold start và missing data.

Đạt khi mọi số dùng xếp hạng có nguồn hoặc nhãn estimate, không suy commission thành measured EPC, không dùng eligibility/terms mặc định như sự thật; cùng selected offer identity đi qua campaign và revenue.

### A03. Script, facts, hook và CTA — P0

Source: `src/tree/video/prompts/`; `src/tree/video/render/niche-script-synthesizer.ts`; `src/tree/video/ab-testing/`; `src/land/missions/auto-video/prompt-builder.ts`.

Audit generic-template vs generated/personalized output; input evidence; claim verification; CEX/SaaS-specific relevance; locale; bonus và fee defaults; affiliate disclosure; brand/asset permissions; untrusted prompt inputs.

Đạt khi claim quan trọng truy ngược được tới source offer đã review; thiếu dữ liệu không tạo bonus, kết quả đầu tư hoặc lợi ích giả. Text/SVG sắc nét không đồng nghĩa fact đúng. Hook/CTA phải khớp offer và channel thực.

### A04. Audio-first timeline và chất lượng media — P0

Source: `src/tree/video/prompts/storyboard-generator.ts`; `src/tree/video/render/niche-voiceover-generator.ts`; `src/tree/video/{audio,subtitles,broll}/`; render manifest composers.

Audit duration TTS thực so với blueprint; scene gaps/overlap; subtitle alignment; cut safety; disclosure thời lượng/vị trí; aspect ratio; audio clipping/ducking; locale/voice; missing audio và provider failure.

Đạt khi tổng timeline khớp audio/video thực trong tolerance được định nghĩa theo format; text/overlay/subtitle không bị cắt; TTS fail không được báo hoàn thành như có audio. Metadata-only tests không chứng minh chất lượng media cuối.

### A05. Render thực và callback — P0

Source: `src/tree/video/render/`; `src/forest/video/`; `src/land/video/generation/`; `src/land/missions/auto-video/mission-scheduler.ts`.

Audit descriptor → provider request → job → authenticated callback/poll → R2/object → playable artifact. Kiểm tra object ownership, signed URL expiry, codec/container/dimensions/duration và missing/corrupt asset.

Đạt khi có artifact media hợp lệ cùng hash/metadata và state thật; phân biệt PLAN_READY, RENDER_READY, SUBMITTED, RENDERED. Chưa có provider certification giữ BLOCKED tương ứng. Không gọi dịch vụ trả phí trong audit mặc định.

### A06. Phân phối và bảo toàn link — P0

Source: `src/forest/inngest/functions/campaign/{asset-dispatcher,distribution-gateway}.ts`; `social-direct-publish-*`; `src/land/video/publishing/`; `src/land/missions/auto-video/mission-scheduler.ts`; redirect/shortlink routes.

Audit caption/description/pinned comment, offer URL/subId xuyên scheduling; channel account identity; current approval/policy; publish receipt; partial failures; platform retry và link rewriting.

Đạt khi output trên adapter/provider khớp đúng nội dung/link được chủ duyệt và có publication ID/URL. Scheduled, soft-skip hoặc swallowed error không trở thành PUBLISHED. Không double publish khi retry.

### A07. Attribution và nhãn kết quả — P0

Source: redirect/click endpoints, analytics ingestion, postback parsers/service/routes, `workspace-domain-b-reconciliation.ts`.

Audit chuỗi tenant→offer→campaign→creative variant→channel→click→provider conversion→commission. Tách impressions/clicks/qualified conversion/pending/approved/reversed/paid. Kiểm tra bot/duplicate/self-referral signals, delayed attribution, hold/refund window và recurring SaaS invoice identity.

Đạt khi có ledger evidence cho conversion/revenue label và các cohort/window phù hợp. Click không chứng minh commission; CEX trading volume/PnL không phải affiliate revenue của workspace. Chưa maturity không gán thất bại sớm.

### A08. Optimizer, bandit, scaler và feedback loop — P1, nâng P0 nếu tự chi tiền

Source: `src/tree/affiliate/{optimization,scaling}/`; `src/tree/growth-v13/thompson-bandit.ts`; `src/tree/growth-v14/kelly-allocator.ts`; các workers/actions và creative memory liên quan.

Audit công thức/phân phối sampling và numeric boundaries; reward definition; posterior persistence; replay-safe feedback; attribution của arm; retention/sales delay; exploration cap; sample size; validation/holdout; inference/cost objective; drift và negative outcome.

Đạt khi decision thực dùng dữ liệu thật đã lưu, được áp lại vào routing/render plan, không phải random winner hoặc mockArms. Dùng deterministic RNG/fixtures cho tests; property/statistical tests cần phù hợp, không chỉ assert shape. So sánh với baseline đơn giản trước khi tuyên bố uplift; không sửa threshold để đạt test.

### A09. Unit economics và giới hạn scale — P0

Source: cost estimators/usage-metering/quota; predictive-render-actions; Kelly allocator; campaign scaler; commission reconciliation.

Audit estimated/reserved/actual cost; retries/callback charges; model/render/storage/distribution/traffic costs; MCU↔money conversion; concurrent budgets; spend permission; incomplete provider usage; campaign payback.

Hai góc nhìn phải tách: đóng góp accrual dựa trên commission được xác nhận và cash contribution dựa trên receipts đã thu; không cộng hai góc nhìn thành doanh thu đôi. Tính chi phí theo cùng cohort/window/currency. Lợi nhuận khách hàng còn gồm phí Sophia, BYOK, traffic và thời gian vận hành; P&L nền tảng là bài toán riêng.

Đạt khi không scale chỉ từ CTR/CVR/EPC gross; phải biết nguồn nhãn, cost và maturity. Exploration khi chưa có edge phải là ngân sách riêng được chủ cho phép. Thiếu evidence hiển thị chưa đủ dữ liệu, không tự mặc định win-rate/ROAS như số đo thật.

## PHẦN B — Audit nền tảng để user OPC vận hành

Đối tượng nghiệm thu: **một user/workspace tự cấu hình, ra quyết định, kiểm soát quyền/chi phí, theo dõi công việc và đối soát tiền mà không cần operator làm thay**.

### B01. Auth, RBAC và tenant isolation — P0

Audit server-resolved workspace identity qua actions/routes/jobs/callbacks/R2/KV/D1; workspace switching; unauthorized IDs; userId/orgId/tenantId mapping; scoped uniqueness. Test A/B cùng provider và cùng offer nhưng không dùng chung dữ liệu/quyền/secret. Chặn IDOR/cross-tenant access ở server, không chỉ UI.

### B02. Hành trình, onboarding và giao diện — P0

Audit landing→signup→canonical setup→offer→campaign→approval→status→earnings; returnTo/locale/context; dead links/CTA; sidebar inventories; external affiliate vs Refer Sophia; empty/error/demo/live. Tái dùng phạm vi trong `SOPHIA_OPC_UX_PRESCRIPTION_2026-10-27.md`; chưa browser thì chỉ chứng minh source/component behavior, không chứng nhận visual UX.

### B03. Customer BYOK và capability registry — P0

Audit encrypted storage, minimum scopes, credential ownership, token rotation/revocation, test-connection state, per-tenant resolver và error classification. Provider advertised/catalogued/import-only không bằng live-certified. Thiếu key/lỗi provider không fallback dữ liệu giả. Không yêu cầu operator credentials cho từng khách hàng.

### B04. Approval, policy và kill switch — P0

Audit create/store/approve/consume approval; payload binding tới offer/media/account/market/budget; expiry/revocation; permission checks trước side effect; global+tenant halt; recheck sau sleep/retry. Đối chiếu mọi UI/Telegram/cron path. Crypto jurisdiction/terms chưa biết phải có trạng thái review phù hợp, không biến thành US/GLOBAL allowed bằng default. Code tests không chứng minh pháp lý toàn cầu.

### B05. Durable workflow và recovery — P0

Audit Inngest registration, persisted state, retry/backoff, queue concurrency, scheduler timezone, callback auth, duplicate/out-of-order events, crash windows, cancellation và outbox. Với external outcome chưa rõ phải reconcile thay vì gửi lại mù quáng. Test restart và burst/concurrency bằng fixtures, không production load.

### B06. Financial domains và sổ Domain B — P0

Tách subscription billing, external affiliate earnings, Sophia referral commission và partner payout. Audit D1 migrations thật, parser/provider contracts, event identity, partial adjustments, reversal sau paid, recurring invoice periods, immutable history, timestamps, currencies, UI rollups và DB failure behavior. Giữ policy founder đã chọn: external BYOK affiliate revenue thuộc workspace, platform fee 0; không trộn Domain C.

### B07. Billing, entitlement và edition boundaries — P0

Audit checkout→verified webhook→tier activation, quota/credit, refunds, replay/expiry; mọi route/action/job có entitlement phù hợp; Community/Cloud/Master thật sự enforce theo manifest/license hiện có. Giữ NOWPayments/PayOS customer billing, giá/tier được phê duyệt. Truy vết một action có phí tới authorization và usage actual; không bypass để demo xanh.

### B08. Security, privacy và vận hành khách hàng — P0/P1

Audit input/schema validation, CSRF, webhook auth, SSRF/open redirect, prompt injection, log redaction, data export/deletion/retention, consent, least-privilege secrets, audit logs, useful failures/support trail, rate limits và backup/restore. Export không chứa raw keys; quyền xóa hoặc tạm dừng áp dụng đúng tenant.

### B09. Release, cấu trúc và bằng chứng khả năng hỗ trợ — P0 cho release

Audit bốn layer, Next/CF runtime compatibility, D1 delta migrations được Git theo dõi, build artifacts, registered routes/functions, VI/EN, capability docs/AEO khớp code, protected Setup Wizard/Telegram/NOWPayments flows, rollback và environment flags. Green CI/HTTP 200 không chứng minh money flow hoặc customer readiness. Ship/live SHA verification là cửa riêng, chỉ chạy khi được quyền; chưa kiểm tra thì ghi NOT VERIFIED.

## Các ca xuyên suốt bắt buộc

1. SaaS: workspace riêng→offer đã xác minh→VI và EN draft→approval→render/publish fixtures→click→pending→approved→paid; mọi ID, currency và evidence nối được.
2. CEX: trường hợp có bằng chứng được phép và trường hợp jurisdiction/terms chưa xác minh; case chưa xác minh được stage draft nhưng không publish/chi phí ngoài quyền.
3. Failure: TTS/render/network fail, callback trùng, ledger fail giữa các bước, restart và external result uncertain; không success giả, không double charge/publish/commission.
4. Mutation: đổi offer/link/media/account/budget sau approval phải bị review lại ở side-effect boundary.
5. Isolation: hai workspace cùng provider/offer không đọc/sử dụng credentials, approval, tài nguyên và earnings của nhau.
6. Economics: video CTR cao nhưng net contribution âm không tự scale; dữ liệu mới/chưa maturity không bị coi là đã thất bại hoặc đã thắng.
7. Learning: kết quả mới cập nhật posterior/metrics bền vững đúng một lần và ảnh hưởng quyết định kế tiếp; so sánh với baseline và chứng minh không dùng fixtures trong production path.
8. Money: recurring renewal, partial refund/reversal sau paid, duplicate statements và nhiều currency/asset không làm inflate hoặc trộn số dư.

## Trình tự thực hiện

1. Khóa snapshot + lập runtime/data/ID map.
2. Audit P0: source facts, tenant/approval/budget, actual render/publish, attribution/ledger.
3. Audit statistical/math correctness và learning loop sau khi dữ liệu đầu vào đủ tin cậy.
4. Audit customer journey/no-tech/capability truth và regression integration.
5. Quality gates, rollout/rollback; live provider/publication/revenue proof tách riêng theo quyền và khả năng thực tế.

Mỗi mục có: source/consumer, invariant, ca tái hiện hoặc test, evidence, verdict PASS/FAIL/BLOCKED/NOT VERIFIED và owner. Không tự gọi NOT VERIFIED là PASS.

## Bốn mức nghiệm thu không được trộn

1. **Source/mathematical correctness:** code, contracts, dimensions và deterministic/statistical tests.
2. **Integration correctness:** database thật local + runtime orchestration + fake external adapters được gắn nhãn.
3. **Provider/production correctness:** documented account capability, real render/publish receipt và provider-confirmed commission; cần quyền riêng.
4. **Commercial validation:** cohort đủ maturity, cost/receipt đã đối soát, customer reuse và contribution có ý nghĩa. Không có một số lượng test nào tự chứng minh khả năng kiếm tiền.

Không sửa code trong bước lập phạm vi này. Không audit xong bằng cách kiểm tra file tồn tại hoặc đếm test xanh. Mọi sửa đổi sau đó phải giữ founder decisions, protected flows và công việc đồng thời của các phiên khác.
