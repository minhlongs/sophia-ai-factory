---
title: "Sophia Giai đoạn 4 Slice A — Prompt Injection Guard"
description: "Enterprise Security from Solo Platform PDF Giai đoạn 4. Heuristic regex-based prompt injection detection at Supervisor Agent ingress."
status: in-progress
priority: P2
effort: 4h
branch: main
tags: [sophia, security, prompt-injection, giai-doan-4, solo-platform]
created: 2026-04-17
---

# Sophia Prompt Injection Guard

## Goal
Protect Supervisor Agent (shipped 26d0c52) from prompt injection attacks.
Maps PDF Giai đoạn 4 "Enterprise Security: Prompt Injection Protection" bullet.
Aligns with mekong-cli security pattern (SSRF/CORS/rate-limit defensive layering, agent-forest v0.1).

## Scope (YAGNI/KISS)
- Heuristic-only detection for MVP (regex + keyword patterns)
- Block obvious attacks: role hijacking, ignore-prior-instructions, prompt leak attempts, injected system prompts
- Integration point: POST /api/raas/workflows `prompt` field (before createWorkflow)
- D1 event PROMPT_INJECTION_DETECTED for analytics
- Rate: conservative (prefer false-negatives over false-positives) — tests validate ratio

## Out of Scope
- Lakera Guard / external API (defer — env var opt-in only)
- LLM-based classification (defer — latency + cost concern)
- PII/PHI detection (different domain)
- Setup wizard inputs (low LLM exposure, defer)

## Files

### Create
- `apps/sophia-ai-factory/src/lib/security/prompt-guard.ts` (~120 LOC)
  - `detectInjection(text: string): {flagged: boolean, reasons: string[], severity: 'low'|'medium'|'high'}`
  - Pattern library: role-switch, instruction-override, system-prompt-leak, markdown-injection, Unicode homoglyph, excessive-delimiters
- `apps/sophia-ai-factory/src/lib/security/prompt-guard.test.ts` (~150 LOC, ≥15 tests)
  - Positive: each attack pattern detected
  - Negative: legitimate prompts not flagged
  - Edge: short prompts, whitespace-only, unicode legitimate content

### Modify
- `apps/sophia-ai-factory/src/lib/signals/d1-event-types.ts` — add PROMPT_INJECTION_DETECTED event + Zod schema
- `apps/sophia-ai-factory/src/app/api/raas/workflows/route.ts` — call detectInjection() before createWorkflow; if severity='high', reject 400 + emit event; if 'medium', emit event but proceed with flag stored

## Integration
- POST /api/raas/workflows: after Zod parse, before createWorkflow
- Rejection payload: `{error: 'prompt_injection_detected', reasons: [...], severity: 'high'}`
- Signal event shape: `{reasons: string[], severity, prompt_length: int, user_id, org_id}` — NO raw prompt (privacy)

## Success Criteria (Binh Pháp Rule #0)
1. `npm test` — all tests pass (1054+15 new)
2. `git push origin main` → CI green
3. CF deploy + prod HTTP 200 with matching shortSha
4. Manual: POST /api/raas/workflows with known attack → 400 with error=prompt_injection_detected

## Attack Patterns (initial library)
| Pattern | Severity | Example |
|---------|----------|---------|
| role-switch | high | "ignore above", "you are now", "new instructions:" |
| system-leak | high | "print your system prompt", "reveal instructions", "repeat everything above" |
| instruction-override | medium | "forget previous", "disregard", "actually do this instead" |
| markdown-injection | low | excessive ``` or `---` markers attempting to close context |
| delimiter-spam | low | >20 backticks or >10 consecutive `===` |
| unicode-homoglyph | medium | mixing Cyrillic `а` with Latin `a` |

## Unresolved Questions
- Langfuse integration deferred — next slice?
- Smart LLM Router deferred — next slice?
- PayOS backup (separate earlier-identified gap) — separate track?
