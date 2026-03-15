---
description: "Tứ Đại Chiến — 4 projects parallel dispatch. Start master view, dispatch missions, monitor status."
argument-hint: [start|stop|status|attach|dispatch <project> "mission"|all "mission"]
---

# Tứ Đại Chiến — 4 Projects Parallel

> Trigger: `/4-project <command> [arguments]`
> Scripts: `apps/openclaw-worker/4-project-*.sh`

## Commands

### Master View (4 Panes in 1 Screen)
```
/4-project start        # Start master view with 4 panes
/4-project attach       # Attach to master view
/4-project stop         # Stop master view
/4-project status       # Check status
```

### Dispatch Missions
```
/4-project dispatch mekong-cli "Fix parser bug"
/4-project dispatch sophia "Add pricing page"
/4-project dispatch algo-trader "Update RSI strategy"
/4-project dispatch wellnexus "Add health assessment"
/4-project dispatch all "Run build and fix errors"
```

### Quick Start
```
/4-project quick        # Start + auto attach
/4-project view         # Live monitor (auto-refresh)
```

## Execution

Dispatch to `apps/openclaw-worker/4-project-dispatch.sh` or `4-project-master.sh` based on command.

## Scripts Location

- `apps/openclaw-worker/4-project-master.sh` — Master view (4 panes)
- `apps/openclaw-worker/4-project-dispatch.sh` — Mission dispatch
- `apps/openclaw-worker/quick-start.sh` — Quick start

## Output

- Masters saves to: `~/.openclaw/logs/*.log`
- Mission files: `<project>/tasks/mission_*.txt`
- OpenClaw processes automatically via task-watcher.js
