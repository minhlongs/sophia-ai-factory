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
- Storage/config failures return `503` (retry). On the legacy ecommerce
  endpoints, permanent garbage (unparseable body, missing transaction id) is
  captured to the dead-letter queue and then acked `200 + skipped` so providers
  do not retry-storm.

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

| Legacy URL | Networks | Notes (each row verified against its route source) |
|---|---|---|
| `/api/webhooks/saas-crypto/{network}` | partnerstack, rewardful, binance, bybit | Its own per-network header set, which is not the canonical one: `x-partnerstack-signature`; `x-rewardful-signature` then `x-signature` as fallback; `x-signature` then `authorization` as fallback for binance and bybit, with a leading `Bearer ` stripped. This route declares no algorithm — verification is delegated to the Domain B service. |
| `/api/webhooks/affiliate/{network}` | tiktok_shop, amazon(_associates), accesstrade, awin | Its own per-network header set, HMAC-SHA256 on every network, each with a trailing `x-signature` fallback: `x-tts-signature` + `x-signature`; `x-amazon-signature` + `x-amz-signature` + `x-signature`; `x-accesstrade-signature` + `x-signature`; `x-awin-signature` + `x-signature`. `clickbank` is refused on this URL with `501 network_moved` — use `/api/webhooks/clickbank`. |
| `/api/webhooks/{accesstrade,amazon,awin,tiktok-shop}` | singletons | One header each, HMAC-SHA256: `x-accesstrade-signature`, `x-amazon-signature`, `x-awin-signature`, `x-tts-signature`. Narrower than the affiliate URL above for the same networks, and it returns the handler's body verbatim instead of the affiliate URL's conversion envelope. |
| `/api/webhooks/clickbank` | ClickBank INS | Same SHA1 header flow; requires attributed click + stored credential |

### Setup per workspace

1. Store the network credential: `POST /api/v1/integrations/affiliate-networks`
   `{ network, payload: { api_secret, ... } }` (authenticated).
2. Create tracking links/subs in the workspace and configure the provider to
   send the sub-id (`sub_id`, `click_ref`, `tag`, `cvendthru`, … per provider).
3. Point the provider at the canonical URL (preferred) or keep the legacy URL.

### Dead-Letter Queue (DLQ) for unprocessable postbacks

On the legacy endpoints
(`/api/webhooks/saas-crypto/[network]`, `/api/webhooks/affiliate/[network]`,
`/api/webhooks/{accesstrade,amazon,awin,tiktok-shop}`), a request is captured
into the `postback_dead_letter` table (migration `0489`) when:

- the body is not JSON, or carries no transaction id — legacy ecommerce handler
  only; captured first, then acked `200 + skipped`;
- no tenant, no credential, or no trackable link could be resolved — the first
  two on both routes, the link case on the legacy ecommerce handler only.

Never captured, on any route: signature failures (`401`), storage failures
(`503 db_unavailable` / `db_write_failed`), and the pre-parse `400` that
`/api/webhooks/saas-crypto/[network]` returns for a non-JSON body — the caller
is expected to fix and resend those. On that route a post-signature service
error also returns `422/503` without a queue row.

What capture guarantees:

- **Payload retained:** the request body, a bounded header set, the source IP and
  the failure reason are written to the table, whether the request was acked
  `200 + skipped` or failed closed with `422` / `503 secret_not_configured`.
  Nothing reads this table yet — no admin screen, API or scheduled job calls the
  queue helpers — so inspecting an entry today means querying D1 directly.
- **Headers are captured by allowlist, not in full.** Only `user-agent`,
  `content-type`, `content-length`, `cf-ray`, `cf-ipcountry` and `cdn-loop` are
  stored. Every other header — `cookie`, `set-cookie`, `proxy-authorization`,
  `x-forwarded-for`, any provider API key — is dropped rather than masked. The
  one exception is `authorization`: on the binance and bybit routes it is the
  declared signature header, so its key is kept and its value stored as the
  `sigfp:` fingerprint below, never raw. The serializer fails closed: if reading
  headers throws, the field is stored as `{}`.
  See `src/land/postback/postback-dlq-evidence.ts`.
- **Signatures are correlated, not stored.** Each signature header that the
  route's contract declares is replaced with `sigfp:` plus the first 16 hex
  characters of its SHA-256 digest. That is enough to tell "the same bad
  request again" from "a different bad request", and it does not retain a value
  that can be replayed.
