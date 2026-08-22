# ADR — Creative Economy Layer Mapping

> **Status:** ACCEPTED
> **Date:** 2026-08-22
> **Scope:** SOPHIA 2027 CREATIVE ECONOMY OS — Phase 0 (Step C)
> **Deciders:** SOPHIA 2027 transformation pipeline (orchestrator + docs-manager)

---

## Decision / Quyết định

The transformation spec's `src/domain/creative-economy/` folder maps onto the EXISTING
4-layer architecture as **seed (contracts) + tree (services)**. It does **NOT** become a 5th
layer.

Thư mục `src/domain/creative-economy/` trong spec được ánh xạ vào kiến trúc 4 lớp HIỆN CÓ
dưới dạng **seed (hợp đồng) + tree (dịch vụ)**. Nó KHÔNG trở thành lớp thứ 5.

Concretely / Cụ thể:

| Spec concept / Khái niệm spec | Layer / Lớp | Path / Đường dẫn |
|---|---|---|
| Canonical contracts (types, interfaces, events, errors, ids, Zod schemas) | **seed** | `src/seed/types/creative-economy/` (barrel) + `src/seed/types/creative-domain.ts` (entities) |
| Domain services (per-domain reusable logic) | **tree** | `src/tree/<module>/` |

---

## Context / Bối cảnh

The SOPHIA 2027 spec describes a `src/domain/creative-economy/` directory as the "single
source of truth for domain contracts". The repo already enforces a 4-layer architecture
(seed → tree → forest → land) with ESLint-enforced import boundaries. The question for
Phase 0 was whether to honour the spec's literal folder name by creating a 5th layer, or to
map the spec's intent onto the existing layers.

Spec mô tả thư mục `src/domain/creative-economy/` là "nguồn sự thật duy nhất cho các hợp đồng
miền". Repo đã có kiến trúc 4 lớp (seed → tree → forest → land) với ranh giới import được
ESLint thực thi. Câu hỏi của Phase 0 là tạo lớp thứ 5 theo đúng tên thư mục trong spec, hay
ánh xạ ý định của spec vào các lớp hiện có.

---

## Reasons / Lý do

### 1. The 4-layer rule is authoritative; a 5th layer forces an ESLint rewrite

`apps/sophia-ai-factory/.claude/rules/sophia-layer-architecture.md` is the authoritative
source for code organization in `src/`. It defines exactly four layers and their import
direction. Those boundaries are not just prose — they are enforced by the
`no-restricted-imports` rule in `eslint.config.mjs` (seed cannot import tree/forest/land;
tree cannot import forest/land; land cannot import forest). Introducing a 5th `domain/`
layer would require rewriting that boundary rule for every layer pair that touches it —
churn with zero functional benefit.

Quy tắc 4 lớp trong `sophia-layer-architecture.md` là nguồn có thẩm quyền. Ranh giới này
được thực thi bởi luật `no-restricted-imports` trong `eslint.config.mjs`. Thêm lớp `domain/`
thứ 5 sẽ buộc phải viết lại luật ranh giới đó — thay đổi lớn mà không mang lại lợi ích chức năng.

### 2. The spec's entities are already committed to seed — a 5th layer would duplicate them

The canonical entity model was already committed to `src/seed/types/creative-domain.ts`
(663 lines). Creating `src/domain/` now would re-house or re-declare that same content,
producing the exact duplication the spec's own rules #8 (reuse before creating) and #9 (no
duplicate abstractions) forbid.

Mô hình entity chuẩn đã được commit vào `src/seed/types/creative-domain.ts` (663 dòng). Tạo
`src/domain/` bây giờ sẽ khai báo lại nội dung đó, tạo ra chính sự trùng lặp mà luật #8 và #9
của spec cấm.

### 3. seed = "what never changes" = the contract role

The layer doc defines seed as "What never changes" (types, config, primitives). That is
precisely the role the spec assigns to `src/domain/` — "contracts only, no business logic".
Contracts belong in seed by definition.

Tài liệu kiến trúc định nghĩa seed là "Những gì không bao giờ thay đổi" (types, config,
primitives). Đó chính xác là vai trò spec gán cho `src/domain/` — "chỉ hợp đồng, không logic
nghiệp vụ". Hợp đồng thuộc về seed theo định nghĩa.

