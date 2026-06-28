# Customer Support Templates + Refund Policy

> **Companion to `onboarding-email-sequence.md`** (proactive drip).
> **This doc:** REACTIVE responses to customer messages (email/chat/Telegram).
> **Voice:** Brand voice locked per `brand-voice.md` (expert mentor, no hype, calm).
> **Coverage:** 10 common situations + refund decision tree + escalation paths.

---

## Principles (read before customizing any template)

1. **Reply within 4 hours business / 24 hours weekend.** First-10-customer trust is built on responsiveness.
2. **Acknowledge before diagnose.** Customer wants to feel heard FIRST, then helped.
3. **Specific > generic.** Use customer's name + mission ID + timestamp when applicable.
4. **No defensive language.** If Sophia was at fault, own it cleanly. If customer was confused, redirect without blame.
5. **Refunds are cheaper than churn-with-resentment.** Default to generosity within decision tree limits.
6. **Bilingual respect.** VN customers may write VN even with EN UI. Respond in their language.

---

## Refund Decision Tree (Operator Authority)

```
Customer requests refund
│
├─ Within 24 hours of payment + < 3 missions used
│  └─ ✅ FULL refund, no questions (use T7-FULL)
│
├─ Within 7 days, claims Sophia-side bug confirmed in logs
│  └─ ✅ FULL refund + apologize + log incident (use T8-BUG)
│
├─ Within 7 days, claims dissatisfaction, used > 10 missions
│  └─ 🤝 PARTIAL refund (50%) + 30-day extension offer (use T9-PARTIAL)
│
├─ Within 7 days, technical issue caused by customer's BYOK keys
│  └─ ❌ DECLINE refund + apologize + offer 1-on-1 fix help (use T10-BYOK-DECLINE)
│
├─ After 7 days, before next billing cycle
│  └─ ❌ DECLINE refund + offer cancel-future-billing (use T11-LATE)
│
└─ Suspected fraud / chargeback risk
   └─ 🚨 ESCALATE to operator decision (no template)
```

**Operator override:** Any case → operator can choose to refund generously if relationship/PR value > $60 cost.

---

## T1 — Wizard validation failure

### Symptom
Customer email: *"My API key shows red ❌ in the wizard, but I'm sure it's valid"*

### Template (EN)

```
Hi [Name],

Thanks for the screenshot — that helps narrow it down.

Looking at your wizard timestamp [time], the [provider] key failed validation
because [specific reason: format prefix wrong / quota exhausted / endpoint
returned 401].

Quickest fix:
1. Go to [provider dashboard URL]
2. Generate a new key (or check your existing key's status)
3. Paste it in the wizard

If the new key also fails, reply with the prefix (first 6 chars, NOT the
full key) and I'll trace it.

— Sophia team
```

### Template (VN)

```
Chào [Name],

Cảm ơn screenshot — Sophia thấy rõ vấn đề.

Nhìn timestamp wizard [time], key [provider] fail validation do [lý do
cụ thể: sai format prefix / hết quota / endpoint trả 401].

Cách fix nhanh nhất:
1. Vào [provider dashboard URL]
2. Tạo key mới (hoặc check trạng thái key hiện tại)
3. Paste vào wizard

Nếu key mới vẫn fail, reply prefix (6 ký tự đầu, KHÔNG paste full key)
và Sophia trace tiếp.

— Sophia team
```

---

## T2 — First video failed / hung

### Symptom
Customer email: *"My first campaign has been stuck on 'rendering' for 20 minutes"*

### Template (EN)

```
Hi [Name],

Mission [msn_XXX] is stuck — that's not normal (median first render is
3-5 minutes).

Looking at our logs: [actual diagnosis from wrangler tail OR mission
dashboard — stage X failed at timestamp Y because Z].

What we're doing:
1. Cancelled the hung mission so it doesn't keep eating credits
2. Refunded the [X] credits used (visible in /dashboard/billing)
3. [If Sophia-side: deploying fix now / If provider-side: documented]

Next step for you: trigger a fresh campaign. Should work cleanly now.

Reply if it hangs again — we'll keep digging.

— Sophia team
```

### Template (VN)

```
Chào [Name],

Mission [msn_XXX] bị stuck — không bình thường (median render đầu tiên là
3-5 phút).

Nhìn logs Sophia: [chẩn đoán cụ thể từ wrangler tail HOẶC mission
dashboard — stage X fail tại timestamp Y do Z].

Sophia đang xử lý:
1. Hủy mission stuck để không tiếp tục đốt credits
2. Refund [X] credits đã dùng (xem ở /dashboard/billing)
3. [Nếu lỗi Sophia: đang deploy fix / Nếu lỗi provider: đã document]

Bước tiếp cho bạn: trigger campaign mới. Sẽ chạy clean lần này.

Reply nếu vẫn stuck — Sophia tiếp tục đào.

— Sophia team
```

