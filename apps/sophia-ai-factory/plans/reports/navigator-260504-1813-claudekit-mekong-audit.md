# Navigator Report — ClaudeKit + Mekong Architecture (2026-05-04 18:13 PT)

> Hoa tiêu: bản đồ kiến trúc 3 lớp (global / mekong / sophia) → đề xuất hướng đi.

## Tóm tắt phát hiện

| Layer | Path | Skills | Commands | Agents | Rules |
|---|---|---:|---:|---:|---:|
| **ClaudeKit Global** | `~/.claude/` | 151 | 18 | 16 | 11 binh-phap + 7 workflow |
| **Mekong-CLI Domain** | `~/mekong-cli/.claude/` | 195 (500 nested) | 402 | 6 domain | 7 |
| **Sophia Project** | `~/projects/sophia-ai-factory/apps/sophia-ai-factory/.claude/` | 0 | 0 | 4 (memory only) | 1 override |

## Bất ngờ #1 — Mekong KHÔNG dùng 4-layer (seed/tree/forest/land)

**Trước đây nghĩ:** Mekong là source của 4-layer naming convention.

**Thực tế (per ARCHITECTURE.md v6.0.0, 2026-05-03):** Mekong dùng **Option B 2-layer**:
- Layer 1 (global) = canonical primitives
- Layer 2 (mekong) = domain extension

→ Sophia-AI-Factory ĐANG dùng 4-layer NHƯNG nguồn gốc thật của naming là... project-internal pattern (không phải mekong).

## Bất ngờ #2 — Sophia inherits 4 rules thay vì binh-phap suite

Sophia inherits từ `~/.claude/rules/`:
- development-rules.md ✅
- documentation-management.md ✅
- orchestration-protocol.md ✅
- primary-workflow.md ✅

**KHÔNG inherit:**
- 5 binh-phap-*.md (core/quality/cicd/workflow/memory-practices)
- openclaw-discipline.md
- manus-layer-{2,4,6}.md
- payment-provider.md (rule "no Polar" — Sophia có quy định riêng nhưng không qua rule này)
- team-coordination-rules.md

Sophia có 1 override: `sophia-deploy-verify.md` (CF-direct doctrine, authoritative).

## Bất ngờ #3 — 14 stock agents đã xóa khỏi mekong (2026-05-03)

Mekong removed 14 duplicate agents (brainstormer, code-reviewer, debugger, docs-manager, fullstack-developer, git-manager, journal-writer, mcp-manager, planner, project-manager, researcher, tester, ui-ux-designer + 1 other) → defer all to global. Net: zero loss + cleaner architecture.

→ Sophia hiện có 4 agents trong `.claude/agent-memory/` (planner, tester, code-reviewer, debugger) — chỉ là memory, không override.

## Sophia code structure (4-layer)

| Layer | Files | Vai trò | Examples |
|---|---:|---|---|
| **seed** | 147 | Foundational — types, config, db client, auth base | `seed/auth/better-auth-session.ts`, `seed/config/tiers/`, `seed/db/client.ts` |
| **tree** | 162 | Domain-specific reusable | `tree/byok/`, `tree/handover/`, `tree/telegram/`, `tree/audit/` |
| **forest** | 362 | Reusable infra orchestrators | `forest/inngest/`, `forest/raas/`, `forest/usage-metering/`, `forest/quota/` |
| **land** | 113 | Business domains | `land/billing/`, `land/payouts/`, `land/affiliates/` |

**Cross-layer reality:** Forest → Land calls EXIST (inngest jobs orchestrating land workflows). Hợp lý nhưng CLAUDE.md không document quy tắc này.

## Drift / Gap khi áp dụng

| Gap | Ảnh hưởng | Effort fix |
|---|---|---:|
| Sophia thiếu 5 binh-phap rules (quality/cicd/workflow/...) | Quality gates không enforce ở project level | S — symlink |
| Forest/Land thiếu barrel re-exports | Import paths verbose, drift dễ xảy ra | M — add index.ts per domain |
| `@/lib/*` vs `@/seed/*` aliases dùng lẫn lộn | Confuse, hard refactor sau | M — alias clarity |
| Cross-layer rule không document | "Khi nào forest→land hợp lệ?" — implicit | S — write rule |
| 4-layer không có rule file giải thích | New devs phải reverse-engineer | S — write doc |
| Mekong overrides 6 skills (3 có why-override) | Không ảnh hưởng Sophia (không import mekong) | N/A |
| 384 mekong-only commands (raas-core-engine, etc.) | Sophia không dùng → OK | N/A |
| ARCHITECTURE.md unified plan stale | Plan 260429 dùng 4-layer nhưng mekong dùng 2-layer | S — refresh plan |

## Đề xuất 4 hướng đi tiếp theo

### Option A — Sync rules từ global xuống Sophia (lightweight, ~30 min)
- Symlink 5 binh-phap-*.md từ `~/.claude/rules/` → `apps/sophia-ai-factory/.claude/rules/`
- Add `manus-layer-2-run-mode.md` cho speed/quality awareness
- Test enforcement (zero `:any`, zero console.log) trên CI nếu có
- **Outcome:** Sophia tuân thủ binh-phap đầy đủ + audit trail

### Option B — Document Sophia 4-layer + cross-layer rules (~1 hour)
- Tạo `apps/sophia-ai-factory/.claude/rules/sophia-layer-architecture.md`
- Định nghĩa seed/tree/forest/land + khi nào cross-layer hợp lệ
- Add barrel re-exports cho top-level domains (land/billing/index.ts, forest/inngest/index.ts, etc.)
- **Outcome:** Convention rõ ràng, dev mới onboard nhanh

### Option C — Refresh unified architecture plan (~1.5 hour)
- Update `~/plans/260429-2040-claudekit-mekong-unified-architecture/` reflect Option B (2-layer) đã hoàn thành 2026-05-03
- Phase 1 (dedup 94 skills) — ALREADY DONE
- Phase 2 (docs sync) — partially done (ARCHITECTURE.md v6.0.0)
- Phase 3 (single source-of-truth bridge doc) — chưa làm
- **Outcome:** Plan stale → up-to-date, có thể đóng

### Option D — Tạo navigator command `/pilot` cho Sophia (~2 hour)
- Bootstrap meta-command theo pattern claudekit cook
- Dispatch /scout /plan /code /test /review theo task complexity
- Sophia-specific awareness: BYOK, NOWPayments, Telegram bot, FREE100
- **Outcome:** Single entry point thay vì nhớ từng command

## Cross-cutting recommendations

1. **`@/lib` vs `@/seed`**: Thống nhất dùng `@/seed` cho foundational, `@/lib` deprecated dần. Hoặc tạo alias `@/lib/* = @/seed/*` để compat.
2. **Barrel exports**: Thêm `index.ts` per domain folder (land/billing, forest/inngest, etc.). Hỗ trợ tooling tốt hơn.
3. **Forest→Land orchestration rule**: Write 1 file `cross-layer-orchestration.md` document "Forest CAN call Land for orchestration. Other cross-layer banned."

## Unresolved questions

1. Sophia có muốn import full mekong-cli skills/commands không? Hay giữ độc lập (như hiện tại) tốt hơn?
2. 4-layer convention origin — ai define? Có phải pattern của user/team chứ không phải claudekit/mekong?
3. `@/lib` vs `@/seed` — chọn 1 làm canonical, deprecate cái kia?
4. `.claude/agent-memory/` các thư mục agent rỗng — placeholder hay dynamic populate?
5. Có nên đóng plan `260429-2040-claudekit-mekong-unified-architecture/` (Option B đã ship)?
