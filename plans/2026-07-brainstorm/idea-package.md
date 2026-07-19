# Sophia AI Factory — Idea Package

## Ledger Header

| Field | Value |
|-------|-------|
| **Date** | 2026-07-14 |
| **Session label** | 2026-07-brainstorm |
| **Contract** | MANIFEST@M0 — idea validation, compound plan, ledger-driven |
| **Status** | DRAFT |
| **Source brainstorms** | `2026-07-strategic-brainstorm-4dim.md` (4 dimensions, parallel research agents) |

---

## Mandatory Compliance Checklist (M0)

- [x] Voice of client respected: every idea framed for NON-TECH CEO, bilingual VN+EN where customer-facing.
- [x] No developer jargon in customer-visible output paths.
- [x] No fabrication: revenue math labeled as estimates, not projections.
- [x] Source file referenced: `plans/2026-07-strategic-brainstorm-4dim.md`.
- [x] No L-plan phase delivery: this file is a plan INPUT only.
- [x] Risk flags surfaced for every idea.
- [x] Report output directory reserved: `plans/reports/`.
- [x] Process owner single-threaded: planner is the only role with L-plan authority in this stage.

Status: COMPLIANT — proceed to L-plan lock when user confirms top priorities.

---

## Leader / Ledger — Plan Exec Context

### Designated Roles

| Role | Tool/Agent | Responsibility |
|------|-----------|----------------|
| Plan Exec (Leader) | planner (Task tool: ak-engineer:planner) | Reads this file, produces `L-plan` plan.md per `docs/documentation-management.md` layout |
| Sub-plan Scanners | `researcher` × N (parallel Task) | One per idea in Sprint scope — validates mechanism feasibility against codebase |
| Reviewer | ak-engineer:code-reviewer (after cook) | Mandatory on any resulting code change |
| Ledger keeper | human (founder/operator) | Lock/unlock decisions; answers Blocking Questions |
| Dispatch | planner + cso | Pricing/tier/GTM questions go to cso for adjacent input |

### Orchestration Sequence (read-only; only fires after user locks this package)

```
Phase A: User confirms Top-N list + answers Blocking Questions
Phase B: planner emits L-plan plan.md for each Scored idea
         └─ N parallel researcher runs, one per phase file
Phase C: planner assembles phases; single owner signature
Phase D: For P1 ideas, parallel cook stage runs after plan lock
         (protected flows blocked: Setup Wizard, Telegram Bot, NOWPayments IPN)
Phase E: code-reviewer gates every PR
Phase F: Ledger updated; plan status → ACTIVE
```

### Lock / Unlock Conditions

**Lock (this file → L-plan can start):**
1. User replies "lock" (or equivalent) to this file.
2. Top-N list is non-empty (minimum 1 idea).
3. No active code-review or CI gate blocking main.

**Unlock (reopen DRAFT):**
1. User changes market priority.
2. New MANIFEST M1 (execution) supersedes this package.
3. A block in Blocking Questions resolves in a way that invalidates a chosen P1.

**No silent unlocks.** Any change to the Scored list must be logged via `watzup` or equivalent handoff note.

---

## Idea Registry

### ID-01 — Usage-Based Micro-Pricing (hybrid subscription + credits)

**Hook:** Let customers pay only for what they generate, while subscriptions guard baseline access — the model that turned Vercel/RunwayML from "cheap trial" into durable ARPU engines.

**Problem:**
- Subscription-only gates 1-off or casual users who would otherwise convert.
- High-volume users outgrow fixed tiers; platform captures no marginal value beyond cap.
- Vietnamese SMB segment has low credit-card commitment tolerance — "pay small, often" beats "commit monthly."
- Current tiers (`BASIC | PREMIUM | ENTERPRISE | MASTER`) offer no per-unit escape valve.

**Proposed Mechanics:**
- Add credit packs as additive overlay to existing subscription quota.
- 1 credit = 1 AI video generation (OpenRouter + D-ID invocation; credits expire 90 days).
- Packs: 10 credits ($29), 50 credits ($99), 200 credits ($299) — priced slightly above marginal cost to keep margin healthy at scale.
- Credits stack with subscription — e.g., BASIC (5/month) + 10-pack = 15 videos that month.
- Upsell hook: when user hits 80% of quota, modal offers a pack; no forced subscription upgrade.

**Target User:**
- PRIMARY: BASIC + PREMIUM users (Vietnam SMB, 1–10 employees).
- SECONDARY: Trial users who would churn at subscription gate — credits let them experience value before committing.

**Expected Impact:**
- MRR: +35% ARPU from 30% of base buying 1 pack/quarter; +20% new-customer rate from 15% one-off converting via credits. (Estimates from brainstorm — baseline to be validated against actual D1 usage_events table.)
- ARPU delta: +$8–18/user/month.
- Retention signal: reduces "quota hit → churn" cliff.
- Cost delta: credits are marginal-cost priced; COGS tracked via Cost Attribution Dashboard (ID-04).

**Risk Flags:**
- Requires NOWPayments IPN handler to support coupon/override logic for credits — no breaking change to existing subscription webhook.
- Migration must NOT alter `tiers` table enum or break existing `getUserTier` lookup.
- 90-day expiry requires new D1 `credits` table + cron for expiry job.
- Bilingual UX must explain "subscription vs. credits" without confusing non-tech CEO.

**Owner Dimension:** Pillar 1 — Revenue Velocity

**Status:** SCORED

