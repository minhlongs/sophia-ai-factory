# Sophia AI Factory — LLM Tier Routing Brainstorm
Priority: P1
Drafted: 2026-07-27
Status: IN PROGRESS

## 1. Hiện trạng
| Layer | Location | Role | Status |
|---|---|---|---|
| land/openclaw/llm-router.ts | Custom router | Qwen local → Claude fallback | Working, 0 tests |
| land/openclaw/llm-cost-tracker.ts | Cost tracker | Per-tenant in-memory usage | Working |
| land/openclaw/llm-tier-bridge.ts | NEW | Tier → LLMTier mapping | Created 2026-07-27 |
| seed/inference/openrouter-client.ts | Production client | OpenRouter cloud + Anthropic fallback | Has unbound imports |
| seed/config/tiers/tier-configs.ts | Tier config | BASIC/PREMIUM/ENTERPRISE/MASTER | Working |

## 2. Vấn đề cần giải quyết
1. llm-router.ts dùng lite|standard|max không map trực tiếp sang tier Sophia
2. openrouter-client.ts import DEFAULT_MODEL_LIMITS và tokenCounter chưa resolve → type-check fail
3. 169 tests failing (không phải core nhưng chặn CI gate)
4. Router hiện tại 0% test coverage

## 3. Recommendation
Chốt: Dùng bridge layer đã tạo
- BASIC → lite (Qwen 32B local, miễn phí)
- PREMIUM → standard (Qwen 32B + Claude Haiku fallback)
- ENTERPRISE/MASTER → max (Claude Sonnet/Opus)

Không sửa core router — chỉ wrap.

## 4. Implementation Steps
### Phase 1: Fix unbound imports (30 phút)
1. Tìm DEFAULT_MODEL_LIMITS và tokenCounter — đang import từ '@/seed/ai/...' thay vì đường dẫn canonical mới

### Phase 2: Bridge integration (1h)
2. Wire tierToLLMTier() vào hot paths hiện có
3. Verify compile với npm run type-check

### Phase 3: Test (2-3h)
4. Tạo llm-router.test.ts
5. Fix batch failing tests theo nhóm

## 5. Commit Message
feat(llm): tier-aware routing bridge + type-check fixes

- Add tierToLLMTier() mapping (BASIC→lite, PREMIUM→standard,
  ENTERPRISE/MASTER→max) in src/land/openclaw/llm-tier-bridge.ts
- Fix unbound imports in openrouter-client.ts (DEFAULT_MODEL_LIMITS,
  tokenCounter) to resolve type-check failures
- Add initial unit tests for llm-router (0% → target 70%)

## 6. Status
- [x] Brainstorm + recommendation
- [x] Create llm-tier-bridge.ts
- [ ] Fix openrouter-client.ts unbound imports
- [ ] Wire bridge into hot paths
- [ ] Add router tests
- [ ] Verify type-check green
