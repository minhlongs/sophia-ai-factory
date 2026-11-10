# 11 — DANH SÁCH KIỂM TRA AN TOÀN TRƯỚC PHÁT HÀNH (RELEASE SAFETY CHECKLIST)
> **Tài liệu:** `docs/design/zen-design-os/11-RELEASE-SAFETY-CHECKLIST.md`
> **Thẩm quyền phê duyệt phát hành:** **CHỈ DÀNH CHO FOUNDER (FOUNDER ONLY)**
> **Trạng thái hiện tại:** Đã hoàn tất và xác minh cục bộ trên nhánh `design/sophia-zen-design-os-v1` — **CHƯA PUSH, CHƯA MERGE, CHƯA DEPLOY PRODUCTION**.

---

## 1. CAM KẾT AN TOÀN HỆ THỐNG ĐƯỢC BẢO VỆ (PROTECTED SYSTEMS VERIFICATION)

| Hệ thống được bảo vệ | Trạng thái trên nhánh `design/sophia-zen-design-os-v1` | Bằng chứng xác minh |
|---|---|---|
| **Production Cloudflare Workers / D1 / R2 / KV** | **KHÔNG TÁC ĐỘNG (UNTOUCHED)** | Không có lệnh `wrangler deploy`, `wrangler d1 execute --remote` hay kết nối từ xa nào được thực thi. |
| **Git `main` branch & Origin Remote** | **KHÔNG TÁC ĐỘNG (UNTOUCHED)** | Mọi thay đổi nằm hoàn toàn trong worktree cô lập trên nhánh `design/sophia-zen-design-os-v1`. |
| **Luồng bảo vệ #1: Setup Wizard (BYOK API Keys)** | **ĐÃ XÁC MINH AN TOÀN (VERIFIED GREEN)** | 100% bài kiểm thử trong `src/tree/components/setup-wizard/__tests__/` vượt qua; giữ nguyên mã hóa `AES-256-GCM` và cơ chế `FAIL-CLOSED`. |
| **Luồng bảo vệ #2: Telegram Bot (`@Sophia_Bbot`)** | **KHÔNG TÁC ĐỘNG (UNTOUCHED)** | `git diff` xác nhận không có tệp nào trong `src/tree/telegram/` bị sửa đổi. |
| **Luồng bảo vệ #3: Thanh toán (`NOWPayments` / `PayOS`)** | **KHÔNG TÁC ĐỘNG (UNTOUCHED)** | `git diff` xác nhận không có tệp nào trong `src/land/billing/` hoặc webhook IPN bị sửa đổi. |
| **Biến môi trường & Bí mật (Secrets / `.env`)** | **AN TOÀN TUYỆT ĐỐI (VERIFIED CLEAN)** | `npm run ci:secrets` đạt `0` vi phạm; không có khóa bí mật nào được in ra hoặc đưa vào git. |
| **Cơ sở dữ liệu & Migrations (`migrations/*.sql`)** | **KHÔNG TÁC ĐỘNG (UNTOUCHED)** | Không tạo mới hay sửa đổi bất kỳ tệp migration SQL nào cho mục đích giao diện. |

---

## 2. CÁC BƯỚC ĐỂ FOUNDER KIỂM TRA VÀ PHÁT HÀNH KHI SẴN SÀNG

Khi Founder muốn xem xét và đưa nhánh `design/sophia-zen-design-os-v1` lên môi trường Production, chỉ cần thực hiện tuần tự các bước sau:

### Bước 1: Xem lại lịch sử Commit và Diff cục bộ
```bash
cd /Users/macbook/.gemini/antigravity/scratch/sophia-zen-design-os-v1/apps/sophia-ai-factory
git status
git log -n 3 --stat
```

### Bước 2: Chạy lại bộ cổng chất lượng (Stage 1 Pre-Deploy Gates)
```bash
npm run check:color-tokens
npm run type-check
npm run lint
npm run check:boundaries
npm run i18n:validate
npm run ci:secrets
```

### Bước 3: Đẩy nhánh và tạo Pull Request (Chỉ thực hiện khi Founder ra lệnh)
```bash
git push -u origin design/sophia-zen-design-os-v1
gh pr create --base main --head design/sophia-zen-design-os-v1 --title "feat(design): ZEN DESIGN OS v1.0 Progressive Dual-Theme & Motion Governance"
```

### Bước 4: Xác minh sau khi Merge vào `main` (Theo `.claude/rules/sophia-deploy-verify.md`)
Sau khi GitHub Actions `deploy.yml` hoàn tất:
```bash
LOCAL_SHA=$(git rev-parse HEAD | cut -c1-8)
LIVE_SHA=$(curl -s "https://sophia.agencyos.network/api/version?deployVerify=$(date +%s)" | grep -o '"shortSha":"[^"]*"' | cut -d'"' -f4)
echo "Local: $LOCAL_SHA | Live: $LIVE_SHA"
```