---

### ID-02 — Vietnamese Voice Optimization (local competitive moat)

**Hook:** Make Vietnamese-generated AI videos sound authentically local — not English phonemes pasted over tonal language — a defensible moat no other AI-video platform is building because they are US/EU-first.

**Problem:**
- Vietnamese is tonal (6 tones) + Latin script with diacritics — existing presets tuned for English phonetics produce flat/unnatural output.
- ElevenLabs Vietnamese voices are generic; no Sophia-specific tuning.
- Subtitle rendering doesn't account for diacritic stacking (e.g., "ệ", "ử", "ờ") — rendering artifacts on mobile.
- Competitors (Runway, HeyGen, Synthesia) ignore VN-first optimization — first-mover advantage decays slowly.

**Proposed Mechanics:**
- Add a "Vietnamese Natural" voice preset in the BYOK ElevenLabs integration layer (`tree/elevenlabs/`).
- Script pre-validation: flag Vietnamese phonetic combinations that historically degrade avatar sync (server-side heuristics; minimal model).
- Subtitle styling: increase line-height + font weight per diacritic density bracket, tested against Zalo/Facebook mobile renderers.
- No new vendor contracts: ships in ElevenLabs routing via existing BYOK channel.

**Target User:**
- PRIMARY: All Vietnam-based users (all tiers).
- SECONDARY: Content creators producing VN-social media content (TikTok, Zalo OA, Facebook).

**Expected Impact:**
- MRR: no direct lift — but reduces churn from Vietnamese cohort.
- Retention: +5–8% for Vietnam segment (competitive moat latency).
- Cost delta: near-zero (uses existing ElevenLabs calls differently).
- Time: S (~1 sprint).

**Risk Flags:**
- Voice preset quality depends on ElevenLabs Vietnamese model coverage — validate via sandbox before committing.
- Diacritic rendering tests must cover Zalo OA + Facebook in-app browser (2 high-traffic surfaces).
- No PHI/PII risk; no user data leaves existing ByoK envelope.

**Owner Dimension:** Pillar 2 — Product-Market Fit (Vietnam-First)

**Status:** SCORED

---

### ID-03 — AI-Powered Support Triage (Telegram bot self-service)

**Hook:** deflect 60–70% of support tickets via the Telegram bot that is already running — use the existing @Sophia_Bbot as a tier-1 support agent, no new interface.

**Problem:**
- Support volume scales linearly with customers; current operator-handled model does not scale to 100+ active users.
- Common queries (API key reset, quota questions, billing confusion) should not require human.
- Vietnam timezone: users message outside working hours; slow responses produce churn.
- Telegram bot is already the primary support touchpoint — extending it is cheaper than adding a fresh UI.

**Proposed Mechanics:**
- Three-tier triage:
  - L1 (bot): pattern-match common queries → execute action (reset key, show current usage, explain billing) — deterministic, no LLM.
  - L2 (LLM-assisted): free-form question → RAG on SOPs + Sophia docs → draft reply; operator reviews ambiguous cases.
  - L3 (human): payment dispute, tier-upgrade dispute, bug report → escalate to operator with context pre-filled.
- Escalation message includes user tier, recent usage, last 5 events — operator never has to ask "what is your tier?"
- Must NOT expose operator tokens (no-tech doctrine).

**Target User:**
- PRIMARY: All active users of BASIC–MASTER.
- SECONDARY: Operator (human-in-loop training data → L2 improves over time).

**Expected Impact:**
- MRR: indirect (reduces churn from support friction).
- Ops: 60–70% deflection; ~5–8 hrs/week saved at early stage, ~20+ hrs/week at 500-user scale.
- Cost delta: LLM-assisted L2 uses OpenRouter with rate limiting (reuses existing BYOK budget).
- Retention signal: faster response = higher CSAT.

**Risk Flags:**
- Bot must not break Setup Wizard or /campaign, /status, /results (protected flows).
- L2 RAG scope must be sandboxed to SOPs — no hallucinated pricing promises.
- Rate limiting: L2 LLM calls need per-user daily cap to prevent OpenRouter cost blowout.
- Bilingual response (VN+EN).

**Owner Dimension:** Pillar 3 — Platform Flywheel

**Status:** SCORED

---

### ID-04 — API Resilience Layer (circuit breakers + fallback providers)

**Hook:** Stop one vendor outage from becoming a customer-visible "Sophia is broken" event — build fallbacks behind the scenes and gracefully degrade.

**Problem:**
- Four critical external dependencies: OpenRouter, ElevenLabs, D-ID, NOWPayments. Each is a single point of failure.
- OpenRouter has had known degraded-mode events; D-ID avatar watermark/glitch artefacts are intermittent.
- Today a single D-ID failure → user sees "Error" with no recovery path → loses trust.
- Cost visibility of each dependency per-call is currently opaque — runaway call + failed retry burns budget with no cap.

**Proposed Mechanics:**
- Circuit breaker per provider: after N failures in W seconds → degrade gracefully.
- OpenRouter fallback: self-hosted Qwen 2.5-14B on CF Workers AI OR replicate.com orchestrator (cheapest for shell scripts; validate per-vendor TOS).
- ElevenLabs fallback: PlayHT or Amazon Polly TTS via existing BYOK budget.
- D-ID fallback: audio-only video (still image + TTS) for BASIC tier — "We couldn't animate this one; here's the audio version" with retry queue.
- Per-day cost cap per customer (configurable, env-var driven); kill runaway generation before invoice shock.
- User-facing "degraded" status via Inngest event — not silent failure: "Avatar generation paused — will resume automatically."

