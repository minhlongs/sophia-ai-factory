# Hermes Integration V1 / Tích hợp Hermes V1

> **Status:** V1 — Mock-ready adapter (NOT production-integrated)
> **Status:** V1 — Adapter sẵn sàng mock (CHƯA tích hợp production)
> **Last updated:** 2026-08-31
> **Last updated:** 2026-08-31

---

## Overview (English)

The Hermes integration is a **thin, read-only provider bridge** that connects Sophia AI Factory to Hermes Antigravity — a local image generation server.

**What this integration does:**
- Provides a provider adapter (`HermesAntigravityAdapter`) that implements Sophia's `Provider` interface
- Registers Hermes in Sophia's provider infrastructure so it can be selected like any other AI provider
- Works without real Hermes credentials in V1 (mock-ready) — fails gracefully when Hermes is unreachable
- Uses BYOK (Bring Your Own Key): users provide their own Hermes API key via the Setup Wizard

**What this integration does NOT do yet:**
- Does NOT call the real Hermes API in production (V1 is adapter-only)
- Does NOT support image editing (`image.edit` not implemented)
- Does NOT share any database between Sophia and Hermes

---

## Tổng quan (Tiếng Việt)

Tích hợp Hermes là **một cầu nối nhỏ, chỉ đọc** kết nối Sophia AI Factory với Hermes Antigravity — một máy chủ tạo ảnh chạy cục bộ (trên máy tính của bạn).

**Tích hợp này làm được gì:**
- Cung cấp một bộ chuyển đổi (`HermesAntigravityAdapter`) hoạt động giống như các nhà cung cấp AI khác trong Sophia
- Đăng ký Hermes vào hệ thống của Sophia để có thể chọn Hermes như bất kỳ nhà cung cấp nào khác
- Hoạt động không cần mật khẩu Hermes thật ở V1 — nếu Hermes không kết nối được, hệ thống sẽ dừng nhẹ nhàng (không báo lỗi đỏ)
- Dùng hệ thống BYOK (Mang theo khóa của bạn): người dùng tự nhập khóa API Hermes qua Setup Wizard

**Tích hợp này CHƯA làm được:**
- CHƯA gọi đến Hermes thật trong production (V1 chỉ là bộ chuyển đổi)
- CHƯA hỗ trợ chỉnh sửa ảnh (image.edit chưa có)
- CHƯA chia sẻ bất kỳ cơ sở dữ liệu nào giữa Sophia và Hermes

---

## Architecture / Kiến trúc

### English

Sophia and Hermes are **separate systems** with clear roles:

| System | Role | Location |
|--------|------|----------|
| **Sophia AI Factory** | Control Plane — manages mission lifecycle, events, billing, state | Cloud (Cloudflare Workers) |
| **Hermes Antigravity** | Execution Plane — generates images locally | Local machine (`127.0.0.1:8100`) |

**How they connect:**
1. `HermesAntigravityAdapter` implements the `Provider` interface (same as OpenRouter, Anthropic, etc.)
2. Registered in `ProviderFactory` via the `'hermes'` case in the create switch
3. Added to `ByokProvider` list so users can provide their own Hermes API key
4. Circuit breaker (`@/seed/security/circuit-breaker`) protects against cascading failures
5. Error classification (`@/seed/types/failure-kind`) determines retry behavior

**Cost:** $0 per request — Hermes runs locally, no API charges.

**Key design principles:**
- Sophia NEVER stores Hermes credentials — keys live in Sophia's encrypted BYOK store
- Hermes stays local — Sophia cannot reach `127.0.0.1:8100` from Cloudflare (this is intentional for V1)
- No shared database — Sophia uses D1, Hermes uses its own local storage
- No shared OAuth — Sophia uses Better Auth, Hermes uses separate PKCE flow

---

### Tiếng Việt

Sophia và Hermes là **hai hệ thống riêng biệt** với vai trò rõ ràng:

| Hệ thống | Vai trò | Vị trí |
|----------|---------|--------|
| **Sophia AI Factory** | Bộ điều khiển — quản lý vòng đời nhiệm vụ, sự kiện, thanh toán, trạng thái | Đám mây (Cloudflare) |
| **Hermes Antigravity** | Bộ thực thi — tạo ảnh cục bộ | Máy tính cá nhân (`127.0.0.1:8100`) |