### 4. tree = "what our domain owns reusably" = the service role

The layer doc defines tree as "What our domain owns reusably". That is precisely the role of
the spec's per-domain service folders. Domain services belong in tree.

Tài liệu kiến trúc định nghĩa tree là "Những gì miền của chúng ta sở hữu một cách tái sử dụng".
Đó chính xác là vai trò của các thư mục dịch vụ theo miền trong spec. Dịch vụ miền thuộc về tree.

---

## What would REOPEN this decision / Điều gì sẽ MỞ LẠI quyết định này

This decision is locked for Phase 0 and all downstream phases unless one of the following
becomes true. Quyết định này được khóa cho Phase 0 và các phase sau, trừ khi một trong các
điều kiện sau xảy ra:

- **(a)** The layer rule is rewritten — `sophia-layer-architecture.md` is amended to define a
  domain layer AND the `no-restricted-imports` boundary in `eslint.config.mjs` is updated to
  match — AND the spec entities are moved out of `creative-domain.ts` into that new layer.
  Both conditions must hold together; rewriting the rule alone is not enough.

  Luật lớp được viết lại — `sophia-layer-architecture.md` được sửa để định nghĩa lớp domain VÀ
  ranh giới `no-restricted-imports` trong `eslint.config.mjs` được cập nhật tương ứng — VÀ các
  entity trong spec được chuyển ra khỏi `creative-domain.ts` vào lớp mới đó. Cả hai điều kiện
  phải đồng thời đúng.

- **(b)** A genuinely new horizontal concern emerges that neither seed nor tree can host
  without violating the import-direction rules (for example, a concern that must be imported
  BY tree but must NOT import tree, and is not a "never changes" primitive).

  Xuất hiện một mối quan tâm ngang thực sự mới mà cả seed lẫn tree đều không thể chứa mà không
  vi phạm quy tắc hướng import.

---

## Related decision point — Mission state machine (NOT resolved here)

> Ghi chú: đây là ĐIỂM QUYẾT ĐỊNH chưa được giải quyết trong Phase 0; chuyển sang Phase 2.

The spec (task.md Step 8) and the canonical `creative-domain.ts` use DIFFERENT mission status
vocabularies, and their terminal states do NOT overlap. This ADR does **not** assert that the
canonical model "aligns with" the spec. Spec (Step 8) và `creative-domain.ts` dùng hai bộ từ
vựng trạng thái mission KHÁC nhau; các trạng thái kết thúc KHÔNG trùng nhau. ADR này KHÔNG
khẳng định mô hình chuẩn "khớp với" spec.

- Spec: `DRAFT → PLANNING → AWAITING_APPROVAL → EXECUTING → MEASURING → COMPOUNDING → ARCHIVED`
- Canonical (`creative-domain.ts`): `draft → planned → approval_required → running → paused → review → completed → learning → iterating`
- DB (`migrations/0233_missions.sql`) is bound to the canonical names.

**Recommendation carried forward: Option A** — keep canonical names as storage; expose spec
names as additive aliases in a normalization layer. Zero DB change, reversible. Final
ownership of storage vocabulary is deferred to Phase 2. Khuyến nghị chuyển tiếp: Phương án A —
giữ tên chuẩn làm storage; phơi bày tên spec dưới dạng alias bổ sung. Không đổi DB, có thể đảo
ngược. Quyền sở hữu storage chính thức được hoãn sang Phase 2.

---

## References / Tham chiếu

- `apps/sophia-ai-factory/.claude/rules/sophia-layer-architecture.md` — authoritative 4-layer rule
- `apps/sophia-ai-factory/eslint.config.mjs` — `no-restricted-imports` boundary enforcement
- `apps/sophia-ai-factory/src/seed/types/creative-domain.ts` — canonical entities (663 lines)
- `apps/sophia-ai-factory/src/seed/types/creative-economy/` — canonical contracts barrel
- `.orchestrate/latest/plan.md` — Section 1 (decision record) + Step C spec
- `docs/roadmap/SOPHIA_2027_ROADMAP.md` — Phase 0 status
