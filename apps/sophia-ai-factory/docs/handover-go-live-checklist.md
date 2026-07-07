# Go-Live Checklist — Solo Company Media

> **Mục đích / Purpose**
> VN: Checklist 10/10 xanh trước khi bàn giao chính thức.
> EN: 10/10 green checklist before official handover.

---

## Phase 1: Production Health Verify

| # | Item | Check | Result |
|---|------|-------|--------|
| 1 | SHA match | `LOCAL_SHA == LIVE_SHA` from `/api/version` | ☐ |
| 2 | HTTP 200 on root | `curl -sI https://sophia.agencyos.network` | ☐ |
| 3 | HTTP 200 on /api/health | `curl -s https://sophia.agencyos.network/api/health` | ☐ |
| 4 | All tests pass | `npm test` (6694+) | ☐ |
| 5 | Zero TS errors | `npm run build` | ☐ |
| 6 | Zero lint errors | `npm run lint` | ☐ |

---

## Phase 2: CEO Onboarding Setup

| # | Item | Check | Result |
|---|------|-------|--------|
| 7 | FREE100 promo code works | Apply at checkout → 100% off MASTER | ☐ |
| 8 | Cash/offline payment accepted | Select at checkout → pending_manual_payment | ☐ |
| 9 | CEO account = MASTER tier | Check admin panel | ☐ |
| 10 | Solo Company Media recorded as operator | `tree/handover/operator-config.ts` | ☐ |

---

## Phase 3: Documentation Handover

| # | Item | Check | Result |
|---|------|-------|--------|
| 11 | Operator runbook exists | `docs/handover-operator-runbook.md` | ☐ |
| 12 | Operator guide exists | `docs/handover-operator-guide.md` | ☐ |
| 13 | Incident response playbook exists | Reference `docs/incident-response-playbook.md` | ☐ |
| 14 | Code map documented | Reference `docs/dev-sops.md` + layer arch | ☐ |

---

## Phase 4: Revenue Activation

| # | Item | Check | Result |
|---|------|-------|--------|
| 15 | First customer onboarded | Customer record in DB with active tier | ☐ |
| 16 | Affiliate tracking works | `?ref=<ID>` param tracked | ☐ |
| 17 | Telegram bot responds | `/campaign`, `/status`, `/results` | ☐ |
| 18 | Revenue dashboard loads | `/admin` (auth required) | ☐ |

---

## Phase 5: Monitoring + Go-Live

| # | Item | Check | Result |
|---|------|-------|--------|
| 19 | Sentry SDK capturing | Check Sentry dashboard | ☐ |
| 20 | CF Workers logs accessible | `wrangler tail --format pretty` | ☐ |
| 21 | D1 + R2 bindings healthy | No errors in logs | ☐ |
| 22 | No unhandled rejections | `wrangler tail` clean | ☐ |
| 23 | SSL enforced | HTTPS on all URLs | ☐ |
| 24 | i18n vi+en switch | Toggle language in UI | ☐ |

---

## Protected Flows Verification

| # | Flow | Test | Result |
|---|------|------|--------|
| 25 | Setup Wizard | Sign up → enter API keys → complete | ☐ |
| 26 | Payment Flow | Select tier → NOWPayments → IPN → tier activated | ☐ |
| 27 | Telegram Bot | Send `/campaign` → bot responds <5s | ☐ |

---

## DMARC Check

```bash
dig TXT _dmarc.sophia.agencyos.network
```

Current policy: `p=none` (no-tech doctrine — graduation to `p=quarantine` requires 30-day clean rua reports).

---

## Sign-Off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| CEO (Transferor) | Long Tho | ________________ | ____ |
| Solo Company Media (Transferee) | ________________ | ________________ | ____ |

**Handover date:** ________________
**Next review:** ________________ (30 days)
