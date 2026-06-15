# Sophia AI Factory — Client Handover SOP

## Platform Access

| Item | Value |
|------|-------|
| Production URL | https://sophia.agencyos.network |
| Landing Page | https://sophia.agencyos.network/landing |
| Sign Up | https://sophia.agencyos.network/signup |
| Login | https://sophia.agencyos.network/login |
| API Health | https://sophia.agencyos.network/api/health |
| API Docs | https://sophia.agencyos.network/docs/api |

## Client Self-Service Setup

Platform does NOT store any client secrets. Clients manage their own keys.

### Step 1: Create Account
1. Go to https://sophia.agencyos.network/signup
2. Enter company name, email, password
3. Verify email

### Step 2: Add Provider Keys (Settings > API Keys)

| Key | Where to get | Purpose |
|-----|-------------|---------|
| OPENROUTER_API_KEY | https://openrouter.ai/settings/keys | Script, prompt, and workflow generation |
| HEYGEN_API_KEY | https://app.heygen.com/settings/api | Avatar video generation |
| ELEVENLABS_API_KEY | https://elevenlabs.io/app/settings/api-keys | Voice generation |
| MUAPI_API_KEY | https://muapi.ai/ | Optional media generation provider |
| RESEND_API_KEY | https://resend.com/api-keys | Optional client-owned email delivery |

### Step 3: Choose Subscription Tier

| Tier | Price | MCU/month | Best For |
|------|-------|-----------|----------|
| Starter (BASIC) | $199/mo | Usage tracked by dashboard | Small businesses testing AI video |
| Growth (PREMIUM) | $399/mo | Usage tracked by dashboard | Growing teams producing video weekly |
| Premium (ENTERPRISE) | $799/mo | Usage tracked by dashboard | Agencies and enterprises needing API access |
| Master | $4,999 one-time | Usage tracked by deployment | White-label/source-code handover |

Payment via NOWPayments (crypto/USDT) and PayOS (VietQR/bank transfer for Vietnam). Do not use Polar or PayPal for Sophia customer billing.

### Step 4: Start Using

Core workflows:
- Create video campaign from prompt or template
- Generate script, voice, avatar video, and captions
- Review usage, quota, billing, and export history in dashboard
- Publish or download generated videos
- Use Telegram Bot for guided video creation

## Architecture (Zero Client Data Storage)

```
Client Browser → CF Workers (sophia.agencyos.network)
                    ↓
              D1 Database (account metadata, usage tracking)
                    ↓
         Client's own API keys -> External services
         (OpenRouter, HeyGen, ElevenLabs, MuAPI, Resend)
```

- Platform stores: account info, usage metrics, subscription status
- Platform does NOT store: client API keys (encrypted in browser session only), generated content, client data
- All AI processing uses client's own API keys
- MCU credits track usage, not data

## Support

- API Status: https://sophia.agencyos.network/status
- Documentation: https://sophia.agencyos.network/docs
- Email: support@mekongmind.com
- Telegram: @Sophia_Bbot

## Billing Management

Clients manage subscriptions at: https://sophia.agencyos.network/billing
- View usage, quota, and billing status
- Upgrade/downgrade tier
- Download invoices
- Cancel subscription
