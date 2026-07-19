# Phase 05 — TG-1 DMARC Quarantine + TG-2 DKIM Verify

**Priority:** P2 (small score Δ, time-gated)
**Status:** time-gated (DMARC: 2026-06-12+, DKIM: after first prod email)
**Effort:** 5min post-wait
**Score Δ:** +1 (Layer 3 Networking)

## Context

Email DNS hardening was completed Phase 2 (commit `779b219c`):
- SPF: `v=spf1 include:_spf.resend.com -all` ✅
- DMARC: `v=DMARC1; p=none; rua=mailto:dmarc@sophia.agencyos.network` ✅ (monitor mode)
- DKIM: configured on Resend dashboard, TXT record auto-published

Two graduation steps remain:
1. **TG-1**: After 30d of `p=none` monitoring with no false positives → tighten to `p=quarantine` (suspicious mail goes to spam folder, not rejected outright)
2. **TG-2**: After first production email sent, verify DKIM TXT record propagated via dig

## Key Insights

- DMARC graduation path: `none → quarantine → reject` over months. Each step requires monitoring period.
- Going straight to `reject` without quarantine intermediate risks false-positive bounces on legitimate mail to misconfigured downstream receivers.
- DKIM record format: `resend._domainkey.sophia.agencyos.network TXT "v=DKIM1; k=rsa; p=MIIBI..."`. Resend auto-publishes after domain verify.

## Requirements

- TG-1: 30d since DMARC `p=none` deployed → check rua reports for false positives → tighten
- TG-2: First prod email sent (any user signup, payment receipt, etc.) → verify DKIM lookup

## Architecture

DNS-only changes. No code.

## Related Files

- `apps/sophia-ai-factory/docs/dev-sops.md` SOP for email DNS (added Phase 2)
- Cloudflare DNS dashboard: zone `sophia.agencyos.network`

## Implementation Steps

### TG-1: DMARC Quarantine (target 2026-06-12+)

```bash
# 1. Verify monitoring period elapsed
echo "Phase 2 DMARC deploy: 2026-05-13"
echo "30d minimum: 2026-06-12"
date  # Compare today

# 2. Check Resend dashboard for DMARC rua reports (xml emails sent to dmarc@sophia.agencyos.network)
#    OR check Cloudflare logs if rua endpoint is CF Worker

# 3. If no false positives → tighten via Cloudflare API
ZONE_ID=$(curl -s -H "Authorization: Bearer $CF_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/zones?name=sophia.agencyos.network" | jq -r .result[0].id)

# Get existing DMARC record ID
RECORD_ID=$(curl -s -H "Authorization: Bearer $CF_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records?type=TXT&name=_dmarc.sophia.agencyos.network" \
  | jq -r .result[0].id)

# Update to quarantine
curl -X PUT -H "Authorization: Bearer $CF_API_TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records/$RECORD_ID" \
  -d '{"type":"TXT","name":"_dmarc.sophia.agencyos.network","content":"v=DMARC1; p=quarantine; rua=mailto:dmarc@sophia.agencyos.network","ttl":3600}'

# 4. Verify propagation (wait 5-15min)
dig TXT _dmarc.sophia.agencyos.network +short
# Should return: "v=DMARC1; p=quarantine; rua=mailto:..."
```

### TG-2: DKIM Verify (after first prod email)

```bash
# After any /api/* route sends an email (e.g. /api/auth/signup completed):
dig TXT resend._domainkey.sophia.agencyos.network +short
# Should return non-empty TXT starting with "v=DKIM1; k=rsa; p=MIIBI..."

# Or via online tool:
open "https://mxtoolbox.com/SuperTool.aspx?action=dkim%3aresend._domainkey.sophia.agencyos.network"
```

## Todo List

- [ ] **2026-06-12+**: Verify Resend dashboard shows no DMARC failures in past 30d
- [ ] Run Cloudflare API update to set `p=quarantine`
- [ ] Verify `dig TXT _dmarc.sophia.agencyos.network` returns new value (wait 5-15min for propagation)
- [ ] (Future, 30d after quarantine) → graduate to `p=reject` if no issues
- [ ] After first prod email: `dig TXT resend._domainkey.sophia.agencyos.network` returns non-empty
- [ ] Document graduations in `docs/dev-sops.md` SOP for email DNS

## Success Criteria

- `dig TXT _dmarc.sophia.agencyos.network` returns `p=quarantine`
- `dig TXT resend._domainkey.sophia.agencyos.network` returns valid DKIM key
- No spike in DMARC failure reports (Resend dashboard) after quarantine graduation
- Email deliverability rate (Resend dashboard) stays > 95%

## Risk Assessment

- **Graduating too fast** (before 30d monitoring) → may surface false positives that hurt deliverability. Stick to 2026-06-12+ minimum.
- **Quarantine catches legitimate mail** → recipient sees in spam folder, blames Sophia. Mitigate: monitor rua reports for 2 weeks post-quarantine before graduating to reject.
- **DKIM record missing/expired** → Resend auto-publishes; if missing, regenerate via Resend dashboard → Domains → Re-verify.

## Security Considerations

- DMARC quarantine reduces phishing impersonation risk by signaling receivers to spam-folder unauthenticated mail.
- DKIM enables cryptographic verification of mail origin.
- Stricter DMARC = better security posture but higher false-positive deliverability risk.

## Next Steps

- After Phase 05 → all 5 phases done → score 91 → 94+/100 (3.5-4 verified, depending on operator timing)
- Run full 10-layer audit to verify
- Plan next sprint or close roadmap as "operational stable at ~94/100"
