---
description: ⚡ Bilingual NL Ask Router & 4-Advisor Architectural Consultation (Định tuyến ý định tự nhiên & Tư vấn kiến trúc)
argument-hint: [question-or-goal]
---

## Context
Natural language request, technical question, or architecture challenge: 
<questions>$ARGUMENTS</questions>

Current development workflows, system constraints, scale requirements, and business context will be considered:
- Primary workflow: `./.claude/rules/primary-workflow.md`
- Development rules: `./.claude/rules/development-rules.md`
- Orchestration protocols: `./.claude/rules/orchestration-protocol.md`
- Documentation management: `./.claude/rules/documentation-management.md`
- Repository Constitution: `./AGENTS.md` & `./apps/sophia-ai-factory/CLAUDE.md`

**Project Documentation:**
```
./docs
├── project-overview-pdr.md
├── code-standards.md
├── codebase-summary.md
├── design-guidelines.md
├── deployment-guide.md
├── system-architecture.md
└── project-roadmap.md
```

## Two-Mode Execution Model / Mô Hình Thực Thi 2 Chế Độ

The `/ask` command operates via a unified 2-mode execution model:
1. **Mode A — Bilingual Keyword Routing (Định tuyến ý định tự nhiên)**:
   Evaluates the input query against the 10 canonical intent categories using Vietnamese-first matching priority and `fnmatch` wildcard semantics (`*keyword`, `keyword*`, `*keyword*`, `exact`).
   - If a recognized intent is matched, dispatch or redirect directly to the target command (`/cook`, `/fix`, `/test`, `/plan`, `/brainstorm`, `deploy`, `/docs`, `analytics-report`, `/security-scan`, `/audit-compliance`) with a clear bilingual (VI + EN) routing notification.
   - If an unknown or unauthorized slash command is explicitly invoked (e.g., `/unknown-cmd`), reject with an explicit bilingual error.
2. **Mode B — 4-Advisor Architecture Consultation Fallback (Tư vấn kiến trúc chuyên sâu)**:
   If the query does not match any operational command keywords, fall back seamlessly to expert architectural consultation powered by the 4 Senior Systems Architects:
   - 🏛️ **Systems Designer** – Evaluates system boundaries, 4-layer import hierarchy (`seed` → `tree` → `forest` → `land`), interfaces, and component interactions.
   - 🚀 **Technology Strategist** – Evaluates technology stacks, Cloudflare Workers Edge runtime, D1 SQLite, R2 storage, and architectural patterns.
   - 📈 **Scalability Consultant** – Assesses non-functional requirements, throughput, atomic quota operations, OCC concurrency, and write lock contention.
   - 🛡️ **Risk Analyst** – Evaluates timing attack resilience, webhook replay protection, BYOK master key rotation, data isolation, and disaster recovery.

## 10 Canonical Intent Categories / 10 Danh Mục Ý Định Chuẩn

| Intent Goal | Vietnamese Keywords (Priority 1) | English Keywords (Priority 2) | Target Command |
|---|---|---|---|
| Build / Code / Lập trình | code, lập trình, viết code, xây dựng, triển khai code | code, build, implement, develop, write code | `/cook` |
| Debug / Sửa lỗi | sửa lỗi, sửa bug, lỗi, hỏng, không chạy | fix, debug, bug, broken, error, issue | `/fix` |
| Test / Kiểm thử | viết test, viết unit test, chạy test, kiểm thử | test, unit test, integration test, write test | `/test` |
| Plan / Lập kế hoạch | lập kế hoạch, lên kế hoạch, tạo kế hoạch, tạo bài | plan, create plan, build plan, roadmap | `/plan` |
| Brainstorm / Gợi ý | brainstorm, động não, gợi ý ý tưởng, ý tưởng | brainstorm, idea, ideate, brain dump | `/brainstorm` |
| Deploy / Triển khai | triển khai, đưa lên production, push | deploy, release, ship, push to prod | `deploy` |
| Docs / Tài liệu | tạo tài liệu, viết tài liệu, hướng dẫn | docs, document, doc, readme, guide | `/docs` |
| Analytics / Phân tích | phân tích dữ liệu, phân tích data, báo cáo | analyze data, analytics, data analysis | `analytics-report` |
| Security scan | quét bảo mật, kiểm tra bảo mật, lỗ hổng | security scan, security audit, security review | `/security-scan` |
| Audit / Kiểm toán | kiểm toán, audit, tuân thủ | audit, compliance, SOC2, internal audit | `/audit-compliance` |

## Process
1. **Intent Evaluation**: Run query through `/ask` natural language router (`routeAsk()`).
2. **Action Dispatch or Consultation**:
   - If routed: Output bilingual target banner and invoke target command.
   - If consulting: Convene the 4 Advisors, synthesize architecture guidance, validate against YAGNI, KISS, and DRY principles.
3. **Bilingual Presentation**: All output must be presented in bilingual format (Tiếng Việt + English).