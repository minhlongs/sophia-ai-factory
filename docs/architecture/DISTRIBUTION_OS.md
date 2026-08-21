# He Thong Phan Phoi / Distribution OS

> Sophia 2027 — Phan phoi noi dung da nen tang, mot noi dung goc → nhieu phien ban cho tung platform.
> Sophia 2027 — Multi-platform distribution: one core story into platform-specific derivatives.

**Source of Truth:** `src/seed/types/creative-domain.ts` lines 272-306 + `src/tree/publishing/`
**Related:** [PROVENANCE.md](./PROVENANCE.md), [AGENT_PROTOCOL.md](./AGENT_PROTOCOL.md)

---

## 1. Muc dich / Purpose

Mot video goc (core story) can duoc phan phoi len nhieu platform: YouTube, TikTok, Instagram, X (Twitter), Bluesky, Reddit, Threads. Moi platform co quy dinh rieng: do dai video, kich thuoc anh, tags, privacy, thoi gian publish. Sophia can dong thoi quan ly tat ca phien ban tren tat ca platform.

**Problem:** One core story needs to be distributed across multiple platforms — YouTube, TikTok, Instagram, X (Twitter), Bluesky, Reddit, Threads. Each platform has its own rules: video length, image size, tags, privacy, publish time. Sophia needs to manage all variants across all platforms simultaneously.

---

## 2. Nguyen Tac Cot Loi / Core Principle

```
MOT NOI DUNG GOC (Core Story)
    |
    +-- YouTube: video day du, mo ta dai, tags SEO
    +-- TikTok: phien ban 60s, hook manh, trending audio
    +-- Instagram: Reels 90s, caption ngan, hashtags
    +-- X (Twitter): clip 30s, tweet ngan gon
    +-- Bluesky: text post + link
    +-- Reddit: bai viet van ban + video
    +-- Threads: caption ngan + link
```

**Nguyen tac:** MOT NOI DUNG GOC → CAC PHIEN BAN PHU THUOC CHO TUNG PLATFORM.

**Principle:** ONE CORE STORY → PLATFORM-SPECIFIC DERIVATIVES.

---

## 3. Cac Loai Chinh / Core Types

### 3.1 DistributionPlan — Ke Hoach Phan Phoi

`src/seed/types/creative-domain.ts` lines 272-281:

```typescript
interface DistributionPlan {
  id: string;
  projectId: string;
  workspaceId: string;
  channels: ChannelConfig[];
  scheduleAt?: number;       // thoi gian len lich (epoch ms)
  status: 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed';
  createdAt: number;
  updatedAt: number;
}
```

Moi `DistributionPlan` la mot ke hoach phan phoi cho mot project. No chua danh sach cac `ChannelConfig` — moi channel la mot platform khac nhau.

### 3.2 ChannelConfig — Cau Hinh Channel

`src/seed/types/creative-domain.ts` lines 283-291:

```typescript
interface ChannelConfig {
  channel: string;           // 'youtube' | 'tiktok' | 'x' | ...
  assetId: string;           // asset goc can phan phoi
  title?: string;            // tieu de tuy chinh cho platform
  description?: string;      // mo ta tuy chinh
  tags?: string[];
  publishAt?: number;        // thoi gian publish tuy chinh
  settings: Record<string, unknown>;  // platform-specific settings
}
```

### 3.3 DistributionAsset — Phien Ban Tren Platform

`src/seed/types/creative-domain.ts` lines 293-306:

```typescript
interface DistributionAsset {
  id: string;
  workspaceId: string;
  planId: string;
  assetId: string;
  channel: string;
  platformPostId?: string;   // ID cua bai viet tren platform
  status: 'draft' | 'scheduled' | 'posting' | 'posted' | 'failed';
  scheduledAt: number;
  postedAt?: number;
  analytics: Record<string, unknown>;
  error?: string;
  createdAt: number;
}
```

---

## 4. Platform Adapters / Bo Chuyen Doi Platform