**Chúng kết nối như thế nào:**
1. `HermesAntigravityAdapter` hoạt động giống như các nhà cung cấp AI khác (OpenRouter, Anthropic...)
2. Được đăng ký trong hệ thống qua mã `'hermes'`
3. Người dùng có thể tự nhập khóa API Hermes qua Setup Wizard
4. Hệ thống tự động bảo vệ khi Hermes gặp sự cố (không làm chệch toàn bộ hệ thống)
5. Hệ thống tự động phân loại lỗi để quyết định có nên thử lại hay không

**Chi phí:** $0 mỗi lần tạo — Hermes chạy trên máy tính của bạn, không tính phí API.

**Nguyên tắc thiết kế quan trọng:**
- Sophia KHÔNG bao giờ lưu mật khẩu Hermes — khóa được lưu mã hóa trong kho BYOK của Sophia
- Hermes ở trên máy tính cá nhân — Sophia không thể kết nối trực tiếp đến `127.0.0.1:8100` từ Cloudflare (đây là thiết kế có chủ đích cho V1)
- Không chia sẻ cơ sở dữ liệu — Sophia dùng D1, Hermes dùng bộ nhớ cục bộ riêng
- Không chia sẻ đăng nhập — Sophia dùng Better Auth, Hermes dùng hệ thống riêng

---

## Prerequisites / Yêu cầu tiên quyết

### English

Before using Hermes integration:

- **CRITICAL:** Hermes OAuth secret (`DEFAULT_CLIENT_SECRET` in `bridge/auth.py`) MUST be rotated before any production use. This secret was hardcoded in a public GitHub repo — it is a security exposure.
- Hermes Antigravity must be running locally at `http://127.0.0.1:8100`
- User must provide their own Hermes API key via Sophia's Setup Wizard (BYOK)
- Hermes must expose an OpenAI-compatible `/v1/images/generations` endpoint

---

### Tiếng Việt

Trước khi sử dụng tích hợp Hermes:

- **QUAN TRỌNG:** Mật khẩu OAuth của Hermes (`DEFAULT_CLIENT_SECRET` trong file `bridge/auth.py`) PHẢI được thay đổi trước khi dùng production. Mật khẩu này đã bị ghi công khai trên GitHub — đây là lỗ hổng bảo mật.
- Hermes Antigravity phải đang chạy trên máy tính tại `http://127.0.0.1:8100`
- Người dùng phải tự cung cấp khóa API Hermes qua Setup Wizard của Sophia (BYOK)
- Hermes phải có sẵn đường dẫn `/v1/images/generations` (tương thích với chuẩn OpenAI)

---

## Adapter Contract / Hợp đồng adapter

### English

The `HermesAntigravityAdapter` implements the following contract:

| Property | Value |
|----------|-------|
| **Provider ID** | `hermes` |
| **Base URL** | `http://127.0.0.1:8100` |
| **Auth** | Bearer token (BYOK) |
| **Endpoint** | `POST /v1/images/generations` |
| **Timeout** | 120 seconds (default) |

**Input parameters:**
- `prompt` (required) — text description of the image
- `negativePrompt` — what to exclude from the image
- `aspectRatio` — one of: `1:1`, `16:9`, `9:16`, `4:3`, `3:4` (default: `1:1`)
- `steps` — generation steps (default: 30)
- `cfgScale` — prompt adherence (default: 7)
- `seed` — for deterministic generation (optional)

**Output format:**
- `data:image/png;base64,...` — base64-encoded image data URI
- Usage tokens (prompt_tokens, completion_tokens)
- Latency in milliseconds

**Error codes:**
| Code | Meaning |
|------|---------|
| `HERMES_MISSING_API_KEY` | No API key provided |
| `HERMES_EMPTY_PROMPT` | Prompt is empty |
| `HERMES_EMPTY_RESPONSE` | Hermes returned no image data |
| `Circuit breaker open` | Too many failures — requests paused |
| `HTTP 401` | Invalid API key (retryable: NO) |
| `HTTP 429` | Rate limited (retryable: YES) |
| `HTTP 500` | Server error (retryable: YES) |

---

### Tiếng Việt

`HermesAntigravityAdapter` hoạt động theo hợp đồng sau:

| Thuộc tính | Giá trị |
|------------|---------|
| **Mã nhà cung cấp** | `hermes` |
| **Đường dẫn cơ sở** | `http://127.0.0.1:8100` |
| **Xác thực** | Mã Bearer (BYOK) |
| **Đường dẫn** | `POST /v1/images/generations` |
| **Thời gian chờ** | 120 giây (mặc định) |

