---
title: "Zero-Bug RaaS Handover — Homepage Promise vs Code Reality Audit"
date: 2026-05-16
type: brainstorm
status: pending
priority: P0
scope: WIDE — all 30 homepage promises
approach: honest-pivot (fix false-claim copy) + wiring verification + multi-phase remediation plan
ask: ensure customer can sign up → BYOK → run full RaaS loop (campaign → video → telegram → publish) zero bugs, matching homepage architecture
---

# Brainstorm — Zero-Bug Handover for RaaS Video Gen Flow

## 1. Problem Statement

**Goal:** Customer who lands on `sophia.agencyos.network` can sign up → input own keys (BYOK) → run full RaaS loop → output video matching what homepage promises. Zero bugs. Architectural fidelity verified.

**Constraint:** No-tech doctrine v1.28.1 — customer inputs 100% of keys. Operator manages platform code + CF bindings only. Audit MUST honor this.

**Tension:** Some homepage promises (SOC 2, 4.9 rating, real testimonials, 99.99% uptime) cannot be delivered without either (a) months of operator track record, or (b) outright marketing fabrication. Doctrine forbids both. **Solution: honest pivot — fix the copy.**

## 2. Promise Inventory (30 testable claims)

### Group A — Architecture / Wiring (MUST VERIFY)

| # | Promise | Source | Status |
|---|---------|--------|--------|
| P4 | Edge Deployed | hero.trust_edge | ✅ CF Workers |
| P5 | 17 AI commands | raas.stats.stat1 | ⏳ Count actual implementations |
| P9 | 50 leads in <60s | raas.features.lead | ⏳ Benchmark lead-gen mission |
| P10 | Commands via Telegram OR API | raas.features.commands | ⏳ Both channels parity |
| P11 | @Sophia_Bbot live | raas.terminal.cta | ⏳ Bot responds to /campaign, /status, /results |
| P12 | Workflow 4 steps: select_niche → ai_generate → publish → profit | workflow.steps | ⏳ E2E exists |
| P13 | 5+ YouTube channels from 1 dashboard | features.multi_channel | ⏳ Multi-channel OAuth wired |
| P14 | Auto-affiliate links into video descriptions | features.auto_affiliate | ⏳ Affiliate engine in publish pipeline |
| P15 | KOL Voice Cloning (ElevenLabs) | features.voice_cloning | ⏳ Voice clone API call |
| P16 | AI Script Generation, SEO-optimized | features.script_gen | ✅ OpenRouter wired |
| P17 | 24/7 Auto-Publishing | features.auto_publish | ⏳ Cron scheduler exists |
| P18 | Global Reach translate+localize | features.global_reach | ⏳ Caption-translator wired |
| P19 | Premium: PartnerStack + Impact.com API + weekly auto-updates | features.highlight | ⏳ Tier-gated integrations |
| P25 | Affiliate DB has SmartSuite 50%, Shopify 200% | faq.money | ⏳ DB seed check |
| P26 | OpenRouter + ElevenLabs + D-ID wired (BYOK) | faq.quality | ⏳ All 3 BYOK paths work |
| P27 | <40min video creation (5+10+3+15+5) | faq.time | ⏳ Real benchmark |
| P29 | 30-day money-back refund | faq.refund | ⏳ Refund flow exists |
| P30 | Tier gating: MCU, campaigns/mo, channels, commands, team | pricing.features | ⏳ Tier enforcement |

### Group B — False / Aspirational Claims (FIX COPY)

| # | Promise | Source | Action |
|---|---------|--------|--------|
| P1 | 99.99% Uptime | hero.trust_uptime | Remove or downgrade to "Edge-deployed reliability" |
| P3 | SOC 2 Certified | hero.trust_security | **Remove** — no cert, legal risk |
| P6 | 500+ Proposals Generated | raas.stats.stat2 | Mark as illustrative or use real counter |
| P8 | 99.9% Uptime SLA | raas.stats.stat4 | Downgrade to "Edge-class availability" or remove SLA claim |
| P20 | Testimonials (Michael Chen, Trang Nguyen, Sarah Anderson) | social_proof | Mark "Composite — based on early users" or remove names |
| P22 | 4.9/5 Creator Rating | social_proof.badges | **Remove** — no rating system exists |
| P23 | SOC 2 Compliant | social_proof.badges | **Remove** — duplicate of P3 |

### Group C — Quasi-verifiable / Performance

| # | Promise | Source | Action |
|---|---------|--------|--------|
| P2 | <50ms Response | hero.trust_response | Measure real TTFB; downgrade if false |
| P7 | <60s Mission Execution | raas.stats.stat3 | Benchmark mission queue |
| P21 | 256-bit Encrypted | social_proof.badges.secure | Verify TLS + BYOK crypto-at-rest spec |
| P24 | ROI math: $2 CPM + affiliate | roi.estimate_note | Calculator formula correctness |
| P28 | Pricing $199/$399/Premium | faq.tiers | Match pricing.tiers config |

## 3. Approach (Hybrid Static + Smoke)

Doctrine prevents operator from owning BYOK keys → cannot do full prod E2E without operator paying. Two-stage approach:

### Stage 1: Static Audit (no $ cost)
- **Group A (wiring):** grep code paths, trace promise → route → test → DB → external API client
- **Group B (false claims):** simple — edit `messages/en.json` + `messages/vi.json` + remove/downgrade strings
- **Group C (perf):** curl prod + read existing metric tables (status_checks, request logs)
- Output: gap matrix with PASS / FAIL / NEEDS-BUILD / NEEDS-COPY-FIX per promise

