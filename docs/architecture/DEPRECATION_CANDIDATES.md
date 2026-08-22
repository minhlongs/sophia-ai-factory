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
| Tree agents | `tree/agents/` | **KEEP** | 18 callers (verified 2026-08-22 grep). Live agent fleet: `repository` (create/list/get), `runner` (runAgent), `seed-default-team`, `types`. Consumed by `src/app/actions/agent-task.ts`, `agent-team-config.ts`, and 8 routes under `src/app/api/agents/**`. NOT orphan — MERGE target is `forest/agent-fleet` in Phase 1, not deletion. |

> **Action:** KEEP as-is. Phase 1 MERGE moves `tree/agents` fleet logic into the unified agent protocol alongside `forest/agent-fleet`; do NOT delete.

---

## Memory Systems — Hệ Thống Bộ Nhớ

| Area | Path | Verdict | Reason |
|------|------|---------|--------|
| Implicit memory | (scattered) | **MERGE** | 5 caller files found (verified 2026-08-22 grep): `forest/memory/memory-enrichment.ts`, `forest/agent-chat/memory-consolidation-service.ts`, `forest/agent-chat/memory-consolidation-storage.ts`, `forest/agent-chat/tool-executor.ts`, `tree/learning/learning-loop.ts`. These are real memory subsystems, not dead code — they MERGE into the canonical `tree/creative-memory` + new `ICreativeMemoryStore` contract (Step B this run) rather than being deleted. |

> **Action:** Phase 1 sweeps the 5 files onto `ICreativeMemoryStore`; anything still ad-hoc after that is DELETE-LATER.

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

## Mission Handler Contracts — Nhân Bản Hợp Đồng Xử Lý Nhiệm Vụ

| Area | Path | Verdict | Reason |
|------|------|---------|--------|
| Canonical lifecycle | `tree/mission/` | **KEEP** | Mission lifecycle + goals (create/get/list/status/transition/metrics). Imports canonical types from `@/seed/types/creative-economy` (verified 2026-08-22). This is the single home for mission lifecycle code. |
| Non-canonical handler surface | `tree/missions/` | **DEPRECATED** | Command registry, API-key auth, checkpoint persistence. Duplicates `tree/mission` lifecycle. Marked `@deprecated` (NOT TODO/FIXME) on every re-export; migration tracked for Phase 2. |
| Duplicated seed types | `seed/types/missions.ts` | **DEPRECATED** | Re-defines `MissionContext` + `MissionHandlerResult` already in `tree/missions/types.ts`. NOT deleted — 4 callers depend on it (`forest/missions/campaign-run.ts`, `tree/email/missions/email-campaign.ts`, `email-test.ts`, `email-templates.ts`). Marked `@deprecated`; must NOT be extended. |

> **Action:** Phase 2 consolidates all three into one mission module. Until then, new mission lifecycle code → `tree/mission`; new mission-handler types → `tree/missions/types.ts`.

---

## Agent Protocol Duplicates — Nhân Bản Giao Thức Agent

| Area | Path | Verdict | Reason |
|------|------|---------|--------|
| Tree agent protocol | `tree/agent-protocol/` | **MERGE** | 245 code lines, 1 test file. Lightweight executor/registry. |
| Forest agent protocol | `forest/agent-protocol/` | **MERGE** | 399 code lines, 0 test files. Heavier registry + types. |

> **Action:** `tree/agent-protocol` is the lighter, tested surface — merge its unique parts into `forest/agent-protocol` (which has the richer registry) and retire the tree copy. Do NOT delete either before Phase 1 agent-protocol consolidation.

---

## Autonomy Duplicates — Nhân Bản Tự Chủ

| Area | Path | Verdict | Reason |
|------|------|---------|--------|
| Tree autonomy | `tree/autonomy/` | **MERGE** | 290 code lines, 2 test files. Autonomy repo + transitions. |
| Forest autonomy | `forest/autonomy/` | **MERGE** | 198 code lines, 1 test file. Autonomy policy/types. |

> **Action:** Merge the forest autonomy policy/types into `tree/autonomy` (which owns the repo + transitions), then retire the forest copy. Both are live — neither is dead.

---

## Memory System Duplicates — Hệ Thống Bộ Nhớ (3-way)

| Area | Path | Verdict | Reason |
|------|------|---------|--------|
| Tree memory | `tree/memory/` | **MERGE** | 2064 code lines, 1 test file. Conversation summarizer, consolidator, extractor, pruner, repository. Largest memory subsystem. |
| Tree creative memory | `tree/creative-memory/` | **KEEP** | 364 code lines, 1 test file. Decay + types for the canonical creative memory store. Backed by `ICreativeMemoryStore` (Step B this run). |
| Forest memory | `forest/memory/` | **MERGE** | 489 code lines, 0 test files. Context-window service + enrichment. |

> **Action:** Phase 1 sweeps `tree/memory` and `forest/memory` onto the canonical `ICreativeMemoryStore` contract (Step B). `tree/creative-memory` is the KEEP target — it owns the decay/types for creative memory specifically.

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
| **KEEP** | 7 | Canonical layers, giữ nguyên |
| **MERGE** | 12 | Consolidate unique features vào canonical, rồi xóa |
| **DEPRECATED** | 2 | Đánh dấu `@deprecated`, KHÔNG xóa (còn callers), migrate ở Phase 2 |
| **DELETE-LATER** | 3 | An toàn xóa sau khi audit + test |
| **UNKNOWN** | 3 | Cần audit sâu hơn trước khi quyết định |

> **Quy tắc:** Không xóa code chỉ vì "có vẻ unused". Phải có test + dependency analysis chứng minh an toàn.
