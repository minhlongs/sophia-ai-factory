# Phase 2: Billing, Payment & Admin Tests

- **Date:** 2026-05-30
- **Priority:** High
- **Status:** Pending

## Overview
Phase này tập trung vào các luồng thanh toán, đăng ký gói dịch vụ và các trang quản trị admin. Nó đảm bảo các tích hợp thanh toán (NOWPayments, v.v.) và cơ chế phân quyền admin/user hoạt động chính xác.

## Files to Run
1. `tests/e2e/checkout-flow.spec.ts`
2. `tests/e2e/refund-flow.spec.ts`
3. `tests/e2e/dunning-failed-payment.spec.ts`
4. `tests/e2e/quota-upsell.spec.ts`
5. `tests/e2e/dashboard-admin.spec.ts`
6. `tests/e2e/admin-promo-bulk.spec.ts`
7. `tests/e2e/admin-alerts-triage.spec.ts`

## Execution Command
```bash
PORT=3002 PLAYWRIGHT_TEST_BASE_URL=http://localhost:3002 npx playwright test tests/e2e/checkout-flow.spec.ts tests/e2e/refund-flow.spec.ts tests/e2e/dunning-failed-payment.spec.ts tests/e2e/quota-upsell.spec.ts tests/e2e/dashboard-admin.spec.ts tests/e2e/admin-promo-bulk.spec.ts tests/e2e/admin-alerts-triage.spec.ts
```

## Success Criteria
- Tất cả các test cases liên quan đến thanh toán và admin phải PASS 100%.
- Không có lỗi rò rỉ quyền hạn (Privilege escalation).
