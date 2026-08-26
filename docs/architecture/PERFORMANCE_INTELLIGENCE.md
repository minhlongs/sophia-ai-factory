# Performance Intelligence / Hiệu suất thông minh

> Canonical performance metrics for Sophia AI Factory.
> Metrics are single-source-of-truth: `seed/types/creative-domain.ts`.

---

## EN / Tiếng Anh

### Core Metrics / Metrics cốt lõi

| Metric | Field | Meaning |
|---|---|---|
| Impressions | `PerformanceSnapshot.impressions` | Number of times creative was shown |
| Reach | `views` | Number of unique viewers |
| CTR | `clicks / views` | Click-through rate |
| Watch time | `watchTimeSeconds` | Total seconds watched |
| Retention 3s | `retention3s` | Fraction retained after 3s |
| Retention 30s | `retention30s` | Fraction retained after 30s |
| Completion rate | derived | Full-playback ratio |
| Likes | `likes` | Positive reactions |
| Comments | `comments` | Engagement comments |
| Shares | `shares` | Viral distribution actions |
| Saves | `saves` | Long-term value signals |
| Follower conversion | `followerDelta` | Net new followers |
| Lead conversion | `leadDelta` | Net new leads |
| Conversion rate | derived | `leads / views` |
| Revenue | `revenueCents` | Gross revenue (cents) |
| Cost | `costCents` | Production + distribution cost |
| Profit | `revenueCents - costCents` | Net profit |
| Creative ROI | `creativeRoi` | `profit / cost` |

### CreativeEconomicValue

```
CreativeEconomicValue = economic_output / creative_cost
```

A creative asset's economic value is the ratio of economic output it generates to the cost of producing and distributing it. Values > 1 are profitable; values < 1 are net-negative and should trigger a creative memory update.

### Source Types

- `PerformanceEvent` — raw event stream (impression, view, click, like, share, save, follow, conversion, revenue). One row per event with `count` and optional `valueCents`.
- `PerformanceSnapshot` — daily aggregate per asset per channel. All canonical metrics live here.
- `RevenueEvent` — money events (`sale`, `affiliate`, `ad`, `subscription`, `lead`, `licensing`) with `amountCents` and `currency`.

### Rules / Quy tắc

1. Snapshots are computed from events, never hand-written.
2. `creativeRoi` is computed, never stored as input.
3. Revenue events must carry `assetId` or `projectId` for attribution.
4. All monetary fields are in cents; never store decimals.

---

## VN / Tiếng Việt

### Metrics cốt lõi

