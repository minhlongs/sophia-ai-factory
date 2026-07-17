# 4-Layer Architecture Enforcement Audit

## 1. Are violations blocking (fail) or warning?

**BLOCKING.** `check-layer-boundaries.sh` runs via `npm run ci:boundaries` inside the CI gate (`npm run ci`). It calls `exit 1` on any violation. CI will **fail**, not warn.

## 2. Production violation count

**2 violation categories, 2 offending files:**

| Category | File | Line | Import |
|---|---|---|---|
| `seed→tree` (forbidden) | `src/seed/db/platform-config-repo.ts` | 11 | `@/tree/credentials/encryption` (`encryptValue`, `decryptValue`) |
| `land→forest` (forbidden) | `src/land/sop-marketplace/install-handler.ts` | 26 | `@/forest/analytics/funnel-tracking` (`trackSopInstalled`) |

`install-handler.ts` calls `trackSopInstalled` as fire-and-forget (`.catch(() => {})`), so the forest dependency is replaceable — invert to forest dispatching a land event, or move the function down.

## 3. One-line fix recommendation

Relocate `encryptValue/decryptValue` from `tree/credentials/encryption` into `seed/` (crypto is foundational), and invert `trackSopInstalled` so `forest/analytics` dispatches a domain event that `land/sop-marketplace` consumes instead of importing forest directly — both violations resolved without breaking CI.

## Supporting findings

- `arch-lint.sh` is referenced in `package.json` (`ci:arch`) but does **not exist on disk** — CI will fail with "file not found" if `ci:arch` is invoked standalone.
- `src/lib/env/` contains only `get-base-url.ts` — sole remaining `@/lib/*` consumer; not in the four banned paths, but should eventually migrate to `@/seed/`.
- `check-layer-imports.ts` (regex-based TS version) exists as a more thorough alternative; currently unused in package.json scripts.
