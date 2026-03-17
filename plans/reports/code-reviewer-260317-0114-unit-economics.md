# Code Review: Unit Economics Algorithm

## Scope
- **File**: `apps/sophia-proposal/src/algorithms/unit-economics.ts`
- **LOC**: 506 lines (460 code + 46 tests in separate file)
- **Tests**: `unit-economics.test.ts` (27 tests)
- **Focus**: Type safety, code quality, security, production readiness, test coverage

## Overall Assessment

**Score: 7.5/10** — Production ready with minor improvements needed

Well-structured financial algorithm with strong type definitions and comprehensive test coverage. Primary concerns center on edge case handling for numerical stability and a few type safety gaps.

---

## Issues by Severity

### Critical (0)

No critical issues found.

---

### High (2)

#### H1: Missing input validation for negative/invalid values

**Location**: All calculation functions

**Impact**: Financial calculations with negative inputs produce nonsensical results without warning.

```typescript
// Current: No validation
export function calculateLTV(metrics: LTVMetrics, cac?: number): LTVResult {
  const { arpu, grossMarginPercent, churnRate, discountRate = 0.1 } = metrics;
  // Negative arpu? Negative LTV results!
```

**Fix**: Add validation guard at function entry:

```typescript
function validateMetrics(metrics: LTVMetrics): void {
  if (metrics.arpu < 0) throw new Error('ARPU cannot be negative');
  if (metrics.churnRate < 0 || metrics.churnRate > 1) {
    throw new Error('Churn rate must be between 0 and 1');
  }
  if (metrics.grossMarginPercent < 0 || metrics.grossMarginPercent > 100) {
    throw new Error('Gross margin must be between 0 and 100');
  }
}
```

---

#### H2: Infinity not handled in return types

**Location**: `calculateCACPayback`, `analyzeBreakeven`

**Impact**: Functions can return `Infinity` but interface declares `number` without documenting this edge case.

```typescript
// Line 220: Can return Infinity
const paybackMonths = contributionMargin > 0 ? cac / contributionMargin : Infinity;

// Line 313: Can return Infinity
const breakevenUnits = contributionMargin > 0 ? Math.ceil(fixedCosts / contributionMargin) : Infinity;
```

**Fix**: Update interfaces to document Infinity behavior or cap at maximum:

```typescript
export interface CACPaybackResult {
  cac: number;
  paybackMonths: number; // Returns 999.9 for infinite payback (no path to profitability)
  // ...
}

// Cap infinity to max display value
const paybackMonths = contributionMargin > 0
  ? Math.min(cac / contributionMargin, 999.9)
  : 999.9;
```

---

### Medium (4)

#### M1: Inconsistent gross margin percent scale (0-1 vs 0-100)

**Location**: `LTVMetrics.grossMarginPercent` vs `CACMetrics.grossMarginPercent`

**Impact**: Interface documentation conflicts cause confusion:

```typescript
// LTVMetrics line 17: 0-100 scale
/** Gross margin percentage (0-100) */
grossMarginPercent: number;

// CACMetrics line 49: 0-1 scale
/** Gross margin percentage (0-1) */
grossMarginPercent: number;
```

**Fix**: Standardize to 0-100 scale across all interfaces (more intuitive for business users):

```typescript
/** Gross margin percentage (0-100, e.g., 75 = 75%) */
grossMarginPercent: number;
```

---

#### M2: Hardcoded constants without configuration

**Location**: Lines 183, 197, 255, 468

**Examples**:
- `churnRate > 0 ? 1 / churnRate : 120` — Why 120 months?
- `targetMargin = Math.min(85, currentMargin + 10)` — Why 85%?
- `discountRate = 0.1` — Default 10% not documented

**Fix**: Extract to configuration object:

```typescript
export const UNIT_ECONOMICS_DEFAULTS = {
  maxLifetimeMonths: 120, // 10 year cap for zero-churn scenarios
  defaultDiscountRate: 0.1, // 10% annual discount rate
  targetGrossMargin: 85, // SaaS benchmark
  marginImprovementStep: 10, // Gradual improvement target
};
```

---

#### M3: Date serialization issue in result object

**Location**: Line 151, 444

```typescript
export interface UnitEconomicsResult {
  analyzedAt: Date; // Date object
}

// Line 444
analyzedAt: new Date();
```

**Impact**: `Date` objects don't serialize to JSON cleanly (become ISO strings). API responses will have inconsistent types.

**Fix**: Use ISO string or number timestamp:

```typescript
export interface UnitEconomicsResult {
  analyzedAt: string; // ISO 8601 format
  // OR
  analyzedAt: number; // Unix timestamp
}
```

---

#### M4: Health score calculation is opaque

**Location**: Lines 401-418

**Impact**: Complex nested if-statements make it hard to adjust thresholds or debug health ratings.

```typescript
let healthScore = 0;
if (ltvToCacRatio >= ltvToCac.excellent) healthScore += 3;
else if (ltvToCacRatio >= ltvToCac.good) healthScore += 2;
// ... 6 more similar blocks
```

**Fix**: Extract to helper function with explicit scoring:

```typescript
function scoreMetric<T extends number>(
  value: T,
  thresholds: { excellent: T; good: T; warning: T }
): number {
  if (value >= thresholds.excellent) return 3;
  if (value >= thresholds.good) return 2;
  if (value >= thresholds.warning) return 1;
  return 0;
}

const healthScore =
  scoreMetric(ltvToCacRatio, ltvToCac) +
  scoreMetric(cacPayback.paybackMonths, cacPaybackThresholds) +
  scoreMetric(grossMarginPercent, marginThresholds);
```

