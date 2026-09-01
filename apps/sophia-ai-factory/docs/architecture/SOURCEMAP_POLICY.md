# Source Map Policy — Sophia AI Factory

**Version:** 1.0.0
**Effective:** 2026-08-31
**Scope:** Production deploy at https://sophia.agencyos.network
**Deploy:** CF-direct via wrangler CLI (GitHub Actions disabled by design)

---

## TL;DR (No-Tech Summary)

Source maps are debug files that turn minified error stack traces back into readable code locations. Sophia's policy: **source map upload is OPTIONAL**. The platform works fully without it — errors are still captured, just with minified (compressed) line numbers.

**Vietnamese (Tóm tắt):**
Source map là file gỡ lỗi giúp biến dấu vết lỗi rút gọn thành mã nguồn dọc đọc được. Chính sách của Sophia: **tải source map là TÙY CHỌN**. Nền tảng hoạt động đầy đủ không cần nó — lỗi vẫn được ghi nhận, chỉ là số dòng bị nén (rút gọn).

---

## Doctrine Foundation

This policy is bound by the **No-Tech / No-Code Doctrine** (`.claude/rules/sophia-no-tech-doctrine.md`):

> The platform must function fully WITHOUT any operator-provided third-party credential.

`SENTRY_AUTH_TOKEN` is the only credential that gates source map upload. Per doctrine, **absence of this token must never block build, deploy, or runtime**.

---

## Decision Matrix

| State | `SENTRY_AUTH_TOKEN` | Sourcemap Upload | Error Capture | Stack Trace Quality |
|-------|---------------------|------------------|---------------|---------------------|
| A — Full symbolication | Present & valid | ✅ Uploaded | ✅ Captured | ✅ Readable (original lines) |
| B — Minified capture (default) | Absent / empty / whitespace | ❌ Skipped | ✅ Captured | ⚠️ Minified (compressed lines) |

**State B is the doctrine-compliant default.** The platform is fully operational in State B.

---

## Implementation

The decision is centralized in a single module:

```
src/seed/observability/sentry-symbolication-opt-in.ts
```

### Public API

```typescript
import { decideSymbolication, assertSymbolicationNonBlocking } from '@/seed/observability/sentry-symbolication-opt-in';

// Pure function of environment — no side effects beyond logging.
const decision = decideSymbolication(); // { enabled: boolean, reason: string }

// Post-build gate — ALWAYS returns 'proceed' (doctrine invariant).
const outcome = assertSymbolicationNonBlocking(decision); // 'proceed'
```

### Invariant (doctrine-critical)

`assertSymbolicationNonBlocking` returns `'proceed'` in **every** state. It is structurally incapable of blocking deploy. This is enforced by construction — the function body has no conditional return path.

### Logging

- Token present → `logger.info` (no warn/error)
- Token absent → `logger.info` (no warn/error)

**Never** logs at warn/error for absent token. Absent token is the NORMAL doctrine-compliant state.

---

## Deploy Integration

The deploy script (`scripts/deploy-with-sha.sh`) calls `assertSymbolicationNonBlocking` after build. Because it always returns `'proceed'`, the deploy pipeline is unaffected by token state.

**No separate "source map upload" CI step.** Upload happens inside the standard `npm run deploy:flow` build phase when the token is present.

---

## Verification

```bash
# Check current symbolication state (local)
node -e "const {decideSymbolication}=require('./src/seed/observability/sentry-symbolication-opt-in'); console.log(decideSymbolication());"

# Verify deploy succeeds WITHOUT token (doctrine test)
unset SENTRY_AUTH_TOKEN
npm run deploy:full
# Expected: exit 0, no sourcemap upload, production green

# Verify deploy succeeds WITH token (full symbolication)
export SENTRY_AUTH_TOKEN=<token>
npm run deploy:full
# Expected: exit 0, sourcemaps uploaded, production green
```

**Vietnamese (Xác minh):**
```bash
# Kiểm tra trạng thái symbolication hiện tại (máy local)
node -e "const {decideSymbolication}=require('./src/seed/observability/sentry-symbolication-opt-in'); console.log(decideSymbolication());"

# Xác minh deploy thành công KHÔNG CẦN token (kiểm tra doctrine)
unset SENTRY_AUTH_TOKEN
npm run deploy:full
# Kỳ vọng: exit 0, không tải sourcemap, production xanh
```

---

## Rollback

Source map upload is **not reversible** — uploaded source maps persist in Sentry. However:

- Removing the token from subsequent deploys stops future uploads.
- Previously-uploaded source maps remain associated with past releases (no harm).
- No runtime dependency on source maps — removing the token has zero production impact.

---

## FAQ

**Q: Why not require the token for "better debugging"?**
A: Doctrine. Requiring an operator-provided credential violates the no-tech principle. Minified errors are still actionable; symbolication is a nice-to-have.

**Q: Can customers provide their own Sentry token?**
A: Not currently. Sentry is operator-side observability. Per doctrine, we do not build features that require operator credentials.

**Q: What if Sentry changes its auth model?**
A: Re-evaluate. The `decideSymbolication` function is the single decision point — change it there.

---

## Document History

| Date | Author | Changes |
|------|--------|---------|
| 2026-08-31 | Phase 3 hardening | Initial policy — doctrine-compliant source map opt-in |
