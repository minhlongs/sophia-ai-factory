# Phase 2: DNS & Security

## Context Links

- Audit: `plans/reports/debugger-260512-2058-fullstack-audit-rescore.md` §4 G6/G8/G15
- Layer 3 (Networking) & Layer 6 (Security) sections in audit
- Resend docs: https://resend.com/docs/dashboard/domains
- CF billing: https://dash.cloudflare.com/billing

## Overview

- **Priority:** P1
- **Status:** pending
- **Brief:** Configure SPF/DKIM/DMARC for email deliverability, fix protobufjs HIGH vuln, enable CF cost alerts.
- **Effort:** ~1h (mostly DNS dashboard work)
- **Score impact:** +3 (78 → 81)

## Key Insights

| Gap | Insight |
|-----|---------|
| G6 | Resend is configured but DNS records absent. **Unresolved Q2:** if Resend sends from `em.resend.dev`, deliverability OK without our DNS. If from `sophia.agencyos.network`, MUST configure SPF+DKIM+DMARC. **First step: verify Resend domain config.** |
| G8 | `protobufjs` HIGH vuln (overflow CVE) — transitive dep. **Unresolved Q3:** Verify if it lands in Workers runtime bundle. If build-time only (likely), severity is lower. Resolution paths: `npm audit fix`, package.json `overrides`, or document acceptance. |
| G15 | No CF spend alert — could blow budget unnoticed. Set threshold alert at 80% of monthly cap in CF dashboard. |

## Requirements

**Functional:**
- F1: If Resend uses sophia.agencyos.network → SPF, DKIM (CNAME from Resend), DMARC records present
- F2: protobufjs HIGH vuln resolved (fix OR documented exception with risk justification)
- F3: CF dashboard has spend alert configured at $X threshold

**Non-functional:**
- No test regression
- DNS propagation acceptable (5-15min)
- No production downtime

## Architecture

```
Step 1: Identify Resend send domain
  └─► Read Resend dashboard config OR `grep -r "from:" src/.../resend` for sender domain
  
Step 2 (if sophia.agencyos.network):
  CF DNS records to add:
    SPF:   TXT @     "v=spf1 include:_spf.resend.com ~all"
    DKIM:  CNAME resend._domainkey  <value from Resend dashboard>
    DMARC: TXT _dmarc "v=DMARC1; p=quarantine; rua=mailto:dmarc@sophia.agencyos.network; pct=100"

Step 3: protobufjs
  Option A (preferred): npm audit fix
  Option B: package.json "overrides": { "protobufjs": "^7.x.x" }
  Option C: document in package.json + audit-ignore file if not exploitable

Step 4: CF Billing alert
  Dashboard → Billing → Subscriptions → Notifications → Add threshold
```

## Related Code Files

**Modify:**
- `package.json` — possibly `overrides` block for protobufjs (Option B path)
- `package-lock.json` — auto-updated by npm
- `docs/deployment-guide.md` — note SPF/DKIM/DMARC values for ops reference

**Create:** None

**External actions (no code):**
- Resend dashboard verification
- CF DNS dashboard records
- CF Billing dashboard alert

## Implementation Steps

1. **G6 discovery** — Check Resend send domain:
   ```bash
   grep -rn "from:" src/ | grep -i resend | head
   grep -rn "RESEND_FROM\|EMAIL_FROM" src/ | head
   ```
   Determine if sender is `@sophia.agencyos.network` or Resend default. If default → G6 partial (DMARC only recommended).
2. **G6 Resend dashboard** — Log in, verify domain `sophia.agencyos.network` is added. Note required DKIM CNAME values (resend._domainkey).
3. **G6 CF DNS** — Add 3 records (or relevant subset):
   - SPF: `TXT @ "v=spf1 include:_spf.resend.com ~all"`
   - DKIM: CNAME from Resend (varies per account)
   - DMARC: `TXT _dmarc "v=DMARC1; p=quarantine; rua=mailto:dmarc@sophia.agencyos.network; pct=100"`
4. **G6 verify** —
   ```bash
   dig TXT sophia.agencyos.network +short | grep spf
   dig CNAME resend._domainkey.sophia.agencyos.network +short
   dig TXT _dmarc.sophia.agencyos.network +short
   ```
5. **G8 audit** — Identify protobufjs path:
   ```bash
   npm ls protobufjs
   npm audit --json | jq '.vulnerabilities.protobufjs'
   ```
   Check if it appears in `.open-next/worker.js` bundle: `grep -l protobufjs .open-next/` (if absent → build-time only, lower risk).
6. **G8 fix attempt** —
   ```bash
   npm audit fix
   npm test       # confirm no breakage
   npm audit --audit-level=high   # should show 0 high
   ```
   If `audit fix` doesn't resolve, add `overrides` to `package.json`:
   ```json
   "overrides": { "protobufjs": "^7.2.5" }
   ```
7. **G15 CF billing** — CF dashboard → Billing → set notification threshold at e.g. 80% of expected monthly spend.
8. **Run tests** — `npm test` — verify 4081+ pass.
9. **Commit** — `chore(security): SPF/DKIM/DMARC + protobufjs fix + CF spend alert`.
10. **Deploy** — `npm run deploy:full` + SHA verify.
11. **Email test** — send test transactional email; verify deliverability via mail-tester.com (should score ≥9/10).

## Todo List

- [ ] G6: Identify Resend send domain (grep + Resend dashboard)
- [ ] G6: Add SPF TXT record in CF DNS (if applicable)
- [ ] G6: Add DKIM CNAME record from Resend (if applicable)
- [ ] G6: Add DMARC TXT record in CF DNS
- [ ] G6: Verify all 3 with `dig` commands
- [ ] G6: Send test email + mail-tester.com score ≥9/10
- [ ] G8: Run `npm ls protobufjs` to map dependency path
- [ ] G8: Run `npm audit fix` OR add `overrides` to package.json
- [ ] G8: Confirm `npm audit --audit-level=high` shows 0 high
- [ ] G15: Configure CF spend alert in dashboard
- [ ] Run `npm test` (4081+ pass)
- [ ] `npm run deploy:full` + SHA verify

## Success Criteria

- `dig` returns SPF, DKIM, DMARC records (if Resend uses our domain)
- `npm audit --audit-level=high` returns 0 high vulns
- CF dashboard shows active spend alert
- Mail-tester score ≥9/10 (if applicable)
- Vitest 4081+ pass post-changes
- Production deploy verified via SHA match

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Wrong SPF record breaks email sending | Use `~all` (softfail) not `-all` initially; monitor 24h before tightening |
| `npm audit fix --force` introduces breaking changes | Run `npm test` after fix; revert via git if regression |
| DMARC `p=quarantine` causes legit mail to spam folder | Start with `p=none` first week, then move to `quarantine` |
| CF alert misconfigured triggers false positives | Set threshold conservatively; verify webhook/email recipient |

## Security Considerations

- DMARC report mailbox (`dmarc@sophia.agencyos.network`) must exist or be discarded gracefully
- DKIM private key stays at Resend; only public CNAME ours
- protobufjs fix must not introduce new transitive vulns — re-run audit after

## Next Steps

- Independent of Phase 3 — can run in parallel with Phase 1
- Phase 4 (Backup) does NOT depend on this phase
- Tag-team with Phase 1 G12 (CAA) — both are DNS-only changes; batch in same CF dashboard session
