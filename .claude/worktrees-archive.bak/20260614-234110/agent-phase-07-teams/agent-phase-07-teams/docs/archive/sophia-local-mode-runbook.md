# Sophia Local Mode — Hướng dẫn Vận hành / Customer Runbook

**Phiên bản / Version:** 1.0 | **Cập nhật / Updated:** 2026-04-17
**Đối tượng / Audience:** Sophia founder (non-tech CEO)

---

## Tổng quan / Overview

### [VN] Tổng quan

**Local Mode** cho phép Sophia chạy mô hình AI (Qwen 3.6) trực tiếp trên máy M1 Max của bạn thay vì gọi API cloud.
Khi bật, mọi yêu cầu AI sẽ đi theo đường: `Sophia Cloud → Cloudflare Tunnel → mekongd (M1 Max) → Qwen 3.6`.

**Dùng khi nào:**
- Bạn muốn tiết kiệm chi phí API cloud (cắt 4–10×)
- Bạn cần tốc độ cao và độ trễ thấp (25–35 token/giây trên M1 Max)
- Dữ liệu nhạy cảm không muốn ra ngoài máy cá nhân

**Không nên dùng khi:**
- Mạng internet không ổn định hoặc đang dùng 4G/hotspot
- Máy M1 Max đang tắt hoặc ngủ đông
- RAM còn lại dưới 8 GB (model cần ít nhất 20 GB)

### [EN] Overview

**Local Mode** lets Sophia run AI (Qwen 3.6) directly on your M1 Max instead of calling cloud APIs.
When enabled, all AI requests flow: `Sophia Cloud → Cloudflare Tunnel → mekongd (M1 Max) → Qwen 3.6`.

**Use when:**
- You want to cut cloud API costs (4–10× reduction)
- You need high throughput / low latency (25–35 tok/s on M1 Max)
- You have sensitive data you prefer to keep on your own machine

**Do NOT use when:**
- Internet connection is unstable or cellular/hotspot
- M1 Max is powered off or in deep sleep
- Available RAM is below 8 GB (model needs at least 20 GB)

---

## Kiến trúc / Architecture

### [VN] Kiến trúc

```
[Sophia Cloud]  ──(HTTPS)──►  [Cloudflare Tunnel]  ──(loopback)──►  [mekongd :4002]  ──►  [Qwen 3.6 MLX]
     │                               │                                      │
  CF Worker                   tunnel endpoint                        Anthropic-compat
  (edge, 30s)                 (mekongd-url.trycloudflare.com)        proxy on M1 Max
```

1. Sophia Workers nhận request từ user.
2. `provider-router.ts` kiểm tra D1: nếu `local_mode_endpoint` tồn tại → route sang tunnel.
3. Tunnel chuyển tiếp đến `mekongd` trên máy M1 Max (cổng 4002).
4. `mekongd` nhận request Anthropic-compat format → chạy Qwen 3.6 via MLX.
5. Kết quả trả về qua đường ngược lại.

### [EN] Architecture

```
[Sophia Cloud]  ──(HTTPS)──►  [Cloudflare Tunnel]  ──(loopback)──►  [mekongd :4002]  ──►  [Qwen 3.6 MLX]
     │                               │                                      │
  CF Worker                   tunnel endpoint                        Anthropic-compat
  (edge, 30s)                 (mekongd-url.trycloudflare.com)        proxy on M1 Max
```

1. Sophia Workers receive user request.
2. `provider-router.ts` checks D1: if `local_mode_endpoint` is set → route to tunnel.
3. Tunnel forwards to `mekongd` on M1 Max (port 4002).
4. `mekongd` receives Anthropic-compat request → runs Qwen 3.6 via MLX.
5. Response returns via the same path.

---

## Yêu cầu / Requirements

### [VN] Yêu cầu hệ thống

| Thành phần | Yêu cầu tối thiểu |
|---|---|
| Thiết bị | Apple M1 Max hoặc M1 Pro (32 GB RAM trở lên) |
| Dung lượng đĩa | ≥ 50 GB trống (model Qwen 3.6 ~20 GB) |
| macOS | 13 Ventura trở lên |
| Kết nối | Cáp quang hoặc WiFi ổn định (tối thiểu 20 Mbps upload) |
| Cloudflared | Đã cài `cloudflared` và đăng nhập Cloudflare account |
| mekongd | v0.1+ (cài theo hướng dẫn Phase D) |

### [EN] System Requirements

| Component | Minimum |
|---|---|
| Hardware | Apple M1 Max or M1 Pro (32 GB RAM or more) |
| Disk space | ≥ 50 GB free (Qwen 3.6 model ~20 GB) |
| macOS | 13 Ventura or later |
| Connectivity | Fiber or stable WiFi (≥ 20 Mbps upload) |
| Cloudflared | Installed and logged into Cloudflare account |
| mekongd | v0.1+ (installed per Phase D guide) |

---

## Cài đặt / Setup

### [VN] Cài đặt

1. Cài `mekongd` trên M1 Max theo hướng dẫn trong `docs/sophia-local-mode-installer.md` (Phase D).
2. Chạy lệnh cài đặt một lần:
   ```bash
   bash scripts/sophia-local-mode-install.sh
   ```
