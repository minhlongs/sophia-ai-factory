import { GuideContentRenderer } from "@/components/guide/guide-content-renderer";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "FAQ — Sophia AI Factory Guide",
  description: "Frequently asked questions about Sophia AI Video Factory",
};

const content = `# FAQ / Cau Hoi Thuong Gap

> Answers to the most common questions about Sophia AI Video Factory
> Giai dap nhung cau hoi thuong gap nhat ve Sophia AI Video Factory

---

## 1. Tong Quan / General

### Q1: Sophia AI Video Factory la gi? / What is Sophia AI Video Factory?

**Tieng Viet:** Sophia la nen tang giup ban tao video tu dong bang tri tue nhan tao (AI). Ban chi can nhap noi dung, Sophia se tu viet kich ban, tao giong noi, va tao video hoan chinh — ban khong can biet lam video.

**English:** Sophia is a platform that helps you create videos automatically using artificial intelligence (AI). You just enter your content, and Sophia writes the script, creates the voiceover, and produces the complete video — no video editing skills needed.

---

### Q2: Toi can biet lap trinh khong? / Do I need to know coding?

**Tieng Viet:** Khong. Sophia duoc thiet ke cho nguoi khong biet ky thuat.

**English:** No. Sophia is designed for non-technical users. Everything is guided step-by-step.

---

### Q3: Sophia tao video nhu the nao? / How does Sophia create videos?

**Tieng Viet:**
1. Ban nhap noi dung (chu de video)
2. AI viet kich ban tu dong (qua OpenRouter)
3. AI tao giong noi tu nhien (qua ElevenLabs)
4. AI tao video voi nguoi trinh bay ao (qua HeyGen)
5. Video hoan chinh duoc gui cho ban

**English:**
1. You enter the content (video topic)
2. AI writes the script automatically (via OpenRouter)
3. AI creates a natural voiceover (via ElevenLabs)
4. AI creates the video with a virtual presenter (via HeyGen)
5. The complete video is delivered to you

---

### Q4: Mat bao lau? / How long does it take?

**Tieng Viet:** 2-5 phut cho video ngan (duoi 3 phut). Video dai hon co the mat 10-15 phut.

**English:** 2-5 minutes for short videos (under 3 minutes). Longer videos may take 10-15 minutes.

---

## 2. API Keys

### Q5: API Key co mat phi khong? / Do API Keys cost money?

**Tieng Viet:** Cac dich vu deu co goi mien phi de bat dau. Khi su dung nhieu, ban can nang cap goi.

**English:** These services all have free tiers to get started. When you use more, you'll need to upgrade each service's plan separately.

---

### Q6: API Key co an toan khong? / Are my API Keys secure?

**Tieng Viet:** Co. API Keys duoc ma hoa va luu tru an toan. Chung toi khong chia se key cua ban.

**English:** Yes. API Keys are encrypted and stored securely. We never share your keys with anyone.

---

## 3. Chien Dich / Campaigns

### Q7: Toi co the tao bao nhieu video? / How many videos can I create?

| Goi / Plan | Gioi han / Limit |
|---|---|
| BASIC | 20 video/thang |
| PREMIUM | 100 video/thang |
| ENTERPRISE | Khong gioi han / Unlimited |

---

### Q8: Chien dich bi ket? / Campaign stuck at Processing?

**Tieng Viet:**
1. Doi them 10 phut
2. Nhan **"Lam Moi"** trang Dashboard
3. Neu van con ket sau 15 phut, nhan **"Chay Lai"** (Retry)
4. Lien he ho tro qua Telegram @Sophia_Bbot

**English:**
1. Wait 10 more minutes
2. Click **"Refresh"** on the Dashboard
3. If still stuck after 15 minutes, click **"Retry"**
4. Contact support via Telegram @Sophia_Bbot

---

## 4. Telegram Bot

### Q9: Bot khong tra loi? / Bot not responding?

**Tieng Viet:**
1. Kiem tra ten bot: \`@Sophia_Bbot\` (chu B viet hoa)
2. Dam bao ban da nhan **"START"**
3. Thu gui lenh \`/help\`
4. Doi 30 giay roi thu lai

**English:**
1. Check bot name: \`@Sophia_Bbot\` (capital B)
2. Make sure you tapped **"START"**
3. Try sending \`/help\`
4. Wait 30 seconds and try again

---

## 5. Thanh Toan / Billing

### Q10: Hoa don duoc gui o dau? / Where are invoices sent?

**Tieng Viet:** Hoa don tu dong gui qua email sau moi lan thanh toan. Ban co the tai hoa don tu Dashboard muc "Lich Su Thanh Toan."

**English:** Invoices are automatically sent to your registered email. You can also download invoices from Dashboard under "Billing History."

---

## 6. Ho Tro / Support

| Phuong thuc / Method | Chi tiet / Details |
|---|---|
| Telegram Bot | @Sophia_Bbot (\`/help\`) |
| Email | support@sophia.agency |
| Ho tro uu tien / Priority | PREMIUM va ENTERPRISE |
| Ho tro 24/7 | Chi goi ENTERPRISE |

---

## 7. Quyen So Huu Du Lieu / Data Ownership

### Your Data, Your Rules / Du Lieu Cua Ban, Quyen Cua Ban

**English:**
- You own 100% of all content created by Sophia
- Videos are published directly to YOUR YouTube/TikTok channel
- API keys are encrypted and stored securely — only YOU can access them
- Our database only stores: your email, subscription tier, campaign settings
- We do NOT store: your videos, scripts, voiceovers, or generated content
- You can delete your account and all data at any time

**Tieng Viet:**
- Ban so huu 100% noi dung do Sophia tao ra
- Video duoc xuat ban truc tiep len kenh YouTube/TikTok CUA BAN
- API keys duoc ma hoa va luu tru an toan — chi BAN moi truy cap duoc
- Database chi luu: email, goi dang ky, cai dat chien dich
- KHONG luu: video, kich ban, giong noi, noi dung da tao
- Ban co the xoa tai khoan va du lieu bat ky luc nao
`;

export default function FAQGuidePage() {
  return <GuideContentRenderer content={content} />;
}
