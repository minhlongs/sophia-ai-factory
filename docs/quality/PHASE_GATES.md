# Phase Gates — Quality Gates Theo Từng Phase

> **Last updated:** 2026-08-20
> **Principle:** Mỗi phase phải vượt qua TẤT CẢ gates trước khi chuyển phase tiếp theo. Không có ngoại lệ.
> Each phase must pass ALL gates before moving to the next. No exceptions.

---

## Gate List — Danh Sach Gates

### G1: TypeScript Compilation
- **Condition:** `npm run build` passes với 0 errors
- **Check:** Không có new TypeScript errors so với baseline
- **Auto-fail:** Any `error TS*` in build output

### G2: Lint + ESLint Suppression Freeze
- **Condition:** `npm run lint` passes, suppression count ≤ baseline
- **Check:** Không có new `eslint-disable` comments. Suppression count chỉ được giảm.
- **Auto-fail:** New `eslint-disable` comment không có tracked issue URL

### G3: Test Suite
- **Condition:** `npm test` passes all tests
- **Check:** 0 failing tests. Coverage ≥ threshold cho phase hiện tại.
- **Auto-fail:** Any test failure, including flaky tests

### G4: Build + Deploy
- **Condition:** Production build succeeds + deploy preview works
- **Check:** No build errors, no runtime errors in preview environment
- **Auto-fail:** Deployment failure hoặc runtime crash

### G5: Secret Leakage Prevention
- **Condition:** No hardcoded secrets, API keys, or credentials in codebase
- **Check:** `grep` for common secret patterns. .env.example matches actual usage.
- **Auto-fail:** Any API key, password, token, or credential in source code

### G6: Production Routes Integrity
- **Condition:** All existing production routes still functional
- **Check:** No broken API endpoints, no missing required fields, no changed response shapes
- **Auto-fail:** Any route returns unexpected status code hoặc empty response

### G7: Database Migration Safety
- **Condition:** All DB migrations are reversible + tested
- **Check:** Rollback script exists và đã được test. Migration không drops columns được used.
- **Auto-fail:** Irreversible migration, missing rollback, hoặc dropped column still referenced

### G8: Canonical Domain Concepts
- **Condition:** No duplicate domain concepts across modules
- **Check:** Mỗi domain concept (User, Mission, Content, etc.) có 1 canonical definition
- **Auto-fail:** Same concept defined in 2+ places với different shapes

### G9: Documentation Matches Implementation
- **Condition:** Docs accurately reflect current code behavior
- **Check:** Function signatures, API endpoints, config keys trong docs match codebase
- **Auto-fail:** Documented API endpoint không tồn tại, hoặc code behavior differs from docs

### G10: Migration Reversibility
- **Condition:** Every migration (DB, schema, API) has a tested rollback
- **Check:** Rollback script exists, tested in CI, và preserves data integrity
- **Auto-fail:** Missing rollback script hoặc rollback fails tests

### G11: Code Review
- **Condition:** All changes reviewed by at least 1 other agent/human
- **Check:** Git diff reviewed, no unreviewed changes in PR
- **Auto-fail:** Unreviewed code, hoặc review finding unresolved

---

## Phase-Specific Gates — Gates Theo Từng Phase

### Phase 0: Reconnaissance + Constitution
| Gate | Required | Threshold |
|------|----------|-----------|
| G1 TypeScript | Yes | 0 errors |
| G2 Lint | Yes | Suppression ≤ baseline |
| G3 Tests | Yes | All pass |
| G5 Secrets | Yes | 0 leaked |
| G8 Domain | Yes | Audit complete |
| G9 Docs | Yes | Architecture docs updated |

### Phase 1: Creative Foundation
| Gate | Required | Threshold |
|------|----------|-----------|
| G1 TypeScript | Yes | 0 errors |
| G2 Lint | Yes | Suppression ≤ baseline |
| G3 Tests | Yes | Coverage ≥ 90% cho domain models |
| G4 Build | Yes | Production build passes |
| G5 Secrets | Yes | 0 leaked |
| G6 Routes | Yes | All existing routes functional |
| G8 Domain | Yes | No duplicate domain concepts |
| G9 Docs | Yes | Domain models documented |
| G11 Review | Yes | All changes reviewed |

### Phase 2: Creative Intelligence
| Gate | Required | Threshold |
|------|----------|-----------|
| G1 TypeScript | Yes | 0 errors |
| G2 Lint | Yes | Suppression ≤ baseline |
| G3 Tests | Yes | Coverage ≥ 85% |
| G4 Build | Yes | Production build passes |
| G5 Secrets | Yes | 0 leaked |
| G6 Routes | Yes | All existing routes functional |
| G7 Migration | Yes | Migrations reversible |
| G8 Domain | Yes | Graph concepts canonical |
| G9 Docs | Yes | Intelligence APIs documented |
| G10 Rollback | Yes | All migrations rollback-tested |
| G11 Review | Yes | All changes reviewed |

### Phase 3: Autonomous Factory
| Gate | Required | Threshold |
|------|----------|-----------|
| G1 TypeScript | Yes | 0 errors |
| G2 Lint | Yes | Suppression ≤ baseline |
| G3 Tests | Yes | Coverage ≥ 85% |
| G4 Build | Yes | Production build passes |
| G5 Secrets | Yes | 0 leaked |
| G6 Routes | Yes | All existing routes functional |
| G7 Migration | Yes | Migrations reversible |
| G8 Domain | Yes | Agent concepts canonical |
| G9 Docs | Yes | Agent protocol documented |
| G10 Rollback | Yes | All migrations rollback-tested |
| G11 Review | Yes | All changes reviewed |

### Phase 4: Distribution + Commerce
| Gate | Required | Threshold |
|------|----------|-----------|
| G1 TypeScript | Yes | 0 errors |
| G2 Lint | Yes | Suppression ≤ baseline |
| G3 Tests | Yes | Coverage ≥ 85% |
| G4 Build | Yes | Production build passes |
| G5 Secrets | Yes | 0 leaked |
| G6 Routes | Yes | All existing routes functional |
| G7 Migration | Yes | Migrations reversible |
| G8 Domain | Yes | Commerce concepts canonical |
| G9 Docs | Yes | Distribution APIs documented |
| G10 Rollback | Yes | All migrations rollback-tested |
| G11 Review | Yes | All changes reviewed |

### Phase 5: Creative Economy OS
| Gate | Required | Threshold |
|------|----------|-----------|
| ALL G1-G11 | Yes | All thresholds met |

---

## Enforcement — Thuc Thi

1. **Pre-commit:** G1 + G2 + G3 must pass locally
2. **PR merge:** G1-G11 must pass in CI
3. **Phase transition:** ALL required gates must pass + sign-off từ CTO agent
4. **Hotfix:** G1 + G3 + G6 minimum, full gates within 48 hours

> **Quy tắc:** Gates không phải optional. Nếu gate fail, phase không chuyển. Period.
> Gates are not optional. If a gate fails, the phase does not advance. Period.