Sophia su dung `PlatformAdapter` interface de truu tuong hoa viec upload len tung platform. Moi platform co adapter rieng.

### 4.1 PlatformAdapter Interface

`src/tree/publishing/platform-adapter.ts`:

```typescript
interface PlatformAdapter {
  platform: Platform;     // 'youtube' | 'tiktok' | 'instagram'
  uploadVideo(accessToken: string, params: PublishParams): Promise<PublishResult>;
  checkStatus(accessToken: string, platformVideoId: string): Promise<{ status: PublishStatus; error?: string }>;
  refreshToken(clientId: string, clientSecret: string, refreshToken: string): Promise<{ accessToken: string; expiresIn: number }>;
}
```

### 4.2 Cac Adapter Da Implement

| Platform | File | Status | API |
|----------|------|--------|-----|
| **YouTube** | `src/tree/publishing/youtube-adapter.ts` | Implement | YouTube Data API v3, resumable upload |
| **TikTok** | `src/tree/publishing/tiktok-adapter.ts` | Implement | TikTok Content Posting API v2 |
| **Instagram** | `src/tree/publishing/instagram-adapter.ts` | Implement | Instagram Graph API v19.0 (Reels) |
| **X (Twitter)** | `src/tree/publishing/twitter-oauth-client.ts` | Implement | X API v2 OAuth 2.0 PKCE |
| **Bluesky** | `src/tree/publishing/bluesky.ts` | Implement | AT Protocol (app-password flow) |
| **Reddit** | `src/tree/publishing/reddit-oauth-client.ts` | Implement | Reddit OAuth 2.0 |
| **Threads** | `src/tree/publishing/threads-oauth-client.ts` | Implement | Threads API |

### 4.3 Token Refresh Service

`src/tree/publishing/token-refresh-service.ts` — Tu dong lam moi token het han:

| Function | Mo ta |
|----------|-------|
| `getAdapter(platform)` | Lay adapter theo platform |
| `refreshExpiredTokensForUser(userId)` | Lam moi tat ca token het han cua user |

### 4.4 Circuit Breaker

Moi adapter su dung circuit breaker (`@/seed/security/circuit-breaker`) de:
- `shouldAllowRequest('youtube')` — kiem tra co duoc phep goi API khong
- `recordFailure('youtube', kind)` — ghi nhan loi
- `recordSuccess('youtube')` — ghi nhan thanh cong

Xac thong qua `classifyError()` tu `@/seed/types/failure-kind` — phan loai loi (AUTH_FAILURE, RATE_LIMIT, SERVER_ERROR, etc.).

---

## 5. Luu Chay Phan Phoi / Distribution Flow

```
ContentAsset (noi dung goc)
    |
    v
DistributionPlan (ke hoach: chon channel, dat lich)
    |
    v
ChannelConfig[] (cau hinh moi platform)
    |
    v
DistributionAsset[] (moi platform = 1 DistributionAsset)
    |
    v
PlatformAdapter.uploadVideo() (upload len platform)
    |
    v
DistributionAsset.status = 'posted' (da publish)
    |
    v
PerformanceEvent (nhan metrics tu platform)
    |
    v
ProvenanceRecord (ghi nhan: action='published')
```

### 5.1 Trang Thai DistributionAsset

| Status | Mo ta |
|--------|-------|
| `draft` | Chua len lich |
| `scheduled` | Da len lich, cho thoi gian publish |
| `posting` | Dang upload len platform |
| `posted` | Da thanh cong |
| `failed` | That bai (xem `error` field) |

### 5.2 Trang Thai DistributionPlan

| Status | Mo ta |
|--------|-------|
| `draft` | Chua len lich |
| `scheduled` | Da len lich |
| `publishing` | Dang thuc thi |
| `published` | Da publish het |
| `failed` | That bai |

---

## 6. OAuth & Credentials / Xac Thuc Platform

Moi platform can OAuth token de upload. Sophia quan ly credentials qua:

