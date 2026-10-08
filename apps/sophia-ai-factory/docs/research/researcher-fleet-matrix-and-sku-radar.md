# Research: Multi-Account Matrix Fleet & Real-Time SKU Radar

**Context:** Sophia AI Factory | **Target:** Serverless Cloudflare Workers + D1 + Inngest | **Doctrine:** BYOK, KISS, DRY, YAGNI, Zero Operator Infra

---

## 1. Executive Summary & Ranked Recommendation
- **Rank 1 (Recommended): Hybrid Official API + Deterministic Proxy/Fingerprint Vault + Jittered Inngest Fanout.** Uses official APIs (TikTok/YouTube) with D1 AES-256-GCM tokens; falls back to static sticky residential proxy + deterministic seed fingerprinting per channel. Dispatches 1-Click campaigns via Inngest step sleeps with Gaussian jitter.
- **Rank 2: Pure Headless Browser Cloud Cluster (Puppeteer/Browserless).** Heavy operational overhead, violates Cloudflare Worker 128MB ceiling, high proxy bandwidth cost, fragile session rotation.
- **Rank 3: Client-Side Browser Extension Dispatch.** Shifts proxy/upload load to user desktop. Fragile uptime, zero 24/7 autonomous scheduling.

---

## 2. Source Credibility Assessment
- **TikTok Content Posting API & Partner Spec (High):** Authoritative for direct video upload scopes, quota tiers (5-30 posts/day/app), and webhook rate limits.
- **Cloudflare Workers Runtime & D1 Architecture Docs (High):** Authoritative for subrequest caps, 128MB RAM limit, synchronous D1 operations, and lack of persistent TCP daemon sockets.
- **Inngest Serverless Flow & Concurrency Reference (High):** Authoritative for `step.sleepUntil`, cancellation tokens, and dynamic concurrency keys (`event.data.channelId`).

---

## 3. Pillar 1: Multi-Account Matrix & Influencer Fleet Architecture

### 3.1 Session Isolation & Proxy/Fingerprint Mapping in Workers + D1
- **Storage & Isolation:** Each synthetic persona mapped in D1 (`creator_channel_accounts`) with immutable `channel_id`, `persona_seed`, and sticky residential proxy ID (`assigned_proxy_id`). Zero shared cookies across personas.
- **Session Vault:** OAuth refresh tokens and session headers stored with AES-256-GCM using tenant-derived Web Crypto key (`seed/security/crypto-utils.ts`).
- **Edge Fingerprint Synthesis:** Generate deterministic mobile canvas/WebGL/UA headers via hash of `persona_seed` (`tree/affiliate/proxy/anti-detection-rotator.ts`).
- **Proxy Egress:** SOCKS5/HTTP over HTTPS proxy tunnels routed per channel. Each persona bound to static residential ASN/IP (1 persona : 1 sticky IP) to prevent IP flapping flags.

### 3.2 Staggered Publishing Scheduler Algorithm
- **Anti-Clustering Math:** Prevents burst uploads across matrix nodes. Target upload time $T_{\text{publish}} = T_{\text{window\_start}} + \Delta_{\text{jitter}}$, where $\Delta_{\text{jitter}} \sim \mathcal{N}(\mu, \sigma^2)$ clamped to $[\mu - 15\text{m}, \mu + 25\text{m}]$.
- **Cadence Gates:** Per-account minimum interval $\ge 3\text{h}$; max daily uploads $\le 4$; cross-account channel gap $\ge 30\text{m}$ for same product/niche.
- **Inngest Execution:** 
  `await step.sleepUntil("staggered-publish-gate", new Date(targetEpochMs));`
  Uses Inngest concurrency config: `{ key: "event.data.channelId", limit: 1 }` to enforce single-flight uploads per channel.

### 3.3 Aggregated Performance Telemetry
- **Schema Rollup:** D1 table `matrix_telemetry_daily` keyed by `(channel_id, sku_id, date)`. Stores `views`, `clicks`, `orders`, `gmv_cents`, `commission_cents`.
- **Derived Metrics:** $\text{CTR} = \frac{\text{clicks}}{\text{views}}$, $\text{CVR} = \frac{\text{orders}}{\text{clicks}}$, $\text{EPC} = \frac{\text{commission}}{\text{clicks}}$, $\text{RPM} = \frac{\text{commission} \times 1000}{\text{views}}$.
- **Auto-Feedback Loop:** Telemetry flows into `tree/affiliate/scaling/auto-campaign-scaler.ts` to trigger `SCALE_AGGRESSIVE` (4 videos/day) or `KILL_PRUNE` on poor hooks.

---

