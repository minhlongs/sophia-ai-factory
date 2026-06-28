# Phase 04 — Merge sophia-proposal Drift

## Context Links
- [scout monorepo map](research/scout-260429-2050-monorepo-map.md) §7 (drift cherry-pick)
- [phase-02-canonical-decision.md](phase-02-canonical-decision.md)
- Backup: `backups/sophia-proposal-mekong-260429.tar.gz`

## Overview
- **Priority:** P1 | **Status:** AUTO-EXECUTE | **Effort:** M (4h)
- Hợp nhất 234 file drift giữa `~/mekong-cli/apps/sophia-proposal` và canon `~/projects/sophia-ai-factory/apps/sophia-proposal`. Canon là CHÍNH; mekong là LEGACY mirror cần xóa sau Phase 5.

## Key Insights
- 76 file chỉ có ở canon → giữ nguyên
- 48 file chỉ có ở mekong → review per-file (loại Supabase migrations cũ, giữ business logic)
- 110 file diff cả 2 → 3-way merge với "newer mtime wins" + audit log
- Canon đã có Sentry, Cloudflare adapter, dompurify, eslint-config-next — KHÔNG ghi đè các file này
- Mekong có agi-sops fuller — cherry-pick `data/`, `docs/`, `plans/`, `tests/` nếu chưa có ở canon

## Requirements
**Functional:**
- Mọi business logic (proposal generation, PDF export, Anthropic prompts) phải hoạt động trong canon sau merge
- Test suite canon (~844 tests) phải vẫn pass

**Non-functional:**
- Audit log mỗi quyết định merge → `plans/260429-2040-sophia-consolidation/merge-audit.jsonl`
- Reversible: backup tar.gz đã có, rollback = `tar -xzf` over canon

## Architecture
```
~/mekong-cli/apps/sophia-proposal/   ─┐
                                      ├─→ diff per-file → decision matrix → merge-audit.jsonl
~/projects/sophia-ai-factory/         ─┘                              ↓
  apps/sophia-proposal/                                    canon updated in place
```

## Related Code Files
**Read (for diff):**
- `~/mekong-cli/apps/sophia-proposal/**/*` (legacy)
- `~/projects/sophia-ai-factory/apps/sophia-proposal/**/*` (canon)

**Write/update (canon side):**
- `apps/sophia-proposal/src/**` (cherry-picked business logic)
- `apps/sophia-proposal/data/`, `docs/`, `plans/`, `tests/` (agi-sops)
- `plans/260429-2040-sophia-consolidation/merge-audit.jsonl` (NEW)

**KHÔNG động:**
- `apps/sophia-proposal/migrations/*.sql` (legacy schema, deprecated)
- `apps/sophia-proposal/.env*`, `.vercel/`, `.turbo/`

## Implementation Steps
1. Generate diff matrix: `diff -rq mekong canon > diff.txt`
2. Parse vào CSV: `path,status,canon_mtime,mekong_mtime,decision`
3. Auto-resolve "Only in mekong" → copy if path matches whitelist (`{src,data,docs,plans,tests}/**`); skip otherwise
4. Auto-resolve "differ" với newer-mtime-wins, ngoại trừ blacklist (`.env*`, `migrations/`, lockfiles)
5. Manual review queue: 110 file → log JSONL → patch áp dụng
6. Run `pnpm install` + `pnpm test` ở canon root
7. Commit: `chore(sophia-proposal): merge mekong drift via 3-way (Phase 4)`

## Todo List
- [ ] Generate diff matrix CSV (234 rows)
- [ ] Auto-resolve "Only in mekong" whitelist filter
- [ ] Auto-resolve "differ" newer-mtime
- [ ] Manual review queue (interactive prompt list)
- [ ] Run canon tests → all pass
- [ ] Commit + push
- [ ] Verify CI green before Phase 5

## Success Criteria
- 0 syntax errors khi `pnpm build` ở canon
- 844+ tests pass (no regression)
- merge-audit.jsonl chứa 234 decisions có rationale
- Rollback test: `tar -xzf` restore < 60s

## Risks + Mitigation
- **Risk:** Newer mtime ≠ better code (mekong có thể bị stale modify) → **Mitigation:** Whitelist business logic dirs only; blacklist config/lockfiles
- **Risk:** Test suite catch không đủ regression → **Mitigation:** Manual smoke test 5 critical flows (proposal create/list/PDF export/auth/billing)

## Security Considerations
- KHÔNG copy `.env*` từ mekong (có credential cũ)
- Audit log không ghi nội dung file, chỉ path + mtime + decision
- Backup giữ tối thiểu 30 ngày

## Next Steps
- → Phase 5 (cleanup mekong-cli destructive)
- Blocker: 0 test fail; nếu fail → fix trước khi Phase 5
