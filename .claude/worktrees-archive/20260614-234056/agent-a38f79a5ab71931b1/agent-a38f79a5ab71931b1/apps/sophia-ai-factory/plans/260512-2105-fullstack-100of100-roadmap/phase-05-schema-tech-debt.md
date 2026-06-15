# Phase 5: Schema & Tech Debt

## Context Links

- Audit: `plans/reports/debugger-260512-2058-fullstack-audit-rescore.md` §4 G9/G11
- Polar rejection note: `apps/sophia-ai-factory/CLAUDE.md` — "Polar.sh REJECTED this product"
- OpenNext cloudflare tag cache: `open-next.config.ts:14` (currently `tagCache: "dummy"`)
- Migration history: `apps/sophia-ai-factory/migrations/0001` → `0107`
- Source schema: `migrations/0019-raas-licenses.sql:4`

## Overview

- **Priority:** P2
- **Status:** pending
- **Brief:** Clean up dead `polar_customer_id` column (rename or drop) and decide on `tagCache` upgrade for proper ISR invalidation.
- **Effort:** ~2h
- **Score impact:** +1 (91 → 93+ cumulative)

## Key Insights

| Gap | Insight |
|-----|---------|
| G9 | `polar_customer_id` column in `raas_licenses` is dead — Polar rejected. **Unresolved Q4:** Live data check needed. If `SELECT COUNT(*) FROM raas_licenses WHERE polar_customer_id IS NOT NULL` returns 0 → safe DROP. If >0 → migrate data to `external_crm_id` (NOWPayments uses different ID space) or document acceptance. |
| G11 | `tagCache: "dummy"` means `revalidatePath()`/`revalidateTag()` are no-ops. Time-based ISR works (s-maxage), but explicit invalidation doesn't. **Evaluate** `@opennextjs/cloudflare`'s `d1NextTagCache` adapter — if mature, switch. If immature, document acceptance + GH tracker. |

## Requirements

**Functional:**
- F1: `polar_customer_id` either renamed to `external_crm_id`, dropped, or formally accepted as dead-but-kept (with comment in schema)
- F2: `tagCache` decision documented: either upgrade to `d1NextTagCache` OR document why staying with dummy is acceptable
- F3: If upgraded, `revalidatePath()`/`revalidateTag()` work in production smoke test

**Non-functional:**
- D1 migration runs in <30s
- No production data loss
- No regression to 4081 vitest

## Architecture

### G9 Decision Tree

```
SELECT COUNT(*) FROM raas_licenses WHERE polar_customer_id IS NOT NULL
  │
  ├─ 0 rows   ──► DROP COLUMN polar_customer_id  (clean exit)
  │
  ├─ >0 rows  ──► Option 1: RENAME TO external_crm_id (preserve data)
  │              Option 2: COPY values to new column, then DROP polar_customer_id
  │              Option 3: Document acceptance, leave as-is (low value)
```

### G11 Architecture Options

| Option | Complexity | Benefit |
|--------|-----------|---------|
| Keep `dummy` | Zero | Time-based ISR only; current state |
| `d1NextTagCache` (opennextjs) | Low — config change | Real tag-based invalidation; requires D1 table for cache state |
| Build custom (R2-backed) | High | Full control; YAGNI risk |

**Recommendation:** Try `d1NextTagCache`. If config-level integration works in dev within 30min → ship. If breaks → revert to dummy + document.

## Related Code Files

**Modify:**
- `apps/sophia-ai-factory/open-next.config.ts` — possibly switch `tagCache`
- `apps/sophia-ai-factory/migrations/<NEXT>-polar-column-cleanup.sql` — new migration (filename based on next sequence)
- `docs/project-changelog.md` — record schema change
- `docs/system-architecture.md` — update if tagCache changes affect ISR behavior

**Create:**
- `apps/sophia-ai-factory/migrations/0108-polar-customer-id-cleanup.sql` (or next sequence number — verify via `ls migrations/ | tail -5`)

**Delete:** None directly. Old column removed via migration ALTER.

## Implementation Steps

### Step A — G9 polar_customer_id (1h)

1. **Live data check** (READ-ONLY):
   ```bash
   npx wrangler d1 execute sophia-raas-db --remote --command="SELECT COUNT(*) AS total, COUNT(polar_customer_id) AS non_null FROM raas_licenses;"
   ```
2. **Branch based on result:**
   - **Case A (0 non-null):** Safe DROP path
   - **Case B (>0 non-null):** Data migration path — review what these IDs are; likely test data → still safe to DROP, but document in commit
3. **Write migration** — confirm next sequence number first:
   ```bash
   ls apps/sophia-ai-factory/migrations/ | tail -3
   ```
   Create `migrations/0108-polar-customer-id-cleanup.sql`:
   ```sql
   -- Case A (safe drop):
   ALTER TABLE raas_licenses DROP COLUMN polar_customer_id;
   
   -- OR Case B (rename to preserve historical IDs):
   -- ALTER TABLE raas_licenses RENAME COLUMN polar_customer_id TO external_crm_id;
   ```
