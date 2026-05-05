# Publishers 3 Implementation Report — 260503

## Pinterest Publisher (FULL)

**Files created (LOC):**
- `src/lib/publishing/pinterest-publisher.ts` — 173 LOC
- `src/app/api/oauth/pinterest/route.ts` — 62 LOC
- `src/app/api/oauth/pinterest/callback/route.ts` — 182 LOC
- `src/lib/publishing/__tests__/pinterest-publisher.test.ts` — 5 tests

**OAuth scopes:** `boards:read`, `pins:read`, `pins:write`, `user_accounts:read`
**Max upload:** 2GB / 30 min (Pinterest API v5 video Pin limit)
**Special notes:** Product tags embedded via `media_product_tags` + `link` field when `productLink` provided. Metrics use `/pins/{id}/analytics` endpoint with IMPRESSION/SAVE/OUTBOUND_CLICK/PIN_CLICK.

---

## LinkedIn Publisher (FULL)

**Files created (LOC):**
- `src/lib/publishing/linkedin-publisher.ts` — 208 LOC
- `src/app/api/oauth/linkedin/route.ts` — 60 LOC
- `src/app/api/oauth/linkedin/callback/route.ts` — 184 LOC
- `src/lib/publishing/__tests__/linkedin-publisher.test.ts` — 5 tests

**OAuth scopes:** `w_member_social`, `r_liteprofile`
**Max upload:** 5GB / 10 min (Community Management API native video)
**Special notes:** Two-step upload: `/v2/assets?action=registerUpload` → PUT video → `/v2/posts`. Post URN returned. Commentary capped at 3000 chars. SOP playbooks `daily-linkedin-post.ts` and `linkedin-outreach.ts` now have a backing publisher. Rate limit: 10/day (strict LinkedIn CMA quota).

---

## Zalo Publisher (SKELETON + OAuth)

**Files created (LOC):**
- `src/lib/publishing/zalo-publisher.ts` — 182 LOC
- `src/app/api/oauth/zalo/route.ts` — 58 LOC
- `src/app/api/oauth/zalo/callback/route.ts` — 183 LOC
- `src/lib/publishing/__tests__/zalo-publisher.test.ts` — 7 tests
- `src/lib/publishing/zalo-README.md` — VN business verification guide

**Special notes:** `ZaloVerificationRequiredError` thrown when both `ZALO_APP_ID` and `ZALO_OA_ACCESS_TOKEN` absent. Mode detection: `missing` → throw, `mock` (APP_ID set, no OA token) → return mock id, `real` (OA token set) → execute. Rate limit: 20/day.

**VN business verification:** OA must be verified at https://oa.zalo.me/manage/oa with business registration docs before API access works. 2–5 business day approval. See `zalo-README.md` for full walkthrough.

---

## Files Modified (existing)

- `src/lib/publishing/publisher-interface.ts` — added `'pinterest' | 'linkedin' | 'zalo'` to `ChannelProvider` union
- `src/lib/publishing/per-channel-quota.ts` — added Pinterest (100/day), LinkedIn (10/day), Zalo (20/day) quotas
- `src/lib/publishing/oauth-token-refresher.ts` — added `refreshPinterestToken`, `refreshLinkedInToken`, `refreshZaloToken` + switch cases

---

## Test Results

- Pinterest: 5 tests pass (mock mode ×3, upload/product-tag, error handling, 404 poll)
- LinkedIn: 5 tests pass (mock mode ×3, upload, error handling, 404 poll, truncation, metrics zero)
- Zalo: 7 tests pass (verification gate ×3, mock mode ×3, real upload)
- Total new: 17 tests pass
- Full suite: 2689/2720 pass (31 skipped — unchanged baseline)

---

## TypeScript Check

```
npx tsc --noEmit 2>&1 | tail -10
(no output)
EXIT: 0
```

---

## Migration Created

**Yes** — `migrations/0080-publisher-tokens-pinterest-linkedin-zalo.sql`

Reason: D1 `publishing_channels` table has a CHECK constraint `provider IN ('tiktok','youtube','instagram')`. D1 does not support `ALTER TABLE ... MODIFY COLUMN`. Migration uses drop-and-recreate pattern (copy to v2, drop old, rename) with expanded CHECK constraint. Idempotent / safe to re-run.

---

## Anything Skipped

- `publish-execute.ts` buildPublisher/buildPostUrl not extended — out of file ownership scope (existing file). New channels need wiring there when ready for end-to-end execution.
- Pinterest rate limit (100/day) is conservative estimate; real quota depends on app tier.
- LinkedIn `r_emailaddress` scope not requested — not needed for posting.
