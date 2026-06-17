# Phase 08 — Crypto Compliance Framework

## Context Links

- Primary source: `plans/260521-2342-go-live-100-audit/reports/phase5-go-live-scorecard.md` (Security category, Milestone C)
- Related: NOWPayments integration (crypto USDT payments); Phase 1 SOC 2 audit trail
- Regulatory: AML (Anti-Money Laundering), KYT (Know Your Transaction), sanctions screening

## Overview

- **Priority:** P2 (depends on Phase 1 audit trail for compliance evidence)
- **Status:** pending
- **Description:** Implement AML/KYT controls for NOWPayments crypto payment flows. Establish sanctions screening, transaction monitoring thresholds, and documentation to demonstrate regulatory good faith.

## Key Insights

- Sophia accepts USDT payments via NOWPayments (crypto payment processor)
- NOWPayments handles KYT on their side, but platform operator may have obligations depending on jurisdiction and volume
- Milestone C (100/100) requires documented crypto compliance framework
- Risk: Without screening, platform could be used for sanctioned entity payments → regulatory liability

## Requirements

### Functional
1. **Transaction threshold monitoring** — Alert on single transactions > $10,000 equivalent or daily aggregate > $50,000
2. **Sanctions screening** — Check payment sender addresses against OFAC SDN list (via TRM Labs, Chainalysis, or open-source sanctions list)
3. **Jurisdiction blocking** — Block payments from prohibited jurisdictions (Iran, North Korea, Cuba, etc.) based on IP + blockchain analysis
4. **Audit trail** — All compliance checks logged to `compliance_checks` table with decision and evidence
5. **Manual review queue** — Suspicious transactions flagged for operator review before credit

### Non-functional
- Screening adds < 100ms to payment webhook processing
- False positive rate < 1% (avoid blocking legitimate customers)
- Sanctions list updates daily (auto-fetch from OFAC/pub sources)
- All decisions explainable (retain screening evidence for 5 years)

## Architecture

### Compliance Check Pipeline

Extend NOWPayments IPN webhook handler:

```typescript
// src/forest/payments/nowpayments-ipn-handler.ts
import { checkSanctions } from '@/tree/compliance/sanctions-screen';
import { checkJurisdiction } from '@/tree/compliance/jurisdiction-block';
import { logComplianceCheck } from '@/tree/compliance/audit-trail';

export async function handleNowPaymentsIPN(payload: NowPaymentsIPN): Promise<{ status: number; message: string }> {
  const { payment_id, payment_amount, payment_currency, payer_wallet_address, payer_ip } = payload;

  // 1. Amount threshold check
  const usdEquivalent = await convertToUSD(payment_amount, payment_currency);
  if (usdEquivalent > 10000) {
    await logComplianceCheck({
      paymentId: payment_id,
      checkType: 'threshold',
      result: 'flag',
      amount: usdEquivalent,
    });
    return { status: 202, message: 'Manual review required (high value)' };
  }

  // 2. Sanctions screening
  const sanctionsResult = await checkSanctions(payer_wallet_address);
  if (sanctionsResult.matched) {
    await logComplianceCheck({
      paymentId: payment_id,
      checkType: 'sanctions',
      result: 'block',
      reason: sanctionsResult.matchReason,
      list: sanctionsResult.listName,
    });
    // Reject but don't reveal reason to sender (avoid enumeration)
    return { status: 400, message: 'Payment cannot be accepted' };
  }

  // 3. Jurisdiction check (IP-based + wallet analysis)
  const jurisdiction = await checkJurisdiction(payer_ip, payer_wallet_address);
  if (jurisdiction.prohibited) {
    await logComplianceCheck({
      paymentId: payment_id,
      checkType: 'jurisdiction',
      result: 'block',
      reason: jurisdiction.country,
    });
    return { status: 400, message: 'Payments from your region are not accepted' };
  }

  // 4. Pass — proceed with normal IPN flow
  await logComplianceCheck({
    paymentId: payment_id,
    checkType: 'all',
    result: 'pass',
  });

  return await processPaymentIPN(payload); // existing handler
}
```

### Sanctions Screening

