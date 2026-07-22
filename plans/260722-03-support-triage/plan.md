# L-Plan: ID-03 AI-Powered Support Triage
> Created: 2026-07-22 | Worker: planner | Contract: M1 | Priority: P1

## Objective
Deflect 60-70% of support tickets via existing Telegram bot with L1 deterministic + L2 LLM-assisted tiers.

## Assumed Decisions (overridable)
- Extend existing @Sophia_Bbot — no new interface
- L1: pattern-match common queries (deterministic; no LLM)
- L2: RAG on SOPs + Sophia docs with daily per-user rate limit
- L3: human escalation with pre-filled context

## Phase 1: L1 Triage Matrix (2h)
- Pattern-match canonical queries:
  - API key reset -> execute reset action
  - Quota display -> show current usage
  - Billing questions -> show plan + usage delta
- Responses: deterministic; no hallucination risk

## Phase 2: L2 RAG Scope (3-4h)
- Corpus: SOPs + docs only (no external web)
- Per-user daily cap: configurable env var with conservative default
- Safety: no pricing promises outside documented tiers
- Bilingual VN+EN templates

## Phase 3: L3 Escalation (1-2h)
- Payment dispute / tier-upgrade dispute / bug report -> operator
- Escalation message includes:
  - user tier, last 5 usage events, recent bot interactions
- Outside working hours: queue visible for next operator slot

## Phase 4: Protected Flow Safeguards (1h)
- Setup Wizard /campaign /status /results flows MUST NOT be affected
- Regression tests: existing commands return identical behavior when triage is off

## Verification Gates
- npm test: existing suite + new triage unit tests
- Manual: send common queries -> verify L1 response; multi-lang check
- Load: rate-limit test within L2 daily cap

## Risks
- L2 RAG cost blowout if rate limit missing (mitigation: hard cap)
- Bot must not break Setup Wizard (protected-by-default rule)
