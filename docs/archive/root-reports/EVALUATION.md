# EVALUATION.md

## Definition of Done

A Sophia change is done only when it preserves the Constitution and passes the narrowest meaningful verification.

## Product Evaluation

| Criterion | Pass Signal |
|---|---|
| First paying customer | Paid user completes BYOK setup and generates first AI video |
| Protected flows | Setup Wizard, Telegram Bot, NOWPayments IPN tier activation pass smoke checks |
| No-tech doctrine | No operator-managed third-party credential is required for customer value |
| Bilingual quality | Customer-facing UI/docs are Vietnamese + English |
| Pricing clarity | Pricing copy matches canonical tiers and payment providers |

## Engineering Evaluation

| Criterion | Pass Signal |
|---|---|
| Build | `cd apps/sophia-ai-factory && npm run build` exits 0 |
| Type safety | `npm run type-check` exits 0 |
| Tests | `npm test` or `npm run ci:test` passes |
| Deploy | `npm run deploy:full` exits 0 |
| SHA proof | `/api/version` live SHA equals local commit short SHA |
| Secrets | No hardcoded production secrets; secret scan passes or findings are triaged |
| Dependency risk | High/critical dependency findings are patched, waived, or tracked |

## Architecture Evaluation

| Criterion | Pass Signal |
|---|---|
| Layer integrity | New imports follow seed → tree → forest → land rules |
| Canonical imports | Auth/db/tier use `seed` paths, not banned `lib` paths |
| Async boundary | Long video jobs use Inngest; edge handlers do not block on rendering |
| Data ownership | D1 is primary; Supabase exceptions are explicit |
| Payment safety | IPN handlers are idempotent and signature-verified |
| Documentation | ADRs updated for architecture decisions |

## Business Evaluation

| Criterion | Pass Signal |
|---|---|
| Unit economics | BASIC tier remains profitable under real customer usage |
| Revenue path | Pricing and sales motion map to $1M ARR |
| Money graph | Cash in, vendor cost, support cost, affiliate payout, founder time are visible |
| Founder leverage | Features reduce manual work rather than add operator burden |

## Red Flags

- “HTTP 200” reported as deploy proof without SHA match.
- Polar/PayPal reintroduced for Sophia billing.
- Operator-managed third-party credentials added as required setup.
- Docs claim Vercel, GitHub Actions deploy, SOC 2 Type II, or 99.9% SLA without business decision.
- Generated artifacts cited as architecture truth.
- Deleting files without business impact, technical impact, migration path, and risk.
