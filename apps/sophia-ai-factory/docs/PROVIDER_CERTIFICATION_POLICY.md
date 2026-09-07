# Provider Certification Policy

> Sophia AI Factory — Certification Policy
> Date: 2026-09-07 | Classification: ENFORCED (Code-level gate active)

---

## Overview

Provider certification is a **runtime policy gate** that prevents unsafe or
untrusted providers from being instantiated. It is orthogonal to provider
status dimensions (`REGISTERED / AVAILABLE / CERTIFIED / ENABLED`) —
certification is a safety check, not an interface contract.

---

## Certification States

| State | Meaning | Instantiation allowed? |
|-------|---------|----------------------|
| `NOT_CERTIFIED` | Never evaluated (default for unknown providers) | **NO** — blocks instantiation |
| `EXPERIMENTAL` | Evaluated but not production-ready | YES — graded readiness |
| `PRODUCTION_CANDIDATE` | Passes health + security, no sustained track record | YES — graded readiness |
| `PRODUCTION_READY` | All gates passed, production evidence exists | YES — graded readiness |
| `BLOCKED` | Explicitly blocked — must not be instantiated | **NO** — blocks instantiation |

**Blocking states:** `NOT_CERTIFIED` and `BLOCKED`.
All graded states (`EXPERIMENTAL`, `PRODUCTION_CANDIDATE`, `PRODUCTION_READY`)
allow instantiation — they represent readiness levels, not gates.

---

## Per-Dimension Assessment

Each certification carries per-dimension assessment for observability:

| Dimension | Values | Purpose |
|-----------|--------|---------|
| `security` | `PASS \| BLOCKED \| NOT_EVALUATED` | Security gate status |
| `health` | `PASS \| BLOCKED \| NOT_EVALUATED` | Health check status |
| `canary` | `PASS \| BLOCKED \| NOT_EVALUATED` | Canary deployment status |

---

## Error Type

`ProviderNotCertifiedError` is thrown when a blocked provider is requested:

- **Typed:** extends `Error`, carries `providerId`, `certState`, `reason`
- **Deterministic:** same provider + same state = same error every time
- **Observable:** caught by `classifyError()` → `FailureKind.PROVIDER_NOT_CERTIFIED`
- **Testable:** 10 certification enforcement tests cover all states
- **Safe:** no secrets, tokens, or credentials in error messages
- **Free of secrets:** reason strings are human-readable, never contain keys

---

## Circuit Breaker Integration

`PROVIDER_NOT_CERTIFIED` is integrated into the circuit breaker:

- **Cooldown:** `0` ms — certification is a permanent gate, not a transient failure
- **Immediate open:** `shouldImmediateOpen()` returns `true` for `PROVIDER_NOT_CERTIFIED`
  (same as `AUTH_FAILURE` — immediate circuit open, no cooldown)

---

## Provider Registration

Providers self-declare their certification state at module load time via
`registerCertification(providerId, cert)`.

### Current Registrations

| Provider | State | Security | Health | Canary | Reason |
|----------|-------|----------|--------|--------|--------|
| `hermes` | `BLOCKED` | `BLOCKED` | `BLOCKED` | `BLOCKED` | Security gate BLOCKED: external credential exposure in Hermes repo. Health gate BLOCKED: local-only 127.0.0.1:8100 incompatible with CF Workers. |

Unknown providers default to `NOT_CERTIFIED` (blocking).

---

## Factory Gate

`forest/ai/provider-factory.ts:buildProviders()` checks certification before
instantiation:

```typescript
if (isCertificationBlocking(config.id)) {
  const cert = getCertification(config.id);
  logger.warn('[ProviderFactory] Provider blocked by certification', undefined, {
    providerId: config.id,
    certState: cert.state,
    security: cert.security,
    health: cert.health,
    reason: cert.reason,
  });
  throw new ProviderNotCertifiedError(config.id, cert.state, cert.reason);
}
```

This gate runs **between** API key resolution and provider creation — the earliest
safe point to reject unsafe providers.

---

## Orthogonal Dimensions

Certification state is orthogonal to provider status dimensions:

| Dimension | Meaning | Where tracked |
|-----------|---------|---------------|
| `REGISTERED` | Provider is registered in the factory switch | `provider-factory.ts` |
| `AVAILABLE` | API key resolved for this provider | `buildProviders()` |
| `CERTIFIED` | Certification state is not blocking | `provider-certification.ts` |
| `ENABLED` | Provider is enabled for this user/tier | Tier config |

A provider can be `REGISTERED` + `AVAILABLE` but `NOT_CERTIFIED` (blocked).
A provider can be `CERTIFIED` but not `ENABLED` for a specific tier.

---

## Test Coverage

10 certification enforcement tests in `src/seed/ai/__tests__/provider-certification.test.ts`:

1. `registerCertification` stores certification state
2. `getCertification` returns registered cert
3. `getCertification` returns NOT_CERTIFIED default for unknown providers
4. `isCertificationBlocking` returns true for NOT_CERTIFIED
5. `isCertificationBlocking` returns true for BLOCKED
6. `isCertificationBlocking` returns false for EXPERIMENTAL
7. `isCertificationBlocking` returns false for PRODUCTION_CANDIDATE
8. `isCertificationBlocking` returns false for PRODUCTION_READY
9. `ProviderNotCertifiedError` carries correct fields
10. `ProviderNotCertifiedError` is caught by `classifyError` as `PROVIDER_NOT_CERTIFIED`

---

## Layer Rule

`provider-certification.ts` is in the **seed** layer — foundational primitive.
No imports from `tree/`, `forest/`, or `land/`.
The gate is enforced in `forest/` (provider-factory.ts), which is the correct
import direction (forest → seed).

---

## VN / EN (Bilingual)

**Tiếng Việt:**

# Chính sách Chứng nhận Nhà cung cấp

| Trạng thái | Ý nghĩa | Cho phép khởi tạo? |
|-----------|---------|-------------------|
| `NOT_CERTIFIED` | Chưa được đánh giá | **KHÔNG** — ngăn khởi tạo |
| `EXPERIMENTAL` | Đã đánh giá nhưng chưa sẵn sàng sản phẩm | CÓ — cấp độ sẵn sàng |
| `PRODUCTION_CANDIDATE` | Đã qua health + security, chưa có track record bền vững | CÓ — cấp độ sẵn sàng |
| `PRODUCTION_READY` | Đã qua tất cả gate, có bằng chứng sản phẩm | CÓ — cấp độ sẵn sàng |
| `BLOCKED` | Bị Explicitly blocked — không được khởi tạo | **KHÔNG** — ngăn khởi tạo |

Lỗi `ProviderNotCertifiedError` được throw khi yêu cầu provider bị blocked.
Không chứa secrets, tokens, hoặc credentials.

---

*Policy generated: 2026-09-07 | HEAD: 47fc01546 | Plan: SUPREME COMMAND #5*