---
description: 🏥 Health Check — System Status, Uptime, Performance Metrics
argument-hint: [service: all|gateway|engine|worker|database]
---

**Think harder** để kiểm tra system health: <service>$ARGUMENTS</service>

**IMPORTANT:** Check TẤT CẢ layers — không bỏ sót component nào.

## Health Check Matrix

| Service | Endpoint | Timeout | Critical |
|---------|----------|---------|----------|
| Gateway | `/health` | 5s | ✅ |
| Engine | `/api/health` | 10s | ✅ |
| Worker | PM2 status | 3s | ✅ |
| Database | `SELECT 1` | 2s | ✅ |
| Redis | `PING` | 1s | ⚠️ |
| Queue | Bull status | 5s | ⚠️ |

## Quick Health Check

```bash
# All services (parallel)
curl -s http://localhost:9191/health | jq .
curl -s http://localhost:3000/api/health | jq .
pm2 list | grep -E "openclaw|worker"

# Database
psql "$DATABASE_URL" -c "SELECT 1" > /dev/null && echo "✅ DB" || echo "❌ DB"

# Redis
redis-cli ping 2>/dev/null && echo "✅ Redis" || echo "❌ Redis"
```

## Comprehensive Health Report

### 1. Gateway Health (Cloudflare Worker)
```bash
curl -sI https://raas.agencyos.network/ | head -5
# Expected: HTTP/2 200, server: cloudflare

curl -s https://raas.agencyos.network/health | jq '{
  status: .status,
  uptime: .uptime_seconds,
  version: .version,
  timestamp: .timestamp
}'
```

### 2. Engine Health (FastAPI/Node)
```bash
curl -s http://localhost:3000/health | jq '{
  api: .api_status,
  database: .db_status,
  queue: .queue_connected,
  memory_mb: .memory_usage_mb,
  uptime: .uptime_seconds
}'
```

### 3. Worker Health (Tôm Hùm)
```bash
# PM2 status
pm2 list --json | jq '.[] | {
  name: .name,
  status: .pm2_env.status,
  cpu: .pm2_env.monit.cpu,
  memory_mb: (.pm2_env.monit.memory / 1024 / 1024 | floor),
  uptime: .pm2_env.pm_uptime
}'

# Check task queue
ls apps/openclaw-worker/tasks/*.txt 2>/dev/null | wc -l | xargs echo "Pending tasks:"
```

### 4. Database Health (Supabase/Postgres)
```bash
# Connection + basic query
psql "$DATABASE_URL" -c "
SELECT
  'connections' as metric,
  count(*) as value
FROM pg_stat_activity
WHERE state = 'active'
"

# Check replication lag (if applicable)
psql "$DATABASE_URL" -c "
SELECT
  client_addr,
  state,
  pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn) as lag_bytes
FROM pg_stat_replication
"
```

### 5. Queue Health (Bull/Redis)
```bash
# Redis connection
redis-cli ping

# Queue stats (via Node script)
node -e "
const Bull = require('bull');
const queue = new Bull('missions', process.env.REDIS_URL);
Promise.all([
  queue.getJobCounts('active'),
  queue.getJobCounts('waiting'),
  queue.getJobCounts('completed'),
  queue.getJobCounts('failed')
]).then(([active, waiting, completed, failed]) => {
  console.log({ active, waiting, completed, failed });
});
"
```

## Health Status Codes

| Code | Status | Action |
|------|--------|--------|
| `200` | ✅ Healthy | No action |
| `200` (degraded) | ⚠️ Partial | Investigate warnings |
| `500` | ❌ Unhealthy | Alert on-call |
| `503` | ❌ Down | Emergency response |
| Timeout | ❌ Unreachable | Check network/firewall |

## Alerting Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Response time | > 500ms | > 2000ms |
| Error rate | > 1% | > 5% |
| Memory usage | > 70% | > 90% |
| CPU usage | > 60% | > 90% |
| Queue size | > 100 | > 500 |
| DB connections | > 80% | > 95% |

## Automated Health Check Script

```bash
#!/bin/bash
# health-check.sh

SERVICES=("gateway" "engine" "worker" "database" "redis")
HEALTHY=0
DEGRADED=0
DOWN=0

for service in "${SERVICES[@]}"; do
  status=$(check_$service)  # Custom function per service
  if [ "$status" = "ok" ]; then
    ((HEALTHY++))
    echo "✅ $service"
  elif [ "$status" = "degraded" ]; then
    ((DEGRADED++))
    echo "⚠️  $service"
  else
    ((DOWN++))
    echo "❌ $service"
  fi
done

echo ""
echo "Summary: $HEALTHY healthy, $DEGRADED degraded, $DOWN down"

if [ $DOWN -gt 0 ]; then
  exit 1  # Critical
elif [ $DEGRADED -gt 0 ]; then
  exit 2  # Warning
else
  exit 0  # All good
fi
```

## Related Commands

- `/monitor` — Monitoring dashboard
- `/alert` — Alert configuration
- `/logs` — Log analysis
