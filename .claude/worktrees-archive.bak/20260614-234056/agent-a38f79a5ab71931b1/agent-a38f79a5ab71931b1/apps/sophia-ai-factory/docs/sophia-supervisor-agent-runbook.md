# Sophia Supervisor Agent Runbook / Hướng dẫn Supervisor Agent

> Supervisor Agent MVP shipped 2026-04-17. Linear 3-step workflow (plan → execute → test) on Cloudflare Workers edge.

---

## Overview / Tổng Quan

### English
The Supervisor Agent is an autonomous workflow orchestrator that manages a 3-step linear pipeline:
1. **Planning**: Analyze mission → generate detailed plan (prompt: 100 chars max shown)
2. **Execution**: Execute planned tasks using client BYOK keys (OpenRouter, ElevenLabs, D-ID)
3. **Testing**: Verify results against success criteria

**Current MVP State**: Step implementations stubbed. Real PEV engine deferred to Phase 2.

### Vietnamese (Tiếng Việt)
Supervisor Agent là một orchestrator workflow tự động quản lý pipeline 3 bước tuyến tính:
1. **Lập kế hoạch**: Phân tích mission → tạo kế hoạch chi tiết (prompt: tối đa 100 ký tự)
2. **Thực hiện**: Thực hiện các tác vụ đã lên kế hoạch sử dụng client BYOK keys
3. **Kiểm tra**: Xác minh kết quả theo tiêu chí thành công

**MVP hiện tại**: Cài đặt các bước được giả lập. Engine PEV thực tế được hoãn lại đến Phase 2.

---

## Architecture / Kiến trúc

### Data Storage (D1)
```sql
-- Table: workflows
CREATE TABLE workflows (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  mission_id TEXT,           -- References missions table
  parent_mission_id TEXT,    -- Inherited from missions
  status TEXT,               -- PLANNING | EXECUTING | TESTING | COMPLETED | FAILED
  plan_prompt TEXT,          -- User's plan request (max 100 chars shown)
  current_step TEXT,         -- PLAN | EXECUTE | TEST
  step_result TEXT,          -- Latest step output (JSON)
  error_message TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  completed_at TIMESTAMP
);
```

### Workflow State Machine
```
PLANNING (step=PLAN)
  ↓
  [Cron stepper executes: generatePlan]
  ↓
EXECUTING (step=EXECUTE)
  ↓
  [Cron stepper executes: executeStep]
  ↓
TESTING (step=TEST)
  ↓
  [Cron stepper executes: verifyResults]
  ↓
COMPLETED (step=null)
  ↓
  [Emit WORKFLOW_COMPLETED signal]
```

### Cron Stepper
**Trigger**: `GET /api/cron/workflow-stepper` every 1 minute (`*/1 * * * *`)

**Logic**:
1. Fetch all active workflows (status != COMPLETED, != FAILED)
2. For each workflow, execute appropriate step based on `current_step`
3. Update D1 with results
4. Emit signal events (STEP_COMPLETED, WORKFLOW_COMPLETED, etc.)

---

## API Reference / Tài liệu API

### POST /api/raas/workflows
**Create a new workflow**

```json
{
  "mission_id": "mission_12345",
  "plan_prompt": "Generate proposal for AI agency"
}
```

**Response**:
```json
{
  "id": "workflow_uuid",
  "org_id": "org_uuid",
  "mission_id": "mission_12345",
  "status": "PLANNING",
  "current_step": "PLAN",
  "created_at": "2026-04-17T10:00:00Z"
}
```

---

### GET /api/raas/workflows
**List all workflows for current org**

**Response**:
```json
{
  "workflows": [
    {
      "id": "workflow_uuid",
      "mission_id": "mission_uuid",
      "status": "EXECUTING",
      "current_step": "EXECUTE",
      "created_at": "2026-04-17T10:00:00Z",
      "updated_at": "2026-04-17T10:05:00Z"
    }
  ],
  "total": 5
}
```

---

### GET /api/raas/workflows/[id]
**Get workflow details with full step history**

**Response**:
```json
{
  "id": "workflow_uuid",
  "mission_id": "mission_uuid",
  "status": "TESTING",
  "current_step": "TEST",
  "plan_prompt": "Generate proposal",
  "step_result": {
    "type": "STEP_COMPLETED",
    "step": "EXECUTE",
    "output": "Step EXECUTE completed: Generate proposal for AI agency",
    "timestamp": "2026-04-17T10:05:00Z"
  },
  "timeline": [
    { "step": "PLAN", "status": "COMPLETED", "result": "...", "timestamp": "..." },
    { "step": "EXECUTE", "status": "COMPLETED", "result": "...", "timestamp": "..." },
    { "step": "TEST", "status": "IN_PROGRESS", "result": null, "timestamp": "..." }
  ]
}
```

---

### GET /api/cron/workflow-stepper
**Internal cron endpoint (automatic, no manual trigger needed)**

Runs every minute via Cloudflare cron trigger. Output:
```json
{
  "processed": 12,
  "completed": 3,
  "failed": 0,
  "next_run": "2026-04-17T10:02:00Z"
}
```

---

## Signal Events / Sự kiện tín hiệu

Four new signals emitted to `signals_events` D1 table:

| Event | Trigger | Payload |
|-------|---------|---------|
| `WORKFLOW_STARTED` | Workflow created | `{ workflow_id, org_id, mission_id }` |
| `STEP_COMPLETED` | Step finishes (PLAN/EXECUTE/TEST) | `{ workflow_id, step, output }` |
| `WORKFLOW_COMPLETED` | All 3 steps done | `{ workflow_id, status }` |
| `WORKFLOW_FAILED` | Any step fails | `{ workflow_id, step, error }` |

