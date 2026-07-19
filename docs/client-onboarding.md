# Client Onboarding Guide — Sophia AI Factory

**Welcome to Sophia AI Factory!** This guide helps you get started with your AI video production platform.

**Platform URL:** https://sophia.agencyos.network  
**Support Email:** support@mekongmind.com  
**Telegram Bot:** @Sophia_Bbot

---

## Table of Contents

1. [Quick Start (30-Minute Onboarding)](#quick-start)
2. [Account Setup](#account-setup)
3. [Configure Your API Keys](#configure-your-api-keys)
4. [Choose Your Subscription Tier](#choose-your-subscription-tier)
5. [Complete Platform Setup](#complete-platform-setup)
6. [Create Your First Video](#create-your-first-video)
7. [Understanding the Dashboard](#understanding-the-dashboard)
8. [Using the Telegram Bot](#using-the-telegram-bot)
9. [Billing & Usage Management](#billing--usage-management)
10. [Troubleshooting](#troubleshooting)
11. [Support Resources](#support-resources)

---

## Quick Start (30-Minute Onboarding)

Follow these steps to get your AI video production pipeline running:

| Step | Time | Action |
|------|------|--------|
| **1** | 5 min | Create your account at https://sophia.agencyos.network/signup |
| **2** | 10 min | Add your API keys in Settings (OpenRouter, HeyGen, ElevenLabs) |
| **3** | 5 min | Choose your subscription tier |
| **4** | 10 min | Complete setup wizard and test with your first SOP |

**Total:** ~30 minutes to first video generation capability

---

## Account Setup

### Step 1: Create Your Account

1. Go to https://sophia.agencyos.network/signup
2. Enter your information:
   - **Company name** (your business or agency name)
   - **Email address** (use your business email for important notifications)
   - **Password** (minimum 8 characters, include numbers)
3. Check your email for a verification link
4. Click the verification link to activate your account
5. Log in at https://sophia.agencyos.network/login

### Step 2: Complete Your Profile

After first login, you'll be directed to the setup wizard. Complete your profile:

- Full name
- Phone number (optional but recommended for SMS alerts)
- Company details
- Timezone (for scheduled campaigns)
- Language preference (Tiếng Việt / English)

---

## Configure Your API Keys

Sophia AI Factory uses a **BYOK (Bring Your Own Keys)** model. You provide your own AI service API keys. The platform never stores your keys in a way that allows us to access them.

### Required API Keys

| Service | Purpose | Get Your Key | Cost |
|---------|---------|--------------|------|
| **OpenRouter** | LLM for script generation, prompts | https://openrouter.ai/settings/keys | Pay-as-you-go |
| **HeyGen** | AI avatar video generation | https://app.heygen.com/settings/api | Credits subscription |
| **ElevenLabs** | Voice synthesis | https://elevenlabs.io/app/settings/api-keys | Pay-as-you-go |

### Optional API Keys

| Service | Purpose | Get Your Key |
|---------|---------|--------------|
| **MuAPI** | Additional media generation | https://muapi.ai/ |
| **Resend** | Your own email delivery | https://resend.com/api-keys |

### How to Add API Keys

1. Log in to Sophia AI Factory
2. Go to **Settings** → **API Keys**
3. For each service:
   - Click **Add Key**
   - Paste your API key from the provider's dashboard
   - Click **Test Connection** (green checkmark = success)
   - Click **Save**

**Security Note:** Your API keys are encrypted in your browser session and sent directly to the provider. Sophia's servers never see your raw keys.

---

## Choose Your Subscription Tier

### Tier Comparison

| Feature | **Starter**<br/>BASIC | **Growth**<br/>PREMIUM | **Enterprise**<br/>ENTERPRISE | **Master** |
|---------|----------------------|-----------------------|-----------------------------|------------|
| **Price** | $199/month | $399/month | $799/month | $4,999 one-time |
| **MCU Credits** | Monthly allocation | Monthly allocation | Monthly allocation | Included |
| **Video Generation** | ✅ | ✅ | ✅ | ✅ |
| **API Access** | ❌ | ✅ | ✅ | ✅ |
| **Custom Workflows** | ❌ | Limited | ✅ | ✅ |
| **White-label** | ❌ | ❌ | ❌ | ✅ |
| **Source Code Handover** | ❌ | ❌ | ❌ | ✅ |
| **Priority Support** | ❌ | ✅ | ✅ | ✅ |
| **Best For** | Small businesses<br/>testing AI video | Growing teams<br/>weekly production | Agencies &<br/>enterprises | White-label<br/>partners |

### How to Select Your Tier

1. Go to **Billing** → **Subscription**
2. Click **Change Plan**
3. Select your desired tier
4. Review the pricing and features
5. Click **Subscribe**
6. Complete payment via NOWPayments (USDT crypto) or PayOS (VietQR for Vietnam)

**Payment Methods:**
- **NOWPayments** — USDT cryptocurrency (international)
- **PayOS** — VietQR bank transfer (Vietnam domestic)

---

## Complete Platform Setup

### The Setup Wizard

After adding your API keys, the setup wizard guides you through final configuration:

1. **AI Services Verification**
   - Test OpenRouter connection (script generation)
   - Test HeyGen connection (avatar video)
   - Test ElevenLabs connection (voice synthesis)

2. **Telegram Bot Setup** (optional but recommended)
   - Connect your Telegram account
   - Enable bot notifications
   - Test `/status` command

3. **Billing Configuration**
   - Verify payment method
   - Set up usage alerts
   - Configure renewal reminders

4. **Onboarding Completion**
   - Review your settings
   - Click **Complete Setup**
   - You're ready to create videos!

---

## Create Your First Video

### Method 1: From Template (Recommended for First Time)

1. Go to **Campaigns** → **Create Campaign**
2. Select a template:
   - Product Demo
   - Social Media Ad
   - Training Video
   - Custom template
3. Fill in the template fields:
   - Script content or prompt
   - Target audience
   - Video length (30s, 60s, 90s)
   - Avatar style
   - Voice selection
4. Click **Generate Video**
5. Wait for processing (typically 10-30 minutes)
6. Review and download your video

### Method 2: Using the Telegram Bot

1. Open Telegram and find @Sophia_Bbot
2. Send `/campaign` to start
3. Follow the bot prompts:
   - Enter your script or topic
   - Choose avatar
   - Choose voice
   - Approve generation
4. Bot will notify you when video is ready

### Method 3: SOP Automation (Premium+)

For automated recurring workflows:

1. Go to **SOPs** → **Create SOP**
2. Define your automation:
   - Trigger condition (schedule, webhook, manual)
   - Steps to execute (script → voice → video → publish)
3. Click **Save & Enable**
4. Your SOP will run automatically based on triggers

---

## Understanding the Dashboard

### Main Navigation

| Menu Item | Purpose |
|-----------|---------|
| **Dashboard** | Overview: usage, recent videos, quick stats |
| **Campaigns** | Create and manage video campaigns |
| **SOPs** | Automated workflows (Premium+) |
| **Billing** | Subscription, usage, invoices |
| **Settings** | API keys, profile, notifications |
| **Telegram** | Bot connection and commands |

### Dashboard Widgets

- **MCU Usage** — Monthly credit consumption
- **Videos This Month** — Count of generated videos
- **Active SOPs** — Running automations
- **Recent Videos** — Latest generated videos with status

---

## Using the Telegram Bot

### Available Commands

| Command | Purpose |
|---------|---------|
| `/start` | Welcome message and quick links |
| `/campaign` | Create a new video campaign |
| `/status` | Check current usage and quota |
| `/results` | View recent video results |
| `/help` | Show all available commands |

### Getting Notifications

Enable Telegram notifications to receive:
- Video completion alerts
- Usage warnings (approaching quota)
- Billing reminders
- SOP execution results

To enable: Settings → Integrations → Telegram → Connect

---

## Billing & Usage Management

### Understanding MCU (Months of Compute Unit)

MCU is Sophia's internal usage metric. Different video types consume different amounts:

| Video Type | MCU Cost |
|------------|----------|
| 30s social ad | 1 MCU |
| 60s product demo | 2 MCU |
| 90s training video | 3 MCU |
| Custom avatar | +1 MCU |

Your monthly subscription includes a base MCU allocation. Overage is billed at your tier rate.

### Viewing Your Usage

1. Go to **Billing** → **Usage**
2. View charts:
   - MCU consumed this month
   - Videos generated by day
   - Cost projection

### Downloading Invoices

1. Go to **Billing** → **Invoices**
2. Click **Download** next to any invoice
3. Invoices are PDF with VAT 10% for Vietnam customers

### Upgrading/Downgrading

1. Go to **Billing** → **Subscription**
2. Click **Change Plan**
3. Select new tier
4. Confirm changes

**Note:** Upgrades take effect immediately. Downgrades apply at next billing cycle.

---

## Troubleshooting

### Common Issues

#### "API Key Invalid" Error

**Cause:** Key expired or incorrectly entered

**Fix:**
1. Go to Settings → API Keys
2. Delete the problematic key
3. Get a fresh key from the provider's dashboard
4. Paste and test connection
5. Retry your video generation

#### "Quota Exceeded" Error

**Cause:** MCU limit reached for the month

**Fix:**
1. Check usage at Billing → Usage
2. Wait for monthly reset (1st of month) OR
3. Upgrade to higher tier for more MCU
4. Contact support for emergency quota increase (Enterprise only)

#### "Video Generation Failed"

**Common causes:**
- HeyGen API error (check HeyGen dashboard for quota)
- Script too long for selected video duration
- Network timeout

**Fix:**
1. Check the error details in Campaigns → Failed
2. Simplify script or extend video duration
3. Verify HeyGen balance in HeyGen dashboard
4. Retry the campaign

#### "Telegram Bot Not Responding"

**Cause:** Bot not connected or token invalid

**Fix:**
1. Go to Settings → Integrations → Telegram
2. Reconnect with `/start` in Telegram
3. Verify bot token is valid
4. Test with `/status` command

---

## Support Resources

### Self-Service

| Resource | URL |
|----------|-----|
| FAQ (English) | https://sophia.agencyos.network/en/guide/faq |
| FAQ (Tiếng Việt) | https://sophia.agencyos.network/vi/guide/faq |
| User Guide | https://sophia.agencyos.network/docs |
| Video Tutorials | https://sophia.agencyos.network/guides |

### Contact Support

| Channel | Response Time |
|---------|---------------|
| **Email** support@mekongmind.com | Within 24 hours |
| **Telegram** @Sophia_Bbot | Immediate (automated) |
| **Admin Dashboard** /dashboard/admin/handover | Scheduled calls |

### Emergency Support (Enterprise+)

Enterprise and Master tier customers receive:
- Priority email support (4-hour SLA)
- Optional scheduled video onboarding
- Direct WhatsApp support (during business hours)

---

## Best Practices

### For First-Time Users

1. **Start with a short script** (30-second video) to verify everything works
2. **Test each API key** individually in Settings before creating campaigns
3. **Monitor your MCU usage** daily to avoid overage surprises
4. **Save SOPs** once they work — reuse for similar content

### For Agencies

1. **Create separate accounts** for each client (better isolation)
2. **Use SOPs** to standardize client deliverables
3. **Export invoices** monthly for client billing
4. **Master tier** for white-label: source code handover included

### For High-Volume Users

1. **Batch campaigns** — schedule multiple videos at once
2. **Use SOP automation** to reduce manual effort
3. **Monitor webhook logs** at Settings → Integrations
4. **Contact us** about volume discounts (100+ videos/month)

---

## What's Next?

After completing your first video:

1. **Share your feedback** — help us improve
2. **Explore SOPs** — automate repetitive workflows
3. **Invite team members** — collaborate on campaigns
4. **Check the guides** — learn advanced features

---

## Need Help?

- **Read the FAQ:** https://sophia.agencyos.network/vi/guide/faq
- **Email Support:** support@mekongmind.com
- **Telegram Bot:** @Sophia_Bbot (send `/help`)
- **Schedule a Call:** Available for Enterprise+ customers

---

*Sophia AI Factory — Your AI Video Production Partner*  
*Platform Version: v2.0 | Last Updated: 2026-06-20*