3. Script sẽ tự động:
   - Tải model Qwen 3.6
   - Khởi động `mekongd` trên cổng 4002
   - Tạo Cloudflare Tunnel và lấy URL
   - Đăng ký URL + bearer token lên Sophia (gọi `/api/setup/local-mode/provision`)
4. Mở Sophia Setup Wizard → tab **Local Mode** → xác nhận badge `Connected`.

### [EN] Setup

1. Install `mekongd` on M1 Max following `docs/sophia-local-mode-installer.md` (Phase D).
2. Run the one-liner installer:
   ```bash
   bash scripts/sophia-local-mode-install.sh
   ```
3. The script will automatically:
   - Download the Qwen 3.6 model
   - Start `mekongd` on port 4002
   - Create a Cloudflare Tunnel and obtain the URL
   - Register the URL + bearer token with Sophia (calls `/api/setup/local-mode/provision`)
4. Open Sophia Setup Wizard → **Local Mode** tab → confirm `Connected` badge.

---

## Giám sát / Health Monitoring

### [VN] Giám sát tự động

Sophia tự động kiểm tra kết nối tunnel **mỗi 15 phút** qua cron job.

**Trạng thái badge trong Setup Wizard:**

| Badge | Ý nghĩa |
|---|---|
| ✅ Connected | Ping gần nhất thành công, tunnel đang hoạt động |
| ⚠️ Degraded | 1–2 lần ping thất bại trong 45 phút qua |
| ❌ Disconnected | Tunnel đã bị tắt tự động (xem bên dưới) |

**Tắt tự động:**
Nếu tunnel thất bại **3 lần liên tiếp** trong vòng 45 phút, Sophia sẽ:
1. Xóa `local_mode_endpoint` khỏi tài khoản của bạn.
2. Tự động chuyển về cloud API (fallback).
3. Ghi nhận sự kiện `local_mode_disabled` vào log hệ thống.

Để bật lại, chạy lại script cài đặt hoặc dùng Setup Wizard.

### [EN] Automated Health Monitoring

Sophia automatically checks tunnel connectivity **every 15 minutes** via a cron job.

**Status badges in Setup Wizard:**

| Badge | Meaning |
|---|---|
| ✅ Connected | Last ping succeeded — tunnel is active |
| ⚠️ Degraded | 1–2 ping failures in the past 45 minutes |
| ❌ Disconnected | Tunnel was auto-disabled (see below) |

**Auto-disable:**
If the tunnel fails **3 consecutive times** within 45 minutes, Sophia will:
1. Remove `local_mode_endpoint` from your account.
2. Automatically fall back to cloud API.
3. Record a `local_mode_disabled` event in the system log.

To re-enable, re-run the install script or use the Setup Wizard.

---

## Xử lý sự cố / Troubleshooting

### [VN] Model không tải được / [EN] Model won't download

**[VN]** Kiểm tra dung lượng đĩa (`df -h ~`). Cần ít nhất 50 GB trống.
Nếu đủ dung lượng, thử tải thủ công:
```bash
cd ~/.mekong && mekongd pull qwen3-6b
```

**[EN]** Check disk space (`df -h ~`). Need at least 50 GB free.
If space is sufficient, try manual pull:
```bash
cd ~/.mekong && mekongd pull qwen3-6b
```

---

### [VN] Tunnel không kết nối / [EN] Tunnel not connecting

**[VN]** Kiểm tra cloudflared đang chạy:
```bash
pgrep -x cloudflared && echo "running" || echo "stopped"
```
Khởi động lại:
```bash
launchctl kickstart -k gui/$(id -u)/com.cloudflare.cloudflared
```

**[EN]** Check if cloudflared is running:
```bash
pgrep -x cloudflared && echo "running" || echo "stopped"
```
Restart:
```bash
launchctl kickstart -k gui/$(id -u)/com.cloudflare.cloudflared
```

---

### [VN] Chuyển về cloud (fallback) / [EN] Fallback to cloud

**[VN]** Nếu Local Mode bị tắt tự động, Sophia tự chuyển về cloud API — **không mất dữ liệu, không gián đoạn dịch vụ**.
Bạn chỉ thấy chi phí API cloud tăng trở lại. Bật lại Local Mode bất cứ lúc nào.

**[EN]** If Local Mode is auto-disabled, Sophia falls back to cloud API — **no data loss, no service interruption**.
You'll just see cloud API costs resume. Re-enable Local Mode at any time.

---

### [VN] Cách tắt thủ công / [EN] How to manually disable

**[VN]** Mở Setup Wizard → tab **Local Mode** → nhấn **Disable Local Mode**.
Hoặc gọi API trực tiếp:
```bash
curl -X DELETE https://sophia.agencyos.network/api/setup/local-mode/provision \
  -H "Authorization: Bearer <your-session-token>"
```

**[EN]** Open Setup Wizard → **Local Mode** tab → click **Disable Local Mode**.
Or call the API directly:
```bash
curl -X DELETE https://sophia.agencyos.network/api/setup/local-mode/provision \
  -H "Authorization: Bearer <your-session-token>"
```