**Các tham số đầu vào:**
- `prompt` (bắt buộc) — mô tả ảnh bằng chữ
- `negativePrompt` — điều gì KHÔNG nên có trong ảnh
- `aspectRatio` — tỷ lệ ảnh: `1:1`, `16:9`, `9:16`, `4:3`, `3:4` (mặc định: `1:1`)
- `steps` — số bước tạo ảnh (mặc định: 30)
- `cfgScale` — mức độ bám sát mô tả (mặc định: 7)
- `seed` — để tạo ảnh giống hệt nhau (tùy chọn)

**Định dạng đầu ra:**
- `data:image/png;base64,...` — ảnh mã hóa base64
- Số token đã dùng (đầu vào, đầu ra)
- Thời gian phản hồi (mili-giây)

**Các mã lỗi:**
| Mã | Ý nghĩa |
|----|---------|
| `HERMES_MISSING_API_KEY` | Chưa cung cấp khóa API |
| `HERMES_EMPTY_PROMPT` | Mô tả ảnh trống |
| `HERMES_EMPTY_RESPONSE` | Hermes không trả về dữ liệu ảnh |
| `Circuit breaker open` | Quá nhiều lỗi — yêu cầu bị tạm dừng |
| `HTTP 401` | Khóa API không hợp lệ (KHÔNG thử lại) |
| `HTTP 429` | Bị giới hạn tốc độ (CÓ THỂ thử lại) |
| `HTTP 500` | Lỗi máy chủ (CÓ THỂ thử lại) |

---

## BYOK Key Configuration / Cấu hình khóa BYOK

### Tiếng Việt (Vietnamese — for non-technical CEO)

Để thêm khóa API Hermes vào Sophia, làm theo các bước sau:

1. 🔑 **Lấy khóa API Hermes của bạn**
   - Mở Hermes Antigravity trên máy tính
   - Vào phần Settings / Cài đặt
   - Sao chép API Key (khóa bí mật dùng để kết nối)

2. ⚙️ **Vào Setup Wizard của Sophia**
   - Đăng nhập vào Sophia AI Factory
   - Vào Setup Wizard (Trình hướng dẫn cài đặt)
   - Chọn tab "Hermes"

3. 📝 **Nhập khóa API Hermes của bạn**
   - Dán API Key vào ô trống
   - Khóa sẽ được mã hóa và lưu an toàn trong hệ thống

4. ✅ **Lưu và kiểm tra**
   - Nhấn "Lưu" / "Save"
   - Nhấn "Kiểm tra" / "Test" để xác nhận kết nối thành công
   - Nếu thành công, bạn sẽ thấy một bức ảnh thử nghiệm

---

## Testing / Kiểm tra

### English

The Hermes adapter has **13 unit tests** covering the full contract surface:

| Test | What it verifies |
|------|-----------------|
| Construction with/without API key | Adapter never throws at construction time |
| Defaults (`baseUrl`, `id`, `label`) | Correct local defaults applied |
| Happy path | Returns base64 data URI with correct metadata |
| Missing API key | Throws `HERMES_MISSING_API_KEY` |
| HTTP 401 | Throws with `retryable=false` |
| HTTP 429 | Throws with `retryable=true` |
| HTTP 500 | Throws with `retryable=true` |
| Network error | Propagates original error, records failure |
| Circuit breaker open | Blocks request before network call |
| `estimateCost()` | Returns 0 (local = free) |
| `getCapabilities()` | Returns static capability profile |
| `countTokens()` | Positive for non-empty prompt, 0 for empty |
| `stream()` | Wraps `chat()` in single chunk |

**All tests run without a real Hermes instance** — the `fetch` function is mocked. This means tests are deterministic and can run in CI without Hermes installed.

**Test results:** 13/13 passing

---

## Known Limitations / Hạn chế đã biết

### English

The following limitations apply to V1:

1. **Local-only** — Hermes runs at `127.0.0.1:8100`. This address is NOT reachable from Cloudflare Workers (Sophia's hosting). A secure tunnel or reverse proxy would be needed for production integration.
2. **No `image.edit` capability** — V1 supports `image.generate` only. Image editing (img2img, inpaint) is not implemented.
3. **No shared database** — Sophia uses Cloudflare D1; Hermes uses its own local storage. They do NOT share data.
4. **No production Hermes API calls** — V1 is an adapter only. No real Hermes API calls are made in production yet.
5. **Hermes NOT integrated in production** — V1 is a mock-ready adapter. Real integration requires: OAuth secret rotation, secure tunnel, and health monitoring.

---

### Tiếng Việt

Các hạn chế sau áp dụng cho V1:

1. **Chỉ chạy cục bộ** — Hermes chạy tại `127.0.0.1:8100`. Địa chỉ này KHÔNG thể kết nối từ Cloudflare (nơi Sophia đang chạy). Cần thêm đường hầm bảo mật hoặc proxy để tích hợp production.
2. **Không có tính năng chỉnh sửa ảnh** — V1 chỉ hỗ trợ tạo ảnh mới. Chỉnh sửa ảnh (thêm/bớt đồ vật, sửa ảnh có sẵn) chưa được cài đặt.
3. **Không chia sẻ cơ sở dữ liệu** — Sophia dùng D1 của Cloudflare; Hermes dùng bộ nhớ riêng. Hai hệ thống KHÔNG chia sẻ dữ liệu.
4. **Chưa gọi Hermes thật trong production** — V1 chỉ là bộ chuyển đổi. Chưa có cuộc gọi Hermes thật nào được thực hiện trong production.
5. **Hermes CHƯA được tích hợp production** — V1 là bộ chuyển đổi sẵn sàng mock. Tích hợp thật cần: thay đổi mật khẩu OAuth, đường hầm bảo mật, và hệ thống theo dõi sức khỏe.

---

## Next Phase / Phase tiếp theo

### English

The following items are planned for the next phase:

- **Hermes OAuth secret rotation** — CRITICAL: `DEFAULT_CLIENT_SECRET` must be rotated before any production use
- **Real Hermes API integration** — Replace mock with actual API calls when Hermes is reachable
- **Image editing support** — Add `image.edit` capability (img2img, inpaint)
- **Hermes provider health monitoring** — Dashboard showing Hermes status, latency, error rate
- **Secure tunnel setup** — Enable Sophia (cloud) to reach Hermes (local) safely
- **Production smoke tests** — End-to-end tests with real Hermes instance

---

### Tiếng Việt

Các mục sau được lên kế hoạch cho phase tiếp theo:

- **Thay đổi mật khẩu OAuth Hermes** — QUAN TRỌNG: `DEFAULT_CLIENT_SECRET` phải được thay đổi trước khi dùng production
- **Tích hợp API Hermes thật** — Thay mock bằng cuộc gọi API thật khi Hermes có thể kết nối
- **Hỗ trợ chỉnh sửa ảnh** — Thêm tính năng `image.edit` (chỉnh sửa ảnh có sẵn)
- **Hệ thống theo dõi sức khỏe Hermes** — Bảng điều khiển hiển thị trạng thái Hermes, độ trỉ, tỷ lệ lỗi
- **Thiết lập đường hầm bảo mật** — Cho phép Sophia (đám mây) kết nối đến Hermes (cục bộ) một cách an toàn
- **Kiểm tra smoke thật** — Kiểm tra đầu-cuoi với Hermes thật

---

## References / Tài liệu tham khảo

| Document | Description |
|----------|-------------|
| [`docs/CEO_HANDOVER_AUDIT.md`](./CEO_HANDOVER_AUDIT.md) Section 11 | Integration boundary + security findings (CRITICAL OAuth secret exposure) |
| [`docs/CREATIVE_CELL_V1.md`](./CREATIVE_CELL_V1.md) | Phase 1 Creative Cell (control plane architecture) |
| `CLAUDE.md` | Project rules, canonical import paths, protected flows |
| `src/seed/ai/providers/hermes-antigravity-adapter.ts` | Adapter source code |
| `src/forest/ai/provider-factory.ts` | Provider registration (case 'hermes') |
| `src/seed/ai/provider-interface.ts` | Provider contract interface |

---

## Source Files / Tài liệu nguồn

```
src/seed/ai/providers/hermes-antigravity-adapter.ts        — Hermes adapter implementation
src/seed/ai/providers/__tests__/hermes-antigravity-adapter.test.ts — 13 unit tests
src/forest/ai/provider-factory.ts                          — Provider factory (hermes case)
src/seed/ai/provider-interface.ts                          — Provider interface (ProviderId includes 'hermes')
src/seed/ai/cost-estimator.ts                              — Cost estimation (hermes = $0)
src/forest/ai/cost-aware-router.ts                         — Cost-aware routing (hermes entry)
src/tree/byok/user-api-key-store.ts                        — BYOK store (hermes supported)
```

---

> **Disclaimer:** V1 is an adapter only. Hermes is NOT called in production.
> **Lưu ý:** V1 chỉ là bộ chuyển đổi. Hermes CHƯA được gọi trong production.