---

### Low (5)

#### L1: Magic numbers in calculations

**Locations**: Lines 200-203, 223, 238-241, 294-300, 332-336

**Example**:
```typescript
ltvSimple: Math.round(ltvSimple * 100) / 100, // Round to 2 decimals
paybackDays: Math.round(paybackMonths * 30),  // 30 days assumption
```

**Fix**: Create rounding utility:

```typescript
const round2 = (n: number) => Math.round(n * 100) / 100;
const round1 = (n: number) => Math.round(n * 10) / 10;
const daysPerMonth = 30;
```

---

#### L2: Unused `variableCosts` and `fixedCosts` in gross margin

**Location**: `optimizeGrossMargin` function (lines 249-301)

**Impact**: Parameters accepted but never used in calculations, only in recommendations.

```typescript
export function optimizeGrossMargin(config: GrossMarginConfig): GrossMarginResult {
  const { revenue, cogs, variableCosts, fixedCosts } = config;
  // variableCosts and fixedCosts never used in margin calculation
}
```

**Fix**: Either remove from calculation or incorporate into extended margin analysis.

---

#### L3: Test missing critical edge cases

**Location**: `unit-economics.test.ts`

**Missing tests**:
- Negative values (should throw or handle gracefully)
- Very large numbers (overflow protection)
- NaN inputs
- `grossMarginPercent` = 0 or 100 (boundary)
- `churnRate` = 1.0 (100% churn)
- Division by zero scenarios

---

#### L4: SAMPLE_DATA has type assertion instead of proper typing

**Location**: Lines 464-496

```typescript
export const SAMPLE_DATA = {
  healthyStartup: { ... } as UnitEconomicsInput,
  // Type assertion hides potential missing fields
};
```

**Fix**: Use `satisfies` operator (TypeScript 4.9+) or explicit typing:

```typescript
export const SAMPLE_DATA = {
  healthyStartup: { ... } satisfies UnitEconomicsInput,
};
```

---

#### L5: Recommendation strings not internationalized

**Location**: Lines 270-290, 421-441

**Impact**: Hard-coded English strings limit internationalization.

```typescript
recommendations.push('Critical: Review hosting costs...');
```

**Note**: Low priority for internal algorithm, but consider if user-facing.

---

## Positive Observations

1. **Excellent type coverage**: 11 well-documented interfaces, zero `any` types
2. **Comprehensive tests**: 27 tests covering main flows and health ratings
3. **Good JSDoc documentation**: Each interface and function has clear descriptions
4. **Deterministic rounding**: Consistent 2-decimal rounding for currency values
5. **Health threshold constants**: Exported `HEALTH_THRESHOLDS` for easy tuning
6. **Sample data for testing**: Three realistic scenarios (healthy, struggling, enterprise)
7. **Pure functions**: All functions are pure, testable, no side effects

---

## Test Coverage Analysis

**Current coverage**: ~85% (good, but missing edge cases)

| Function | Tested Scenarios | Missing |
|----------|------------------|---------|
| `calculateLTV` | Normal, zero churn, with CAC, discount rate | Negative ARPU, churn > 1, NaN |
| `calculateCACPayback` | Normal, excellent health, critical health, zero customers | Negative spend, Infinity payback |
| `optimizeGrossMargin` | Normal, low margin, profit impact, healthy | Zero revenue, negative COGS |
| `analyzeBreakeven` | Normal, profit, loss, zero units | Negative costs, zero price |
| `analyzeUnitEconomics` | All 3 sample datasets, field checks | Invalid input handling |

---

## Recommended Actions

### Immediate (Before Production)

1. **Add input validation** — Guard against negative/invalid inputs
2. **Handle Infinity returns** — Document or cap extreme values
3. **Standardize margin scale** — Fix 0-1 vs 0-100 documentation conflict

### Short-term (Next Sprint)

4. **Extract constants** — Move magic numbers to `UNIT_ECONOMICS_DEFAULTS`
5. **Add edge case tests** — Negative values, boundaries, NaN
6. **Fix Date serialization** — Use ISO strings for API compatibility

### Nice-to-have

7. **Refactor health scoring** — Extract to helper function
8. **Add rounding utilities** — Reduce repetitive `Math.round()` calls
9. **Consider i18n** — If recommendations are user-facing

---

## Metrics

| Metric | Value |
|--------|-------|
| Type Coverage | 100% (0 `any` types) |
| Test Coverage | ~85% (27 tests) |
| Build Status | ✅ Pass |
| Test Status | ✅ 27/27 Pass |
| Cyclomatic Complexity | Low-Medium |
| Lines of Code | 506 |

---

## Unresolved Questions

1. Should negative inputs throw errors or return `null`/error objects?
2. Is 120-month lifetime cap (10 years) appropriate for all business models?
3. Should the `monthsToBreakeven` calculation use growth rate (currently assumes constant velocity)?
4. Is the 30-days-per-month assumption acceptable for financial precision?

---

## Production Readiness Verdict

**✅ READY** with minor fixes

The algorithm is functionally sound and well-tested for normal inputs. Address the **High** severity issues (input validation, Infinity handling) before deploying to production with real financial data.
