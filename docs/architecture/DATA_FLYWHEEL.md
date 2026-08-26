# Data Flywheel / Con quay dữ liệu

> The closed-loop data flow: VISION → CREATE → DISTRIBUTE → MEASURE → LEARN → COMPOUND.
> Every memory update must be auditable with source, confidence, timestamp, scope, and evidence.

---

## EN / Tiếng English

### The Flywheel / Con quay

```
VISION → CREATE → DISTRIBUTE → MEASURE → LEARN → COMPOUND
   ↑                                                       │
   └───────────────────────────────────────────────────────┘
```

Each cycle compounds data advantage. The flywheel is not a pipeline — it is a loop that accelerates.

### Stage Descriptions / Mô tả các giai đoạn

| Stage | What happens | Output |
|---|---|---|
| **VISION** | Market research, trend analysis, competitor creative audit | Creative brief, content strategy |
| **CREATE** | Script, visual, audio, video generation | Published asset |
| **DISTRIBUTE** | Channel-specific publishing, scheduling, cross-platform | Live content |
| **MEASURE** | Performance event capture, snapshot computation, revenue tracking | Metrics per asset |
| **LEARN** | Pattern extraction from performance data, creative memory update | Insights, patterns, rules |
| **COMPOUND** | Apply learnings to next vision cycle, improve creative decisions | Better briefs, better assets |

### Learning Update Requirements / Yêu cầu cập nhật Learning

Every learning update MUST have:

| Field | Type | Description |
|---|---|---|
| `source` | string | What event or data triggered this learning (e.g., `asset_123_impression`) |
| `confidence` | number (0–1) | How confident the system is in this pattern |
| `timestamp` | epoch ms | When this learning was recorded |
| `scope` | string | What this learning applies to (e.g., `channel:tiktok`, `format:short_form`) |
| `evidence` | string[] | Supporting data points or asset IDs |

### Creative Memory / Bộ nhớ sáng tạo

Creative memory stores learned patterns about what works. It is NEVER updated silently.

#### Rules / Quy tắc

1. Every memory write must be traceable to a `PerformanceEvent` or `PerformanceSnapshot`.
2. Memory updates are append-only — never mutate existing entries.
3. Each memory entry carries `confidence`, `source`, `evidence` fields.
4. Low-confidence patterns (< 0.3) are stored as `candidate` and not used for decisions.
5. High-confidence patterns (> 0.7) are promoted to `active` and influence future creative decisions.

#### Memory Schema / Schema bộ nhớ

```typescript
interface CreativeMemoryEntry {
  id: string;
  workspaceId: string;
  pattern: string;           // e.g., "hook_question_3s_retention"
  confidence: number;        // 0–1
  source: string;            // e.g., "asset_abc_performance"
  evidence: string[];        // supporting asset IDs
  scope: string;             // e.g., "channel:tiktok,format:short"
  status: 'candidate' | 'active' | 'deprecated';
  createdAt: number;
  updatedAt: number;
}
```

### Avoid Silent Changes / Tránh thay đổi im lặng

**Silent memory updates are forbidden.** If the system updates creative memory:
1. Log the update with full context (source, confidence, scope, evidence).
2. Emit a `PerformanceEvent` with `eventType: 'memory_update'`.
3. Show the update in the user's activity log.
4. Never auto-promote `candidate` to `active` without explicit threshold check.

### Compound Effect / Hiệu ứng ghép đôi

The flywheel compounds when:
- Creative briefs are informed by performance data (VISION uses MEASURE output)
- Creative decisions are guided by confidence-weighted patterns (LEARN → CREATE)
- Distribution strategy adapts to channel-specific learnings (LEARN → DISTRIBUTE)
- ROI tracking feeds back into cost estimation (MEASURE → VISION)

### Market Signal Edge / Cạnh tín hiệu thị trường (Phase 2)

As of Sophia 2027 Phase 2, the VISION stage has its own automated input edge — **external signals → trend intelligence → creative decisions**:

```
EXTERNAL WORLD ──► market_signals ──► trend_detections ──► VISION
 (YouTube trending,        │                   │
  Google Trends RSS)       │ hourly cron       │ detectTrends()
                           ▼                   ▼
                 market-signals-ingest    velocity + z-score +
                 (Inngest, retries=2)     seasonal/audience multipliers
                                          + 7-day SES forecast
```

| Piece | Where | Cadence |
|---|---|---|
| Ingestion | `forest/inngest/functions/market-signals-ingest-cron.ts` → `tree/market-signals/store.ts` | hourly (`0 * * * *`), per-workspace error isolation |
| Detection + forecast | `tree/trend-intelligence/detect.ts` (+ `detect-math`, `forecast`) | on demand; detections persisted with momentum + evidence ids |
| Read exposure | `land/graphs/actions.ts`, `GET /api/graphs/[type]` | auth-gated read-only |

Rules for this edge:
1. Sources are BYOK-only or keyless-public (Google Trends RSS). Operator credentials are forbidden (no-tech doctrine).
2. Signals dedupe on (source, title-hash, day-window) and expire — the signal table is a stream, not an archive.
3. A `TrendDetection` row must carry `evidence_ids` pointing back to the signals/events that produced it — same auditability bar as creative-memory updates.
4. Trend multipliers are reused from `tree/youtube-strategy/trend-scorer.ts` (single source, DRY).

### VN

**Cạnh tín hiệu thị trường (Phase 2):** từ Phase 2, giai đoạn VISION có thêm luồng đầu vào tự động — **tín hiệu bên ngoài → phát hiện xu hướng → quyết định sáng tạo**. Cron mỗi giờ nạp YouTube trending (BYOK) và Google Trends RSS (không cần key) vào bảng `market_signals`; engine phát hiện xu hướng tính velocity + z-score với hệ số mùa vụ/người xem, kèm dự báo 7 ngày, lưu vào `trend_detections`.

Quy tắc:
1. Nguồn dữ liệu chỉ dùng BYOK hoặc public không cần key — nghiêm cấm credential của operator.
2. Tín hiệu được khử trùng lặp theo (nguồn, hash tiêu đề, cửa sổ ngày) và có hạn sử dụng — bảng signal là dòng chảy, không phải kho lưu trữ.
3. Mỗi dòng `TrendDetection` phải mang `evidence_ids` trỏ về các tín hiệu/sự kiện đã sinh ra nó — cùng chuẩn kiểm chứng như creative memory.
4. Hệ số xu hướng tái sử dụng từ `tree/youtube-strategy/trend-scorer.ts` (một nguồn duy nhất).

### Data Flow Diagram / Sơ đồ luồng dữ liệu

```
┌─────────────┐
│    VISION    │ ← Market data, competitor analysis, past performance
└──────┬──────┘
       │ Creative brief
       ▼
┌─────────────┐
│    CREATE    │ ← Scripts, templates, creative memory patterns
└──────┬──────┘
       │ Published asset
       ▼
┌─────────────┐
│ DISTRIBUTE  │ ← Channel strategy, scheduling, cross-platform
└──────┬──────┘
       │ Live content
       ▼
┌─────────────┐
│   MEASURE   │ ← Performance events, snapshots, revenue
└──────┬──────┘
       │ Metrics + patterns
       ▼
┌─────────────┐
│    LEARN    │ ← Pattern extraction, memory update, confidence scoring
└──────┬──────┘
       │ Insights + rules
       ▼
┌─────────────┐
│  COMPOUND   │ ← Apply learnings, improve next cycle
└──────┬──────┘
       │ Improved decisions
       └──────────→ VISION (next cycle)
```

---

## VN / Tiếng Việt

### Con quay dữ liệu

```
VISION → CREATE → DISTRIBUTE → MEASURE → LEARN → COMPOUND
   ↑                                                       │
   └───────────────────────────────────────────────────────┘
```

