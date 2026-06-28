---
phase: 2
title: "Page Layout + Tab Navigation"
status: pending
priority: high
---

# Phase 02 — Page Layout + Tab Navigation

## Context

- Dashboard layout at `src/app/[locale]/dashboard/layout.tsx` (509 lines — sidebar nav)
- Need to add "Creative Studio" link to sidebar
- Tab component pattern: URL search params for tab state (SSR-friendly)

## Files to Create

1. `src/app/[locale]/dashboard/creative-studio/page.tsx` — RSC page (auth + tier fetch, renders shell)
2. `src/app/[locale]/dashboard/creative-studio/loading.tsx` — Skeleton loader
3. `src/app/[locale]/dashboard/creative-studio/error.tsx` — Error boundary
4. `src/app/[locale]/dashboard/creative-studio/creative-studio-tabs.tsx` — Client component: tab bar + content switching

## Files to Modify

1. `src/app/[locale]/dashboard/layout.tsx` — Add sidebar link (1 link block, ~6 lines)

## Architecture

```
page.tsx (RSC)
  ├── getCurrentUser() -> auth guard
  ├── getUserTier() -> tier for gating
  └── <CreativeStudioTabs tier={tier} />
        ├── Tab: Video Creator     -> lazy import VideoCreatorTab
        ├── Tab: Image Generator   -> lazy import ImageGeneratorTab
        ├── Tab: Audio Studio      -> lazy import AudioStudioTab
        ├── Tab: Template Library  -> lazy import TemplateLibraryTab
        └── Tab: Brand Assets      -> lazy import BrandAssetsTab
```

## Implementation Steps

### 1. `page.tsx` (Server Component)

```tsx
import { getCurrentUser } from '@/seed/auth/better-auth-session'
import { getUserTier } from '@/seed/db/get-user-tier'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { CreativeStudioTabs } from './creative-studio-tabs'

export default async function CreativeStudioPage({ params, searchParams }) {
  const { locale } = await params
  const sp = await searchParams
  const user = await getCurrentUser()
  if (!user) redirect(`/${locale}/auth/signup`)
  const tier = await getUserTier(user.id)
  const t = await getTranslations({ locale, namespace: 'creativeStudio' })
  const activeTab = sp?.tab ?? 'video'

  return (
    <div>
      <h1>{t('title')}</h1>
      <p>{t('subtitle')}</p>
      <CreativeStudioTabs tier={tier} activeTab={activeTab} />
    </div>
  )
}
```

### 2. `creative-studio-tabs.tsx` (Client Component)

```tsx
'use client'
- Props: { tier: Tier, activeTab: string }
- 5 tabs: video, image, audio, templates, brand
- URL push via useRouter + useSearchParams (no full reload)
- Icons: Video, Image, Mic, LayoutTemplate, Palette (from lucide-react)
- Each tab content = lazy() loaded component (code-split)
- Tab disabled state based on tier (visual indicator for locked features)
```

### 3. Sidebar Link Addition

Add to `layout.tsx` nav, after the "New Project" link:

```tsx
<Link href="/dashboard/creative-studio" className="...">
  <Sparkles className="w-5 h-5" />
  <span>{t('sidebar.creative_studio')}</span>
</Link>
```

Import `Sparkles` from lucide-react. Add i18n key `sidebar.creative_studio`.

### 4. Loading + Error States

Standard patterns matching existing dashboard pages:
- `loading.tsx`: skeleton with tab bar placeholder + content area shimmer
- `error.tsx`: error boundary with retry button

## File Ownership

| File | Owner |
|------|-------|
| `creative-studio/page.tsx` | Phase 2 |
| `creative-studio/creative-studio-tabs.tsx` | Phase 2 |
| `creative-studio/loading.tsx` | Phase 2 |
| `creative-studio/error.tsx` | Phase 2 |
| `dashboard/layout.tsx` | Phase 2 (sidebar link only) |

## Todo

- [ ] Create `page.tsx` with auth guard + tier fetch
- [ ] Create `creative-studio-tabs.tsx` with 5 tabs
- [ ] Create `loading.tsx` skeleton
- [ ] Create `error.tsx` boundary
- [ ] Add sidebar link to `layout.tsx` (import Sparkles, add Link block)
- [ ] Add `sidebar.creative_studio` i18n key (en + vi)

## Success Criteria

- [ ] `/dashboard/creative-studio` renders tab shell
- [ ] Tab switching via URL params works without full reload
- [ ] Sidebar shows "Creative Studio" link with icon
- [ ] Unauthenticated users redirect to signup
- [ ] Loading state displays skeleton
- [ ] Each file < 200 lines