4. **Dry-run locally** — apply against local D1 (if available), verify schema:
   ```bash
   npx wrangler d1 execute sophia-raas-db --local --file=migrations/0108-polar-customer-id-cleanup.sql
   npx wrangler d1 execute sophia-raas-db --local --command=".schema raas_licenses"
   ```
5. **grep code references** to `polar_customer_id`:
   ```bash
   grep -rn "polar_customer_id" src/ apps/
   ```
   Remove or update each (likely test fixtures + types).
6. **Update TypeScript types** if `raas_licenses` row type referenced in code.
7. **Apply remote** AFTER commit (per `sophia-deploy-verify.md` step 2):
   ```bash
   cd apps/sophia-ai-factory && bash scripts/apply-migrations.sh
   ```
8. **Verify** — `npx wrangler d1 execute sophia-raas-db --remote --command=".schema raas_licenses"` shows no `polar_customer_id`.

### Step B — G11 tagCache evaluation (1h)

9. **Research current state** — check `@opennextjs/cloudflare` version + docs:
   ```bash
   npm ls @opennextjs/cloudflare
   ```
   Check if `d1NextTagCache` is exported and stable in installed version.
10. **Try integration** — edit `open-next.config.ts`:
    ```ts
    import d1NextTagCache from "@opennextjs/cloudflare/overrides/tag-cache/d1-next-tag-cache";
    // ...
    tagCache: d1NextTagCache,
    ```
    Add required D1 table per their docs (likely a `next_tag_cache` table migration).
11. **Build + test**:
    ```bash
    npm run build
    npm test
    ```
    If build fails or types wrong → revert + document.
12. **Smoke test** — call a route that uses `revalidateTag()`, verify it actually invalidates cache (curl twice with cache breaker, compare).
13. **If accepting dummy**: leave config; add comment to `open-next.config.ts` explaining why + link to upstream feature tracker. Create GH issue or note in changelog.

### Step C — Finalize (15min)

14. **Run tests** — `npm test` → 4081+ pass.
15. **Build** — `npm run build` → 0 errors.
16. **Commit** — `refactor(schema): drop polar_customer_id + evaluate tagCache upgrade`.
17. **Deploy** — `npm run deploy:full` + apply migrations + SHA verify.
18. **Update docs** — changelog + system-architecture (if tagCache changed).

## Todo List

- [ ] G9: Live data check via `wrangler d1 execute --remote`
- [ ] G9: Decide DROP vs RENAME vs ACCEPT based on data
- [ ] G9: Identify next migration sequence number
- [ ] G9: Write `migrations/<NNNN>-polar-customer-id-cleanup.sql`
- [ ] G9: Dry-run migration locally
- [ ] G9: Grep + clean code references to `polar_customer_id`
- [ ] G9: Apply migration remote post-deploy
- [ ] G9: Verify schema via `.schema raas_licenses`
- [ ] G11: Check `@opennextjs/cloudflare` tagCache adapter status
- [ ] G11: Try `d1NextTagCache` integration in dev
- [ ] G11: If working, ship; if not, document acceptance
- [ ] G11: Smoke test `revalidateTag()` if upgraded
- [ ] Run `npm test` — 4081+ pass
- [ ] `npm run build` — 0 errors
- [ ] Deploy + SHA verify
- [ ] Update `docs/project-changelog.md`
- [ ] Update `docs/system-architecture.md` if tagCache changed

## Success Criteria

- `raas_licenses` schema no longer has `polar_customer_id` (or has comment justifying retention)
- tagCache decision documented in `open-next.config.ts` (either upgraded or comment explaining "dummy is acceptable for now")
- No code references remain to `polar_customer_id` (grep returns 0)
- Vitest 4081+ pass
- SHA match verified post-deploy
- D1 schema verified live via `.schema raas_licenses`

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| DROP COLUMN deletes live customer ID data | Live data check is gate; if non-null rows exist → choose RENAME or document |
| Migration sequence number collision | `ls migrations/ \| tail -3` to verify; never edit existing migration |
| `d1NextTagCache` immature, breaks production ISR | Test in dev first; revert via single config change if issues |
| Code still references `polar_customer_id` after migration → runtime errors | Grep is mandatory step; TS build will catch most |
| New tag-cache D1 table not migrated yet but config set | Bundle the D1 table migration in same commit |

## Security Considerations

- ALTER TABLE / DROP COLUMN on production D1 — irreversible. Backup first via Phase 4 cron (or manual `d1-snapshot.sh`).
- No new auth surfaces
- tagCache change doesn't affect auth/access control — only cache state

## Next Steps

- After Phase 5: re-run audit checklist (Layers 1, 9) — expect L1 score +1 from clean schema
- Re-run full audit framework to verify 93+/100 reached
- Future: schedule v2 audit in 3 months to catch new debt
- If 93+ not reached → re-audit lowest-scoring layer and create Phase 6
