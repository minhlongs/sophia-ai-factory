# Security Audit — Sophia AI Factory

- **Commit:** `b8c4f6dd`
- **Date:** 2026-05-21
- **Mode:** Read-only, no code modifications, no `.env` reads
- **Baselines compared:** `strategic-audit-260502-1837-go-live.md`, `code-reviewer-260211-1624-security-audit-csp-headers.md`
- **Scope:** 11 items — BYOK encryption · per-customer webhook secrets · server-side tier enforcement · `getHeyGenClientSync` removal · NOWPayments IPN · Better Auth session · secrets · API exposure · headers · rate limiting · audit logging

---

## Findings Table

### P0 — Open / Blocking for Public Launch

| ID | Title | Description | Evidence | Exploit | Fix Effort |
|---|---|---|---|---|---|
| **P0-A** | Checkout double-pay dedupe missing | `POST /api/checkout` creates NOWPayments invoice with rate limit only (10/min). No idempotency on `(user_id, sku, ~24h window)`. A user (or attacker re-spamming a logged-in session) can spin up multiple pending invoices for the same SKU; if more than one settles before tier activation flips, ledger drifts and refund handling becomes manual. | `src/app/api/checkout/route.ts` (handler — no dedupe lookup before invoice create) | Authenticated user races N tabs → N pending IPNs → multiple successful settlements credited; or attacker uses stolen session cookie to drain prepaid balance via repeated SKU purchases before owner notices. | M — add `payment_intents` row keyed by `(user_id, sku, hash)` with 24h TTL; reject duplicates before NOWPayments call. |
| **P0-B** | HeyGen webhook D1 lookup not user-scoped | `POST /api/webhooks/heygen` resolves the video row by `heygen_job_id` only — no `user_id` filter on the D1 query. If two BYOK tenants' jobs ever share an ID (collision in 3rd-party namespace, replay of attacker-known ID, or HeyGen reissue), the wrong tenant's row is mutated. Combined with per-customer secret resolution (which keys off the same lookup), an attacker who learns one tenant's `heygen_job_id` can forge a webhook signed with **their own** secret and overwrite the victim's video state. | `src/app/api/webhooks/heygen/route.ts:70-74, 192` (`.from('videos').eq('heygen_job_id', x)`); resolver in `src/lib/webhooks/heygen-webhook-secret-resolver.ts` keys signature verification off the same row. | Tenant A captures `job_id=J` from their dashboard. Tenant B's job also gets ID `J` (collision or admin replay). A signs a webhook with A's BYOK secret containing `job_id=J, status=failed`. Resolver fetches "the" row → routes to A's secret → signature verifies → B's video is marked failed (or worse, marked completed with attacker-controlled URL). | M — add `user_id` to webhook payload contract OR enforce uniqueness `(provider_job_id, user_id)` + reject when resolver row's `user_id` ≠ secret owner. |

### P0 — CLOSED Since May-2

| ID | Title | Status | Evidence |
|---|---|---|---|
| May-2 P0.1 | Per-customer HeyGen webhook secret | ✅ CLOSED | `src/lib/webhooks/heygen-webhook-secret-resolver.ts` resolves per-user; platform env is fallback only. |
| May-2 P0.3 | `getHeyGenClientSync` removal | ✅ CLOSED | `src/lib/heygen/heygen-client.ts:215-216` confirms sync helper deleted; only async `getHeyGenClient(userId?)` remains. |
| May-2 P0.4 | NOWPayments IPN underpayment guard | ✅ CLOSED | `src/land/billing/nowpayments-ipn-subscription.ts:21` — `UNDERPAYMENT_THRESHOLD = 0.99`. |
| May-2 P0.5 | IPN replay protection | ✅ CLOSED | `src/land/billing/nowpayments-ipn-handlers.ts` — `isPaymentProcessed(payment_id)` gate + `recordIpnEvent`. |

### P0 — Partially Closed

| ID | Title | Description | Evidence |
|---|---|---|---|
| May-2 P0.2 | Server-side tier enforcement | Gate exists at `POST /api/v1/missions/[id]/generate-video` (`reserveVideoSlot(userId, tier)` — `src/app/api/v1/missions/[id]/generate-video/route.ts:95-105`). **Missing** at `POST /api/raas/missions` — Zod + BYOK provider check only, no per-tier mission/month limit. Free-tier abuse is bypassable via this path. Tracked here as **P1-A** below. | `src/app/api/raas/missions/route.ts` |

### P1 — High (Soft-Launch Acceptable, Fix Before Scale)

