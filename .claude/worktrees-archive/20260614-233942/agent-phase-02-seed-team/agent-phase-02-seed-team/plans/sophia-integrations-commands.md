# 🔗 Platform Integration Guides + Telegram Command Reference

## OBJECTIVE

Enhance the in-app guide with:

1. Platform integration guides (with embedded YouTube tutorials from vendors)
2. Telegram bot command reference page
3. Data ownership section in FAQ
4. Sophia "Cookbook" — mapping user actions to slash commands

## PHASE 1: Create /guide/integrations Page

Create `src/app/[locale]/guide/integrations/page.tsx`:

### Content Structure:

```
# Platform Integration Guides

Sophia connects to these services. Each guide below helps you set up in under 5 minutes.

---

## 🧠 OpenRouter — AI Brain
What: Powers Sophia's script writing and AI intelligence
Pricing: Free tier available, pay-per-use after
Setup Time: 2 minutes

### Video Tutorial
[Embed YouTube: "How to Use OpenRouter API Free LLM Models, Pricing, API Key & Postman REST API Tutorial"]
YouTube URL: https://www.youtube.com/watch?v=VIDEO_ID (search and find the actual 2026 video)

### Step-by-Step Setup
1. Go to openrouter.ai
2. Click "Sign Up" (use your email)
3. After login, click your name → "Keys"
4. Click "Create Key" → name it "Sophia"
5. Copy the key → paste in Sophia Settings → API Keys → OpenRouter

---

## 🎭 HeyGen — AI Avatar Creator
What: Creates realistic AI avatars that present your videos
Pricing: Free trial, paid plans from $29/month
Setup Time: 3 minutes

### Video Tutorial
[Embed YouTube: "HeyGen 101: Getting Started with AI Video Creation" (May 2025)]
YouTube URL: https://www.youtube.com/watch?v=VIDEO_ID

### Step-by-Step Setup
1. Go to heygen.com
2. Click "Start Free Trial"
3. After login, go to Settings → API
4. Copy your API key
5. Paste in Sophia Settings → API Keys → HeyGen

---

## 🗣️ ElevenLabs — AI Voice
What: Creates natural-sounding voiceovers for your videos
Pricing: Free tier (10,000 characters/month), paid from $5/month
Setup Time: 2 minutes

### Video Tutorial
[Embed YouTube: "How To Use Eleven Labs API"]
YouTube URL: https://www.youtube.com/watch?v=VIDEO_ID

### Step-by-Step Setup
1. Go to elevenlabs.io
2. Click "Sign Up" (free)
3. After login, click your profile → "Profile + API key"
4. Copy the API key
5. Paste in Sophia Settings → API Keys → ElevenLabs

---

## 📺 YouTube Data API — Publishing Channel
What: Allows Sophia to publish videos directly to your YouTube channel
Pricing: Free (Google quota limits apply)
Setup Time: 5 minutes

### Step-by-Step Setup
1. Go to console.cloud.google.com
2. Create a new project (name it "Sophia")
3. Enable "YouTube Data API v3"
4. Go to Credentials → Create OAuth 2.0 Client ID
5. Copy Client ID + Secret
6. Paste in Sophia Settings → API Keys → YouTube
```

### YouTube Embed Component

Create a reusable YouTube embed component:

```tsx
// src/components/guide/youtube-embed.tsx
function YouTubeEmbed({ videoId, title }: { videoId: string; title: string }) {
  return (
    <div className="aspect-video rounded-xl overflow-hidden border border-white/10">
      <iframe
        src={`https://www.youtube.com/embed/${videoId}`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="w-full h-full"
      />
    </div>
  );
}
```

### Important: Search & Use Actual YouTube Video IDs

Search YouTube for these EXACT videos and use their real video IDs:

- OpenRouter: search "OpenRouter API tutorial 2025 2026 getting started"
- HeyGen: search "HeyGen 101 getting started AI video 2025"
- ElevenLabs: search "ElevenLabs API tutorial getting started"

Use the REAL video IDs from YouTube. Do NOT use placeholder IDs.

## PHASE 2: Create /guide/commands Page (Telegram Cookbook)

Create `src/app/[locale]/guide/commands/page.tsx`:

### Content:

```
# 🤖 Telegram Bot Commands / Lệnh Bot Telegram

