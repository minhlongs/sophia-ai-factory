# ZEN-07.3 — GITHUB TRUTH & INTEGRATION BASELINE REPORT (G0 & G1)
# BÁO CÁO XÁC THỰC NGUỒN GITHUB & ĐƯỜNG CƠ SỞ TÍCH HỢP ZEN DESIGN OS (G0 & G1)

- **Verification Timestamp (UTC):** `2026-11-15T05:50:00Z`
- **Repository:** `https://github.com/minhlongs/sophia-ai-factory`
- **Application Root:** `apps/sophia-ai-factory`
- **Isolated Integration Worktree:** `/Users/macbook/sophia-ai-factory/.claude/worktrees/zen-design-release-readiness-07-3`
- **Isolated Integration Branch:** `audit/sophia-zen-design-release-readiness`
- **Production Status:** **PROTECTED (`NO PUSH. NO MERGE. NO DEPLOY. NO SELF-SIGNOFF.`)**

---

## 1. Tóm tắt điều hành cho Founder (Tiếng Việt) / Executive Summary (English)

**🇻🇳 Tiếng Việt:**
Qua kiểm tra trực tiếp bằng `git fetch origin --prune` và `gh pr list` (xác thực trực tuyến với GitHub), chúng tôi xác nhận nhánh thiết kế `design/sophia-zen-design-os-v1` (mốc checkpoint báo cáo `b3338a256408ef194cc63cb6fcbe6dcc27ca718c`, đỉnh nhánh `b0a721c5e2239a8e20ef7bcf1c2c1b5f5504d30d`) **đã được gộp dạng squash-merge vào `main` qua PR #155** tại commit `db28aa614a9bc257cad1a10983eb0df043ab4f8a` lúc `2026-11-14T15:09:43Z`. Ngay sau đó, **PR #171** (`feat/sophia-genesis-activation-funnel`) đã được squash-merge lên `main` tạo thành đỉnh `origin/main` hiện tại là `27107209d63a4861c6657cbc0f480a3fb1143280` (đang chạy trên biên Cloudflare `https://sophia.agencyos.network/api/version` → `shortSha: "27107209"`).

Vì PR #155 đã nằm trong `origin/main`, ứng viên tích hợp trong worktree cô lập `audit/sophia-zen-design-release-readiness` **tuyệt đối không cherry-pick lại hay ghi đè code cũ của nhánh thiết kế lên `main`**. Thay vào đó, chúng tôi lấy `origin/main` (`27107209d...`) làm đường cơ sở duy nhất, đối chiếu 3 chiều toàn bộ lịch sử (`673ec911b` → `d785888a7` → `db28aa614` → `27107209d`), bảo toàn 100% logic kinh doanh/bảo mật mới nhất của Genesis PR #171 và PR #160/#163/#165/#168, đồng thời xử lý triệt để các lỗi hậu gộp (P0 thiếu header CSRF trình duyệt ở Setup Wizard, lỗ hổng phân loại rate-limit BYOK ở `/api/setup/*` & upstream 429/402, tương phản Sáng/Tối WCAG 2.2 AA trên các thẻ mới của PR #171, hộp thoại thực trên trình duyệt ở 320px/375px/1440px và tài liệu lệch chuẩn).

**🇬🇧 English:**
Live verification via `git fetch origin --prune` and `gh pr list` confirms that `design/sophia-zen-design-os-v1` (reported checkpoint `b3338a256408ef194cc63cb6fcbe6dcc27ca718c`, branch tip `b0a721c5e2239a8e20ef7bcf1c2c1b5f5504d30d`) **was already squash-merged into `main` via PR #155** (`db28aa614a9bc257cad1a10983eb0df043ab4f8a` at `2026-11-14T15:09:43Z`). Subsequently, **PR #171** (`feat/sophia-genesis-activation-funnel`) was squash-merged on top, advancing `origin/main` to `27107209d63a4861c6657cbc0f480a3fb1143280` (verified live on `https://sophia.agencyos.network/api/version` with `shortSha: "27107209"`).

Accordingly, the isolated integration worktree `audit/sophia-zen-design-release-readiness` branches directly from `27107209d63a4861c6657cbc0f480a3fb1143280` without replaying already-merged Zen commits or overwriting newer `main` middleware/BYOK code. All post-merge regressions and remaining Zen Design OS acceptance conditions (G4–G13) are remediated cleanly on top of `27107209d63a4861c6657cbc0f480a3fb1143280`.