| ID | Title | Description | Evidence | Exploit | Fix Effort |
|---|---|---|---|---|---|
| **P1-A** | Mission-create lacks tier quota gate | `POST /api/raas/missions` validates auth + BYOK provider but does not call `reserveMissionSlot(userId, tier)` before insert. Tier caps (e.g. BASIC = 5/mo) are enforced downstream at video-generate, not at mission level. | `src/app/api/raas/missions/route.ts` vs `src/app/api/v1/missions/[id]/generate-video/route.ts:95` | Free-tier user creates 10,000 missions (cheap D1 rows, no video generation) — bloats DB, skews analytics, may exhaust free-tier KV writes used by quota counters. | S — call quota gate before insert; reuse `reserveMissionSlot` pattern from video route. |
| **P1-B** | Password reset does not revoke sessions | `POST /api/auth/reset-password/confirm` writes new `account.password` via D1 UPDATE but never calls Better Auth `revokeSessions(userId)`. With 7-day session TTL and 5-minute cookieCache, stolen cookies survive password reset for up to a week. | `src/app/api/auth/reset-password/confirm/route.ts` (no `revokeSessions` call); session config `src/seed/auth/better-auth-server.ts` (`expiresIn: 7*24*60*60`). | Attacker steals cookie → victim notices → resets password → attacker's session still valid for ~7 days. | XS — invoke `auth.api.revokeSessions({ userId })` after password update + invalidate cookieCache. |
| **P1-C** | Admin Basic Auth non-constant-time compare | `isAdminAuthorized()` uses `user === validUser && pwd === validPass`. JS string `===` short-circuits — leaks character-by-character timing. | `src/middleware-helpers.ts` (`isAdminAuthorized` function) | Remote timing attack on `/admin/*` Basic Auth header can recover credentials byte-by-byte (slow but feasible from same CF region). | XS — use `crypto.timingSafeEqual` (Web Crypto `subtle` w/ HMAC trick or buffer compare). |
| **P1-D** | Platform HeyGen key silently bills operator | `getHeyGenClient(userId)` returns `apiKey = userKey ?? envKey`. If user has no BYOK key set (or it was rotated/cleared), the platform's `HEYGEN_API_KEY` is used transparently. Violates no-tech doctrine (operator must not subsidize customer integrations) and creates a covert cost channel. | `src/lib/heygen/heygen-client.ts:201-213` (fallback chain) | Customer disables their BYOK key → continues generating videos → operator absorbs cost. No alert, no failure mode visible to customer. | S — remove env fallback; throw `ByokKeyMissingError` and surface to customer in UI. (Transitional: add metric counter + cap, then remove.) |

### P2 — Medium (Defense-in-Depth Gaps)

| ID | Title | Description | Evidence | Exploit | Fix Effort |
|---|---|---|---|---|---|
| **P2-A** | No BYOK key versioning / rotation pipeline | `byok-crypto.ts` uses `BYOK_MASTER_KEY` with no `key_version` column on `user_api_keys`. Rotation requires re-encrypting every row offline; no graceful overlap. | `src/tree/byok/byok-crypto.ts`, `src/tree/byok/user-api-key-store.ts` (no `key_version` column) | If master key is exposed (e.g. wrangler secret log leak), every BYOK key must be re-entered by every customer — operationally catastrophic, no path to rotate. | M — add `key_version` column + dual-decrypt window during rotation. Document runbook. |
| **P2-B** | No durable audit log on sensitive ops | BYOK `set/clear`, tier upgrades, refunds, IPN events emit posthog/`track()` signals — these are analytics, not durable audit. No append-only `audit_log` table query path. | `src/app/api/user/byok/route.ts` (`track(D1Events.BYOK_KEY_SET, ...)`); `src/land/billing/*` IPN handlers — no `INSERT INTO audit_log`. | Incident response cannot prove "when was customer X's NOWPayments key rotated?" or "who triggered refund Y?" — posthog data may be PII-scrubbed / retention-limited. | M — single `audit_logs` D1 table (actor, action, target, before_hash, after_hash, ts); write from BYOK + billing + admin handlers. |
| **P2-C** | Missing `upgrade-insecure-requests` in CSP | Feb-11 H-02 still open. CSP omits `upgrade-insecure-requests`, so any mixed-content HTTP subresource (e.g. customer-pasted HeyGen webhook URL) loads as HTTP and leaks referrer. | `src/seed/security/content-security-policy-configuration.ts` (no directive present) | Customer pastes `http://` asset URL → browser loads it cleartext → MITM on victim WiFi can replace asset. | XS — add directive. |
| **P2-D** | No COEP/COOP/CORP headers | Feb-11 M-02 still open. Cross-Origin-Embedder/Opener/Resource policies absent → vulnerable to Spectre-class side channels + cross-window attacks if app ever loads OAuth popups. | `apps/sophia-ai-factory/next.config.ts` (no COEP/COOP/CORP in headers config) | Low likelihood pre-launch; high if Sophia ever embeds analytics SDKs with `SharedArrayBuffer` or runs OAuth popups for affiliate networks. | XS — add `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-site`. |
| **P2-E** | No IP fingerprint on Better Auth sessions | Sessions are cookie-only; no binding to IP-prefix or User-Agent class. Stolen cookies are usable from any geography. | `src/seed/auth/better-auth-server.ts` (no `cookieOptions.useSecureCookies` IP-binding plugin) | Cookie exfil via XSS-on-third-party-iframe → attacker uses from foreign IP. | M — add Better Auth IP-binding plugin or middleware check (allow /24 drift). |
| **P2-F** | RaaS gate excludes broad path prefixes | `raasGate` exempts `/api/webhooks/*`, `/api/auth/*`, `/api/discovery/*`, `/api/setup/*`, `/api/health/*`, `/api/sophia-index/*` from license validation. Any new route accidentally placed under these prefixes bypasses license enforcement. | `src/forest/raas/raas-auth-gate.ts` (public path list) | Operator adds `/api/discovery/internal-debug` → unprotected. Or `/api/setup/admin-override` → unauth. | S — invert to allowlist: explicit `PROTECTED_PATHS`; deny by default. |

