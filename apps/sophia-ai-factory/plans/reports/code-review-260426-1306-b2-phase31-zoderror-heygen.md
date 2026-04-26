# Code Review: Phase 31 B2 — ZodError Migration + HeyGen Response Casts

**Date:** 2026-04-26 13:06
**Reviewer:** code-reviewer (Opus 4.7)
**Scope:** 7 files modified — Group A (6 ZodError v4) + Group B (1 heygen-client, 3 sites)
**Branch state:** Uncommitted working-tree changes (verified via `git diff`)

---

## Verification

| Check | Result |
|---|---|
| Zod version | `"zod": "^4.3.6"` confirmed in package.json |
| `tsc --noEmit` error count | **235** (matches claim 246 → 235, -11) |
| Residual `.error.errors` in src/ | **0** (grep clean) |
| HeyGen test suite | **8/8 pass** (`vitest run heygen-client.test.ts`) |
| Protected Flows touched | NONE (Setup Wizard / Telegram / NOWPayments untouched) |
| File sizes | All <200 LOC (heygen-client now 222 LOC pre-existing — no growth past threshold) |

---

## Group A — ZodError v4 Migration

### Correctness
The 6 sites are textbook Zod v4 migration. Pattern in every file:
```ts
const parsed = Schema.safeParse(body);
if (!parsed.success) {
  return NextResponse.json({ error: '...', details: parsed.error.issues }, { status: 400 });
}
```
- `parsed.success` discriminator narrows `parsed.error` to `ZodError`. Type-safe.
- `.issues` is the canonical Zod v4 field; `.errors` was removed in v4.0 ([Zod migration guide](https://zod.dev/v4/changelog)).
- `agent-task.ts` line 40 indexes `[0]?.message` — safe with optional chaining.

### API Contract Risk: LOW
The shape returned to clients shifts from "Zod v3 ZodError.errors (ZodIssue[])" → "Zod v4 ZodError.issues (ZodIssue[])". **The element type `ZodIssue` is structurally near-identical** in v4 (same `code`, `path`, `message`, `expected`, `received` fields). External consumers parsing `details[i].message` or `details[i].path` continue to work. No DTO contract test exists in the diff, but no behavioral break expected.

### Sub-Variant Compliance
N/A — these are property renames, not casts. ✅ Aligned with B2 doctrine (no `as any`, no `@ts-ignore`).

---

## Group B — HeyGen Response Casts

### Correctness
Three sites in `heygen-client.ts` apply Sub-Variant 1 (response-body inline cast):

**Lines 76–82 (`listAvatars`):**
```ts
const data = (await this.request("/avatars")) as { data?: { avatars?: HeyGenAvatar[] } | HeyGenAvatar[] };
const inner = data?.data;
if (inner && Array.isArray(inner)) return inner;
return inner?.avatars ?? [];
```
- Discriminated union `{avatars?: T[]} | T[]` is correct for HeyGen's two known response shapes.
- `Array.isArray(inner)` properly narrows to `HeyGenAvatar[]`; else-branch narrows to `{avatars?: HeyGenAvatar[]}`. ✅ Type-safe.
- `try/catch` envelope preserves `[]` fallback for both network and parse failures.

**Lines 87–93 (`listVoices`):** Identical pattern, structurally sound.

**Lines 126–134 (`createVideo`):**
```ts
const data = (await this.request("/video/generate", {...})) as { data?: { video_id?: string } };
const videoId = data?.data?.video_id;
if (!videoId) throw new Error(`HeyGen API: missing video_id in response`);
```
- Single-shape cast (no union). Throws on missing field, caught by outer `try` to record failed-usage telemetry. ✅ Behavior preserved.

### Behavior Preservation
Old code: `return data?.data?.avatars || data?.data || []`
- Returned `data.data` (raw array) when `.avatars` was falsy/missing — relied on JS truthy chain.

New code:
- Explicit `Array.isArray` check handles the same two shapes more rigorously.
- Edge case: if HeyGen returns `data: { avatars: [] }` (empty array, falsy `||` would have fallen through to `data.data` which is the wrapper object, then `[]`), the new code returns `[]` directly via `?? []`. **This is more correct** — the old code would have erroneously returned the wrapper object on empty avatars.

### Test Coverage
- `heygen-client.test.ts` mocks `{data: {avatars: mockAvatars}}` shape (line 54) and `{data: {video_id: 'vid_123'}}` (line 90). Both pass.
- **Gap (minor):** No test for the alternative shape `{data: HeyGenAvatar[]}` (raw array). Not a regression — old code didn't test this either.

---

## Edge Cases Reviewed (Scout)

1. **Zod v4 `.issues` on success branch:** Not accessible — guarded by `if (!parsed.success)`. ✅
2. **`flatten()` callers in other routes** (e.g. `media/generate/route.ts`, `checkout/route.ts`, `analytics/*`): `.flatten()` exists in v4 with same signature. Out of scope but verified safe. ✅
3. **HeyGen empty array case:** New code returns `[]`, old code returned wrapper object. **Improvement, not regression.** ✅
4. **Concurrent `listAvatars()` calls:** No shared state, stateless on instance. ✅
5. **Singleton `heygenClientInstance`:** Untouched, still safe. ✅

---

## Issues

### Critical: 0
### Major: 0
### Minor: 1

**M1 — HeyGen alternative shape untested (low value)**
- **Location:** `heygen-client.test.ts`
- **Finding:** Only `{data: {avatars: [...]}}` shape is mocked. The new `Array.isArray` branch handling `{data: [...]}` is untested.
- **Impact:** Low. The branch is defensive against undocumented HeyGen variance; if it never fires in production, it's dead-but-safe code.
- **Suggested fix (optional, not blocking):** Add one test case per method:
  ```ts
  vi.mocked(fetch).mockResolvedValue({
    ok: true,
    json: async () => ({ data: mockAvatars })  // raw array
  } as Response);
  ```
- **Recommendation:** Defer to follow-up. Not worth blocking this phase.

---

## Positive Observations

- **Type safety win**: Replacing `data?.data?.avatars || data?.data || []` (untyped chain) with explicit narrowing using `Array.isArray` is a proper improvement, not just a TS error band-aid.
- **Sub-Variant 1 doctrine adherence**: All 3 HeyGen casts are inline at the response site — no broad type assertions, no `unknown` intermediaries.
- **Zero regression risk on Zod**: Pure property rename within a guarded discriminated union narrowing.
- **Pattern consistency**: Sub-Variant 1 instance count now ~15+ across codebase reinforces the doctrine.
- **Protected Flows untouched**: `nowpayments-ipn`, `telegram-webhook`, `setup-wizard` not in the diff.

---

## Score

| Dimension | Score | Notes |
|---|---|---|
| Correctness | 10/10 | Zod migration textbook; HeyGen narrowing is sound |
| Type Safety | 10/10 | No `any`, no `@ts-ignore`, proper discriminated unions |
| Behavior Preservation | 10/10 | HeyGen edge case slightly improved; Zod is rename-only |
| Test Coverage | 9/10 | -1 for untested alternative HeyGen shape (M1, optional) |
| Doctrine Compliance | 10/10 | Sub-Variant 1 applied correctly |
| Risk | 10/10 | Zero critical, zero major, Protected Flows untouched |

### **Total: 9.83 / 10** ✅ AUTO-APPROVE (≥9.5, 0 critical)

---

## Recommended Actions

1. **Approve and commit.** No blocking issues.
2. **Optional follow-up** (not this phase): Add HeyGen test case for raw-array shape to harden M1.
3. **Suggested commit message:**
   ```
   refactor(typescript): Phase 31 B2 ZodError v4 + heygen response casts (-11 errors)

   - Migrate 6 sites from Zod v3 .error.errors to v4 .error.issues
   - Apply Sub-Variant 1 response-body cast to 3 heygen-client endpoints
     (listAvatars, listVoices, createVideo)
   - Improve defensive shape handling with Array.isArray narrowing
   - 246 → 235 TS errors (-11)
   ```

---

## Unresolved Questions

- None blocking. Optional: Confirm with HeyGen API docs whether `{data: HeyGenAvatar[]}` (raw array) shape actually occurs in production, or if it's purely defensive. If purely defensive, the `Array.isArray` branch could be removed in a future cleanup phase — but harmless to keep.
