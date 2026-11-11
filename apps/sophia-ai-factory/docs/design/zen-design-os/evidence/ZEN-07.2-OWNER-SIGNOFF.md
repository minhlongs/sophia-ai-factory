# ZEN-07.2 — Independent Visual Acceptance & CSP Hardening — Owner Sign-Off Packet (G8)

**Repository:** `github.com/minhlongs/sophia-ai-factory`
**Branch:** `design/sophia-zen-design-os-v1`
**Reported Handover Commit:** `4d23ddb386f499b7627f2c828a1b80c81c6a3382`
**Baseline (`main`):** `673ec911be317233c7e6cb961bdca9d2097e210f`
**Verification Date:** `2026-11-11`
**Independent Verdict:** **`READY_FOR_OWNER_REVIEW`**

---

## 1. Executive Summary (Tóm tắt cho Founder)

Nhánh `design/sophia-zen-design-os-v1` (Zen Design OS v1.0) đã được kiểm thử độc lập trên trình duyệt Chrome thật (`localhost:3000`) qua đủ 9 cổng G0 → G8. Trong quá trình kiểm định độc lập, chúng tôi đã **phát hiện và sửa triệt để 7 lỗi thực tế (1 P0 + 6 P1)** mà báo cáo bàn giao ban đầu (`4d23ddb38`) bỏ sót:

1. **[P0 — Đã sửa] Chặn lỗi HTTP 429 ở Setup Wizard BYOK (`src/middleware/api-handler.ts:71`):** Route `/api/user/byok` trước đó bị gom chung vào bucket `auth` (10 req/phút) cùng với `/api/auth/*`, khiến luồng đăng nhập + kiểm tra key ở Setup Wizard bị dính `429 Too Many Requests`. Đã tách `/api/user/byok` sang bucket 50 req/phút và khóa bằng 5 unit tests (`src/middleware/__tests__/api-handler-rate-limit-buckets.test.ts`).
2. **[P1 — Đã sửa] Lỗi tương phản Light Mode trên `NicheGate1ReadinessCard` (`src/components/niche-studio/niche-gate1-readiness-card.tsx:24,36,49`):** Class `bg-zinc-900/70` không có semantic Light token khiến nền biến thành màu xám đục trên nền sáng, vi phạm WCAG 2.2 AA (`color-contrast` 1.38:1 – 4.02:1). Đã chuyển sang `bg-card dark:bg-zinc-900/70` và semantic text tokens.
3. **[P1 — Đã sửa] Lỗi tương phản Light Mode trên `VideoCompliancePreviewPlayer` (`src/components/niche-studio/video-compliance-preview-player.tsx:58`):** Trạng thái rỗng dùng `bg-zinc-900/40` làm giảm tương phản chữ trong Light mode (2.21:1). Đã chuyển sang `bg-card dark:bg-zinc-900/40`.
4. **[P1 — Đã sửa] Độ tương phản nút Primary ở Dark Mode (`src/components/stitch/ui/button-styles.ts:14`):** `bg-primary` (`#6366F1`) với chữ trắng đạt 4.47:1 (thiếu 0.03 so với ngưỡng 4.5:1 của WCAG AA). Đã thêm `dark:bg-primary-600 dark:text-white` (`#4F46E5` → **6.29:1** ở Dark mode, **8.61:1** ở Light mode) và đồng bộ test contract.
5. **[P1 — Đã sửa] Vi phạm cổng CI `check:color-tokens` (`src/components/niche-studio/sophia-artifact-canvas.tsx:140-149`):** Commit `4d23ddb38` thêm 5 mã màu hex cứng làm gãy `npm run check:color-tokens` (exit 1). Đã thay bằng CSS variables `var(--primary-600)`, `var(--primary-foreground)` và token helpers (`0` hex literals).
6. **[P1 — Đã sửa] Hồi quy test badge PRO (`src/forest/dashboard/dashboard-user-card.tsx:24`):** Khôi phục `dark:text-violet-300` (~8.5:1 trên nền tối) để vừa đạt chuẩn tương phản AA vừa giữ nguyên contract test.
7. **[P1 — Đã sửa] Hồi quy `aria-label` trên form Niche Studio (`src/components/niche-studio/niche-form-product-inputs.tsx:102,118`):** Khôi phục `aria-label` trên 2 ô nhập URL sản phẩm và Social Proof để đảm bảo screen reader và bộ test UI pass 100%.

---

## 2. Gate-by-Gate Verification Ledger (G0 → G8)