**Target User:**
- PRIMARY: ALL tiers (reliability is universal).
- SECONDARY: MASTER tier (highest SLA expectation; white-glove support contract implied).

**Expected Impact:**
- MRR: no direct lift; protects ARPU by reducing churn from reliability incidents.
- Cost delta: +vendor spend (second provider), but saved from wasted retries on failure paths; net neutral to slight positive at scale (avoiding chargebacks).
- P95 API reliability target: 99.5%+ from current unknown baseline (needs telemetry first).
- Trust signal: first non-US AI-video platform shipping multi-provider fallbacks in VN market.

**Risk Flags:**
- Fallback vendor contracts must pass Sophia's no-operator-credentials doctrine — user provides keys via BYOK or defaults to platform-provided budget (CF Workers AI free tier for Qwen).
- Replicate.com TOS compliance — confirm no prohibited use case.
- Circuit-breaker config must not auto-heal too aggressively (thundering herd on recovery).
- D1 + Inngest events for degradation state — adds thin state layer (must go through forest, not land).

**Owner Dimension:** Pillar 5 — Technical Foundation

**Status:** SCORED

---

### ID-05 — Agency / White-Label Tier

**Hook:** Turn digital marketing agencies from competitors into resellers — an agency managing 5–20 clients pays $299–499/month while we do the heavy AI video lifting.

**Problem:**
- Vietnam digital marketing agencies exploded 2023–25; they're already buying AI tools separately per client.
- White-label is a no-brainer upsell if the platform can brand per client + bill under agency name.
- No existing competitor with VN-language + white-label in this stack.

**Proposed Mechanics:**
- `AGENCY` tier added to enum: `BASIC | PREMIUM | ENTERPRISE | MASTER | AGENCY` (uppercase).
- Agency admin UI: multi-client management (per-client org_id in D1), sub-client quota allocation, pass-through usage report, custom branding (CSS variables per client).
- Volume discount: 20–40% off retail AP billing to agency; agency bills end-client at retail.
- API access per sub-client with scoped keys (rate-limited, quota-capped).
- Onboarding: self-service agency signup + KYC-light (name, tax, email); NOWPayments invoice supports agency invoicing (monthly, not per-video).
- Pricing set by cso + planner lock (blocking question below).

**Target User:**
- PRIMARY: Vietnam digital marketing agencies (5–20 end clients, >$2k/month billings).
- SECONDARY: Enterprise customers who want to white-label for their own customers.

**Expected Impact:**
- MRR: $299–499/agency seat — 20 agencies at $399 = ~$8k MRR at 20% SMB conversion rate.
- ARPU delta: agency bulk brings 3–6× the per-seat revenue of PREMIUM individual.
- Retention: multi-client dependency creates stickiness; agencies rarely switch tools managing many clients.
- Cost delta: infrastructure minimal for thin agency wrapper; small Inngest runner for per-client sub-workflows.

**Risk Flags:**
- Custom branding per client requires per-org CSS var system — matches existing tenant scoping (good).
- KYC light → anti-fraud: NOWPayments handles subscription invoicing for agency; individual sub-clients stay on per-call billing.
- Vietnamese regulations around reselling AI services — confirm with legal counsel (out of scope until user confirms).
- Affects tier enum — breaking schema change; must be migrated via D1 migration with backfill.

**Owner Dimension:** Pillar 1 — Revenue Velocity

**Status:** SCORED

---

### ID-06 — Multi-Channel Auto-Adapt (format + caption per platform)

**Hook:** One Sophia-generated video published natively to Telegram, Facebook, TikTok, Instagram Reels, YouTube Shorts, and Zalo OA — each formatted, captioned, and optimized per platform spec without leaving the dashboard.

**Problem:**
- Marketers currently generate a video, then manually resize, re-caption, and re-upload to each platform — 3–5 hrs per week per client.
- One-video-many-platforms is the dominant workflow in VN SMB marketing; botching the resize produces poor engagement.
- Caption/hashtag language + style differs by platform; same text doesn't convert across Facebook, TikTok, or Zalo.

**Proposed Mechanics:**
- Post-generation Inngest step: 
  - Generate 4 aspect ratios from source: 9:16 (vertical), 1:1 (square), 16:9 (landing), plus thumbnail.
  - Use FFmpeg in CF Workers (via `@ffmpeg/ffmpeg`) or push to R2 + use Cloudflare Image Resizer for derivative assets.
- Per-platform AI caption: prompt template per surface (FB, TikTok, Zalo, IG Reels, YT Shorts) — OpenRouter call constrained by tier.
- One-click publish for MASTER tier to FB/IG Graph API (user provides their own page token via BYOK admin); lower tiers auto-save to R2 + generate share-ready asset.
- Zalo OA publish — mirror Telegram bot architecture but for Zalo OA webhook.
- Batch mirror: single campaign push to all linked channels via scheduler.

**Target User:**
- PRIMARY: PREMIUM + MASTER tier users who post regularly (≥3 videos/week).
- SECONDARY: AGENCY tier (auto-publish per sub-client channel list).

**Expected Impact:**
- MRR: indirect — reduces cancellation risk from PREMIUM/MASTER.
- Retention/ARPU: "time saved" becomes sellable value; increases willingness to upgrade.
- Cost delta: CF Image Resizer is free; FFmpeg in Workers costs CPU only.
- Vietnam moat: Zalo OA support no other competitor ships.

