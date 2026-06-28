---
title: "ROIaaS PHASE 2 - License Management UI"
description: "Admin dashboard cho quản lý license keys với CRUD operations và audit logs"
status: pending
priority: P1
effort: 8h
branch: main
tags: [raas, license, admin, ui, api]
created: 2026-03-06
---

# ROIaaS PHASE 2 - License Management UI

## Tổng quan

Xây dựng admin dashboard để quản lý license keys cho ROIaaS gating system, bao gồm:
- CRUD license keys (Create, Read, Update, Revoke)
- Audit logs theo dõi mọi thao tác
- Integration với existing RaaS infrastructure (raas-gate.ts, raas-service.ts)

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Admin Dashboard UI                           │
│  /dashboard/admin/licenses                                      │
│  ├── LicenseList (table với search/filter)                      │
│  ├── LicenseGenerator (form tạo key mới)                        │
│  ├── LicenseDetail (xem chi tiết + revoke)                      │
│  └── AuditLogViewer (lịch sử operations)                        │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    API Endpoints                                │
│  /api/admin/licenses (CRUD)                                     │
│  /api/admin/licenses/:id/revoke                                 │
│  /api/admin/licenses/audit                                      │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    RaaS Service Layer                           │
│  ├── generateLicenseKey() (existing)                            │
│  ├── validateLicenseKey() (existing)                            │
│  ├── revokeLicenseKey() (existing - Redis)                      │
│  └── audit logging (NEW - Supabase)                             │
└─────────────────────────────────────────────────────────────────┘
```

## Phân tích hiện trạng

### ✅ Đã có (PHASE 1)
- `src/lib/raas-key-generator.ts` - Tạo license keys với HMAC-SHA256
- `src/lib/raas-service.ts` - Validate license keys (HMAC, nonce, revocation)
- `src/lib/raas-gate.ts` - Middleware chặn API routes không có license
- `src/lib/redis.ts` - Redis client cho nonce tracking
- `docs/raas-license-gating.md` - Documentation

### ❌ Chưa có (PHASE 2)
- ❌ UI để tạo/xem/revoke license keys
- ❌ API endpoints cho admin operations
- ❌ Database schema lưu audit logs
- ❌ Admin dashboard page

## Implementation Phases

### Phase 1: Database Schema & Audit Model
**File:** `src/lib/raas-audit.ts`, Database migration

**Công việc:**
1. Tạo Supabase table `raas_licenses` lưu license metadata
2. Tạo Supabase table `raas_audit_logs` lưu audit trail
3. Tạo raas-audit.ts service cho logging operations

**Schema đề xuất:**
```sql
-- License keys metadata
CREATE TABLE raas_licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash TEXT NOT NULL,      -- SHA256 hash của full key (không lưu plain text)
  tier TEXT NOT NULL,           -- basic | premium | enterprise | master
  expires_at BIGINT,            -- Unix timestamp (0 = perpetual)
  nonce TEXT NOT NULL,          -- 32 hex chars
  is_revoked BOOLEAN DEFAULT false,
  revoked_at BIGINT,
  created_by UUID REFERENCES auth.users(id),
  created_at BIGINT NOT NULL,
  metadata JSONB DEFAULT '{}'
);

-- Audit logs
CREATE TABLE raas_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,         -- CREATE | VALIDATE | REVOKE | VIEW
  license_id UUID REFERENCES raas_licenses(id),
  user_id UUID REFERENCES auth.users(id),
  ip_address TEXT,
  user_agent TEXT,
  details JSONB DEFAULT '{}',
  created_at BIGINT NOT NULL
);

