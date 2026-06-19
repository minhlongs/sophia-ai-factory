# Phase 06 — Layer Violations Cleanup

**Priority**: CRITICAL  
**Status**: Not Started  
**Estimated Time**: 2-3 days

---

## Context

Forbidden cross-layer imports phát hiện:

- **land → forest**: 23 occurrences (land KHÔNG được import forest)
- **tree → forest**: 42 occurrences (tree chỉ được import seed)
- **land → tree**: 55 occurrences (allowed, nhưng có thể design issue — review only)

Goal: Đưu về 0 violations cho land→forest và tree→forest.

---

## Architecture Rules

```
seed   → importable by ALL layers (foundational)
tree   → import: seed only
forest → import: seed, tree (+ có thể CALL land qua orchestration)
land   → import: seed, tree, forest (forest import vào land là VI PHẠM)
```

**Forbidden**:
- `seed → tree/forest/land`
- `tree → forest/land`
- `land → forest` (tạo circular dependency cho orchestration paths)

---

## Step-by-Step

### Step 6.1: Land → Forest violations (Priority: HIGH)

Land import forest là nghiêm cấm. Forest có thể gọi land (orchestration), nhưng land không được import forest.

**Xác định tất cả land→forest imports**:

```bash
cd apps/sophia-ai-factory
grep -rn "from ['\"]@/forest" src/land/ | grep -v "\.test\.ts" | cut -d: -f1 | sort -u > reports/land-forest-imports-before.txt
wc -l reports/land-forest-imports-before.txt
```

**Phân tích từng file** trong list:

Đối với mỗi file `src/land/...` import `@/forest/...`:

1. **Code này nên ở forest?** Nếu code là orchestrator logic (cron, Inngest, gateway), move file từ land → forest.
2. **Dependency nên đảo ngược?** Nếu forest code đang được gọi, chuyển thành Inngest event dispatch hoặc service injection.
3. **Code nên ở seed/tree?** Nếu là reusable logic shared across land, extract sang `seed/utils/` hoặc `tree/`.

**Common patterns & fixes**:

| Pattern | Fix |
|---------|-----|
| `land/...` import `@/forest/quota/*` | land không enforce quota. Move logic sang forest hoặc dùng event |
| `land/...` import `@/forest/usage-metering/*` | extract metering logic sang seed hoặc đảo ngược |
| `land/...` import `@/forest/raas/*` | extract sang `tree/` hoặc `seed/` |
| `land/...` import `@/forest/publishing/*` | publishers nên ở land (sẽ move trong Phase 4). Move còn lại sang land. |

**Strategy**: Với mỗi violation, chọn 1 trong:
- **Move file** từ land → forest (nếu là orchestration)
- **Extract shared code** sang `seed/utils/` hoặc `tree/`
- **Replace direct call** với Inngest event dispatch (forestdispatch → land handler)

**Lưu ý**: Một số imports có thể là từ `forest/inngest/functions/` đang được refactor trong Phase 4. Nếu đã move logic sang land, thì import từ land sẽ đúng. Phase 4 nên giải quyết một số land→forest violations liên quan đến publish/generate.

### Step 6.2: Tree → Forest violations (Priority: HIGH)

Tree chỉ được import seed. Import forest表明 tree code đang làm orchestration (nhiệm vụ của forest).

**Xác định tất cả tree→forest imports**:

```bash
cd apps/sophia-ai-factory
grep -rn "from ['\"]@/forest" src/tree/ | grep -v "\.test\.ts" | cut -d: -f1 | sort -u > reports/tree-forest-imports-before.txt
wc -l reports/tree-forest-imports-before.txt
```

**Phân tích từng file**:

1. **File là orchestration/cron/gateway logic?** → Move toàn bộ file từ `tree/` sang `forest/`:
   - `tree/telegram/*` → `forest/telegram/` hoặc `forest/missions/telegram/`
   - `tree/gateway/*` → `forest/gateway/` (gateways là infrastructure)
   - `tree/outbox/*` → `forest/outbox/`
   
2. **Chỉ một small helper được dùng?** → Extract helper đó sang `seed/utils/` hoặc `tree/` shared module, giữ file gốc trong tree.

3. **Forest code nên gọi tree?** → Invert dependency: forest dispatch event → tree handler (thay vì import).

**Common patterns**:
- `tree/telegram/dispatch-with-retry-hints.ts` import `@/forest/publishing/*` → Move sang `forest/inngest/functions/` hoặc `forest/missions/`
- `tree/gateway/openclaw-gateway.ts` import `@/forest/raas/*` → Extract raas logic sang `seed/` hoặc move gateway sang forest
- `tree/outbox/*` import `@/forest/usage-metering/*` → Move outbox sang forest

### Step 6.3: Land → Tree review (Priority: MEDIUM)

Land import tree là allowed. Nhưng 55 occurrences có thể quá nhiều.

```bash
grep -rn "from ['\"]@/tree" apps/sophia-ai-factory/src/land/ | grep -v "\.test\.ts" | wc -l
```

