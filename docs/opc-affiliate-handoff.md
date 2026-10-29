# Sophia OPC Affiliate — Handoff (founder-facing, bilingual)

> Ngôn ngữ: tiếng Việt trước, English sau. Client là CEO không kỹ thuật — phần này không
> dùng thuật ngữ lập trình.
> Language: Vietnamese first, English after. Client is a non-technical CEO, so this section
> avoids engineering jargon.

## 1. Kết luận một dòng / One-line conclusion

Sản phẩm quảng cáo một "máy sinh doanh thu từ video affiliate". Thực tế đo được: **17/18
nhóm chức năng fail hoặc bị chặn**; nhóm duy nhất đạt đầy đủ là kiểm tra chữ ký webhook
(B01). Con đường "video → click → hoa hồng" **chưa tồn tại** dù từng mảnh code riêng lẻ đã
được viết và có test.

The product advertises a "video-to-affiliate-revenue engine". Measured: **17 of 18 groups
FAIL or are BLOCKED**; the only fully-passing group is webhook signature checking (B01).
The "video → click → commission" path **does not exist**, even though each individual piece
of code is written and unit-tested.

## 2. Vì sao code có mà sản phẩm không chạy / Why code exists but the product does not run

Đây là lỗ hổng quan trọng nhất và cần CEO hiểu trước khi duyệt chi tiêu:

**"Có code" và "có chạy" là hai chuyện khác nhau.** Cột mốc kiểm soát chất lượng hiện tại
(TypeScript, ESLint, kiến trúc 4 lớp, song ngữ, test) **đểu xanh** — tức là pipeline hoàn
toàn có thể deploy một bản build mà mọi con số affiliate trên bảng điều khiển đểu là 0.

> "Having code" and "having it run" are two different things. All current quality gates
> (TypeScript, ESLint, 4-layer boundaries, bilingual, tests) **pass**, which means the
> pipeline can deploy a build in which every affiliate figure on the dashboard is zero —
> green CI included.

Ví dụ điển hình: ba worker xử lý "kết quả mới → quyết định kế tiếp" đã viết xong, có test,
nhưng **không được đăng ký** vào runtime. Kết quả là chúng nằm im. Không gate nào phát hiện.

> The clearest example: the three workers that turn new results into the next decision are
> written and tested but **never registered** into the runtime, so they sit idle. No gate
> detects this.

## 3. Ba lỗi gây hậu quả tiền thật / Three defects with money consequences

### 🔴 Nghiêm trọng nhất — bảng dữ liệu tiền hoa hồng không tồn tại

Code **ghi** và **đọc** một bảng tên `workspace_external_commissions`. Nhưng trong **432
file tạo bảng** của dự án, **không có file nào tạo bảng này**. Hệ quả: mỗi lần mở trang
tổng hợp hoa hồng, code báo lôi, và lôi đó bị **nuốt chửng** — bảng hiện toàn số 0, không
báo lỗi. Người dùng thấy "chưa có doanh thu" thay vì "hệ thống hỏng".

Thêm nữa: luật bỏ qua file của git áp `*.sql` (không theo dõi migration mới), chỉ có 4 file
được miễn thủ công. Đã thực nghiệm viết một file migration mới → git **không thấy nó**. Nên
gate CI cũng không thể thấy. Đây là lý do lỗi trên xảy ra được.

> **Most critical — the commission table does not exist.** Code both **writes** and
> **reads** `workspace_external_commissions`, but no file among the project's **432 schema
> files** creates it. Every reconciliation open throws, and the throw is **swallowed** — the
> dashboard shows all zeros with no error. Users see "no revenue yet" instead of "system
> broken". Separately, the git ignore rule applies `*.sql` with only 4 manual exemptions, so
> a newly authored migration is invisible to git (proven by probe) and therefore to CI.
> That is *why* the missing table was possible.

### 🔴 Publish báo thành công giả

