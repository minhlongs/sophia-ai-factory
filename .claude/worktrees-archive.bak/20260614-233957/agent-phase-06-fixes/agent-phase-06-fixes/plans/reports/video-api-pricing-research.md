# Video API Pricing Research — Sophia AI Factory
**Date:** 2026-03-28
**Researcher:** Claude Code
**Purpose:** Current pricing & cost breakdown for AI-generated video production

---

## Executive Summary

Producing a 60-second AI-generated video requires orchestrating 4 API services:

| Service | Cost Model | Per Unit | Monthly Base |
|---------|-----------|----------|--------------|
| **HeyGen** | Credits | $0.50–$0.99/min | $99+ (API) |
| **D-ID** | Monthly minutes | $18–$299 | $18–$299 |
| **ElevenLabs** | Per char | $0.06–$0.12/1K chars | $22+ |
| **OpenRouter** | Per token | $3–$5 input / $15–$25 output | Variable |

**Typical 60-second video breakdown: $1.50–$4.00/video** (with subscription amortization).

---

## 1. HEYGEN — Avatar Video Generation API

### Pricing Model

HeyGen uses a **credit-based system** where 1 credit = 1 minute of video (standard avatar).

#### API Plans & Credit Costs

- **Pro Plan**: $0.99 per credit
- **Scale Plan**: $0.50 per credit
- **Minimum API commitment**: $99/month (starting tier)
- **Pay-as-you-go**: Minimum $5 wallet topup
- **Additional credits**: $1.50–$3.00/credit (bulk purchases)

#### Feature-Specific Costs

| Feature | Credits/Min | Cost @ $0.99 | Cost @ $0.50 |
|---------|---------|-----------|-----------|
| Standard Avatar | 1 | $0.99 | $0.50 |
| Avatar IV (Premium) | 6 (per min) | $5.94 | $3.00 |
| Video Translation | 3 (per src min) | $2.97 | $1.50 |
| Video Agent | 2 (per min) | $1.98 | $1.00 |

### Free Tier
- **No free API credits** as of Feb 2026
- Free studio plan available but excludes API access
- Minimum API access requires paid subscription

### Rate Limits
- **Concurrent requests**: Not publicly documented
- **Daily limits**: Dynamic limits apply (escalate to support for higher throughput)
- **Max video duration**: 30 minutes per API call (enterprise: unlimited)
- Users report hitting daily rate limits; batch processing recommended

### Enterprise Discounts
- Custom pricing available for volume commitments
- Dedicated developer support
- Digital Twin Creation API (custom avatars)
- Proofread API for script optimization

---

## 2. D-ID — Talking Head Video API

### Pricing Model

D-ID offers **tier-based subscriptions** with monthly video minute allocation. Minutes are shared between web studio & API usage.

#### API Tiers (2026)

| Tier | Monthly Price | Streaming Video Min | Regular Video Min | Agent Sessions | API Access |
|------|---------------|-------------------|------------------|----------------|-----------|
| Build | $18 | 32 | 16 | 36 (1 agent) | Yes |
| Launch | $50 | ? | ? | Unlimited | Yes |
| Scale | $198 | ? | ? | Unlimited | Yes |
| Enterprise | Custom | Unlimited | Unlimited | Unlimited | Yes |

### Per-Minute Rounding
- Videos are rounded to nearest **15-second interval**
- Example: 1:10 video consumes 1:15 (1.25 minutes)
- 60-second video consumes exactly 60 seconds

### Free Tier
- **14-day free trial**: 3 minutes generation + 1 video translation, no card required
- After trial: lowest tier ($18/month, Build plan)

### Rate Limits
- **Specific limits not publicly documented**
- Must contact D-ID support for throughput specifications
- Rate limit info available in D-ID dev dashboard

### Enterprise Discounts
- Unlimited video minutes
- Custom usage tiers for agents + campaigns
- Advanced security & integrations
- Professional services & dedicated support

---

## 3. ELEVENLABS — Text-to-Speech API

### Pricing Model

Character-based pricing. **No per-request fee**, only character consumption.

#### API Character Pricing

| Model | Cost/1K Chars | Typical 60s Script | Full Cost |
|-------|---------------|------------------|-----------|
| Flash/Turbo v2.5 | $0.06 | 350 chars | $0.021 |
| Multilingual v2/v3 | $0.12 | 350 chars | $0.042 |

**Assumption**: 60-second video script ≈ 350–500 characters (~60 words/min × 6-8 mins narration).

### Free Tier
- **10,000 characters/month** (≈10 min of speech)
- **Max 2,500 characters per request**
- **Restrictions**: No commercial usage rights
- Requires attribution in public content
- Cannot be monetized

### Subscription Plans (Monthly)