### Stage 2: 1 Smoke Test (operator's own keys, opt-in)
- Operator pays own ~$30-100 for OpenRouter+HeyGen+ElevenLabs+Telegram
- Creates `test+audit@...` user via Setup Wizard, runs golden path
- Cleanup SQL afterwards
- ONLY if Stage 1 finds < 5 wiring gaps (else fix those first)

## 4. Multi-Phase Remediation Plan (proposed)

### Phase 01 — Copy Honest Pivot (P1, P3, P6, P8, P20, P22, P23)
**Effort:** S (~30min)
**Scope:** Edit `messages/en.json` + `vi.json`. Remove SOC 2 references entirely. Downgrade uptime to non-SLA wording. Mark testimonials as "composite — based on early users" or replace with abstract case studies. Drop 4.9 rating until rating system exists.
**Output:** PR `chore(landing): honest-pivot marketing claims — doctrine consistency`

### Phase 02 — Wiring Audit (Group A static)
**Effort:** M (~2-3h)
**Scope:** For each of P5, P9, P10, P11, P12, P13, P14, P15, P17, P18, P19, P25, P26, P27, P29, P30 → trace promise → code → DB → external API → tests. Identify which exist, which need build.
**Output:** `plans/reports/audit-{date}-promise-wiring-matrix.md` — PASS / FAIL / NEEDS-BUILD

### Phase 03 — Perf Verification (Group C)
**Effort:** S (~1h)
**Scope:** Measure P2 TTFB, P7 mission latency, P21 crypto spec, P24 ROI formula correctness, P28 pricing consistency.
**Output:** Append to wiring matrix.

### Phase 04 — Wiring Fixes (per Phase-02 NEEDS-BUILD)
**Effort:** Variable — depends on Phase 02 findings
**Scope:** Each NEEDS-BUILD becomes a sub-task. Likely candidates: missing tier gates, missing affiliate DB seeds, missing voice-clone wiring if not BYOK-ready, missing 24/7 publish cron.
**Output:** Multiple commits per sub-task.

### Phase 05 — Smoke Test (operator-driven, $)
**Effort:** L (~4-6h wall-clock incl waits)
**Scope:** Stage 2 from §3. Operator creates test account, runs full flow with own keys, documents every issue. Cleanup SQL afterwards.
**Output:** `plans/reports/smoke-{date}-test-account-run.md` with screenshots/logs.

### Phase 06 — Final Handover Sign-Off
**Effort:** S (~30min)
**Scope:** All gaps closed OR explicitly accepted as deferred-with-reason. Update homepage if any claims still drift. Write final handover doc.
**Output:** `plans/reports/handover-{date}-raas-zero-bug.md`

## 5. Success Metrics

- **0 false claims** on homepage (SOC 2, 4.9 rating, fabricated SLA, fake names removed/recharacterized)
- **100% of Group A promises** mapped to verified code + test (PASS) or accepted exception (deferred)
- **1 smoke test run** completes golden path end-to-end without operator intervention
- **0 P0/P1 wiring bugs** open at handover
- Customer signing up via real Setup Wizard can output a real video on their own BYOK without support

## 6. Risks

| Risk | Mitigation |
|------|-----------|
| Marketing pushback on removing SOC 2 / 4.9 rating | Frame as legal protection; offer aspirational replacement copy ("Built on SOC 2-compliant infra: Cloudflare + Better Auth") |
| Phase 02 finds many NEEDS-BUILD items → Phase 04 explodes | Cap Phase 04 at P0/P1 only. Defer P2 to backlog. |
| Smoke test fails on operator BYOK costs | Make Phase 05 optional. Static audit is the gate; smoke is bonus confidence. |
| Parallel CC CLI sessions touching same files | Use `git fetch` + `git status` before each commit. Audit reports are append-only. |
| Doctrine drift — temptation to "just build SOC 2" instead of removing claim | Anchor on no-tech-doctrine v1.28.1: months not weeks. Reject scope creep. |

## 7. Out of Scope

- Building actual SOC 2 compliance (months, operator audit)
- Generating real testimonials (requires real user outreach + signed quotes)
- Achieving 99.99% uptime (operator track record over months)
- Building rating system (separate feature, not blocker)
- Customer-side migration tooling (separate workstream)

## 8. Next Step Recommendation

Invoke `/ck:plan` (or `/plan`) with this brainstorm as input → produce `plans/260516-{time}-raas-zero-bug-handover/plan.md` + phase files matching the 6-phase outline in §4.

Plan should have:
- `plan.md` with YAML frontmatter `status: pending`
- 6 phase files (one per phase above)
- Each phase: context links, requirements, related code files, implementation steps, todo checkboxes, success criteria, risks, security considerations

After plan accepted → `/cook` to execute phase-by-phase. Phase 01 (copy fix) can ship same session (low-risk, doctrine-aligned).

## 9. Unresolved Questions

1. Does operator want to **fully replace** testimonial names with abstract case studies, or **disclose** "composite based on early users" (legal-safer disclosure)?
2. Phase 04 budget — what's the cap before declaring "ship as-is and downgrade homepage further" instead of building?
3. Phase 05 smoke test — operator willing to spend ~$30-100 own money for one E2E run? If not, what's the substitute confidence signal (more thorough static + community beta)?
4. Sentry sourcemap (doctrine OUT-OF-SCOPE) — do we want it back as in-scope under "honest pivot" theme since handover quality matters? Or stays out per doctrine?
5. Homepage `compare_price: $9,588` vs `vs $799/mo × 12 months` Master tier claim — verify pricing math matches actual config.
