# Sophia AI Factory — Open-Core Community Wedge Launch Kit
> **Bilingual Launch Package (Tiếng Việt & English)** for GitHub, ProductHunt, and VN Tech Communities.

---

## 1. Value Proposition / Định vị Giá trị

- **EN:** Sophia AI Factory Open-Core (`Apache-2.0`) gives every builder a sovereign, BYOK (Bring-Your-Own-Keys) AI video factory. Self-host the core engine with zero vendor lock-in, and seamlessly upgrade to Sophia Managed Cloud or Master License (`$4,999`) when you need multi-channel social publishing relays, automated affiliate payouts, and high-volume edge scaling.
- **VI:** Sophia AI Factory Open-Core (`Apache-2.0`) trao cho lập trình viên nền tảng sản xuất video AI tự chủ với mô hình BYOK (tự mang API keys). Bạn hoàn toàn làm chủ mã nguồn không phụ thuộc nhà cung cấp, và dễ dàng chuyển dịch lên Sophia Managed Cloud hoặc Master License (`$4,999`) khi cần cổng đăng tự động đa kênh, đối soát hoa hồng và vận hành hạ tầng Cloudflare Workers quy mô lớn.

---

## 2. 3-Step Self-Hosting Quickstart / Khởi động Nhanh 3 Bước

Verify and boot the Open-Core community runtime locally:

```bash
# 1. Clone & prepare environment
git clone https://github.com/sophia-ai-factory/sophia-ai-factory.git && cd sophia-ai-factory
cp .env.community.example apps/sophia-ai-factory/.env.local

# 2. Install dependencies & run pre-flight quality verification
cd apps/sophia-ai-factory && npm install
npm run type-check && npm test

# 3. Start local development server
npm run dev # Open http://localhost:3000
```

---

## 3. 60-Second Cloud Portability / Di chuyển Lên Cloud trong 60 Giây

Move your workspace settings (language, routing strategy, connected providers, channel presets) from a self-hosted Community instance to Sophia Managed Cloud at `/api/open-core/portability`.

**What is exported — and what is never exported:** only non-sensitive settings above. **Raw API keys are never read and never leave your instance** (no BYOK key leakage).

**Two honest limits of the bundle, stated up front:**
- The `checksumHex` field protects against accidental corruption. It is **not a signature** — anyone can compute it, because the key is a published constant, not a secret. Do not treat a bundle as proof of origin.
- No passphrase or encryption is applied to the bundle. It contains no secrets, but it is readable JSON; keep the file private until you import it.

**Both steps require a signed-in session cookie.** There is no bearer token and no `action` or `passphrase` field — the earlier draft of this kit described those and the route never had them.

Viết đơn giản cho CEO không kỹ thuật: hai lệnh dưới đây cần bạn đã đăng nhập bằng cookie phiên làm việc. Không có token, không có mật khẩu passphrase.

**Step 1 — Export from your self-hosted instance** (GET, no body):

```bash
curl -s -c cookies.txt -b cookies.txt \
  https://<your-instance>/api/open-core/portability \
  > workspace-bundle.json
```

You get `{ "success": true, "bundle": { "config": {...}, "checksumHex": "..." }, "settingsUrl": "..." }`. Save `bundle` — that object is what Step 2 needs.

**Step 2 — Import into Sophia Managed Cloud** (POST, body = the bundle object):

```bash
BUNDLE=$(node -e "console.log(JSON.stringify(require('./workspace-bundle.json').bundle))")

curl -s -c cookies.txt -b cookies.txt \
  -X POST https://sophia.agencyos.network/api/open-core/portability \
  -H "Content-Type: application/json" \
  -d "$BUNDLE"
```

The body must be exactly the `bundle` object from Step 1, because the import re-computes `checksumHex` over its `config` and compares them. Wrapping it in `{"bundle": ...}` or dropping the checksum makes it fail validation.

**Fail-closed by design:** GET and POST both return `401 Unauthorized` without a valid session, never an empty or partial export.

**Lỗi hay gặp:** POST trả `422` nếu gói bị sửa (checksum lệch), `400` nếu thiếu `checksumHex` hoặc schema sai, `401` nếu cookie hết hạn.

---

## 4. Launch Distribution Channels / Kênh Ra Mắt

### A. GitHub Releases & Discussions
- **Tagline:** Sophia AI Factory v1.0 — Open-Core Sovereign AI Video Factory (Next.js 16 + BYOK).
- **CTA:** Star the repo, run `npm run dev`, and join discussions on custom video workflows.

### B. ProductHunt Post
- **Title:** Sophia AI Factory — Open-core AI video automation for agency founders.
- **Short Pitch:** Turn scripts into faceless videos using your own AI keys. Self-host on Cloudflare Workers or run on Managed Cloud.
- **Makers Comment:** Bilingual support (EN + VI), zero platform tax, full export portability.

### C. Vietnam Tech Communities (J2TEAM, VN AI Builders, Grok Tech)
- **Tiêu đề:** Ra mắt Sophia AI Factory Open-Core: Nền tảng AI Video mã nguồn mở chuẩn Clean Architecture.
- **Nội dung:** Tự host với Next.js 16, Cloudflare D1/R2, BYOK an toàn, không tốn chi phí nền tảng khi bắt đầu.
- **Link:** [GitHub Repo](https://github.com/sophia-ai-factory/sophia-ai-factory) | [Self-Hosting Guide](https://github.com/sophia-ai-factory/sophia-ai-factory/blob/main/docs/SELF_HOSTING.md)

---

## 5. Verification Gate / Kiểm tra Tính Hợp lệ

Ensure your release bundle strictly complies with community boundaries and licensing:

```bash
node apps/sophia-ai-factory/scripts/verify-open-core-readiness.mjs
```
