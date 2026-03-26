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

### Step 2: Add API Keys (Settings > API Keys)

| Key | Where to get | Purpose |
|-----|-------------|---------|
| ANTHROPIC_API_KEY | https://console.anthropic.com/settings/keys | AI proposal generation |
| RESEND_API_KEY | https://resend.com/api-keys | Email delivery |
| HEYGEN_API_KEY | https://app.heygen.com/settings/api | Video proposal generation (optional) |

### Step 3: Choose Subscription Tier

| Tier | Price | MCU/month | Best For |
|------|-------|-----------|----------|
| Starter | $49/mo | 500 MCU | Solo consultants |
| Growth | $149/mo | 2,000 MCU | Small agencies |
| Premium | $499/mo | 10,000 MCU | Mid-size agencies |
| Master | $999/mo | 25,000 MCU | Enterprise teams |

Payment via Polar.sh (credit card, no PayPal).

### Step 4: Start Using

Available AI commands:
- `proposal:create` — Generate client proposals (10-50 MCU)
- `lead:generate` — Find and score leads (varies)
- `email:send` — Outreach sequence delivery (1 MCU)
- `content:write` — Blog/social content (50 MCU)
- `sales:battlecard` — Competitive intelligence (25 MCU)

## Architecture (Zero Client Data Storage)

```
Client Browser → CF Workers (sophia.agencyos.network)
                    ↓
              D1 Database (account metadata, usage tracking)
                    ↓
         Client's own API keys → External services
         (Anthropic, Resend, HeyGen)
```

- Platform stores: account info, usage metrics, subscription status
- Platform does NOT store: client API keys (encrypted in browser session only), generated content, client data
- All AI processing uses client's own API keys
- MCU credits track usage, not data

## Support

- API Status: https://sophia.agencyos.network/status
- Documentation: https://sophia.agencyos.network/docs
- Email: support@agencyos.network

## Billing Management

Clients manage subscriptions at: https://sophia.agencyos.network/billing
- View MCU balance and usage
- Upgrade/downgrade tier
- Download invoices
- Cancel subscription
