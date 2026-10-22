/**
 * 261022-compliance-gate-live-video-path.md — Nhật ký: nối cổng tuân thủ pháp lý vào đường phát video thật.
 *
 * Ghi lại sự kiện "cổng bảo vệ đã code xong nhưng chưa từng chạy", quyết định
 * chuyển module giữa các layer, và hai lần test bắt lỗi của chính người viết.
 *
 * @module docs/journals/261022-compliance-gate-live-video-path
 */

# Cổng tuân thủ đã "xong" — nhưng chưa từng chạy trên video nào

- **Date:** 2026-10-22
- **Severity:** Critical
- **Component:** Chiến dịch video (`forest/inngest/functions/campaign`) + cổng tuân thủ affiliate (`tree/affiliates`)
- **Status:** Resolved (chưa deploy)

## Chuyện gì đã xảy ra

Kế hoạch ghi cổng tuân thủ pháp lý (compliance gate) đã hoàn thành: có kiểm tra quốc gia,
có dòng cảnh báo tài chính, có chặn vùng bị cấm. Code review lại source cho thấy điều tồi tệ
hơn "chưa xong": **cổng chỉ có một nhánh code gọi, và nhánh đó không có production caller** —
một hàm mồ côi.

Đường chạy thật của chiến dịch (`campaign-function.ts:75` → `runDistribution`) trước phiên này
**chỉ dán link affiliate vào mô tả video**: `description: baseDesc + '\n' + shortUrl`.
Không resolve vùng. Không disclosure. Không gate. Nói cách khác, toàn bộ cơ chế bảo vệ đã viết
**chưa từng soi một video thật nào** — nếu tenant phát nội dung crypto nhắm VN, đường sống
sẽ phát hành bình thường, không cảnh báo, không chặn. Rủi ro pháp lý nằm im sau một báo cáo
màu xanh.

## Sửa gì

`runDistribution` giờ đi đúng thứ tự, giống hệt đường đúng đã có sẵn ở nhánh kia:

1. `resolveAudienceJurisdiction(userId)` — vùng tenant khai báo.
2. `decidePublishCompliance(...)` — đánh giá một lần, trả cả verdict lẫn description đã dựng.
3. Bị chặn → **không gọi** `gateway.distribute`, trả `skippedByCompliance` kèm lý do, **không throw**.
   Đây là quyết định quan trọng nhất: từ chối pháp lý không phải lỗi vận chuyển — throw sẽ làm
   chiến dịch chết giữa pipeline như thể provider lỗi, job retry vô nghĩa, và log gây hiểu nhầm.
4. Được phát → disclosure nằm **phía trên** link affiliate, không phải sau.

## Quyết định kiến trúc: chuyển 5 module lên `tree` thay vì thêm ESLint exemption

Luật `no-restricted-imports` cấm `forest` import `land`. Có precedent gần đúng
(`conversion-to-ledger.ts`, cùng thư mục, cũng gọi `land` và nằm trong danh sách suppressions).
Nhưng danh sách suppressions đang **đóng băng** — thêm một dòng là tăng suppression count.

Cách đã chọn: kiểm chứng phụ thuộc thật của cả 5 module → **chỉ có `seed`/`tree`**, không module
nào dùng `land`. `niche-classifier.ts` không import gì cả (hàm thuần). Vậy chuyển layer là
đúng về kiến trúc (nơi domain logic dùng lại thuộc về), không phải đi vòng né lint.
Không một dòng logic nào đổi — chỉ đổi `@module` trong doc comment và import path của 4 file gọi.

## Thay đổi hành vi có chủ đích

| Trước | Sau |
|---|---|
| Link affiliate dán trần | Mọi link affiliate kèm dòng disclosure, nằm trên link |
| Không kiểm tra vùng | Vùng bị cấm (VN/UK/CN) → không phát; không rõ vùng + nội dung tài chính → không phát |
| Campaign không có affiliate | **Không đổi** — gate vẫn chạy nhưng `hasAffiliateLink=false`, vertical thường → `allowed:true` |

**Fail-closed có giới hạn**: chỉ chặn khi nội dung thuộc vertical cần quản lý (crypto/trading/tài chính)
và vùng không rõ. Campaign SaaS thường vẫn phát được khi chưa khai báo vùng — đó là bằng chứng bật gate
không làm tắc toàn bộ hệ thống. Đi kèm hai sửa để tránh chặn sạch: thêm `targetJurisdiction` vào
`GeoSchema` (trước thiếu field nên **ghi không được**, dù có writer) + route `GET/PUT /api/v1/settings/geo`.

## Hai lỗi của chính tôi, bị test bắt được

1. Test khẳng định description SaaS **không đổi** — thực tế đã đổi có chủ đích (thêm disclosure).
   Sửa test: behavior mới là chủ đích, và tôi kiểm chứng thứ tự disclosure-trước-link bằng assertion.
2. Test cho rằng vùng `'ZZ'` cho disclosure rỗng — thực tế `getDisclaimerForJurisdiction`
   **fallback về US** cho vùng lạ. Tôi đổi cách test (inject disclosure builder) thay vì ép code khớp kỳ vọng sai.

Cả hai lần đều sửa **test cho đúng hành vi thật**, không ép code khớp tiền đề sai.

## Bằng chứng kiểm chứng

`tsc --noEmit` 0 lỗi · eslint 0 lỗi (1 warning cũ, file không liên quan) ·
`check-layer-boundaries.sh` sạch (cả static lẫn dynamic import) · `i18n:validate` 0 thiếu ·
vitest **1932 file / 18410 test pass**. **25 test mới**, riêng nhóm đường sống soi:
vùng không rõ → `distribute` không hề được gọi · VN → chặn · US → phát kèm đủ 2 loại disclosure ·
SaaS phát được khi chưa khai vùng · campaign không offer giữ nguyên description ·
self-heal vẫn giữ disclosure.

## Chưa làm

**Không commit / push / deploy** — repo đang được nhiều phiên cùng sửa, `git status` có ~20 file lạ
thuộc phiên khác. Phải chọn đúng tập file mới commit được. Chưa có UI Settings để khách bấm chọn vùng;
hiện phải gọi API trực tiếp — và khách không thể tự đoán ra rằng không khai báo sẽ chặn nội dung crypto.

## Bài học

- **"Xong" phải nghĩa là "có production caller".** Một module pass hết test nhưng tách khỏi
  đường chạy thật là zero protection mặc xanh. Gate bảo vệ phải được soi bằng test trên
  **chính đường sống**, không chỉ trên nhánh dead.
- Hãy grep production caller trước khi đánh dấu xong một control bảo mật/pháp lý.
- Khi bị layer rule chặn, hãy kiểm chứng phụ thuộc thật trước khi thêm exemption —
  suppression list đóng băng vì lý do chính đáng.

## Bước tiếp

- **Owner: người viết** — chọn đúng tập file rồi commit, push, chờ pipeline, verify SHA parity.
- **Owner: frontend** — thêm mục Settings "Vùng bạn phát nội dung tới", kèm câu giải thích bilingual
  rằng không khai báo sẽ chặn nội dung crypto/trading.
- **Owner: CEO** — chốt mô hình tiếp thị sàn crypto (US/SG được phép có disclosure, UK cần FCA, CN/VN cấm).
