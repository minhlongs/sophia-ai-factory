# Telegram Bot Guide / Huong Dan Su Dung Telegram Bot

> Control your campaigns from your phone with @Sophia_Bbot
> Dieu khien chien dich tu dien thoai voi @Sophia_Bbot

---

## 1. Cai Dat Telegram / Install Telegram

### Tieng Viet

1. Mo **App Store** (iPhone) hoac **Google Play** (Android) tren dien thoai
2. Tim kiem **"Telegram"**
3. Nhan **"Cai Dat"** (Install)
4. Mo ung dung Telegram sau khi cai xong
5. Dang ky tai khoan bang so dien thoai cua ban
6. Nhap ma xac nhan gui qua tin nhan SMS

> Neu ban da co Telegram, bo qua buoc nay va chuyen sang buoc 2.

### English

1. Open **App Store** (iPhone) or **Google Play** (Android) on your phone
2. Search for **"Telegram"**
3. Tap **"Install"**
4. Open the Telegram app after installation
5. Register an account with your phone number
6. Enter the verification code sent via SMS

> If you already have Telegram, skip this step and go to step 2.

---

## 2. Ket Noi Voi @Sophia_Bbot / Connect to @Sophia_Bbot

### Tieng Viet

1. Mo Telegram tren dien thoai
2. Nhan vao **bieu tuong kinh lup** (tim kiem) o goc phai tren
3. Nhap: `@Sophia_Bbot`
4. Nhan vao ket qua **"Sophia Bbot"** (co bieu tuong bot)
5. Nhan nut **"START"** (hoac **"BAT DAU"**) o cuoi man hinh
6. Bot se gui tin nhan chao mung ban
7. Nhap lenh: `/link`
8. Bot se hoi email cua ban — nhap email ban dung de dang ky Sophia
9. Bot gui ma xac nhan 6 so ve email ban
10. Nhap ma xac nhan vao Telegram
11. Hien thong bao **"Ket noi thanh cong!"** — ban da san sang!

### English

1. Open Telegram on your phone
2. Tap the **search icon** (magnifying glass) at the top right
3. Type: `@Sophia_Bbot`
4. Tap on the result **"Sophia Bbot"** (with bot icon)
5. Tap the **"START"** button at the bottom of the screen
6. The bot will send you a welcome message
7. Type the command: `/link`
8. The bot will ask for your email — enter the email you used to register with Sophia
9. The bot sends a 6-digit verification code to your email
10. Enter the verification code in Telegram
11. You'll see **"Connected successfully!"** — you're ready!

---

## 3. Cac Lenh Bot / Bot Commands

### /campaign — Tao Chien Dich Moi / Create New Campaign

**Tieng Viet:**

1. Mo cuoc tro chuyen voi `@Sophia_Bbot`
2. Nhap: `/campaign`
3. Bot hoi: **"Ten chien dich la gi?"** — nhap ten (vi du: "Video thang 3")
4. Bot hoi: **"Chon mau video"** — chon tu danh sach (nhan so tuong ung)
5. Bot hoi: **"Noi dung chinh?"** — nhap noi dung ban muon noi trong video
6. Bot hoi: **"Giong noi nao?"** — chon giong nam hoac nu
7. Bot xac nhan: **"Dang tao chien dich..."**
8. Doi 2-5 phut, bot gui thong bao khi video hoan thanh

**English:**

1. Open your chat with `@Sophia_Bbot`
2. Type: `/campaign`
3. Bot asks: **"What's the campaign name?"** — enter a name (e.g., "March video")
4. Bot asks: **"Choose a video template"** — select from the list (tap the corresponding number)
5. Bot asks: **"Main content?"** — enter the content you want in the video
6. Bot asks: **"Which voice?"** — choose male or female voice
7. Bot confirms: **"Creating campaign..."**
8. Wait 2-5 minutes, the bot will notify you when the video is ready

---

### /status — Kiem Tra Trang Thai / Check Campaign Status

**Tieng Viet:**

1. Nhap: `/status`
2. Bot hien danh sach tat ca chien dich cua ban
3. Moi chien dich hien thi:
   - Ten chien dich
   - Trang thai: **"Dang xu ly"** (vang), **"Hoan thanh"** (xanh la), **"Loi"** (do)
   - Thoi gian tao

**English:**

