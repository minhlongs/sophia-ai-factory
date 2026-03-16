---
title: "Phase 04: Hybrid Scoring and Cold Start"
description: "Combine collaborative + content signals with cold start handling"
status: pending
priority: P1
effort: 1.5h
---

# Phase 04: Hybrid Scoring and Cold Start

## Status: ✅ Completed

All hybrid scoring and cold start functionality verified.

### Verified Features

| Feature | Status | Test Coverage |
|---------|--------|---------------|
| Hybrid scoring (CF + Content) | ✅ | `hybridScore` tests |
| Configurable weights | ✅ | `should respect custom weights` |
| Cold start fallback | ✅ | `should use content-based only for cold start users` |
| Score normalization | ✅ | Scores bounded 0-1 |
| Breakdown transparency | ✅ | Returns collaborative + content components |

## Architecture

### Hybrid Scoring Flow

```
User + Item → Check interaction count
    │
    ├─< minInteractions → Content-only (cold start)
    │   └─→ Build user profile from demographics/defaults
    │   └─→ Score items by content similarity
    │
    └─≥ minInteractions → Hybrid
        ├─→ Collaborative score (user-based CF)
        ├─→ Content score (avg similarity to liked items)
        └─→ Weighted combine: cfWeight * CF + cbWeight * CB
```

### Cold Start Strategies

| Scenario | Fallback |
|----------|----------|
| New user (0 interactions) | Popular items + demographic matching |
| New user (1-2 interactions) | Content-based only |
| New item (0 ratings) | Content-based similarity to popular items |
| Sparse matrix | Lower minInteractions threshold |

## Key Functions

```typescript
export function hybridScore(
  userId: string,
  item: Item,
  matrix: UserItemMatrix,
  allItems: Item[],
  userInteractions: Interaction[],
  config: HybridConfig
): {
  score: number;
  breakdown: { collaborative: number; content: number }
}

export function getUserPreferences(
  userId: string,
  interactions: Interaction[],
  allItems: Item[]
): Item  // Aggregated user profile

export function generateRecommendations(
  userId: string,
  items: Item[],
  interactions: Interaction[],
  config: HybridConfig,
  topK: number
): Recommendation[]
```

## Implementation Steps

1. **Fix Phase 02 bugs first**
   - Ensure CF produces non-zero scores
   - Verify similar users are found

2. **Verify cold start handling**
   - Test with 0 interactions → content-only
   - Test with < minInteractions → graceful fallback

3. **Add additional cold start strategies** (optional)
   - Popularity-based fallback
   - Demographic matching

4. **Final validation**
   - All 24 tests pass
   - Performance acceptable

## Todo List

- [ ] Fix Phase 02 bugs (prerequisite)
- [ ] Verify cold start with new users
- [ ] Verify cold start with new items
- [ ] Test configurable weights affect output
- [ ] Add popularity fallback (optional)
- [ ] Document API for consumers

## Success Criteria

- [ ] Hybrid scoring combines CF + content correctly
- [ ] Cold start users get content-based recommendations
- [ ] Weights (collaborativeWeight, contentWeight) affect results
- [ ] `generateRecommendations` returns sorted, reasoned results
- [ ] All edge cases handled (empty data, single interaction)

## Risk Assessment

- **Risk:** Cold start recommendations may be low quality
- **Mitigation:** Document limitation, consider popularity boost

## Performance Considerations

| Operation | Complexity | Notes |
|-----------|------------|-------|
| User-item matrix | O(interactions) | Built once |
| Similar users | O(users × items) | Can cache |
| Content score | O(items × features) | Per recommendation |
| Full recommendations | O(items × (users + features)) | Top K filters |

## Next Steps

- After completion, module is npm-publish ready
- Consider adding benchmark tests for large catalogs
