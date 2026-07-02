---
phase: 1
title: "Hero CTA Optimize"
status: pending
effort: "~10 min"
priority: P2
---

# Phase 1: Hero CTA Optimize

## Overview

Hero "Start Free" button currently goes to `/signup` which is a one-line redirect to `/login?tab=signup`. Eliminate the extra hop by pointing directly to `/login?tab=signup`.

## Requirements

- Change Hero CTA href from `/signup` to `/login?tab=signup`
- Preserve all existing query params (coupon, tier, redirect)
- No visual change — same button, same text, same style

## Related Code Files

- Modify: `src/app/components/sections/hero.tsx` (CTA Link href)

## Implementation Steps

1. Open hero.tsx, find the main CTA Link component (href="/signup")
2. Change href to `/login?tab=signup`
3. Verify params forwarding works (tab, coupon, tier, redirect)

## Success Criteria

- [ ] "Start Free" button points to `/login?tab=signup` (not `/signup`)
- [ ] Visual style unchanged
- [ ] Build passes