Bước "đăng lên YouTube" **không hề gọi mạng** — nó tự chế một link
`youtube.com/shorts/<mã-job>` rồi ghi nhận "thành công". Link đó nhìn y hệt link thật trên
giao diện. Nếu CEO báo cáo với khách/đối tác dựa trên màn hình này, báo cáo sẽ sai.

> **Publish reports fake success.** The "upload to YouTube" step makes **no network call**
> — it fabricates `youtube.com/shorts/<jobId>` and records success. It looks identical to a
> real URL in the UI. Any reporting based on that screen is wrong.

### 🟠 Người dùng không tự kết nối được tài khoản affiliate

Máy lưu mật khẩu 9 mạng affiliate (Binance, Bybit, Impact…) đã có và mã hoóa tốt, nhưng
**không có nút nào để bấm**: không màn hình, không bước trong Setup Wizard. Và Setup Wizard
chính là cổng onboarding mà học thuyết sản phẩm yêu cầu ("khách tự nhập key affiliate").

> **Customers cannot self-connect affiliate accounts.** A real encrypted store for 9
> networks exists, but there is **no button to press** — no screen, no Setup Wizard step,
> and Setup Wizard is the onboarding gate the product doctrine mandates for affiliate keys.

## 4. Những gì đúng / What is correct

Không phải tất cả đểu hỏng —CEO cần biết phần nền đã vững để ước lượng chi phí sửa:

- Kiểm tra chữ ký webhook (B01): **đạt**.
- Ghép cặp id chống trùng hoa hồng chống ghi 2 lần (kịch bản 3): **đúng**, có khoá nguyên tử.
- Phân loại trạng thái `pending → approved → reversed → paid` và cách giữ tiền riêng theo
  từng loại tiền tệ không trộn: **đúng về mặt số học** — nhưng không chạy được vì bảng
  (xem mục 3).
- Khóa nội dung đã duyệt bằng mã băm SHA-256: **có và đang chạy** — nhưng chỉ chặn ở bước
  dựng video, không chặn ở bước đăng.
- Song ngữ VI/EN: **đạt** — 1408/1408 khoá, 0 thiếu cả hai chiều.
- Kiểm tra kiến trúc 4 lớp: **đạt** (đã chạy thật, không chỉ đọc code).

> Webhook signature check passes (B01). Duplicate-callback protection is correct with an
> atomic lock. Commission status precedence and per-currency segregation are mathematically
> correct (but unreachable). SHA-256 approval pinning exists and runs — at the render
> boundary, not publish. VI/EN parity is genuine. The 4-layer gate was actually executed.

## 5. Vì sao không dùng "test xanh" làm bằng chứng / Why "green tests" are not evidence

Số test xanh hiện tại (hàng nghìn) chứng minh code biên dịch được và logic đơn vị đúng —
nó **không** chứng minh một đồng hoa hồng nào đi vào hệ thống. Do đó toàn bộ báo cáo tách
bạch 4 mức nghiệm thu và không đổi mức: L1 (code/toán), L2 (tích hợp local), L3
(nhà cung cấp/production), L4 (thương mại). Không mức nào được dùng bằng chứng của mức
khác.

> Current green tests prove code compiles and unit logic is right; they do not prove a
> single commission enters the system. The report keeps four acceptance levels separate
> and never substitutes one level's evidence for another's.

## 6. Những việc CHƯA kiểm tra (không được coi là đạt) / What is NOT VERIFIED

- **Chưa kiểm tra deploy thật / live production.** Không đọc SHA live, không gọi endpoint
  production, không chạy migration remote — đúng như giới hạn được cấp.
- **Chưa gọi nhà cung cấp trả phí / paid providers.** Không ElevenLabs, không HeyGen, không
  YouTube upload.
- **Chưa kiểm tra với dữ liệu khách hàng thật / production customer data.**
- **Chưa có bằng chứng doanh thu thương mại (L4).** Không có cụm khách đủ trưởng thành, nên
  không số test nào tự chứng minh khả năng kiếm tiền.

> Production deploy, paid providers, real customer data, and commercial (L4) evidence are
> all unverified. None of these may be read as PASS.

## 7. Môi trường audit — lưu ý cho người thực thi tiếp / Environment note for the next executor

