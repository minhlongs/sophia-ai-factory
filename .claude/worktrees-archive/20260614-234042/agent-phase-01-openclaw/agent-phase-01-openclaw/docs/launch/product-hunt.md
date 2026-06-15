# Product Hunt — Sophia AI Factory

> **Launch URL:** https://www.producthunt.com/posts/sophia-ai-factory
>
> **Founder:** [@founder]
> **Category:** Artificial Intelligence / Marketing / Productivity

---

## 30-word tagline

> AI video pipeline for affiliate creators — prompt to TikTok-ready in 5 minutes. USDT or fiat payouts. Built on Cloudflare Workers + D1.

## 60-character title

`Sophia AI Factory — AI Video + Affiliate Engine`

## 3-paragraph description

**For creators who get paid in countries Stripe forgot.**

Sophia AI Factory turns a prompt into a publish-ready video in under 5 minutes. Pick a topic, choose a voice, and we'll write the script, generate the voiceover, compose the visuals (Remotion clean-room), and queue it for TikTok / YouTube / Telegram. Use our pooled API keys metered against your tier, or BYOK your own OpenRouter / ElevenLabs / D-ID accounts.

**Built for the actual creator economy — not just SF and NYC.** Affiliates earn 30% recurring commission, paid out in USDT (instant, $50 minimum, no KYC) or fiat USD via Stripe Connect (with KYC). Most affiliate platforms force ACH-only payouts to US bank accounts, which excludes 80% of creators globally. Sophia inverts that: crypto first, fiat as opt-in.

**Edge-first stack, no servers, no surprise bills.** Next.js 16 deployed direct to Cloudflare Workers. D1 SQLite at the edge with 104 production migrations. Better Auth for magic-link login. Sentry tuned for free-tier observability. Public uptime status at /status. We deploy via `wrangler` CLI — we abandoned GitHub Actions and never looked back.

## Maker comment (first comment, pinned)

> Hi PH! Solo founder here. Sophia started because every "AI creator tool" I tried assumed I had a Stripe Connect-eligible bank account. Most of my friends in Vietnam, Indonesia, the Philippines — they don't. So we built around USDT-first payouts.
>
> Tech stack notes for the curious:
> - Next.js 16 + React 19 on Cloudflare Workers via OpenNext
> - D1 (SQLite at edge) — yes, really, no Postgres
> - Better Auth (not NextAuth, not Clerk)
> - NOWPayments for USDT, Stripe Connect Express for US fiat creators
> - Remotion clean-room for video composition
>
> Happy to answer anything. Especially curious if anyone's shipped Better Auth + D1 at scale.

## 5 screenshots (placeholder list — generate via Playwright headless)

1. **Hero shot** — prompt textarea + tier picker + "Generate" CTA
2. **Live generation** — SSE event log during video render (script → voice → compose)
3. **Affiliate dashboard** — earnings chart + referral link + USDT/fiat method picker
4. **Status page** — 90-day uptime grid + active incidents banner
5. **Pricing page** — 4 tiers w/ NOWPayments USDT badge

## 3 GIFs (placeholder list)

1. **Prompt → video in 30s** (sped 10×)
2. **Affiliate referral conversion** — clicked link → signup → conversion event firing
3. **Multi-channel publish** — same video → TikTok + YouTube + Telegram

## Hunter pitch (if not self-hunting)

> Solo founder shipping a product crypto-native creator economy actually needs. AI video gen with USDT payouts. Built on Cloudflare edge — fast, cheap, no Postgres. 9 months solo, 14 phases shipped, 2K+ tests. PH launch is the first marketing push.

## Launch day checklist

- [ ] PH submission scheduled 12:01 AM PT
- [ ] Hunter (if external) confirmed 24h prior
- [ ] First comment + 5 screenshots ready in PH editor
- [ ] Twitter thread queued (see twitter-thread.md)
- [ ] HN Show post queued for 6 AM PT (see hn-show-post.md)
- [ ] Telegram broadcast script tested in dry-run
- [ ] Sentry + status page green
- [ ] Spike profile already validated production absorbs 500 VU
- [ ] Founder available 8 AM – 8 PM PT to reply to comments

## Goal metrics

- 200+ upvotes by 6 PM PT (typical Top 5 of day)
- 50+ comments
- 500+ signups within 7 days