**Risk Flags:**
- FB/IG Graph API token requires user-provided PAGE_ACCESS_TOKEN (BYOK) — not operator credential (compliant).
- Zalo OA bot architecture must be tested end-to-end before production; Zalo API rate limits differ from Telegram.
- FFmpeg in Workers cold-start may spool first-gen latency; cache derivatives to R2.
- Protected flows: must not block Telegram Bot or Setup Wizard paths.

**Owner Dimension:** Pillar 2 — Product-Market Fit (Vietnam-First)

**Status:** SCORED

---

### ID-07 — Smart Campaign Sequencer

**Hook:** Let marketers build "if A performs, post B" loops once and let the platform run them end-to-end — campaign automation that compounds engagement without human in the loop.

**Problem:**
- Current state: user manually generates one video, posts, watches analytics, then decides next step — no automation.
- Marketers want "set it and forget it" sequences (november sales, weekly promos) but lack the time to orchestrate timing + conditional branching.
- Optimal posting time is user-specific (audience timezone + platform algorithm) — anyone who simply "posts daily" underperforms.

**Proposed Mechanics:**
- Campaign builder UI: sequence template (video A on day 1 → video B on day 3 if A ≥100 views → follow-up C on day 7).
- Scheduler learns from user's historical Inngest event + D1 analytics (time-of-day that generates highest views per user cohort).
- Steps are idempotent Inngest workflows — if platform is down, retry with jitter; no double-post.
- Deliver: "sequence builder" UI in land/campaigns/, state persisted in D1, Inngest cron schedules each step.
- Notification: Telegram push + in-app banner when next step is queued or executed.

**Target User:**
- PRIMARY: MASTER tier (power users who post 5+ videos/week).
- SECONDARY: AGENCY tier — sequences per sub-client, templated per vertical (e-commerce, F&B, education).

**Expected Impact:**
- MRR - indirect: stickiness increases; longer subscription runway.
- Retention: users who build 1 sequence are 3–5× less likely to cancel within 90 days (compounding commitment).
- Cost delta: CPU via Inngest (already billable); n+1 campaign steps = marginal extra compute.

**Risk Flags:**
- Sequencing failure should never produce a double-post — requires Inngest idempotency key per step.
- Cross-layer: UI (land/campaigns/) → API (forest/) → Inngest → D1. Layer boundaries must be respected (land never calls Inngest directly without forest proxy).
- Bilingual UX for sequence builder (step labels, schedule picker).
- Protected-flow edge case: if campaign step generates a video, do NOT block Setup Wizard path.

**Owner Dimension:** Pillar 3 — Platform Flywheel

**Status:** SCORED

---

### ID-08 — Cost Attribution Dashboard

**Hook:** Show operators (and MASTER users) the true "cost to serve" per video — not vague "API usage" but a dollar figure sitting next to revenue, so pricing decisions are informed.

**Problem:**
- Current state: AI API costs (OpenRouter + ElevenLabs + D-ID) are tracked at platform level, not per-customer.
- A single high-volume PREMIUM user may cost more in API spend than they pay — no raising flag until monthly invoice.
- Future pricing experiments need cost-to-serve signal to set credit pricing accurately.

**Proposed Mechanics:**
- Extend existing usage_events D1 table (Phase 10 lineage): add per-event cost fields — `openrouter_tokens_used`, `elevenlabs_tts_seconds`, `d_id_generation_ms`.
- Per-day rollup cron: `cost_per_customer_per_day = sum(video costs) for that customer_id`, compared against their tier/subscription value.
- Alert: if 30-day moving cost > 80% of 30-day revenue from customer → surface in operator dashboard + quiet MASTER-user self-view.
- Data feeds into credit pricing recalibration (ID-01) and per-tier profitability model (future Iteration N).

**Target User:**
- PRIMARY: Operator (internal).
- SECONDARY: MASTER tier users (self-service cost visibility — trust signal + upsell hook to AGENCY).

**Expected Impact:**
- MRR: indirect (pricing accuracy improves → margin).
- Cost delta: -$200–500/month from catching unprofitable customers early + right-sizing credit tier pricing.
- Ops: replaces floaty spreadsheet with live dashboard; 1–2 hrs/week saved in ops reporting.
- Foundation: required by credit-pricing model accuracy.

**Risk Flags:**
- Per-video cost attribution must not add >5% overhead to generation path — async rollup via Inngest, not request-path.
- OpenRouter token counts require `usage.prompt_tokens + usage.completion_tokens` — must extend BYOK token flow during LLM call.
- D-ID cost variable (per-duration) + ElevenLabs TTS cost variable (per-character/seconds) — each needs a rate-card in config.
- Reconcile with actual invoice (NOWPayments) monthly — variance report.

**Owner Dimension:** Pillar 4 — Operational Efficiency

**Status:** SCORED

---

### ID-09 — Automated Quality Gate (post-generation validation + auto-retry)

**Hook:** Every generated video is automatically sanity-checked — metadata valid, avatar not glitched, prompt not injected, cost not runaway — and silently fixed before the user sees it.

**Problem:**
- Users occasionally receive silent failures: corrupt avatar, wrong voice, prompt injection that causes D-ID watermark on a branded asset.
- No guardrail prevents a single buggy campaign from burning $500 of API spend overnight on retry loops.
- Support tickets spike after quality incidents; root cause is rarely surfaced to user proactively.

