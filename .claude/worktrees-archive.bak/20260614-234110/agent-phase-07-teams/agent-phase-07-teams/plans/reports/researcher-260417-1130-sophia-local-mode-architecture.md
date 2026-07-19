# Sophia Local Mode Architecture
## Mapping a16z Solo Company Doctrine onto RaaS Customers with M1 Max

**Date:** 2026-04-17 | **Scope:** MVP design for on-premise LLM inference + agent orchestration

---

## §1 — Solo Company Functional Inventory

Current Sophia solo-founder ops (per `.sophia-factory/agents/` + dashboard):

1. **Weekly Signals Digest** — aggregate campaign metrics, email to founder
2. **Proposal Generation** — Claude inference for business proposals (BYOK OpenRouter keys)
3. **Video Campaign Rendering** — Remotion + HeyGen (external APIs, customer brings keys)
4. **Agent Journal Write-Back** — log agent decisions to customer's D1 (data persistence)
5. **Tier Conversion Event** — NOWPayments IPN webhook → auto-upgrade tier
6. **Affiliate Discovery** — scan + score emerging partnerships (inference-heavy)
7. **CTO/CMO/CSO/COO Agent Decisions** — autonomous decision loops on metrics/signals
8. **Cron Workflows** — scheduled campaign batches, digest emails
9. **Telegram Bot Commands** — `/campaign`, `/status`, `/results` — real-time user interaction
10. **Analytics Dashboard** — MCU burn, mission success rate, revenue trending

**Key insight:** Items 2, 6, 7 are LLM-heavy. Items 1, 4, 5, 8, 9, 10 already work locally (just need orchestration). **Customer's LLM inference is TODAY's bottleneck.**

---

## §2 — Local-vs-Cloud Split Matrix

| Job | Classification | Rationale |
|---|---|---|
| Proposal generation (Claude) | HYBRID | Customer provides own API key (BYOK), but Sophia Workers orchestrate. Route inference locally if mekongd running. |
| Agent journal writes | LOCAL | Customer's own data — should stay in their SQLite mirror or shipped to D1. Zero transit friction. |
| Weekly digest email | HYBRID | Aggregate queries run on D1 (cloud source of truth), render Markdown locally. Sophia sends email (Resend). |
| Tier conversion (IPN) | CLOUD | Payment processor webhooks can't reach localhost. Must stay on Sophia Workers. |
| Affiliate scoring | LOCAL | Pure inference — Qwen 3.6 local via mekongd. No API dependency. |
| CTO/CMO/CSO/COO decisions | LOCAL | Agent loop runs on customer's hardware. Reads local journal + D1 aggregates. Emits decisions back to D1 signals table. |
| Cron/task scheduling | HYBRID | Task definition in cloud (D1), execution on customer's local daemon (via mekongd task API). |
| Telegram bot | CLOUD | Webhook -> Sophia Workers -> dispatch to local task queue. Bot stays on public cloud. |
| Analytics dashboard | CLOUD | Real-time MCU metrics. D1 is single source. Dashboard stays in Sophia SPA. |

**Cloud-only critical:** IPN webhook, public Telegram endpoint, shared D1 (source of truth for all customers).

---

## §3 — Customer Onboarding ("Activate Local Mode")

**Sequence (ONE-LINER install goal):**

```
1. Customer signs up → Sophia detects OS = macOS M1/M2/M3 + RAM ≥ 32GB
   → Setup Wizard offers tab: "Use Local AI (Optional)"

2. If yes → guided setup:
   - Detect mekongd: check ~/bin/mekong --version
   - If missing: ONE-LINER install
     `curl -fsSL https://github.com/longtho638-jpg/mekong-ide-core/releases/latest/download/install.sh | bash`
   - If present: verify `/v1/health` (already running via launchd)

3. Auto-configure Cloudflare Tunnel (NO manual cert mgmt):
   - Sophia provisions CF account token (server-side encryption, D1 storage)
   - Generate unique tunnel hostname: customer-{org_id}.tunnel.agencyos.network
   - Auto-generate + deploy tunnel config: ~5 lines YAML
   - Validate: curl tunnel hostname → 200

4. Paste tunnel URL into Sophia setup wizard "Local Endpoint" field
   - Sophia health-checks /v1/health on customer's tunnel hostname
   - If 200 → toggle ON "Local LLM Mode"
   - Stores tunnel URL in customer's encrypted D1 row

5. Going forward:
   - All Proposal/Affiliate/Agent inference → try tunnel first (5s timeout)
   - Fallback to BYOK OpenRouter if tunnel down (no user action needed)
