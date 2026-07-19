# Phase 04 — Inngest Functions Refactor

**Priority**: CRITICAL  
**Status**: Not Started  
**Estimated Time**: 2-3 days

---

## Context

Hai Inngest function lớn trong `forest/inngest/functions/` chứa business logic thuộc về land layer:

- `publish-execute.ts` (620 dòng) — FSM cho video publishing workflow
- `generate-campaign.ts` (340 dòng) — Campaign generation orchestration

Ngoài ra, 14 publisher implementations trong `forest/publishing/` nên được move sang `land/video/publishing/providers/`.

---

## Architecture Goal

```
forest/inngest/functions/
  ├── publish-execute.ts  → thin wrapper (~50 dòng)
  └── generate-campaign.ts → thin wrapper (~50 dòng)

land/video/publishing/
  ├── execute.ts           ← core publishing FSM (từ publish-execute.ts)
  ├── campaign-orchestrator.ts ← campaign workflow (từ generate-campaign.ts)
  └── providers/          ← 14 publisher classes (từ forest/publishing/)

Helper files (generate-campaign-db.ts, generate-campaign-video-poller.ts,
generate-campaign-refund-notify.ts) → move sang land/video/generation/ hoặc land/campaign/
```

---

## Step-by-Step

### Step 4.1: Tạo land/video/publishing/execute.ts

1. Copy business logic từ `publish-execute.ts` (dòng 65-607) sang file mới
2. Giữ là pure function (không có Inngest wrapper)
3. Đổi tên main function thành `executePublishWorkflow` (không phải `publishExecute`)
4. Loại bỏ Inngest-specific: `inngest` import, xử lý `step` parameter
5. Giữ nguyên toàn bộ logic: atomic claim, token refresh, upload, polling, finalization
6. Export types từ module này

**Lưu ý**: Function nhận params: `{ jobId, tenantId, userId, step }` — `step` dùng cho `step.run` và `step.sleep` trong Inngest context.

### Step 4.2: Tạo wrapper mỏng publish-execute.ts

Replace toàn bộ nội dung `forest/inngest/functions/publish-execute.ts` với:

```typescript
import { inngest } from '@/forest/inngest/client';
import { executePublishWorkflow } from '@/land/video/publishing/execute';

export const publishExecute = inngest.createFunction(
  { id: 'publish-execute', retries: 3 },
  { event: 'publish.scheduled' },
  async ({ event, step }) => {
    const { jobId, tenantId, userId } = event.data as {
      jobId: string;
      tenantId: string;
      userId?: string;
    };
    
    return executePublishWorkflow({ jobId, tenantId, userId, step });
  },
);
```

### Step 4.3: Tạo land/video/generation/campaign-orchestrator.ts

1. Copy business logic từ `generate-campaign.ts` (dòng 56-339) sang file mới
2. Remove Inngest wrapper, expose function `runCampaignWorkflow`
3. Loại bỏ `step` parameter từ các internal functions; thay bằng callbacks cho progress updates
4. Giữ nguyên error handling, retry logic, notifications
5. Function nhận: `{ campaignId, userId, topic, audience, tier, resume?, resumeFrom?, step }`
6. Return: `{ success: boolean, campaignId?: string, error?: string }`

### Step 4.4: Tạo wrapper mỏng generate-campaign.ts

Replace với:

```typescript
import { inngest } from '@/forest/inngest/client';
import { runCampaignWorkflow } from '@/land/video/generation/campaign-orchestrator';

export const generateCampaign = inngest.createFunction(
  { id: 'generate-campaign', retries: 3 },
  { event: 'campaign.created' },
  async ({ event, step }) => {
    const { campaignId, userId, topic, audience, tier, resume, resumeFrom } = event.data as {
      campaignId: string;
      userId: string;
      topic: string;
      audience: string;
      tier: string;
      resume?: boolean;
      resumeFrom?: string;
    };
    
    return runCampaignWorkflow({ campaignId, userId, topic, audience, tier, resume, resumeFrom, step });
  },
);
```

### Step 4.5: Di chuyển helper files sang land/video/generation/

Di chuyển các file từ `forest/inngest/functions/` sang `land/video/generation/`:

- `generate-campaign-db.ts` → `land/video/generation/campaign-db.ts`
- `generate-campaign-video-poller.ts` → `land/video/generation/campaign-video-poller.ts`
- `generate-campaign-refund-notify.ts` → `land/video/generation/campaign-refund-notify.ts`