**Proposed Mechanics:**
- Post-generation Inngest step (after video assembled, before NOTIFY):
  - Metadata check: duration > threshold, resolution valid, file size in expected range.
  - Avatar check: sample N frames → glitch-detection heuristic (pixel-diff vs last known good, or motion-budget check).
  - Prompt injection check: scan user-provided script for leaked system instructions / jailbreak patterns.
  - Cost cap: abort generation if per-customer per-day spend crosses threshold (env-var).
- Retry policy: max 3 attempts using parameter variations (different prompt seed, alternate avatar angle).
- User notification: Sophia bot messages "Your video #123 had a hiccup — regenerated successfully" instead of silent retry.
- Operator view: quality gate failures aggregated in operator dashboard (feeds Cost Attribution Dashboard).

**Target User:**
- PRIMARY: All tiers (universal reliability improvement).
- SECONDARY: MASTER tier — higher quality gate thresholds (longer retries, finer frame sampling).

**Expected Impact:**
- MRR: indirect — reduces churn from "bad generation" incidents.
- Cost delta: -$100–300/month from avoiding failed video + retry costs; hard to quantify until telemetry baseline is built.
- Support: -30–40% on quality-incident tickets.
- Time: M (middle effort; quality detector heuristics need sandbox tuning).

**Risk Flags:**
- Glitch detection heuristic must have low false-positive rate to avoid regen-storms.
- Prompt-injection scanner must stay lightweight; do NOT call LLM for every prompt (use regex + token-set heuristics).
- Retry budget must be Inngest-driven, not request-path; long-running must not block API response.
- Must not interfere with protected Setup Wizard flow or live campaign generation.

**Owner Dimension:** Pillar 4 — Operational Efficiency

**Status:** SCORED

---

### ID-10 — Inngest Workflow Visibility (customer-facing campaign status)

**Hook:** Customers see their video generation progress in real-time inside the dashboard — not "queued" for 5 minutes wondering what happened — so they trust the platform enough to queue the next batch.

**Problem:**
- Long-running jobs (video generation 30s–5 min) have no customer-facing status window; only Telegram /status endpoint exists.
- Customers message support asking "is my video done?" — classic status-poking anti-pattern.
- No progress estimate → anxiety → lower perceived reliability → churn.

**Proposed Mechanics:**
- Inngest webhook → new D1 `workflow_runs` table (run_id, step, status, progress_pct, started_at, finished_at).
- Dashboard widget on campaign detail page: progress bar + estimated time to completion (learned from recent runs of same template).
- Push notification: Telegram bot + in-app when workflow completes (status=DONE) or fails (status=FAILED) with retry option.
- Operator view: overview screen of all in-flight runs across customers.

**Target User:**
- PRIMARY: All active tiers.
- SECONDARY: AGENCY tier — aggregated view across sub-clients.

**Expected Impact:**
- MRR: indirect (reduces support ticket volume; improves CSAT).
- Retention: visible progress reduces "did it crash?" anxiety → higher completion rate.
- Cost delta: thin state layer only; essentially free.

**Risk Flags:**
- New D1 table — must follow existing migrations pattern (`migrations/000X_workflow_runs.sql`, env-free, no secrets).
- Inngest event schema must match existing `event-name` format; backfill compat with prior runs (can start empty).
- Protected-flow edge case: must not block Telegram Bot /status handler behavior.

**Owner Dimension:** Pillar 4 — Operational Efficiency

**Status:** SCORED

---

### ID-11 — CF Workers Optimization (cache, bundle, D1 indexes)

**Hook:** Reduce Cloudflare bill by 30–40% while also making pages load faster — the free performance win that also improves Core Web Vitals.

**Problem:**
- Video thumbnails and template assets served without R2 + KV edge cache — each origin hit costs compute + latency.
- Auth session validation (Better Auth) runs in every handler — edge middleware can short-circuit unauthenticated before handler body.
- D1 lacks composite indexes on common filter paths (user_id + created_at) → full scans on listing queries.
- Bundle ships stale references from pre-consolidation code; dead code removal passes yield immediate win.

**Proposed Mechanics:**
- R2 + KV edge cache: thumbnail images, template JSON, static campaign listing pages cached with `stale-while-revalidate`.
- Edge middleware: validate Better Auth session in `middleware.ts` before handler, return 401 early for unauthenticated.
- D1 indexes: add `(user_id, created_at DESC)` composite index on `campaigns` table; same for `video_runs` table.
- Bundle: targeted dead-code removal using manual audit per prior 2026-04-14 consolidation (no full refactor — YAGNI).
- cacheComponents = 'force-static' for campaign listing pages (Next.js 16 App Router).

**Target User:**
- PRIMARY: All users (latency improvement universal).
- SECONDARY: Operator (lower CF bill).

**Expected Impact:**
- MRR: indirect (reduced infra spend).
- Cost delta: -30–40% CF bill (~$100–250/month at current scale).
- P95 latency: -20–30% on listing pages.

**Risk Flags:**
- Cache invalidation rules must avoid stale template updates breaking active campaigns — edge tag versioning.
- D1 index additions require a migration; must not regress existing queries.
- YAGNI: do NOT refactor entire bundle or adopt full static-site approach.

**Owner Dimension:** Pillar 5 — Technical Foundation

**Status:** PIVOT (skipped on first sprint; will add after P1+P2 validated in production)

---

