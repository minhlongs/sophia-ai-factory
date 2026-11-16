# Master prompt — Sophia OPC Affiliate: audit → repair → usable product → reviewed PR

Copy toàn bộ nội dung dưới đường kẻ vào Claude Code CLI, mở tại `/Users/macbook/sophia-ai-factory`.

---

Bạn là lead engineer chịu trách nhiệm hoàn thành Sophia OPC Affiliate trên codebase thật. Dùng skill ak-vibe hiện có để audit, lập kế hoạch, sửa, kiểm thử, review và tạo PR đã sẵn sàng review/merge. Không dừng ở báo cáo hoặc đề xuất. Không hứa “chính xác 100%”; chứng minh từng tiêu chí bằng evidence có thể tái hiện.

## 1. Outcome và quyền thực hiện

Hai phần phải hoạt động cùng nhau:

**A — Video-to-affiliate-revenue engine:** offer có nguồn → script có facts → audio/timeline → media thật → duyệt → phân phối → click/conversion → commission → cost reconciliation → feedback cho quyết định tiếp theo.

**B — OPC user platform:** một người tự kết nối tài khoản, chọn ngách/offer, chuẩn bị chiến dịch, duyệt nội dung và ngân sách, theo dõi công việc, xử lý lỗi và đối soát hoa hồng trong cùng workspace. Ưu tiên CEX affiliate và global SaaS affiliate, giữ khả năng đa ngách.

Được sửa code, thêm migration local, chạy kiểm thử không browser, dùng GitHub CLI cho issue/PR/CI và review của nhiệm vụ này. Chế độ mặc định: ak-vibe official **không --ship**. Dừng tại PR đã review và checks xanh; không tự merge/deploy. Nếu founder trực tiếp thêm --ship cho lần chạy này, thực hiện đầy đủ merge + CI/deploy verification theo skill và repo. Báo cáo ship cũ không cấp quyền cho lần chạy mới.

Không tự gọi dịch vụ trả phí, đăng nội dung thật, mua traffic, gửi outreach, chạy migration remote, đặt lệnh giao dịch hoặc dùng production customer data. Dùng local DB và adapter fixtures rõ nhãn để kiểm thử; việc cần quyền/provider thật ghi BLOCKED hoặc NOT VERIFIED và tiếp tục phần độc lập.

**Tuyệt đối không mở browser:** không Chrome/CUA/DevTools/Playwright/Puppeteer/headless/browser MCP/screenshot; không Figma/Stitch/ImageGen. Không crawl website để thay source audit. Được dùng gh/Git và CLI tests; nếu có --ship thì HTTP tối thiểu cho version/health/smoke theo repo. Không claim visual QA hoặc legal certification toàn cầu.

## 2. Đọc trước, chốt baseline rồi mới sửa

Repo duy nhất: `/Users/macbook/sophia-ai-factory`.
APP: `apps/sophia-ai-factory`; `src/...` bên dưới tính từ APP.

Đọc:
1. AGENTS.md, README.md, APP/CLAUDE.md và AGENTS lồng trong scope sửa.
2. APP/.claude/rules/sophia-layer-architecture.md; cross-layer-orchestration.md nếu tồn tại.
3. APP/.claude/rules/sophia-no-tech-doctrine.md và sophia-deploy-verify.md.
4. docs/admin-ops/payment-pricing-source-of-truth.md.
5. SOPHIA_TWO_TRACK_AUDIT_SCOPE_2026-10-27.md — checklist bắt buộc A01–A09, B01–B09 và 8 ca xuyên suốt.
6. SOPHIA_OPC_UX_PRESCRIPTION_2026-10-27.md — hành trình và định hướng UX.
7. Skill ak-vibe cùng các skill con tại thời điểm thực thi.

Prompt này là chỉ thị thực thi mới: thay phạm vi “chỉ lập audit/không sửa code” và “chưa được push” trong hai tài liệu tham khảo bằng phạm vi ở mục 1; giữ mọi yêu cầu sản phẩm, bảo vệ dữ liệu và giới hạn chi phí. Hai tài liệu là đầu mối, không phải plan đã validated.

