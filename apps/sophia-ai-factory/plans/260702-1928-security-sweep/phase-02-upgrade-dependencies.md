---
phase: 2
title: "Upgrade Dependencies"
status: pending
effort: "~1 hr"
priority: P1
---

# Phase 2: Upgrade Dependencies

## Overview

Upgrade all production dependencies with available security fixes. Run tests after each batch.

## Requirements

- `npm audit fix` for auto-fixable CVEs
- Manual version bumps for deps where audit fix doesn't apply
- Verify OpenNext + CF Workers compatibility after upgrades
- Full test suite after each upgrade batch

## Related Code Files

- Modify: `apps/sophia-ai-factory/package.json`
- Verify: lockfile update

## Implementation Steps

1. Run `npm audit` — see what's auto-fixable
2. Batch 1: `npm audit fix` (non-breaking)
3. Batch 2: Manual version bumps (minor/patch)
4. Batch 3: Major version bumps (riskier — test heavily)
5. Run `npm test` after each batch
6. Run `npm run build` after all upgrades

## Success Criteria

- [ ] All CVEs with available fixes upgraded
- [ ] `npm test`: 6709+ pass, 0 fail
- [ ] `npm run build`: 0 errors
- [ ] CF Workers compatibility verified