### ID-12 — Zalo OA Integration

**Hook:** Zalo Official Account bot mirrors the Telegram bot — Vietnam's dominant messaging app (92M users) gets native Sophia campaign broadcast.

**Problem:**
- Zalo is THE messaging app in Vietnam; Zalo OA is the SMB equivalent of Facebook Pages.
- No competitor ships a native Zalo OA bot for AI-video distribution — first-mover moat.
- Current bot is Telegram-only; Vietnam audience is split between Zalo and Facebook.

**Proposed Mechanics:**
- Zalo OA webhook handler in `land/telegram/` (parallel to Telegram implementation, new `zalo/` sub-module).
- Zalo-specific rich media: OA can send video + carousel; mirror Telegram `/campaign` API.
- Broadcast campaign videos to Zalo OA followers (requires user to provide OA access token via BYOK admin).
- Operator views: bounded to Telegram/Telegram channels — Zalo OA data lands in same schema (channel_type enum extended).

**Target User:**
- PRIMARY: MASTER tier + AGENCY tier Vietnam users with Zalo OA presence.
- SECONDARY: PREMIUM tier experimenters.

**Expected Impact:**
- MRR: defensive in VN; content-distribution moat.
- Retention: native Zalo integration = harder to churn (locked into platform-native workflow).
- Cost delta: minimal (reuses existing BYOK video gen + Inngest runner); extra cost only in Zalo API rate-limits.

**Risk Flags:**
- Zalo OA API maturity lags Telegram; webhook reliability needs sandbox validation (Mekong sandbox before production).
- Zalo OA access token is user-provided — compliant with BYOK doctrine.
- Vietnamese Zalo OA TOS: confirm reselling AI-generated content is allowed.
- Protection: Zalo code must live in `land/telegram/zalo/` tree; never routes through Setup Wizard path.

**Owner Dimension:** Pillar 2 — Product-Market Fit (Vietnam-First)

**Status:** PIVOT (post-MVP; after ID-05 + ID-06 validated)

---

### ID-13 — Type Safety Hardening

**Hook:** Zero `:any` types is already a quality gate — formalize it into a tracked debt register + fix sprint to eliminate the residual backdoor types.

**Problem:**
- CLAUDE.md mandates zero `:any` in production code; last job run reports 87+ eliminated but zero tolerance is the new line.
- Zod schema consolidation: duplicate type definitions between D1 schema, Zod, React Server Components create drift.
- No typed D1 output generics across all queries — individual queries may be out of compliance.

**Proposed Mechanics:**
- CI step: `grep -r ': any\|as any\|@ts-ignore' src --include="*.ts" --include="*.tsx"` fails build on any hit (enforced — already exists in docs; formalize in CI).
- Zod consolidation: central `seed/schemas/` exports shared shapes; each `*/types.ts` re-exports instead of re-defining.
- Typed D1: document + migrate remaining queries to `D1Response<T>` helper pattern (only ~20–40 queries remaining post Phase 12; sprint to clear).
- debt register: `docs/tech-debt-register.md` with owner + due-date columns per `:any` instance.

**Target User:**
- PRIMARY: Internal developer velocity.
- SECONDARY: End-user indirection — safer deploys = fewer regressions = less churn.

**Expected Impact:**
- MRR: none directly.
- Cost delta: avoidable regression-repair cost (~$500–2k per month in developer time saved at scale).
- DX: developer onboarding faster; fewer runtime surprises.

**Risk Flags:**
- Risk is NOT breaking; technical debt is real but so is scope — cap the sprint at X hours.
- Must NOT refactor working code just to satisfy the gate — only remove real runtime/type-safety loss.

**Owner Dimension:** Pillar 5 — Technical Foundation

**Status:** PIVOT (continuous parallel sprint; never blocks P1/P2)

---

### ID-14 — Batch Video Generation (CSV-driven bulk produce)

**Hook:** A retailer with 50 products uploads one CSV and gets 50 personalized AI videos in an afternoon — what used to take agencies 2–3 weeks becomes a single bulk job.

**Problem:**
- E-commerce store owners with 50+ SKUs must currently generate video one-by-one — bound to single-product cadence.
- Manual repeat work = agency bill at ~$150–300/video; platform at ~$5–10 PARALLEL-ABLE.
- No CSV-batched product prompt, no bulk-asset management, no download bundle mechanism.

**Proposed Mechanics:**
- CSV ingestion API (Zod-validated): columns `product_name`, `price`, `offer`, `image_url`, `cta_text`.
- Inngest batch runner: fan-out per-row → per-row video generation → R2 staging folder → ZIP download link via R2 signed URL.
- Progress UI: in-app progress bar per batch (feeds ID-10 workflow visibility).
- Templates: choose per-batch template (thumbnail style, voice preset, aspect ratio).
- Limit: configurable max batch size per tier (PREMIUM: 50/video; MASTER: 200/video; AGENCY: per-client limit).

**Target User:**
- PRIMARY: MASTER + AGENCY (Vietnam e-commerce); PREMIUM as upsell.
- SECONDARY: PREMIUM upsell to MASTER via "bundle video" feature — sized exactly at MASTER rate card.

**Expected Impact:**
- MRR: main upsell path for MASTER tier + gateway for AGENCY upsell.
- ARPU: +$49–99/month from users upgrading to MASTER for batch feature.
- Retention: heavy e-commerce users locked in by 50+ video inventory they can regenerate on seasonal refresh.

