import { GuideContentRenderer } from "@/components/guide/guide-content-renderer";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Screen Guide — Sophia AI Factory Guide",
  description: "A-Z guide for every screen in Sophia AI Video Factory",
};

const content = `# Huong Dan Su Dung A-Z / Complete Screen Guide

> Tai lieu nay giup ban hieu **tung man hinh** trong Sophia.
> This guide helps you understand **every screen** in Sophia.

---

## Muc Luc / Table of Contents

| # | Trang / Page | URL |
|---|---|---|
| 1 | Trang Chu / Landing | \`/\` |
| 2 | Bang Gia / Pricing | \`/pricing\` |
| 3 | Thiet Lap / Setup Wizard | \`/setup-wizard\` |
| 4 | Dashboard | \`/dashboard\` |
| 5 | Tao Chien Dich / Create Campaign | \`/dashboard/create\` |
| 6 | Danh Sach Chien Dich / Campaigns List | \`/dashboard/campaigns\` |
| 7 | Thong Ke / Analytics | \`/dashboard/analytics\` |
| 8 | Cai Dat / Settings | \`/dashboard/settings\` |
| 9 | Tim San Pham / Affiliate Discovery | \`/affiliate-discovery\` |

---

## 1. Trang Chu / Landing Page

**URL:** \`/\`

| Phan / Section | Mo ta / Description |
|---|---|
| **Hero** (dau trang / top) | Tieu de lon + nut "Bat Dau" / Big title + "Get Started" button |
| **Workflow** | 4 buoc tao video / 4-step video creation flow |
| **Features** | Cac tinh nang chinh / Key capabilities |
| **Pricing** | 3 goi: BASIC, PREMIUM, ENTERPRISE |
| **Affiliate Discovery** | Tim san pham ban chay / Find trending products |
| **ROI Calculator** | Tinh loi nhuan du kien / Estimate profit |
| **FAQ** | Cau hoi thuong gap / Common questions |

**Ban can lam / What to do:** Nhan **"Bat Dau"** / Click **"Get Started"** de tao tai khoan.

---

## 2. Bang Gia / Pricing Page

**URL:** \`/pricing\`

**3 goi dich vu / 3 Plans:**

| Goi / Plan | Gia / Price | Danh cho / Best for |
|---|---|---|
| **BASIC** | $500/thang | Doanh nghiep nho / Small biz |
| **PREMIUM** | $1,200/thang | Dang phat trien / Growing |
| **ENTERPRISE** | $3,500/thang | DN lon / Large biz |

Nhan **"Chon Goi"** / Click **"Choose Plan"** de dang ky.

---

## 3. Thiet Lap / Setup Wizard

**URL:** \`/setup-wizard\`

Trinh thiet lap co **4 buoc**. Ban chi can lam **1 lan duy nhat**.

| Buoc / Step | Noi dung / Content |
|---|---|
| 1/4 | Kiem tra he thong / System Check |
| 2/4 | Nhap API Keys (OpenRouter + ElevenLabs + HeyGen) |
| 3/4 | Ket noi co so du lieu / Database |
| 4/4 | Hoan thanh / Finish → Go to Dashboard |

---

## 4. Dashboard

**URL:** \`/dashboard\`

Day la man hinh chinh. / This is your main screen.

| Thanh phan / Element | Mo ta / Description |
|---|---|
| **Stats cards** (3 o tren / at top) | Tong / Active / Hoan thanh |
| **Campaign list** | Tat ca video da tao / All created videos |
| **"Create Campaign"** button | Tao video moi / Create new video |
| **"Upgrade"** button | Nang cap goi / Upgrade plan |

**Mau trang thai:** Vang = Dang xu ly | Xanh = Hoan thanh | Do = Loi

---

## 5. Tao Chien Dich / Create Campaign

**URL:** \`/dashboard/create\`

1. **Chon Mau Video / Choose Template** — Nhan vao mau thich
2. **Dien thong tin / Fill details:**
   - Ten chien dich / Campaign name
   - Noi dung chinh / Main content
   - Giong noi / Voice (nam/nu)
3. Nhan **"Tao Chien Dich"** / Click **"Create Campaign"**
4. Doi 3-5 phut / Wait 3-5 minutes

---

## 6. Danh Sach Chien Dich / Campaigns List

**URL:** \`/dashboard/campaigns\`

Hien tat ca chien dich: Ten + Trang thai mau + Ngay tao. Nhan ten de xem chi tiet.

---

## 7. Thong Ke / Analytics

**URL:** \`/dashboard/analytics\`

Bieu do va so lieu: So video theo thoi gian, ty le hoan thanh, chi so hieu suat.

---

## 8. Cai Dat / Settings

**URL:** \`/dashboard/settings\`

Cap nhat tai khoan, thay doi API Keys, quan ly goi dich vu, lich su thanh toan.

---

## 9. Tim San Pham / Affiliate Discovery

**URL:** \`/affiliate-discovery\`

Tim san pham ban chay de quang ba. AI cham diem (SPS Score) de chon san pham tot nhat.

---

## Tiep Theo / Next

- [Getting Started](/guide)
- [FAQ](/guide/faq)
- [Telegram Bot](/guide/telegram)
`;

export default function ScreensGuidePage() {
  return <GuideContentRenderer content={content} />;
}