---

## Hiệu năng kỳ vọng / Performance Expectations

### [VN] Hiệu năng

| Chỉ số | Giá trị kỳ vọng |
|---|---|
| Tốc độ sinh token | 25–35 token/giây (M1 Max 38-core GPU) |
| Độ trễ đầu tiên (TTFT) | 300–800 ms |
| Giới hạn Cloudflare Worker | 30 giây / request |
| **Yêu cầu:** | Model PHẢI trả lời trong **< 25 giây** |

> Nếu prompt quá dài và model không kịp trả lời trong 25s, Worker sẽ timeout. Chia prompt ngắn hơn hoặc giảm `max_tokens`.

### [EN] Performance

| Metric | Expected Value |
|---|---|
| Token generation speed | 25–35 tok/s (M1 Max 38-core GPU) |
| Time to first token (TTFT) | 300–800 ms |
| Cloudflare Worker limit | 30 seconds / request |
| **Requirement:** | Model MUST respond within **< 25 seconds** |

> If prompt is too long and model can't respond within 25s, Worker will timeout. Shorten prompt or reduce `max_tokens`.

---

## Khi nào nên tắt / When to Disable

### [VN] Nên tắt Local Mode khi:

- Máy M1 Max cần bảo trì hoặc cập nhật macOS
- Đi công tác, chỉ có mạng di động
- Cần chạy nhiều tác vụ nặng khác cùng lúc (render video, compile lớn)
- RAM còn lại < 8 GB

### [EN] Disable Local Mode when:

- M1 Max needs maintenance or macOS update
- Travelling with only mobile/cellular internet
- Running other heavy tasks simultaneously (video render, large compile)
- Available RAM drops below 8 GB

---

## Câu hỏi thường gặp / FAQ

### [VN] Q1: Local Mode có an toàn không? Dữ liệu có ra ngoài không?
**A:** Bearer token được mã hoá AES-256-GCM trước khi lưu vào D1. Dữ liệu AI xử lý hoàn toàn trên máy M1 Max của bạn — không qua server Sophia, không lưu trên cloud.

### [EN] Q1: Is Local Mode secure? Does data leave my machine?
**A:** Bearer token is encrypted with AES-256-GCM before being stored in D1. AI data is processed entirely on your M1 Max — not through Sophia servers, not stored in cloud.

---

### [VN] Q2: Nếu máy M1 Max tắt giữa chừng thì sao?
**A:** Tunnel sẽ đứt. Sophia cron phát hiện sau tối đa 15 phút và tự chuyển về cloud API. Khi máy bật lại, khởi động lại mekongd + cloudflared là đủ.

### [EN] Q2: What if M1 Max shuts down unexpectedly?
**A:** The tunnel drops. Sophia cron detects this within 15 minutes and falls back to cloud API. When the machine restarts, just restart mekongd + cloudflared.

---

### [VN] Q3: Có thể dùng nhiều tài khoản Sophia trên cùng một M1 Max không?
**A:** Hiện tại chưa hỗ trợ. Mỗi M1 Max chỉ cần một `mekongd` instance cho một tài khoản Sophia.

### [EN] Q3: Can multiple Sophia accounts share one M1 Max?
**A:** Not supported currently. One M1 Max runs one `mekongd` instance for one Sophia account.

---

### [VN] Q4: Chi phí giảm bao nhiêu khi dùng Local Mode?
**A:** Ước tính 4–10× tùy volume. Cloud API (OpenRouter/Anthropic) thường $3–15/M token; Local Mode = $0 (chỉ tốn điện máy M1 Max).

### [EN] Q4: How much does Local Mode save?
**A:** Estimated 4–10× depending on volume. Cloud API (OpenRouter/Anthropic) typically $3–15/M tokens; Local Mode = $0 (only M1 Max electricity cost).

---

### [VN] Q5: Badge hiện "Degraded" — tôi cần làm gì?
**A:** Kiểm tra cloudflared và mekongd có đang chạy không. Nếu ping tiếp tục thất bại 1 lần nữa (tổng 3 lần), hệ thống tự tắt và chuyển về cloud. Hành động: khởi động lại dịch vụ sớm.

### [EN] Q5: Badge shows "Degraded" — what should I do?
**A:** Check that cloudflared and mekongd are running. If ping fails one more time (3 total), the system auto-disables and falls back to cloud. Action: restart services promptly.

---

### [VN] Q6: Qwen 3.6 có tương thích với tất cả tính năng Sophia không?
**A:** Tương thích với các tính năng chính: tạo campaign, phân tích nội dung, tóm tắt. Một số tính năng nâng cao (vision, function calling phức tạp) vẫn cần cloud API — Sophia tự phát hiện và route phù hợp.

### [EN] Q6: Is Qwen 3.6 compatible with all Sophia features?
**A:** Compatible with core features: campaign creation, content analysis, summarisation. Some advanced features (vision, complex function calling) still require cloud API — Sophia auto-detects and routes appropriately.
