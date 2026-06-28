# Phase 3: Video Pipeline & Handover Journey

- **Date:** 2026-05-30
- **Priority:** High
- **Status:** Pending

## Overview
Phase này tập trung vào quy trình phức tạp nhất của Sophia AI Factory: quy trình sản xuất video (Inngest, script, TTS, visual) và quy trình bàn giao khách hàng (handover journey, usability tests). Nó đảm bảo rằng hệ thống tự động hóa video và đại lý OpenClaw hoạt động đúng như thiết kế.

## Files to Run
1. `tests/e2e/free100-video-generation.spec.ts`
2. `tests/e2e/free100-distribute-telegram.spec.ts`
3. `tests/e2e/handover-journey-260519.spec.ts`
4. `tests/e2e/ux-usability-260519.spec.ts`
5. `tests/e2e/handover-bughunt-260519.spec.ts`
6. `tests/e2e/account-self-delete.spec.ts`
7. `tests/e2e/affiliate-flow.spec.ts`

## Execution Command
```bash
PORT=3010 PLAYWRIGHT_TEST_BASE_URL=http://localhost:3010 npx playwright test tests/e2e/free100-video-generation.spec.ts tests/e2e/free100-distribute-telegram.spec.ts tests/e2e/handover-journey-260519.spec.ts tests/e2e/ux-usability-260519.spec.ts tests/e2e/handover-bughunt-260519.spec.ts tests/e2e/account-self-delete.spec.ts tests/e2e/affiliate-flow.spec.ts
```

## Success Criteria
- Tất cả các test cases liên quan đến video generation và handover phải PASS 100%.
- Không có lỗi timeout do Inngest workflow bị nghẽn.