---

## T3 — Video quality complaint (voice/lipsync/script)

### Symptom
Customer email: *"The voice sounds robotic / lipsync is off / script doesn't match my topic"*

### Template (EN)

```
Hi [Name],

I watched [video_url] — agree on [specific aspect they raised].

Two paths to better quality:

→ For voice: try a different ElevenLabs voice ID. Their dashboard has
  voice preview — pick one that fits your channel personality. Sophia uses
  whatever voice ID you've set in /dashboard/settings/voice.

→ For lipsync: depends on your D-ID/HeyGen quality tier. If you're on
  D-ID Lite, output is intentionally lower fidelity. HeyGen Creator tier
  ($24/mo) has noticeably better lipsync.

→ For script coherence: your OpenRouter model choice matters. We default
  to a balanced model. For better scripts, try `openrouter/auto` or a
  larger model (cost goes up ~2x).

Want me to walk you through swapping providers? Reply yes and I'll set up
a 15-min call.

— Sophia team
```

(VN version follows same structure — translate per brand voice.)

---

## T4 — NOWPayments payment failed

### Symptom
Customer email: *"I tried to pay $60 but the page errored / payment stuck"*

### Template (EN)

```
Hi [Name],

Sorry for the friction. Let's diagnose.

Looking at NOWPayments dashboard logs for your invoice [invoice_id]:
[actual status: payment received but IPN failed / payment never received
/ wallet mismatch / etc].

Three things:
1. [If payment received, IPN failed]: I'm granting Growth tier manually
   now — your access is restored. We'll fix the IPN bug.
2. [If payment never received]: Funds returned to your wallet within
   24 hours. Retry via [link].
3. [If wallet/network mismatch]: USDT must be TRC20, not ERC20 or BEP20.
   Use the TRC20 address from /dashboard/billing/upgrade.

What support do you need now?

— Sophia team
```

(VN equivalent.)

---

## T5 — Trial-end auto-charge dispute

### Symptom
Customer email: *"I didn't expect to be charged $60. I thought it was a free trial."*

### Template (EN)

```
Hi [Name],

I see the confusion. Looking at your signup:

→ You signed up via the $1 trial path on [date]
→ Trial terms (shown at checkout) state $60 auto-charge on day 8
→ We sent reminder emails on day 6 and day 7

That said — if the auto-charge wasn't your intent, here's what I can do:

✅ Full refund $60 + cancel subscription (no further charges)
✅ Keep $60, full Growth month, cancel for next month
✅ Keep $60, downgrade to BASIC retroactively (we credit $40)

Reply with which one you want. Whichever you choose, no hard feelings.

— Sophia team

P.S. We'll review the trial-end messaging — clarity matters.
```

(VN equivalent. Note: this is a high-empathy template. Operator may customize tone.)

---

## T6 — How-to question (low effort)

### Symptom
Customer email: *"How do I do [X feature]?"*

### Template (EN)

```
Hi [Name],

Quick answer:

[3-line how-to with exact menu path / command / URL]

Detailed walkthrough: [link to relevant doc — onboarding-email-sequence
or smoke-test-walkthrough or in-app help]

Anything else?

— Sophia team
```

