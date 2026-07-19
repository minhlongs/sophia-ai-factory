---
phase: 3
title: "Integration & Verify"
status: completed
priority: P2
dependencies: [1, 2]
---

# Phase 3: Integration & Verify

## Overview

Tích hợp 3 scripts vào Stitch orchestrator workflow, test end-to-end.

**Depends on:** Phases 1, 2 completing successfully.

## Implementation Steps

1. **Install scripts** — copy scripts to `~/.claude/skills/stitch/scripts/`, verify `+x` permissions
2. **Integration test** — run full pipeline simulation:
   - `stitch-session init orchestrator`
   - `stitch-session set-project "2407265268945504587" "Sophia AI Factory" DESKTOP`
   - `stitch-session add-screen "abc123" "Test Screen"`
   - `stitch-session read` → verify valid JSON
   - `stitch-tokens.sh` → verify `.stitch-tokens.json` created
   - `stitch-preflight.sh --files src/app/components/sections/*.tsx` → verify report JSON
3. **Update orchestrator workflow** — update workflow script template to:
   - Call `stitch-session init` at start
   - Pass token path to each agent context
   - Call `stitch-preflight.sh` before spawning agents
4. **End-to-end verify** — run complete pipeline with 2-3 test sections
5. **Clean up** — `stitch-session clear`, remove `.stitch-tokens.json`

## Success Criteria

- [ ] All 3 scripts have `+x` permission and are callable from `$PATH`
- [ ] Integration test passes: session → tokens → preflight
- [ ] Preflight correctly reports file status (updated/stale/not-found)
- [ ] Token file is valid JSON and agents can read it
- [ ] Pipeline with scripts runs 2-3 sections without error
- [ ] `.stitch-tokens.json` added to `.gitignore` if not already
