---
description: 🦞 Dispatch AGI mission qua Tôm Hùm — autonomous task execution
argument-hint: [mission-description]
---

**Think harder** để dispatch AGI mission: <mission>$ARGUMENTS</mission>

**IMPORTANT:** Mission = atomic unit of work. Mỗi mission → 1 MCU ($0.25).

## Context

Tôm Hùm (OpenClaw) = Autonomous AGI Daemon.
- Watches `apps/openclaw-worker/tasks/` for mission files
- Routes mission to correct project via keyword matching
- Dispatches to CC CLI via `claude -p` (non-interactive)
- Auto-CTO generates quality tasks khi queue rỗng

## Mission File Format

```
HIGH_<slug>.txt hoặc CRITICAL_<slug>.txt hoặc MEDIUM_<slug>.txt
```

Content: Plain text mô tả task. Tôm Hùm sẽ wrap với `/binh-phap implement:` prefix.

## Workflow

### 1. Phân tích Mission
- Parse `$ARGUMENTS` → xác định:
  - Priority: CRITICAL / HIGH / MEDIUM / LOW
  - Target project: algo-trader, apex-os, 84tea, anima119, well, sophia, etc.
  - Scope: < 5 files, < 15 min (enforce mission atomicity)

### 2. Tạo Mission File
```bash
# Generate mission file
MISSION_ID=$(date +%s)
PRIORITY="HIGH"  # or CRITICAL/MEDIUM based on analysis
SLUG="descriptive_slug"
FILE="apps/openclaw-worker/tasks/${PRIORITY}_${SLUG}_${MISSION_ID}.txt"

cat > "$FILE" << 'EOF'
<mission-content-here>

TASK:
1. <step-1>
2. <step-2>
3. Verify build passes

Sửa < 5 file mỗi mission.
EOF
```

### 3. Verify Dispatch
- Check file created: `ls apps/openclaw-worker/tasks/`
- If Tôm Hùm running: mission auto-picked up
- If Tôm Hùm NOT running: execute directly with `/cook`

### 4. Monitor (nếu Tôm Hùm active)
```bash
# Check mission status
ls apps/openclaw-worker/tasks/done/ | grep "$SLUG"
cat /tmp/tom_hum_mission_done 2>/dev/null
tail -20 ~/tom_hum_cto.log
```

## Project Routing Keywords

| Keyword | Route |
|---------|-------|
| `algo`, `trader`, `raas`, `backtest` | `apps/algo-trader` |
| `84tea`, `tea` | `apps/84tea` |
| `apex` | `apps/apex-os` |
| `anima` | `apps/anima119` |
| `sophia` | `apps/sophia-ai-factory` |
| `well` | `apps/well` |
| `docs` | `apps/docs` |
| `gateway` | `apps/raas-gateway` |
| (default) | mekong-cli root |

## Auto-CTO Tasks (khi queue rỗng)

Tôm Hùm tự generate từ pool:
- `console_cleanup` — Clean console.log from production
- `type_safety` — Fix TypeScript `any` types
- `a11y_audit` — WCAG 2.1 AA audit
- `security_headers` — CSP, HSTS, X-Frame-Options
- `perf_audit` — Lighthouse performance
- `i18n_sync` — Sync translation keys
