# Support & SLA / Ho Tro & Cam Ket Dich Vu

> Huong dan xu ly su co va cam ket dich vu
> Issue resolution guide and service level agreement

---

## Tier 1: Tu Xu Ly / Self-Service

### Tieng Viet

Truoc khi lien he ho tro, hay thu cac buoc sau:

1. **FAQ** — Xem cau hoi thuong gap tai trang web
   - `https://sophia.agencyos.network/vi/guide/faq`
2. **Troubleshooting Guide** — Huong dan xu ly su co pho bien
   - Xem file `docs/troubleshooting.md`
3. **Telegram Bot** — Nhap `/help` de xem cac lenh kha dung
   - Bot: @Sophia_Bbot
4. **Guide Pages** — Huong dan su dung chi tiet
   - `https://sophia.agencyos.network/vi/guide`

### English

Before contacting support, try these steps:

1. **FAQ** — Check frequently asked questions on the website
   - `https://sophia.agencyos.network/en/guide/faq`
2. **Troubleshooting Guide** — Common issue resolution guide
   - See `docs/troubleshooting.md`
3. **Telegram Bot** — Type `/help` to see available commands
   - Bot: @Sophia_Bbot
4. **Guide Pages** — Detailed usage guides
   - `https://sophia.agencyos.network/en/guide`

---

## Tier 2: Ho Tro Agency / Agency Support

### Tieng Viet

Khi tu xu ly khong giai quyet duoc:

- **Lien he:** [Thong tin lien he agency se duoc cung cap rieng]
- **Thoi gian tra loi:** Trong 24 gio lam viec
- **Pham vi:**
  - Sua loi (bug fixes)
  - Van de cau hinh (configuration issues)
  - Huong dan su dung
  - Van de thanh toan

### English

When self-service doesn't resolve the issue:

- **Contact:** [Agency contact info will be provided separately]
- **Response time:** Within 24 business hours
- **Scope:**
  - Bug fixes
  - Configuration issues
  - Usage guidance
  - Payment issues

---

## Tier 3: Phat Trien / Development

### Tieng Viet

Cho cac yeu cau moi hoac thay doi lon:

- **Pham vi:** Tinh nang moi, tich hop, thay doi lon
- **Quy trinh:**
  1. Mo ta yeu cau bang van ban
  2. Agency danh gia va bao gia
  3. Thoa thuan pham vi va chi phi
  4. Thuc hien va ban giao
- **Chi phi:** Theo thoa thuan rieng

### English

For new requests or major changes:

- **Scope:** New features, integrations, major changes
- **Process:**
  1. Describe requirement in writing
  2. Agency evaluates and provides quote
  3. Agree on scope and cost
  4. Implementation and delivery
- **Cost:** Separately agreed

---

## SLA / Cam Ket Dich Vu

| Hang Muc / Item | Cam Ket / Commitment |
|---|---|
| **Uptime** | 99.5% (theo Vercel SLA / per Vercel SLA) |
| **Sua loi thuong / Regular bug fix** | Tra loi trong 24h lam viec / 24h business hours response |
| **Loi nghiem trong / Critical bug (site down)** | Tra loi trong 4h / 4h response |
| **Tinh nang moi / Feature requests** | Bao gia rieng / Separately quoted |
| **Bao hanh / Warranty** | 30 ngay sau ban giao / 30 days post-handover |

---

## Bao Hanh 30 Ngay / 30-Day Warranty

### Tieng Viet

Trong 30 ngay sau ban giao:

- **Mien phi** sua cac loi phat sinh tu code da ban giao
- **Khong bao gom:**
  - Loi do client thay doi code
  - Loi do thay doi API keys hoac cau hinh
  - Tinh nang moi ngoai pham vi ban giao
  - Loi tu dich vu ben thu ba (Polar, Supabase, Vercel)

### English

Within 30 days of handover:

- **Free** fixes for bugs originating from delivered code
- **Not covered:**
  - Issues from client code changes
  - Issues from API key or configuration changes
  - New features outside handover scope
  - Third-party service issues (Polar, Supabase, Vercel)

---

## Phan Loai Muc Do / Severity Classification

| Muc Do / Severity | Mo Ta / Description | Thoi Gian Tra Loi / Response Time |
|---|---|---|
| **P1 — Nghiem Trong / Critical** | Trang web khong truy cap duoc / Site is down | 4 gio / 4 hours |
| **P2 — Cao / High** | Tinh nang chinh bi loi / Core feature broken (checkout, login) | 24 gio lam viec / 24 business hours |
| **P3 — Trung Binh / Medium** | Tinh nang phu bi loi / Minor feature issue | 48 gio lam viec / 48 business hours |
| **P4 — Thap / Low** | Loi giao dien, chinh ta / UI bug, typo | Lich theo thoa thuan / Scheduled |