Chụp branch/HEAD/status/diff/worktree và remote identity. Phân biệt source deployed được báo cáo, Git main hiện tại, branch hiện tại và dirty WIP. Snapshot trước đây là HEAD 30cfbdd95 trên branch anatomy; e3f1d7ac2 là commit được người dùng báo đã deploy. Đây là thông tin lịch sử, phải kiểm tra lại.

Không reset/stash/clean, force push, stage toàn bộ hay sửa đè phiên khác. Theo ak-worktree, dùng feature worktree sạch của cùng repository, ưu tiên bên trong repo để giữ phạm vi; không làm trực tiếp trên main/dev. Dùng base hiện hành đã xác minh. Lập dependency inventory với WIP liên quan: phần đã sửa trong phiên khác không được báo là lỗi mới, không âm thầm copy cả dirty tree. Nếu cần thay đổi chưa commit của người khác để hoàn tất, ghi dependency và yêu cầu phối hợp đúng phần đó; tiếp tục phần độc lập.

Đưa hai tài liệu tham khảo vào worktree nếu chúng đang untracked và cần cho thực thi; không mang theo source WIP chưa được xác định quyền sở hữu. Mỗi finding ghi rõ commit/snapshot. File thay đổi trong lúc audit phải recheck.

## 3. Các quyết định không được tự đổi

- Bốn layer seed/tree/forest/land theo rules; không phá boundary để nối workflow nhanh.
- Giữ Setup Wizard, Telegram Bot, NOWPayments IPN → tier activation.
- Auth `@/seed/auth/better-auth-session`; DB `@/seed/db/client`; tier lookup `@/seed/db/get-user-tier`; tiers `@/seed/config/tiers`.
- createServerClient() factory synchronous. Không TypeScript :any; không production console; dùng logger và error contracts của repo.
- Server Actions cho mutations phù hợp; durable jobs cho tác vụ dài; server xác định tenant và permissions.
- VI/EN qua next-intl; không dùng jargon kiến trúc làm nội dung bán hàng.
- BYOK thuộc workspace; thiếu credentials/provider lỗi phải hiện trạng thái thật, không mock success hoặc operator setup thay khách.
- External affiliate earnings thuộc workspace: commission_sophia = 0, platform_fee_cents = 0. Không trộn subscription billing, external earnings, Refer Sophia và partner payouts.
- NOWPayments USDT chính, PayOS VN dự phòng. Không thêm Polar/PayPal/Stripe customer billing. Giữ giá/entitlements từ nguồn chuẩn, không lấy số trong prompt làm nguồn mới.
- CEX ở đây là affiliate marketing; không thêm custody, trade execution, withdrawals hay lời hứa lợi nhuận.
- Giữ license/edition boundaries, AEO/Markdown/JSON-LD, một landing shell/nav/footer và existing dashboard.
- Không đổi kiến trúc lớn, framework, provider hoặc thiết kế lại billing khi không cần để khắc phục invariant đã chứng minh.

## 4. Audit bắt buộc và đầu mối phải xác minh lại

Lập bảng đủ 18 nhóm từ audit-scope. Mỗi nhóm có invariant, entrypoint/caller/consumer, observed evidence, verdict PASS/FAIL/BLOCKED/NOT VERIFIED, severity, test/repro và remediation. Không đặt PASS chỉ vì file tồn tại hay test count cao.

Ưu tiên P0 tenant/auth, approval, budget, factual inputs, actual media, attribution và ledger; sau đó thống kê/learning, customer journey và release truth. Không bật optimizer tự chi tiền khi upstream evidence chưa đạt.

Các đầu mối lịch sử sau KHÔNG được coi là lỗi hiện tại trước khi đọc lại:

