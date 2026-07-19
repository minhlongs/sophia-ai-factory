---
phase: 4
title: "CSS Variable Audit"
status: complete
effort: "Built into pre-deploy-gate.mjs Step 3"
---

# Phase 4: CSS Variable Audit

## Overview

Catches hardcoded legacy design tokens that bypass the CSS variable system. The project uses a Saigon Factory theme (warm amber + deep indigo + cream paper) with all colors defined as CSS custom properties in `src/app/globals.css`. No hardcoded hex or Tailwind color classes should appear in changed files.

## Implementation

**File:** `apps/sophia-ai-factory/scripts/pre-deploy-gate.mjs`
**Function:** `checkCSSAudit()`

### What It Checks

Scans files changed in the current commit (via `git diff --name-only HEAD~1 HEAD`) for these forbidden patterns:

| Pattern | Reason | Correct Alternative |
|---------|--------|---------------------|
| `#6366F1` | Hardcoded legacy indigo-500 hex | `var(--accent)` |
| `indigo-500` | Tailwind indigo class (old palette) | `bg-primary`, `text-accent` |
| `indigo-400` | Tailwind indigo-400 | `text-primary` |
| `indigo-600` | Tailwind indigo-600 | `bg-accent` |

### Design System Source of Truth

**File:** `apps/sophia-ai-factory/src/app/globals.css`

Primary palette (Saigon Factory):
- `--primary` / `--primary-light` / `--primary-dark` — Amber (warm)
- `--accent`, `--accent-hover`, `--accent-muted`, `--accent-light` — Deep indigo
- `--violet-50` through `--violet-900` — Plum shades

Bridge tokens for backward compatibility:
- `--neon-cyan`, `--neon-purple`, `--neon-pink` — Legacy neon (todo: migrate)

All mapped via `@theme inline` to Tailwind v4 tokens (e.g., `color-primary`, `color-accent`).

### Algorithm

1. **Get changed files** — `git diff --name-only HEAD~1 HEAD`
2. **Filter scope** — Only `src/**/*.{ts,tsx,css}` files
3. **Grep for forbidden patterns** — Case-sensitive search for hex values and indigo classes
4. **Report violations** — Show file path, line number, and offending token
5. **Exit 1** if any violations found; blocks deploy

### Future Enhancement (Out of Scope for This Plan)

Comprehensive check that all `var(--token-name)` references have a corresponding `--token-name` definition in `globals.css :root` or `.dark`. This requires parsing CSS custom property declarations and cross-referencing against JavaScript/TSX usage.

## Success Criteria

- [x] Hardcoded `#6366F1` / indigo-* classes in changed files block deploy
- [x] Error messages show exact file, line, and offending token
- [x] Gate exits 1 on violation
- [x] Bypass: `SKIP_PRE_DEPLOY_GATE=1` skips entire gate (emergency only)
