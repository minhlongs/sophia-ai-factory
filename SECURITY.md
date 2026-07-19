# Security Policy

> Sophia AI Factory — Vulnerability disclosure policy
> Last reviewed: 2026-05-18

## Supported versions

Only the **latest deployed `main`** branch is supported for security fixes.
Production deploys are CF-direct (`wrangler deploy`) from `main` after CI gates
pass. See `apps/sophia-ai-factory/CLAUDE.md` "Canonical Deploy Flow".

| Branch | Supported |
|---|---|
| `main` (production) | ✅ |
| Feature branches | ❌ (not deployed) |
| Forks | ❌ |

## Reporting a vulnerability

**Do not open a public GitHub issue for security bugs.** Public disclosure
of an unpatched vulnerability harms our customers and may delay your
recognition under any bug-bounty arrangement.

### Preferred channel

Email: **security@agencyos.network**

Include in your report:

1. **Affected component** — file path / URL / API endpoint / D1 query
2. **Reproduction** — minimal steps, payload, or screenshots
3. **Impact assessment** — auth bypass? data exfiltration? RCE? DoS?
4. **Suggested mitigation** — if known
5. **Disclosure timeline** — your preferred coordinated-disclosure window

### Optional encryption

If your report contains exploit detail, encrypt with our PGP key (request
via the email above; key fingerprint published on our website).

## Response SLA

| Severity | First response | Mitigation target |
|---|---|---|
| **Critical** (RCE, auth bypass, mass data exfiltration) | 24 h | 72 h |
| **High** (privilege escalation, sensitive data leak) | 48 h | 7 days |
| **Medium** (rate-limit bypass, IDOR with limited blast radius) | 5 days | 30 days |
| **Low** (info disclosure, hardening) | 14 days | next release |

We acknowledge receipt within the **First response** window and provide
status updates at least every 7 days until mitigation is shipped.

## In-scope

- `https://sophia.agencyos.network` and its subdomains
- `apps/sophia-ai-factory/` source (Workers, Next.js, D1, R2, KV)
- Admin endpoints `/api/admin/*`
- Customer endpoints `/api/*` (auth, billing, raas, byok, telegram)
- Public pages `/[locale]/*`

## Out-of-scope

- Third-party services we integrate with (NOWPayments, OpenRouter,
  ElevenLabs, D-ID, HeyGen, Telegram, Inngest) — report directly to them
- Customer-provided BYOK keys leaking due to **customer-side** misconfiguration
- Social-engineering against AgencyOS staff
- Physical attacks
- DoS that requires sustained > 10 r/s from the reporter
- Reports from automated scanners without proof-of-impact

## Safe-harbor

We will not pursue legal action against good-faith security researchers
who:
1. Do not access or exfiltrate customer data beyond the minimum needed to
   demonstrate impact.
2. Do not disrupt service availability for other customers.
3. Provide us a reasonable coordinated-disclosure window (default 90 days
   from initial report).
4. Report through the channel above before public disclosure.

## Bounty

No formal bug-bounty program at this time. Eligible reports may receive
discretionary recognition (acknowledgment in `SECURITY-HALL-OF-FAME.md`
once published) at AgencyOS's sole discretion.

## Doctrine note (Sophia-specific)

Per **Sophia no-tech doctrine v1.28.1**, customer-side BYOK credentials are
the customer's responsibility. Reports about customer-self-provided keys
leaking through customer mistakes (e.g. screenshots, public Pastebins) are
out-of-scope. In-scope: any path that lets a non-owner access another
customer's BYOK material, regardless of how the original input arrived.