| Đầu mối | Câu hỏi phải trả lời bằng source/runtime |
|---|---|
| forest/inngest/functions/niche-video-dispatcher.ts; tree/video/render/niche-scene-visual-generator.ts; niche-render-composer.ts | RENDER_READY/descriptor/manifest được consumer nào chuyển thành media thật? Callback, storage, failure và state có nối đủ không? |
| tree/video/render/niche-script-synthesizer.ts; tree/video/prompts/crypto-script-prompt-builder.ts | Câu mẫu/default 20% discount/$1000 bonus có đang thành claim không nguồn? Locale, facts và CTA có đúng offer không? |
| land/affiliates/discovery-wave-helpers.ts; discovery-wave.ts | EPC suy từ commission có bị dùng như measured EPC? Có provenance và đơn vị đúng không? |
| forest/growth-v13/bandit-traffic-worker.ts; forest/inngest/functions/flywheel-feedback-dispatcher.ts | mockArms/impressions/conversions cố định có vào production path? Posterior có persist, dedup và ảnh hưởng quyết định thật không? |
| app/api/inngest/serve/; growth workers/actions | Worker thực sự registered? Event producer/consumer/payload version có khớp? Không register hàng loạt worker nguy hiểm chỉ để đủ coverage. |
| land/growth-v14/predictive-render-actions.ts; tree/growth-v14/kelly-allocator.ts | Default .65 win rate/2.5 ROAS, minFraction khi expectancy âm có giả làm evidence? Exploration có quyền và ngân sách riêng không? |
| forest/video/autonomous-video-orchestrator.ts | US fallback cho crypto và hook đầu danh sách có bị gọi là eligibility/winner đã kiểm chứng? |
| land/missions/auto-video/auto-video-service.ts; mission-scheduler.ts | Skipped/undefined/render chưa xong có bị mark succeeded? Caption có giữ link? Error có bị nuốt? |
| tree/affiliate/scaling/auto-campaign-scaler.ts; autonomous-campaign-scaling-helpers.ts | CTR/CVR/EPC gross có dẫn scale lỗ? Chiến dịch kế tiếp giữ offer, tenant, market, locale thật hay dùng placeholder? |
| land/affiliates/reconciliation/workspace-domain-b-reconciliation.ts; postbacks/saas-crypto-postback-service.ts | Currency có bị cộng rồi gắn USD? DB failure, recurring invoice, partial adjustment, replay và reversal sau paid có đúng không? |
| tree/affiliate/approval/campaign-approval-repo.ts; publishers/schedulers | Approval đã persist và wired đến đâu? Payload binding, revocation, expiry và concurrency có enforce ngay trước side effects không? |

WIP từng đã sửa tenant BYOK, category propagation, approval persistence, HMAC và Domain B ledger: xác minh lại để giữ cải tiến, không áp dụng báo cáo cũ máy móc.

## 5. Implementation contract — sửa hành vi, không chỉ nhãn

### A. Engine

Chọn và ghi rõ canonical execution path từ UI/Telegram/job đến media, publish và commission. Tái dùng thành phần đã hoạt động. Module chưa có consumer phải được nối có kiểm thử hoặc giữ inactive với trạng thái thật; không làm mọi pipeline cùng active.

Bảo toàn workspace/offer/campaign/creative/channel/click/provider-event identity. Mỗi side effect có idempotency strategy, durable state và recovery khi outcome chưa rõ. Approval phải gắn artifact/offer/link/account/market/budget; đổi material payload phải review lại. Kiểm tra halt/permissions/budget tại side-effect boundary và sau retry/sleep. Có reserve/reconcile/release costs phù hợp, tránh concurrent overspend.

Tách state dựa trên việc đã xảy ra: draft/approval/render queued/rendered/publish queued/published/blocked/failed/cancelled. Dùng enum hiện có nếu phù hợp; không buộc rename toàn repo. Manifest hoặc queue accepted không phải rendered/published/succeeded. Không tự dựng video/receipt/commission để demo.

Claim, bonus, commission và eligibility phải có provenance; unknown phải hiện unknown và chặn hành động cần bằng chứng. Không biến forecast thành observed metric. Audio/timeline/media kiểm bằng fixture và media metadata/ffprobe nếu có, không browser. Thiếu binary/provider cần thiết ghi rõ giới hạn, không tự cài stack lớn hoặc báo đã xem video.

Attribution và ledger dùng provider event/invoice identity, replay-safe và tenant-scoped. Tách pending/approved/reversed/paid; giữ adjustment history; không cộng nhiều currencies/assets thành một tổng giả. FX chỉ khi có nguồn/rate/time rõ; nếu chưa có thì tổng hợp riêng từng currency.

