# Gate G12 — Rollback Plan (`PoC 01` & Batch 4 Release)

## 1. Nguyên tắc Đảo ngược / Reversibility Principle (VI / EN)

- **VI:** Mọi mô-đun trong `PoC 01` và Batch 4 (`research-experiments-extended.ts`, `sparse-data-growth-guard.ts`, `pilot-unit-economics.ts`, `status-diagnostics.ts`) là các hàm miền thuần túy (pure domain functions) và chỉ gắn vào `GET /api/open-core/status` qua tham số tùy chọn (`?pilot=true&experiments=true`) cùng metadata trong `experiment-feedback-cron.ts`. Không có thay đổi phá vỡ schema D1 hay các luồng được bảo vệ (Setup Wizard, Telegram Bot `@Sophia_Bbot`, NOWPayments IPN).
- **EN:** All modules introduced in `PoC 01` and Batch 4 are additive, pure domain primitives wired into `GET /api/open-core/status` behind opt-in query parameters (`?pilot=true&experiments=true`) and additive metadata in `experiment-feedback-cron.ts`. Zero breaking schema mutations and zero changes to protected flows.

---

## 2. Điều kiện Kích hoạt Quay lui / Rollback Triggers (`REPORT 10` & `REPORT 11`)

1. **SHA Parity Failure:** Live `https://sophia.agencyos.network/api/version` `.shortSha` does not match the merged `main` commit after GitHub Actions `deploy.yml` completes.
2. **Latency Regression:** Key validation or status endpoint p95 latency increases by more than `150ms`.
3. **Health Check Failure:** `/api/health` returns non-`200`, or `/vi/login` returns non-`200`.

---

## 3. Quy trình Quay lui Chuẩn / Canonical Rollback Procedure

### Phương án A: Revert Commit trên `main` qua GitHub Actions (Khuyến nghị / Canonical)

```bash
git revert HEAD -m 1 --no-edit
git push origin main
gh run watch
```

### Phương án B: Quay lui Tức thì trên Cloudflare Workers (Khẩn cấp / Emergency Break-Glass)

```bash
cd apps/sophia-ai-factory
npx wrangler rollback --name sophia-ai-factory --message "Gate G12 rollback to baseline 07bff6cb" --yes
curl -s "https://sophia.agencyos.network/api/version?rollbackVerify=$(date +%s)"
```

---

## 4. Kiểm chứng Sau Quay lui / Post-Rollback Verification

- `curl -s https://sophia.agencyos.network/api/version` trả về `.shortSha` của bản ổn định liền trước (`07bff6cb`).
- `curl -s -o /dev/null -w "%{http_code}\n" https://sophia.agencyos.network/api/health` trả về `200`.
- `curl -s -o /dev/null -w "%{http_code}\n" https://sophia.agencyos.network/vi/login` trả về `200`.