| Plan | Characters | Price | Best For |
|------|-----------|-------|----------|
| Free | 10K | $0 | Testing/hobby |
| Starter | 30K | $5 | Light use |
| Creator | 100K | $22 | Content creators |
| Pro | 500K | $99 | Professionals |
| Scale | 2M | $330 | Agencies/high-volume |
| Business | Custom | Enterprise | Custom solutions |

### Concurrent Request Limits

| Tier | Max Concurrent | Rate Per Minute |
|-----|-----------|---------|
| Free | 2 | Low |
| Starter | 3 | Moderate |
| Creator | 5 | Moderate |
| Pro | 10 | High |
| Scale | 15 | High |

### Character Accounting

- 1 character = 1 credit (standard models: v2, v3)
- Flash/Turbo v2.5: 0.5 credit per character (50% discount)
- Voice cloning: Available on Creator tier ($22/month, up to 30 voices)

### Rate Limit Errors
- HTTP 429: Concurrent request limit exceeded
- Retry with exponential backoff
- Contact support for rate limit increases

---

## 4. OPENROUTER — LLM API (Script Generation)

### Pricing Model

Token-based pricing. Pay for **input tokens** (prompt) + **output tokens** (generated script).

#### Claude Models on OpenRouter (2026)

| Model | Input Tokens | Output Tokens | 1K Token Typical Cost |
|-------|---------|-----------|--------|
| **Claude Opus 4.6** | $5/M | $25/M | Script: $0.05–$0.15 |
| **Claude Sonnet 4.6** | $3/M | $15/M | Script: $0.03–$0.10 |
| **Claude Haiku 4.5** | $0.80/M | $4/M | Script: $0.008–$0.02 |

**M = 1 million tokens**

#### GPT Models on OpenRouter (2026)

| Model | Input | Output | Notes |
|-------|-------|--------|-------|
| **GPT-5.4** | $2.50/M | $20/M | Cached input: $0.625/M |
| **GPT-5** | $1.25/M | $10/M | Older, cheaper |

### Typical Script Generation Costs

**Prompt**: ~200–300 tokens (script request + context)
**Generated script** (60-second video): ~400–600 tokens

| Model | Input Cost | Output Cost | Total |
|-------|-----------|-----------|-------|
| Claude Sonnet | $0.0009 | $0.0065 | **$0.0074** |
| Claude Opus | $0.0015 | $0.0150 | **$0.0165** |
| GPT-5 | $0.0003 | $0.0050 | **$0.0053** |

**Per-script cost: < $0.02 for LLM generation**

### Free Tier
- No free tier on OpenRouter
- Pay-as-you-go from first request
- Prepaid credits: 5.5% surcharge on purchased credits

### Volume Discounts & Features

- **Prepayment credits**: No specific discount structure published
- **Volume discounts**: Available for enterprise contracts
- **Annual commits**: Available (contact sales)
- **Cached input**: Claude models support prompt caching at 10% of input price
  - For repeated scripts (same template): cache hit = $0.0008/M (90% savings)

### Rate Limits (OpenRouter)

| Plan | Requests/Day | Tokens/Min | Details |
|------|--------|----------|---------|
| Free | 50 | ? | Very low |
| Pay-as-you-go | "High global" | Varies | Depends on model |
| Enterprise | Unlimited | Custom | Dedicated limits |

**No per-minute request caps** documented for paid plans. Daily limits are soft (escalate if hitting them).

---

## 5. TYPICAL 60-SECOND VIDEO PRODUCTION COST BREAKDOWN

### Scenario: Using Scale-Tier APIs (High Volume)

**Assumptions:**
- 60-second script (400 tokens, ~350 characters)
- Standard avatar (HeyGen) + talking head (D-ID) + ElevenLabs voice
- Monthly subscription cost amortized over video volume

#### Per-Video Cost (Variable)

| Component | Service | Cost | Notes |
|-----------|---------|------|-------|
| **Script Generation** | OpenRouter (Sonnet) | $0.01 | 200 input + 400 output tokens |
| **Avatar Video** | HeyGen Scale | $0.50 | 1 min @ $0.50/credit |
| **Talking Head** | D-ID Build | $1.13 | ~$18/month ÷ 16 min/month |
| **Voice Generation** | ElevenLabs Creator | $0.02 | 350 chars @ $0.06/1K |
| **Subtotal (Variable)** | | **$1.66** | Per-unit production |

#### Monthly Subscription Cost (Fixed)

| Service | Tier | Cost | Utilization |
|---------|------|------|------------|
| HeyGen | Scale API | $99 | Need volume to justify |
| D-ID | Build | $18 | 16 min/month allocation |
| ElevenLabs | Creator | $22 | 100K chars/month |
| **Total Fixed** | | **$139** | Only covers ~8–16 videos |

