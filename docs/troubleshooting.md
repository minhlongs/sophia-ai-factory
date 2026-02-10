# Troubleshooting / Xu Ly Su Co

> Fix common issues quickly with step-by-step instructions
> Xu ly cac su co thuong gap nhanh chong voi huong dan tung buoc

---

## Muc Luc / Table of Contents

1. [Dashboard khong tai duoc / Dashboard not loading](#1-dashboard-khong-tai-duoc--dashboard-not-loading)
2. [Chien dich bi loi / Campaign failed](#2-chien-dich-bi-loi--campaign-failed)
3. [Bot khong tra loi / Bot not responding](#3-bot-khong-tra-loi--bot-not-responding)
4. [Video bi timeout / Video generation timeout](#4-video-bi-timeout--video-generation-timeout)
5. [Khong dang nhap duoc / Cannot log in](#5-khong-dang-nhap-duoc--cannot-log-in)
6. [API Key bi loi / API Key errors](#6-api-key-bi-loi--api-key-errors)
7. [Video khong co am thanh / Video has no audio](#7-video-khong-co-am-thanh--video-has-no-audio)
8. [Khong nhan duoc email / Not receiving emails](#8-khong-nhan-duoc-email--not-receiving-emails)
9. [Thanh toan that bai / Payment failed](#9-thanh-toan-that-bai--payment-failed)
10. [Chien dich bi ket / Campaign stuck](#10-chien-dich-bi-ket--campaign-stuck)

---

## 1. Dashboard khong tai duoc / Dashboard not loading

### Trieu chung / Symptoms

- Trang web hien mau trang hoac den / Page shows blank white or black screen
- Vong xoay tai lien tuc / Loading spinner keeps spinning
- Thong bao loi "Khong the ket noi" / Error message "Cannot connect"

### Nguyen nhan / Cause

- Dia chi web sai / Wrong website address
- Internet khong on dinh / Unstable internet connection
- Trinh duyet cu / Outdated browser
- Bo nho cache bi loi / Corrupted browser cache

### Cach khac phuc / How to fix

**Tieng Viet:**

1. Kiem tra dia chi web: dam bao ban nhap dung `https://sophia.agencyos.network`
2. Kiem tra ket noi internet: thu mo 1 trang web khac (vi du: google.com)
3. Lam moi trang: nhan **Ctrl + Shift + R** (Windows) hoac **Cmd + Shift + R** (Mac)
4. Xoa cache trinh duyet:
   - Chrome: Nhan 3 cham goc phai > Settings > Privacy > Clear browsing data
   - Safari: Safari menu > Clear History
5. Thu su dung trinh duyet khac (Chrome, Firefox, Safari)
6. Neu van khong duoc, doi 5 phut roi thu lai

**English:**

1. Check the web address: make sure you typed `https://sophia.agencyos.network` correctly
2. Check your internet: try opening another website (e.g., google.com)
3. Hard refresh the page: press **Ctrl + Shift + R** (Windows) or **Cmd + Shift + R** (Mac)
4. Clear browser cache:
   - Chrome: Click 3 dots at top right > Settings > Privacy > Clear browsing data
   - Safari: Safari menu > Clear History
5. Try a different browser (Chrome, Firefox, Safari)
6. If still not working, wait 5 minutes and try again

---

## 2. Chien dich bi loi / Campaign failed

### Trieu chung / Symptoms

- Trang thai chien dich hien **"Loi"** (mau do) / Campaign status shows **"Error"** (red)
- Thong bao loi xuat hien / Error message appears
- Video khong duoc tao / Video not generated

### Nguyen nhan / Cause

- API Key het han hoac sai / API Key expired or incorrect
- Het han muc su dung API / API usage limit reached
- Noi dung khong hop le / Invalid content
- Loi ket noi tam thoi / Temporary connection issue

### Cach khac phuc / How to fix

**Tieng Viet:**

1. Nhan vao **ten chien dich** de xem chi tiet loi
2. Doc thong bao loi:
   - Neu ghi "API Key invalid" -> kiem tra lai API key trong Settings
   - Neu ghi "Quota exceeded" -> nap them tien vao tai khoan OpenRouter/ElevenLabs/HeyGen
   - Neu ghi "Content error" -> chinh sua noi dung va thu lai
3. Nhan nut **"Chay Lai"** (Retry) ben canh chien dich
4. Doi 2-5 phut de he thong xu ly lai
5. Neu van loi, tao chien dich moi voi cung noi dung

**English:**

1. Click on the **campaign name** to see error details
2. Read the error message:
   - If it says "API Key invalid" -> check your API key in Settings
   - If it says "Quota exceeded" -> add more credits to your OpenRouter/ElevenLabs/HeyGen account
   - If it says "Content error" -> edit the content and try again
3. Click the **"Retry"** button next to the campaign
4. Wait 2-5 minutes for the system to reprocess
5. If still failing, create a new campaign with the same content

---

## 3. Bot khong tra loi / Bot not responding

### Trieu chung / Symptoms

- Gui lenh nhung bot khong phan hoi / Sent a command but bot doesn't reply
- Bot gui tin nhan loi / Bot sends error messages
- Lenh khong duoc nhan dang / Command not recognized

### Nguyen nhan / Cause

- Sai ten bot / Wrong bot name
- Chua nhan Start / Haven't tapped Start
- Bot dang bao tri / Bot is under maintenance
- Ket noi internet yeu / Weak internet connection

### Cach khac phuc / How to fix

**Tieng Viet:**

1. Dam bao ban dang nhan tin voi dung bot: `@Sophia_Bbot`
   - Chu "B" phai viet hoa
   - Kiem tra bieu tuong bot (co hinh robot) ben canh ten
2. Neu chua bao gio su dung bot, nhan nut **"START"** o cuoi man hinh
3. Thu gui lenh `/help` truoc — neu bot tra loi thi bot dang hoat dong binh thuong
4. Kiem tra lenh cua ban bat dau bang dau `/` (gach cheo):
   - Dung: `/status`
   - Sai: `status` (thieu dau `/`)
5. Doi 30 giay roi thu lai lenh
6. Thoat hoan toan Telegram va mo lai:
   - iPhone: Vuot len tu duoi man hinh, vuot Telegram di
   - Android: Nhan nut vuong, vuot Telegram di
7. Neu van khong duoc sau 5 phut, bot co the dang bao tri — thu lai sau 30 phut

**English:**

1. Make sure you're messaging the correct bot: `@Sophia_Bbot`
   - The letter "B" must be capitalized
   - Check for the bot icon (robot) next to the name
2. If you've never used the bot before, tap the **"START"** button at the bottom
3. Try sending `/help` first — if the bot replies, it's working normally
4. Check that your command starts with `/` (forward slash):
   - Correct: `/status`
   - Wrong: `status` (missing `/`)
5. Wait 30 seconds and try the command again
6. Completely close Telegram and reopen it:
   - iPhone: Swipe up from bottom, swipe Telegram away
   - Android: Tap the square button, swipe Telegram away
7. If still not working after 5 minutes, the bot may be under maintenance — try again in 30 minutes

---

## 4. Video bi timeout / Video generation timeout

### Trieu chung / Symptoms

- Chien dich o trang thai "Dang xu ly" qua lau (hon 15 phut) / Campaign "Processing" for too long (over 15 minutes)
- Thong bao "Timeout" hoac "Het thoi gian" / "Timeout" or "Time expired" message
- Video chi tao duoc 1 phan / Video only partially created

### Nguyen nhan / Cause

- Dich vu HeyGen dang qua tai / HeyGen service is overloaded
- Video qua dai (hon 10 phut) / Video too long (over 10 minutes)
- Loi mang giua Sophia va HeyGen / Network issue between Sophia and HeyGen

### Cach khac phuc / How to fix

**Tieng Viet:**

1. Doi them 10 phut — doi khi HeyGen can nhieu thoi gian hon de xu ly
2. Nhan **"Lam Moi"** (Refresh) trang Dashboard de cap nhat trang thai
3. Neu trang thai van la "Dang xu ly" sau 20 phut:
   - Nhan nut **"Chay Lai"** (Retry) ben canh chien dich
4. Neu van bi timeout:
   - Thu chia noi dung thanh video ngan hon (duoi 3 phut)
   - Tao chien dich moi voi noi dung ngan gon hon
5. Kiem tra trang thai HeyGen: vao `https://status.heygen.com` xem dich vu co dang bi su co khong
6. Neu HeyGen dang bi su co, doi den khi ho khac phuc xong roi thu lai

**English:**

1. Wait 10 more minutes — sometimes HeyGen needs extra time to process
2. Click **"Refresh"** on the Dashboard to update the status
3. If still "Processing" after 20 minutes:
   - Click the **"Retry"** button next to the campaign
4. If still timing out:
   - Try splitting content into shorter videos (under 3 minutes)
   - Create a new campaign with shorter content
5. Check HeyGen status: visit `https://status.heygen.com` to see if the service is having issues
6. If HeyGen is having issues, wait until they resolve it and try again

---

## 5. Khong dang nhap duoc / Cannot log in

### Trieu chung / Symptoms

- Thong bao "Email hoac mat khau sai" / "Email or password incorrect" message
- Nhan dang nhap nhung khong co gi xay ra / Click sign in but nothing happens
- Bi chuyen ve trang dang nhap / Redirected back to login page

### Nguyen nhan / Cause

- Sai email hoac mat khau / Wrong email or password
- Tai khoan chua duoc kich hoat / Account not activated yet
- Phien dang nhap het han / Session expired

### Cach khac phuc / How to fix

**Tieng Viet:**

1. Kiem tra ban nhap dung email (chu y viet hoa/thuong, khoang trang)
2. Kiem tra mat khau (bat Caps Lock hay chua?)
3. Thu nhan **"Quen Mat Khau"** de dat lai mat khau:
   - Nhap email cua ban
   - Kiem tra hop thu (ca muc Spam/Junk)
   - Nhan link trong email
   - Dat mat khau moi
4. Neu chua nhan duoc email kich hoat tai khoan:
   - Kiem tra muc Spam/Junk
   - Nhan **"Gui Lai Email Xac Nhan"** (Resend verification)
5. Xoa cookie trinh duyet va thu lai
6. Thu dang nhap bang trinh duyet khac

**English:**

1. Check you entered the correct email (watch for uppercase/lowercase, spaces)
2. Check your password (is Caps Lock on?)
3. Try clicking **"Forgot Password"** to reset:
   - Enter your email
   - Check your inbox (including Spam/Junk folder)
   - Click the link in the email
   - Set a new password
4. If you haven't received the account activation email:
   - Check Spam/Junk folder
   - Click **"Resend Verification Email"**
5. Clear browser cookies and try again
6. Try logging in with a different browser

---

## 6. API Key bi loi / API Key errors

### Trieu chung / Symptoms

- Thong bao "Invalid API Key" khi tao chien dich / "Invalid API Key" when creating campaign
- Thong bao "Authentication failed" / "Authentication failed" message
- Chien dich loi ngay khi bat dau / Campaign fails immediately

### Nguyen nhan / Cause

- API Key nhap sai (thieu ky tu, thua khoang trang) / Incorrectly entered API Key (missing characters, extra spaces)
- API Key da bi vo hieu hoa / API Key has been deactivated
- Het han muc mien phi / Free tier limit reached

### Cach khac phuc / How to fix

**Tieng Viet:**

1. Vao **Dashboard > Settings > API Keys**
2. Kiem tra tung key:
   - Xoa key cu
   - Vao trang web cua dich vu (OpenRouter, ElevenLabs, HeyGen)
   - Tao key moi
   - Copy **CHUA CHINH XAC** (khong them khoang trang truoc/sau)
   - Dan key moi vao Dashboard
3. Nhan **"Luu"** (Save)
4. Thu tao chien dich moi de kiem tra
5. Neu van loi, kiem tra tai khoan dich vu:
   - OpenRouter: Vao `openrouter.ai` > Dashboard > kiem tra so du (credits)
   - ElevenLabs: Vao `elevenlabs.io` > Profile > kiem tra han muc (quota)
   - HeyGen: Vao `heygen.com` > Settings > kiem tra goi dich vu

**English:**

1. Go to **Dashboard > Settings > API Keys**
2. Check each key:
   - Delete the old key
   - Go to the service website (OpenRouter, ElevenLabs, HeyGen)
   - Create a new key
   - Copy it **EXACTLY** (no extra spaces before/after)
   - Paste the new key into Dashboard
3. Click **"Save"**
4. Try creating a new campaign to test
5. If still failing, check your service accounts:
   - OpenRouter: Go to `openrouter.ai` > Dashboard > check credits balance
   - ElevenLabs: Go to `elevenlabs.io` > Profile > check quota
   - HeyGen: Go to `heygen.com` > Settings > check your plan

---

## 7. Video khong co am thanh / Video has no audio

### Trieu chung / Symptoms

- Video chay nhung khong co tieng / Video plays but has no sound
- Am thanh bi re, nhieu / Audio is choppy or noisy
- Giong noi khong khop voi noi dung / Voice doesn't match content

### Nguyen nhan / Cause

- ElevenLabs API Key het han muc / ElevenLabs API quota depleted
- Giong noi chon khong ho tro ngon ngu / Selected voice doesn't support the language
- Loi trong qua trinh tao giong noi / Error during voice generation

### Cach khac phuc / How to fix

**Tieng Viet:**

1. Kiem tra API Key ElevenLabs:
   - Vao `elevenlabs.io` > Profile > kiem tra han muc con lai
   - Neu het han muc, nap them hoac nang cap goi
2. Kiem tra giong noi:
   - Chon giong noi ho tro ngon ngu ban dang su dung
   - Giong tieng Viet: chon cac giong co nhan "Vietnamese"
   - Giong tieng Anh: chon cac giong co nhan "English"
3. Tao chien dich moi voi giong noi khac
4. Neu am thanh bi re: kiem tra ket noi internet cua ban va thu lai

**English:**

1. Check your ElevenLabs API Key:
   - Go to `elevenlabs.io` > Profile > check remaining quota
   - If quota is depleted, add credits or upgrade your plan
2. Check voice selection:
   - Choose a voice that supports the language you're using
   - Vietnamese voice: select voices labeled "Vietnamese"
   - English voice: select voices labeled "English"
3. Create a new campaign with a different voice
4. If audio is choppy: check your internet connection and try again

---

## 8. Khong nhan duoc email / Not receiving emails

### Trieu chung / Symptoms

- Khong nhan duoc email xac nhan dang ky / No registration confirmation email
- Khong nhan duoc email dat lai mat khau / No password reset email
- Khong nhan duoc hoa don / No invoice emails

### Nguyen nhan / Cause

- Email bi vao muc Spam/Junk / Email went to Spam/Junk folder
- Sai dia chi email / Wrong email address
- Bo loc email chan thu tu Sophia / Email filters blocking Sophia emails

### Cach khac phuc / How to fix

**Tieng Viet:**

1. Kiem tra muc **Spam** hoac **Junk** trong hop thu email cua ban
2. Tim email tu dia chi: `noreply@sophia.agency`
3. Neu tim thay trong Spam:
   - Nhan **"Khong phai spam"** (Not spam) de chuyen ve hop thu chinh
   - Them `sophia.agency` vao danh sach an toan (whitelist)
4. Neu khong tim thay:
   - Kiem tra ban da nhap dung dia chi email
   - Thu dang ky lai voi email khac
5. Doi 10 phut — doi khi email can thoi gian de gui

**English:**

1. Check the **Spam** or **Junk** folder in your email inbox
2. Look for emails from: `noreply@sophia.agency`
3. If found in Spam:
   - Click **"Not spam"** to move it to your inbox
   - Add `sophia.agency` to your safe senders list (whitelist)
4. If not found:
   - Check you entered the correct email address
   - Try registering again with a different email
5. Wait 10 minutes — sometimes emails take time to deliver

---

## 9. Thanh toan that bai / Payment failed

### Trieu chung / Symptoms

- Thong bao "Thanh toan that bai" / "Payment failed" message
- The bi tu choi / Card declined
- Khong the nang cap goi / Cannot upgrade plan

### Nguyen nhan / Cause

- The het han hoac khong du so du / Card expired or insufficient funds
- Ngan hang chan giao dich quoc te / Bank blocking international transactions
- Thong tin the nhap sai / Incorrect card information

### Cach khac phuc / How to fix

**Tieng Viet:**

1. Kiem tra thong tin the:
   - So the nhap dung
   - Ngay het han chua qua
   - Ma CVV (3 so mat sau the) nhap dung
2. Kiem tra so du tai khoan ngan hang
3. Goi ngan hang de:
   - Mo giao dich quoc te (international transactions)
   - Mo giao dich truc tuyen (online transactions)
4. Thu the tin dung khac (Visa hoac Mastercard)
5. Neu van khong duoc, lien he support@sophia.agency de duoc ho tro phuong thuc thanh toan khac

**English:**

1. Check your card details:
   - Card number is correct
   - Expiration date hasn't passed
   - CVV code (3 digits on card back) is correct
2. Check your bank account balance
3. Call your bank to:
   - Enable international transactions
   - Enable online transactions
4. Try a different credit card (Visa or Mastercard)
5. If still not working, contact support@sophia.agency for alternative payment methods

---

## 10. Chien dich bi ket / Campaign stuck

### Trieu chung / Symptoms

- Chien dich o trang thai "Dang xu ly" qua 30 phut / Campaign "Processing" for over 30 minutes
- Thanh tien trinh khong di chuyen / Progress bar not moving
- Khong co thong bao loi / No error message

### Nguyen nhan / Cause

- Hang doi xu ly video qua dai / Video processing queue is long
- Dich vu AI tam thoi qua tai / AI service temporarily overloaded
- Loi ket noi ngam / Silent connection error

### Cach khac phuc / How to fix

**Tieng Viet:**

1. Doi them 10 phut va nhan **"Lam Moi"** (Refresh)
2. Neu van ket sau 30 phut:
   - Nhan nut **"Chay Lai"** (Retry) ben canh chien dich
3. Neu Retry khong hoat dong:
   - Nhan nut **"Huy"** (Cancel) chien dich cu
   - Tao **chien dich moi** voi cung noi dung
4. Neu van bi ket:
   - Kiem tra trang thai dich vu: `https://status.heygen.com`
   - Thu lai sau 1 gio
5. Neu van khong duoc sau nhieu lan thu:
   - Gui `/help` qua Telegram @Sophia_Bbot
   - Gui email support@sophia.agency kem ten chien dich bi ket

**English:**

1. Wait 10 more minutes and click **"Refresh"**
2. If still stuck after 30 minutes:
   - Click the **"Retry"** button next to the campaign
3. If Retry doesn't work:
   - Click the **"Cancel"** button on the old campaign
   - Create a **new campaign** with the same content
4. If still stuck:
   - Check service status: `https://status.heygen.com`
   - Try again after 1 hour
5. If still not working after multiple attempts:
   - Send `/help` via Telegram @Sophia_Bbot
   - Email support@sophia.agency with the stuck campaign name

---

## Lien He Ho Tro Nhanh / Quick Support Contacts

| Phuong thuc / Method | Chi tiet / Details | Thoi gian / Availability |
|---|---|---|
| Telegram Bot | @Sophia_Bbot (`/help`) | 24/7 (tu dong / automatic) |
| Email | support@sophia.agency | Tra loi trong 24h / Reply within 24h |
| Ho tro uu tien / Priority | Goi PREMIUM+ / PREMIUM+ plans | Tra loi trong 4h / Reply within 4h |
| Hotline 24/7 | Chi goi ENTERPRISE / ENTERPRISE only | 24/7 |

---

## Meo Chung / General Tips

### Tieng Viet

- Luon **lam moi trang** (Refresh) truoc khi bao loi
- **Chup man hinh** loi de gui cho doi ho tro
- Ghi lai **thoi gian** xay ra loi
- Kiem tra **trang thai dich vu** truoc khi bao loi: `https://status.heygen.com`
- Giu trinh duyet **cap nhat phien ban moi nhat**

### English

- Always **refresh the page** before reporting an issue
- **Take a screenshot** of the error to send to support
- Note the **time** when the error occurred
- Check **service status** before reporting: `https://status.heygen.com`
- Keep your browser **updated to the latest version**