- **Endpoint identity is canonical:** `${origin}${pathname}` with the query
  string removed, so a `?signature=` HMAC (Awin), a session id, or an email
  address in the query never reaches the queue.
- **Bodies are capped at 8192 characters.** A longer body is stored truncated
  and ends with the visible marker `…[TRUNCATED]`, so a reader can tell the
  evidence is incomplete instead of assuming the provider sent a short body.
- **Auditability:** the canonical endpoint, source IP, failure reason, network
  and tenant hint are stored columns; the table indexes
  `(network, resolved, created_at DESC)` and
  `(tenant_hint, resolved, created_at DESC)`, so queries per network or per
  tenant resolve in index order. Endpoint, source IP and failure reason are
  filterable columns, not indexes.
- **Redeliveries and unattributed floods are bounded differently:**
  - **Attributed rows (`tenant_hint` verified by HMAC):** the row id hashes
    `('attributed', network, endpoint, failure reason, tenant hint, payload)`, so
    a provider redelivering the same bad request increments `retry_count` on one
    row while distinct conversion bodies for a verified workspace remain distinct
    rows.
  - **Unattributed rows (`tenant_hint IS NULL`, pre-HMAC):** the row id hashes
    `('unattributed', network, endpoint, failure reason, 15-minute window bucket)`
    (`UNATTRIBUTED_DLQ_WINDOW_MS = 900_000`) and omits `payload`. An
    unauthenticated flood varying the request body collapses onto at most one
    row per `(network, endpoint, failure reason)` per 15-minute window, keeping
    the first sample payload of that window and counting every subsequent hit in
    `retry_count` + `last_attempted_at`. The leading domain tag guarantees the
    two id spaces are disjoint. There is still no Cloudflare edge WAF rate-limit
    rule dedicated to these URLs outside the application webhook limiter.
- **Tenant isolation:** `tenant_hint` is `NULL` until the signature proves the
  tenant. The queue read and resolve helpers require a `tenantId` and filter by
  it, so they can never return another workspace's rows, and rows with a `NULL`
  hint match no tenant at all. These helpers have no caller yet.

Note on the dedup key: because the endpoint is now canonical, two requests to
the same route that differ only in query string collapse onto one row. That is
intentional — the query string is not part of the evidence identity, and
keeping it would let an unauthenticated caller mint unlimited rows by varying
one parameter. Attributed rows with distinct bodies still produce distinct rows
(up to the 8192-character cap); unattributed rows share one row per 15-minute
window regardless of body variation.

Retention is unbounded today: `0489` has no TTL column, D1 applies no
per-table expiry, and the application has no code path that deletes rows from
this table. Rows accumulate until someone removes them with a direct D1 query.
Bounded retention needs a separately approved migration or scheduled cleanup —
this document does not promise it.

### Error reference

| Code | HTTP | Meaning | Fix |
|---|---|---|---|
| `tenant_unresolvable` | 422 | No workspace link or tenant hint | Add a workspace sub-id or `tenant_id` |
| `link_unattributed` | 422 | Tenant verified but no link matched | Create the link/sub in the workspace first |
| `secret_not_configured` | 503 | Workspace has no credential for the network | Store it via the integrations API |
| `db_unavailable` / `db_write_failed` | 503 | Transient storage failure | Retry; provider backoff applies |
| `network_not_supported` / `network_moved` | 501 | No verifier on this path | Follow `guidance`/`canonical` in the response |
| `INVALID_SIGNATURE` / `Invalid signature` | 401 | HMAC mismatch or missing header | Check secret + header + raw body bytes |
| `skipped: parse_error` | 200 | Body is not JSON | Fix provider payload; captured to the DLQ on the legacy ecommerce path, nothing recorded in the ledger (ClickBank acks without capture) |
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
- Lỗi lưu trữ/cấu hình trả `503` (retry). Trên các endpoint ecommerce legacy,
  body rác vĩnh viễn (không phải JSON, thiếu mã giao dịch) được ghi vào
  dead-letter queue trước, sau đó vẫn ack `200 + skipped` để provider không
  retry-storm.

### Endpoint chuẩn

`POST /api/postback/{network}` kèm chữ ký provider và sub-id của workspace.
Bảng slug và cách verify xem phần EN ở trên.

### URL legacy tương thích (giữ nguyên, chưa đặt sunset)