---

## 2. Bảng đối chiếu SHA 40 ký tự chính xác / Exact 40-Character SHA Ledger

| Role / Vai trò | Branch / Ref | Exact 40-Char SHA | Notes / Ghi chú xác thực |
|---|---|---|---|
| **Merge-base (`origin/main` ↔ `design/sophia-zen-design-os-v1`)** | Common Ancestor | `673ec911be317233c7e6cb961bdca9d2097e210f` | Điểm rẽ nhánh gốc trước khi Zen Design OS v1 và các PR #150–#171 diễn ra |
| **Initial Zen Design OS Commit** | `design/sophia-zen-design-os-v1~19` | `4d23ddb386f499b7627f2c828a1b80c81c6a3382` | Commit khởi tạo Zen Design OS đầu tiên (36 tệp thay đổi so với `673ec911b`) |
| **Reported Design Checkpoint (`07.1`/`07.2`)** | `b3338a256` | `b3338a256408ef194cc63cb6fcbe6dcc27ca718c` | Diff đơn lẻ `4d23ddb38..b3338a256` = đúng **104 tệp**; tích lũy từ merge-base `673ec911b..b3338a256` = **132 tệp** |
| **Source Design Branch Tip (Local & Remote)** | `design/sophia-zen-design-os-v1` & `origin/design/sophia-zen-design-os-v1` | `b0a721c5e2239a8e20ef7bcf1c2c1b5f5504d30d` | 20 commits từ `673ec911b`, tổng **184 tệp** (88 Added, 96 Modified). Bảo toàn nguyên vẹn tại `/Users/macbook/.gemini/antigravity/scratch/sophia-zen-design-os-v1` |
| **Pre-Zen `main` Baseline (Immediate Parent of PR #155)** | `origin/main~2` | `d785888a73696065852f0de26f58e53334bcff1e` | Gồm 5 squash-merge trên `main` trước Zen (#150, #160, #163, #165, #168 = 64 tệp). Dùng làm mốc đo chênh lệch bundle Pre-Zen G10 |
| **Zen Design OS Squash-Merge on `main` (PR #155)** | `origin/main~1` | `db28aa614a9bc257cad1a10983eb0df043ab4f8a` | Gộp lúc `2026-11-14T15:09:43Z` (184 tệp: 181 tệp trùng khớp từng byte với `b0a721c5e`, 3 tệp gộp sạch với `d785888a7`) |
| **Current Verified `origin/main` & Live Edge** | `origin/main` | `27107209d63a4861c6657cbc0f480a3fb1143280` | PR #171 (`feat/sophia-genesis-activation-funnel`) gộp lúc `2026-11-14T18:50:34Z` (52 tệp). Đường cơ sở tích hợp của 07.3 |

---

## 3. Trạng thái Pull Request & Phân tích chồng lấn tệp / PR Status & File Overlap Audit

### 3.1 Các PR liên quan trên `minhlongs/sophia-ai-factory` (Verified via `gh pr list`)

| PR # | Trạng thái | Merge Commit / Branch | Thời điểm Merge | Ảnh hưởng tới Zen Design OS & Bảo mật |
|---:|---|---|---|---|
| **#160** | `MERGED` | `3c208445699f086820b422908091f9a0ba1663c4` | `2026-11-14T09:43:56Z` | YouTube provenance gate trước circuit breaker; đã bảo toàn nguyên vẹn |
| **#163** | `MERGED` | `1cffe446b431201f73bb0c4798ac857221259e30` | `2026-11-14T10:58:51Z` | Khôi phục đường vào webhook PayOS IPN (#158) và Telegram Bot (#159) trong middleware; đã bảo toàn |
| **#165** | `MERGED` | `0a76ecd2ffa9455a9e3f7f8bf135017038935f98` | `2026-11-14T13:12:32Z` | Cho phép callback server-to-server của Inngest đi qua cổng CSRF; đã bảo toàn |
| **#168** | `MERGED` | `d785888a73696065852f0de26f58e53334bcff1e` | `2026-11-14T13:55:29Z` | Thắt chặt payload Telegram, exact bypass và rate-limit `webhook` trong `api-handler.ts`; đã kết hợp sạch với bucket `byok` |
| **#155** | `MERGED` | `db28aa614a9bc257cad1a10983eb0df043ab4f8a` | `2026-11-14T15:09:43Z` | Squash-merge nhánh `design/sophia-zen-design-os-v1` (184 tệp) lên `main` |
| **#171** | `MERGED` | `27107209d63a4861c6657cbc0f480a3fb1143280` | `2026-11-14T18:50:34Z` | Genesis 1-key BYOK router, 14d Paid Pilot, TikTok compliance publish gate & ValidationReceiptCard (52 tệp; chồng lấn trực tiếp 3 tệp của PR #155 và sinh thêm giao diện mới cần đồng bộ Dual-Theme + CSRF) |
| **#167, #161, #156, #151** | `OPEN` | Các nhánh tính năng độc lập | Chưa merge | Không tự ý gộp vào RC này theo đúng khóa phạm vi G0/G3 |

### 3.2 Đối chiếu chồng lấn tệp (File Overlap)

1. **Giữa Pre-Zen `main` (`673ec911b..d785888a7`, 64 tệp) và Zen Design OS (`673ec911b..b0a721c5e`, 184 tệp):**
   - Chỉ chồng lấn đúng **3 tệp**:
     1. `apps/sophia-ai-factory/src/middleware/api-handler.ts` (PR #168 thêm `RATE_LIMITS.webhook`; PR #155 thêm `RATE_LIMITS.byok` — cả hai đã cùng tồn tại trong `db28aa614`).
     2. `apps/sophia-ai-factory/messages/en.json`
     3. `apps/sophia-ai-factory/messages/vi.json`
   - 181/184 tệp còn lại của `db28aa614` trùng khớp từng byte (`0 diff`) với đỉnh nhánh thiết kế `b0a721c5e`.

2. **Giữa PR #155 (`db28aa614`) và PR #171 (`27107209d`, 52 tệp):**
   - Chồng lấn trực tiếp trên **3 tệp**:
     1. `apps/sophia-ai-factory/src/tree/components/setup-wizard/steps/index.tsx`
     2. `apps/sophia-ai-factory/messages/en.json`
     3. `apps/sophia-ai-factory/messages/vi.json`
   - Ngoài ra, PR #171 tách nhỏ các module Setup Wizard (`use-setup-wizard-actions.ts`, `setup-wizard-api.ts`, `api-keys-step.tsx`, `validation-receipt-card.tsx`), thêm `PaidPilotBanner` ở trang Pricing, và thêm `PublishLedgerApprovalQueue` / `TikTokComplianceFields` ở trang Approvals sử dụng các lớp `bg-secondary`, `text-amber-300` cố định làm tụt độ tương phản ở giao diện Sáng (`:root`) hoặc thiếu `x-csrf-token` khi gọi từ trình duyệt. Tất cả đã được kiểm toán và khắc phục trong G2–G8.

---

## 4. Bằng chứng bảo toàn toàn bộ Worktrees & Stashes hiện có (G1 Preservation Proof)

- **Tổng số worktrees đang tồn tại trên máy:** `77` worktrees (bao gồm `76` worktrees có sẵn + `1` worktree tích hợp mới `/Users/macbook/sophia-ai-factory/.claude/worktrees/zen-design-release-readiness-07-3`).
- **Trạng thái các worktrees trọng yếu (Không chạm vào dù chỉ 1 byte):**
  - Root checkout `/Users/macbook/sophia-ai-factory` (`feat/sophia-anatomy-workflow-explainer` @ `f06474ac0`) — giữ nguyên trạng thái chưa commit hiện hữu của người dùng.
  - Design source worktree `/Users/macbook/.gemini/antigravity/scratch/sophia-zen-design-os-v1` (`design/sophia-zen-design-os-v1` @ `b0a721c5e2239a8e20ef7bcf1c2c1b5f5504d30d`) — giữ nguyên lịch sử 20 commits và tệp chưa theo dõi.
  - Các worktrees Genesis/BYOK (`sophia-genesis-byok-rc-06-1`, `sophia-genesis-byok-rc-06-2`, `sophia-genesis-rc`, `audit/genesis-08-paid-pilot`, v.v.) — giữ nguyên 100%.
  - Ngăn xếp `git stash list`: giữ nguyên tuyệt đối (không chạy `git stash`, `git stash pop`, `git reset --hard` hay bất kỳ thao tác phá hủy nào).