| Gate | Scope | Status | Evidence File |
|:--|:--|:--:|:--|
| **G0** | Exact Baseline & Worktree Integrity | **PASS** | Branch `design/sophia-zen-design-os-v1` verified against `main` (`673ec911b`); zero destructive git commands executed. |
| **G1** | Real Browser Test Environment (12 route/theme loads) | **PASS** | [`ZEN-07.2-VISUAL-EVIDENCE.md`](./ZEN-07.2-VISUAL-EVIDENCE.md) · [`g1-route-logs.json`](./g1-route-logs.json) (12/12 HTTP 200, 0 console/hydration/asset errors). |
| **G2** | Dark/Light Persistence & Strict Nonce CSP | **PASS** | [`ZEN-07.2-DARK-LIGHT-CSP-AUDIT.md`](./ZEN-07.2-DARK-LIGHT-CSP-AUDIT.md) · [`g2-audit.json`](./g2-audit.json) (13/13 checks pass, unique per-request nonces, no `unsafe-inline` in `script-src`, `Cache-Control: no-store`). |
| **G3** | 36-Screenshot Visual Matrix + Targeted States | **PASS** | [`ZEN-07.2-VISUAL-EVIDENCE.md`](./ZEN-07.2-VISUAL-EVIDENCE.md) · [`g3-manifest.json`](./g3-manifest.json) · [`screenshots/`](./screenshots/) (36 PNGs) · [`targeted/`](./targeted/) (4 PNGs). |
| **G4** | WCAG 2.2 AA & Reduced Motion Governance | **PASS** | [`ZEN-07.2-WCAG-AND-MOTION-EVIDENCE.md`](./ZEN-07.2-WCAG-AND-MOTION-EVIDENCE.md) · [`g4-axe-summary.json`](./g4-axe-summary.json) (0 axe violations across 12/12 combos) · [`g4-manual-a11y.json`](./g4-manual-a11y.json) (320px reflow pass, keyboard focus rings visible, 4 motion primitives verified). |
| **G5** | Functional Workflow Regression | **PASS** | [`ZEN-07.2-FUNCTIONAL-REGRESSION.md`](./ZEN-07.2-FUNCTIONAL-REGRESSION.md) (Better Auth, Setup Wizard BYOK, Dashboard nav, Niche Studio canvas, bilingual i18n, 294/294 related tests green). |
| **G6** | Performance & OpenNext Cloudflare Build | **PASS** | [`ZEN-07.2-PERFORMANCE-COMPARISON.md`](./ZEN-07.2-PERFORMANCE-COMPARISON.md) · [`g6/g6-runtime-perf.json`](./g6/g6-runtime-perf.json) (+3.86 KB gzip JS, +1.23 KB gzip CSS, OpenNext Worker **9.46 MB** < 10 MB limit, max lab CLS `0.0005`). |
| **G7** | Design Truth Audit | **PASS** | [`ZEN-07.2-PERFORMANCE-COMPARISON.md`](./ZEN-07.2-PERFORMANCE-COMPARISON.md) (§4 distinguishes `VISUALLY VERIFIED`, `IMPLEMENTED`, `TESTED ONLY`, and `DOCUMENTED ONLY`). |
| **G8** | Handover Packet & Local Checkpoint Commit | **PASS** | All 6 `ZEN-07.2-*.md` reports generated with exact `file:line` references and reproducible commands. |

---

## 3. Non-Blocking Observations & Follow-Ups

1. **Cloudflare Zone Rocket Loader:** Must remain **OFF** in the Cloudflare Dashboard for `sophia.agencyos.network` so that per-request CSP nonces and the synchronous `next-themes` flash-guard script are never rewritten to `type="text/rocketscript"`.
2. **Narrative Font Names in `DESIGN.md`:** `DESIGN.md` mentions `Satoshi` and `Instrument Serif` in prose, whereas `src/app/layout.tsx` and `.claude/rules/sophia-design-authority.md` intentionally load `Inter` and `JetBrains Mono` (`next/font/google`). If desired in a future doc pass, update `DESIGN.md` prose to match `src/app/globals.css`.
3. **Production Protection Honored:** No `git push`, no branch merge, no Cloudflare deploy, and no paid third-party API calls were executed during this acceptance pass.

---

## 4. Founder Sign-Off Checklist (Left Unchecked per Protocol)

- [ ] **Founder Visual Approval:** Reviewed the 36 base screenshots and 4 targeted screenshots in `docs/design/zen-design-os/evidence/screenshots/` and `targeted/`.
- [ ] **Founder Dual-Theme & Security Approval:** Reviewed `ZEN-07.2-DARK-LIGHT-CSP-AUDIT.md` and `ZEN-07.2-WCAG-AND-MOTION-EVIDENCE.md`.
- [ ] **Founder Release Authorization:** Authorize merging `design/sophia-zen-design-os-v1` into `main` to trigger the canonical GitHub Actions Cloudflare Workers deployment (`.github/workflows/deploy.yml`).
