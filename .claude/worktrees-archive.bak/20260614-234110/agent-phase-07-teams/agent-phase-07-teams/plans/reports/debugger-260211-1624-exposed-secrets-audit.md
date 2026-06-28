# Bao Cao Audit Bao Mat - Secrets & Du Lieu Nhay Cam

**Ngay:** 2026-02-11
**Scope:** Sophia AI Factory (`apps/sophia-ai-factory/`)
**Agent:** debugger-aa5226a
**Muc do nghiem trong:** CRITICAL

---

## Tom Tat

Phat hien **2 loi CRITICAL**, **2 loi HIGH**, va **3 loi MEDIUM** lien quan den bi lo secrets. Nghiem trong nhat la **Supabase service_role key** con nam trong git history, cho phep bypass toan bo RLS policies.

---

## Phat Hien CRITICAL

### [CRITICAL-1] Supabase Service Role Key Lo Trong Git History

- **File goc:** `apps/sophia-ai-factory/scripts/check-migration.ts`
- **Commit:** `ef76b9da` (2026-02-06)
- **Exposure:** Public (bat ky ai co repo access)
- **Key bi lo:**
  ```
  URL: https://vhlpbginhiqtgjhgpvfm.supabase.co
  Key: eyJhbGciOiJIUzI1NiIs... (service_role JWT)
  ```
- **Tac dong:** Service role key **bypass toan bo RLS policies**, cho phep:
  - Doc/ghi/xoa moi du lieu trong database
  - Truy cap user data khong can xac thuc
  - Xoa toan bo database
- **Trang thai hien tai:** File da duoc fix (dung env vars), NHUNG key van con trong git history
- **Hanh dong:** ROTATE KEY NGAY LAP TUC tai Supabase Dashboard > Project Settings > API > Regenerate service_role key. Sau do can bao git history bang BFG Repo-Cleaner.

### [CRITICAL-2] Supabase Project Ref Lo Trong Source Code

- **File:** `apps/sophia-ai-factory/scripts/check-migration.ts:56,61` va `run-migration-007.ts:50`
- **Du lieu lo:** Project ref `vhlpbginhiqtgjhgpvfm`
- **Exposure:** Bat ky ai doc source code
- **Tac dong:** Ket hop voi key da lo (CRITICAL-1), attacker co the target chinh xac project nay
- **Hanh dong:** Xoa hardcoded project ref, dung env var `SUPABASE_PROJECT_REF`

---

## Phat Hien HIGH

### [HIGH-1] Hardcoded Admin Password Van Ton Tai Trong Script

- **File:** `scripts/capture-screenshots-for-handover-docs.mjs:58`
- **Code:**
  ```javascript
  password: process.env.ADMIN_PASS || 'sophia2024',
  ```
- **Exposure:** Source code (repo)
- **Trang thai:** Password fallback `sophia2024` van con trong file nay. Middleware da duoc fix (commit `6f3f834`) nhung script nay chua duoc cap nhat.
- **Hanh dong:** Xoa fallback, bat buoc dung env var. Rotate admin password.

### [HIGH-2] Admin Password Lo Trong Git History

- **Commit:** Truoc commit `6f3f834` (2026-02-10)
- **Code goc trong middleware.ts:**
  ```typescript
  const validPass = process.env.ADMIN_PASS || "sophia2024";
  ```
- **Trang thai:** Da fix trong source code hien tai, nhung password van visible trong git diff history
- **Hanh dong:** Rotate ADMIN_PASS ngay. Can bao git history.

---

## Phat Hien MEDIUM

### [MEDIUM-1] NEXT_PUBLIC_ADMIN_USER Lo Ra Frontend

- **File:** `src/app/[locale]/(admin)/admin/settings/page.tsx:70`
- **Code:**
  ```tsx
  value={process.env.NEXT_PUBLIC_ADMIN_USER || "admin"}
  ```
- **Van de:** Bien `NEXT_PUBLIC_*` duoc bundle vao client-side JavaScript, bat ky ai xem source cua trang admin settings se thay admin username.
- **Hanh dong:** Doi thanh server-side variable, khong dung `NEXT_PUBLIC_` prefix cho admin credentials.

### [MEDIUM-2] Dummy Tokens Trong Dev Fallback Code

- **Files:**
  - `src/lib/redis.ts:16-17` — `url: 'https://dummy-url.upstash.io'`, `token: 'dummy_token'`
  - `src/lib/clients/upstash-redis-client.ts:25-26` — Tuong tu
  - `src/lib/telegram/telegram-bot-instance.ts:3` — `'dummy_token_for_build'`
- **Van de:** Du la dummy values, chung tao an tuong rang app co the chay khong can cau hinh thuc te. Neu dev/build fallback len production, app se dung dummy values ma khong bao loi.
- **Trang thai:** Co check `process.env.NODE_ENV === 'production'` o mot so cho nhung khong nhat quan.
- **Hanh dong:** Throw error hoac log warning ro rang khi khong co env vars, khong dung fallback values.

### [MEDIUM-3] File .env.bak Tai Root Directory

- **File:** `/Users/macbookprom1/mekong-cli/apps/sophia-ai-factory/.env.bak`
- **Van de:** File backup cua .env co the chua secrets. Du khong bi git track (`.gitignore` co `.env*`), no van ton tai tren disk va co the bi vo tinh share.
- **Hanh dong:** Xoa file `.env.bak` hoac di chuyen vao thu muc bao mat.

---

## Bien Moi Truong - Danh Gia

### An toan (NEXT_PUBLIC_* — public by design)

