# Phase 01 — Backup (SAFE)

> Snapshot 3 sophia trees trước mọi thao tác phá hủy.

## Status: AUTO-RUN

## Steps

1. tar.gz `~/projects/sophia-ai-factory/apps/sophia-proposal` (excl node_modules/.next/.turbo)
2. tar.gz `~/mekong-cli/apps/sophia-proposal` (excl node_modules/.next/.turbo)
3. tar.gz `~/mekong-cli/apps/sophia-factory` (excl node_modules)
4. SHA256 verify, save manifest

## Output

```
plans/260429-2040-sophia-consolidation/backups/
├── sophia-proposal-canon-260429.tar.gz
├── sophia-proposal-mekong-260429.tar.gz
├── sophia-factory-mekong-260429.tar.gz
└── MANIFEST.txt (sha256 sums)
```

## Success Criteria

- 3 tar.gz exist, sha256 verified
- Restore test: extract 1 archive to /tmp, verify package.json readable

## Risk: Low (read-only)