(VN equivalent. Keep terse. How-to questions don't need long replies — give the answer + offer follow-up.)

---

## T7-FULL — Refund (within 24h, < 3 missions)

### Template (EN)

```
Hi [Name],

Refunded $60 to your USDT wallet [partial address ends in ...XXXX].
Should land within 24 hours.

Subscription cancelled. Your videos and BYOK keys stay in your account
indefinitely (read-only access). Reactivate anytime → [link].

If you'd like to share one sentence about why Sophia didn't fit, I'd
appreciate the data. Optional — no obligation.

— Sophia team
```

(VN equivalent.)

---

## T8-BUG — Refund (Sophia-side bug confirmed)

### Template (EN)

```
Hi [Name],

You're right — that was our bug. Apologies.

What happened: [specific technical explanation, 2-3 sentences, no blame
to provider unless it's actually them].

What we did:
✅ Full refund $60 to your USDT wallet
✅ Subscription cancelled, no future charges
✅ [Fix deployed at commit XXXX / Fix scheduled for deploy by date]

You don't need to come back. But if you do, we'll honor whatever your
prior tier was at no charge for the first month. No catch.

Thanks for the patience while we diagnosed.

— Sophia team
```

(VN equivalent. Tone: own the bug cleanly. No defensiveness.)

---

## T9-PARTIAL — Refund (mid-period dissatisfaction)

### Template (EN)

```
Hi [Name],

I hear you. Looking at your usage:
- [Y] missions over [Z] days
- Spend on your providers: ~$[N]

Per our policy, mid-period dissatisfaction gets a partial refund:

✅ $30 refunded to your USDT wallet (50% of $60 billing)
✅ Account stays Growth-tier through end of current billing cycle
✅ Next charge cancelled

If you want to use the remaining ~[days left] days as a "honest try"
before deciding for next month — that's the spirit of the policy.

If you want to leave entirely now (full close), reply and we'll switch
to T7-FULL terms.

— Sophia team
```

(VN equivalent.)

---

## T10-BYOK-DECLINE — Decline refund (customer BYOK issue)

### Template (EN)

```
Hi [Name],

I've looked at your logs and the issue is your [provider] key being
rate-limited / quota-exhausted / revoked. Sophia faithfully attempted
[X] calls — provider returned [Y].

Because Sophia operates on YOUR keys (BYOK), provider issues on the
customer side aren't refundable. We don't have access to fix or top up
your account on your behalf.

Here's what WE CAN do for you:

→ 15-min screenshare to verify your provider account state
→ Recommendation on which provider tier fits your volume
→ One-time $20 credit toward Sophia next month if you stay (good-faith
  gesture)

Reply with which option works.

— Sophia team
```

(VN equivalent. Tone: firm on policy, generous on gesture.)

---

## T11-LATE — Decline refund (past 7-day window)

### Template (EN)

```
Hi [Name],

Refunds for the [date] charge aren't available — that billing cycle is
past the 7-day window in our terms.

What I CAN do:
✅ Cancel future billing immediately. No further charges.
✅ Access continues through end of current paid period ([date]).
✅ Help you export your data before access expires (mission history,
   tracking URLs).

Reply if any of those helps.

— Sophia team
```

(VN equivalent.)

---

## Escalation Path

When operator hits a case NOT covered by T1-T11:

```
1. Operator drafts response, checks against brand voice doctrine
2. Edge case? Post to Claude in plain text: "Customer Y at [time], situation Z,
   I'm considering response A. Brand voice OK? Refund decision sensible?"
3. Claude reviews + suggests adjustments
4. Operator sends final
5. Document new case as T12+ in this doc for future reuse
```

Build the doc up over time — same principle as `incident-playbook.md`.

---

## Tone Calibration

### DO

- Lead with empathy on the customer's actual pain
- State facts the customer hasn't seen (logs, timestamps)
- Offer specific paths forward (not vague "we'll look into it")
- Match customer's energy (formal email → formal reply; casual → casual)
- Use customer's language (VN customer → VN reply)
- Sign as "Sophia team" not as an individual (until team scales)

### DON'T

- Use "unfortunately" — minimize the word
- Apologize for things that aren't Sophia's fault
- Make excuses ("our provider was slow") — own it or fix it
- Promise specific timelines you can't keep
- Bury the answer under disclaimers
- End with "let me know if you have any questions" — too generic

### Brand voice checklist before sending

- [ ] Customer name used (not "Hi there")
- [ ] Specific facts referenced (mission ID, timestamp, amount)
- [ ] Single clear path forward
- [ ] No hype words ("10x", "supercharge", "absolutely")
- [ ] No exclamation marks
- [ ] Language matches customer's
- [ ] Reply-to address monitored

---

## Stats to Track (Phase 06 Month 1)

Operator should log per support interaction:

| Metric | Why |
|--------|-----|
| First-response time | Trust signal |
| Resolution time | Efficiency signal |
| Template used (T1-T11) | Distribution → reveals product gaps |
| Refund granted (Y/N + %) | Cost monitoring |
| Customer outcome (retained/churned) | Effectiveness signal |
| Satisfaction quote | Testimonial harvesting |

Simple Google Sheet works for first 50 customers. Defer ticketing system until volume justifies.

---

## Reference Files

- `brand-voice.md` — voice doctrine
- `onboarding-email-sequence.md` — proactive comms
- `incident-playbook.md` — when customer's report reveals a Sophia bug, follow incident path
- `pricing-trial-decision-matrix.md` — refund decisions tie to trial structure

---

## Unresolved

1. **Telegram support** — customers may DM `@Sophia_Bbot` for help instead of email. Bot doesn't proxy to operator currently. Decide: route DMs to operator inbox? Auto-respond "email us"? Bot answers FAQ?
2. **SLA documentation** — public-facing "we reply within 4 hours business" claim — operator must commit before publishing, or remove from this doc.
3. **Refund processing time** — depends on USDT-TRC20 settlement speed. Document expected timeline per network conditions.
4. **VN customer support hours** — does Sophia operator's timezone (America/Los_Angeles per session info) cover VN business hours? If not, set expectations OR hire VN-timezone support.
5. **Refund accounting** — log refunds in `user_purchases` D1 table with reason code. Currently no schema for it — defer until first 5 refunds processed manually.
6. **Template T11 export tool** — customer data export script doesn't exist. Build as small Phase 06 prep code task if any T11 cases occur.
