# Quyết Định OpenClaw Integration — Theo Kiến Trúc Mekong

**Date:** 2026-05-03 20:22
**Framework:** Mekong v6.0.0 + Binh Pháp Architecture (Ngũ Sự + Decision Matrix + Architecture-First)
**Question:** Sophia tích hợp OpenClaw thật như thế nào? (Options A/B/C/D từ research-260503-1934)

---

## ⚔️ Ngũ Sự Analysis (5 Pillars Compatibility)

| Pillar | Sophia Hiện Tại | OpenClaw Thật | Compatible? |
|---|---|---|---|
| **Đạo** (Domain) | Video factory cho affiliate marketing (multi-tenant SaaS) | Personal AI assistant cho messaging channels | ❌ XUNG ĐỘT |
| **Thiên** (Scale) | Production SaaS, edge-deployed (Cloudflare Workers) | Single-user local daemon (launchd/systemd) | ❌ XUNG ĐỘT |
| **Địa** (Tech Stack) | Next.js 16 + D1 + Better Auth + NOWPayments | TypeScript Node 24 daemon + multi-channel adapters | ❌ INCOMPATIBLE |
| **Tướng** (Architecture) | SaaS Clean Architecture, multi-tenant | Personal gateway pattern, single-user | ❌ INCOMPATIBLE |
| **Pháp** (Structure) | OpenNext build → wrangler deploy | npm global install + persistent daemon | ❌ KHÔNG COEXIST |

**Verdict:** OpenClaw thật vi phạm **5/5 Ngũ Sự** với Sophia. Option B/C đều vi phạm Đạo (domain mismatch) và Thiên (scale mismatch).

---

## 📋 Mekong Decision Matrix

| Loại Dự Án | Architecture |
|---|---|
| Sophia = **SaaS Product** | Clean Architecture (đang dùng) ✅ |
| Migration OpenClaw = **Enterprise Core cross-system** | Hexagonal + DDD (cần re-architect toàn bộ) |

→ Option B/C đẩy Sophia vào ô "Enterprise Core cross-system" mà KHÔNG có Hexagonal+DDD chuẩn bị → bao gồm anti-pattern "code rỗng ruột" theo Mekong.

---

## 🚫 Anti-Patterns Triggered (Mekong)

| Anti-Pattern | Option C Vi Phạm? |
|---|---|
| ❌ "Viết Business Logic trong UI Components" | Tương đương = throw away NOWPayments billing, tier gating, BetterAuth (rebuild from scratch) |
| ❌ "Gọi Database trực tiếp từ Controller" | Tương đương = bypass D1 schema để fit OpenClaw model |
| ❌ "Sử dụng `any` bừa bãi" | Tương đương = TypeScript model rebuild without DDD entities |
| ❌ "Không có DTO" | Tương đương = no migration plan from Sophia → OpenClaw schemas |

**Option C trigger 4/4 anti-patterns** trong cùng 1 quyết định.

---

## ⚙️ Mandatory Steps (Architecture-First Workflow)

Per `mekong/workflows/architecture-first.md`:

1. **Stop:** Không viết code ngay ✅ (đang stop để decide)
2. **Ask:** Xác định độ phức tạp domain → Sophia = SaaS Clean Arch validated, không cần re-architect
3. **Select:** Chọn Repo mẫu → KHÔNG có "rebuild SaaS as personal assistant" template hợp lệ
4. **Scaffold:** Cấu trúc thư mục → KHÔNG thể coexist (Workers vs daemon)
5. **Implement:** Chỉ sau 4 bước trên → Option C không qua được bước 3

**Option C FAIL ngay tại bước 3.**

---

## 🏯 Core Wisdom Application

> **"Bất chiến nhi khuất nhân chi binh, thiện chi thiện giả dã"**
> Không đánh mà thắng mới là hay nhất

**Áp dụng:**
- Sophia vừa deploy GREEN với 276 fixes (commit d84f3a6e). Đang chiến thắng — không cần đánh.
- Option C = chủ động khai chiến với chính production của mình → vi phạm core wisdom
- Option A = "không đánh" — giữ Sophia, chỉ borrow ý tưởng → đúng chiến lược

---

## ✅ DECISION (Theo Kiến Trúc Mekong)

### **Option A** — RENAME + BORROW PATTERNS

**Lý do được chọn (Binh Pháp + Mekong):**

1. **Tuân thủ Ngũ Sự** — Sophia giữ nguyên Đạo/Thiên/Địa/Tướng/Pháp. Không tự phá vỡ kiến trúc đang validated.
2. **Tuân thủ Decision Matrix** — Sophia ở ô "SaaS Product / Clean Architecture" → giữ nguyên là tối ưu.
3. **Né được 4/4 Anti-Patterns** — không rebuild, không phá business logic, không bypass DTO.
4. **Qua Architecture-First Workflow** — Stop ✅ Ask ✅ Select ✅ (no migration needed) Scaffold ✅ Implement ✅.
5. **Bất chiến nhi khuất nhân chi binh** — không khai chiến với production hiện tại.

### Implementation Plan (Option A)

| # | Action | Effort | Sub-task |
|---|---|---|---|
| 1 | Rename `apps/sophia-ai-factory/openclaw/` → `apps/sophia-ai-factory/heartbeat/` (hoặc `autonomous-skills/`) | 30 phút | Update imports, cron refs, README |
| 2 | Update README để clarify "inspired by OpenClaw, not affiliated" | 15 phút | Tránh confusion future |
| 3 | Implement `npm run sophia:doctor` — env check + D1 binding + R2 binding + migrations status | 2-4h | Borrow concept từ `openclaw doctor --fix` |
| 4 | Apply default-deny path policy cho file-transfer endpoints (nếu có) | 2h | Borrow từ OpenClaw 2026.5.3 file-transfer plugin |
| 5 | Add DM pairing pattern cho @Sophia_Bbot (Telegram) | 4h | Borrow từ OpenClaw security defaults |

**Total effort:** ~1-2 ngày.
**Blast radius:** LOW (rename + new utility script + 1 security improvement).
**Rollback:** Easy (git revert).

### Defer / Reject

- **Option B** (Telegram bot replacement): Defer cho đến khi có VPS budget + multi-channel roadmap rõ ràng. Không reject vĩnh viễn.
- **Option C** (Full rebuild): **REJECT theo Mekong framework** — vi phạm 5/5 Ngũ Sự + 4/4 Anti-Patterns + FAIL Architecture-First workflow.
- **Option D** (Custom mix): Đã được include trong Option A (cherry-pick patterns).

---

## Pre-Execution Checks Required

Trước khi cook Option A:

- [ ] User confirm reject Option C (vi phạm Mekong framework rõ ràng)
- [ ] User chọn rename target: `heartbeat/` (theo current HEARTBEAT.md theme) hay `autonomous-skills/` (theo function)
- [ ] Check có file/script nào ngoài Sophia repo reference path `apps/sophia-ai-factory/openclaw/` không (CI/CD, docs, Telegram webhook URL, etc.)
- [ ] Confirm GitHub Actions block không cản trở Option A (rename = file ops, không cần CI để verify)

## Unresolved Questions

1. Tại sao folder ban đầu được đặt tên "openclaw" — có ý định tích hợp thật từ trước không?
2. `apps/sophia-ai-factory/openclaw/skills/` có được consume bởi runtime nào không, hay chỉ là docs?
3. `HEARTBEAT.md` có đang được monitor tool nào đọc không (Sentry, custom cron)?
4. Trong `.agent/rules/openclaw-tom-hum.md` có config "Anh (Admin) → Antigravity Proxy" — proxy này còn hoạt động không?
