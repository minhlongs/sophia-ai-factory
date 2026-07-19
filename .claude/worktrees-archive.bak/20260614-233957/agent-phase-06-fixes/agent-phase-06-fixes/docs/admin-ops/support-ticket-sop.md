# Sophia Support Ticket SOP

Last updated: 2026-05-13

## System of Record

Interim support channels:

- Email: `support@mekongmind.com`
- Telegram bot: `@Sophia_Bbot`

Before paid go-live, choose one ticket system of record: Crisp, Plain, Zendesk, or a private GitHub Issues project. Every customer issue must be copied or created there.

## Ticket Lifecycle

1. Intake: capture customer, plan, URL, timestamp, screenshots/log snippets, and business impact.
2. Triage: assign severity P1-P4 and owner.
3. Acknowledge: reply within the SLA target for the customer's plan.
4. Resolve: fix, document workaround, or escalate to provider.
5. Verify: customer or operator confirms the issue is resolved.
6. Close: add root cause, fix summary, and follow-up tasks.

## Severity

| Severity | Description | Default Response |
|---|---|---|
| P1 | Production down, checkout blocked for all users, or data exposure risk | 4 hours |
| P2 | Login, checkout, or video generation broken for a paid customer | 12 business hours |
| P3 | Non-critical feature issue or isolated customer workflow problem | 24 business hours |
| P4 | Copy, UI polish, docs, or enhancement request | Scheduled |

Plan SLA can be faster than default severity SLA. Use the faster target.

## Required Fields

- Customer name and email
- Plan tier
- Environment: production, preview, local
- Affected workflow
- Severity
- Owner
- Provider involved, if any
- Next update time
- Resolution summary

## Escalation Paths

| Area | Escalate To | Evidence Needed |
|---|---|---|
| Cloudflare runtime/D1/R2 | Technical operator | Worker logs, request ID, route, timestamp |
| NOWPayments/PayOS | Operations owner | Payment ID, amount, plan, webhook event ID |
| HeyGen/ElevenLabs/MuAPI/OpenRouter | Technical operator | Provider request ID, sanitized prompt, timestamp |
| Legal/compliance | Founder/operator | Customer request, policy section, deadline |
