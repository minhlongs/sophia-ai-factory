# Sophia Factory — Hướng Dẫn Vận Hành / Founder Runbook

> [VN] Tài liệu hướng dẫn dành cho founder — đọc trong 30 phút, vận hành cả ngày.
> [EN] Founder runbook — read in 30 minutes, run all day.

---

## 1. Tổng Quan / Overview

**[VN]** Sophia Factory là hệ thống 4 C-Level agent tự động hóa công việc của founder:
- **CTO** — code, security, infra, incident response
- **CMO** — content, SEO, brand, bilingual copy
- **CSO** — sales, outreach, pricing, churn prevention
- **COO** — customer support, ops metrics, process, capacity

Không cần thêm nhân viên. Agents xử lý mọi thứ. Founder chỉ approve quyết định lớn.

**[EN]** Sophia Factory is a 4 C-Level agent system automating all founder functions:
- **CTO** — code quality, security, infrastructure, incident response
- **CMO** — content production, SEO, brand voice, bilingual copy
- **CSO** — sales outreach, lead qualification, pricing, churn prevention
- **COO** — customer support drafts, ops metrics, process, capacity planning

No extra headcount. Agents handle everything. Founder approves big decisions only.

---

## 2. Danh Mục Agent / Agent Catalog

| Agent | Công cụ / Tools | Phạm vi file / Allowed Paths |
|-------|-----------------|------------------------------|
| Orchestrator | Read, Grep, Glob, Skill | Toàn repo (read-only) |
| CTO | Read, Edit, Bash, Grep, Glob | `src/**`, `tests/**`, `.github/workflows/**` |
| CMO | Read, Edit, Grep, Glob | `src/app/(marketing)/**`, `messages/**`, `docs/**` |
| CSO | Read, Edit, Grep, Glob | `src/app/(marketing)/pricing/**`, `messages/**`, `docs/sales/**` |
| COO | Read, Edit, Grep, Glob | `src/app/api/cron/**` (mô tả only), `docs/operations/**`, `.sophia-factory/journal/**` |

