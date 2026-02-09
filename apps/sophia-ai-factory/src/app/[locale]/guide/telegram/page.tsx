import { GuideContentRenderer } from "@/components/guide/guide-content-renderer";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Telegram Bot — Sophia AI Factory Guide",
  description: "How to use @Sophia_Bbot Telegram bot for video creation",
};

const content = `# Telegram Bot Guide / Huong Dan Telegram Bot

> Control your campaigns from your phone with @Sophia_Bbot
> Dieu khien chien dich tu dien thoai voi @Sophia_Bbot

---

## 1. Cai Dat Telegram / Install Telegram

### Tieng Viet

1. Mo **App Store** (iPhone) hoac **Google Play** (Android)
2. Tim kiem **"Telegram"**
3. Nhan **"Cai Dat"** (Install)
4. Mo ung dung Telegram sau khi cai xong
5. Dang ky tai khoan bang so dien thoai

> Neu ban da co Telegram, bo qua buoc nay.

### English

1. Open **App Store** (iPhone) or **Google Play** (Android)
2. Search for **"Telegram"**
3. Tap **"Install"**
4. Open the Telegram app after installation
5. Register an account with your phone number

> If you already have Telegram, skip to step 2.

---

## 2. Ket Noi Voi @Sophia_Bbot / Connect to @Sophia_Bbot

### Tieng Viet

1. Mo Telegram tren dien thoai
2. Nhan vao **bieu tuong kinh lup** (tim kiem) o goc phai tren
3. Nhap: \`@Sophia_Bbot\`
4. Nhan vao ket qua **"Sophia Bbot"** (co bieu tuong bot)
5. Nhan nut **"START"**
6. Bot se gui tin nhan chao mung ban
7. Nhap lenh: \`/link\`
8. Bot se hoi email — nhap email ban dung de dang ky Sophia
9. Bot gui ma xac nhan 6 so ve email ban
10. Nhap ma xac nhan vao Telegram
11. **"Ket noi thanh cong!"** — ban da san sang!

### English

1. Open Telegram on your phone
2. Tap the **search icon** at the top right
3. Type: \`@Sophia_Bbot\`
4. Tap on **"Sophia Bbot"** (with bot icon)
5. Tap the **"START"** button
6. The bot will send you a welcome message
7. Type: \`/link\`
8. Enter your Sophia email when prompted
9. Enter the 6-digit verification code sent to your email
10. **"Connected successfully!"** — you're ready!

---

## 3. Cac Lenh Bot / Bot Commands

### /campaign — Tao Video Moi / Create New Video

**Tieng Viet:**
1. Nhap: \`/campaign\`
2. Bot hoi ten chien dich — nhap ten
3. Bot hoi chon mau video — chon tu danh sach
4. Bot hoi noi dung chinh — nhap noi dung
5. Bot hoi giong noi — chon nam hoac nu
6. Doi 2-5 phut, bot thong bao khi xong

**English:**
1. Type: \`/campaign\`
2. Enter campaign name when asked
3. Choose a video template from the list
4. Enter the main content for the video
5. Choose male or female voice
6. Wait 2-5 minutes for notification

---

### /status — Kiem Tra Trang Thai / Check Status

Nhap \`/status\` de xem trang thai tat ca chien dich. / Type \`/status\` to see all campaign statuses.

Trang thai / Status:
- **Dang xu ly / Processing** (vang/yellow)
- **Hoan thanh / Completed** (xanh/green)
- **Loi / Error** (do/red)

---

### /results — Xem Ket Qua / View & Download

Nhap \`/results\` de tai video hoan thanh. / Type \`/results\` to download completed videos.

---

### /start va /stop — Bat Dau va Dung / Start and Stop

- \`/start\` — Tiep tuc chien dich da tam dung / Resume paused campaign
- \`/stop\` — Tam dung chien dich dang chay / Pause running campaign

---

### /help — Xem Tro Giup / View Help

Nhap \`/help\` de xem tat ca lenh co san. / Type \`/help\` to see all commands.

---

## 4. Bang Tom Tat / Command Summary

| Lenh / Command | Chuc nang / Function |
|---|---|
| \`/link\` | Ket noi tai khoan / Link account |
| \`/campaign\` | Tao video moi / Create video |
| \`/status\` | Kiem tra trang thai / Check status |
| \`/results\` | Xem ket qua / View results |
| \`/start\` | Tiep tuc / Resume campaign |
| \`/stop\` | Tam dung / Pause campaign |
| \`/help\` | Tro giup / Help |

---

## 5. Meo Su Dung / Tips

- Ban co the gui lenh **bat ky luc nao**, 24/7
- Khi video xong, bot **tu dong gui thong bao**
- Neu bot khong tra loi trong 30 giay, thu nhap lai lenh
- Moi lenh bat dau bang dau \`/\`

---

## Can Ho Tro? / Need Help?

| Kenh / Channel | Lien he / Contact |
|---|---|
| Telegram | \`/help\` trong @Sophia_Bbot |
| Email | support@sophia.agency |
| FAQ | [Cau hoi thuong gap](/guide/faq) |
| Getting Started | [Bat dau su dung](/guide) |
`;

export default function TelegramGuidePage() {
  return <GuideContentRenderer content={content} />;
}