#### Blended Cost per Video (Including Subscriptions)

**At 10 videos/month**: ($1.66 × 10 + $139) ÷ 10 = **$15.26/video**

**At 100 videos/month**: ($1.66 × 100 + $139) ÷ 100 = **$2.29/video**

**At 1,000 videos/month**: ($1.66 × 1000 + $139) ÷ 1000 = **$1.75/video**

### Scenario: Using Mid-Tier APIs (SMB)

| Component | Service | Cost |
|-----------|---------|------|
| Script | OpenRouter (Haiku) | $0.01 |
| Avatar | HeyGen Pro | $0.99 |
| Talking Head | D-ID Build | $1.13 |
| Voice | ElevenLabs Starter | $0.17 |
| **Variable Total** | | **$2.30** |
| **Subscriptions (10 videos)** | | **($99+18+5)/10 = $12.20** |
| **Blended Cost** | | **$14.50/video** |

### Scenario: Low-Cost Approach (Single Videos)

- Skip D-ID, use HeyGen only (no talking head)
- Use ElevenLabs free tier (non-commercial)
- Use cheapest LLM (Haiku)

| Component | Cost |
|-----------|------|
| Script (Haiku) | $0.008 |
| Avatar (HeyGen Pro pay-as-you-go) | $0.99 |
| Voice (Free tier) | $0 |
| **Total** | **~$1.00/video** |

**Limitation**: Free voice tier = no commercial rights.

---

## 6. COST COMPARISON TABLE — SINGLE 60-SECOND VIDEO

| Approach | Script | Video | Voice | Total |
|----------|--------|-------|-------|-------|
| **Premium** (Opus + HeyGen IV + Multilingual v3) | $0.02 | $5.94 | $0.04 | **$6.00** |
| **Standard** (Sonnet + HeyGen Standard + v2) | $0.01 | $0.99 | $0.02 | **$1.02** |
| **Budget** (Haiku + HeyGen + Flash) | $0.008 | $0.50 | $0.01 | **$0.52** |
| **Free/Non-Commercial** | $0.008 | Pay-per-use | $0 | **$0.51** |

---

## 7. KEY FINDINGS & RECOMMENDATIONS

### ✅ Cost Efficiency Insights

1. **Subscription breakeven**: With HeyGen at $99/month, need 60+ videos to justify (if using Pro at $0.99/min)
2. **Best LLM**: Claude Haiku ($0.008/script) << Sonnet ($0.01) << Opus ($0.02)
3. **Voice bottleneck**: ElevenLabs Creator ($22/month) is mandatory for commercial usage; free tier has licensing restrictions
4. **Video generation**: HeyGen Scale ($0.50/min) = 50% cheaper than HeyGen Pro ($0.99/min)
5. **D-ID vs HeyGen**: D-ID Build ($18/month, 16 min) = $1.13/min vs HeyGen Scale ($0.50/min) — HeyGen cheaper for avatars

### ⚠️ Hidden Costs & Limitations

1. **No free API tiers**: HeyGen killed free API credits (Feb 2026)
2. **Video rounding**: D-ID rounds to nearest 15 seconds (overhead cost)
3. **Commercial licensing**: ElevenLabs free tier cannot be monetized
4. **Rate limits unclear**: HeyGen & D-ID don't publicly document per-second limits; contact support for high throughput
5. **Avatar IV premium**: 6× more expensive than standard avatar; only use if Avatar IV quality required
6. **Translation costly**: HeyGen translation = 3 credits/min (3× more than generation)

### 🎯 Sophia AI Factory Recommendation

For $1M ARR at scale (1000+ videos/month):

| Expense | Qty | Unit | Monthly |
|---------|-----|------|---------|
| HeyGen Scale API | 1000 | $0.50 | $500 |
| D-ID Build | 1000 | $1.13 | $1,130 |
| ElevenLabs Creator | 1000 | $0.02 | $20 |
| OpenRouter (Sonnet) | 1000 | $0.01 | $10 |
| **COGS** | | | **$1,660** |
| **Revenue target** | 1000 × $2 | | **$2,000** |
| **Margin** | | | **17%** |

**Note**: Above assumes $2/video SaaS pricing. Adjust OpenRouter to Haiku for 70% margin targets.

---

## 8. RATE LIMITS SUMMARY

### HeyGen
- **Concurrent requests**: Not documented (contact support)
- **Daily rate limit**: Dynamic, escalate for higher throughput
- **Max duration**: 30 min per call (enterprise: unlimited)
- **Recommended**: Batch requests, 1–2 sec between submissions

