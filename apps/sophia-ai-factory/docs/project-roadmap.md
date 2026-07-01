# Sophia AI Factory — Strategic Roadmap from Open-Source Distillation

**Date:** 2026-04-30 | **Last Sync:** 2026-07-01 | **Research:** 8 OSS projects, 6 monetization patterns, 7 orchestration patterns

---

## Key Takeaway

Sophia's architecture is already competitive. Gaps are in **monetization UX** (credit display, usage-pressure conversion) and **growth** (affiliate program). Video pipeline is solid — needs polish, not rebuild.

---

## Status Snapshot (2026-07-01)

**Polish Wave (2026-07-01)** — Middleware Option B fix (API routes through centralized security, skip locale redirect), `/vi/guides` → `/guide` redirect, pricing page code-split (CheckoutPanel dynamic import). Sprint 2 audit confirms all 3 items already implemented. Roadmap synced.

**Phase 05a (2026-05-18)** — **Security Audit + Regression Tests** — ASVS L2 desk-review (31 controls: 26 Pass / 2 Fail / 3 N-A = 84% score). 3 Medium findings (F01/F02/F03) logged; 35 new security regression tests (brute-force, IDOR, privilege escalation patterns). Zero HIGH/CRITICAL vulns. Phase 06 roadmap updated. FREE100 handover progression → CHECKPOINT.

**Wave 27 (2026-05-15)** ships **RaaS Global Multi-Channel** — 8-phase feature batch adds 10 affiliate networks (4 crypto + 6 SaaS), anti-scam/EPC scoring, one-click bundle publishing with geo-aware caption translation, unified revenue dashboard, per-jurisdiction crypto compliance, and per-channel cooldown protection. Score: 91.5 → 93/100. All 47 new tests pass. Deploy CF-direct verified.

**Wave 26 (2026-05-12)** ships **Mekong SOP Gap Bridge** — unified developer SOPs (277 LOC doc), 5 CI gates (G1-G5 via husky + npm), + DI inversion for layer boundaries (seed→forest exemptions eliminated). Closes 3 gaps vs mekong baseline. 0 GitHub Actions changes (CF-direct doctrine preserved). Versions 1.26.0 / 1.26.1 / 1.26.2 shipped sequentially. See `docs/dev-sops.md` for canonical onboarding guide.

**Wave 25 (2026-05-12)** **Consolidates proposal surfaces** — deleted `apps/sophia-backend` (FastAPI, 1003 LOC, never integrated) and `apps/sophia-proposal` (deprecated, 459 files, 10,459 LOC); ported real proposal generation into canonical `src/seed/ai/` module set (645 new LOC, OpenRouter gateway). Monorepo net **-11,089 LOC**. POST /api/proposals now ACTIVE.

**Wave 24 (2026-05-12)** ships **FREE100 Distribution Readiness** — non-tech CEO can onboard end-to-end with zero founder touch until DNS/Resend/Sentry/Crisp setup. See `project-changelog.md` v1.24.0 for per-commit map.

### Wave 24 Deliverables (8 commits, ~5200 tests pass)

| Commit | Deliverable | Goal |
|--------|-------------|------|
| `4422ef9a` | Help Center index + FAQ (15 Q) + Troubleshooting (10 issues) bilingual | Self-serve support |
| `8ddc0b69` | Onboarding tour steps 5→7 (Telegram pairing, Help Center links) | UX flow complete |
| `31980da6` | First-time SOP install hint + post-install callout | Discovery guidance |
| `2af113e3` | ByokHelpTip surfaced on /dashboard/byok form | Setup clarity |
| `fa08db9a` | FREE100 provenance pill under MASTER tier badge | Transparency |
| `bbbc7d9e` | Quick-start launcher (3 ETAs) on Help Center index | Rapid onboarding |
| `f372fa89` | `scripts/analyze-free100-redemptions.sh` (D1 founder analysis) | Ops insight |
| `bd0bfc62` | `scripts/validate-i18n-keys.mjs` template-literal detection | Bilingual integrity |

**Result:** Non-tech FREE100 redeemer can traverse welcome → BYOK → SOP install → first video → Telegram pairing → Help Center entirely via self-serve UI. Founder-only items (DNS, Resend, Sentry, Crisp, 4-inbox drill) documented in `docs/handover/founder-cheat-sheet-260512.md`.

**Prior wave (23, 2026-05-11):** GAP plan closure + test-infra + ops hardening (Stripe Connect, NOWPayments, postmortems, guards).

---

## Milestone: Partner Self-Serve Onboarding (2026-05-12)

✅ **Achieved**: Free100 redeemers can onboard with zero founder touch until external credential setup.

### Completion Checklist
- ✅ Help Center (bilingual: vi + en)
- ✅ Onboarding tour (steps 1-7, integrated)
- ✅ SOP install UX (hints + post-callout)
- ✅ BYOK setup clarity (ByokHelpTip)
- ✅ Tier attribution (FREE100 pill)
- ✅ Quick-start launcher (eta indicators)
- ✅ Founder ops tools (D1 analysis script)
- ✅ i18n integrity (template-literal detection)