| File | Mo ta |
|------|-------|
| `src/tree/publishing/credential-manager.ts` | Luu tru va lay credentials (ma hoa) |
| `src/tree/publishing/token-refresh-service.ts` | Lam moi token het han |
| `src/tree/publishing/twitter-oauth-client.ts` | OAuth 2.0 PKCE cho X |
| `src/tree/publishing/reddit-oauth-client.ts` | OAuth 2.0 cho Reddit |
| `src/tree/publishing/threads-oauth-client.ts` | OAuth cho Threads |

**Luu y theo No-Tech Doctrine:** Tat ca OAuth credentials do KHACH HANG tu nhap qua Setup Wizard. Sophia khong tich hop credentials tu phia operator.

---

## 7. Phan Biet voi Legacy / vs Legacy Publishing

`src/forest/publishing/` chua cac adapter cu (duoc danh dau deprecated). `src/tree/publishing/` la implementation hien tai:

| Legacy (`forest/publishing/`) | Hien tai (`tree/publishing/`) |
|------------------------------|------------------------------|
| `youtube-publisher.ts` | `youtube-adapter.ts` |
| `reddit.ts` | `reddit-oauth-client.ts` |
| `instagram-adapter.ts` | `instagram-adapter.ts` |
| `twitter-publisher.ts` | `twitter-oauth-client.ts` |
| `bluesky.ts` | `bluesky.ts` |
| `token-crypto.ts` | `credential-manager.ts` |

**Nguyen tac:** Su dung adapter tu `tree/publishing/`. Khong import tu `forest/publishing/` cho moi tinh nang.

---

## 8. Lien Ket Voi He Thong Khac

### Distribution + Provenance

Khi mot DistributionAsset da publish thanh cong, mot ProvenanceRecord duoc tao voi:
- `action: 'published'`
- `actorType: 'system'`
- `metadata`: chua `platformPostId`, `channel`, `analytics`

Xem [PROVENANCE.md](./PROVENANCE.md) de biet chi tiet.

### Distribution + Agent Protocol

Agent co the thuc thi distribution nhu mot `AgentAction`:
- `tool: 'youtube_upload'` hoac `'tiktok_upload'`
- `parameters`: `{ title, description, tags, videoUrl }`
- `estimatedCostCents`: phi API platform (neu co)
- `approvalRequired`: true neu Level 2, false neu Level 3+

Xem [AGENT_PROTOCOL.md](./AGENT_PROTOCOL.md) de biet chi tiet.

### Distribution + Performance

Sau khi publish, PerformanceEvent duoc ghi nhan voi metrics tu platform:
- `channel`: 'youtube', 'tiktok', etc.
- `eventType`: 'impression', 'view', 'click', 'like', etc.
- `count`, `valueCents`

---

## 9. Reference Implementation

| File | Layer | Mo ta |
|------|-------|-------|
| `src/seed/types/creative-domain.ts:272-306` | seed | DistributionPlan, ChannelConfig, DistributionAsset |
| `src/tree/publishing/platform-adapter.ts` | tree | PlatformAdapter interface |
| `src/tree/publishing/youtube-adapter.ts` | tree | YouTube upload + status check + token refresh |
| `src/tree/publishing/tiktok-adapter.ts` | tree | TikTok upload + status check + token refresh |
| `src/tree/publishing/instagram-adapter.ts` | tree | Instagram Reels upload + status check |
| `src/tree/publishing/twitter-oauth-client.ts` | tree | X OAuth 2.0 PKCE |
| `src/tree/publishing/bluesky.ts` | tree | Bluesky AT Protocol |
| `src/tree/publishing/reddit-oauth-client.ts` | tree | Reddit OAuth |
| `src/tree/publishing/threads-oauth-client.ts` | tree | Threads OAuth |
| `src/tree/publishing/credential-manager.ts` | tree | Credential storage (encrypted) |
| `src/tree/publishing/token-refresh-service.ts` | tree | Token refresh service |
| `src/tree/publishing/index.ts` | tree | Barrel exports |