URL legacy vẫn chạy khi workspace đã lưu credential và postback có sub-id.
Env secret global KHÔNG còn được đọc. Chi tiết từng URL xem bảng EN ở trên.
Lưu ý: mỗi URL legacy có bộ header chữ ký riêng, không giống endpoint chuẩn và
cũng không giống nhau — `saas-crypto` dùng header riêng từng network (binance,
bybit nhận cả `authorization` và bỏ tiền tố `Bearer `); `affiliate` dùng
HMAC-SHA256 kèm header dự phòng `x-signature` và từ chối `clickbank` với
`501 network_moved`; các route đơn lẻ chỉ nhận đúng một header mỗi network.

### Cài đặt cho mỗi workspace

1. Lưu credential: `POST /api/v1/integrations/affiliate-networks`
   `{ network, payload: { api_secret, ... } }` (đã đăng nhập).
2. Tạo tracking link/sub trong workspace và cấu hình provider gửi sub-id.
3. Trỏ provider sang URL chuẩn (khuyến nghị) hoặc giữ URL legacy.

### Hàng đợi Dead-Letter (DLQ) cho postback không xử lý được

Trên các endpoint legacy
(`/api/webhooks/saas-crypto/[network]`, `/api/webhooks/affiliate/[network]`,
`/api/webhooks/{accesstrade,amazon,awin,tiktok-shop}`), request được ghi vào
bảng `postback_dead_letter` (migration `0489`) khi:

- body không phải JSON, hoặc không có mã giao dịch — chỉ ở handler ecommerce
  legacy; ghi vào hàng đợi trước, sau đó vẫn ack `200 + skipped`;
- không resolve được tenant, credential, hoặc link có thể gắn — hai trường hợp
  đầu xảy ra trên cả hai route, trường hợp link chỉ ở handler ecommerce legacy.

KHÔNG BAO GIỜ ghi, trên mọi route: lỗi chữ ký (`401`), lỗi lưu trữ
(`503 db_unavailable` / `db_write_failed`), và `400` trước bước parse mà
`/api/webhooks/saas-crypto/[network]` trả về khi body không phải JSON — những
trường hợp đó người gọi phải sửa rồi gửi lại. Trên route này, lỗi service sau
khi đã xác thực chữ ký cũng trả `422/503` mà không có bản ghi trong hàng đợi.

Cơ chế này đảm bảo:

- **Giữ lại payload:** body của request, một bộ header giới hạn, IP nguồn và lý
  do lỗi được ghi vào bảng, dù request đã ack `200 + skipped` hay fail closed
  với `422` / `503 secret_not_configured`. Hiện chưa có gì đọc bảng này — không
  màn hình admin, API hay job định kỳ nào gọi các hàm của hàng đợi — nên muốn
  xem một bản ghi lúc này phải truy vấn D1 trực tiếp.
- **Header chỉ lưu theo danh sách cho phép, không lưu toàn bộ.** Chỉ
  `user-agent`, `content-type`, `content-length`, `cf-ray`, `cf-ipcountry` và
  `cdn-loop` được lưu. Mọi header khác — `cookie`, `set-cookie`,
  `proxy-authorization`, `x-forwarded-for`, API key của provider — bị bỏ hẳn,
  không che bớt giá trị. Ngoại lệ duy nhất là `authorization`: trên route
  binance và bybit, đây là header chữ ký được khai báo nên khóa vẫn được giữ và
  giá trị lưu dưới dạng dấu vân tay `sigfp:` bên dưới, không bao giờ lưu giá trị
  gốc. Nếu đọc header bị lỗi, trường này được ghi là `{}`.
  Xem `src/land/postback/postback-dlq-evidence.ts`.
- **Chữ ký chỉ dùng để đối chiếu, không lưu giá trị.** Mỗi header chữ ký mà
  contract của route khai báo được thay bằng `sigfp:` cộng 16 ký tự hex đầu của
  digest SHA-256. Như vậy vẫn phân biệt được "đúng request lỗi đó gửi lại" với
  "một request lỗi khác", mà không giữ lại giá trị có thể bị dùng lại.
- **Endpoint dùng dạng chuẩn tắc:** `${origin}${pathname}`, bỏ toàn bộ query
  string, nên HMAC trong `?signature=` (Awin), session id hay email trong query
  không bao giờ vào hàng đợi.
- **Body bị giới hạn ở 8192 ký tự.** Body dài hơn sẽ được lưu ở dạng cắt bớt và
  kết thúc bằng dấu hiệu nhìn thấy được `…[TRUNCATED]`, để người đọc biết bằng
  chứng không đầy đủ thay vì tưởng provider gửi body ngắn.