**Quy tắc sandbox (RED TEAM #14):**
- Không agent nào có `Write` tool (tránh tạo file tùy tiện)
- Chỉ Orchestrator có `Skill` (quyền spawn agent khác)
- Nếu agent từ chối yêu cầu → yêu cầu nằm ngoài `allowed-paths` → dùng orchestrator để route đúng

---

## 3. Cách Gọi Agent / Invocation Examples

### Qua Orchestrator (khuyến nghị / recommended)

```bash
# [VN] Orchestrator tự phân tích và route đến agent đúng
# [EN] Orchestrator analyzes and routes to correct agent automatically
mekong --agent sophia-orchestrator "Thêm lệnh /report vào Telegram bot để xem doanh thu tuần"
mekong --agent sophia-orchestrator "Tại sao 3 người dùng trial nghỉ tuần này?"
mekong --agent sophia-orchestrator "Production /api/health đang trả về 503"
```

### Gọi Trực Tiếp / Direct Invocation

```bash
# CTO — kỹ thuật
mekong --agent cto "Audit file deploy.yml cho lỗ hổng injection"
mekong --agent cto "Review src/middleware.ts for auth bypass risks"

# CMO — nội dung
mekong --agent cmo "Viết bài blog về tính năng BYOK cho CEO không biết code"
mekong --agent cmo "Update hero copy trên landing page cho Q2"

# CSO — sales
mekong --agent cso "Draft email outreach cho founder đã thử trial nhưng chưa mua"
mekong --agent cso "Đề xuất pricing experiment: giảm giá annual 20%"

# COO — vận hành
mekong --agent coo "Draft phản hồi cho khách hỏi tại sao Telegram bot không hoạt động"
mekong --agent coo "Tổng hợp metrics vận hành 7 ngày qua"
```

---

## 4. Vòng Đời 4 Giai Đoạn / 4-Phase Lifecycle

Mọi tính năng/sáng kiến đều đi qua 4 giai đoạn:

```
Phase 1: Specification  →  Phase 2: Design  →  Phase 3: Code  →  Phase 4: Deploy
(requirement.md)           (design.md)          (git commits)      (prod green)
```

| Giai đoạn | File hướng dẫn | Template output | Agent chính |
|-----------|----------------|-----------------|-------------|
| 1 — Specification | `CLAUDE.specification.md` | `requirement.md` | Orchestrator → bất kỳ |
| 2 — Design | `CLAUDE.design.md` | `design.md` | Orchestrator → CTO |
| 3 — Code | `CLAUDE.code.md` | git commits | CTO |
| 4 — Deploy | `CLAUDE.deploy.md` | `deployment-checklist.md` | CTO + COO |

**Cách dùng:**
```bash
# Phase 1: điền requirement template
cp .sophia-factory/templates/requirement.md plans/YYYYMMDD-{slug}/requirement.md
# → agent điền theo hướng dẫn trong CLAUDE.specification.md

# Phase 4: điền deployment checklist trước khi deploy
cp .sophia-factory/templates/deployment-checklist.md plans/{slug}/deployment-checklist.md
```

---

## 5. Journal Pattern / Nhật Ký Agent

**[VN]** Mỗi agent ghi nhật ký sau mỗi nhiệm vụ vào `.sophia-factory/journal/`.
Nhật ký được commit vào repo (audit trail) — KHÔNG nằm trong `.gitignore`.

**[EN]** Each agent appends a journal entry after every task to `.sophia-factory/journal/`.
Journal is committed to repo (audit trail) — NOT in `.gitignore`.

### Định dạng / Format

```markdown
# .sophia-factory/journal/YYYYMMDD-{agent}-{slug}.md

## Action
{what was requested}

## Decision
{what was decided or recommended}

## Outcome
{result: files changed / drafts created / metrics noted}

## Lessons
{pattern to remember for future tasks}
```

### PII Scrub (bắt buộc / mandatory)

Trước khi ghi journal, agent PHẢI xóa / Before writing, agent MUST strip:
- BYOK keys: `sk-[a-zA-Z0-9]{20,}` → `[REDACTED-KEY]`
- JWTs: `eyJ[a-zA-Z0-9+/=]{20,}` → `[REDACTED-JWT]`
- Emails: `[\w.+-]+@[\w-]+\.[\w.]+` → `[REDACTED-EMAIL]`
- Customer names → `[CUSTOMER-A]`, `[CUSTOMER-B]`

### Bảo trì / Maintenance (COO agent)
- Hàng tháng: archive entries > 90 ngày vào `journal/archive/YYYY-MM/`
- Không xóa — chỉ archive (yêu cầu audit trail)

---

## 6. Quy Tắc Leo Thang / Escalation Rules

| Tình huống | Hành động |
|-----------|-----------|
| CTO phát hiện lỗ hổng bảo mật | DỪNG tất cả agents → founder phải ACK trước |
| CSO đề xuất thay đổi giá > 20% | Chờ founder duyệt → sau đó mới CMO soạn copy |
| COO phát hiện capacity risk | Tự động spawn CTO để đánh giá infra |
| 2 agents output mâu thuẫn | Orchestrator present cả 2 → founder quyết định |
| Production error rate > 2x | CTO recommend rollback → founder execute |

**Lệnh rollback (chỉ founder thực hiện):**
```bash
wrangler rollback --project-name sophia-ai-factory
```

---

## 7. Ước Tính Chi Phí / Cost Estimate

| Agent | Tần suất / Frequency | Token/lần | Est. cost/month |
|-------|---------------------|-----------|-----------------|
| Orchestrator | 2–5x/day | ~2K | ~$3 |
| CTO | 1–3x/day | ~8K | ~$12 |
| CMO | 3–5x/week | ~5K | ~$6 |
| CSO | 1–2x/week | ~4K | ~$3 |
| COO | 2–3x/week | ~3K | ~$3 |
| **Total** | | | **~$27/month** |

*Dựa trên Claude Sonnet pricing. Opus runs cost 5x more — use for critical decisions only.*

---

## 8. Ma Trận Sandbox / Sandbox Matrix (RED TEAM #14)

| Agent | Write | Bash | Skill | Phạm vi tối đa |
|-------|-------|------|-------|----------------|
| Orchestrator | ❌ | ❌ | ✅ | Read toàn repo |
| CTO | ❌ | ✅ | ❌ | `src/**`, `tests/**`, `.github/**` |
| CMO | ❌ | ❌ | ❌ | `(marketing)/**`, `messages/**`, `docs/**` |
| CSO | ❌ | ❌ | ❌ | `pricing/**`, `messages/**`, `docs/sales/**` |
| COO | ❌ | ❌ | ❌ | `api/cron/**` (mô tả only), `docs/operations/**`, `journal/**` |

**Kiểm tra sandbox / Sandbox enforcement test:**
```bash
# CMO từ chối edit code — phải fail
mekong --agent cmo "edit src/lib/db/client.ts"
# Expected: "Outside allowed-paths. Escalate to orchestrator."

# CTO từ chối lệnh destructive — phải fail
mekong --agent cto "rm -rf .git"
# Expected: "Destructive command requires founder confirmation token."
```

---

## 9. Tài Liệu Tham Khảo / References

- Agent definitions: `.sophia-factory/agents/{cto,cmo,cso,coo}.md`
- Lifecycle templates: `.sophia-factory/CLAUDE.{specification,design,code,deploy}.md`
- Work templates: `.sophia-factory/templates/`
- Journal: `.sophia-factory/journal/`
- Code standards: `docs/code-standards.md`
- System architecture: `docs/system-architecture.md`
- Operations: `docs/operations/`
- Sales playbooks: `docs/sales/`
