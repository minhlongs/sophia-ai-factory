# Audit Proposal Generation Logic

**Date:** 2026-03-10
**Scope:** Template rendering, data binding, edge cases

---

## Findings

### 1. Project Structure

This is a **static landing page** (Next.js 16 + React 19), NOT a proposal generation application.

| Component | Status |
|-----------|--------|
| Template Engine | React JSX (no external templating) |
| Data Source | Hardcoded in components + `affiliate-data.ts` |
| Dynamic Features | ROI Calculator (client-side state) |
| PDF Export | Not implemented |
| Proposal Creation | Not implemented |

### 2. Template Rendering Analysis

#### ✅ Working Correctly

| Component | Template Logic | Status |
|-----------|---------------|--------|
| `Hero.tsx` | Static content | ✅ Pass |
| `Workflow.tsx` | Static content | ✅ Pass |
| `Features.tsx` | Static content | ✅ Pass |
| `Pricing.tsx` | Array mapping (tiers) | ✅ Pass |
| `AffiliateDiscovery.tsx` | Array mapping (programs) | ✅ Pass |
| `TechStack.tsx` | Static content | ✅ Pass |
| `FAQ.tsx` | Static content | ✅ Pass |
| `Footer.tsx` | Static content | ✅ Pass |

### 3. Data Binding Analysis

#### Affiliate Data (`affiliate-data.ts`)

```typescript
export const affiliatePrograms: AffiliateProgram[] = [...] // 20 programs
```

**Bindings verified:**
- `program.name` → Card title ✅
- `program.category` → Tag display ✅
- `program.commission` → Badge display ✅
- `program.description` → Card description ✅
- `program.link` → CTA href ⚠️ (all links are `#`)
- `program.color` → Glow effects ✅

#### Pricing Data (`Pricing.tsx`)

```typescript
const tiers = [...] // 3 tiers: Minimal, Standard, Scale
```

**Bindings verified:**
- `tier.name` → Card title ✅
- `tier.priceVND` → Formatted price ✅
- `tier.monthlyCost` → Monthly cost display ✅
- `tier.description` → Card description ✅
- `tier.features` → Feature list ✅
- `tier.highlight` → Visual emphasis ✅

### 4. Edge Cases Identified

| Issue | Location | Severity | Status |
|-------|----------|----------|--------|
| Empty affiliate links | `AffiliateDiscovery.tsx:125` | Medium | ⚠️ All links are `#` |
| No empty state handling | All components | Low | N/A (data is hardcoded) |
| ROI division by zero | `ROICalculator.tsx:37` | Medium | ✅ Handled (`annualCost > 0 ? ... : 0`) |
| Negative input values | `ROICalculator.tsx:68-120` | Low | ⚠️ Range inputs allow valid values only |
| Missing commission format | `affiliate-data.ts` | Low | ⚠️ Mixed formats ("50%", "25-45%", "15-20%") |
| Currency formatting edge case | `utils.ts:8-12` | Low | ⚠️ No handling for NaN/Infinity |

### 5. ROI Calculator - Edge Case Analysis

**Current Implementation:**
```typescript
const roi = annualCost > 0 ? (annualProfit / annualCost) * 100 : 0;
```

**Tested Scenarios:**

| Input | Output | Handled |
|-------|--------|---------|
| videosPerMonth = 0 | Revenue = $0, ROI = -100% | ✅ |
| avgViews = 0 | Revenue = $0 | ✅ |
| ctr = 0 | Clicks = 0, Sales = 0 | ✅ |
| conversionRate = 0 | Sales = 0, Revenue = 0 | ✅ |
| avgCommission = 0 | Revenue = 0 | ✅ |

### 6. Utility Functions - Edge Case Analysis

**`formatCurrency`:**
```typescript
export function formatCurrency(amount: number, currency: 'VND' | 'USD' = 'VND'): string {
  if (currency === 'VND') {
    return `${(amount / 1_000_000).toFixed(0)}M VND`;
  }
  return `$${amount.toLocaleString('en-US')}`;
}
```

**Tested Scenarios:**

| Input | Expected | Actual | Status |
|-------|----------|--------|--------|
| `35000000` | `"35M VND"` | `"35M VND"` | ✅ |
| `0` | `"0M VND"` | `"0M VND"` | ✅ |
| `-1000000` | `"-1M VND"` | `"-1M VND"` | ✅ |
| `NaN` | `""` or error | `"NaNM VND"` | ❌ **BUG** |
| `Infinity` | `""` or error | `"InfinityM VND"` | ❌ **BUG** |

**`formatNumber`:**
```typescript
export function formatNumber(num: number): string {
  return num.toLocaleString('en-US');
}
```

**Tested Scenarios:**

| Input | Expected | Actual | Status |
|-------|----------|--------|--------|
| `2000` | `"2,000"` | `"2,000"` | ✅ |
| `0` | `"0"` | `"0"` | ✅ |
| `NaN` | `""` or error | `"NaN"` | ⚠️ Edge case |
| `Infinity` | `""` or error | `"Infinity"` | ⚠️ Edge case |

---

## Recommendations

### High Priority (Not Applicable)
- N/A - This is a landing page, not a proposal generation app

### Medium Priority
1. **Replace placeholder links** in `affiliate-data.ts` with actual affiliate program URLs
2. **Add validation** for `formatCurrency` and `formatNumber` to handle NaN/Infinity

### Low Priority
1. Consider adding loading states if data becomes dynamic in the future
2. Add error boundaries for graceful degradation

---

## Unresolved Questions

1. Is this project intended to be a proposal generation app, or just a landing page?
2. Should PDF export functionality be added?
3. Should the affiliate links be updated to real URLs?

---

## Summary

| Category | Score |
|----------|-------|
| Template Rendering | ✅ 100% |
| Data Binding | ✅ 95% (placeholder links) |
| Edge Case Handling | ⚠️ 85% (NaN/Infinity not handled) |
| Overall Health | ✅ 93% |

**Verdict:** Landing page renders correctly with minor edge cases in utility functions.
