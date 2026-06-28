---
template: requirement
phase: 1-specification
version: "1.0"
---

# Requirement: {Title}

> Fill all sections. Replace `{placeholders}`. Mark `N/A` if not applicable. No `TBD` in mandatory fields.

## Meta

| Field | Value |
|-------|-------|
| Date | {YYYY-MM-DD} |
| Requestor | Founder |
| Priority | P1 / P2 / P3 |
| Effort estimate | {Xh} |
| Target phase | {Phase 1–4} |
| Related plan | `plans/{slug}/` |

## Problem Statement

> One paragraph. What pain or opportunity is this addressing?

{Describe the problem or opportunity in plain language. No tech jargon.}

## Goal

> One sentence. What does success look like for the founder?

{e.g., "Founder can see weekly revenue report directly in Telegram without opening the dashboard."}

## User Stories

| As a... | I want to... | So that... |
|---------|-------------|------------|
| {role} | {action} | {outcome} |
| {role} | {action} | {outcome} |

## Scope

### In Scope
- {Item 1}
- {Item 2}

### Out of Scope (YAGNI boundary)
- {Item 1 — explicitly excluded}
- {Item 2 — future consideration}

## Success Criteria

> Measurable. Testable. No ambiguity.

- [ ] {Criterion 1 — e.g., "Telegram /report command responds in < 3s"}
- [ ] {Criterion 2 — e.g., "Correct revenue shown for PREMIUM tier users"}
- [ ] {Criterion 3 — e.g., "Non-auth users receive 401, not data"}

## Affected Systems

- [ ] Setup Wizard (protected — must not break)
- [ ] Telegram Bot (protected — must not break)
- [ ] NOWPayments Webhook (protected — must not break)
- [ ] Other: {system name}

## Constraints

| Type | Constraint |
|------|-----------|
| Tech stack | Next.js 16 + D1 + Better Auth + CF Workers |
| Auth | `getCurrentUser()` from `@/lib/better-auth-session` |
| DB | `createServerClient()` sync (no await) |
| Tier | `BASIC \| PREMIUM \| ENTERPRISE \| MASTER` |
| Payment | NOWPayments only (Polar REJECTED) |
| Deploy | Cloudflare Pages via GitHub Actions (no Vercel) |
| Other | {any additional constraint} |

## Security Considerations

- Auth required: Yes / No / Tier-gated
- PII involved: Yes / No → if yes: {how handled}
- BYOK keys exposed: Yes / No → if yes: {mitigation}
- New env vars needed: {list or None}

## Open Questions

> Resolved before handing to Phase 2. No open questions allowed at handoff.

- [ ] {Question 1} → Answer: {answer}
- [ ] {Question 2} → Answer: {answer}

---
*Template version 1.0 — Sophia AI Factory Phase 1 Specification*