### P3 — Low (Hygiene)

| ID | Title | Description | Evidence | Fix Effort |
|---|---|---|---|---|
| **P3-A** | Permissions-Policy narrow | Header lists only `camera=(), microphone=(), geolocation=()`. Missing `payment=()`, `usb=()`, `interest-cohort=()`, `browsing-topics=()`. | `apps/sophia-ai-factory/next.config.ts` | XS — extend list. |
| **P3-B** | `style-src 'unsafe-inline'` | Tailwind requires inline styles. Acceptable risk (no JS execution vector via CSS), but document. | `src/seed/security/content-security-policy-configuration.ts` | None — document in threat model. |
| **P3-C** | Read-error → null collapse in BYOK store | `getUserApiKey` catches D1 errors and returns `null` (indistinguishable from "no key set"). Customer sees confusing "BYOK missing" UI when the real issue is D1 outage. | `src/tree/byok/user-api-key-store.ts` | XS — distinguish `null` (not set) vs `error` (re-throw to caller). |

---

## Positive Observations

- **BYOK crypto solid:** AES-GCM-256, 12-byte random IV per record, 256-bit master key, packed `[iv][ct+tag]` (`src/tree/byok/byok-crypto.ts`). Explicit `ByokMissingMasterKeyError` / `ByokInvalidMasterKeyError` typed errors.
- **HMAC verification timing-safe** across HeyGen (SHA-256) and NOWPayments (SHA-512) — `src/lib/webhooks/heygen-signature-verifier.ts`, NOWPayments verifier in IPN handler.
- **IPN idempotency** via `payment_id` lookup + `recordIpnEvent` write before tier mutation.
- **CSRF double-submit cookie** with timing-safe compare; bypass list scoped to auth/webhooks/cron/csp-report only (`src/seed/security/csrf.ts`).
- **CSP nonce-based** for `script-src` (Feb-11 H-01 closed).
- **HSTS 2-year + preload** in `next.config.ts`; `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`.
- **Cookies hardened:** `HttpOnly`, `Secure` in prod, `SameSite=Lax`, `path=/`.
- **No secrets in repo:** only `.env.example`, `.env.production.example`, `.env.test`; `wrangler.toml` `[vars]` carries only feature flags.
- **Layered rate limiting:** IP-keyed (api 100/min, auth 10/min, webhook 1000/min, admin 50/min) + per-user-key on BYOK admin routes (20/min write, 60/min read, 10/min delete).
- **Defense-in-depth for admin:** middleware tier check + page-level guard.

---

## Security Posture Verdict

**SOFT-LAUNCH-ONLY** — acceptable for 5–10 design partners with ops watch; **NOT production-ready for public/self-serve launch** until P0-A and P0-B close.

Rationale:
- **P0-A (checkout dedupe)** is a money-handling correctness gap. With manual ops review of every payment in soft-launch, drift is detectable. At scale (>50 customers), refund queue will hide it.
- **P0-B (cross-tenant webhook scope)** is a real cross-tenant data integrity risk, but requires `heygen_job_id` collision OR attacker knowledge of a victim's job ID. Low probability with current customer count; unacceptable risk for a multi-tenant public launch.
- **P1 set is operationally containable** for ~30 days: session revocation gap (P1-B) and admin timing leak (P1-C) are small attack surfaces while customer count is low and admin endpoints sit behind operator IP allowlist.
- **All May-2 P0s except checkout dedupe are CLOSED** — significant security improvement since May 2. Feb-11 CSP audit findings: 2 closed, 2 open (P2-C/P2-D — low impact).

**Required before public launch:** Close P0-A + P0-B. Schedule P1 set within 30 days post-launch.

---

## Open Questions

1. **HeyGen job ID uniqueness guarantee?** P0-B severity hinges on whether HeyGen issues globally-unique UUIDs across all customer accounts or namespaces per account. If globally unique with cryptographic randomness, P0-B drops to P1; if account-scoped or sequential, P0-B is confirmed P0. Need HeyGen API contract docs.
2. **Platform HeyGen fallback (P1-D) — remove or keep transitional?** No-tech doctrine says remove. But removing breaks existing customers who haven't re-entered keys post-rotation. Need migration plan (notification + grace window) before delete.
3. **BYOK master key rotation owner?** No documented runbook for `BYOK_MASTER_KEY` rotation. Who triggers? What's the dual-window protocol? P2-A blocks honest answer to "what's our key compromise recovery time?"
4. **Audit log retention target?** P2-B fix requires deciding 90 days vs 1 year vs 7 years (depends on whether Sophia falls under any VN/EU financial record retention rule for NOWPayments transactions).
