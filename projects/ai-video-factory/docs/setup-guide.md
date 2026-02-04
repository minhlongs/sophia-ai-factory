# AI Video Factory - Setup Guide

## Prerequisites

Before starting, ensure you have:

- [ ] Node.js 18+ installed
- [ ] n8n account (cloud or self-hosted)
- [ ] OpenClaw installed ([docs.openclaw.ai](https://docs.openclaw.ai))
- [ ] Telegram Bot Token (from @BotFather)
- [ ] API keys for AI services (see below)

---

## Step 1: Clone & Configure

```bash
# Navigate to project
cd /Users/macbookprom1/mekong-cli/projects/ai-video-factory

# Copy env template
cp .env.example .env

# Edit with your API keys
nano .env
```

---

## Step 2: Get API Keys

### Required APIs

| Service          | Get Key                                                    | Cost     | Priority    |
| ---------------- | ---------------------------------------------------------- | -------- | ----------- |
| **OpenAI**       | [platform.openai.com](https://platform.openai.com)         | $20/mo   | ⭐ Required |
| **ElevenLabs**   | [elevenlabs.io](https://elevenlabs.io)                     | $22/mo   | ⭐ Required |
| **D-ID**         | [d-id.com](https://d-id.com)                               | $4.70/mo | ⭐ Required |
| **Airtable**     | [airtable.com/developers](https://airtable.com/developers) | Free     | ⭐ Required |
| **Cloudinary**   | [cloudinary.com](https://cloudinary.com)                   | Free     | ⭐ Required |
| **Telegram Bot** | [@BotFather](https://t.me/botfather)                       | Free     | ⭐ Required |

### Optional APIs (Scale tier)

| Service         | Get Key                                                      | Cost   |
| --------------- | ------------------------------------------------------------ | ------ |
| **HeyGen**      | [heygen.com](https://heygen.com)                             | $8/mo  |
| **Pictory**     | [pictory.ai](https://pictory.ai)                             | $23/mo |
| **Bitly**       | [bitly.com](https://bitly.com)                               | Free   |
| **YouTube API** | [console.cloud.google.com](https://console.cloud.google.com) | Free   |

---

## Step 3: Setup Telegram Bot

1. Open Telegram, search for `@BotFather`
2. Send `/newbot`
3. Name your bot (e.g., "Sophia Video Factory")
4. Copy the token to `.env` as `OPENCLAW_TELEGRAM_BOT_TOKEN`
5. Get your chat ID:
   - Send a message to your bot
   - Visit `https://api.telegram.org/bot<TOKEN>/getUpdates`
   - Find your `chat.id`
   - Add to `.env` as `TELEGRAM_CHAT_ID`

---

## Step 4: Setup Airtable

### Create Base Structure

1. Create new Airtable base: "AI Video Factory"
2. Create tables:

#### Table: Scripts

| Field        | Type                                             |
| ------------ | ------------------------------------------------ |
| Product      | Single line text                                 |
| Topic        | Single line text                                 |
| Template     | Single select                                    |
| Script       | Long text                                        |
| Status       | Single select (Draft, Generated, Approved, Used) |
| Generated_At | Date                                             |

#### Table: Videos

| Field        | Type                                          |
| ------------ | --------------------------------------------- |
| Script       | Link to Scripts                               |
| Product      | Lookup                                        |
| Video_Style  | Single select (avatar, broll, screen)         |
| Audio_URL    | URL                                           |
| Video_URL    | URL                                           |
| Status       | Single select (In Progress, Ready, Published) |
| Platforms    | Multiple select                               |
| Generated_At | Date                                          |
| Published_At | Date                                          |

#### Table: Affiliates

| Field          | Type             |
| -------------- | ---------------- |
| Product        | Single line text |
| Affiliate_Link | URL              |
| Commission     | Percent          |
| Clicks         | Number           |
| Conversions    | Number           |
| Revenue        | Currency         |

3. Copy Base ID from URL (starts with `app`)
4. Create API key at [airtable.com/account](https://airtable.com/account)
5. Add both to `.env`

---

## Step 5: Setup n8n

### Option A: n8n Cloud (Recommended for beginners)

1. Sign up at [n8n.io](https://n8n.io)
2. Create new workflow
3. Import workflows from `/workflows/` folder
4. Set credentials for each service
5. Copy webhook URL to `.env`

### Option B: Self-hosted

```bash
# Install n8n
npm install -g n8n

# Start n8n
n8n start

# Access at http://localhost:5678
```

### Import Workflows

1. Go to n8n dashboard
2. Click "Import from file"
3. Import each file from `/workflows/`:
   - `script_generator.json`
   - `video_generator.json`
4. Configure credentials for each node
5. Activate workflows

---

## Step 6: Setup OpenClaw

### Install OpenClaw

```bash
# Mac
brew install openclaw/tap/openclaw

# Or manual
curl -fsSL https://get.openclaw.ai | sh
```

### Configure Gateway

```bash
# Start setup wizard
openclaw wizard

# Follow prompts to connect:
# - Telegram bot
# - Model provider (OpenAI/Anthropic)
# - n8n webhook URL
```

### Install Video Factory Skill

```bash
# Copy skill to OpenClaw skills folder
cp scripts/openclaw-skills/video-factory.yaml ~/.openclaw/skills/

# Reload skills
openclaw skills reload
```

---

## Step 7: Setup Cloud Storage (Cloudinary)

1. Sign up at [cloudinary.com](https://cloudinary.com)
2. Go to Dashboard
3. Copy Cloud Name, API Key, API Secret
4. Add to `.env`
5. Create upload preset:
   - Settings → Upload → Add upload preset
   - Name: `ai_video_factory`
   - Signing Mode: Unsigned
   - Folder: `videos`

---

## Step 8: Test the Pipeline

### Test 1: Script Generation

Send to Telegram bot:

```
/script Review of CoinLedger for crypto tax
```

Expected: Script appears in Airtable, notification sent back.

### Test 2: Video Generation

Send to Telegram bot:

```
/video coinledger avatar
```

Expected: Full pipeline runs, video preview sent back.

### Test 3: Analytics

Send to Telegram bot:

```
/stats
/revenue
```

Expected: Summary of channel and revenue stats.

---

## Troubleshooting

### Common Issues

| Issue                   | Solution                                 |
| ----------------------- | ---------------------------------------- |
| "Product not found"     | Check `affiliates.json` for product ID   |
| n8n webhook failed      | Check n8n is running, workflow is active |
| D-ID timeout            | Check credits, API key permissions       |
| Telegram not responding | Verify bot token, check OpenClaw logs    |

### Logs

```bash
# OpenClaw logs
openclaw logs -f

# n8n logs (self-hosted)
n8n logs

# Check env vars
openclaw config show
```

---

## Next Steps

After setup:

1. [ ] Create YouTube channels (3 niches)
2. [ ] Register affiliate programs (top 5)
3. [ ] Clone your voice on ElevenLabs
4. [ ] Produce first 10 videos
5. [ ] Monitor analytics weekly

---

## Support

- OpenClaw Docs: [docs.openclaw.ai](https://docs.openclaw.ai)
- n8n Docs: [docs.n8n.io](https://docs.n8n.io)
- Issues: Create in project repository
