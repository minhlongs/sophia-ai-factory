# Deprecation Candidates — Ứng Viên Loại Bỏ

> **Last updated:** 2026-08-20
> **Status:** Audit — đánh dấu chưa xóa. Không xóa code khi chưa có test + dependency analysis chứng minh an toàn.

---

## Workflow Duplicates — Nhân Bản Quy Trình

| Area | Path | Verdict | Reason |
|------|------|---------|--------|
| Landing workflows | `land/` | **MERGE** | Đa số logic overlap với `seed/inngest/`. Cần consolidate thành Inngest-based unified workflows. |
| Forest workflows | `forest/` | **MERGE** | Overlaps `land/` và `seed/`. Xác định domain riêng (creative content pipeline) trước khi merge. |
| Inngest engine | `seed/inngest/` | **KEEP** | Core orchestration layer. Nhận responsibility từ `land/` + `forest/` sau merge. |

> **Action:** Khi merge, đảm bảo không break Telegram bot webhook + NOWPayments IPN flow.

---

## Agent Systems — Hệ Thống Agent

| Area | Path | Verdict | Reason |
|------|------|---------|--------|
| Land agent chat | `land/agent-chat/` | **DELETE-LATER** | Ad-hoc, không có standard agent protocol. Cần audit trước khi xóa. |
| Forest agent fleet | `forest/agent-fleet/` | **MERGE** | Có fleet management ideas hay. Merge vào unified agent protocol ở Phase 1. |
| Tree agents | `tree/agents/` | **UNKNOWN** | Không rõ usage. Cần audit codebase grep để xác định callers. |

> **Action:** Audit `tree/agents/` trước. Nếu không có callers → DELETE-LATER. Nếu có callers → MERGE.

---

## Memory Systems — Hệ Thống Bộ Nhớ

| Area | Path | Verdict | Reason |
|------|------|---------|--------|
| Implicit memory | (scattered) | **UNKNOWN** | Không có centralized memory abstraction. Cần audit trước khi quyết định design. |

> **Action:** Phase 1 sẽ thiết kế `CreativeMemory` abstraction. Sau đó sweep codebase loại bỏ implicit memory patterns.

---

## AI Provider Duplicates — Nhân Bản Nhà Cung Cấp AI

| Area | Path | Verdict | Reason |
|------|------|---------|--------|
| Seed AI | `seed/ai/` | **KEEP** | Primary AI provider abstraction. Consolidation target. |
| Tree AI Providers | `tree/ai-providers/` | **MERGE** | Merge unique capabilities (nếu có) vào `seed/ai/`, rồi xóa. |

> **Action:** So sánh feature matrix trước. Merge unique features, xóa `tree/ai-providers/`.

---

## Billing Duplicates — Nhân Bản Thanh Toán

| Area | Path | Verdict | Reason |
|------|------|---------|--------|
| Land billing | `land/billing/` | **MERGE** | Consolidate vào `seed/billing/`. Polar đã rejected → không dùng Polar. |
| Seed billing | `seed/billing/` | **KEEP** | Canonical billing layer. NOWPayments IPN + tier activation. |

> **Action:** Đảm bảo protected flow (NOWPayments → tier activation) hoạt động sau merge.

---

## Video Generation Duplicates — Nhân Bản Tạo Video

| Area | Path | Verdict | Reason |
|------|------|---------|--------|
| Seed video generator | `seed/ai/video-generator.ts` | **KEEP** | Canonical video generation. |
| Land video | `land/video/` | **MERGE** | Merge unique features vào seed, rồi xóa land version. |

> **Action:** Audit feature set trước khi merge. Đảm bảo D-ID integration không break.

---

## Dead Scripts & Obsolete Docs

| Area | Path | Verdict | Reason |
|------|------|---------|--------|
| Dead scripts | (scattered `scripts/`) | **UNKNOWN** | Cần audit: script nào được CI/CD gọi, script nào không. |
| Obsolete docs | `docs/` (early drafts) | **DELETE-LATER** | Docs cũ sẽ bị thay thế bởi codebase-summary + PDR docs mới. |
| Abandoned experiments | (scattered) | **UNKNOWN** | Cần audit: experiment nào còn branch active, experiment nào đã abandoned. |

> **Action:** Tạo sweep script để liệt kê unused scripts + docs. Review từng file trước khi xóa.

---

## Redundant Services & Compatibility Layers

| Area | Path | Verdict | Reason |
|------|------|---------|--------|
| Temporary compatibility layers | (scattered) | **DELETE-LATER** | Nếu đã dùng > 3 tháng, cần either正式化 hoặc xóa. |
| Redundant services | (scattered) | **UNKNOWN** | Cần dependency graph analysis để xác định service nào truly redundant. |

---

## Tổng Kết Verdicts

| Verdict | Count | Description |
|---------|-------|-------------|
| **KEEP** | 4 | Canonical layers, giữ nguyên |
| **MERGE** | 6 | Consolidate unique features vào canonical, rồi xóa |
| **DELETE-LATER** | 3 | An toàn xóa sau khi audit + test |
| **UNKNOWN** | 4 | Cần audit sâu hơn trước khi quyết định |

> **Quy tắc:** Không xóa code chỉ vì "có vẻ unused". Phải có test + dependency analysis chứng minh an toàn.
