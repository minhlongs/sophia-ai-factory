import { GuideContentRenderer } from "@/components/guide/guide-content-renderer";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hướng Dẫn Màn Hình A-Z — Hướng Dẫn Sophia AI Factory",
  description: "Hướng dẫn đầy đủ từng màn hình trong Sophia AI Video Factory",
};

const content = `# Hướng Dẫn Sử Dụng A-Z

> Tài liệu này giúp bạn hiểu **từng màn hình** trong Sophia.

---

## Mục Lục

| # | Trang | URL |
|---|---|---|
| 1 | Trang Chủ | \`/\` |
| 2 | Bảng Giá | \`/pricing\` |
| 3 | Thiết Lập | \`/setup-wizard\` |
| 4 | Dashboard | \`/dashboard\` |
| 5 | Tạo Chiến Dịch | \`/dashboard/create\` |
| 6 | Danh Sách Chiến Dịch | \`/dashboard/campaigns\` |
| 7 | Thống Kê | \`/dashboard/analytics\` |
| 8 | Cài Đặt | \`/dashboard/settings\` |
| 9 | Tìm Sản Phẩm | \`/affiliate-discovery\` |

---

## 1. Trang Chủ

**URL:** \`/\`

| Phần | Mô tả |
|---|---|
| **Hero** (đầu trang) | Tiêu đề lớn + nút "Bắt Đầu" |
| **Quy trình** | 4 bước tạo video |
| **Tính năng** | Các tính năng chính |
| **Bảng Giá** | 3 gói: BASIC, PREMIUM, ENTERPRISE |
| **Tìm Sản Phẩm** | Tìm sản phẩm bán chạy |
| **Tính ROI** | Tính lợi nhuận dự kiến |
| **FAQ** | Câu hỏi thường gặp |

**Bạn cần làm:** Nhấn **"Bắt Đầu"** để tạo tài khoản.

---

## 2. Bảng Giá

**URL:** \`/pricing\`

**3 gói dịch vụ:**

| Gói | Giá | Dành cho |
|---|---|---|
| **BASIC** | $500/tháng | Doanh nghiệp nhỏ |
| **PREMIUM** | $1,200/tháng | Đang phát triển |
| **ENTERPRISE** | $3,500/tháng | Doanh nghiệp lớn |

Nhấn **"Chọn Gói"** để đăng ký.

---

## 3. Thiết Lập

**URL:** \`/setup-wizard\`

Trình thiết lập có **4 bước**. Bạn chỉ cần làm **1 lần duy nhất**.

| Bước | Nội dung |
|---|---|
| 1/4 | Kiểm tra hệ thống |
| 2/4 | Nhập API Keys (OpenRouter + ElevenLabs + HeyGen) |
| 3/4 | Kết nối cơ sở dữ liệu |
| 4/4 | Hoàn thành → Vào Dashboard |

---

## 4. Dashboard

**URL:** \`/dashboard\`

Đây là màn hình chính của bạn.

| Thành phần | Mô tả |
|---|---|
| **Stats cards** (3 ô trên) | Tổng / Đang chạy / Hoàn thành |
| **Danh sách chiến dịch** | Tất cả video đã tạo |
| **Nút "Tạo Chiến Dịch"** | Tạo video mới |
| **Nút "Nâng Cấp"** | Nâng cấp gói |

**Màu trạng thái:** Vàng = Đang xử lý | Xanh = Hoàn thành | Đỏ = Lỗi

---

## 5. Tạo Chiến Dịch

**URL:** \`/dashboard/create\`

1. **Chọn Mẫu Video** — Nhấn vào mẫu thích
2. **Điền thông tin:**
   - Tên chiến dịch
   - Nội dung chính
   - Giọng nói (nam/nữ)
3. Nhấn **"Tạo Chiến Dịch"**
4. Đợi 3-5 phút

---

## 6. Danh Sách Chiến Dịch

**URL:** \`/dashboard/campaigns\`

Hiện tất cả chiến dịch: Tên + Trạng thái màu + Ngày tạo. Nhấn tên để xem chi tiết.

---

## 7. Thống Kê

**URL:** \`/dashboard/analytics\`

Biểu đồ và số liệu: Số video theo thời gian, tỷ lệ hoàn thành, chỉ số hiệu suất.

---

## 8. Cài Đặt

**URL:** \`/dashboard/settings\`

Cập nhật tài khoản, thay đổi API Keys, quản lý gói dịch vụ, lịch sử thanh toán.

---

## 9. Tìm Sản Phẩm

**URL:** \`/affiliate-discovery\`

Tìm sản phẩm bán chạy để quảng bá. AI chấm điểm (SPS Score) để chọn sản phẩm tốt nhất.

---

## Tiếp Theo

- [Bắt Đầu Sử Dụng](/guide)
- [Câu Hỏi Thường Gặp](/guide/faq)
- [Hướng Dẫn Telegram Bot](/guide/telegram)
`;

export default function ScreensGuidePage() {
  return <GuideContentRenderer content={content} />;
}
