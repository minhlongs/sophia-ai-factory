# SYNTHESIS — Planner Decisions + Unresolved Questions

> Consolidates research outputs (video-gen, affiliate, claudekit-distill, monorepo-map) into actionable decisions + license blockers.
> See [RESEARCH-SUMMARY.md](RESEARCH-SUMMARY.md) for full executive summary.

---

## 1. Auto-Mode Defaults (locked unless user overrides)

| # | Decision | Default | Reason |
|---|----------|---------|--------|
| 1 | Composer | **Remotion clean-room MoviePy fallback** | Avoid Remotion $500/mo company license risk |
| 2 | GPU runner | **Runpod** | Lower hourly $$$ vs Lambda Labs / Modal cold-start |
| 3 | RefearnApp port | **Clean-room TS port** | AGPL viral risk killed via REST gateway sidecar dropped |
| 4 | Region | **VN-first (AccessTrade)** | Lower CAC, founder relationships, currency simpler |
| 5 | Mod | **AI auto-mod tier-1, human-in-loop tier-2+** | Workers AI + tiered escalation = cost-bounded |

---

## 2. Distilled Stack (from research)

```
Script:   Qwen 3 32B local (Ollama @ localhost:11434)        — Free
Audio:    Coqui XTTS Docker (localhost:8000, MPL-2.0)         — Free self-host
T2V:      HunyuanVideo 1.5 (Apache 2.0, Runpod GPU rental)    — $5-15/cinematic
Compose:  Remotion TS (clean-room MoviePy fallback)           — $0.10-0.50/template
Cost:     $5.50-16.55/cinematic OR $0.35-1.00/template
```

---

## 3. Phase 6-14 Critical Path

```
6 (D1 schema + FSM + Inngest + R2)
   ↓
7 (Coqui TTS Worker proxy) ∥ 8 (template + cinematic 2-path)
   ↓
9 (TikTok/AccessTrade/ClickBank/Awin/Amazon + cloak)
   ↓
10 (TikTok Shop/YT Shorts/IG Reels publisher)
   ↓
11 (RLS + quota tiers + cost ledger) ∥ 12 (OpenClaw orchestrator)
   ↓
13 (commission ledger + USDT NOWPayments + 14d clawback)
   ↓
14 (E2E + k6 + security + GDPR + FTC)
```

---

## 4. License Blockers (verify before code)

- [ ] Remotion license re-check (confirm MoviePy-only path adequate for tier-1)
- [ ] HunyuanVideo Apache 2.0 commercial use clarification
- [ ] AccessTrade ToS — check "automated content gen" clause
- [ ] TikTok Shop API — affiliate posting rate limits + appeal flow

---

## 5. Unresolved Questions (5)

User must override defaults if needed:

1. Remotion company license $500/mo OR clean-room MoviePy fallback only? **DEFAULT: MoviePy**
2. GPU runner Runpod vs Lambda vs Modal? **DEFAULT: Runpod**
3. RefearnApp AGPL workaround clean-room TS or REST gateway sidecar? **DEFAULT: clean-room TS**
4. VN-first vs global launch? **DEFAULT: VN-first**
5. Mod AI auto vs human tier-gated? **DEFAULT: AI tier-1 + human tier-2+**

---

## 6. ClaudeKit Pattern Adoption (from claudekit-distill)

- 10 OpenClaw primitives → wire in Phase 12
- Layer contract: `seed/` → `tree/` → `forest/` → `land/` (matches solo-platform v6)
- Memory: SQLite + ChromaDB per tenant (Phase 11 isolation)
- Subagent orchestration: planner → fullstack-developer → tester → code-reviewer (all phases)