Optimizer dùng dữ liệu persisted, cohort/window/maturity đúng, reward không đếm đôi và posterior cập nhật đúng một lần. Kiểm chứng công thức/đơn vị/numeric boundaries; kiểm thử RNG có seed. Baseline đơn giản là chuẩn so sánh. Exploration phải tách budget được duyệt. Chưa đủ dữ liệu thì không tự nhận đã tìm ra winning strategy.

Theo dõi riêng commission accrual và cash receipts; cost estimated/reserved/actual. Scale cần cost/maturity/permission chứ không chỉ CTR cao. Không hứa profit hay tự chọn một threshold thương mại mới rồi coi là founder policy.

### B. Product/UX

Golden journey: chọn ngách → chọn offer hợp lệ → chuẩn bị chiến dịch → xem và duyệt → theo dõi sản xuất/đăng → đối soát hoa hồng.

Nâng dashboard hiện có thành nơi điều hành hôm nay. Navigation chính tối đa sáu nhóm công việc: Hôm nay / Offers / Chiến dịch / Cần duyệt / Kết quả / Kết nối. Giữ deep links và quyền truy cập các phần phụ. “Refer Sophia” tách rõ external affiliate business.

Landing giải thích CEX/SaaS use cases và ai kiểm soát nội dung, chi phí, tiền. Copy định hướng VI: “Một người điều hành. Nhiều chiến dịch affiliate.” EN: “One operator. Multiple affiliate campaigns.” Chỉ dùng lời hứa capability đã có bằng chứng. Demo phải ghi minh họa; không LIVE giả, doanh thu giả, zero-hallucination hay creator count không nguồn.

Sửa CTA/route thực, giữ offerId/locale/returnTo/selected tier qua onboarding. Không yêu cầu user terminal/cài FFmpeg để hoàn tất cloud journey. Campaign draft phải mở được từ approval queue; duyệt xong nhìn thấy tiến độ/kết quả/lỗi có hành động khắc phục. Phân biệt chưa kết nối, chưa có dữ liệu, đang tải và lỗi; lỗi không thành zero earnings hoặc kill-switch false.

Nối UI tới server contracts thật. Không thêm dashboard song song, không dừng ở docs/marketing copy. Dùng existing tokens/components, responsive semantics/keyboard/labels và component tests không browser. Ghi visual/responsive rendering NOT VERIFIED nếu chưa có kiểm tra render được phép.

## 6. ak-vibe execution và phân công

Đọc skill thật và dùng slash-command spelling có sẵn; không giả chạy lệnh không tồn tại. Không coi --parallel là flag được ak-vibe hỗ trợ nếu skill hiện tại không khai báo; phân công qua agent facilities thực có.

1. Intake + baseline + runtime/data map. Resolve đúng repo với gh; Issue #51 / PR #52 chỉ là lịch sử, không reopen hoặc dùng làm issue mới mặc định. Tìm issue phù hợp, tránh duplicate.
2. Worktree/feature branch sạch của cùng repo; plan TDD hoặc reuse plan đã xác minh. Plan phải phủ 18 nhóm, 8 scenarios, owners/dependencies và release boundaries.
3. Chạy plan validate + red-team + whole-plan consistency sweep; sửa contradictions trước implementation.
4. Tạo/update issue theo skill, labels ready to cook → in progress trước sửa. Ghi plan, route, acceptance criteria; không upload secrets.
5. Dùng ak-fix cho lỗi tái hiện được, ak-cook cho thiếu capability/UX; không cần gọi cả hai cho cùng thay đổi. Thực thi từng phase có regression tests.
6. Có thể chạy song song tối đa ba implementation agents khi contracts đã khóa: engine/media; attribution/governance/economics; OPC UI/UX. Giao file ownership rõ, nhắc tất cả đang dùng chung codebase, không revert người khác. Shared schema/types/migrations/translations do integrator phân quyền; không để nhiều agent cùng sửa. Chưa đủ công cụ/slots thì chạy tuần tự, không bịa parallel execution.
7. Review độc lập toàn diff, tập trung auth/tenant/spend/ledger và error paths; sửa Critical/Important rồi chạy lại checks liên quan. Bản thân agent viết code không được coi self-report là review độc lập.
8. Chạy ship official để tạo PR, review-pr --fix --reply và terminal required checks; label ready chỉ khi đủ gate. Không --ship thì dừng trước merge. Blocker thực ghi rõ, không bỏ qua labels/checks/branch protections.
9. Nếu founder đã cấp --ship: merge đúng convention, theo dõi target CI và deploy.yml, verify migrations + live SHA + health + smoke theo repo. Không local deploy trừ explicit break-glass. CI repo-fixable thì follow-up fix theo skill; không vượt quá ba lần cho cùng blocker và không giấu external failure.