Mỗi vòng lặp ghép đôi lợi thế dữ liệu. Con quay không phải pipeline — nó là vòng lặp tăng tốc.

### Mô tả các giai đoạn

| Giai đoạn | Mô tả | Output |
|---|---|---|
| **VISION** | Nghiên cứu thị trường, xu hướng, audit creative đối thủ | Creative brief, chiến lược nội dung |
| **CREATE** | Kịch bản, hình ảnh, âm thanh, video | Asset đã xuất bản |
| **DISTRIBUTE** | Đăng theo kênh, lịch, đa nền tảng | Nội dung live |
| **MEASURE** | Thu thập performance event, tính snapshot, theo dõi revenue | Metrics theo asset |
| **LEARN** | Trích xuất mẫu từ dữ liệu hiệu suất, cập nhật creative memory | Insights, patterns, rules |
| **COMPOUND** | Áp dụng learnings vào vision tiếp, cải thiện quyết định | Brief tốt hơn, asset tốt hơn |

### Yêu cầu cập nhật Learning

Mỗi cập nhật learning PHẢI có:

| Field | Loại | Mô tả |
|---|---|---|
| `source` | string | Sự kiện/data nào gây ra learning này |
| `confidence` | number (0–1) | Độ tin cậy của mẫu |
| `timestamp` | epoch ms | Thời điểm ghi nhận |
| `scope` | string | Learning áp dụng cho phạm vi gì |
| `evidence` | string[] | Các điểm dữ liệu hỗ trợ |

### Quy tắc Creative Memory

1. Mỗi lần ghi memory phải truy nguyên được từ `PerformanceEvent` hoặc `PerformanceSnapshot`.
2. Memory cập nhật append-only — không mutate entry hiện tại.
3. Mỗi entry memory mang `confidence`, `source`, `evidence`.
4. Pattern confidence < 0.3 → lưu `candidate`, KHÔNG dùng cho quyết định.
5. Pattern confidence > 0.7 → promote `active`, ảnh hưởng quyết định sáng tạo.

### Tránh thay đổi im lặng

**Cập nhật memory im lặng bị cấm.** Khi hệ thống cập nhật creative memory:
1. Log đầy đủ context (source, confidence, scope, evidence).
2. Phát `PerformanceEvent` với `eventType: 'memory_update'`.
3. Hiển thị trong activity log của người dùng.
4. Không tự promote `candidate` → `active` nếu chưa kiểm tra threshold.

### Hiệu ứng ghép đôi

Con quay ghép đôi khi:
- Creative brief được informs bởi performance data (VISION dùng MEASURE output)
- Quyết định sáng tạo hướng dẫn bởi confidence-weighted patterns (LEARN → CREATE)
- Chiến lược phân phối thích ứng theo channel-specific learnings (LEARN → DISTRIBUTE)
- ROI tracking feed back vào cost estimation (MEASURE → VISION)

### Sơ đồ luồng dữ liệu

```
┌─────────────┐
│    VISION    │ ← Dữ liệu thị trường, phân tích đối thủ, hiệu suất trước
└──────┬──────┘
       │ Creative brief
       ▼
┌─────────────┐
│    CREATE    │ ← Kịch bản, template, patterns từ creative memory
└──────┬──────┘
       │ Asset đã xuất bản
       ▼
┌─────────────┐
│ DISTRIBUTE  │ ← Chiến lược kênh, lịch, đa nền tảng
└──────┬──────┘
       │ Nội dung live
       ▼
┌─────────────┐
│   MEASURE   │ ← Performance events, snapshots, revenue
└──────┬──────┘
       │ Metrics + patterns
       ▼
┌─────────────┐
│    LEARN    │ ← Trích xuất mẫu, cập nhật memory, tính confidence
└──────┬──────┘
       │ Insights + rules
       ▼
┌─────────────┐
│  COMPOUND   │ ← Áp dụng learnings, cải thiện vòng tiếp
└──────┬──────┘
       │ Quyết định tốt hơn
       └──────────→ VISION (vòng tiếp)
```

---