-- Indexes
CREATE INDEX idx_raas_licenses_key_hash ON raas_licenses(key_hash);
CREATE INDEX idx_raas_audit_logs_license ON raas_audit_logs(license_id);
CREATE INDEX idx_raas_audit_logs_user ON raas_audit_logs(user_id);
CREATE INDEX idx_raas_audit_logs_action ON raas_audit_logs(action);
```

**Success Criteria:**
- [ ] Migration SQL file tạo thành công
- [ ] RLS policies configured cho admin only
- [ ] raas-audit.ts service có đủ methods: logCreation(), logValidation(), logRevocation()

---

### Phase 2: API Endpoints
**Files:** `/api/admin/licenses/route.ts`, `/api/admin/licenses/[id]/route.ts`, `/api/admin/licenses/audit/route.ts`

**Endpoints cần tạo:**

#### GET /api/admin/licenses
- Query params: `?tier=premium&search=abc&status=active|revoked`
- Response: `{ licenses: LicenseSummary[], total: number }`
- Security: Admin only (check session + role)

#### POST /api/admin/licenses
- Body: `{ tier: string, expiresAt?: number, metadata?: object }`
- Action: Tạo license key mới bằng `generateLicenseKey()`
- Response: `{ key: string, license: LicenseSummary }`
- **Lưu ý:** Chỉ trả về full key 1 lần duy nhất khi tạo!

#### GET /api/admin/licenses/[id]
- Response: `{ license: LicenseDetail }` (không có full key)

#### POST /api/admin/licenses/[id]/revoke
- Action: Gọi `revokeLicenseKey()` + update DB
- Response: `{ success: true, revokedAt: number }`

#### GET /api/admin/licenses/audit
- Query params: `?licenseId=xxx&userId=xxx&action=CREATE|REVOKE`
- Response: `{ logs: AuditLog[], total: number }`

**Security:**
- Tất cả endpoints yêu cầu admin session
- Rate limiting: 10 requests/minute/ip

**Success Criteria:**
- [ ] 5 endpoints hoạt động qua API test
- [ ] Admin-only access enforced
- [ ] Error handling đầy đủ
- [ ] Audit logging tự động

---

### Phase 3: UI Components
**Folder:** `src/components/admin/licenses/`

**Components cần build:**

#### 1. LicenseGenerator
**File:** `src/components/admin/licenses/license-generator.tsx`
- Form select tier (basic/premium/enterprise/master)
- DatePicker chọn expiration (ẩn với master tier)
- Metadata inputs (optional: customer email, notes)
- Generate button → gọi POST /api/admin/licenses
- **Critical:** Hiển thị key 1 lần duy nhất với warning "Copy ngay - không xem lại được"
- Auto-copy to clipboard button

#### 2. LicenseList
**File:** `src/components/admin/licenses/license-list.tsx`
- Table hiển thị: ID, Tier, Status, Expires, Created, Actions
- Search box (search by key hash suffix)
- Filter dropdowns: Tier, Status (active/revoked/expired)
- Pagination (20 items/page)
- Actions column: View | Revoke

#### 3. LicenseCard
**File:** `src/components/admin/licenses/license-card.tsx`
- Card view cho mobile/responsive
- Hiển thị badge tier màu khác nhau
- Countdown timer cho expiration
- Revoke button với confirmation dialog

#### 4. LicenseDetailDialog
**File:** `src/components/admin/licenses/license-detail-dialog.tsx`
- Modal xem chi tiết license
- Hiển thị metadata, audit history
- Revoke button (nếu chưa revoked)

#### 5. AuditLogTable
**File:** `src/components/admin/licenses/audit-log-table.tsx`
- Table logs: Timestamp, Action, User, License, IP
- Filter by action type, date range
- Export CSV button

**Success Criteria:**
- [ ] 5 components build không lỗi
- [ ] Responsive mobile/desktop
- [ ] Loading states, error states đầy đủ
- [ ] i18n ready (t() keys)

---

### Phase 4: Admin Dashboard Page
**File:** `src/app/[locale]/dashboard/admin/licenses/page.tsx`

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│  Admin Dashboard > License Management                       │
├─────────────────────────────────────────────────────────────┤
│  [Tabs: All Licenses | Active | Revoked | Audit Logs]       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  + New License    [Search...]  [Filter: Tier ▼] [Export]   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ID  │ Tier      │ Status  │ Expires  │ Actions     │   │
│  ├─────┼───────────┼─────────┼──────────┼─────────────┤   │
│  │ ... │ premium   │ Active  │ 365 days │ View Revoke │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Pagination: < 1 2 3 ... 10 >                               │
└─────────────────────────────────────────────────────────────┘
```

**Tabs:**
1. **All Licenses** - LicenseList component
2. **Active** - Filter status=active
3. **Revoked** - Filter status=revoked
4. **Audit Logs** - AuditLogTable component

**Success Criteria:**
- [ ] Page accessible tại /dashboard/admin/licenses
- [ ] Sidebar navigation cập nhật
- [ ] Tabs switching hoạt động
- [ ] Client-side caching với React Query

---

### Phase 5: Integration & Testing
**Files:** Test files, integration checks

**Công việc:**

#### 1. Unit Tests
- `src/lib/raas-audit.test.ts` - Audit logging tests
- API route tests cho 5 endpoints

#### 2. Integration Tests
- Tạo license → Validate key → Revoke → Validate again (phải fail)
- Audit log ghi đúng actions

#### 3. E2E Tests (Playwright)
- Admin login → Navigate to licenses → Create key → Revoke
- Verify audit logs appear

