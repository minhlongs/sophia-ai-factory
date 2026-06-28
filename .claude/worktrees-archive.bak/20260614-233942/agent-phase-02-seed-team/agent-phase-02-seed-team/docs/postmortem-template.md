# Post-Mortem Template — Bilingual / Song Ngữ

> Copy this file to `docs/postmortems/{YYYY-MM-DD}-{short-slug}.md` for each incident.
> Blameless. Focus on systems and processes, not individuals.
> Sao chép sang `docs/postmortems/{YYYY-MM-DD}-{slug}.md` cho mỗi sự cố.
> Không đổ lỗi cá nhân. Tập trung vào hệ thống và quy trình.

---

## Metadata

| Field | Value |
|---|---|
| **Incident ID** | `INC-YYYY-NN` (e.g. `INC-2026-01`) |
| **Title** | _Short, factual — e.g. "Stripe webhook retries spiked, payouts delayed"_ |
| **Date / Ngày** | YYYY-MM-DD |
| **Detected at / Phát hiện** | ISO timestamp UTC |
| **Resolved at / Khắc phục** | ISO timestamp UTC |
| **Duration / Thời gian** | `Xh Ym` |
| **Severity / Mức độ** | `P0` outage / `P1` degraded / `P2` minor |
| **Customer impact / Ảnh hưởng** | _e.g. "12 users could not check out for 38 min"_ |
| **Authors / Người viết** | @handle, @handle |
| **Status / Trạng thái** | `draft` / `under-review` / `published` |

---

## 1. Summary / Tóm Tắt

### English (3-5 sentences)

_What broke, who was affected, how long, and how it was resolved. Avoid jargon; this section will be read by non-engineers._

### Tiếng Việt (3-5 câu)

_Cái gì hỏng, ai bị ảnh hưởng, bao lâu, khắc phục thế nào. Tránh thuật ngữ — phần này dành cho người không phải kỹ thuật._

---

## 2. Timeline / Diễn Biến (UTC)

| Time | Event / Sự kiện |
|---|---|
| `HH:MM` | _Trigger event — what started the incident_ |
| `HH:MM` | _Detection — alert fired / customer reported / etc._ |
| `HH:MM` | _Mitigation begins_ |
| `HH:MM` | _Service restored_ |
| `HH:MM` | _All clear / customer comms sent_ |

---

## 3. Root Cause — 5 Whys / Phân Tích Nguyên Nhân

> Keep asking "why" until you reach a system / process gap, not a person.
> Tiếp tục hỏi "tại sao" cho đến khi chạm tới lỗ hổng hệ thống / quy trình, không phải con người.

| # | Question / Câu hỏi | Answer / Trả lời |
|---|---|---|
| 1 | **Why did the incident happen?** | |
| 2 | **Why did that happen?** | |
| 3 | **Why did THAT happen?** | |
| 4 | **Why?** | |
| 5 | **Why?** _(stop here — this is your real root cause)_ | |

**Root cause statement / Phát biểu nguyên nhân gốc:**

> _One sentence summarising the answer to #5._

---

## 4. What Went Well / Điểm Tốt

- _Detection time / Thời gian phát hiện_
- _Mitigation steps that worked / Bước xử lý hiệu quả_
- _Communication / Giao tiếp_

## 5. What Went Wrong / Điểm Xấu

- _Where did the system fail us?_
- _Where did the process fail us?_

## 6. Where We Got Lucky / Chỗ May Mắn

- _Things that went right by chance — these are future incidents waiting to happen._
- _Những thứ tình cờ ổn — sự cố tương lai đang chờ xảy ra._

---

## 7. Action Items / Hành Động Tiếp Theo

> Each action item must have an **owner** and a **due date**. Track in the issue tracker.
> Mỗi action phải có **người phụ trách** và **hạn**. Theo dõi qua issue tracker.

| # | Action / Hành động | Owner | Due | Type |
|---|---|---|---|---|
| 1 | _e.g. Add HMAC verify to webhook handler_ | @owner | YYYY-MM-DD | Prevent |
| 2 | _e.g. Add Sentry alert for 5xx > 1%_ | @owner | YYYY-MM-DD | Detect |
| 3 | _e.g. Update runbook with rollback steps_ | @owner | YYYY-MM-DD | Mitigate |

**Type legend:** `Prevent` (stop recurrence) / `Detect` (catch faster next time) / `Mitigate` (reduce blast radius).

---

## 8. Customer Comms / Thông Báo Khách Hàng

- [ ] Status page incident posted (`status.sophia.agencyos.network`) at HH:MM
- [ ] Resolution update posted at HH:MM
- [ ] Affected users emailed (if data integrity / billing)
- [ ] Refunds / credits issued where applicable

---

## 9. References / Tham Chiếu

- Sentry issue: _link_
- Logs: _link to dashboard query_
- Slack thread: _link_
- Runbook used: `docs/{runbook}.md`
- Related PRs: _#123, #124_

---

## Author Checklist / Danh Sách Cho Người Viết

- [ ] Blameless tone — no person named as cause
- [ ] Timeline UTC, accurate to nearest minute
- [ ] 5-Whys reaches a system/process root cause (not "human error")
- [ ] Every action item has owner + due date
- [ ] Customer impact quantified (number affected, dollar value if known)
- [ ] Posted to `docs/postmortems/` and indexed in `docs/postmortems/README.md`
- [ ] Reviewed by at least one other engineer (when team > 1)

---

> **Filing tip:** even minor incidents are worth documenting. The muscle of writing post-mortems is more valuable than any single artifact.
> **Lưu ý:** ngay cả sự cố nhỏ cũng đáng viết. Cơ bắp viết post-mortem giá trị hơn bất kỳ tài liệu đơn lẻ nào.