## 4. Pillar 2: Real-Time Trending SKU Radar & 1-Click Campaign Flow

### 4.1 Velocity Score Algorithm
Composite index identifying viral commercial momentum before market saturation:
$$\text{VelocityScore} = 0.35 \cdot S_{\text{growth}} + 0.25 \cdot R_{\text{v2o}} + 0.25 \cdot M_{\text{comm}} + 0.15 \cdot A_{\text{accel}} - P_{\text{saturation}}$$
- $S_{\text{growth}} = \min\left(100, \frac{\text{Orders}_{24h} - (\text{Orders}_{7d}/7)}{\max(\text{Orders}_{7d}/7, 1)} \times 50\right)$ (Sales growth rate).
- $R_{\text{v2o}} = \min\left(100, \frac{\text{Orders}_{24h}}{\max(\text{Views}_{24h}, 1)} \times 2000\right)$ (View-to-order efficiency).
- $M_{\text{comm}} = \min\left(100, \text{CommissionRate}_{\%} \times 2.5\right)$ (Commercial yield).
- $A_{\text{accel}} = \min\left(100, \frac{\Delta \text{Rank}_{6h}}{\text{MaxRank}} \times 100\right)$ (Momentum velocity).
- $P_{\text{saturation}} = \min\left(40, \text{ActiveCompetitorVideos}_{48h} \times 0.2\right)$ (Penalizes saturated products).
- **Trigger Thresholds:** Score $\ge 75 \to$ Radar Alert; Score $\ge 85 \to$ 1-Click Campaign Ready.

### 4.2 1-Click Campaign Generation Pipeline
1. **SKU Ingestion:** Fetch SKU data (title, bullet points, price, media assets) via affiliate network APIs or manual paste.
2. **Hook Synthesis:** OpenRouter (`claude-3-5-haiku` / `gpt-4o-mini`) generates 5 psychological hooks (Scarcity, Price Shock, Problem-Solution, Before/After, Curiosity Gap).
3. **Bridge Page Binding:** Generate unique localized bridge URL (`land/affiliates/campaign-bridge.ts`) embedding `sku_id`, `channel_id`, and UTM affiliate sub-ids.
4. **Inngest Fanout Dispatch:** Emit `campaign/viral-sku.dispatched` event.
   - Step 1: ElevenLabs Flash TTS voiceover generation.
   - Step 2: Fal.ai Flux Schnell / Remotion vertical video stitch (sub-60s).
   - Step 3: Account matrix matching based on niche persona fit.
   - Step 4: Staggered scheduler queueing.

---

## 5. Technical Evaluation & Trade-off Matrix

| Dimension | Option 1: Hybrid API + D1 Sticky Proxy (Rank 1) | Option 2: Headless Browser Cluster (Rank 2) | Option 3: Client Browser Extension (Rank 3) |
|---|---|---|---|
| **Serverless Fit (CF Workers)** | Native (Zero daemons, pure REST + SOCKS5) | Poor (Requires external Docker/Node) | N/A (Runs on client machine) |
| **Shadowban Prevention** | High (Sticky ASN + jittered cadence) | Medium (Fingerprint leaks in headless) | Low (Single consumer IP for all accounts) |
| **Operational Maintenance** | Low (BYOK keys + D1 storage) | High (Grid infrastructure & proxy bans) | High (Client sync, desktop sleep states) |
| **1-Click Generation Latency** | < 45s to Inngest queue | > 180s (browser warmup) | Variable (User connection dependent) |

---

## 6. Adoption Risk & Architectural Fit
- **Adoption Risk:** Low. Builds on existing `tree/affiliate/proxy/anti-detection-rotator.ts` and `tree/affiliate/scaling/auto-campaign-scaler.ts`.
- **Platform Breaking Changes:** TikTok/YouTube posting APIs enforce strict 60-day token expirations; mitigated via automatic refresh rotation in D1.
- **No-Tech / BYOK Alignment:** Complies with Sophia No-Code doctrine; user supplies proxy credentials or social tokens via Setup Wizard. Zero platform infra required.

---

## 7. Limitations & Unresolved Questions
- **Limitations:** TikTok/IG direct API uploads require verified Developer Partner apps for full production scopes; unverified BYOK users must rely on Telegram notification + manual approval or desktop companion agent.
- **Unresolved Questions:**
  1. For TikTok accounts without official Content Posting API approval, should fallback video dispatch publish via Webhook to user desktop relay or notify via `@Sophia_Bbot`?
  2. Does SKU telemetry ingest require continuous cron polling of third-party affiliate networks (Shopee/TikTok Shop) or rely strictly on inbound postback webhooks?
