# L-Plan: ID-04 API Resilience Layer
> Created: 2026-07-22 | Worker: planner | Contract: M1 | Priority: P1

## Objective
Prevent single-vendor outage from becoming customer-visible platform failure. Add circuit breakers + fallback providers + per-day cost caps while preserving no-operator-credentials doctrine.

## Assumed Decisions (overridable)
- Circuit breaker state lives in KV with TTL; D1 is source of truth for config only.
- Fallback providers require BYOK keys when primary is down; platform provides zero default credentials.
- Cost cap uses env-driven defaults; operator never manually enters third-party tokens.
- No new payment rails; cost attribution uses existing `usage_events` columns.

## Phase 1: Circuit Breaker Skeleton (2h)
- Introduce provider health state in `forest/resilience/provider-state.ts` (or `forest/webhooks` if closer fit).
- Track: `consecutive_failures`, `last_failure_at`, `circuit_open_until`.
- Export helpers: `isCircuitOpen(provider)`, `recordSuccess(provider)`, `recordFailure(provider)`.

## Phase 2: Provider Fallback Mapping (3h)
- Map each critical vendor to approved fallback path:
  - OpenRouter -> Replicate orchestrator + CF Workers AI (Qwen) fallback (BYOK budget).
  - ElevenLabs -> PlayHT / Amazon Polly (BYOK key per customer; no platform defaults).
  - D-ID -> audio-only fallback (still image + TTS) for BASIC; graceful status for higher tiers.
- Guard every fallback path with BYOK presence check; surface user-facing "degraded" status via Inngest event.

## Phase 3: Cost Cap + Budget Tracker (2h)
- Add per-customer per-day cost cap config (env var + DB override).
- Integrate with `tree/budget/budget-tracker.ts` to kill runaway generation before invoice shock.
- Emit cost-cap-reached event for observability.

## Phase 4: Protected Flow Hardening (1h)
- Ensure fallback path never mutates subscription tier, quota counters, or payment state on failure.
- Regression tests for NOWPayments IPN + Setup Wizard + Telegram commands remain green.

## Verification Gates
- npm test: existing suite + new resilience unit tests.
- Manual: simulate provider failure -> verify degraded status emitted + fallback path attempted.
- Manual: exceed cost cap -> verify generation stops + error surfaced without silent drop.

## Risks
- Fallback vendor TOS compliance must be validated before shipping Replicate.com path.
- Circuit breaker auto-heal must avoid thundering herd; use randomized backoff in open state.
- Platform must never store fallback vendor credentials; BYOK-only discipline enforced by schema + review.
