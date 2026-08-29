# DESIGN PARTNER PLAYBOOK — 3 Archetype Mission Template Bundles
# Sổ Tay Đối Tác Thiết Kế — 3 Gói Mẫu Nhiệm Vụ Theo Chân Dung Khách Hàng

> **Status:** Phase D — shipped as pure DATA (metadata route). Zero engine change.
> **Trạng thái:** Giai đoạn D — bàn giao dưới dạng DỮ LIỆU (metadata). Không thay đổi engine.
> **Source code:** `apps/sophia-ai-factory/src/tree/production-graph/design-partner-bundles.ts`
> **Metrics vocabulary:** `docs/reality-loop/SOPHIA_VALUE_SCORECARD.md` (every metric below is a subset — nothing invented)

---

## 1. What This Is / Đây Là Gì

**EN:** Sophia serves three kinds of business owners. Instead of a blank mission form, each one picks a ready-made bundle: objective, constraints, success metrics, autonomy level, and approval policy — all pre-set. The CEO only fills in the topic.

**VI:** Sophia phục vụ ba kiểu chủ doanh nghiệp. Thay vì form nhiệm vụ trống, mỗi khách chọn một gói mẫu có sẵn: mục tiêu, ràng buộc, chỉ số thành công, mức tự chủ, và chính sách phê duyệt — tất cả được cài sẵn. CEO chỉ cần nhập chủ đề.

✅ **No new buttons, no new menus, no new tech.** The bundles ride the existing mission-creation form (`constraints`, `successMetrics`, `autonomyLevel`) and the existing approval gate (`publish_content`).

✅ **Không có nút mới, không menu mới, không kỹ thuật mới.** Các gói mẫu chạy trên form tạo nhiệm vụ hiện có (`constraints`, `successMetrics`, `autonomyLevel`) và cổng phê duyệt hiện có (`publish_content`).

---

## 2. The Three Archetypes / Ba Chân Dung Khách Hàng

| # | Archetype | Goal / Mục tiêu | Bundle slug |
|---|-----------|-----------------|-------------|
| 1 | **FOUNDER** / **Nhà sáng lập** | Personal media engine / Cỗ máy truyền thông cá nhân | `founder-media-engine` |
| 2 | **AGENCY** / **Agency đa khách** | Multi-client creative operations / Vận hành sáng tác đa khách hàng | `agency-creative-ops` |
| 3 | **CREATOR** / **Nhà sáng tạo nội dung** | Audience growth + monetization / Tăng trưởng khán giả + kiếm tiền | `creator-audience-engine` |

---

## 3. Bundle 1 — FOUNDER Media Engine / Gói 1 — Cỗ Máy Truyền Thông Cá Nhân

**Mục tiêu / Objective:** Run a consistent personal content engine without hiring a team — Sophia produces, you approve each publish. / Duy trì cỗ máy nội dung cá nhân đều đặn mà không cần thuê đội ngũ — Sophia sản xuất, bạn phê duyệt trước khi đăng.

| Field / Trường | Value / Giá trị |
|---|---|
| **Constraints / Ràng buộc** | `toneOfVoice: personal-founder` · `language: vi-en` · `maxBudgetCentsPerMission: 500` ($5) · `contentVolumePerWeek: 3` |
| **Autonomy level / Mức tự chủ** | `2` — agent writes & plans, human approves publish / agent viết & lên kế hoạch, người phê duyệt khi đăng |
| **Approval policy / Phê duyệt** | `publish_content` tool, `requiresApproval: true` — existing gate, no new types |
| **Template graph / Luồng mẫu** | `creative-mission-full` (13-stage pipeline: scout → … → learning) |

**Success metrics / Chỉ số thành công** (subset of scorecard / tập con của scorecard):

| Metric | Target / Mục tiêu | Meaning / Ý nghĩa |
|---|---|---|
| `machine_vs_manual_ratio` | > 5:1 | Machine does 5x the work / Máy làm gấp 5 lần người |
| `median_human_time_per_approval` | < 120s | Approve in under 2 minutes / Phê duyệt dưới 2 phút |
| `completion_rate` | > 0.7 | 7/10 missions finish / 7/10 nhiệm vụ hoàn tất |
| `correction_rate` | < 0.10 | Memory learns, rarely corrected / Bộ nhớ học đúng, ít bị sửa |

---

## 4. Bundle 2 — AGENCY Creative Operations / Gói 2 — Vận Hành Sáng Tác Đa Khách Hàng

**Mục tiêu / Objective:** Serve multiple clients with one creative pipeline — keep client-facing quality gates and cost under control. / Phục vụ nhiều khách hàng với một dây chuyền sáng tác — giữ chất lượng trước khách và kiểm soát chi phí.

| Field / Trường | Value / Giá trị |
|---|---|
| **Constraints / Ràng buộc** | `clientFacingQualityGate: true` · `language: vi-en` · `maxBudgetCentsPerMission: 500` ($5) · `reviewRoundsMax: 2` |
| **Autonomy level / Mức tự chủ** | `2` — drafts flow through agents, human holds the client-facing gate / bản thảo chạy qua agent, người giữ cổng chất lượng trước khách |
| **Approval policy / Phê duyệt** | `publish_content` tool, `requiresApproval: true` — existing gate |
| **Template graph / Luồng mẫu** | `creative-mission-full` |

