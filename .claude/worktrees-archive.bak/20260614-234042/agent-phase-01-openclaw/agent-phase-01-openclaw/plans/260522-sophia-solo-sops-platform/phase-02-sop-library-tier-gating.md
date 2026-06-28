# Phase 02: SOP Library + Tier Gating UI

**Status:** Complete (build passes, tsc clean, i18n synced)
**Priority:** P0
**Depends on:** Phase 01 (core engine — done)

---

## Discovery: Existing SOP System

The codebase already has a **mature SOP system** in `lib/sop/`:
- 31 official playbooks across 7 categories (content, leads, email, sales, social, analytics, crisis)
- Full executor with playbook parser + YAML agents
- Complete UI: marketplace grid, cards, filters, install modal, config form, run timeline
- Pages: `/dashboard/sops` (installed list), `/dashboard/sop-marketplace` (browse), `/dashboard/sops/[id]` (detail)

**Phase 2 scope (revised):** Add 5 MMO/creator economy playbooks + tier-gate the SOP install limit.

## Tasks

### Task A: Add 5 MMO/Creator Economy Playbooks (new seed files)

Create in `src/lib/sop/seeds/playbooks/content/`:
1. `faceless-youtube-cash-cow.ts` — 8-step: niche research → script → TTS → visuals → compose → thumbnail → upload → SEO
2. `tiktok-creativity-program.ts` — 6-step: trending topics → short script → AI avatar → captions → upload → analytics
3. `youtube-shorts-monetization.ts` — 6-step: viral topics → 60s script → vertical video → hook+CTA → upload Short → cross-post

Create in `src/lib/sop/seeds/playbooks/sales/` (business category → use 'sales'):
4. `ugc-creator-agency.ts` — 10-step: packages → portfolio → intake form → DM outreach → onboard → script → generate UGC → review → deliver → invoice
5. `ai-avatar-video-agency.ts` — 10-step: tiers → demo reel → agency site → outreach → onboard → script → AI avatar → editing → approval → retainer

Register all 5 in `src/lib/sop/seeds/index.ts`.

### Task B: Add SOP Tier Limits to UnifiedTierLimits

Add `sopInstallLimit` field to `UnifiedTierLimits` interface + each tier config:
- BASIC: 5 SOPs
- PREMIUM: 15 SOPs
- ENTERPRISE: unlimited (999)
- MASTER: unlimited (999)

### Task C: Tier Gating in SOP Card + Marketplace

1. **SopCard**: Show lock icon + "Upgrade" CTA when user has hit install limit
2. **SopGrid**: Pass `userTier` + `installCount` to enable/disable install button
3. **Marketplace page**: Fetch user tier + install count, pass to grid

## Files to Modify

| File | Change |
|------|--------|
| `lib/sop/seeds/playbooks/content/faceless-youtube-cash-cow.ts` | NEW |
| `lib/sop/seeds/playbooks/content/tiktok-creativity-program.ts` | NEW |
| `lib/sop/seeds/playbooks/content/youtube-shorts-monetization.ts` | NEW |
| `lib/sop/seeds/playbooks/sales/ugc-creator-agency.ts` | NEW |
| `lib/sop/seeds/playbooks/sales/ai-avatar-video-agency.ts` | NEW |
| `lib/sop/seeds/index.ts` | Add 5 imports + register |
| `seed/config/tiers/unified-limits.ts` | Add `sopInstallLimit` field |
| `forest/components/sop/sop-card.tsx` | Add tier gate UI |
| `forest/components/sop/sop-grid.tsx` | Pass tier props |
| `app/[locale]/dashboard/sop-marketplace/page.tsx` | Fetch tier + count |

## Success Criteria
- [ ] 5 new MMO playbooks in seed registry (31 → 36 total)
- [ ] `sopInstallLimit` in all tier configs
- [ ] SOP card shows lock when at limit
- [ ] Marketplace page passes tier data to grid
- [ ] `npm run build` passes
- [ ] tsc clean
