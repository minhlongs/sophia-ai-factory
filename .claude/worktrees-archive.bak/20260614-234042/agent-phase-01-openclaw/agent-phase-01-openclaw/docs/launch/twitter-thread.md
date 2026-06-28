# Twitter Launch Thread — Sophia AI Factory

> Schedule via Buffer/Typefully. Each tweet ≤ 270 chars (leaves room for embeds).
> UTM tag every link: `?utm_source=twitter&utm_campaign=launch&utm_medium=organic`.

---

## Thread (10 tweets)

### 1/10 — Hook

> 9 months building. Today shipping Sophia AI Factory.
>
> An AI video pipeline for affiliate creators who don't have access to Stripe / US bank accounts.
>
> Prompt → publish-ready video in 5 minutes. USDT payouts (instant) or fiat via Stripe Connect.
>
> 🧵

### 2/10 — Problem

> Every creator tool I tried assumed:
> - You're in the US
> - You have a Stripe-eligible bank account
> - Your audience pays in $
>
> 80% of creators globally don't fit this. Sophia inverts it — USDT-first, fiat optional.

### 3/10 — Stack reveal

> Stack:
> - Next.js 16 + React 19
> - Cloudflare Workers (via OpenNext)
> - D1 (SQLite at edge — 104 migrations)
> - Better Auth (magic-link, no NextAuth)
> - NOWPayments USDT + Stripe Connect fiat
>
> No Postgres. No EC2. No surprise bills.

### 4/10 — Edge fast

> Spike-tested 500 concurrent VUs against prod.
>
> p95 latency stayed under 500ms across 5 routes.
>
> D1 + Workers is fast enough. We were scared moving off Supabase. Shouldn't have been.

### 5/10 — Affiliate angle

> 30% recurring commission. Not just first sale.
>
> USDT instant payout at $50 minimum. No KYC. No 1099 nightmare for international creators.
>
> Stripe Connect Express opt-in for US creators who want fiat / 1099-ready.

### 6/10 — What it does

> Workflow:
> 1. Prompt: "5 ChatGPT tips for solo creators"
> 2. We generate script (OpenRouter LLM)
> 3. Voice (ElevenLabs or Coqui XTTS)
> 4. Compose (Remotion clean-room)
> 5. Publish (TikTok / YouTube / Telegram)
>
> 5 minutes. Done.

### 7/10 — BYOK

> Bring Your Own Key supported.
>
> Plug in your OpenRouter / ElevenLabs / D-ID accounts. We meter against your tier but don't markup.
>
> Or use our pooled keys. Your call.

### 8/10 — Observability flex

> Things that ship with day-1 production:
> - Sentry tuned for free tier (2% client traces, 5% server)
> - Uptime cron every 5 min → Telegram alerts
> - Public status page at /status
> - 2K+ tests, 90-day uptime grid
>
> No "trust us" — verify at sophia.agencyos.network/status

### 9/10 — What's next

> Roadmap (publicly tracked in /docs/roadmap):
> - Phase 06: Multi-region voice (Fly.io) + GPU video (Runpod)
> - Phase 07: 20+ templates + Zapier integration
> - Phase 08: First contractor hire
>
> 9 months solo. 14 phases shipped. Reading every reply.

### 10/10 — CTA + thanks

> Try it free: sophia.agencyos.network
> Affiliate program (30% recurring): sophia.agencyos.network/affiliate
> HN Show post: [link after going live]
>
> RTs hugely appreciated. Replies even more — building publicly means I read everything.
>
> 🙏 — solo dev → indie creator
