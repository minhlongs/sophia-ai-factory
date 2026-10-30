# Postback Tenant Migration Guide / Hướng dẫn chuyển đổi Postback theo Workspace

> Canonical reference for the tenant-scoped affiliate postback migration.
> Tài liệu chuẩn cho việc chuyển đổi postback affiliate theo workspace.

## EN

### What changed

Affiliate conversion postbacks are now attributed to exactly one workspace:

- The signing secret is read from the workspace's stored network credential
  (BYOK integrations), never from a global env secret.
- The request must carry a tracking sub-id (`link_id` / `sub_id` / provider
  equivalent) that resolves to a workspace link, or an explicit `tenant_id`
  hint that is bound to that workspace's credential by the signature check.
- Unknown tenants, unknown links, and missing credentials fail closed with an
  actionable error. No conversion is ever recorded under a global tenant.
- Storage/config failures return `503` (retry). Permanent garbage
  (unparseable body, missing transaction id) keeps a `200 + skipped` ack so
  providers do not retry-storm.

### Canonical endpoint

`POST /api/postback/{network}` with the provider signature and a workspace
sub-id. Supported slugs and verification:

| Slug | Signature | Ledger |
|---|---|---|
| `partnerstack` | `pstack-signature` (base64 or hex HMAC-SHA256) | Domain B workspace ledger |
| `rewardful` | `x-rewardful-signature` / `x-signature` | Domain B workspace ledger |
| `binance`, `binance-link` | `x-signature` (hex HMAC-SHA256) | Domain B workspace ledger |
| `bybit` | `x-signature` (hex HMAC-SHA256) | Domain B workspace ledger |
| `bitget`, `okx` | `x-signature` (hex HMAC-SHA256) | tracking conversions (idempotent receipt) |
| `awin` | `?signature=` query HMAC-SHA256 | tracking conversions (idempotent receipt) |
| `clickbank` | body `cbreceipt` HMAC-SHA256 | tracking conversions (idempotent receipt) |
| `tiktok_shop` | `x-tiktok-signature` HMAC-SHA256 | tracking conversions (idempotent receipt) |

`impact`, `cj`, `generic` are allow-listed but have no verifier yet: they return
`501 network_not_supported` with guidance instead of a misleading 401.

### Legacy compat URLs (kept, no sunset set)

Legacy URLs keep working when the workspace stores the network credential and
the postback carries an attributable sub-id. Global env secrets are NOT read.

| Legacy URL | Networks | Notes |
|---|---|---|
| `/api/webhooks/saas-crypto/{network}` | partnerstack, rewardful, binance, bybit | Same headers; delegates to Domain B service |
| `/api/webhooks/affiliate/{network}` | tiktok_shop, amazon(_associates), accesstrade, awin | Same headers/algorithm; `clickbank` → 501, use `/api/webhooks/clickbank` |
| `/api/webhooks/{accesstrade,amazon,awin,tiktok-shop}` | singletons | Same contract; shared tenant-scoped core |
| `/api/webhooks/clickbank` | ClickBank INS | Same SHA1 header flow; requires attributed click + stored credential |

### Setup per workspace

1. Store the network credential: `POST /api/v1/integrations/affiliate-networks`
   `{ network, payload: { api_secret, ... } }` (authenticated).
2. Create tracking links/subs in the workspace and configure the provider to
   send the sub-id (`sub_id`, `click_ref`, `tag`, `cvendthru`, … per provider).
3. Point the provider at the canonical URL (preferred) or keep the legacy URL.

### Error reference

| Code | HTTP | Meaning | Fix |
|---|---|---|---|
| `tenant_unresolvable` | 422 | No workspace link or tenant hint | Add a workspace sub-id or `tenant_id` |
| `link_unattributed` | 422 | Tenant verified but no link matched | Create the link/sub in the workspace first |
| `secret_not_configured` | 503 | Workspace has no credential for the network | Store it via the integrations API |
| `db_unavailable` / `db_write_failed` | 503 | Transient storage failure | Retry; provider backoff applies |
| `network_not_supported` / `network_moved` | 501 | No verifier on this path | Follow `guidance`/`canonical` in the response |
| `INVALID_SIGNATURE` / `Invalid signature` | 401 | HMAC mismatch or missing header | Check secret + header + raw body bytes |
| `skipped: parse_error` | 200 | Body is not JSON | Fix provider payload; nothing recorded |
| `skipped: duplicate` | 200 | Replay of a stored receipt | No action; no double ledger row |

### Provider notes / unknowns

- Amazon `tag` is a shared Associates ID: per-click attribution needs a
  composite tag suffix stored as `sub_id`; ambiguous shared tags fail closed.
- Awin/ClickBank/TikTok signature transports differ between providers and
  legacy endpoints; each endpoint preserves its historical contract. Providers
  observed on legacy URLs that do not match any documented contract are
  recorded as UNKNOWN — report them instead of widening verification.
- No sunset date is set for legacy URLs. Removal, if ever, follows a
  founder-approved deprecation notice.

## VI

### Thay đổi gì

Postback hoa hồng affiliate giờ gắn với đúng một workspace:

- Secret ký lấy từ credential của workspace (BYOK), không đọc env secret global.
- Request phải có sub-id tracking (`link_id` / `sub_id` / tương đương) trỏ tới
  link của workspace, hoặc `tenant_id` đi kèm và được ràng buộc bằng chữ ký.
- Tenant/link/credential không xác định → fail closed kèm hướng dẫn, không bao
  giờ ghi ledger dưới tenant global.
- Lỗi lưu trữ/cấu hình trả `503` (retry). Body rác vĩnh viễn (không phải JSON,
  thiếu mã giao dịch) vẫn ack `200 + skipped` để provider không retry-storm.

### Endpoint chuẩn

`POST /api/postback/{network}` kèm chữ ký provider và sub-id của workspace.
Bảng slug và cách verify xem phần EN ở trên.

### URL legacy tương thích (giữ nguyên, chưa đặt sunset)

URL legacy vẫn chạy khi workspace đã lưu credential và postback có sub-id.
Env secret global KHÔNG còn được đọc. Chi tiết từng URL xem bảng EN ở trên.

### Cài đặt cho mỗi workspace

1. Lưu credential: `POST /api/v1/integrations/affiliate-networks`
   `{ network, payload: { api_secret, ... } }` (đã đăng nhập).
2. Tạo tracking link/sub trong workspace và cấu hình provider gửi sub-id.
3. Trỏ provider sang URL chuẩn (khuyến nghị) hoặc giữ URL legacy.

### Bảng lỗi và cách xử lý: xem bảng EN ở trên.

### Lưu ý provider / UNKNOWN

- `tag` Amazon dùng chung cho cả tài khoản: muốn attribution từng click phải
  dùng hậu tố tag dạng composite (ví dụ `${TAG}-${linkIdShort}`) lưu làm
  `sub_id`; tag chung gây mơ hồ sẽ fail closed.
- Cách truyền chữ ký của Awin/ClickBank/TikTok khác nhau giữa các endpoint;
  mỗi endpoint giữ nguyên contract cũ. Provider nào dùng URL legacy mà không
  khớp contract đã ghi → ghi UNKNOWN, báo lại thay vì tự nới verify.
- Chưa đặt ngày sunset cho URL legacy.