**Option A: TRM Labs API** (commercial, comprehensive)
```typescript
const TRM_API_KEY = process.env.TRM_API_KEY;

async function checkSanctions(address: string): Promise<{ matched: boolean; matchReason?: string; listName?: string }> {
  const resp = await fetch(`https://api.trmlabs.com/v1/screen?address=${address}`, {
    headers: { 'Authorization': `Bearer ${TRM_API_KEY}` },
  });
  const data = await resp.json();
  return {
    matched: data.matches.length > 0,
    matchReason: data.matches[0]?.reason,
    listName: data.matches[0]?.list,
  };
}
```

**Option B: Open-source sanctions list** (lower cost, higher maintenance)
- Download OFAC SDN list (CSV) daily via cron
- Store in D1 table `sanctions_list` (address, name, list_source, date_added)
- Local query during screening (no API call latency)

```sql
-- migrations/0126-sanctions-list-table.sql
CREATE TABLE sanctions_list (
  address TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  list_source TEXT NOT NULL, -- 'OFAC_SDN', 'UN_SANCTIONS', etc.
  date_added INTEGER NOT NULL,
  notes TEXT
);

CREATE INDEX idx_sanctions_list_address ON sanctions_list(address);
```

Update script `scripts/compliance/update-sanctions-list.js` runs daily.

### Jurisdiction Blocking

Use IP geolocation + wallet clustering:

```typescript
// src/tree/compliance/jurisdiction-block.ts
import { geoIpLookup } from '@/lib/geoip'; // maxmind or ipstack

const PROHIBITED_COUNTRIES = ['IR', 'KP', 'CU', 'SY', 'KP']; // Iran, NK, Cuba, Syria, etc.

async function checkJurisdiction(ip: string, walletAddress: string): Promise<{ prohibited: boolean; country?: string; reason?: string }> {
  // Primary: IP geolocation
  const geo = await geoIpLookup(ip);
  if (geo && PROHIBITED_COUNTRIES.includes(geo.country_iso_code)) {
    return { prohibited: true, country: geo.country_name, reason: 'ip_geolocation' };
  }

  // Secondary: Wallet clustering (if available via TRM or Chainalysis)
  if (process.env.TRM_API_KEY) {
    const walletInfo = await fetchWalletRisk(ip, walletAddress);
    if (walletInfo.highRisk Jurisdiction) {
      return { prohibited: true, country: walletInfo.jurisdiction, reason: 'wallet_clustering' };
    }
  }

  return { prohibited: false };
}
```

### Audit Trail Table

```sql
-- migrations/0127-compliance-checks-table.sql
CREATE TABLE compliance_checks (
  id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL,
  check_type TEXT NOT NULL, -- 'threshold', 'sanctions', 'jurisdiction', 'all'
  result TEXT NOT NULL, -- 'pass', 'flag', 'block'
  amount_usd REAL, -- nullable
  wallet_address TEXT, -- nullable
  ip_address TEXT, -- nullable
  matched_list TEXT, -- for sanctions
  matched_name TEXT, -- for sanctions
  reason TEXT, -- for block reasons
  checked_at INTEGER NOT NULL,
  checked_by TEXT NOT NULL DEFAULT 'system' -- 'system' or operator user_id if manual review
);