**Risk Flags:**
- Inngest fan-out at 200-video scale must not blow through user quota in one go — daily cost cap applies (per ID-04).
- CSV schema errors should be reported row-by-row, not batch-abort — user-friendly UX.
- Generation is I/O-bound; Workers CPU time limited — must time-slice via Inngest.
- Protected-flow edge case: batch job must not block migration paths.

**Owner Dimension:** Pillar 3 — Platform Flywheel

**Status:** SCORED

---

### ID-15 — Template Marketplace (community + platform take rate)

**Hook:** A curated library of production-ready campaign templates ("Made with Sophia") cuts time-to-first-video from hours to minutes, while a 30/70 revenue share creates a creator ecosystem.

**Problem:**
- First-time users fumble: "what prompt, what avatar, what thumbnail?" — high drop-off at onboarding.
- Templates reduce repetition but Sophia currently forces each user to rebuild the same campaign from scratch.
- No creator incentive to build + share high-quality templates in the platform (currently just their own campaign).

**Proposed Mechanics:**
- Template model: JSON blob with prompt, avatar_id, voice_preset, thumbnail_spec, call-to-action, platform target.
- Free tier: 3 templates/month; PREMIUM/MAsTER: unlimited; contributor takes 70% of each purchase of their template (platform 30%).
- Curation pipeline: template submitted → auto-scan for TOS compliance → operator review → published.
- Discoverability: marketplace section in dashboard, "remix" button duplicates template to user's account.

**Target User:**
- PRIMARY: New users (activation driver).
- SECONDARY: Expert creators (new revenue stream; co-op growth within Vietnam marketing community).

**Expected Impact:**
- MRR: +$500–2000/month at maturity (20–50 templates @ $2–5 template fee).
- Activation: "time-to-first-video" shrinks from ~2 hrs to ~15 min → conversion rate from trial to paid improves.
- Network effect: each new template makes the platform stickier for all users.

**Risk Flags:**
- Quality control: unvetted templates could generate bad AI output reflecting poorly on brand.
- Revenue-share payout via NOWPayments invoice at month-end (no per-sale micro-payment infra).
- Legal: template licensing/IP — user-submitted prompt vs Sophia-owned template template architecture.
- Phased: ship curated-only first (no user submissions) → open submission after 20+ templates stockpiled.
- Takes D1 schema + new admin UI mods — medium effort, defer if P1/P2 scope tight.

**Owner Dimension:** Pillar 3 — Platform Flywheel

**Status:** DRAFT (curated-only path validated; self-serve submissions locked until moderation infra built)

---

### ID-16 — Community Showcase (opt-in public gallery)

**Hook:** A public "Made with Sophia" gallery turns every generated campaign into social proof — free organic acquisition on the same Zalo/Facebook/TikTok feeds where customers already post.

**Problem:**
- No organic growth loop currently — every new customer comes from paid channel or word-of-mouth.
- Customer is already proud of their AI-generated campaign; currently no channel to broadcast that attribution.
- Competitors have showcase pages but none VN-language + localized to Vietnamese social media surfaces.

**Proposed Mechanics:**
- Opt-in: user marks campaign "public" (default private); thumbnail + headline + "made with Sophia" badge surfaces in gallery.
- Engagement primitives: likes, comments, "remix" (clone template).
- Badge program: "Sophia Verified Campaign" badge users can embed on Zalo OA, website.

**Target User:**
- PRIMARY: MASTER tier users (high-quality output they want to flaunt).
- SECONDARY: New prospects (discovery surface).

**Expected Impact:**
- MRR: indirect organic acquisition delta (hard to measure at small scale).
- Retention: social-proof loop reinforces identity → higher CSAT → lower churn.
- Cost delta: thumbnails already on R2; gallery is essentially free compute.

**Risk Flags:**
- Low engagement signal likely: no strong primary KPI, mostly vanity.
- Moderation burden: gallery must police AI-generated misinformation or inappropriate content — legal liability.
- Vietnamese-market opt-in rate is uncertain; likely <10% of users share publicly at launch.

**Owner Dimension:** Pillar 3 — Platform Flywheel

**Status:** KILL (retained as future possibility; scope beyond current P1/P2 market window)

---

## Scoring Matrix

> Tax: computed before lock. S=1, M=2, L=3, XL=4 for Effort Score. MRR Impact: H=3, VH=4, M=2, L=1. Opportunity = MRR Impact + 1 if Ideology alignment +1 (Pillar 1 or 2 sources score+1).

| Idea | Effort | Effort Score | MRR Impact | Opp Score | Net Score (Opp - Effort) | Priority |
|------|--------|-------------|-----------|-----------|--------------------------|----------|
| ID-01 Micro-Pricing | S | 1 | H | 4 | **3** | P1 - GO |
| ID-02 VN Voice Optimization | S | 1 | M (retention) | 3 | **2** | P1 - GO |
| ID-03 Support Triage | S | 1 | H (ops) | 4 | **3** | P1 - GO |
| ID-04 API Resilience Layer | M | 2 | H (retention) | 4 | **2** | P1 - GO |
| ID-05 Agency/White-Label | M | 2 | VH | 5 | **3** | P2 - GO |
| ID-06 Multi-Channel Auto-Adapt | M | 2 | H (retention) | 4 | **2** | P2 - GO |
| ID-07 Smart Sequencer | M | 2 | H (retention) | 4 | **2** | P2 - GO |
| ID-08 Cost Attribution | M | 2 | M (margin) | 3 | **1** | P2 - GO |
| ID-09 Quality Gate | M | 2 | H (ops) | 4 | **2** | P2 - GO |
| ID-10 Inngest Visibility | S | 1 | M (retention) | 3 | **2** | P2 - GO |
| ID-11 CF Workers Optimization | M | 2 | M (cost) | 3 | **1** | PIVOT - defer |
| ID-12 Zalo OA Integration | M-L | 3 | M (retention) | 3 | **0** | PIVOT - defer |
| ID-13 Type Safety Hardening | S-M | 1.5 | - | — | — | PIVOT - continuous |
| ID-14 Batch Video Generation | M | 2 | H (ARPU) | 4 | **2** | P2 - GO |
| ID-15 Template Marketplace | M-L | 3 | M | 3 | **0** | DRAFT - after 20 curated templates |
| ID-16 Community Showcase | S | 1 | L | 2 | **1** | KILL - future |

