# Sophia Local Mode — Hướng Dẫn Cài Đặt

> Phiên bản: Phase D | Cập nhật: 2026-04-17

---

## Tổng quan / Overview

**VI:** Sophia Local Mode cho phép bạn chạy mô hình AI (Qwen 3.6) trực tiếp trên máy M1/M2/M3/M4 của bạn. Sophia sẽ gửi yêu cầu đến máy của bạn thay vì dùng API cloud. Tiết kiệm chi phí, bảo mật hơn, tốc độ cao hơn.

**EN:** Sophia Local Mode lets you run the AI model (Qwen 3.6) directly on your M1/M2/M3/M4 machine. Sophia routes requests to your machine instead of cloud APIs — lower cost, higher privacy, faster responses.

---

## Yêu Cầu / Prerequisites

**VI:**
- MacBook / Mac Studio / Mac Mini với chip Apple Silicon (M1/M2/M3/M4)
- RAM tối thiểu **32 GB**
- macOS 13 (Ventura) trở lên
- Kết nối internet ổn định (tải model ~20 GB)
- Token khách hàng Sophia (`SOPHIA_CUSTOMER_TOKEN`)

**EN:**
- MacBook / Mac Studio / Mac Mini with Apple Silicon chip (M1/M2/M3/M4)
- Minimum **32 GB** RAM
- macOS 13 (Ventura) or later
- Stable internet connection (model download ~20 GB)
- Your Sophia customer token (`SOPHIA_CUSTOMER_TOKEN`)

---

## Cài Đặt / Installation

**VI:** Chạy lệnh sau trong Terminal:

**EN:** Run the following command in Terminal:

```bash
export SOPHIA_CUSTOMER_TOKEN=<token-của-bạn>
curl -fsSL https://sophia.agencyos.network/install/local-mode | bash
```

Hoặc / Or — tải script về trước rồi chạy:

```bash
export SOPHIA_CUSTOMER_TOKEN=<your-token>
curl -fsSL https://sophia.agencyos.network/install/local-mode -o install.sh
bash install.sh
```

---

## Script Thực Hiện Gì / What the Script Does

**VI:**

1. **Kiểm tra máy** — xác nhận darwin/arm64, RAM ≥ 32 GB, token hợp lệ
2. **Cài Homebrew** (nếu chưa có) và `cloudflared`, `jq`
3. **Cài mekongd** — tải binary từ GitHub Releases vào `/usr/local/bin/mekongd`
4. **Tải model Qwen** — `mekongd download-model Qwen/Qwen3.6-35B-A3B-4bit` (~20 GB, 15–30 phút)
5. **Cấu hình LaunchAgent** — mekongd tự khởi động trên cổng `127.0.0.1:8765`, khởi động lại nếu crash
6. **Tạo Cloudflare Tunnel** — lấy thông tin từ Sophia API, ghi `~/.cloudflared/config.yml`
7. **Khởi động tunnel** — `brew services start cloudflared`
8. **Đăng ký với Sophia** — gửi hostname và bearer token (mã hóa AES-256-GCM) về Sophia
9. **Lưu trạng thái** — tạo `~/.sophia-local-mode-provisioned` để tránh cài lại

**EN:**

1. **Preflight check** — verifies darwin/arm64, RAM ≥ 32 GB, token present
2. **Install Homebrew** (if missing) and `cloudflared`, `jq`
3. **Install mekongd** — downloads binary from GitHub Releases to `/usr/local/bin/mekongd`
4. **Download Qwen model** — `mekongd download-model Qwen/Qwen3.6-35B-A3B-4bit` (~20 GB, 15–30 min)
5. **Configure LaunchAgent** — mekongd auto-starts on port `127.0.0.1:8765`, restarts on crash
6. **Provision Cloudflare Tunnel** — fetches params from Sophia API, writes `~/.cloudflared/config.yml`
7. **Start tunnel** — `brew services start cloudflared`
8. **Register with Sophia** — sends hostname + bearer token (AES-256-GCM encrypted) to Sophia
9. **Mark complete** — creates `~/.sophia-local-mode-provisioned` to prevent re-installation

---

## Xử Lý Sự Cố / Troubleshooting

### Lỗi Preflight / Preflight Fails

**VI:** Nếu thấy lỗi `Unsupported architecture` hoặc `Insufficient RAM`:
- Kiểm tra chip: `uname -m` phải trả về `arm64`
- Kiểm tra RAM: `sysctl hw.memsize` chia cho 1073741824 = GB thực tế

**EN:** If you see `Unsupported architecture` or `Insufficient RAM`:
- Check chip: `uname -m` must return `arm64`
- Check RAM: `sysctl hw.memsize` divided by 1073741824 = actual GB

---

### Lỗi Tạo Tunnel / Tunnel Creation Fails

**VI:** Nếu script không thể kết nối đến Sophia bootstrap API, thực hiện thủ công:

**EN:** If the script cannot reach the Sophia bootstrap API, provision manually:

```bash
cloudflared tunnel create sophia-local
# Ghi lại tunnel_id từ output / Note the tunnel_id from output

# Tạo config thủ công / Write config manually
cat > ~/.cloudflared/config.yml <<EOF
tunnel: <tunnel_id>
credentials-file: ~/.cloudflared/<tunnel_id>.json
ingress:
  - hostname: mekongd-<hash>.cashclaw.cc
    service: http://127.0.0.1:8765
  - service: http_status:404
EOF

cloudflared tunnel run <tunnel_id> &
```

---

### Lỗi Đăng Ký Sophia / Provision Callback Fails

**VI:** Nếu bước cuối thất bại (exit code 3), gọi API thủ công:

**EN:** If the final step fails (exit code 3), call the API manually:

```bash
curl -X POST https://sophia.agencyos.network/api/setup/local-mode/provision \
  -H "Authorization: Bearer $SOPHIA_CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"hostname":"https://mekongd-<hash>.cashclaw.cc","bearer":"<your-bearer>"}'
```

---

### Cài Lại / Re-Installation

**VI:** Script tự động bỏ qua nếu đã cài. Để cài lại:

**EN:** Script skips automatically if already provisioned. To re-provision:

```bash
rm ~/.sophia-local-mode-provisioned
SOPHIA_CUSTOMER_TOKEN=<token> bash sophia-local-mode-install.sh
```

---

## Gỡ Cài Đặt / Uninstall

**VI:**

**EN:**

```bash
# Stop and remove LaunchAgent / Dừng và xóa LaunchAgent
launchctl unload ~/Library/LaunchAgents/cc.cashclaw.mekongd.plist
rm ~/Library/LaunchAgents/cc.cashclaw.mekongd.plist

# Stop cloudflared tunnel / Dừng tunnel
brew services stop cloudflared

# Remove mekongd binary / Xóa binary
sudo rm /usr/local/bin/mekongd

# Remove config and sentinel / Xóa cấu hình và trạng thái
rm -rf ~/.cloudflared/config.yml
rm -f ~/.sophia-local-mode-provisioned
```

**VI:** Sau khi gỡ, hãy vào Sophia Dashboard để tắt Local Mode trong phần cài đặt.

**EN:** After uninstalling, go to Sophia Dashboard to disable Local Mode in settings.

---

## Hỗ Trợ / Support

**VI:** Gửi log tại `~/Library/Logs/mekongd.log` khi liên hệ hỗ trợ.

**EN:** Attach `~/Library/Logs/mekongd.log` when contacting support.

- Email: support@mekongmind.com
- Sophia Dashboard → Help
