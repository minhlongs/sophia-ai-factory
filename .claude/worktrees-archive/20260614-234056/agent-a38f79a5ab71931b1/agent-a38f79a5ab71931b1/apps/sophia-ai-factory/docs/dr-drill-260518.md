# DR Drill — Sophia Staging D1
**Date:** 2026-05-18
**Target:** sophia-raas-db-staging (bf74b301-7bb4-441f-9960-c96244b82953)
**Doctrine:** v1.28.1 (no-tech)
**Executed by:** debugger agent

## Metrics

| Phase | Wall-clock | Notes |
|---|---:|---|
| Export (backup) | 6011ms | wrangler d1 export --remote, 1474 lines |
| Drop tables | 2011ms | 117 user tables dropped |
| Restore | 4959ms | wrangler d1 execute --file (clean dump) |
| **Total RTO** | **12981ms** | From dump-start to verified parity |
| **RPO** | **0s** | Export-before-drop ordering |

## Parity Verification

- Table count: T0 = 120, T4 = 120, delta = 0
- Key table row counts: user=0, promo_codes=4, promo_code_redemptions=0
- Worker /api/health post-restore: HTTP 200

## Procedure Note

The raw `wrangler d1 export` dump includes `d1_migrations` table DDL. Wrangler auto-creates this table on every D1 database, so restoring the raw dump errors with `table d1_migrations already exists`. Procedure must strip `d1_migrations` from the dump before restore:

```bash
python3 - <<'EOF'
import re
with open('/tmp/staging-d1-dump.sql', 'r') as f:
    content = f.read()
content_clean = re.sub(
    r'CREATE TABLE d1_migrations\s*\(.*?\);',
    '-- d1_migrations excluded (wrangler auto-creates)',
    content, flags=re.DOTALL
)
content_clean = re.sub(r'INSERT INTO "?d1_migrations"?[^\n]*\n', '', content_clean)
with open('/tmp/staging-d1-dump-clean.sql', 'w') as f:
    f.write(content_clean)
EOF
```

## Doctrine Impact

Layer 10 (Backup) ceiling **7/10 unchanged**. To raise:
- Need 3+ monthly DR drills over time (operational track record)
- Need automated cron registration (rejected by no-tech doctrine v1.28.1)

## Procedure (Repeatable Form)

```bash
cd apps/sophia-ai-factory

# 1. Export
npx wrangler d1 export sophia-raas-db-staging \
  --config wrangler.staging.toml --remote --output /tmp/staging-d1-dump.sql

# 2. Strip d1_migrations from dump (python3 one-liner above)

# 3. Drop all user tables (generate + execute drop.sql)
npx wrangler d1 execute sophia-raas-db-staging --config wrangler.staging.toml --remote \
  --command "SELECT 'DROP TABLE IF EXISTS \"' || name || '\";' AS stmt FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name NOT LIKE 'd1_%';" \
  --json | jq -r '.[0].results[].stmt' > /tmp/drop.sql
npx wrangler d1 execute sophia-raas-db-staging --config wrangler.staging.toml --remote --file /tmp/drop.sql

# 4. Restore
npx wrangler d1 execute sophia-raas-db-staging --config wrangler.staging.toml --remote \
  --file /tmp/staging-d1-dump-clean.sql

# 5. Verify table count matches T0
npx wrangler d1 execute sophia-raas-db-staging --config wrangler.staging.toml --remote \
  --command "SELECT count(*) FROM sqlite_master WHERE type='table'"
```

## Unresolved

- None. Drill completed with full parity.
- Note: staging has 0 rows in `user` and `promo_code_redemptions` — these are empty by design (staging). Row-level RPO only verifiable on a pre-populated staging fixture.
