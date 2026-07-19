# Phase 05 — Forest Missions Reorganization

**Priority**: HIGH  
**Status**: Not Started  
**Estimated Time**: 1-2 days

---

## Context

`forest/missions/` hiện tại là flat directory với 7 file. Cần tái cấu trúc thành subdirectories theo domain:

- `video/` — video.generate.*, video.publish.* events
- `campaign/` — campaign.* events
- `billing/` — billing webhook, subscription.*
- `quota/` — quota.* events
- `common/` — shared utilities (dispatcher, command-registry, etc.)

---

## Architecture Goal

```
forest/missions/
├── video/
│   ├── emit-video-generate.ts (moved)
│   └── index.ts (barrel)
├── campaign/
│   └── index.ts (barrel, future files)
├── billing/
│   ├── billing-webhook.ts (nếu có)
│   ├── subscription.*.ts
│   └── index.ts
├── quota/
│   ├── quota.*.ts
│   └── index.ts
├── common/
│   ├── command-registry.ts
│   ├── dispatcher.ts
│   ├── checkpoint-persistence.ts
│   ├── api-key-auth.ts
│   └── index.ts
└── index.ts (deprecated barrel re-export với warnings)
```

---

## Step-by-Step

### Step 5.1: Phân tích current missions files

Các file hiện tại trong `forest/missions/`:

- `api-key-auth.ts`
- `checkpoint-persistence.ts`
- `command-registry.ts`
- `dispatcher.ts`
- `emit-video-generate.ts`
- `fire-webhook.ts`
- `index.ts`

Xác định domain:
- `emit-video-generate.ts` → `video/`
- `command-registry.ts` (dispatch video/campaign/billing) → có thể giữ ở `common/` hoặc split
- `dispatcher.ts` (generic) → `common/`
- `checkpoint-persistence.ts` → `common/`
- `api-key-auth.ts` → `common/`
- `fire-webhook.ts` → `billing/` hoặc `common/`

### Step 5.2: Tạo cấu trúc thư mục mới

```bash
cd apps/sophia-ai-factory/src/forest/missions

mkdir -p video campaign billing quota common
```

### Step 5.3: Di chuyển files và cập nhật imports

Di chuyển từng file:

```bash
# Video
git mv emit-video-generate.ts video/

# Common (tất cả còn lại)
git mv api-key-auth.ts common/
git mv checkpoint-persistence.ts common/
git mv command-registry.ts common/
git mv dispatcher.ts common/
git mv fire-webhook.ts billing/  # hoặc common/ nếu dùng chung
```

**Cập nhật imports**:

Tìm tất cả imports trỏ đến các file đã move:

```bash
grep -rn "from '@/forest/missions/" apps/sophia-ai-factory/src/ | grep -v "\.test\.ts" | grep -v "index.ts" > reports/missions-imports-before.txt
```

Với mỗi import, cập nhật path:

- `@/forest/missions/emit-video-generate` → `@/forest/missions/video/emit-video-generate`
- `@/forest/missions/command-registry` → `@/forest/missions/common/command-registry`
- `@/forest/missions/dispatcher` → `@/forest/missions/common/dispatcher`
- v.v.

Sử dụng sed để bulk update (kiểm tra kỹ trước):

```bash
# Example sed (test on staging branch first)
sed -i '' "s/from '@/forest\/missions\/emit-video-generate'/from '@/forest\/missions\/video\/emit-video-generate'/g" $(git grep -l "emit-video-generate" -- '*.ts' '*.tsx')
```

**Lưu ý**: Giữ `forest/missions/index.ts` như barrel re-export để backward compatibility:

```typescript
// src/forest/missions/index.ts (DEPRECATED)
import { emitVideoGenerate as _emitVideoGenerate } from './video/emit-video-generate';
import { commandRegistry as _commandRegistry } from './common/command-registry';
import { dispatcher as _dispatcher } from './common/dispatcher';
import { checkpointPersistence as _checkpointPersistence } from './common/checkpoint-persistence';
import { apiKeyAuth as _apiKeyAuth } from './common/api-key-auth';

/**
 * @deprecated Sử dụng imports trực tiếp từ subdirectories.
 */
export const emitVideoGenerate = _emitVideoGenerate;
export const commandRegistry = _commandRegistry;
export const dispatcher = _dispatcher;
export const checkpointPersistence = _checkpointPersistence;
export const apiKeyAuth = _apiKeyAuth;

// Re-export tất cả từ subdirectories
export * from './video';
export * from './campaign';
export * from './billing';
export * from './quota';
export * from './common';
```

### Step 5.4: Cập nhật Inngest event registrations

Kiểm tra `forest/inngest/client.ts` hoặc nơi register Inngest functions — đảm bảo không có path cần update.

### Step 5.5: Run verification

```bash
cd apps/sophia-ai-factory
npm run type-check
npm test
npm run build
```

---

## Verification Commands

```bash
cd apps/sophia-ai-factory

# 1. Cấu trúc thư mục tồn tại
test -d src/forest/missions/video
test -d src/forest/missions/campaign
test -d src/forest/missions/billing
test -d src/forest/missions/quota
test -d src/forest/missions/common

# 2. Files đã move
test -f src/forest/missions/video/emit-video-generate.ts
test -f src/forest/missions/common/command-registry.ts
test -f src/forest/missions/common/dispatcher.ts
test -f src/forest/missions/common/checkpoint-persistence.ts
test -f src/forest/missions/common/api-key-auth.ts

# 3. Barrel index.ts tồn tại (deprecated nhưng vẫn work)
test -f src/forest/missions/index.ts

# 4. Không có broken imports (tất cả imports phải resolve)
npm run type-check  # phải pass

# 5. Build pass
npm run build

# 6. Tests pass
npm test
```

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Missed imports → runtime errors | HIGH | Dùng grep để tìm tất cả imports; chạy type-check kỹ |
| Barrel index.ts thiếu export | MEDIUM | Export tất cả từ subdirectories; test imports qua index |
| Dispatcher logic break | HIGH | Giữ nguyên code; chỉ change path; verify với integration tests |
| Event registration fail | HIGH | Verify Inngest client đã import đúng path |

---

## Rollback

- Dùng `git mv` để move → có thể revert với `git mv` ngược lại
- Nếu imports đã sửa mà chưa commit: `git checkout -- <file>` để revert
- Nếu đã commit: tạo branch mới từ commit trước đó và hotfix từ đó

---

## Success Criteria

- [ ] Tất cả files đã move đúng location
- [ ] Tất cả imports đã update (không còn `@/forest/missions/xxx` trỏ đến file đã move)
- [ ] Barrel `forest/missions/index.ts` vẫn work (backward compat)
- [ ] `npm run type-check` → 0 errors
- [ ] `npm test` → all pass
- [ ] `npm run build` → success
- [ ] Không có regression trong event dispatching