**Success metrics / Chỉ số thành công:**

| Metric | Target / Mục tiêu | Meaning / Ý nghĩa |
|---|---|---|
| `acceptance_rate` | > 0.6 | 60% of drafts accepted as-is / 60% bản thảo được nhận nguyên bản |
| `intervention_ratio` | < 2.0 | Fewer than 2 human gates per mission / Dưới 2 lần can thiệp mỗi nhiệm vụ |
| `agent_action_success_rate` | > 0.85 | Agents rarely fail / Agent ít khi lỗi |
| `cost_per_completed_mission` | < 500 cents ($5) | Cost ceiling per delivery / Trần chi phí mỗi đơn hàng |

---

## 5. Bundle 3 — CREATOR Audience Engine / Gói 3 — Cỗ Máy Tăng Trưởng Khán Giả

**Mục tiêu / Objective:** Grow audience by repurposing every asset into derivative content — maximize reach per idea, faster iteration. / Tăng khán giả bằng cách tái chế mỗi tài sản thành nội dung phái sinh — tối đa tiếp cận mỗi ý tưởng, lặp nhanh hơn.

| Field / Trường | Value / Giá trị |
|---|---|
| **Constraints / Ràng buộc** | `toneOfVoice: authentic-creator` · `language: vi-en` · `maxBudgetCentsPerMission: 500` ($5) · `derivativeFormatsPerAsset: 2` |
| **Autonomy level / Mức tự chủ** | `3` — higher autonomy: agents iterate derivatives; human still approves each publish / tự chủ cao hơn: agent lặp nội dung phái sinh; người vẫn phê duyệt từng lần đăng |
| **Approval policy / Phê duyệt** | `publish_content` tool, `requiresApproval: true` — same existing gate |
| **Template graph / Luồng mẫu** | `repurpose-derivative` (3-node pipeline: summarize → thread → newsletter & publish) |

**Success metrics / Chỉ số thành công:**

| Metric | Target / Mục tiêu | Meaning / Ý nghĩa |
|---|---|---|
| `machine_vs_manual_ratio` | > 5:1 | Repurposing is leveraged / Tái chế được đòn bẩy hóa |
| `acceptance_rate` | > 0.6 | Derivatives fit the creator voice / Phái sinh đúng chất giọng |
| `completion_rate` | > 0.7 | Derivative missions finish / Nhiệm vụ phái sinh hoàn tất |
| `estimated_roi` | > 1.0 | Revenue exceeds cost where data exists / Doanh thu vượt chi phí (chỉ tính nơi có dữ liệu) |

---

## 6. How The CEO Uses It / Cách CEO Sử Dụng

**VI — 4 bước:**
1. ✅ Vào Dashboard → Tạo Nhiệm Vụ (Create Mission)
2. 📋 Chọn 1 trong 3 gói mẫu theo chân dung (FOUNDER / AGENCY / CREATOR)
3. ⚙️ Nhập chủ đề + sản phẩm (duy nhất phần CEO cần điền)
4. ✅ Sophia chạy; CEO nhận thông báo phê duyệt trên Telegram — bấm Duyệt là đăng

**EN — 4 steps:**
1. ✅ Open Dashboard → Create Mission
2. 📋 Pick 1 of 3 bundles matching your profile (FOUNDER / AGENCY / CREATOR)
3. ⚙️ Enter your topic + product (the only input a CEO fills)
4. ✅ Sophia runs; CEO gets the approval ping on Telegram — tap Approve to publish

---

## 7. Why Data-Only / Tại Sao Chỉ Là Dữ Liệu

**EN:** The three bundles are constants in `design-partner-bundles.ts` — no engine, runner, or approval-type changes. They flatten into the existing mission-create fields. Each bundle is validated by `validateDesignPartnerBundle()` against: (a) the existing `validateGraphDefinition` for its referenced graph, (b) the scorecard metric vocabulary, (c) the 0-4 autonomy enum, (d) the `publish_content` approval gate.

**VI:** Ba gói mẫu là hằng số trong `design-partner-bundles.ts` — không đụng engine, runner, hay loại phê duyệt mới. Chúng "phẳng hóa" vào các trường tạo nhiệm vụ hiện có. Mỗi gói được kiểm tra bởi `validateDesignPartnerBundle()` đối chiếu: (a) validator đồ thị hiện có `validateGraphDefinition`, (b) bảng chỉ số scorecard, (c) thang tự chủ 0-4, (d) cổng phê duyệt `publish_content` hiện có.

⚙️ **Protected flows untouched:** Setup Wizard, Telegram Bot, Payment Flow — zero diff.
⚙️ **Không đụng luồng được bảo vệ:** Setup Wizard, Telegram Bot, Payment Flow — zero diff.

---

## 8. Verification / Kiểm Chứng

- Test suite: `src/tree/production-graph/__tests__/design-partner-bundles.test.ts` — validates all 3 bundles against the existing template validator + scorecard vocabulary + autonomy enum + approval gate.
- Metrics traceability: every metric name appears verbatim in `SOPHIA_VALUE_SCORECARD.md` — zero invented metrics.
- Missing data renders `—` per scorecard doctrine (e.g. `estimated_roi` only where both revenue AND cost exist).

---

PHASE D WRITTEN: /Users/macbook/sophia-ai-factory/docs/reality-loop/DESIGN_PARTNER_PLAYBOOK.md
