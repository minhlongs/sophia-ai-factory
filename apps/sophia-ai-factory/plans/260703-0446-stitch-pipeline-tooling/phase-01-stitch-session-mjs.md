---
phase: 1
title: "stitch-session.mjs"
status: pending
priority: P1
dependencies: []
---

# Phase 1: stitch-session.mjs

## Overview

Create session persistence CLI script that saves/loads Stitch pipeline state to disk. Survives context compaction và session restart.

## Requirements

- Write session state to `~/.claudekit/.stitch-session.json`
- Support subcommands: `init`, `set-project`, `add-screen`, `set-design-system`, `read`, `clear`
- Auto-detect project from CWD or plan context
- Machine-readable output (JSON) for use in scripts

## Architecture

Single Node.js ESM script (`stitch-session.mjs`) placed at `~/.claude/skills/stitch/scripts/`.

Storage format:
```json
{
  "project": { "id": "2407265268945504587", "name": "Sophia AI Factory" },
  "deviceType": "DESKTOP",
  "screens": [
    { "id": "5f4fde6f...", "name": "Landing Page Hero" }
  ],
  "designSystem": { "assetId": "assets/14203260290340580283", "name": "Sophia Indigo Dark" },
  "updatedAt": "2026-07-03T04:46:00Z"
}
```

## Related Code Files

- **Create:** `~/.claude/skills/stitch/scripts/stitch-session.mjs`

## Implementation Steps

1. Create `stitch-session.mjs` with shebang `#!/usr/bin/env node`
2. Implement CLI arg parsing (positional subcommands)
3. Implement `init` — create state file with timestamp
4. Implement `set-project <id> <name> [device]` — write project info
5. Implement `add-screen <id> <name>` — append to screens array
6. Implement `set-design-system <assetId> <name>` — write DS info
7. Implement `read` — output full state as JSON
8. Implement `clear` — delete state file
9. Add `+x` permission to the script

## Success Criteria

- [ ] `stitch-session init orchestrator` creates `~/.claudekit/.stitch-session.json`
- [ ] `stitch-session set-project "123" "Test" DESKTOP` writes project
- [ ] `stitch-session add-screen "abc" "Hero"` appends to screens
- [ ] `stitch-session read` outputs valid JSON with all state
- [ ] `stitch-session clear` removes the state file
- [ ] Script handles missing state file gracefully (non-zero exit + message)