Worktree audit **không có `node_modules` đã cài** (thư mục trống), trong khi checkout chính
có đủ 1040 gói. Đã xác nhận bằng cách chạy `npm run type-check` → `MODULE_NOT_FOUND`, và đó
là lỗi thiếu phụ thuộc, **không** phải lỗi code. Các gate đã chạy được trong worktree này:
`check-layer-boundaries.sh` (✅ sạch) và `validate-i18n-keys.mjs` (✅ 0 thiếu). Giai đoạn
triển khai cần `npm ci --legacy-peer-deps` trước khi chạy được type-check / lint / test.

> The audit worktree has an empty `node_modules`; `type-check` failed with
> `MODULE_NOT_FOUND`, which is a missing-dependency issue, not a code defect. Two gates were
> run successfully here: layer boundaries (clean) and i18n validation (0 missing). The
> implementation phase must `npm ci --legacy-peer-deps` first.

## 8. Gate duy nhất thực sự bảo vệ tiền / The only gate that actually protects the money

Gate hiện có kiểm tra *commit live* rất chặt (Stage 2a từ chối nếu `shortSha` sai hoặc
không giải mã được). Nhưng nó chỉ kiểm tra **mã commit**, không kiểm tra **schema** — nên
thiếu bảng vượt qua sạch sẽ. Dự án có sẵn một guard phát hiện đúng lớp lỗi này
(`scripts/check-migration-coverage.sh`, chính nó ghi rõ sinh ra vì sự cố "bảng không tới
được production D1") nhưng `grep -rn "migration-coverage" .github/workflows/` → **rỗng**:
nó chưa được nối vào CI.

> The pipeline validates the deployed *commit* strictly but never the *schema*, so a missing
> table passes cleanly. A guard that detects exactly this failure class already exists in the
> repo and is **not wired into CI** (`grep` under `.github/` returns nothing).

## 9. Đề xuất thứ tự sửa (tóm tắt) / Recommended fix order (summary)

Chi tiết nằm trong `docs/opc-affiliate-remediation-plan.md`. Thứ tự theo rủi ro:

1. **Tạo bảng `workspace_external_commissions`** + backup D1 trước khi apply. (Chặn lỗi
   nghiêm trọng nhất.)
2. **Nối `check-migration-coverage.sh` vào Gate 1** và bỏ luật `*.sql` ignore theo danh
   sách thủ công. (Chặn cả lớp lỗi, không chỉ một trường hợp.)
3. **Thay adapter publish giả bằng gọi HTTP thật** + báo lỗi thành công.
4. **Đăng ký 3 worker learning loop** để vòng phản hồi chạy.
5. **Làm màn hình kết nối affiliate** cho khách, sửa khoá tenant cho khớp.
6. **Làm tiếp chuỗi render → publish** sau `RENDER_READY`.
7. Rồi mới tới nghiệm thu L2 (local integration) với adapter giả được gắn nhãn rõ.

> Ordering by risk: create the missing table (with a D1 backup first); wire the existing
> migration-coverage guard into Gate 1 and replace the manual `*.sql` allowlist; replace the
> fabricated publish adapter with a real HTTP call that can fail; register the three
> learning-loop workers; build the customer-facing affiliate connection screen and fix the
> tenant key; complete the render→publish chain after `RENDER_READY`; then run L2.

---

## Tài liệu đi kèm / Companion documents

| File | Nội dung |
|---|---|
| `OPC_AFFILIATE_AUDIT_MATRIX_2026-10-27.md` | 18/18 nhóm đã có verdict + bằng chứng |
| `opc-affiliate-runtime-map.md` | đường đi code, module không hoạt động, luồng ID |
| `opc-affiliate-verification.md` | 8 kịch bản xuyên suốt, verdict từng kịch bản |
| `opc-affiliate-handoff.md` | file này |
| `opc-affiliate-remediation-plan.md` | kế hoạch sửa theo phase, file ownership, risk |

**Snapshot đã khoá:** `439635e1a2017c2643e013c0311631bd95409de4`
