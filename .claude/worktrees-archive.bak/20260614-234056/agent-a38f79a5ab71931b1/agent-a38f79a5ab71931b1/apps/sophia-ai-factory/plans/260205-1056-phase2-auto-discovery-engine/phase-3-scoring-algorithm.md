# Phase 3: Intelligence Engine (Scoring)
**Status:** Pending
**Priority:** High

## Overview
Implement the "Sophia Potential Score" (SPS) algorithm to rank products across different networks on a standardized 0-100 scale. This is critical for the "Top 50" feature.

## Algorithm Logic (from Research)
$$SPS = (w_1 \cdot N_{comm}) + (w_2 \cdot N_{pop}) + (w_3 \cdot N_{rel})$$

### Normalization
- **Popularity (Gravity/PowerRank):**
    - ClickBank Gravity (0-500+): `Log(Gravity) / Log(Max_Gravity) * 100`
    - ShareASale PowerRank (1-100): `(100 - Rank + 1)`
- **Commission:**
    - Normalize to $ value per sale. Cap at $200 for 100 points.

### "Hidden Gem" Logic
- If `Popularity` is Low (< 30) BUT `Velocity` (Change over 7 days) is High (> 20%), Apply 1.5x Multiplier to SPS.

## Implementation Steps
1.  [ ] Create `src/lib/intelligence/scoring.ts`.
2.  [ ] Implement normalization functions for each network.
3.  [ ] Implement `calculateSPS(product)` function.
4.  [ ] Create a batch job `src/app/api/cron/recalc-scores/route.ts`.
    - Fetches all active products.
    - Calculates new scores.
    - Updates DB.
5.  [ ] Implement "Top 50" tagging logic (set `is_top_pick = true` for top 50 by SPS).

## Todo List
- [ ] Scoring utility functions.
- [ ] Batch update script.
- [ ] Unit tests for scoring logic (verify math).

## Success Criteria
- [ ] Scores are calculated and stored in DB.
- [ ] Sorting by `sps_score` yields high-quality, high-commission, reliable products.