**Cập nhật imports**:
- Trong `land/video/generation/campaign-orchestrator.ts`
- Trong `forest/inngest/functions/generate-campaign.ts`

### Step 4.6: Di chuyển publishers sang land/video/publishing/providers/

1. Tạo thư mục: `land/video/publishing/providers/`
2. Di chuyển 14 publisher files từ `forest/publishing/`:
   ```
   tiktok-publisher.ts
   youtube-publisher.ts
   instagram-publisher.ts
   facebook-publisher.ts
   twitter-publisher.ts
   pinterest-publisher.ts
   linkedin-publisher.ts
   zalo-publisher.ts
   threads.ts
   reddit.ts
   bluesky.ts
   mastodon.ts
   twitter-oauth-client.ts (nếu cần)
   instagram-adapter.ts (nếu cần)
   ```
3. Cập nhật tất cả imports trong codebase:
   - `forest/inngest/functions/publish-execute.ts` (wrapper)
   - `land/video/publishing/execute.ts`
   - Bất kỳ file nào khác import các publisher này

4. Cập nhật `forest/publishing/index.ts` barrel — có thể giữ re-export từ location mới (backward compat) HOẶC update trực tiếp tất cả imports.

**Grep tìm imports**:

```bash
grep -rn "from '@/forest/publishing/.*-publisher" apps/sophia-ai-factory/src/ | cut -d: -f1 | sort -u
# Lặp cho từng publisher
```

### Step 4.7: Cập nhật imports trong publish-execute.ts

Trong `land/video/publishing/execute.ts`, đổi publisher imports từ `@/forest/publishing/` sang `@/land/video/publishing/providers/`.

Wrapper `forest/inngest/functions/publish-execute.ts` sẽ import publishers gián tiếp qua `execute.ts`, nên không cần sửa.

### Step 4.8: Verification

```bash
cd apps/sophia-ai-factory
npm run type-check
npm test
npm run build
```

Sửa bất kỳ import error nào.

---

## Verification Commands

```bash
cd apps/sophia-ai-factory

# 1. Type-check và build
npm run type-check
npm run build

# 2. Test (tất cả)
npm test

# 3. Verify wrapper size (nên ~50 dòng)
wc -l src/forest/inngest/functions/publish-execute.ts
wc -l src/forest/inngest/functions/generate-campaign.ts

# 4. Verify land services tồn tại
test -f src/land/video/publishing/execute.ts
test -f src/land/video/generation/campaign-orchestrator.ts

# 5. Verify publishers đã move
test -d src/land/video/publishing/providers/
ls src/land/video/publishing/providers/*-publisher.ts | wc -l  # expect 14

# 6. Check no land→forest imports trong các file land mới
grep -rn "from '@/forest" src/land/video/publishing/ | wc -l  # expect 0
grep -rn "from '@/forest" src/land/video/generation/ | wc -l  # expect 0 (trừ helper files đã move)
```

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Break production publishing flow | HIGH | Test wrapper kỹ; giữ nguyên FSM logic; chạy e2e tests |
| Missing import updates sau khi move publishers | MEDIUM | Dùng grep tìm tất cả imports; update systematically; chạy type-check |
| Inngest step.run/sleep không hoạt động trong land | HIGH | `step` object passed từ wrapper; đảm bảo land function nhận và dùng đúng |

---

## Rollback

1. Git: làm việc trên feature branch; commit sau mỗi sub-step. Nếu fail, `git reset --hard <last-good>`
2. File moves: dùng `git mv` để giữ history. Rollback bằng `git mv` ngược lại.
3. Nếu build fail: revert file cụ thể đã sửa, debug.
4. Production: deploy với `npm run deploy:full` và SHA verification. Nếu issue:
   ```bash
   npx wrangler rollback --name sophia-ai-factory --message "Rollback Phase 4" --yes
   ```

---

## Success Criteria

- [ ] `npm run type-check` → 0 errors
- [ ] `npm test` → all pass
- [ ] `npm run build` → success
- [ ] Wrapper files < 100 dòng mỗi file
- [ ] `src/land/video/publishing/execute.ts` tồn tại và đúng logic
- [ ] `src/land/video/generation/campaign-orchestrator.ts` tồn tại
- [ ] 14 publisher files trong `land/video/publishing/providers/`
- [ ] Không còn imports `@/forest/publishing/*-publisher` trong `src/land/`
- [ ] All tests cover new code paths (coverage không giảm)