Sophia has a Telegram bot that lets you manage everything from your phone.
Bot: @Sophia_Bbot

---

## Quick Start / Bắt Đầu Nhanh

1. Open Telegram
2. Search for @Sophia_Bbot (or use this link: t.me/Sophia_Bbot)
3. Press "Start"
4. Link your email: /email your@email.com

---

## Available Commands / Danh Sách Lệnh

| Command | What It Does | Example |
|---------|-------------|---------|
| /start | Welcome message + setup | /start |
| /email | Link your Sophia account | /email john@example.com |
| /campaign | Create a new video campaign | /campaign Eco-friendly gadgets review |
| /status | Check your active campaigns | /status |
| /results | Get links to completed videos | /results |
| /help | Show all available commands | /help |

---

## How To Create a Video via Telegram / Tạo Video Qua Telegram

Step 1: Make sure your account is linked (/email)
Step 2: Type /campaign followed by your video topic
Step 3: Sophia will write the script, create voice, generate avatar video
Step 4: Type /status to check progress
Step 5: Type /results to get the YouTube link when done

That's it! 🎉

---

## Pro Tips / Mẹo Hay

- Be specific with topics: "/campaign Top 5 wireless earbuds under $50 review" is better than "/campaign earbuds"
- Check status regularly: campaigns take 5-10 minutes to complete
- All your data belongs to YOU — videos are published directly to YOUR YouTube channel
```

## PHASE 3: Add Data Ownership to FAQ

Add this section to the FAQ guide page (or create a separate section):

```
## 🔐 Data Ownership / Quyền Sở Hữu Dữ Liệu

### Your Data, Your Rules / Dữ Liệu Của Bạn, Quyền Của Bạn

**English:**
- You own 100% of all content created by Sophia
- Videos are published directly to YOUR YouTube/TikTok channel
- API keys are encrypted and stored securely — only YOU can access them
- Our database only stores: your email, subscription tier, campaign settings
- We do NOT store: your videos, scripts, voiceovers, or generated content
- You can delete your account and all data at any time

**Tiếng Việt:**
- Bạn sở hữu 100% nội dung do Sophia tạo ra
- Video được xuất bản trực tiếp lên kênh YouTube/TikTok CỦA BẠN
- API keys được mã hóa và lưu trữ an toàn — chỉ BẠN mới truy cập được
- Database chỉ lưu: email, gói đăng ký, cài đặt chiến dịch
- KHÔNG lưu: video, kịch bản, giọng nói, nội dung đã tạo
- Bạn có thể xóa tài khoản và dữ liệu bất kỳ lúc nào
```

## PHASE 4: Update Guide Sidebar

Update the guide layout sidebar to include new pages:

- Getting Started (existing)
- How It Works (existing)
- All Screens (existing)
- **🔗 Integrations** (NEW)
- **🤖 Commands** (NEW)
- FAQ (existing — add data ownership)
- Telegram (existing)

## PHASE 5: Build + Test + Ship

1. `npx next build` — MUST PASS
2. `npx vitest run` — ALL tests pass
3. Git commit: `feat(guide): platform integration guides + telegram commands + data ownership`
4. Git push to main

## QUALITY GATE

| #   | Criterion                            | Required |
| --- | ------------------------------------ | -------- |
| 1   | /guide/integrations page renders     | ✅       |
| 2   | YouTube embeds work (real video IDs) | ✅       |
| 3   | /guide/commands page renders         | ✅       |
| 4   | Data ownership in FAQ                | ✅       |
| 5   | Sidebar updated with new links       | ✅       |
| 6   | Build passes                         | ✅       |
| 7   | All tests pass                       | ✅       |
| 8   | Committed & pushed                   | ✅       |
