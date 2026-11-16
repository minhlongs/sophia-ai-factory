# Sophia OPC Affiliate — UI/UX Surgical Prescription

Ngày soạn: 2026-10-27. Đây là prompt triển khai cho Claude Code, được chẩn đoán từ source local; chưa kiểm tra giao diện render hoặc production.

## Nhiệm vụ

Bạn là Product Engineer phụ trách chuyển trải nghiệm Sophia thành bàn điều hành affiliate cho một người: đa ngách, ưu tiên Crypto/CEX affiliate và Global SaaS affiliate.

Repository: `/Users/macbook/sophia-ai-factory`.
Production app, gọi tắt APP: `/Users/macbook/sophia-ai-factory/apps/sophia-ai-factory`.
Các đường `src/...`, `messages/...` trong tài liệu này tính từ APP.

Hãy sửa hành trình trên ứng dụng hiện có và kiểm chứng hành vi. Không dừng ở thay headline, thêm badge OPC, tài liệu GTM hoặc dựng thêm dashboard song song.

**Ràng buộc tuyệt đối của founder: không mở trình duyệt.** Không dùng Browser/CUA/Chrome/DevTools, Playwright, Puppeteer, browser MCP, screenshot, headless browser hoặc công cụ render trang. Không dùng ImageGen, Figma, Stitch hay dịch vụ thiết kế ngoài để thay cho việc đọc source. Không dùng HTTP/web để thăm website. Đọc Git/source, chạy kiểm thử không cần browser và báo rõ phần visual chưa được kiểm chứng.

Được thực hiện local code changes và kiểm thử trong scope bên dưới. Chưa được push, merge, deploy, gửi email/tin nhắn, xuất bản nội dung, chạy migration remote hoặc gọi dịch vụ trả phí. Không lấy báo cáo ship trước làm quyền ship cho đợt này.

## 1. Baseline và quyền sở hữu

Đọc AGENTS.md, README.md, APP/CLAUDE.md, các rule layer/cross-layer/no-tech/deploy-verify và `docs/admin-ops/payment-pricing-source-of-truth.md` trước khi sửa.

Kiểm tra branch, HEAD, status, diff và phiên bản source dùng làm base. Không reset/stash/clean hoặc ghi đè việc của phiên khác.

Khi chẩn đoán:

- Commit được báo đã phát hành: `e3f1d7ac2d0ee89511e2077667bbbaf4fb82037e` (Issue #51 / PR #52), đã đọc bằng Git local, không xác nhận live.
- Checkout lúc khám là branch `feat/sophia-anatomy-workflow-explainer`, HEAD `30cfbdd95`, có nhiều WIP chưa commit và khác snapshot trên.
- Local Git có ref main mới hơn. Ref local không tự chứng minh production đang chạy ref đó.

Phải xác minh lại trạng thái khi bắt đầu. Có thể dùng `git show <commit>:<path>` để đọc snapshot mà không checkout. Không phát hành từ base cũ làm mất AEO hoặc các sửa mới hơn. Dùng quy trình branch/worktree phù hợp với policy repo và giữ nguyên dirty work của người khác.

PR #52 đổi 17 file chủ yếu AEO, RSS, blog, translation và playbook. Nó không tự chuyển primary journey thành OPC. Các kết luận dưới đây là source findings cần recheck, không phải ảnh chụp live.

## 2. Chẩn đoán có địa chỉ source

| Vấn đề | Đầu mối source đã đọc |
|---|---|
| Landing bán “AI Video Empire”; demo là prompt → render → distribution; ví dụ được gắn LIVE và có số performance cố định | `messages/vi.json`, `messages/en.json`; `src/components/stitch/screens/landing-hero/modular/hero-header.tsx`, `pipeline-mockup.tsx`; xem snapshot e3 |
| AEO nằm trong beforeFooterSlot, không thay hero hoặc hành trình đầu tiên | `src/app/[locale]/page.tsx:35`; `landing-hero-view.tsx`; `src/seed/aeo/ground-truth-catalog.ts` trong e3 |
| Affiliate Hub đi vào chương trình partner giới thiệu Sophia, thay vì external affiliate business | `src/forest/dashboard/dashboard-nav-modules.ts:54`; singular `/dashboard/affiliate` so với plural `/dashboard/affiliates` |
| Sidebar là danh mục công cụ; approvals và niche studio không nằm trong tuyến làm việc chính | `dashboard-nav-modules.ts`; `dashboard-nav-items.tsx`; `components/stitch/layouts/dashboard/default-nav-items.ts` |
| Onboarding links trỏ `/dashboard/setup` và `/dashboard/onboarding` không có page đích tương ứng; wizard thật là `/{locale}/setup` | `src/forest/dashboard/dashboard-onboarding-banner.tsx:108`; `src/app/api/welcome/validate/[token]/core/route-handler.ts:72`; kiểm tra routes/redirects thực tế |
| Home có CTA thiếu action và render hướng dẫn cài terminal/FFmpeg trước công việc kinh doanh | `src/components/stitch/screens/dashboard/dashboard-page.tsx:64`; `src/components/dashboard/local-engine-setup-guide.tsx:35` |
| Adopt offer dẫn `/creator/studio?offerId=...`, redirect làm mất query/locale; trang đích là template marketplace đang unavailable | `src/forest/actions/affiliate/discovery-actions.ts:94`; `src/app/creator/studio/page.tsx:13`; `src/app/[locale]/(app)/creator/studio/page.tsx:33`; `src/land/sop-marketplace/availability.ts` |
| Niche Studio dùng default referral/coupon, locale vi và generate→dispatch liền nhau | `src/components/niche-studio/niche-campaign-selectors.tsx:20`; `niche-campaign-form.tsx:36,60,77` |
| Approval card thiếu đường tới artifact/campaign; sau duyệt chưa có điều hướng theo dõi rõ | `src/components/approval-queue/card.tsx:54`; `queue-view.tsx:48`; kiểm tra server continuation riêng, không suy ra backend chỉ từ UI |
| Niche stats hiển thị số cố định cùng nhãn live; preview chưa có video vẫn dùng thuật ngữ job/plan như bằng chứng | `niche-conversion-stats-card.tsx:30,60`; `video-compliance-preview-player.tsx:60,93` |
| WIP header/badges có “Kill-Switch: Armed”, “SHA-256 Enforced”, Domain B, L1–L7 và text English hardcode | `approval-executive-header.tsx`; `approval-governance-badges.tsx`; `opc-architecture-banner.tsx` — đây là WIP, không gọi là đã deploy |

WIP đã có cải tiến Domain B summary, approval metadata và niche labels. Đọc, giữ và nối các phần có ích; không lặp lại kết luận cũ rằng mọi dashboard vẫn chỉ có fixture.

## 3. Trải nghiệm mục tiêu

Đơn vị tổ chức là **chiến dịch kinh doanh**, có workspace, offer, thị trường, nội dung, quyền duyệt và kết quả. Video/image/audio là công cụ thực hiện trong chiến dịch.

Golden journey:

`Chọn ngách → Chọn offer hợp lệ → Chuẩn bị chiến dịch → Xem và duyệt → Theo dõi sản xuất/đăng → Đối soát hoa hồng`.

Crypto/CEX là ngách nội dung/referral; không mở thêm trade execution, custody, withdrawal hoặc payout mới.

Hai mặt phẳng phải rõ:

- Customer OPC workspace: công việc, quyền quyết định, kết nối và tiền của khách hàng.
- Platform administration/developer proof: CI, SHA, Vitest, kiến trúc, license administration. Chỉ hiện tại nơi phù hợp quyền truy cập, không dùng làm value proposition của khách hàng.

## 4. Landing và thông điệp đầu tiên

Dùng lại hero, nav, modular layout, illustration assets và design tokens hiện có. Giữ một page shell, một nav, một footer. Giữ AEO/Markdown/JSON-LD và slot composition đã phát hành.

Copy định hướng, cần xác minh phù hợp capability thực:

- VI headline: “Một người điều hành. Nhiều chiến dịch affiliate.”
- EN headline: “One operator. Multiple affiliate campaigns.”
- VI subheading: “Chọn chương trình CEX hoặc SaaS, để agent chuẩn bị chiến dịch; bạn duyệt nội dung, chi phí và theo dõi hoa hồng có nguồn.”
- EN subheading: “Choose a CEX or SaaS program, let agents prepare the campaign, and stay in control of content, costs, and attributable commissions.”
- Primary CTA: “Lập chiến dịch đầu tiên / Plan your first campaign”.
- Secondary CTA: “Xem quy trình mẫu / Explore a sample workflow”.

CTA phải đi đúng route/hành vi có thật; nếu chỉ là walkthrough, ghi rõ minh họa. Không gọi trang features chung là demo chiến dịch.

Trình bày hai use case CEX và SaaS trước danh sách 51 ngách. Phần ngách khác ở exploration thứ cấp, không xóa deep links hiện có.

Giải thích ngắn: ai chọn offer, agent làm gì, chủ duyệt gì, chi phí ở đâu, hoa hồng được xác nhận thế nào. Không hứa lợi nhuận hoặc affiliate enrollment tự động.

Đồng bộ human copy và AEO từ cùng factual capability/evidence. “10 network có trong catalog” không bằng “10 integration live đã được xác nhận”. Các claim ROI, tiết kiệm thời gian, creator count, 0% hallucination, compliance hoặc payout tức thì cần nguồn; thiếu bằng chứng thì dùng diễn đạt có phạm vi hoặc ví dụ được gắn nhãn, không đưa số tự tạo vào “ground truth”.

Giữ giá và entitlement chuẩn. Pricing giải thích riêng phí Sophia, chi phí AI/BYOK và external affiliate earnings. Giữ selected tier/intent xuyên signup theo policy hiện hành; không tự mở free entitlement hoặc thay checkout.

## 5. Một dashboard chính theo công việc

Nâng existing `/[locale]/dashboard`; không thêm `/opc-dashboard` hoặc cockpit song song.

Ưu tiên nội dung:

1. Một hành động tiếp theo theo trạng thái: tiếp tục setup, chọn offer, xem campaign draft hoặc duyệt công việc.
2. Cần bạn duyệt: số thực và đường mở artifact.
3. Đang bị chặn: lý do, ảnh hưởng và hành động khắc phục.
4. Chiến dịch đang chạy: bước hiện tại, lần cập nhật, link theo dõi.
5. Chi phí và commission: có nguồn, thời gian cập nhật, currency và phạm vi.

Tái dùng existing aggregator, approval queue, campaign list, publish queue và Domain B summary. Không lặp ledger/query logic trong component.

Hợp nhất navigation desktop/mobile/fallback thành cùng cấu hình nhiệm vụ, tối đa sáu nhóm chính nếu cần:

- Hôm nay / Today.
- Offers / Offers.
- Chiến dịch / Campaigns.
- Cần duyệt / Approvals.
- Kết quả / Results.
- Kết nối / Connections.

Map sang route thực sau khi kiểm tra. Giữ tools chuyên sâu, design preview, local engine, AEO export và developer settings dưới khu vực phù hợp; không xóa route hoặc vô hiệu hóa tính năng được hỗ trợ.

Đặt tên rõ `Doanh nghiệp affiliate của tôi / My affiliate business` cho external affiliate workspace và `Giới thiệu Sophia / Refer Sophia` cho chương trình partner của nền tảng. Không trộn commission, wallet hay MRR giữa hai domain.

## 6. Sửa onboarding và context trước khi thêm trang

Sửa nguồn link stale; khi cần giữ alias tương thích về canonical setup hiện có. Không tạo wizard thứ hai.

Cho phép chọn mục tiêu/ngách/offer trước khi yêu cầu mọi provider key, trong phạm vi entitlement hiện có. Chỉ yêu cầu kết nối cần thiết ở bước cần dùng; preview/draft phải được gọi đúng capability. Setup Wizard vẫn là nơi quản lý BYOK theo doctrine.

Sau signup/setup, tiếp tục đúng intent thay vì đưa về trang công cụ chung.

Giữ context cần thiết qua luồng: locale, niche, offerId, campaignId, jurisdiction, channel và các job/approval IDs thực. Workspace identity được server resolve và authorize; không tin workspaceId từ query hoặc hidden field. Query/return destination phải allowlist, không chứa secrets hoặc tạo open redirect.

Không ép EN sang VI. Không gắn Telegram “linked” khi chỉ vừa mở tab; dùng trạng thái chờ xác nhận cho tới pairing thành công.

Di chuyển hướng dẫn cài local engine vào Advanced/tuỳ chọn phù hợp; khách hàng managed không cần cài terminal để bắt đầu công việc của họ.

## 7. Nối offer, draft, approval và tiến độ

Adopt offer phải mở existing campaign/niche workflow có hỗ trợ context. Giữ offer ID, network, approved tracking URL và campaign identity; không chuyển sang template marketplace hoặc bật lại marketplace đang đóng để chữa đường đi.

Loại bỏ default coupon/referral trông như thật trong production input. Dữ liệu thiếu hiển thị cần bổ sung; demo là chế độ riêng.

Tách hành động rõ:

- Chuẩn bị bản nháp.
- Xem lại offer, nội dung, link, thị trường, kênh và dự toán.
- Gửi duyệt/cho phép thực thi theo cơ chế server hiện có.
- Theo dõi tác vụ.

Không để nút “xem trước/tạo nháp” ngầm khởi chạy side effects mà người dùng chưa hiểu hoặc chưa duyệt.

Approval card phải mở được campaign/artifact được duyệt. Nêu thay đổi có tác động, chi phí còn thiếu, blocker và điều gì xảy ra sau nút duyệt. Sau thành công, cho đường theo dõi job/campaign thật. Kiểm tra server continuation riêng; nếu backend chưa hỗ trợ, hiển thị capability hạn chế, không tạo optimistic success giả.

Mọi badges như approved, paused, connected và payload verified phải đến từ trạng thái server đã xác minh. Thay thuật ngữ SHA-256/Domain B bằng lợi ích dễ hiểu như “Nội dung thay đổi sẽ cần duyệt lại” khi cơ chế đó thực sự đã được nối. Không render “Armed” hoặc “Enforced” vô điều kiện.

CMO/CSO trong trải nghiệm phải gắn với đầu ra của campaign: kế hoạch nội dung, bản nháp giới thiệu/chào hợp tác, việc cần chủ quyết định. Chỉ expose hành động backend hiện có và giữ attribution; tài liệu playbook không tự chứng minh một agent action đã chạy. Không xây tổ chức C-Level giả hoặc tự gửi outreach.

## 8. Một quy ước trạng thái và dữ liệu

Phân biệt rõ: `demo`, `not_connected`, `loading`, `error`, `verified_empty`, `live`.

- Lỗi fetch không trở thành KPI zero.
- Không có integration không trở thành “connected, 0 earnings”.
- Số minh họa không có badge LIVE hoặc dùng chung tổng thật.
- Render manifest/plan ID không trở thành video đã tạo.
- Scheduled không trở thành published; published cần receipt/URL theo hợp đồng.
- Pending/approved-unpaid/reversed/paid receipt là các trạng thái khác nhau.
- Không gộp currency/asset thiếu FX và không gọi commission là tiền đã nhận.
- Số tiền chưa biết không mặc định zero để người dùng quyết định chi tiêu.

Tái dùng domain state hiện có và adapter view-model; không tạo state machine độc lập trong UI. Khi server thiếu dữ liệu, hiển thị trạng thái và hành động khắc phục trung thực, ghi blocker kỹ thuật riêng.

## 9. Giới hạn thay đổi

Giữ auth, RBAC, tenant isolation, consent, protected Setup Wizard, Telegram, NOWPayments activation, PayOS backup, pricing, license và canonical imports.

Giữ bốn lớp/cross-layer rules. Server Actions cho mutations khi phù hợp; long-running jobs đi qua orchestration hiện có. Không thêm thư viện UI/framework hoặc đổi toàn bộ palette, CSS tokens, typography và layout system để làm đợt sửa này.

Mọi customer-facing copy đi qua VI/EN translations. Không thêm nội dung kỹ thuật vào hành trình người dùng trừ khi họ cần để quyết định. Tuân thủ LOC/style budget đang có; không chia vụn file chỉ để vượt metric.

Không xóa file/route/history trong đợt này. Các route cũ có thể được nhóm lại hoặc có alias tương thích. Không mở rộng sang backend financial refactor toàn repo; lỗi backend chặn journey phải được chỉ rõ và giải quyết tối thiểu ở seam liên quan hoặc báo blocked.

## 10. Tổ chức thực hiện và kiểm chứng không browser

Lập route/data/action map trước khi code: màn nào, nguồn dữ liệu nào, next action nào, điều kiện được phép và nơi quay lại.

Có thể parallel sau khi phân ownership không chồng lấn:

- Public landing/copy/pricing context/AEO consistency.
- Dashboard/nav/setup links/context handoff.
- Offer/draft/approval/status/earnings UI.

Chỉ một owner chỉnh translation files và route registry dùng chung; reviewer khác đề xuất key, không ghi đè. Mọi agent biết có người khác cùng sửa repo. Root chịu tích hợp và kiểm tra golden journey.

Chạy targeted Vitest/React Testing Library/jsdom cho hành vi thực, không browser:

1. Primary CTA có action thật và chọn đúng next step theo capability/state.
2. Các onboarding link/alias trỏ route có thật và giữ locale/intent an toàn.
3. Từ chọn offer đến campaign form vẫn là cùng offer/campaign của workspace được phép.
4. Draft không tự dispatch action có phí/xuất bản; bước duyệt rõ và server-authorized.
5. Card mở đúng artifact; duyệt xong có trạng thái/đường theo dõi thật.
6. Navigation cùng cấu hình ở các shell, không trộn Refer Sophia và external earnings.
7. Loading/error/unconnected/verified-empty/demo/live render khác nhau.
8. Không còn số minh họa hoặc security status vô điều kiện trong live view.
9. Cả VI/EN có key đầy đủ, giữ ngôn ngữ qua redirect.
10. Semantic roles, labels, disabled reasons và keyboard interaction kiểm tra được bằng jsdom; không coi đó là full accessibility certification.

Chạy type-check, lint, layer boundaries, i18n và build theo scripts thực tế. Kiểm tra side effects của script trước khi chạy; không kích hoạt upload/deploy hoặc network bị cấm. Ghi rõ exit code, scope, baseline failures và môi trường chặn. Không disable checks hoặc sửa test để hợp thức hóa bug. Không cần lặp full suite nếu không có lý do mới; vẫn hoàn tất checks mà repo bắt buộc.

Không chạy browser-based E2E. Ghi `VISUAL_QA_NOT_RUN — founder forbids browser` cho bố cục render, responsive thực, contrast thực và trải nghiệm tương tác trong browser. Không khẳng định đã thấy live site hoặc pixel-perfect.

## 11. Điều kiện hoàn thành và báo cáo

Hoàn thành phạm vi code khi một founder có đường đi rõ từ offer đến draft/approval/status/result trên các route hiện có, dữ liệu có trạng thái trung thực, không còn dead CTA/dead onboarding links trong scope và các kiểm tra không-browser cần thiết đạt.

Không ghi “UI/UX đạt 100%” khi chưa render/visual QA. Tách local implementation khỏi deployed/live verification. Nếu còn seam backend chưa hỗ trợ, báo partial và nêu hành vi UI đã giới hạn đúng.

Báo cáo tiếng Việt:

- Root cause trước/sau.
- File/route/action/data source đã thay đổi.
- Golden journey từng bước và trạng thái.
- Kết quả kiểm thử cùng exit code.
- Những gì giữ nguyên và những gì blocked.
- Visual/live verification chưa thực hiện theo yêu cầu.

Chỉ hỏi founder nếu có quyết định mới về tiền, license, dữ liệu, external effects hoặc xung đột thực không thể tự giải quyết. Không dừng sau plan hoặc làm lại một đợt chỉ thêm docs/AEO/badge OPC.