---

## Cron Stepper Behavior / Hành vi của Stepper Cron

### Execution Cycle (Every Minute)
```
1. Connect to D1
2. Query: SELECT * FROM workflows WHERE status NOT IN ('COMPLETED', 'FAILED')
3. For each workflow:
   - Determine which step to run (PLAN, EXECUTE, TEST)
   - Execute step logic
   - Update workflow row with results
   - Emit signal event
4. Return summary (processed count, completion count, etc.)
```

### MVP Step Implementations
- **PLAN**: `"Step PLAN completed: {plan_prompt[:100]}"`
- **EXECUTE**: `"Step EXECUTE completed: {plan_prompt[:100]}"`
- **TEST**: `"Step TEST completed: {plan_prompt[:100]}"`

(Real implementations deferred to Phase 2 RaaS expansion)

### Error Handling
If any step throws exception:
1. Catch error and store in `error_message` field
2. Set workflow `status = FAILED`
3. Emit `WORKFLOW_FAILED` signal
4. Skip remaining steps for that workflow

---

## Dashboard UI / Giao diện Bảng điều khiển

### /dashboard/workflows
**Workflow list view**
- Cards showing: Status badge, created_at, current_step, plan_prompt (truncated)
- Real-time status via 3s polling
- "New Workflow" button → POST /api/raas/workflows

### /dashboard/workflows/[id]
**Workflow detail view**
- Timeline showing PLAN → EXECUTE → TEST progress
- Real-time step polling
- Step results displayed as JSON (expandable)
- Manual retry button (deferred to Phase 2)

---

## Troubleshooting / Khắc phục sự cố

### Workflow Stuck in PLANNING

**English**: Check if cron job is running.
```bash
# Check cron trigger logs in CF Workers
wrangler tail --format json | grep workflow-stepper
```

**Vietnamese**: Kiểm tra xem cron job có đang chạy không.

**Solution**: 
1. Verify cron trigger is enabled in `wrangler.toml`: `crons = ["*/1 * * * *"]`
2. Deploy: `git push origin main`

---

### Workflow in FAILED State

**English**: Check `error_message` field in D1.

```bash
# Query D1 directly
wrangler d1 execute sophia-raas-db "SELECT id, status, error_message FROM workflows WHERE status='FAILED' ORDER BY updated_at DESC LIMIT 5"
```

**Vietnamese**: Kiểm tra trường `error_message` trong D1.

**Root Causes**:
- Client BYOK keys (OpenRouter, ElevenLabs, D-ID) missing or invalid
- Cloudflare Workers quota exceeded
- Network timeout during step execution

**Fix**:
1. Verify API keys in Setup Wizard
2. Check org_balances (MCU sufficient?)
3. Retry via manual button (Phase 2 feature)

---

### Dashboard Not Polling

**English**: Check browser console for errors.

**Vietnamese**: Kiểm tra console của trình duyệt để xem có lỗi nào không.

**Common Issues**:
- Browser cache stale (hard refresh: Cmd+Shift+R)
- Auth token expired (logout/login)
- Cloudflare Workers deployment delayed (wait 2 min)

---

## Manual Ops / Vận hành Thủ công

### Reset Stuck Workflow (Phase 2)

Currently requires manual D1 update. Coming in Phase 2:
```bash
# Future endpoint (not yet implemented):
# POST /api/admin/workflows/[id]/reset
```

**Temporary Workaround** (direct D1):
```bash
wrangler d1 execute sophia-raas-db "
  UPDATE workflows
  SET status='PLANNING', current_step='PLAN', error_message=null
  WHERE id='workflow_uuid'
"
```

---

### Force Complete Workflow

```bash
wrangler d1 execute sophia-raas-db "
  UPDATE workflows
  SET status='COMPLETED', current_step=null, completed_at=CURRENT_TIMESTAMP
  WHERE id='workflow_uuid'
"
```

---

## Rollback Procedure / Quy trình Quay lại

### If Workflows Are Breaking Production

**English**: Rollback to previous commit that didn't include Supervisor Agent.

```bash
# Find last commit before supervisor agent ship
git log --oneline | grep -i "supervisor\|workflow" | head -5

# Rollback
git revert <commit_hash>
git push origin main

# Verify
curl -sI https://sophia.agencyos.network | head -3
```

**Vietnamese**: Quay lại commit trước khi triển khai Supervisor Agent.

### Disable Cron Temporarily

Edit `wrangler.toml` and remove/comment cron:
```toml
# [triggers]
# crons = ["*/1 * * * *"]
```

Deploy: `git push origin main`

---

## Phase 2 Roadmap / Lộ trình Phase 2

- [ ] Real executeStep implementation (integrate with PEV engine)
- [ ] Manual workflow retry button
- [ ] Admin workflow reset endpoint
- [ ] Advanced filtering (status, date range, search)
- [ ] Workflow result export (CSV)
- [ ] Batch workflow creation API
- [ ] WebSocket real-time updates (replace 3s polling)

---

## Contact / Liên hệ

**Docs**: `/docs/system-architecture.md` (Supervisor Agent section)
**Changelog**: `/docs/project-changelog.md` (2026-04-17 entry)
**Code**: `src/app/api/raas/workflows/` + `src/app/dashboard/workflows/`

