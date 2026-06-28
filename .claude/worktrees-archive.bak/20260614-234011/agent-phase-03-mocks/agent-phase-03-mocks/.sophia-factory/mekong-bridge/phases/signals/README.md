# Signals Loop — Ops Notes

Phase 03 — Offline-first feedback loop for Mekong CLI.

## Architecture (3 layers)

```
Agent executor → emit_mission_event()
                  ├─ SQLite (always on, <1ms)     ← eval-agent reads here
                  ├─ PostHog (deferred, async)    ← activate at 50+ customers
                  └─ Statsig (flag eval only)     ← canary_flags.json
```

## Day-1 Ops (SQLite only)

```bash
# Run a mission — event auto-recorded
mekong cook "fix bug in auth.py"

# Check metrics
mekong metrics

# Run offline eval (last 7 days, all agents)
mekong eval-agent

# Filter by agent version
mekong eval-agent v2.1 --days 30

# JSON output for scripting
mekong eval-agent --json | jq .success_rate_pct
```

SQLite DB location: `data/signals.sqlite` (gitignored)

## Activate PostHog (50+ customers milestone)

```bash
cp .env.posthog.template .env.posthog
# Fill in passwords + POSTHOG_SECRET_KEY
# Create posthog-data/ subdirs first:
mkdir -p posthog-data/{db,redis,clickhouse,app}
docker compose -f docker-compose.posthog.yml --env-file .env.posthog up -d
# Set SIGNALS_POSTHOG_ENABLED=1 in .env.posthog
# Restart CLI session or re-export env
```

CF Tunnel: `posthog.m1max.cashclaw.cc → localhost:8000`

## Activate Statsig Flags

```bash
# 1. Create free account at statsig.com
# 2. Create gates matching names in canary_flags.json
export FEATURE_FLAG_PROVIDER=statsig
export STATSIG_SERVER_KEY=server-xxxxx
# Flags are checked via get_flag_client().enabled(user_id, flag_name)
```

## GDPR Notes

- Raw `user_id` is never stored — hashed with SHA-256 + `SIGNALS_USER_SALT`
- Set `SIGNALS_USER_SALT` in env (random string, keep secret)
- PostHog API key stored in macOS Keychain, not `.env` in repo

## File Ownership (phase-03)

- `core/signals/**` — emitter, stores, sinks, evals
- `cli/commands/metrics.py` — `mekong metrics`
- `cli/commands/eval_agent.py` — `mekong eval-agent`
- `docker-compose.posthog.yml` + `.env.posthog.template`
- `.mekong/phases/signals/**` — this dir

DO NOT modify: `observability/**` (phase-02), `.github/workflows/**` (phase-01)