**Review**: Các import này đang dùng tree utilities (BYOK, handover, audit, telegram) hay domain-specific code?

- Nếu là utilities → đúng chỗ (tree là reusable domain logic)
- Nếu là code thuộc về land → cân nhắc move sang land
- Nếu là code nên ở seed → extract sang seed

**Không cần action** trừ khi design improvement rõ ràng.

### Step 6.4: Run verification

Sau khi fix:

```bash
cd apps/sophia-ai-factory

# Count violations (expect 0)
LAND_FOREST=$(grep -rn "from ['\"]@/forest" src/land/ | grep -v "\.test\.ts" | wc -l | tr -d ' ')
TREE_FOREST=$(grep -rn "from ['\"]@/forest" src/tree/ | grep -v "\.test\.ts" | wc -l | tr -d ' ')

echo "land→forest: $LAND_FOREST"
echo "tree→forest: $TREE_FOREST"

if [ "$LAND_FOREST" -ne 0 ]; then
  echo "❌ land→forest violations còn lại:"
  grep -rn "from ['\"]@/forest" src/land/ | grep -v "\.test\.ts"
  exit 1
fi

if [ "$TREE_FOREST" -ne 0 ]; then
  echo "❌ tree→forest violations còn lại:"
  grep -rn "from ['\"]@/forest" src/tree/ | grep -v "\.test\.ts"
  exit 1
fi

echo "✅ All layer violations resolved (0 land→forest, 0 tree→forest)"
```

### Step 6.5: Type-check và test

```bash
npm run type-check
npm test
```

---

## Detailed Fixes (Pre-identified)

Dựa trên grep trước, đây là các file cần sửa (ví dụ — cần verify chính xác):

### Land → Forest (23 violations)

Các import phổ biến:
- `@/forest/quota/video-quota` → move quota enforcement sang forest hoặc event-based
- `@/forest/usage-metering/...` → extract sang `seed/utils/`
- `@/forest/raas/...` → move RaaS logic sang `tree/raas/` (đã có?)

**Approach**:
1. Tạo `seed/utils/quota-enforcer.ts` với logic quota check (pure function)
2. land import từ `@/seed/utils/quota-enforcer` thay vì `@/forest/quota/video-quota`
3. Forest quota vẫn gọi land khi cần (orchestration allowed)

### Tree → Forest (42 violations)

Các import phổ biến:
- `tree/telegram/*` import `@/forest/publishing/*` → move telegram handlers sang `forest/missions/` hoặc `forest/inngest/functions/`
- `tree/gateway/*` import `@/forest/raas/*` → extract gateway logic sang `forest/gateway/`

**Approach**:
1. Move `tree/telegram/dispatch-with-retry-hints.ts` sang `forest/missions/telegram/`
2. Update imports từ `@/tree/telegram/dispatch-with-retry-hints` sang `@/forest/missions/telegram/dispatch-with-retry-hints`
3. Move `tree/gateway/openclaw-gateway.ts` sang `forest/gateway/`
4. Update imports

---

## Verification Commands

```bash
cd apps/sophia-ai-factory

# 1. Count violations
grep -rn "from ['\"]@/forest" src/land/ | grep -v "\.test\.ts" | wc -l  # expect 0
grep -rn "from ['\"]@/forest" src/tree/ | grep -v "\.test\.ts" | wc -l  # expect 0

# 2. Type-check
npm run type-check

# 3. Tests
npm test

# 4. Build
npm run build
```

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Move file lớn → nhiều imports broken | HIGH | Dùng grep tìm tất cả imports trước khi move; update systematically |
| Circular dependency sau khi move | HIGH | Hiểu rõ dependency direction; dùng events nếu cần invert |
| Quota logic move → land không còn access | MEDIUM | Giữ forest→land orchestration (allowed); land gọi event, forest xử lý |
| Telegram dispatch break → bot fail | HIGH | Test Telegram bot flow sau khi move; giữ nguyên logic |

---

## Rollback

- Move files với `git mv` → có thể revert
- Import changes: revert commit hoặc `git checkout -- <file>`
- Nếu đã commit: tạo feature branch mới từ commit trước đó

---

## Success Criteria

- [ ] `grep "from '@/forest" src/land/ | grep -v test` → 0 lines
- [ ] `grep "from '@/forest" src/tree/ | grep -v test` → 0 lines
- [ ] `npm run type-check` → 0 errors
- [ ] `npm test` → all pass
- [ ] `npm run build` → success
- [ ] Tất cả files moved có barrel index.ts (nếu cần backward compat)

---

## Notes

- Phase này có thể overlap với Phase 4 (Inngest refactor) — sau Phase 4, một số land→forest violations sẽ tự nhiên biến mất vì publishers đã move sang land.
- Phase 5 (Missions reorg) cũng ảnh hưởng tree→forest nếu có imports trỏ đến missions.
- Thứ tự nên làm: **Phase 4 → Phase 5 → Phase 6** để minimize conflicts.