### D-ID
- **Rate limits**: Not publicly documented
- **Recommended**: Check dashboard throttle info or contact support
- **Throughput**: Likely 5–10 requests/min for Build tier

### ElevenLabs
- **Concurrent requests**: 5 (Creator tier), 10 (Pro), 15 (Scale)
- **Requests/min**: No explicit cap; limited by concurrent slots
- **Character/sec**: No documented limit (character-based, not time-based)
- **Error 429**: Hit when concurrent limit exceeded; retry with backoff

### OpenRouter
- **Requests/day**: 50 (free, N/A), "high global" (paid)
- **Tokens/min**: No per-model cap documented
- **Soft daily limits**: Available for enterprise only

---

## 9. VOLUME DISCOUNT AVAILABILITY

| Service | Discount Model | How to Access |
|---------|----------------|---------------|
| **HeyGen** | Enterprise pricing | Contact sales (likely 20–30% off at 1K videos/month) |
| **D-ID** | Enterprise custom | Contact sales (likely 30–40% off) |
| **ElevenLabs** | Enterprise tier | Contact sales (custom pricing) |
| **OpenRouter** | Volume discounts, annual commits | Contact sales (not published) |

**None of these publicly document volume discounts.** Negotiate directly with sales at 500+ videos/month scale.

---

## 10. UNRESOLVED QUESTIONS

1. **HeyGen rate limits**: What is the exact requests/min and concurrent request limit per API tier?
2. **D-ID per-minute cost**: What is the exact per-minute calculation for Launch/Scale tiers?
3. **Enterprise discounts**: What % discount do HeyGen/D-ID/ElevenLabs offer at 1K videos/month scale?
4. **OpenRouter volume pricing**: Are there documented tiered discounts for high token volume?
5. **Avatar IV quality justification**: When does 6× cost premium for Avatar IV ROI (e.g., conversion uplift)?
6. **Video translation ROI**: Is D-ID translation (3 credits/min) worth the cost for multi-language expansion?
7. **Cold start latency**: What is the average generation latency for HeyGen (15s? 30s?) and D-ID?

---

## Sources

### HeyGen
- [HeyGen API Pricing](https://www.heygen.com/api-pricing)
- [HeyGen API Pricing Explained | Help Center](https://help.heygen.com/en/articles/10060327-heygen-api-liveavatar-pricing-subscriptions-explained)
- [HeyGen Pricing 2026: Plans, Credits & Hidden Costs | GetAIPerks](https://www.getaiperks.com/en/articles/heygen-pricing)
- [API Limits and Usage Guidelines | HeyGen Docs](https://docs.heygen.com/reference/limits)

### D-ID
- [D-ID API Pricing](https://www.d-id.com/pricing/api/)
- [D-ID Pricing 2026 | G2](https://www.g2.com/products/d-id/pricing)
- [Understanding subscriptions | D-ID Help Center](https://help.d-id.com/hc/en-us/articles/31234293852433-Understanding-subscriptions-key-information-you-should-know)

### ElevenLabs
- [ElevenLabs API Pricing](https://elevenlabs.io/pricing/api)
- [The Complete Guide to ElevenLabs Plans & Usage Pricing in 2026 | Flexprice](https://flexprice.io/blog/elevenlabs-pricing-breakdown)
- [ElevenLabs Pricing (2026): Plans, Credits, Commercial Rights | BIGVU](https://bigvu.tv/blog/elevenlabs-pricing-2026-plans-credits-commercial-rights-api-costs)
- [How many Text to Speech requests can I make? | ElevenLabs Help](https://help.elevenlabs.io/hc/en-us/articles/14312733311761-How-many-Text-to-Speech-requests-can-I-make-and-can-I-increase-it)

### OpenRouter
- [OpenRouter Pricing Calculator & Cost Guide (Mar 2026) | CostGoat](https://costgoat.com/pricing/openrouter)
- [OpenRouter Pricing](https://openrouter.ai/pricing)
- [Claude Opus 4.6 - API Pricing & Providers | OpenRouter](https://openrouter.ai/anthropic/claude-opus-4.6)
- [Claude Sonnet 4.6 - API Pricing & Providers | OpenRouter](https://openrouter.ai/anthropic/claude-sonnet-4.6)

### General Cost Breakdowns
- [What Is & How Much Does AI Video Generation Cost? | LTX Studio](https://ltx.studio/blog/ai-video-generation-cost)
- [AI Video Generator Costs in 2026: Sora vs Veo 3 Pricing | VidPros](https://vidpros.com/breaking-down-the-costs-creating-1-minute-videos-with-ai-tools/)
- [AI Video Generation vs. Traditional Production: Cost Breakdown | vidBoard.ai](https://www.vidboard.ai/ai-video-generation-vs-traditional-costs-2025/)
