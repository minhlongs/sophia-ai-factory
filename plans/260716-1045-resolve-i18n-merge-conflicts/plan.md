---
title: "Resolve i18n merge conflicts in messages/en.json and messages/vi.json"
description: "Fix invalid JSON caused by missing comma before ceoAgent block and restore canonical structure for developer and dashboard keys"
status: completed
priority: P1
effort: 1h
branch: feat/next-evolution-phase-1-5
tags: [i18n, merge-conflict, json, bugfix]
created: 2026-07-16
updated: 2026-07-22
completedAt: 2026-07-22
completedBy: ak:cook
---

## Problem

Both `messages/en.json` and `messages/vi.json` fail JSON parse at line 2102 col 5:
```
Expecting ',' delimiter: line 2102 column 5
```

Root cause: merge commit `76be9e76` (two parents) added a `ceoAgent` block after
`"view_api_docs"` without a trailing comma. Both branches independently modified
the same region (around the `api_keys`/`developer` block).

## Phases

### Phase 1 — Analyze current state (5 min)

- Run `python3 -c "json.load(open('messages/en.json'))"` → confirm failure at line 2102 col 5
- Run `git merge-base <branch> main` to find common ancestor
- Run `git diff <ancestor> HEAD -- messages/en.json messages/vi.json` to list all changes
- Run `grep -n '"referralSection"\|"ceoAgent"\|"developer"'` on both files to locate conflict regions

### Phase 2 — Determine canonical structure (5 min)

Consult the merge diff of both parents (`76be9e76^1` vs `76be9e76^2`) to decide
which version of each overlapping key wins:

| Key | Source of truth |
|-----|----------------|
| All keys inside `developer` block | Branch that added `developer` (parent 2) — more complete |
| `referralSection`, `yourReferralLink`, `linkCopied`, `copyLink`, `totalReferrals`, `referralEarnings` | Must live inside `dashboard` object (parent 2 placement) |
| `ceoAgent.onboarding_tour.*` | Parent 2 complete version with tour steps |
| `ceoAgent.briefing*`, `revenue*` keys | Parent 2 version |
| All other keys unchanged in merge | Keep parent 1 version |

### Phase 3 — Resolve and write valid JSON (20 min)

Edit `messages/en.json` and `messages/vi.json`:

1. Fix missing comma after `"view_api_docs": "..."` (line 2101) → add `,`
2. Ensure `ceoAgent` block is nested correctly (inside `developer` or its own top-level block per merge intent)
3. Move referral keys into the `dashboard` object
4. Merge both versions of `ceoAgent` keys (union of parent 1's flat keys + parent 2's nested `onboarding_tour`)
5. Ensure all braces open/close correctly
6. Deduplicate any overlapping keys (keep canonical string)
7. Ensure trailing newline at EOF

Tools:
- `python3 -c "json.load(open('messages/en.json'))"` after each edit to verify validity
- `python3 -c "
import json
d=json.load(open('messages/en.json'))
print('Keys:', len(d), sorted(d.keys()))
print('developer:', 'developer' in d)
print('dashboard.referralSection:', d.get('dashboard',{}).get('referralSection'))
print('ceoAgent:', d.get('ceoAgent',{}) is not None
)"` for spot-check
- Same verification on `vi.json`

### Phase 4 — Validate (5 min)

- `python3 -c "json.load(open('messages/en.json')); json.load(open('messages/vi.json'))"` → exit 0
- `npm run build` → exit 0, 0 TypeScript errors
- `npm test` → all tests pass
- Spot-check: key count matches between en.json and vi.json (same top-level keys)
- Spot-check: `developer` block exists with all 8 required keys in both files
- Spot-check: referral keys exist inside `dashboard` in both files

### Phase 5 — Commit (5 min)

```bash
git add messages/en.json messages/vi.json
git commit -m "fix(i18n): resolve merge conflict in message files — add missing comma, canonical developer block, move referral keys into dashboard"
```

## Rollback

```bash
git revert HEAD   # if issues found after commit
```

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Losing a translation string | Low | Medium | diff against both merge parents, verify all keys preserved |
| Breaking i18n lookup at runtime | Low | High | run `npm test` + `npm run build` before commit |
| Introducing new syntax error | Low | High | validate JSON parse after every edit |

## Files Modified

- `apps/sophia-ai-factory/messages/en.json` — resolve merge conflict
- `apps/sophia-ai-factory/messages/vi.json` — resolve merge conflict

No other files touched. No schema changes. No dependency changes.

## Unresolved Questions

- Which parent of the merge is considered the canonical source for the `branding` and `orgs` blocks added in parent 2? → Should be kept from parent 2 (newer) unless parent 1 has conflicting versions.
- Whether `ceoAgent` belongs inside the `developer` block or as a top-level sibling → Need to check which branch's placement was intended by reviewing the merge intent in commit message or PR description.
