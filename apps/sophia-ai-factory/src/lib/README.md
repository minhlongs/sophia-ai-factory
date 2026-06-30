# src/lib/ — COMPATIBILITY DIRECTORY (DEPRECATED)

This directory previously held shared primitives. All files have been migrated to either `seed/` or `tree/` per the 4-layer architecture:

| Old Path | New Path | Date |
|----------|----------|------|
| `src/lib/redis-stub.ts` | `src/seed/db/redis-stub.ts` | 2026-06-30 |
| `src/lib/utils.ts` | `src/seed/utils/lib-utils.ts` | 2026-06-30 |
| `src/lib/admin/supabase-migrations-manifest.ts` | `src/tree/admin/supabase-migrations-manifest.ts` | 2026-06-30 |

Do NOT add new files to `src/lib/`. All new primitives belong in `seed/`, `tree/`, `forest/`, or `land/`.

See `CLAUDE.md` and `.claude/rules/sophia-layer-architecture.md` for layer rules.
