# 🎨 Sophia UI/UX Docs + Auto-Auth — CC CLI /cook Task

## OBJECTIVE

Tạo docs visual UI/UX A-Z cho Sophia AI Factory + implement thuật toán Auto-Auth full-stack.
Client chỉ cần add account → hệ thống tự đăng nhập qua Supabase Auth.

## CURRENT STATE

- Auth hiện tại: MOCK (`src/lib/auth.ts` — hardcoded `mock-user-001`)
- Admin: Basic Auth via middleware (ADMIN_USER/ADMIN_PASS env)
- Supabase: đang dùng cho data only, CHƯA dùng cho user auth
- 16 pages mapped (dashboard, campaigns, analytics, create, settings, etc.)

## PHASE 1: UI/UX Visual Documentation

### `docs/user-guide-visual.md` — Hướng dẫn A-Z với mô tả UI

Viết docs mô tả TỪNG BƯỚC thao tác trên hệ thống, mỗi screen có:

- Tên trang + URL path
- Mô tả layout (sidebar, header, main content)
- Các nút/action có thể bấm
- Flow chuyển trang (click X → đến trang Y)

#### 📱 User Journey (A → Z):

1. **Landing Page** (`/`) → Giới thiệu Sophia, CTA "Get Started"
2. **Pricing** (`/pricing`) → So sánh 3 tier BASIC/PREMIUM/ENTERPRISE
3. **Setup Wizard** (`/setup-wizard`) → Nhập API keys (OpenRouter, HeyGen, ElevenLabs)
4. **Dashboard** (`/dashboard`) → Overview campaigns, stats
5. **Create Campaign** (`/dashboard/create`) → Chọn template, nhập topic
6. **Campaign Detail** (`/dashboard/campaigns/[id]`) → Xem progress, video output
7. **Campaigns List** (`/dashboard/campaigns`) → List tất cả campaigns
8. **Analytics** (`/dashboard/analytics`) → Charts, metrics
9. **Settings** (`/dashboard/settings`) → User profile, API keys, preferences
10. **System Health** (`/dashboard/system-health`) → Status AI services
11. **Affiliate Discovery** (`/affiliate-discovery`) → Search affiliates by tier
12. **Admin Panel** (`/admin`) → Manage users, features, affiliates
13. **Admin Settings** (`/admin/settings`) → Integration configs
14. **Admin Affiliates** (`/admin/affiliates`) → Manage affiliate program

Mỗi bước mô tả:

- "Bạn sẽ thấy gì trên màn hình" (layout description)
- "Bạn cần làm gì" (actions to take)
- "Sau khi bấm → chuyện gì xảy ra" (result)
- Song ngữ Việt + English

### `docs/ui-flow-diagram.md` — Sơ đồ flow

Dùng Mermaid diagrams mô tả flow:

1. User Journey Flow (Landing → Dashboard → Campaign → Results)
2. Admin Flow (Login → Admin Panel → Settings → Manage)
3. Setup Wizard Flow (Step 1 → Step 2 → Step 3 → Done)

## PHASE 2: Auto-Auth Algorithm (Full-Stack)

### Problem

Auth hiện tại là MOCK. Client muốn add account cho khách hàng → tự động login.

### Solution: Supabase Auth + Magic Link + Tier Mapping

#### 2.1 Replace Mock Auth → Supabase Auth

**File: `src/lib/auth.ts`** → Rewrite:

```typescript
import { createClient } from "@/lib/supabase/server";

export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Get tier from Polar subscription or user metadata
  const tier = user.user_metadata?.tier || "BASIC";

  return {
    id: user.id,
    email: user.email,
    tier,
    createdAt: new Date(user.created_at),
  };
}
```

#### 2.2 Admin Auto-Invite (add account → auto login)

**File: `src/app/api/admin/invite/route.ts`** → NEW:

```typescript
// POST /api/admin/invite
// Body: { email, tier }
// Action: Create user in Supabase Auth → send magic link → user clicks → auto-logged in
```

Algorithm:

1. Admin nhập email khách + chọn tier
2. API gọi `supabase.auth.admin.inviteUserByEmail(email, { data: { tier } })`
3. Supabase gửi magic link email cho khách
4. Khách click link → auto-login → redirect to `/dashboard`
5. Middleware check `supabase.auth.getUser()` → cho vào dashboard
6. Tier từ `user_metadata` → features unlocked tương ứng

#### 2.3 Update Middleware

**File: `src/middleware.ts`** → Add auth check:

```typescript
// Add after setup wizard check, before admin check:
// Dashboard requires auth
if (pathname.includes('/dashboard')) {
  const supabase = createServerClient(...)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
}
```

#### 2.4 Login Page

**File: `src/app/[locale]/login/page.tsx`** → NEW:

- Magic link login form (email only, no password)
- "Enter your email → We'll send you a login link"
- After click magic link → auto redirect to dashboard

#### 2.5 Admin Invite UI

**File: `src/app/[locale]/(admin)/admin/users/page.tsx`** → NEW:

- List current users + their tiers
- "Invite New Client" button → form (email + tier select)
- Status column (invited, active, expired)

## PHASE 3: Verify & Ship

1. Run `npx next build` in `apps/sophia-ai-factory/` — phải pass
2. Run tests — phải pass
3. Verify new docs có đầy đủ nội dung
4. Verify auth flow logic correct
5. Commit: `feat(auth): replace mock auth with Supabase Auth + auto-invite + visual docs`
6. Push to main

## QUALITY GATE

- ✅ `docs/user-guide-visual.md` — full A-Z journey, song ngữ
- ✅ `docs/ui-flow-diagram.md` — Mermaid flow diagrams
- ✅ `src/lib/auth.ts` — real Supabase Auth (not mock)
- ✅ `src/app/api/admin/invite/route.ts` — admin invite API
- ✅ `src/app/[locale]/login/page.tsx` — magic link login
- ✅ `src/app/[locale]/(admin)/admin/users/page.tsx` — user management
- ✅ `src/middleware.ts` — auth check for dashboard
- ✅ Build passes
- ✅ Committed & pushed

## RULES

- Docs phải song ngữ (Việt + English)
- Auth phải real Supabase (không mock)
- Magic link = no password needed
- Tier mapping từ Polar subscription webhook OR admin manual set
- Admin invite = add account → auto-login cho khách
- KHÔNG break existing features