CREATE INDEX idx_compliance_checks_payment_id ON compliance_checks(payment_id);
CREATE INDEX idx_compliance_checks_checked_at ON compliance_checks(checked_at);
CREATE INDEX idx_compliance_checks_result ON compliance_checks(result);
```

### Manual Review Queue

Simple admin UI: `src/app/admin/compliance/review/page.tsx`

Shows flagged payments with:
- Payment ID, amount, wallet, IP
- Screening results (sanctions match, jurisdiction hit)
- Approve / Reject buttons

Approval re-injects into normal payment flow (with audit log comment).

## Related Code Files

**Files to create:**
- `migrations/0126-sanctions-list-table.sql`
- `migrations/0127-compliance-checks-table.sql`
- `src/tree/compliance/sanctions-screen.ts` (TRM API or local DB query)
- `src/tree/compliance/jurisdiction-block.ts`
- `src/tree/compliance/audit-trail.ts` (logComplianceCheck)
- `src/forest/payments/nowpayments-ipn-handler.ts` — extend with compliance pipeline
- `scripts/compliance/update-sanctions-list.js` — daily cron
- `docs/runbooks/COMPLIANCE-REVIEW.md` — manual review procedure
- `docs/policy/CRYPTO-COMPLIANCE.md` — policy document for auditors

**Files to modify:**
- `src/app/api/webhooks/nowpayments/route.ts` — inject compliance check before crediting
- `wrangler.toml` — add cron for sanctions list update (if local DB)
- `.env.example` — add `TRM_API_KEY` if using commercial screening
- `src/lib/geoip/` — add IP geolocation lookup (MaxMind DB or API)

## Implementation Steps

1. **Legal/regulatory consult** — Determine threshold amounts ($10k single, $50k daily) with compliance officer
2. **Select screening approach** — TRM Labs (API) vs local sanctions list (maintenance burden)
3. **Create migrations** — `0126`, `0127`; test on staging
4. **Implement sanctions screen** — `sanctions-screen.ts` with caching (cache results 24h)
5. **Implement jurisdiction block** — integrate GeoIP database (MaxMind GeoLite2 free)
6. **Build audit trail logger** — `logComplianceCheck()` writing to `compliance_checks`
7. **Modify NOWPayments IPN** — insert compliance pipeline before credit
8. **Create manual review admin page** — filter flagged payments; approve/reject
9. **Schedule sanctions list updates** — daily cron (QStash or external)
10. **Test with known sanctioned addresses** — use OFAC test vectors
11. **Document runbook** — how to handle manual reviews, false positives, appeals
12. **SOC 2 evidence** — sample compliance check logs; sanctions update history

## Todo List

- [ ] Consult legal: threshold amounts and prohibited jurisdictions list
- [ ] Decide TRM API vs local sanctions list (cost vs maintenance)
- [ ] Set up TRM account and API key (if chosen)
- [ ] Write and test `0126` + `0127` migrations
- [ ] Implement `sanctions-screen.ts` (with caching)
- [ ] Implement `jurisdiction-block.ts` with MaxMind GeoIP
- [ ] Create `audit-trail.ts` logging function
- [ ] Extend NOWPayments IPN handler with compliance checks
- [ ] Build admin manual review UI (or simple script if low volume)
- [ ] Schedule daily sanctions list update (cron or Actions)
- [ ] Write `docs/runbooks/COMPLIANCE-REVIEW.md`
- [ ] Write `docs/policy/CRYPTO-COMPLIANCE.md`
- [ ] End-to-end test: simulate prohibited payment; verify blocked + logged
- [ ] Staging dry run with false positives to tune thresholds
- [ ] Production rollout with monitoring for false positives

## Success Criteria

- ✅ `compliance_checks` table populated with entries for all IPN payments
- ✅ Known sanctioned address (test vector) results in `block` with `matched_list` populated
- ✅ Prohibited jurisdiction IP results in `block` with reason
- ✅ High-value transaction ($10k+) results in `flag` (manual review)
- ✅ Manual review UI (or script) can approve flagged payments with audit trail
- ✅ Sanctions list updates daily automatically (check cron log)
- ✅ All compliance decisions have `checked_at` timestamp and `checked_by` identity
- ✅ SOC 2 evidence includes: policy doc, sample logs, update schedule proof

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| False positive blocks legitimate customer | Med | High | Tiered thresholds; manual review queue; appeal process |
| TRM API costs exceed budget | Low | Med | Set usage alerts; local fallback if needed |
| Sanctions list update fails (cron down) | Med | Med | Alert on failure; manual update procedure |
| Geolocation IP database stale | Low | Low | Update GeoLite2 monthly (automated) |
| Compliance check adds >100ms latency | Low | Med | Cache wallet screening results 24h |

## Security Considerations

- Sanctions screening evidence must be retained per jurisdiction (typically 5 years)
- `compliance_checks` table is write-once, read-only updates (no DELETE)
- Manual review actions must be logged to `audit_log` with operator identity (Phase 1)
- TRM API key stored in CF Workers secret; never in code

## Next Steps

1. **Week 1:** Legal consult; select screening vendor
2. **Week 2-3:** Build core compliance pipeline
3. **Week 4:** Staging test with test vectors; tune thresholds
4. **Week 5:** Production rollout; monitor false positive rate
5. **Week 6:** SOC 2 evidence package
