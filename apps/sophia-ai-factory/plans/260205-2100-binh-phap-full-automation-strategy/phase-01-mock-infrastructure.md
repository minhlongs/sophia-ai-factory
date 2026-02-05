# Phase 1: Mock Infrastructure & Test Harness

**Priority**: Critical 🔴
**Status**: Pending
**Context**: [Master Plan](./plan.md)

## 🎯 Objective
Decouple development and testing from paid/rate-limited APIs (HeyGen, ElevenLabs, Polar). Enable a consistent "Mock Mode" for local dev and CI.

## 🔍 Key Insights (from Research)
- **HeyGen Gap**: Currently has hard dependencies on real API keys. Needs a `MockHeyGenClient`.
- **Polar Sandbox**: Already supported via `NODE_ENV`, just needs explicit config.
- **Inconsistent Mocks**: ElevenLabs mocks exist but OpenRouter/Telegram are partial.
- **Service Pattern**: Direct imports (e.g., `import { getHeyGenClient }`) make testing hard. Need to refactor to Service Interfaces.

## 🛠Implementation Steps

### 1. Define Service Interfaces
Refactor direct API calls into typed interfaces to allow swapping implementations.
- **File**: `src/lib/services/types.ts`
- **Interfaces**: `IVideoService`, `IVoiceService`, `IScriptService`.

### 2. Implement Mock Services
Create robust mock implementations that return realistic dummy data.
- **Video**: `src/lib/heygen/mock-client.ts` (returns completed status + placeholder video URL).
- **Voice**: Enhance `ElevenLabs` mock to mimic API latency.
- **Script**: Enhance `OpenRouter` mock to return consistent JSON structure for snapshot testing.

### 3. Service Factory & Env Switch
Create a centralized factory to instantiate Real vs Mock services based on env.
- **File**: `src/lib/services/factory.ts`
- **Logic**: `if (process.env.NEXT_PUBLIC_MOCK_AI_SERVICES === 'true') return new MockVideoService();`

### 4. Telegram Dev Bot Setup
- **Task**: Create instructions/script to help devs set up a `_dev` bot.
- **Code**: Ensure webhook route validates `NODE_ENV` to allow local tunneling (ngrok) signatures if needed (or stick to mock webhook tests).

### 5. Update "Verify" Script
- Add a check in `./scripts/verify.sh` to ensure `npm run build` passes in Mock Mode.

## ✅ Definition of Done
- [ ] Developer can run `NEXT_PUBLIC_MOCK_AI_SERVICES=true npm run dev` and generate a full video campaign (Script -> Audio -> Video) without any API keys.
- [ ] `npm run test` passes with 100% mocked coverage for AI services.
- [ ] No "API Key missing" errors in the console during mock run.

## 🛡️ Risk Assessment
- **Risk**: Mock data drifting from real API response structure.
- **Mitigation**: Add a "Contract Test" that runs weekly against real APIs to verify mock schema accuracy.