Không hỏi lại các lựa chọn kỹ thuật thông thường đã đủ dữ liệu. Chỉ hỏi khi thực sự thiếu business decision, credentials/quyền chi tiền hoặc xung đột ownership không giải được. Nếu một phần bị chặn, làm tiếp phần độc lập; không gắn PASS cho phần bị chặn.

## 7. Verification bắt buộc

Đọc package scripts và workflow để xác định lệnh thật. Không bịa lệnh hoặc bỏ required checks. Chạy type-check, lint, layer boundaries, VI/EN parity, unit/integration và build phù hợp. Existing browser-based checks nằm ngoài quyền: không chạy, không xóa/disable để xanh; ghi thiếu gate. Nếu đây là required check thì chưa được gọi ready/merge.

Tối thiểu chứng minh tám ca, bằng tests ở đúng route/action/registered-runtime boundary, không chỉ gọi helper:

1. SaaS VI/EN: tenant → verified offer → draft → approval → fixture render/publish → click → pending/approved/paid, IDs nối đủ.
2. CEX: supported verified case so với unknown jurisdiction/terms; unknown không publish/chi tiền vượt quyền.
3. Failure/replay/restart: TTS/render/network/DB fail, duplicate callback, uncertain result; không success giả/double charge/publish/commission.
4. Đổi offer/link/media/account/budget sau approval bị review lại.
5. Tenant A/B không đọc/ghi/dùng secrets/approval/assets/earnings lẫn nhau, kể cả job và callback.
6. CTR cao nhưng contribution âm không tự scale; dữ liệu chưa mature không thành winner/loser đã xác nhận.
7. Feedback persisted đúng một lần và ảnh hưởng decision kế tiếp, baseline và production không dùng fixture metrics.
8. Recurring renewal, partial refund, reversal sau paid, duplicate/out-of-order statements và multi-currency không inflate số dư.

Migrations phải chạy trên D1-compatible local database; test upgrade từ schema trước và rerun behavior theo migration contract. Test tenant/idempotency concurrency ở DB boundary nơi có rủi ro. Không chỉ mock DB rồi kết luận migration đúng.

Nếu provider/DB runtime unavailable, ghi chính xác test nào chưa chạy. Phân tách rõ: source/math correctness; local integration với fixtures; real-provider correctness; commercial validation. Hai mức cuối không thể được thay bằng test count hoặc HTTP 200.

## 8. Deliverables và checkpoint để không mất việc

Tạo một thư mục plan trong convention repo, gồm:
- plan.md: scope, phases, dependencies, checklist và current next step.
- audit-matrix.md: đủ A01–A09/B01–B09, evidence và verdict từng mục.
- runtime-map.md: canonical paths, producers/consumers, state/ID flow, inactive modules.
- verification.md: exact commands, exit codes, source SHA, failures, fixes, evidence paths; không ghi secrets.
- handoff.md: resume state, owned files, completed/pending, blocker và lệnh tiếp theo.

Ghi checkpoint sau mỗi phase; không nhồi toàn repo vào context, dùng rg và targeted reads. Khi context gần đầy, lưu trạng thái để resume; không đánh complete để thoát token budget. Deliverable chính vẫn là code + tests + usable journey + reviewed PR, tài liệu là bằng chứng.

Final report theo Vibe Result của skill, kèm bảng hai phần A/B: đã sửa, kiểm thử đã chạy, chưa xác minh, blocker. Ghi branch/worktree/plan/issue/PR/checks/merge/deploy đúng thực tế. Không tuyên bố “OPC 100%”, “production-ready” hay “kiếm tiền được” khi evidence chỉ ở source/local fixtures.

**Bắt đầu ngay bằng preflight và audit runtime/data path. Sau đó tự tiến hành đầy đủ phạm vi được cấp, không dừng ở việc nhắc lại prompt hoặc đưa kế hoạch rồi chờ “go”.**