---

## Consensus Summary

### Top-5 Recommendations for L-Plan Conversion

1. **ID-01 Usage-Based Micro-Pricing** — Highest ARPU/CAGR hypothesis; S effort; works with existing tier table without breaking contracts.
2. **ID-03 AI Support Triage** — S effort; lever on existing Telegram bot; unlocks operator time for higher-ROI P2 work.
3. **ID-02 Vietnamese Voice Optimization** — S effort; first-mover moat; zero new contracts required; ships behind existing BYOK.
4. **ID-04 API Resilience Layer** — M effort; foundational for all other P1/P2 ideas; required before scaling MASTER tier load.
5. **ID-05 Agency/White-Label Tier** — M effort; highest MRR potential; unlocks acquisition via agency partnerships (compounding GTM).

**Worth six-to-eight L-plans from these five:** each P1 produces a discrete plan.md with 3–5 phases.

### Kill List (docs/brainstorm output, not deleted)

- ID-16 Community Showcase: KILL (low signal KPI, moderation risk, defers to mature stage with >500 active users).

---

## Blocking Questions

These 4 questions must be answered by founder/operator before any L-plan is drafted.

**Q1. Hybrid pricing vs pure usage-based.** The brainstorm assumes hybrid (subscription + credits). Per ID-01, confirmed M0 contract requires NOWPayments supports coupon-line overrides on the existing subscription webhook. Founder decision required: keep subscription base + add credits overlay, OR migrate to usage-primary with minimum-commit (à la Vercel)?

**Q2. Agency tier pricing & KYC model.** ID-05 assumes $299–499 per agency seat. Founder must confirm: 
(a) single pricing bracket or tiered (25-client, 50-client, 100-client)? 
(b) KYC-light acceptable (self-declared name/email/tax) or must use a third-party identity checker (which would violate no-tech doctrine)?

**Q3. Fallback provider contracts.** ID-04 fallback path needs a vendor. Recommended: CF Workers AI (Qwen) as no-cost fallback for OpenRouter-style completions; PlayHT for ElevenLabs-style TTS fallback. Each requires platform-provided API key (no user-provided keys for fallback tier). Founder must confirm: 
(a) acceptable to ship with platform-provided credentials for fallback tier? 
(b) acceptable to route through CF Workers AI (sub-10s latency) for degraded mode?

**Q4. Template marketplace curation vs self-serve.** ID-15 is currently scoped as curated-only (operator-reviewed). Founder must confirm: 
(a) start curated-only for first 3 months → self-serve submissions only after 20 templates in stock? 
(b) allow self-serve from day one with automated keyword filter + human spot-check weekly?

Failure to answer these questions will NOT block the P1 ideas (IDs 01–04). They gate P2 Agency (+KYC) and P3 Template (+moderation infra).

---

## Next Actions (ordered)

0. **User locks package** — founder replies "lock" or equivalent to this file. Until then, no L-plans should be drafted.
1. **Answer Blocking Questions** — founder/official response recorded in this file (append to Blocking Questions section or create `blocking-answers.md`).
2. **Inventorize existing telemetry** — CT / researcher scouts usage_events, D1 cost-column gap, Inngest event catalog before L-plan for ID-04 + ID-08 writes migrations. Produces `plans/reports/claude-260714-1009-telemetry-inventory-report.md`.
3. **Draft L-plan for ID-01 (Micro-Pricing)** — planner produces `plans/260714-1009-micro-pricing/plan.md` + phase files. MUST include: new D1 `credits` table + expiry cron + NOWPayments IPN handler safe-add changes.
4. **Draft L-plan for ID-03 (Support Triage)** — parallel to ID-01 since file ownership is clear (`land/telegram/support-triage/`).
5. **Draft L-plan for ID-02 (VN Voice)** — smallest scope; fastest ship; validations in sandbox first.
6. **Sequenced:** After ID-01 + ID-02 + ID-03 lock and ship, run ID-04 (Resilience) L-plan — it is foundational for the remaining P2 work.
7. **Sequenced:** After ID-04 green-deploy, L-plan ID-05 (Agency) — KYC decision required from founder first.
8. **Maintain ledger** — update `plan.md` status field as each idea moves SCORED → PLANNING → ACTIVE → DELIVERED; update this file's Status row to ACTIVE after first L-plan is locked.

---

*End of idea package. Source brainstorm: `plans/2026-07-strategic-brainstorm-4dim.md`. MANIFEST contract: M0 scaffold (DONE). Next: await user lock signal + blocking-questions answers.*