| Bien | Muc dich | An toan? |
|------|----------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase endpoint | OK - public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | OK - anon key la public, RLS bao ve |
| `NEXT_PUBLIC_APP_URL` | App URL | OK |
| `NEXT_PUBLIC_MOCK_AI_SERVICES` | Mock flag | OK |
| `NEXT_PUBLIC_IS_CONFIGURED` | Config flag | OK |
| `NEXT_PUBLIC_POLAR_PRODUCT_*` | Product IDs | OK - public IDs |

### Nguy hiem (Backend secrets dung dung cach)

| Bien | Vi tri | An toan? |
|------|--------|----------|
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only | OK - dung `process.env` server-side |
| `POLAR_ACCESS_TOKEN` | Server-only | OK |
| `POLAR_WEBHOOK_SECRET` | Server-only | OK |
| `OPENROUTER_API_KEY` | Server-only | OK |
| `HEYGEN_API_KEY` | Server-only | OK |
| `ELEVENLABS_API_KEY` | Server-only | OK |
| `TELEGRAM_BOT_TOKEN` | Server-only | OK |
| `API_ENCRYPTION_KEY` | Server-only | OK |
| `INNGEST_SIGNING_KEY` | Server-only | OK |
| `ADMIN_USER` / `ADMIN_PASS` | Server-only | OK (nhung MEDIUM-1 lo username) |

### Lo (Can fix)

| Bien | Van de |
|------|--------|
| `NEXT_PUBLIC_ADMIN_USER` | Admin username lo ra client [MEDIUM-1] |

---

## Git History - Van De

| Commit | Loai secret | Trang thai |
|--------|-------------|------------|
| `ef76b9da` | Supabase service_role key | KEY VAN CON TRONG HISTORY |
| Pre-`6f3f834` | Admin password `sophia2024` | PASSWORD VAN CON TRONG HISTORY |

- **So luong commits chua leaked secrets:** 2+ commits
- **Hanh dong:** Su dung BFG Repo-Cleaner de xoa secrets khoi toan bo git history

---

## .gitignore - Danh Gia

### Root `.gitignore` (PASS)
```
.env*
!.env.example
!.env.*.example
```
=> Tat ca .env files (tru example) duoc ignore. **PASS**.

### App `.gitignore` (PASS)
```
.env*
.env*.local
```
=> .env.local va .env.production.local duoc ignore. **PASS**.

### Kiem tra git tracked
```bash
git ls-files -- '*.env*' => Khong co file .env nao bi track
```
=> **PASS** — Khong co file .env nao trong git index.

---

## Cac Buoc Khac Phuc (Theo Thu Tu Uu Tien)

### Ngay Lap Tuc (Trong 1 gio)

1. **ROTATE Supabase service_role key**
   - Vao Supabase Dashboard > Project Settings > API
   - Click "Regenerate" cho service_role key
   - Cap nhat key moi trong Vercel env vars va .env.local

2. **ROTATE Admin password**
   - Doi `ADMIN_PASS` trong Vercel env vars va .env.local
   - Password moi phai >= 16 ky tu, mixed case + numbers + symbols

3. **Fix hardcoded password trong screenshot script**
   - File: `scripts/capture-screenshots-for-handover-docs.mjs:58`
   - Xoa fallback `|| 'sophia2024'`, thay bang throw error neu khong co env var

### Trong Tuan Nay

4. **Can bao git history**
   ```bash
   # Cai BFG Repo-Cleaner
   brew install bfg

   # Tao file chua cac secrets can xoa
   echo "eyJhbGciOiJIUzI1NiIs..." > /tmp/secrets-to-remove.txt
   echo "sophia2024" >> /tmp/secrets-to-remove.txt

   # Chay BFG
   bfg --replace-text /tmp/secrets-to-remove.txt
   git reflog expire --expire=now --all
   git gc --prune=now --aggressive
   git push --force
   ```

5. **Xoa hardcoded project ref**
   - Files: `scripts/check-migration.ts:56,61`, `scripts/run-migration-007.ts:50`
   - Dung `process.env.SUPABASE_PROJECT_REF` thay cho hardcoded ref

6. **Fix NEXT_PUBLIC_ADMIN_USER**
   - Doi thanh server-side variable `ADMIN_USER`
   - Dung Server Component de render admin settings page

7. **Nhat quan hoa dummy token handling**
   - Tat ca dev fallback phai throw error hoac log warning khi production
   - Khong dung dummy values lam fallback

### Dai Han

8. **Pre-commit hook kiem tra secrets**
   ```bash
   # Cai dat detect-secrets hoac gitleaks
   brew install gitleaks
   # Them vao .husky/pre-commit
   gitleaks protect --staged
   ```

9. **Xoa file `.env.bak`**
   ```bash
   rm /Users/macbookprom1/mekong-cli/apps/sophia-ai-factory/.env.bak
   ```

---

## Tong Ket

| Muc do | So luong | Da fix? |
|--------|----------|---------|
| CRITICAL | 2 | Chua (key chua rotate, git history chua can bao) |
| HIGH | 2 | Mot phan (middleware fix, script chua fix) |
| MEDIUM | 3 | Chua |
| TONG | 7 | Hanh dong ngay: Rotate keys + Can bao history |

**Diem danh gia bao mat secrets: 4/10** — Can hanh dong khan cap.

---

## Cau Hoi Chua Giai Quyet

1. **Repo private hay public?** Neu public, toan bo secrets da bi lo ra internet va can rotate NGAY LAP TUC. Neu private, van can rotate vi bat ky ai co repo access (collaborators, CI/CD) deu co the thay.
2. **File `.env.bak` chua gi?** Khong the doc do privacy hook. Can kiem tra thu cong va xoa neu chua secrets.
3. **Key da bi su dung boi attacker chua?** Can kiem tra Supabase audit logs de xem co request bat thuong nao tu IP la khong.
