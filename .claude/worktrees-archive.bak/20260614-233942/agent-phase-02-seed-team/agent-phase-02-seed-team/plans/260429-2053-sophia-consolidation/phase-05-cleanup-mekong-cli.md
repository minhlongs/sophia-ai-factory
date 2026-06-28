# Phase 05 — Cleanup mekong-cli (DESTRUCTIVE)

## Context Links
- [phase-04-merge-sophia-proposal.md](phase-04-merge-sophia-proposal.md) (must complete first)
- User directive: "cả 3 là 1" — single canon, no legacy mirror

## Overview
- **Priority:** P1 | **Status:** AUTO-EXECUTE (sau Phase 4 verify) | **Effort:** S (1h)
- Xóa `~/mekong-cli/apps/sophia-{proposal,factory}` khỏi mekong-cli sau khi canon đã ăn hết drift. Update workspace config.

## Key Insights
- Backup tar.gz đã có (Phase 1), rollback < 60s nếu cần
- Mekong-cli vẫn cần giữ các app KHÔNG phải sophia (toolchain CLI core)
- Update `pnpm-workspace.yaml` + `package.json` để loại bỏ 2 apps đã xóa

## Requirements
**Functional:**
- `git rm -r mekong-cli/apps/sophia-proposal mekong-cli/apps/sophia-factory`
- Update mekong-cli pnpm workspace
- Update mekong-cli docs (README, CLAUDE.md) bỏ reference sophia
- Mekong-cli build vẫn pass

**Non-functional:**
- Single commit: `chore: remove sophia apps (consolidated to projects/sophia-ai-factory)`
- Push ngay để CI verify

## Architecture
```
BEFORE:                              AFTER:
~/mekong-cli/                        ~/mekong-cli/
├── apps/                            ├── apps/
│   ├── sophia-proposal  ← REMOVE    │   └── (other apps only)
│   └── sophia-factory   ← REMOVE    └── (workspace updated)
└── ...

~/projects/sophia-ai-factory/        ~/projects/sophia-ai-factory/
└── apps/sophia-{ai-factory,         └── apps/sophia-{ai-factory,
    proposal,backend,...}                proposal,backend,...}  ← canon
```

## Related Code Files
**Delete:**
- `~/mekong-cli/apps/sophia-proposal/` (entire dir)
- `~/mekong-cli/apps/sophia-factory/` (entire dir)

**Update:**
- `~/mekong-cli/pnpm-workspace.yaml` (remove sophia paths)
- `~/mekong-cli/package.json` (remove sophia workspaces if listed)
- `~/mekong-cli/README.md` (remove sophia mentions)
- `~/mekong-cli/CLAUDE.md` (remove sophia rules)
- `~/mekong-cli/.github/workflows/*.yml` (remove sophia CI jobs if any)

## Implementation Steps
1. Verify canon green: `cd ~/projects/sophia-ai-factory && pnpm build && pnpm test`
2. Git status mekong-cli — ensure clean working tree
3. `cd ~/mekong-cli && git rm -r apps/sophia-proposal apps/sophia-factory`
4. Edit `pnpm-workspace.yaml` to drop sophia entries
5. Grep + edit docs (README, CLAUDE.md, .github/workflows) for sophia mentions
6. `pnpm install` to refresh lockfile
7. `pnpm build` mekong-cli → must pass
8. Commit + push: `chore: remove sophia apps (Phase 5 consolidation)`
9. Verify CI green

## Todo List
- [ ] Canon green verification
- [ ] git rm sophia-{proposal,factory}
- [ ] Update pnpm-workspace.yaml
- [ ] Grep + clean docs references
- [ ] pnpm install + build
- [ ] Commit + push
- [ ] CI green

## Success Criteria
- Mekong-cli build passes after removal
- 0 reference to sophia-{proposal,factory} in mekong-cli code/docs
- CI green
- Canon unchanged

## Risks + Mitigation
- **Risk:** Mekong CI job depends on sophia paths → **Mitigation:** Grep `.github/` first, remove jobs
- **Risk:** Hidden symlink or shared package import → **Mitigation:** `pnpm install` will fail loudly; rollback via `git revert`
- **Risk:** User wants legacy mirror → **Mitigation:** Backup tar.gz tồn tại; restore command documented in MANIFEST

## Security Considerations
- Không có secret trong sophia-{proposal,factory} mekong fork (đã verified ở Phase 1 backup)
- Force push KHÔNG dùng — `git rm` + commit thường

## Next Steps
- → Phase 6 (video pipeline foundation)
