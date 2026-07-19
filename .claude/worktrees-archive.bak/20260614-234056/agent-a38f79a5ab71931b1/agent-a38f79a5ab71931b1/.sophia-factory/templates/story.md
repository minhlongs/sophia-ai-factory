---
template: story
phase: 1-specification
version: "1.0"
usage: "One story per atomic unit of work. Link to parent requirement.md."
---

# Story: {Story Title}

> An atomic, shippable unit of work. Estimable in hours. Testable independently.

## Meta

| Field | Value |
|-------|-------|
| ID | {STORY-NNN} |
| Date | {YYYY-MM-DD} |
| Parent requirement | `plans/{slug}/requirement.md` |
| Assigned agent | CTO / CMO / CSO / COO |
| Priority | P1 / P2 / P3 |
| Estimate | {Xh} |
| Status | backlog / in-progress / done |

## User Story

**As a** {role — founder / customer / agent},
**I want to** {action — specific and concrete},
**So that** {outcome — business value}.

## Acceptance Criteria

> Written in Given/When/Then format. All must be testable.

```gherkin
Given {precondition}
When {action}
Then {expected outcome}

Given {precondition}
When {action}
Then {expected outcome}
```

## Definition of Done

- [ ] Code implemented and reviewed
- [ ] Unit tests written and passing (`npm test`)
- [ ] Type check passing (`npm run typecheck`)
- [ ] Build passing (`npm run build`)
- [ ] No `: any` types introduced
- [ ] No `console.log` in production code
- [ ] Bilingual copy added to `messages/` (if UI change)
- [ ] PR opened with conventional commit title
- [ ] Journal entry written

## Implementation Notes

> Optional hints for the implementing agent (CTO/CMO/CSO/COO).

- {Note 1 — e.g., "Use existing `getUserTier()` — do not re-implement"}
- {Note 2 — e.g., "Telegram message max 4096 chars — truncate if needed"}
- {Note 3 — e.g., "VN copy must be reviewed by CMO before merge"}

## Dependencies

| Depends on | Type | Status |
|-----------|------|--------|
| {STORY-NNN} | blocks / blocked-by | done / pending |
| {env var} | config | set / missing |

## Out of Scope

- {Item explicitly excluded from this story}
- {Item deferred to next story or phase}

---
*Template version 1.0 — Sophia AI Factory Story Template*