| Metrics | Trường | Ý nghĩa |
|---|---|---|
| Impressions | `impressions` | Lần sáng tạo được hiển thị |
| Reach | `views` | Số người xem duy nhất |
| CTR | `clicks / views` | Tỷ lệ nhấp |
| Watch time | `watchTimeSeconds` | Tổng thời gian xem (giây) |
| Retention 3s | `retention3s` | Tỷ lệ giữ chân sau 3s |
| Retention 30s | `retention30s` | Tỷ lệ giữ chân sau 30s |
| Completion rate | suy ra | Tỷ lệ phát full |
| Likes | `likes` | Liking tích cực |
| Comments | `comments` | Bình luận |
| Shares | `shares` | Hành vi viral |
| Saves | `saves` | Tín hiệu giá trị lâu dài |
| Follower conversion | `followerDelta` | Follower mới ròng |
| Lead conversion | `leadDelta` | Lead mới ròng |
| Conversion rate | suy ra | `leads / views` |
| Revenue | `revenueCents` | Doanh thu gross (cent) |
| Cost | `costCents` | Chi phí sản xuất + phân phối |
| Profit | `revenueCents - costCents` | Lợi nhuận ròng |
| Creative ROI | `creativeRoi` | `profit / cost``

### CreativeEconomicValue

```
CreativeEconomicValue = economic_output / creative_cost
```

Tỷ lệ lợi ích kinh tế so với chi phí tạo ra. Giá trị > 1 là có lợi; < 1 là thua lỗ và phải cập nhật creative memory.

### Nguồn dữ liệu

- `PerformanceEvent` — luồng sự kiện raw.
- `PerformanceSnapshot` — tổng hợp hàng ngày theo asset + channel.
- `RevenueEvent` — sự kiện tiền (`sale`, `affiliate`, `ad`, `subscription`, `lead`, `licensing`).

### Quy tắc

1. Snapshot được tính từ event, không được viết tay.
2. `creativeRoi` được tính, không được nhập tay.
3. Revenue event phải có `assetId` hoặc `projectId`.
4. Tiền tệ luôn ở cent, không dùng số thập phân.

---

## Predictive Performance Model / Mô hình hiệu suất dự đoán (Phase 2)

### EN

**Module:** `src/tree/performance/scoring.ts` — deterministic heuristic scorer (no ML, no training infra).

**What it predicts:** which content assets will land in the top quartile of performance, scored from three explainable factors:

| Factor | Weight (default) | Signal |
|---|---|---|
| Engagement rate | highest weight in `DEFAULT_CONFIG` | engagements / max(views, impressions) |
| Velocity | — | view acceleration over observation window |
| Retention | — | retention metrics from `performance_events.metrics_json` |

- Output shape: `{ predictedQuartile, confidence ('low'|'medium'|'high'), factors[] }` — every factor carries `rawValue`, `normalizedValue`, `weight`, `contribution`, `description`, so any score is fully explainable.
- All thresholds/weights live in `DEFAULT_CONFIG` (no magic numbers). Scores are computed **on read** — no new table, no request-path ML.
- DB helpers: `scoreWorkspaceAssets(workspaceId)` and `scoreAsset(assetId)` aggregate `performance_events` per asset/channel/time-window.

**Backtest CLI:** `scripts/backtest-performance-model.ts`

```bash
cd apps/sophia-ai-factory
npx tsx scripts/backtest-performance-model.ts --workspace <id> --db <sqlite-path> \
  --window-days 14 --horizon-days 14 --min-events 5
```

Replays historical `performance_events`: scores each asset at T0, compares against actual top-quartile membership at T0+14d, prints precision by confidence band.

> ⚠️ **Honest status:** the only backtest executed so far is a **synthetic fixture run (100% precision on deterministic test data)**. This validates the harness mechanics only — it is NOT evidence the model meets the >70% top-quartile KPI. Production replay on real D1 data is pending; until then the model ships as low-confidence heuristics. If a production backtest lands below 70%, record the gap and keep the `confidence: low` flag rather than tuning to the data.
>
> Note: the script intentionally embeds its own copy of the scorer for standalone CLI independence — keep the two in sync when changing weights (tracked follow-up).

### VN

**Module:** `src/tree/performance/scoring.ts` — bộ chấm điểm heuristic tất định (không ML, không hạ tầng huấn luyện).

**Dự đoán cái gì:** asset nội dung nào sẽ rơi vào nhóm 25% hiệu suất tốt nhất, dựa trên 3 yếu tố giải thích được:

| Yếu tố | Tín hiệu |
|---|---|
| Engagement rate | tương tác / max(views, impressions) |
| Velocity | gia tốc lượt xem trong cửa sổ quan sát |
| Retention | chỉ số giữ chân từ `performance_events.metrics_json` |

- Kết quả: `{ predictedQuartile, confidence ('low'|'medium'|'high'), factors[] }` — mỗi yếu tố đều có giá trị thô, trọng số, đóng góp và mô tả → mọi điểm số đều giải thích được.
- Toàn bộ ngưỡng/trọng số nằm trong `DEFAULT_CONFIG`. Điểm được tính khi đọc — không thêm bảng mới, không ML trên request path.

**Chạy backtest:** xem lệnh ở phần EN phía trên. Script phát lại lịch sử event: chấm điểm tại T0, so với nhóm top-quartile thật tại T0+14 ngày, in độ chính xác theo từng mức confidence.

> ⚠️ **Trạng thái trung thực:** mới chỉ chạy backtest trên **bộ dữ liệu giả lập (100% chính xác trên dữ liệu cố định)** — chỉ chứng minh cơ chế hoạt động, CHƯA chứng minh đạt KPI >70%. Cần replay dữ liệu production trước; trước đó mô hình luôn gắn cờ `confidence: low`.

---

*Source: `seed/types/creative-domain.ts` lines 312–367 · scoring: `tree/performance/scoring.ts`.*