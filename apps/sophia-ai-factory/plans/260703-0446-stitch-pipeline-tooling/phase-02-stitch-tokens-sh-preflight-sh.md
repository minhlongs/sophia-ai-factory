---
phase: 2
title: "stitch-tokens.sh + preflight.sh"
status: pending
priority: P1
dependencies: [1]
---

# Phase 2: Token Export + Pre-flight Gate Scripts

## Overview

Two scripts: `stitch-tokens.sh` exports design tokens từ Stitch MCP → `.stitch-tokens.json`; `stitch-preflight.sh` validates target files, i18n coverage, và theme consistency before spawning workflow agents.

## Requirements

- `stitch-tokens.sh` — exports tokens from Stitch project OR from a known design system file
- `stitch-preflight.sh` — scans target files, checks theme, extracts i18n prefixes, reports stale files
- Both produce machine-readable JSON output
- Token file structure matches the spec in brainstorm report

## Architecture

Two bash scripts (để dễ integrate với workflow scripts) + `.stitch-tokens.json` token file.

Token file format:
```json
{
  "theme": "DARK",
  "primary": "#6366F1",
  "background": "#0F0F11",
  "surface": "#18181B",
  "textPrimary": "#FFFFFF",
  "textSecondary": "#A1A1AA",
  "border": "zinc-800",
  "rounding": "rounded-lg",
  "fontHeadline": "Inter 28px/700",
  "fontBody": "Inter 15px/400",
  "fontLabel": "IBM Plex Sans 13px/500",
  "colors": {
    "indigo-500": "#6366F1",
    "zinc-900": "#18181B",
    "zinc-400": "#A1A1AA",
    "zinc-800": "#27272A"
  },
  "i18nPrefixes": ["landing", "pricing", "dashboard", "campaign", "settings", "affiliate", "admin"]
}
```

## Related Code Files

- **Create:** `~/.claude/skills/stitch/scripts/stitch-tokens.sh`
- **Create:** `~/.claude/skills/stitch/scripts/stitch-preflight.sh`
- **Create:** `.stitch-tokens.json` (auto-generated, add to .gitignore)

## Implementation Steps

### stitch-tokens.sh
1. Read design system from `stitch-session read` (or from `.stitch-tokens.json` if exists)
2. Output token JSON with hardcoded Sophia design tokens (for now, since MCP auth may be down)
3. Support `--update` flag to fetch fresh tokens from MCP when available
4. Write to `.stitch-tokens.json` in project root

### stitch-preflight.sh
1. Accept list of target files as args OR read from `stitch-session read`
2. For each file: check exists, check contains new theme (`#6366F1`/`indigo-500`)
3. Scan `messages/{vi,en}.json` for i18n keys → extract prefix names
4. Report: files_already_updated, files_stale, i18n_prefixes, file_count
5. Output JSON report

## Success Criteria

- [ ] `stitch-tokens.sh` outputs valid `.stitch-tokens.json`
- [ ] Token file has all required fields (theme, primary, background, colors, i18nPrefixes)
- [ ] `stitch-preflight.sh --files src/app/components/sections/*.tsx` returns valid JSON
- [ ] Preflight detects files already on indigo theme (using grep #6366F1)
- [ ] Preflight detects stale files (still on old purple)
- [ ] i18n prefixes extracted from messages/*.json
