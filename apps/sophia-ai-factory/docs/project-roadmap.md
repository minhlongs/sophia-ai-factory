# Sophia AI Factory — Strategic Roadmap from Open-Source Distillation

**Date:** 2026-04-30 | **Last Sync:** 2026-05-12 | **Research:** 8 OSS projects, 6 monetization patterns, 7 orchestration patterns

---

## Key Takeaway

Sophia's architecture is already competitive. Gaps are in **monetization UX** (credit display, usage-pressure conversion) and **growth** (affiliate program). Video pipeline is solid — needs polish, not rebuild.

---

## Status Snapshot (2026-05-12)

Wave 24 (2026-05-12) ships **FREE100 Distribution Readiness** — non-tech CEO can onboard end-to-end with zero founder touch until DNS/Resend/Sentry/Crisp setup. See `project-changelog.md` v1.24.0 for per-commit map.

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

### 🔴 Sprint 1: Conversion (this week)

| # | Action | Pattern Source | Effort |
|---|--------|---------------|--------|
| 1 | Credit bar on dashboard — "You've used X/Y videos this month" | PostHog usage-pressure | 2h |
| 2 | Pricing page — add "most popular" badge + per-credit cost breakdown | PostHog/Stripe pattern | 1h |
| 3 | Upgrade CTA at 80% quota — "Unlock unlimited videos" | PostHog 90%+ conversion rate | 1h |

### 🟡 Sprint 2: Growth (next week)

| # | Action | Pattern Source | Effort |
|---|--------|---------------|--------|
| 4 | Affiliate program — 20% recurring 12mo, double-sided reward | Dub.co ($10M+ payouts) | 3h |
| 5 | Referral link generator + dashboard | Dub.co embedded dashboards | 2h |
| 6 | SEO: programmatic landing pages for "AI video [niche]" | Content strategy pattern | 4h |

### 🟢 Sprint 3: Moonshots (monthly)

| # | Action | Pattern Source | Effort |
|---|--------|---------------|--------|
| 7 | Open-source HeyGen alternative (FaceFusion+Wav2Lip+TTS) | SadTalker 13K★ | 2 weeks |
| 8 | Auto-affiliate product discovery via OpenClaw agents | ClaudeKit multi-agent | 1 week |
| 9 | Crypto payment gateway (USDT → auto tier activation) | NOWPayments IPN pattern | 3 days |

---

## Success Metrics Update (2026-05-12)

**Engineering Achievement:** "Zero founder touch from magic-link to first video" is now structurally achievable.

| Metric | Target | Current | Notes |
|--------|--------|---------|-------|
| Self-serve onboarding completion | > 90% | Structural ✅ | Help Center + tour + hints |
| Founder support email volume | < 1/week | TBD | Baseline after FREE100 wave |
| Time to first video (self-serve) | < 15 min | Measured by QA | Includes BYOK + SOP install |
| Bilingual UI coverage | 100% | 98% | `validate-i18n-keys.mjs` enforces |
| Test suite | > 5000 | 5200 | Comprehensive (44 suites) |

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