```

**UI Changes Required:**
- Setup Wizard: add Step 2.5 "Local AI" tab (optional, collapsible)
- Dashboard Settings → "Local Mode": show tunnel status + health check logs
- New API endpoint `/api/setup/configure-tunnel` (CF token provisioning, validation)

**Reusable Patterns:**
- Setup wizard already validates API keys → reuse `verifyKey` pattern for tunnel health check
- BYOK timeout wrapper (`lib/byok/with-timeout.ts`) already exists → wrap local endpoint calls

---

## §4 — a16z Solo Doctrine Compliance Check

**The Doctrine:** "Agents do EVERYTHING. Human = strategist only. Never ask user to do agent work."

**Does Local Mode comply?**

❌ **FAILURE POINTS:**
- Cloudflare Tunnel requires cert management (if manual). Customer shouldn't touch this.
- mekongd startup could fail silently (M1 Max isn't customer's machine — it's ours).
- Agent loop on local hardware is new operational surface (logs, crashes, recovery).

✅ **COMPLIANT PATHS:**
- Pre-built CF Tunnel auto-config: Sophia handles it all. No customer decision.
- mekongd launchd service auto-starts: customer does nothing post-install.
- Local agent failures → fallback to cloud BYOK (graceful, no handoff).
- Local journal writes → auto-synced to D1 (no manual export).

**REDESIGN REQUIRED:** Don't ask customer "do you want local mode?" Instead:
- Auto-detect mekongd on customer's machine (if they mention M1 Max in profile)
- Auto-provision tunnel + push config silently
- Let customer discover "local mode is ON" via analytics (faster response times)
- If mekongd goes down → auto-fallback, zero disruption

**Post-redesign compliance: ✅ PASS** — customer never touches infrastructure.

---

## §5 — MVP Scope (Iteration 1)

**What ships first (MINIMUM viable loop):**

1. **Setup Wizard Integration (1 day)**
   - Add "Local Mode Available" banner if customer's org has M1 Max detected
   - Link to auto-config endpoint
   - NO UI build — reuse existing input fields + validation patterns

2. **Tunnel Auto-Config API (2 days)**
   - `POST /api/setup/configure-tunnel` — provisions CF token + validates endpoint
   - Stores encrypted tunnel URL in customer's D1 row
   - Returns status: `{status: "ok" | "error", tunnel_url?, error?}`

3. **Local Inference Adapter (1 day)**
   - New `lib/ai/local-inference-adapter.ts` — wraps `withTimeout()` for Qwen 3.6
   - Route Proposal generation → try local first (5s timeout), fallback to BYOK
   - NO new UI — just request routing change

4. **Monitoring + Docs (1 day)**
   - Dashboard "Local Mode Status" card: tunnel health + last 3 calls (latency, provider)
   - Email setup docs: `docs/local-mode-setup.md` (Vietnamese + English, step-by-step, 1 screenshot)

5. **Tests (1 day)**
   - Unit tests: tunnel config validation, timeout behavior, fallback logic
   - Integration test: end-to-end proposal gen with local endpoint mock

**Defer to Iteration 2:**
- Agent journal local persistence (keep writing to D1 for now)
- Affiliate scoring inference split
- CTO/CMO/CSO/COO local agent loops
- Advanced monitoring (logs aggregation, crash recovery)

**Total: ~5 days for MVP. Ships with Sophia by end of week.**

---

## Honest Assessment: Infrastructure Burden

**Real talk:** Cloudflare Tunnel solves the public IP problem, but introduces operational risk:

| Risk | Impact | Mitigation |
|---|---|---|
| Tunnel goes down | Customer's local LLM becomes unreachable. Fallback to BYOK works. | Health checks every 30s. Slack alerts to customer (opt-in). |
| mekongd crashes | LLM inference hangs until manual restart. | Launchd auto-restart + watchdog (brew services). Add to v0.1.11. |
| Customer enables VPN/WARP | Tunnel DNS breaks (local resolver conflicts). | Detect + warn in setup wizard. Document workaround. |
| CF token leaks | Attacker can provision competing tunnels. | Rotate tokens quarterly. Store encrypted. Audit logs in D1. |

**Simpler alternative (if above unacceptable):**
- Ship **prebuilt Docker container** + ngrok one-liner. Ngrok is 10x simpler (no certs, no DNS). One-liner: `docker run -p 11434:11434 ollama/ollama && ngrok http 11434`. Customer pastes ngrok URL into Sophia. Trade-off: adds Ollama/ngrok as external dependency (not Mekong). Acceptable for MVP but less "solo" (depends on third-party services).

**Recommendation:** Go with Cloudflare Tunnel (we control the infra). If customer ops burden surfaces, pivot to Docker+ngrok in v2.

---

## Open Questions

1. **D1 encryption for CF tokens:** Which cipher? AES-256-GCM + customer's auth session key as KDF input? Verify with security review.
2. **Tunnel naming collision:** If two customers named "Acme Corp", hostname generation needs collision resolution. Use org_id hash?
3. **Fallback latency:** 5s timeout for local endpoint. If customer's M1 Max is remote-only (SSH), latency could hit timeout. Revisit after MVP metrics.
4. **Multi-machine:** Customer with both M1 Max (local) + M1 Pro (remote SSH). Should we route to both? Or just one? Spec needed.
5. **Agent audit trail:** Local agent decisions run off-cloud. How do we log them back to D1 signals table for founder visibility? Periodic sync? Real-time? Volume concern?
6. **Polar compliance:** "Local AI inference" safe wording? Check with Polar (if product ever needs Polar again).