#### 4. Security Tests
- Non-admin user access → 403
- Rate limiting test
- XSS prevention trong audit logs

**Success Criteria:**
- [ ] 100% test pass
- [ ] Security scan không issue
- [ ] Performance: < 500ms response time

---

## File Manifest

### Mới tạo
```
src/
├── lib/
│   ├── raas-audit.ts              # Audit logging service
│   └── raas-audit.test.ts         # Unit tests
├── components/
│   └── admin/
│       └── licenses/
│           ├── license-generator.tsx
│           ├── license-list.tsx
│           ├── license-card.tsx
│           ├── license-detail-dialog.tsx
│           └── audit-log-table.tsx
└── app/
    └── [locale]/
        └── dashboard/
            └── admin/
                └── licenses/
                    ├── page.tsx                     # Main dashboard
                    └── license/
                        └── [id]/
                            └── page.tsx             # Detail view

apps/sophia-ai-factory/src/app/api/
└── admin/
    └── licenses/
        ├── route.ts                 # GET/POST licenses
        ├── [id]/
        │   └── route.ts             # GET license, POST revoke
        └── audit/
            └── route.ts             # GET audit logs
```

### Chỉnh sửa
```
src/lib/
├── raas-service.ts          # Export thêm revokeLicenseKey() public
└── redis.ts                 # Không đổi

src/app/[locale]/dashboard/
├── layout.tsx               # Thêm sidebar link "Admin > Licenses"
└── i18n/
    ├── vi.ts                # Thêm translation keys
    └── en.ts
```

---

## Dependencies & Integration Points

### Existing Infrastructure
- `raas-key-generator.ts` - Dùng `generateLicenseKey()`
- `raas-service.ts` - Dùng `validateLicenseKey()`, `revokeLicenseKey()`
- `redis.ts` - Redis client cho revocation check
- Supabase client - Audit logs storage

### New Dependencies
- Supabase tables: `raas_licenses`, `raas_audit_logs`
- Admin auth check (existing Supabase auth)

---

## Security Considerations

### License Key Storage
- **KHÔNG** lưu plain text key trong DB
- Lưu `key_hash = SHA256(key)` để đối chiếu khi cần
- Full key chỉ hiện 1 lần khi tạo cho user copy

### Access Control
- Admin-only endpoints (check session + role)
- Rate limiting 10 req/min/ip
- Audit log mọi access attempts

### Revocation Flow
```
User click Revoke → Confirm dialog → POST /api/admin/licenses/[id]/revoke
  ↓
API: revokeLicenseKey(key, redis)  # Thêm vào Redis REVOKED set
  ↓
DB: UPDATE raas_licenses SET is_revoked=true
  ↓
Audit: logRevocation(licenseId, userId)
  ↓
Response: { success: true }
```

---

## Success Criteria (Definition of Done)

### Functional
- [ ] Tạo được license key từ UI
- [ ] Xem danh sách licenses với filter/search
- [ ] Revoke license thành công
- [ ] Audit logs hiển thị đầy đủ

### Technical
- [ ] 0 TypeScript errors
- [ ] 100% tests pass
- [ ] API response < 500ms
- [ ] Build < 10s

### Security
- [ ] Non-admin access → 403
- [ ] Rate limiting active
- [ ] No secrets in frontend code
- [ ] Audit logs immutable

### Documentation
- [ ] Update `docs/raas-license-gating.md` với Phase 2 info
- [ ] API docs trong code comments
- [ ] Admin guide screenshot

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Redis downtime | High | Fail-open cho validation, cache-in-DB |
| Audit log quá lớn | Medium | Auto-archive sau 90 days |
| Key leakage từ admin UI | High | Chỉ hiện 1 lần, confirmation dialogs |
| Rate limit false positive | Low | Whitelist internal IPs |

---

## Next Steps

1. **Ngay lập tức:**
   - [ ] Tạo plan folder với cấu trúc trên
   - [ ] Tạo các phase files chi tiết
   - [ ] Delegate cho developer agent bắt đầu Phase 1

2. **Sau khi approval:**
   - Implement theo thứ tự Phase 1 → 5
   - Test sau mỗi phase
   - Demo trước khi sang phase tiếp

---

## Unresolved Questions

1. **Database:** Có cần thêm column `customer_email` trong `raas_licenses` để track ai đang dùng key nào không?
2. **Key Rotation:** Có cần support multiple active secrets (RAAS_LICENSE_SECRET_OLD) cho key rotation không?
3. **Export:** Có cần export licenses ra CSV/JSON không?
4. **Notifications:** Có cần email notification khi license sắp expire không?
