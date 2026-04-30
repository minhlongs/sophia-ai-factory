---
title: "Sophia AI Factory — Video-Gen Affiliate SaaS Master Plan"
description: "Hợp nhất 3 sophia repos + build OpenClaw-orchestrated video-gen affiliate SaaS trên canon monorepo"
status: in-progress
priority: P1
effort: XL (14 phases, ~8-12 tuần)
branch: main
tags: [sophia, video-gen, affiliate, openclaw, multi-tenant, saas]
created: 2026-04-29
---

# Sophia AI Factory — Master Plan

> **Mục tiêu:** Hợp nhất 3 sophia repos → 1 canon (`~/projects/sophia-ai-factory/`), rồi extend `apps/sophia-ai-factory/` thành video-gen affiliate SaaS, vận hành bằng OpenClaw agentic layer.
> **Mode:** /cook --auto | **Tech:** Next.js 16 + D1 + Better Auth + Cloudflare Workers + NOWPayments

---

## Canon Stack (KHÔNG ĐỔI)

- **App:** `apps/sophia-ai-factory/` (Next.js 16, React 19, TS 5.7)
- **DB:** Cloudflare D1 + Kysely ORM
- **Auth:** Better Auth 1.6.2
- **Payment:** NOWPayments (USDT) + Stripe legacy. **Polar.sh BANNED**.
- **Storage:** R2 + KV + Upstash Redis
- **Queue:** Inngest
- **Bot:** Telegram (@Sophia_Bbot)

---

## Lộ trình 14 Phase

### A. Consolidation (Phase 1-5)

| # | Phase | Status | File |
|---|-------|--------|------|
| 1 | Backup 3 sophia trees | ✅ DONE | [phase-01-backup.md](phase-01-backup.md) |
| 2 | Canonical Decision | ✅ AUTO-RESOLVED | [phase-02-canonical-decision.md](phase-02-canonical-decision.md) |
| 3 | Extract Python Backend | ✅ DONE (stack mismatch) | [phase-03-extract-python-backend.md](phase-03-extract-python-backend.md) |
| 4 | Merge sophia-proposal Drift | ✅ NO-OP (canon ahead) | [phase-04-merge-sophia-proposal.md](phase-04-merge-sophia-proposal.md) |
| 5 | Cleanup mekong-cli (rm untracked) | ✅ DONE 20:55 | [phase-05-cleanup-mekong-cli.md](phase-05-cleanup-mekong-cli.md) |

### B. Video Pipeline Foundation (Phase 6-8)

| # | Phase | Status | File |
|---|-------|--------|------|
| 6 | Video Pipeline Foundation (D1 schema, FSM, Inngest, R2) | ✅ DONE | [phase-06-video-pipeline-foundation.md](phase-06-video-pipeline-foundation.md) |
| 7 | Voice + TTS Service (Coqui XTTS Docker + CF Worker proxy) | ✅ DONE | [phase-07-voice-tts-service.md](phase-07-voice-tts-service.md) |
| 8 | Visual Generator (Template + Cinematic 2-path routing) | ✅ DONE | [phase-08-visual-generator.md](phase-08-visual-generator.md) |

### C. Affiliate Engine (Phase 9-10)

| # | Phase | Status | File |
|---|-------|--------|------|
| 9 | Affiliate Offer Engine (TikTok/AccessTrade/ClickBank/Awin/Amazon + Shlink-style cloak) | ✅ DONE 2026-04-30 (PR #20, sha fa729bd9) | [phase-09-affiliate-offer-engine.md](phase-09-affiliate-offer-engine.md) |
| 10 | Multi-Channel Publisher (TikTok Shop/YT Shorts/IG Reels) | ✅ DONE 2026-04-30 (PR #21, sha bb1ad2b4) | [phase-10-multi-channel-publisher.md](phase-10-multi-channel-publisher.md) |

### D. Tenancy + Orchestration (Phase 11-12)

| # | Phase | Status | File |
|---|-------|--------|------|
| 11 | Tenant Isolation + Quota Tiers (RLS, video quotas, cost ledger) | ✅ DONE | [phase-11-tenant-isolation-quotas.md](phase-11-tenant-isolation-quotas.md) |
| 12 | OpenClaw Orchestrator (10 primitives wired) | ✅ DONE 2026-04-30 (PR #20) | [phase-12-openclaw-orchestrator.md](phase-12-openclaw-orchestrator.md) |

### E. Revenue + Launch (Phase 13-14)

| # | Phase | Status | File |
|---|-------|--------|------|
| 13 | Revenue Split + Payouts (commission ledger, NOWPayments USDT, 14d clawback) | pending | [phase-13-revenue-split-payouts.md](phase-13-revenue-split-payouts.md) |
| 14 | Launch Hardening (E2E, k6, security, GDPR, FTC disclosure) | pending | [phase-14-launch-hardening.md](phase-14-launch-hardening.md) |

---

## Critical-Path Dependencies

```
1 → 2 → 4 → 5            (consolidation cleanup)
       ↓
       6 → 7,8 (parallel)  (video pipeline)
                ↓
                9 → 10     (affiliate + publish)
                     ↓
                     11 → 12    (tenancy + orchestrator)
                          ↓
                          13 → 14   (revenue + launch)
```

Phase 7 và 8 có thể chạy song song sau Phase 6.
Phase 11 + 12 có thể chạy song song sau Phase 10.

---

## Auto-Run Decision (mode /cook --auto)

Auto-execute toàn bộ Phase 4-5 (đã có backup), sau đó tiếp tục Phase 6-14 sequential trừ khi gặp **license blocker** (xem 5 unresolved questions tại research/SYNTHESIS.md).

Phase 2 vẫn cần user confirm vì 234-file 3-way merge có thể phá business logic — nhưng auto-mode sẽ áp dụng chiến lược "newer mtime wins + audit log", không xóa gì cho đến Phase 5.

---

## Research Inputs

- [video-gen OSS](research/researcher-260429-2050-video-gen-oss.md)
- [affiliate OSS](research/researcher-260429-2050-affiliate-oss.md)
- [ClaudeKit distill](research/researcher-260429-2050-claudekit-distill.md)
- [monorepo scout](research/scout-260429-2050-monorepo-map.md)
- [SYNTHESIS](research/SYNTHESIS.md) — planner decisions + unresolved questions

---

## Câu hỏi user PHẢI quyết (xem SYNTHESIS.md mục 5)

1. Remotion commercial license — buy company license $500/mo hay clean-room MoviePy fallback?
2. GPU runner provider — Runpod vs Lambda Labs vs Modal cho HunyuanVideo?
3. RefearnApp AGPL workaround — clean-room TS port hay thin REST gateway sidecar?
4. Regional deployment — VN-first (AccessTrade) hay global (TikTok Shop US)?
5. Content moderation — AI auto-mod (Workers AI) hay human-in-loop tier-gated?

Auto-mode default: Remotion clean-room MoviePy + Runpod + clean-room port + VN-first + AI auto-mod tier-1, human tier-2+.