### Pending: Founder-Only Tasks (Blocked on external credentials)

| Task | Reason | Owner | Target |
|------|--------|-------|--------|
| DNS verification (CNAME + MX) | Domain setup | CEO | External registrar |
| Resend tracking toggle | Email logs | CEO | Resend dashboard |
| Sentry signup + DSN injection | Error tracking | Founder | Sentry setup |
| Crisp.im wire + webhook | Support chat | Founder | Crisp dashboard |
| 4-inbox drill (email→Telegram→Sentry→Crisp) | Integration test | QA | After all 4 above |

All documented in `docs/handover/founder-cheat-sheet-260512.md`. **These do NOT block user feature delivery.**

---

## Priority Actions (by ROI)

### ✅ Sprint 1: Growth (SHIPPED 2026-05-15)

| # | Action | Status | Effort |
|---|--------|--------|--------|
| 1 | Affiliate program — 10 networks (4 crypto + 6 SaaS), 70/30 split | ✅ SHIPPED | 8 phases |
| 2 | Anti-scam + EPC scoring — 6-factor model + blacklist | ✅ SHIPPED (Phase 03) | 4h |
| 3 | One-click bundle publishing — 4 presets + channel gating | ✅ SHIPPED (Phase 04/10) | 6h |
| 4 | Geo-aware caption translation — BYOK OpenRouter + locale mapping | ✅ SHIPPED (Phase 05) | 3h |
| 5 | Unified revenue dashboard — SaaS + Crypto + Affiliate | ✅ SHIPPED (Phase 07) | 4h |
| 6 | Per-jurisdiction crypto compliance — 5 regions, KYC banner + video overlay | ✅ SHIPPED (Phase 08) | 5h |

### ✅ Sprint 2: A/B Testing & Help Content (SHIPPED 2026-07-01)

| # | Action | Pattern Source | Effort | Status |
|---|--------|---------------|--------|--------|
| 7 | A/B title/thumbnail runner (Phase 06) — decide winner threshold | Internal | 2h | ✅ SHIPPED — `thumbnail-ab-selector.ts` Inngest cron, CTR comparison, 48h window |
| 8 | Help videos library (Phase 09) — founder content recording | Editorial | 2 days | ✅ SHIPPED — `dashboard/help/` with video player, FAQ, troubleshooting, SOPs |
| 9 | Credit bar on dashboard — "You've used X/Y videos this month" | PostHog usage-pressure | 2h | ✅ SHIPPED — `sidebar-quota-widget.tsx` via `/api/quota/status`, video + credit tracking |

### 🟢 Sprint 3: Moonshots (next sprint)

| # | Action | Pattern Source | Effort |
|---|--------|---------------|--------|
| 10 | Programmatic landing pages for "AI video [niche]" | SEO content strategy | 4h |
| 11 | Open-source HeyGen alternative (FaceFusion+Wav2Lip+TTS) | SadTalker 13K★ | 2 weeks |
| 12 | Auto-affiliate product discovery via next agent wave | Agentic next phase | 1 week |

---

## Success Metrics Update (2026-05-15)

**Engineering Achievement:** Wave 27 RaaS Global Multi-Channel expansion enables 3-stream revenue (SaaS + Crypto + Affiliate) with compliance scaffolding for 5 jurisdictions.

| Metric | Target | Current | Notes |
|--------|--------|---------|-------|
| Affiliate networks supported | 6+ | 10 ✅ | 4 crypto + 6 SaaS; expandable |
| Anti-scam scoring latency | < 500ms | ~300ms | Cached weekly; live 6-factor model |
| Bundle publish channels | 8+ | 13 ✅ | TikTok, Instagram, YouTube, LinkedIn, Twitter, Telegram, Snapchat, Pinterest, Reddit, Discord, Bluesky, Threads, BeReal |
| Crypto compliance regions | 2+ | 5 ✅ | US, EU, VN, SG, JP; KYC gating + disclaimers |
| Revenue streams unified | 2 | 3 ✅ | SaaS MRR + NOWPayments USDT + Affiliate commissions |
| Self-serve onboarding | > 90% | Structural ✅ | Help Center + tour + affiliate discovery |
| Test suite | > 5000 | 1450+ | New: 47 tests (bundle, scoring, cooldown) |
| Build time | < 15s | 17.7s | Acceptable (CF-direct doctrine) |

---

## ClaudeKit Architecture Integration

Sophia already uses ClaudeKit's `cook` pipeline (plan→code→review→test). To scale:

1. **Parallel development:** Git worktrees + lock-based file ownership
2. **Model tiering:** Opus for architecture, Sonnet for features, Haiku for docs
3. **Plugin architecture:** Isolated features as skills (billing, video-gen, affiliate)

---

## Research Reports

- `plans/reports/research-260430-claudekit-orchestration.md` — 7 orchestration patterns
- `docs/research/saas-monetization-patterns-260430.md` — 6 monetization patterns
- `plans/research-ai-video-saas-260430.md` — 8 OSS video projects

---

*Generated by OpenClaw RAAS pipeline — Sophia AI Factory 2026*
