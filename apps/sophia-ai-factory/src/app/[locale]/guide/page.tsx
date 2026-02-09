import { GuideContentRenderer } from "@/components/guide/guide-content-renderer";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Getting Started — Sophia AI Factory Guide",
  description: "Step-by-step guide to get started with Sophia AI Video Factory",
};

const content = `# Getting Started / Bat Dau Su Dung

> Your first steps with Sophia AI Video Factory
> Huong dan bat dau voi Sophia AI Video Factory

---

## 1. Truy Cap Dashboard / Access Your Dashboard

### Tieng Viet

1. Mo trinh duyet web (Chrome, Safari, Firefox) tren may tinh hoac dien thoai
2. Nhap dia chi website vao thanh dia chi: \`https://sophia.agency\`
3. Nhan nut **"Dang Nhap"** o goc phai tren cung
4. Nhap email va mat khau ban da dang ky
5. Nhan **"Dang Nhap"** de vao Dashboard

> Neu ban chua co tai khoan, nhan **"Dang Ky"** va lam theo huong dan tren man hinh.

### English

1. Open your web browser (Chrome, Safari, Firefox) on computer or phone
2. Type the website address into the address bar: \`https://sophia.agency\`
3. Click the **"Sign In"** button at the top right corner
4. Enter the email and password you registered with
5. Click **"Sign In"** to enter your Dashboard

> If you don't have an account yet, click **"Sign Up"** and follow the on-screen instructions.

---

## 2. Thiet Lap API Keys / Setup Your API Keys

### API Keys la gi? / What are API Keys?

**Tieng Viet:** API Keys giong nhu "chia khoa" de ket noi Sophia voi cac dich vu tao video, giong AI, va tri tue nhan tao. Ban chi can nhap 1 lan duy nhat.

**English:** API Keys are like "keys" that connect Sophia to video creation, AI voice, and artificial intelligence services. You only need to enter them once.

### Buoc 2a: Lay OpenRouter API Key

**Tieng Viet:**

1. Mo tab moi trong trinh duyet
2. Vao trang: \`https://openrouter.ai\`
3. Nhan **"Sign Up"** de tao tai khoan (dung email cua ban)
4. Sau khi dang nhap, nhan vao ten cua ban o goc phai tren
5. Chon **"Keys"** tu menu xo xuong
6. Nhan nut **"Create Key"**
7. Dat ten cho key (vi du: "Sophia")
8. Nhan **"Create"**
9. **Copy key** (bam vao bieu tuong copy ben canh key)
10. Quay lai Sophia Dashboard, dan key vao o **"OpenRouter API Key"**

**English:**

1. Open a new tab in your browser
2. Go to: \`https://openrouter.ai\`
3. Click **"Sign Up"** to create an account (use your email)
4. After logging in, click your name at the top right corner
5. Select **"Keys"** from the dropdown menu
6. Click the **"Create Key"** button
7. Name your key (for example: "Sophia")
8. Click **"Create"**
9. **Copy the key** (click the copy icon next to the key)
10. Go back to Sophia Dashboard, paste the key into the **"OpenRouter API Key"** field

> OpenRouter helps Sophia use artificial intelligence to write video scripts.

### Buoc 2b: Lay ElevenLabs API Key

**Tieng Viet:**

1. Mo tab moi trong trinh duyet
2. Vao trang: \`https://elevenlabs.io\`
3. Nhan **"Sign Up"** de tao tai khoan
4. Sau khi dang nhap, nhan vao **anh dai dien** cua ban o goc phai tren
5. Chon **"Profile + API Key"**
6. Tim dong chu **"API Key"**
7. Nhan **bieu tuong mat** de hien thi key
8. Nhan **"Copy"** de sao chep key
9. Quay lai Sophia Dashboard, dan key vao o **"ElevenLabs API Key"**

**English:**

1. Open a new tab in your browser
2. Go to: \`https://elevenlabs.io\`
3. Click **"Sign Up"** to create an account
4. After logging in, click your **profile picture** at the top right
5. Select **"Profile + API Key"**
6. Find the line that says **"API Key"**
7. Click the **eye icon** to reveal the key
8. Click **"Copy"** to copy the key
9. Go back to Sophia Dashboard, paste the key into the **"ElevenLabs API Key"** field

> ElevenLabs helps Sophia create natural AI voices for your videos.

### Buoc 2c: Lay HeyGen API Key

**Tieng Viet:**

1. Mo tab moi trong trinh duyet
2. Vao trang: \`https://heygen.com\`
3. Nhan **"Sign Up"** de tao tai khoan
4. Sau khi dang nhap, nhan vao **Settings** (bieu tuong banh rang)
5. Chon **"API"** tu menu ben trai
6. Nhan **"Generate API Key"**
7. **Copy key** hien thi tren man hinh
8. Quay lai Sophia Dashboard, dan key vao o **"HeyGen API Key"**

**English:**

1. Open a new tab in your browser
2. Go to: \`https://heygen.com\`
3. Click **"Sign Up"** to create an account
4. After logging in, click **Settings** (gear icon)
5. Select **"API"** from the left menu
6. Click **"Generate API Key"**
7. **Copy the key** displayed on screen
8. Go back to Sophia Dashboard, paste the key into the **"HeyGen API Key"** field

> HeyGen helps Sophia create videos with virtual presenters (AI avatars).

---

## 3. Tao Chien Dich Dau Tien / Create Your First Campaign

### Tieng Viet

1. Trong Dashboard, nhan nut **"+ Tao Chien Dich Moi"** (mau xanh, o giua man hinh)
2. Nhap **Ten Chien Dich** (vi du: "Video gioi thieu san pham thang 2")
3. Chon **Mau Video** (template) tu danh sach co san
4. Nhap **Noi dung chinh** ban muon trinh bay trong video
5. Chon **Giong noi** ban thich (nam/nu, ngon ngu)
6. Nhan **"Tao Chien Dich"**
7. Doi 2-5 phut de Sophia xu ly va tao video

> Video se tu dong duoc luu trong muc **"Chien Dich Cua Toi"** tren Dashboard.

### English

1. In the Dashboard, click the **"+ Create New Campaign"** button (blue button, center of screen)
2. Enter a **Campaign Name** (for example: "February product intro video")
3. Choose a **Video Template** from the available list
4. Enter the **main content** you want to present in the video
5. Select your preferred **Voice** (male/female, language)
6. Click **"Create Campaign"**
7. Wait 2-5 minutes for Sophia to process and create your video

> Your video will be automatically saved under **"My Campaigns"** on your Dashboard.

---

## 4. Xem Va Tai Video / View and Download Your Video

### Tieng Viet

1. Vao muc **"Chien Dich Cua Toi"** tren Dashboard
2. Tim chien dich ban vua tao
3. Khi trang thai hien **"Hoan Thanh"** (mau xanh la), nhan vao ten chien dich
4. Nhan nut **"Xem Video"** de xem truoc
5. Nhan nut **"Tai Xuong"** de luu video ve may tinh
6. Video se duoc luu dang MP4, ban co the dang len YouTube, Facebook, TikTok

### English

1. Go to **"My Campaigns"** on your Dashboard
2. Find the campaign you just created
3. When the status shows **"Completed"** (green), click on the campaign name
4. Click the **"Watch Video"** button to preview
5. Click the **"Download"** button to save the video to your computer
6. The video is saved as MP4 — you can upload it to YouTube, Facebook, TikTok

---

## 5. Can Ho Tro? / Need Help?

### Tieng Viet

- Nhan nut **"Ho Tro"** o goc duoi ben phai Dashboard
- Gui tin nhan qua Telegram bot: \`@Sophia_Bbot\`
- Email: support@sophia.agency
- Xem them: [Cau Hoi Thuong Gap (FAQ)](/guide/faq)

### English

- Click the **"Support"** button at the bottom right of your Dashboard
- Send a message via Telegram bot: \`@Sophia_Bbot\`
- Email: support@sophia.agency
- See also: [Frequently Asked Questions (FAQ)](/guide/faq)

---

## Buoc Tiep Theo / Next Steps

| Tieng Viet | English | Link |
|---|---|---|
| Ket noi Telegram Bot | Connect Telegram Bot | [Telegram Bot Guide](/guide/telegram) |
| Xem hanh trinh nguoi dung | View user journey | [How It Works](/guide/how-it-works) |
| Xem bang gia | View pricing tiers | [Pricing](/pricing) |
`;

export default function GuidePage() {
  return <GuideContentRenderer content={content} />;
}