- **Minh bạch kiểm toán:** endpoint chuẩn tắc, IP nguồn, lý do lỗi, network và
  gợi ý tenant đều là các cột trong bảng; bảng chỉ đánh index cho
  `(network, resolved, created_at DESC)` và
  `(tenant_hint, resolved, created_at DESC)`, nên truy vấn theo từng network
  hoặc từng tenant chạy đúng thứ tự index. Endpoint, IP nguồn và lý do lỗi là cột
  để lọc, không phải index.
- **Gửi lại và flood chưa xác thực được giới hạn theo hai cơ chế riêng:**
  - **Dòng đã gắn tenant (`tenant_hint` đã được chữ ký HMAC chứng minh):** id
    của bản ghi băm từ `('attributed', network, endpoint, lý do lỗi, tenant hint,
    payload)`, nên khi provider gửi lại đúng request lỗi đó thì `retry_count`
    tăng trên cùng một dòng, còn các body giao dịch khác nhau của cùng workspace
    vẫn giữ dòng riêng.
  - **Dòng chưa xác thực (`tenant_hint IS NULL`, trước bước HMAC):** id của bản
    ghi băm từ `('unattributed', network, endpoint, lý do lỗi, khung 15 phút)`
    (`UNATTRIBUTED_DLQ_WINDOW_MS = 900_000`) và không đưa `payload` vào khoá.
    Một caller chưa xác thực gửi body thay đổi liên tục chỉ tạo tối đa 1 dòng
    mỗi `(network, endpoint, lý do lỗi)` trong mỗi khung 15 phút — giữ lại mẫu
    payload đầu tiên của khung đó và đếm mọi lần gửi tiếp theo vào `retry_count`
    kèm `last_attempted_at`. Nhãn miền id ở đầu khoá đảm bảo hai không gian id
    này không thể giao nhau. Hiện vẫn chưa có rule rate limit riêng ở tầng
    Cloudflare edge WAF ngoài bộ giới hạn webhook ở tầng ứng dụng.
- **Cô lập theo tenant:** `tenant_hint` là `NULL` cho đến khi chữ ký chứng minh
  được tenant. Các hàm đọc và resolve hàng đợi bắt buộc `tenantId` và lọc theo
  đó, nên không bao giờ trả về dòng của workspace khác, và dòng có hint `NULL`
  không khớp với tenant nào. Các hàm này hiện chưa có nơi gọi.

Lưu ý về khoá dedup: vì endpoint nay là dạng chuẩn tắc, hai request vào cùng
route chỉ khác nhau ở query string sẽ gộp vào một dòng. Đây là chủ đích — query
string không thuộc danh tính của bằng chứng, giữ nó lại thì một caller chưa xác
thực có thể tạo vô hạn dòng chỉ bằng cách đổi một tham số. Với các dòng đã gắn
tenant, body khác nhau vẫn cho ra dòng khác nhau (trong giới hạn 8192 ký tự);
với các dòng chưa xác thực (`tenant_hint IS NULL`), mọi biến thể body trong cùng
khung 15 phút dùng chung một dòng.

Hiện chưa có giới hạn thời gian lưu: bảng `0489` không có cột TTL, D1 không tự
hết hạn theo bảng, và ứng dụng không có đoạn code nào xoá dòng khỏi bảng này.
Số dòng chỉ tăng cho đến khi có người xoá bằng truy vấn D1 trực tiếp. Muốn giới
hạn thời gian lưu cần một migration hoặc job dọn dẹp được duyệt riêng — tài
liệu này không cam kết điều đó.

### Bảng lỗi và cách xử lý: xem bảng EN ở trên.

### Lưu ý provider / UNKNOWN

- `tag` Amazon dùng chung cho cả tài khoản: muốn attribution từng click phải
  dùng hậu tố tag dạng composite (ví dụ `${TAG}-${linkIdShort}`) lưu làm
  `sub_id`; tag chung gây mơ hồ sẽ fail closed.
- Cách truyền chữ ký của Awin/ClickBank/TikTok khác nhau giữa các endpoint;
  mỗi endpoint giữ nguyên contract cũ. Provider nào dùng URL legacy mà không
  khớp contract đã ghi → ghi UNKNOWN, báo lại thay vì tự nới verify.
- Chưa đặt ngày sunset cho URL legacy.
