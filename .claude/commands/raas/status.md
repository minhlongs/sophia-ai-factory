---
description: 📊 Health check toàn bộ AGI RaaS stack
argument-hint: [target: all|gateway|engine|worker|queues]
---

**Think** để check RaaS status: <target>$ARGUMENTS</target>

## Health Check Matrix

### 1. Gateway (Cloudflare Worker)
```bash
echo "=== GATEWAY ==="
curl -s https://raas.agencyos.network/v1/health 2>/dev/null && echo "✅ Gateway UP" || echo "❌ Gateway DOWN"
```

### 2. Engine (Fastify API)
```bash
echo "=== ENGINE ==="
curl -s http://localhost:3000/api/v1/health 2>/dev/null | jq . && echo "✅ Engine UP" || echo "❌ Engine DOWN (not running locally?)"
```

### 3. Worker (Tôm Hùm Daemon)
```bash
echo "=== TÔM HÙM ==="
# Check process
pgrep -f "task-watcher" > /dev/null && echo "✅ Tôm Hùm ALIVE" || echo "❌ Tôm Hùm DOWN"

# Check brain
pgrep -f "claude.*dangerously" > /dev/null && echo "✅ CC CLI Brain ALIVE" || echo "⚠️ CC CLI Brain IDLE"

# Queue status
PENDING=$(ls apps/openclaw-worker/tasks/*.txt 2>/dev/null | wc -l | tr -d ' ')
DONE=$(ls apps/openclaw-worker/tasks/done/*.txt 2>/dev/null | wc -l | tr -d ' ')
echo "📋 Queue: ${PENDING} pending, ${DONE} completed"

# Last activity
tail -3 ~/tom_hum_cto.log 2>/dev/null || echo "No log found"
```

### 4. Redis & Queues
```bash
echo "=== REDIS ==="
redis-cli ping 2>/dev/null && echo "✅ Redis UP" || echo "❌ Redis DOWN"

# BullMQ queue depths (if redis available)
redis-cli llen "bull:backtest:wait" 2>/dev/null || echo "Queue check unavailable"
redis-cli llen "bull:strategy-scan:wait" 2>/dev/null
redis-cli llen "bull:webhook-delivery:wait" 2>/dev/null
```

### 5. Build Status
```bash
echo "=== BUILD ==="
pnpm run build --filter=algo-trader 2>&1 | tail -3
```

### 6. AGI Score (từ Tôm Hùm data)
```bash
echo "=== AGI SCORE ==="
cat apps/openclaw-worker/data/health-report.json 2>/dev/null | jq '{
  reliability: .reliability,
  autonomy: .autonomy,
  learning: .learning,
  safety: .safety,
  throughput: .throughput,
  total: .total
}' || echo "No AGI score data"
```

## Output Format

```
## RaaS Health Report — $(date)
| Component | Status | Details |
|-----------|--------|---------|
| Gateway   | ✅/❌  | HTTP code, latency |
| Engine    | ✅/❌  | API health, uptime |
| Tôm Hùm  | ✅/❌  | Brain status, queue depth |
| Redis     | ✅/❌  | Ping, queue lengths |
| Build     | ✅/❌  | Last build result |
| AGI Score | XX/100 | 5-dimension score |
```

## Workflow

1. Run ALL health checks trên
2. Compile vào report table
3. Nếu có component DOWN → suggest fix commands
4. Nếu ALL GREEN → report "RaaS Stack Healthy"
