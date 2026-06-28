# HN Show — Sophia AI Factory

> **Title (≤80 chars):** Show HN: Sophia AI Factory — AI video pipeline w/ USDT crypto payouts
>
> **URL:** https://sophia.agencyos.network
>
> **Category:** Show

---

## Body (~600 words)

Hi HN,

I'm shipping **Sophia AI Factory** — an end-to-end AI video pipeline built for affiliate creators in markets where Stripe/PayPal coverage is patchy. The trick: crypto-native payouts (USDT, instant) with Stripe Connect as an opt-in fiat path. Built on Cloudflare Workers + D1 + OpenNext.

### What it does

You write a prompt ("5 ChatGPT tips for solo creators"), and we generate a finished video: script via OpenRouter LLMs → voice via ElevenLabs (or Coqui XTTS for the open-source path) → composition via Remotion clean-room → publish to TikTok / YouTube / Telegram. The creator can BYOK their own OpenRouter / ElevenLabs / D-ID keys, or use ours metered against their tier.

### Why I built it

I kept hearing the same complaint from creators in SE Asia: "tools assume Stripe + US bank. We can't even sign up." So Sophia treats USDT (TRC20 / ERC20) as a first-class payout method via NOWPayments — instant, no KYC, no $10K/year IRS reporting drag for international affiliates. Stripe Connect is there for US creators who want fiat 1099-ready payouts.

### Stack notes

- **Edge runtime:** Cloudflare Workers via `@opennextjs/cloudflare` adapter — Next.js 16 App Router, React 19. Deployed via `wrangler deploy` directly (we abandoned GitHub Actions after a free-tier quota incident).
- **Database:** D1 (SQLite at the edge). 104 migrations, no Postgres anywhere. The "sync `createServerClient()`" returns a Drizzle-style query builder over D1 — no top-level await mess.
- **Auth:** Better Auth with magic links + sessions in D1. We deliberately picked it over NextAuth/Clerk for crypto-friendly self-host.
- **Payments:** NOWPayments (USDT primary), PayOS (VN domestic), Stripe Connect (US fiat affiliate payouts). NO Polar, NO PayPal — both rejected for product reasons documented in our CLAUDE.md.
- **Observability:** Sentry (free-tier-tuned: 2% client traces, 5% server, 1% replays), uptime cron pings `/api/health` every 5 min and pages me on Telegram if the latency exceeds 5s. Public status page at `/status` reads from the same D1 incident table.
- **Layer architecture:** seed (foundational types/utils) → tree (domain primitives) → forest (orchestration) → land (business workflows). Cross-layer rules enforced by grep + naming convention. ~800 source files.

### What's surprising

1. **D1 is fast enough.** Spike load to 500 concurrent VUs kept p95 < 500ms across 5 routes. We were terrified migrating off Supabase but the edge proximity wins.
2. **Affiliate referral on a free tier is a stable acquisition channel.** ~30% recurring commission, USDT payouts at $50 minimum — converts SE Asia bloggers who'd otherwise have no path.
3. **CF-direct deploy is faster than GitHub Actions.** ~90s vs 4-7 min CI. We don't miss the green checkmark culture.

### What's coming

- Phase 06: Multi-region Coqui TTS via Fly.io for sub-200ms warm voice gen.
- Phase 07: 20+ video templates + Zapier app for workflow automation.
- Phase 08: First contractor support hire (currently solo + bus factor 1).

### What I'd love feedback on

- Is the USDT-first stance too niche, or does it open doors I'm underestimating?
- Better Auth vs Clerk for crypto-friendly self-host — anyone shipped at scale on either?
- Would a public "RaaS / crypto-native creator stack" template repo (auth + payments + email + observability) be useful?

Happy to answer anything technical. Code questions in particular — the layered architecture has been the single biggest delta in keeping refactor velocity.

— [@founder] | https://sophia.agencyos.network

---

## Tags

`Show HN` `AI` `Video` `Cloudflare Workers` `Crypto Payouts` `Next.js`

---

## Notes for posting

- Best window: Tue–Thu 6–9 AM PT (peak traffic on HN)
- Founder responds to top 10 comments within 30 min — drives engagement
- DO NOT auto-upvote / vote-ring — HN detects and shadow-bans
- Have status page warm + Sentry green before posting
