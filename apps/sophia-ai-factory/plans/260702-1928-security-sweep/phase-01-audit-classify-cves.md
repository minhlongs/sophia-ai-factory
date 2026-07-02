---
phase: 1
title: "Audit & Classify CVEs"
status: pending
effort: "~1 hr"
priority: P1
---

# Phase 1: Audit & Classify CVEs

## Overview

Fetch all 145 dependabot alerts from GitHub API, classify by production impact, and prioritize.

## Requirements

- Fetch all open alerts via `gh api repos/.../dependabot/alerts`
- Classify each CVE: production vs dev-only, exploitable vs theoretical
- Identify CVEs with available fix versions
- Create prioritized fix list

## Related Code Files

- Read: `package.json` (current dep versions)
- Read: `package-lock.json` (locked transitive deps)

## Implementation Steps

1. Fetch alerts: `gh api repos/.../dependabot/alerts --paginate`
2. Classify: production deps (next, undici, better-auth, etc.) vs dev-only (vitest, vite)
3. Check fix availability per CVE
4. Prioritize: critical → high with fix → high without fix → medium
5. Create action plan: which to upgrade, which to add compensating controls

## Success Criteria

- [ ] All 145 CVEs classified
- [ ] Production vs dev-only separated
- [ ] Fix-versus-no-fix matrix created
- [ ] Prioritized action plan documented
