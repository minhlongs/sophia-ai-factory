# FREE100 Distribution Tracker

> 50-slot tracker for the MASTER tier promo code. Used 8 / 50, **42 remaining** (verified 2026-05-12 12:40 UTC).

**Code:** `FREE100`
**Discount:** 100% off → MASTER tier lifetime
**Auto-expire:** never (founder-controlled)
**Validate live:** `curl -s https://sophia.agencyos.network/api/promo/validate -X POST -H "Content-Type: application/json" -d '{"code":"FREE100"}'`

---

## Distribution rules

1. **Send 1-by-1** from personal `founder@mekongmind.com` Gmail/Outlook — NOT mass-mailer.
2. **Personalize each email** — minimum `{{first_name}}` + 1 context line. Cold/template-blast = inbox death.
3. **Log every send below** with date+inbox. Update status when partner redeems.
4. **Stop sending if redemption rate ≥ 80%** — keep last 5 slots for late-arriving high-value referrals.
5. **Check usage delta** weekly: `wrangler d1 execute sophia-raas-db --command "SELECT used_count, max_uses FROM promo_codes WHERE code='FREE100'" --remote`

---

## Tracker

| # | Sent | Partner name | Email | Channel | Template | Redemption status | Notes |
|---|---|---|---|---|---|---|---|
| 1 | 2026-04-?? | (existing user 1) | — | — | — | ✅ redeemed | pre-launch |
| 2 | 2026-04-?? | (existing user 2) | — | — | — | ✅ redeemed | pre-launch |
| 3 | 2026-04-?? | (existing user 3) | — | — | — | ✅ redeemed | pre-launch |
| 4 | 2026-04-?? | (existing user 4) | — | — | — | ✅ redeemed | pre-launch |
| 5 | 2026-04-?? | (existing user 5) | — | — | — | ✅ redeemed | pre-launch |
| 6 | 2026-04-?? | (existing user 6) | — | — | — | ✅ redeemed | pre-launch |
| 7 | 2026-04-?? | (existing user 7) | — | — | — | ✅ redeemed | pre-launch |
| 8 | 2026-04-?? | (existing user 8) | — | — | — | ✅ redeemed | pre-launch |
| 9 | YYYY-MM-DD | | | Gmail/Outlook | A/B/C | ⏳ pending | |
| 10 | | | | | | | |
| 11 | | | | | | | |
| 12 | | | | | | | |
| 13 | | | | | | | |
| 14 | | | | | | | |
| 15 | | | | | | | |
| 16 | | | | | | | |
| 17 | | | | | | | |
| 18 | | | | | | | |
| 19 | | | | | | | |
| 20 | | | | | | | |
| 21 | | | | | | | |
| 22 | | | | | | | |
| 23 | | | | | | | |
| 24 | | | | | | | |
| 25 | | | | | | | |
| 26 | | | | | | | |
| 27 | | | | | | | |
| 28 | | | | | | | |
| 29 | | | | | | | |
| 30 | | | | | | | |
| 31 | | | | | | | |
| 32 | | | | | | | |
| 33 | | | | | | | |
| 34 | | | | | | | |
| 35 | | | | | | | |
| 36 | | | | | | | |
| 37 | | | | | | | |
| 38 | | | | | | | |
| 39 | | | | | | | |
| 40 | | | | | | | |
| 41 | | | | | | | |
| 42 | | | | | | | |
| 43 | | | | | | | |
| 44 | | | | | | | |
| 45 | | | | | | | |
| 46 | | | | | | | |
| 47 | | | | | | | |
| 48 | | | | | | | |
| 49 | | | | | | | |
| 50 | | | | | | | |

**Status legend:**
- `⏳ pending` — email sent, awaiting redemption
- `✅ redeemed` — partner signed up, MASTER tier active
- `🔁 followup-1` — Template C reminder sent (≥3 days after pending)
- `❌ bounced` — email bounced or invalid address
- `🚫 declined` — partner replied declining
- `🐛 blocker` — partner reported issue, founder action needed

**Template legend:** A=Personal warm, B=Cold/referral, C=Reminder (see `free100-partner-outreach-template-260512.md`)

---

## Weekly review template (paste into Notion/calendar reminder)

```
Date: ____________

Slots used: ____ / 50    (delta this week: +____)
Pending invites: ____    (>3 days old: ____ — send Template C)
Blockers reported: ____  (resolved: ____)

Top feedback themes from new partners:
1.
2.
3.

Action this week:
- [ ]
- [ ]
- [ ]
```

---

## Post-distribution analysis (when slots reach 45/50)

Generate via D1 query:

```bash
wrangler d1 execute sophia-raas-db --remote --command "
  SELECT
    DATE(used_at) as redeem_day,
    COUNT(*) as redemptions,
    AVG(JULIANDAY(used_at) - JULIANDAY(sent_at_estimate)) as avg_days_to_redeem
  FROM promo_redemptions
  WHERE code='FREE100'
  GROUP BY DATE(used_at)
  ORDER BY redeem_day;
"
```

(Adjust query against actual schema — `promo_redemptions` table may be named differently; check `migrations/0090-promo-codes-*.sql` or similar.)

Cross-reference with the tracker above to identify:
- Highest-converting outreach template (A vs B)
- Best send-day-of-week
- Top referrers (for round-2 expansion)

---

## When to stop

Stop sending invites if ANY of these triggers:
- 45/50 slots used → reserve last 5 for in-bound asks
- Founder bandwidth maxed out on partner support
- Resend deliverability degrades (spam reports up) → pause + audit
- Negative feedback from ≥3 of last 5 partners → fix product before more invites

---

## Companion docs

- `free100-partner-outreach-template-260512.md` — Bilingual email templates (A/B/C)
- `founder-cheat-sheet-260512.md` — Pre-flight setup (run BEFORE first outreach)
- `free100-email-deliverability-260512.md` — DNS/tracking rationale
