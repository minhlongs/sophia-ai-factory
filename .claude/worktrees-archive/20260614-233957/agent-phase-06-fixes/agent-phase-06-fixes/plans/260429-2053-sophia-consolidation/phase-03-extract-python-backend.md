# Phase 03 — Extract Python Backend (SAFE)

> Move `mekong-cli/apps/sophia-factory/backend/` → `projects/sophia-ai-factory/apps/sophia-backend/`.

## Status: AUTO-RUN

## Background

`sophia-factory` ở mekong có:
- `backend/` — Python FastAPI: ai_client.py (4.5K), brand_voice.py (6K), main.py (11K), proposal_generator.py (6.7K), README.md, requirements.txt
- `src/components/` — empty stub (bỏ)

Total: 6 Python files, ~33KB code. Self-contained service.

## Steps

1. Create `~/projects/sophia-ai-factory/apps/sophia-backend/`
2. Copy backend/ contents (preserve mtime)
3. Add README header chỉ rõ source: "Migrated from mekong-cli/apps/sophia-factory/backend on 2026-04-29"
4. Test: `cd apps/sophia-backend && pip install -r requirements.txt && python -c "import main"`
5. Add to monorepo's docs/codebase-summary.md

## NOT in scope

- Không xóa source ở `mekong-cli/apps/sophia-factory/` (làm ở Phase 5)
- Không integrate vào main app routing (separate task)

## Success Criteria

- `apps/sophia-backend/` exists with 6 Python files
- Python imports work
- README explains origin

## Risk: Low (copy only, source untouched)
