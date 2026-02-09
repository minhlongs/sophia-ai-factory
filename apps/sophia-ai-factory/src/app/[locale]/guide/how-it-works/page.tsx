import { GuideContentRenderer } from "@/components/guide/guide-content-renderer";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "How It Works — Sophia AI Factory Guide",
  description: "User journey map and workflow guide for Sophia AI Video Factory",
};

const content = `# Hanh Trinh Nguoi Dung / How It Works

> Ban chi can lam theo tung buoc — Sophia se lo phan con lai.
> Just follow each step — Sophia handles the rest.

---

## 1. Chao Mung / Welcome

Sophia AI Video Factory la phan mem giup ban **tu dong tao video** bang tri tue nhan tao (AI). Ban khong can biet lap trinh. Ban khong can biet dung video. Sophia lam tat ca cho ban.

Sophia AI Video Factory is software that **automatically creates videos** using artificial intelligence (AI). You do not need to know coding or video editing. Sophia does everything for you.

**Sophia giup ban / Sophia helps you:**
- Tim san pham ban chay de gioi thieu / Find trending products to promote
- Viet kich ban video tu dong / Write video scripts automatically
- Tao giong noi AI tu nhien / Create natural AI voiceovers
- Tao nguoi trinh bay ao (avatar) / Create virtual presenters
- Dang video len YouTube tu dong / Publish videos to YouTube automatically

---

## 2. Ban Do Hanh Trinh / Journey Map

\`\`\`
  BAN / YOU
    |
    v
+---------------------------+
|  1. TRANG CHU / LANDING   |  <-- Xem gioi thieu, bang gia
|     sophia.agency          |      See intro, pricing
+---------------------------+
    |
    v
+---------------------------+
|  2. DANG KY / SIGN UP     |  <-- Tao tai khoan moi
|     Nhap email + mat khau  |      Create new account
+---------------------------+
    |
    v
+---------------------------+
|  3. THIET LAP / SETUP     |  <-- Ket noi 3 dich vu AI
|     Setup Wizard (4 buoc)  |      Connect 3 AI services
+---------------------------+
    |
    v
+---------------------------+
|  4. DASHBOARD              |  <-- Trung tam dieu khien
|     Xem tong quan          |      Your main control center
+---------------------------+
    |
    v
+---------------------------+
|  5. TELEGRAM BOT           |  <-- Tao video tu dien thoai!
|     @Sophia_Bbot           |      Create videos from phone!
+---------------------------+
\`\`\`

| Buoc / Step | Thoi gian / Time | Chi lam / Frequency |
|---|---|---|
| Dang ky / Sign up | 2 phut / 2 min | 1 lan / Once |
| Thiet lap / Setup | 10 phut / 10 min | 1 lan / Once |
| Tao video / Create video | 2 min nhap + 3-5 min cho | Moi lan / Each time |

---

## 3. Quy Trinh Nhanh / Quick Flow

\`\`\`
[Dang nhap]  >  [Chon Mau]  >  [Nhap Noi Dung]  >  [Doi 3-5p]  >  [Tai Video]
 Sign in        Template        Content             Wait 3-5m      Download
\`\`\`

---

## 4. Mau Trang Thai / Status Colors

| Mau / Color | Y nghia / Meaning |
|---|---|
| Vang / Yellow | Dang xu ly / Processing |
| Xanh la / Green | Hoan thanh / Completed |
| Do / Red | Co loi / Error |

---

## 5. Ho Tro / Support

| Kenh / Channel | Lien he / Contact |
|---|---|
| Email | support@sophia.agency |
| Telegram | @Sophia_Bbot (\`/help\`) |
| Tu van goi / Sales | sales@sophia.agency |

---

## Tiep Theo / Next

- [Xem tat ca man hinh / View all screens](/guide/screens)
- [Cau hoi thuong gap / FAQ](/guide/faq)
- [Telegram Bot Guide](/guide/telegram)
`;

export default function HowItWorksPage() {
  return <GuideContentRenderer content={content} />;
}
