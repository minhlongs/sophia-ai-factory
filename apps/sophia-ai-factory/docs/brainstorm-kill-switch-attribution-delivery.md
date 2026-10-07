# Brainstorm Contract & Implementation Delivery: Affiliate & Video Scaling Emergency Kill Switch Suite

## 1. Outcome
- Production-ready dual-layer Affiliate & Video Production Emergency Kill Switch suite with instant edge propagation (Cloudflare KV + in-memory hot cache) and durable encrypted SQLite persistence (Cloudflare D1 via `platform_configs`).
- Real-time attribution tracking on the Geo-Router Bridge Page (`src/land/affiliates/bridge/page.tsx`) logging visitor clicks with SHA-256 IP anonymization and appending `sub_id=${clickId}` to affiliate offers.
- Circuit-breaking integration into the autonomous video scaling engine (`autonomous-campaign-scaling-flow.ts`) to immediately halt viral video synthesis and dispatch when the kill switch is engaged by an authenticated operator or CEO.

## 2. Constraints & Layer Boundaries
- **Clean Architecture 4-Layer Boundaries**:
  - `seed`: Encrypted platform configuration persistence in `src/seed/db/platform-config-repo.ts`.
  - `tree`: Multi-tier kill switch state caching and resolution in `src/tree/affiliate/kill-switch/kill-switch-store.ts`.
  - `forest`: Inngest orchestration workflow in `src/forest/inngest/functions/autonomous-campaign-scaling-flow.ts`.
  - `land`: Authenticated Server Actions in `src/land/affiliates/actions/toggle-kill-switch-action.ts` and presentation bridge in `src/land/affiliates/bridge/page.tsx`.
- Strict zero-violation policy verified with `bash scripts/check-layer-boundaries.sh`.
- Zero `:any` types in TypeScript.
- Functional `Result<T, E>` pattern returned from Server Actions without unhandled exceptions.

## 3. Non-Goals
- Modifying third-party affiliate postback contracts or ClickBank/CJ webhook schemas.
- Adding unauthenticated public kill switch triggers.
- Changing residential proxy routing protocols.

## 4. Acceptance Criteria & Verification Evidence
- [x] `npm run type-check`: 0 TypeScript errors.
- [x] `bash scripts/check-layer-boundaries.sh`: 0 layer boundary violations.
- [x] `npm run i18n:validate`: 0 missing keys.
- [x] `npx vitest run`: All 530 affiliate & inngest test suites passing 100% green.
  - `src/land/affiliates/actions/__tests__/toggle-kill-switch-action.test.ts` (3/3 pass)
  - `src/tree/affiliate/kill-switch/__tests__/kill-switch-store.test.ts` (4/4 pass)
  - `src/land/affiliates/bridge/__tests__/page.test.tsx` (2/2 pass)
  - `src/forest/inngest/functions/__tests__/autonomous-campaign-scaling-flow.test.ts` (2/2 pass)
