# Security Policy (`SECURITY.md`)

Sophia AI Factory treats cryptographic integrity, BYOK key isolation, and financial webhook verification as mission-critical invariants.

## Supported Versions

| Version / Edition | Security Updates |
|---|---|
| `sophia.agencyos.network` (Managed Cloud SaaS) | Continuous automated edge patching |
| `v1.52.x` (`main` branch — Open-Core & Enterprise) | Actively supported |
| `< v1.50.0` | Unsupported (upgrade to latest `main`) |

## Core Security Architecture

1. **BYOK Envelope Encryption:** Customer API keys (OpenRouter, ElevenLabs, HeyGen, D-ID, Resend, NOWPayments) are encrypted via Web Crypto AES-256-GCM with HKDF-SHA256 contextual binding (`src/seed/security/oauth-token-vault.ts`).
2. **Constant-Time Webhook Verification:** All inbound webhooks (`NOWPayments`, `PayOS`, `HeyGen`, `ClickBank`) enforce constant-time bitwise comparison (`timingSafeEqual`) and replay-window validation (`src/seed/security/signature.ts`).
3. **Atomic Financial Idempotency:** All billing, quota, and ledger mutations use Cloudflare D1 optimistic concurrency control (`INSERT ... ON CONFLICT DO NOTHING` + `lock_version`).

## Reporting a Vulnerability (Responsible Disclosure)

**Please DO NOT open a public GitHub issue for security vulnerabilities.**

Instead, email **`security@agencyos.network`** with:
- A clear description of the vulnerability and affected file/line (`src/...`).
- Minimal proof-of-concept reproduction steps.
- Impact assessment (e.g., tenant isolation, BYOK key exposure, webhook forgery).

**Response SLA:**
- Acknowledgement within **24 hours**.
- Triage and remediation timeline within **72 hours**.
- Coordinated public credit in `docs/project-changelog.md` after patch deployment.