1. Type: `/status`
2. The bot shows a list of all your campaigns
3. Each campaign displays:
   - Campaign name
   - Status: **"Processing"** (yellow), **"Completed"** (green), **"Error"** (red)
   - Creation time

---

### /results — Xem Ket Qua / View Results

**Tieng Viet:**

1. Nhap: `/results`
2. Bot hien danh sach cac chien dich da hoan thanh
3. Nhan vao ten chien dich de xem chi tiet
4. Bot gui link tai video truc tiep ve dien thoai
5. Nhan vao link de tai video dang MP4

**English:**

1. Type: `/results`
2. The bot shows a list of completed campaigns
3. Tap on a campaign name to see details
4. The bot sends a direct download link for the video
5. Tap the link to download the MP4 video

---

### /start — Bat Dau Chien Dich / Start a Campaign

**Tieng Viet:**

1. Nhap: `/start`
2. Bot hien danh sach cac chien dich dang **tam dung**
3. Chon chien dich ban muon chay lai (nhan so tuong ung)
4. Bot xac nhan: **"Chien dich dang duoc khoi dong lai..."**
5. Chien dich se tiep tuc xu ly tu cho dang dung

**English:**

1. Type: `/start`
2. The bot shows a list of **paused** campaigns
3. Select the campaign you want to resume (tap the corresponding number)
4. Bot confirms: **"Campaign is being restarted..."**
5. The campaign will continue processing from where it stopped

---

### /stop — Dung Chien Dich / Stop a Campaign

**Tieng Viet:**

1. Nhap: `/stop`
2. Bot hien danh sach cac chien dich dang **chay**
3. Chon chien dich ban muon dung (nhan so tuong ung)
4. Bot hoi xac nhan: **"Ban chac chan muon dung?"** — nhan **"Co"**
5. Bot xac nhan: **"Chien dich da duoc tam dung"**

> Chien dich tam dung co the khoi dong lai bat ky luc nao bang lenh `/start`.

**English:**

1. Type: `/stop`
2. The bot shows a list of **running** campaigns
3. Select the campaign you want to stop (tap the corresponding number)
4. Bot asks for confirmation: **"Are you sure you want to stop?"** — tap **"Yes"**
5. Bot confirms: **"Campaign has been paused"**

> Paused campaigns can be restarted anytime with the `/start` command.

---

### /help — Xem Tro Giup / View Help

**Tieng Viet:**

1. Nhap: `/help`
2. Bot hien danh sach tat ca cac lenh co san
3. Moi lenh kem mo ta ngan gon

**English:**

1. Type: `/help`
2. The bot shows a list of all available commands
3. Each command includes a short description

---

## 4. Bang Tom Tat Lenh / Command Summary Table

| Lenh / Command | Chuc nang / Function | Vi du / Example |
|---|---|---|
| `/link` | Ket noi tai khoan / Link your account | `/link` |
| `/campaign` | Tao chien dich moi / Create new campaign | `/campaign` |
| `/status` | Kiem tra trang thai / Check status | `/status` |
| `/results` | Xem ket qua / View results | `/results` |
| `/start` | Bat dau chien dich / Start campaign | `/start` |
| `/stop` | Dung chien dich / Stop campaign | `/stop` |
| `/help` | Xem tro giup / View help | `/help` |

---

## 5. Meo Su Dung / Tips

### Tieng Viet

- Ban co the gui lenh **bat ky luc nao**, 24/7 — bot hoat dong lien tuc
- Khi video hoan thanh, bot **tu dong gui thong bao** — ban khong can tu kiem tra
- Neu bot khong tra loi trong 30 giay, thu nhap lai lenh
- Moi lenh bat dau bang dau `/` (gach cheo)

### English

- You can send commands **anytime**, 24/7 — the bot runs continuously
- When a video is completed, the bot **automatically sends a notification** — no need to check manually
- If the bot doesn't respond within 30 seconds, try typing the command again
- Every command starts with `/` (forward slash)

---

## 6. Can Ho Tro? / Need Help?

| Tieng Viet | English |
|---|---|
| Gui `/help` trong Telegram | Type `/help` in Telegram |
| Xem [Cau Hoi Thuong Gap](./faq.md) | See [FAQ](./faq.md) |
| Xem [Xu Ly Su Co](./troubleshooting.md) | See [Troubleshooting](./troubleshooting.md) |
| Email: support@sophia.agency | Email: support@sophia.agency |
