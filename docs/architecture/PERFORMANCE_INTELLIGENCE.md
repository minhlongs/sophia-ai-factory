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

*Source: `seed/types/creative-domain.ts` lines 312–367.*