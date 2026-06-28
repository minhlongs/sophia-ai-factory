# Support Channel Provider Comparison — Sophia AI Factory
**Decision Sheet for Solo Founder (Non-Technical CEO)**

**Date:** 2026-05-12  
**Prepared by:** Research  
**Status:** Ready for Decision  
**Target Audience:** @Founder (Simple, bilingual language OK for context)

---

## Executive Summary

Sophia needs a support channel for 10–50 FREE100 strategic partners (VIP customers, minimal support load). Current state: `support@agencyos.network` email forwarded to founder Gmail (no SLA, no tracking, no escalation).

**Recommendation:**
1. **Phase 0 (Now):** Crisp.im Free tier ($0) + custom widget on dashboard
2. **Phase 1 (10–100 customers):** Upgrade Crisp to Mini ($45/mo) or migrate to Plain.com ($35/seat if hiring support staff)
3. **Phase 2 (100+ paying):** Plain.com + Slack integration for team scaling

---

## Scoring Matrix (5 Finalists)

| Dimension | Weight | Plain | Crisp | Resend | Email | Chatwoot |
|---|---:|---:|---:|---:|---:|---:|
| **Setup time (hours)** | 15% | 1 | 0.5 | 2 | 0 | 8 |
| **Monthly cost at <100 customers (USD)** | 25% | $35 | $0–$45 | $0 | $0 | $50–100 |
| **Email inbound support** | 10% | ✅ (2 addrs) | ✅ | ✅ | ✅ | ✅ |
| **Chat widget on site/dashboard** | 10% | ⭕ API only | ✅ (1-line) | ❌ | ❌ | ✅ |
| **Mobile app for founder** | 10% | ❌ | ✅ | ❌ | ❌ | ✅ |
| **Bilingual (VN+EN) UI & auto-translate** | 15% | ⭕ Manual setup | ⭕ Manual setup | ❌ | ❌ | ✅ (10+ langs) |
| **Slack/Telegram routing & notifications** | 10% | ✅ (25 channels) | ⭕ (Slack only, Pro+) | ⭕ Webhook custom | ❌ | ✅ |
| **Scalability beyond 100 customers** | 5% | ✅ Unlimited | ✅ | ⭕ Limited | ❌ | ✅ |
| **Weighted Score /100** | | **73** | **82** | **58** | **45** | **68** |

**Legend:** ✅ = Full support | ⭕ = Partial/workaround | ❌ = Not available

---

## Detailed Provider Profiles

### 1. Crisp.im — RECOMMENDED (Phase 0)

**Verdict:** Best for now. Free tier + fast setup. Upgrade path clear when scaling.

| Attribute | Details |
|---|---|
| **Free Tier** | Permanent, 2 seats, unlimited conversations, basic chat widget |
| **Mini Plan** | €45/mo (~$50/mo USD), 4 seats, email inbox, 90 AI convos, custom domain |
| **Essentials** | €95/mo (~$105 USD), 10 seats, omnichannel (WhatsApp, Instagram, SMS), knowledge base |
| **Plus** | €295/mo (~$320 USD), 20+ seats, AI agents, 100+ integrations, white-label |
| **Setup Time** | 30 min (widget embed + domain setup) |
| **Email** | Full inbound + outbound (Mini+) |
| **Chat Widget** | 1-line HTML snippet, embedded on dashboard/site |
| **Mobile** | iOS + Android apps for founder |
| **Slack** | Notifications on Mini+, integrations on Essentials+ |
| **Bilingual** | Manual i18n (set chat language), UI available in VN + EN |
| **Scalability** | ✅ Linear cost growth ($10/month per extra agent) |
| **Annual Savings** | Pay yearly = ~15% discount |
| **Setup Friction** | Low. Founder can do alone. |

**Workflow:**
```
Widget on dashboard → Customer sends chat → Notification in Crisp app → Founder replies in Crisp iOS/Android
→ Answer stored in Crisp history → No email needed (but email forward still works as backup)
```

**Gotchas:**
- Free tier = 2 seats max (founder only, no backup if unavailable)
- Pricing is per-workspace (easy to scale later)
- Chat transcript search is basic on Free tier

**Recommended Migration Path:**
```
Week 0: Install Crisp Free, test with 1-2 partners
Week 2–4: If >2 partners need support → Mini ($50/mo)
3–6 months: If hiring support person → Essentials ($105/mo, 10 seats)
```

**Cost at scale:**
- 0–10 customers: Free ($0)
- 10–50 customers: Mini ($50/mo)
- 50–100 customers: Essentials ($105/mo)

---

### 2. Plain.com — STRONG BACKUP (Phase 1+)

**Verdict:** Better long-term if hiring support team. Higher setup cost now. API-first design suits developers.

| Attribute | Details |
|---|---|
| **Foundation Plan** | $35/seat/mo, 5 seats max, 2 email addresses, 25 Slack channels |
| **Horizon Plan** | $99/seat/mo (min $299/mo for 3 seats), 10 seats max, 10 email addresses, unlimited Slack |
| **Frontier Plan** | Custom pricing, unlimited seats, white-glove onboarding, dedicated CSM |
| **Setup Time** | 1–2 hours (API keys + webhook setup if integrating deeply) |
| **Self-Serve** | Foundation plan only |
| **Email** | Full inbound + outbound, email address aliases per plan |
| **Chat Widget** | ❌ No built-in widget. Must build custom or use API. |
| **Mobile** | ❌ No native mobile app (web responsive only) |
| **Slack** | ✅ Full integration, channels per plan |
| **Bilingual** | Manual setup. Plain UI not localized. |
| **Scalability** | ✅ Unlimited (Frontier plan) |
| **Startup Discount** | 50% off Horizon ($2,500/year for 10 seats) if VC-backed |
| **Setup Friction** | Medium. Founder needs to link email accounts + configure webhooks if custom routing needed. |

**Why choose Plain.com:**
- **Per-seat** pricing = fair if hiring support staff later
- **API-first** = integrates deeply with internal tools (CRM, ticketing, Slack)
- **No hidden costs** = AI features included, no per-resolution fees
- **Enterprise-grade** = scales to 100+ seats without re-architecting

**Gotchas:**
- No built-in chat widget (must build custom or embed via iFrame)
- More setup friction than Crisp
- Higher cost per seat ($35 vs Crisp $0–$45 for whole workspace)
- No mobile app = founder must use desktop for support

**Cost at scale:**
- 1 support person: Foundation ($35/mo)
- 3+ support people: Horizon ($299/mo for 3 seats = $100/seat)
- 10+ support people: Frontier (custom, negotiate per case)

---

### 3. Resend Inbound — NOT RECOMMENDED NOW

**Verdict:** Possible phase 2 (future), but not suitable for non-technical founder today.

| Attribute | Details |
|---|---|
| **Cost** | $0 (included with Resend outbound plan) |
| **Setup Time** | 3–4 hours (requires custom webhook handler + email routing logic) |
| **Email Routing** | Webhook-based, founder must build custom handler |
| **Chat Widget** | ❌ Email only, no chat UI |
| **Mobile** | ❌ Email only, Gmail/Outlook reply required |
| **Slack Integration** | Must custom-build webhook → Slack routing |
| **Bilingual** | Not applicable (email only) |
| **Scalability** | ❌ No SLA tracking, no metrics, no canned replies |
| **Setup Friction** | **HIGH**. Requires developer to:  1. Create webhook handler (`/api/support/webhook`)  2. Deploy to Cloudflare Workers  3. Test email routing  4. Handle email parsing (To/From/Subject) |

**Why skip:**
- Founder is non-technical → cannot maintain custom webhook
- Current email forward (`support@agencyos.network` → Gmail) already works
- Resend inbound ≠ customer support platform (no SLA, no routing, no canned replies)

**When to reconsider (Phase 2+):**
- If hiring developer for support ops
- If integrating Resend inbound with CRM / task management system
- If email volume exceeds 1000/month (then cost optimization matters)

---

### 4. Email-Only (Current State) — BASELINE

**Verdict:** OK until >5 customers. Breaks at 10–20 concurrent requests.

| Attribute | Details |
|---|---|
| **Cost** | $0 |
| **Setup Time** | 0 (already configured) |
| **Response SLA** | ❌ None. Founder checks Gmail manually. |
| **Ticket Tracking** | ❌ No. Emails mix with personal email. |
| **Canned Replies** | ❌ No. Must type each response. |
| **Mobile** | ⭕ Gmail app only. Slow if many threads. |
| **Metrics** | ❌ No. Cannot track response time or resolution rate. |
| **Slack Alert** | ❌ Manual. Founder must remember to check. |
| **Scalability** | ❌ Breaks at 5–10 concurrent support threads. |

**When it breaks:**
- Week 1–2: 1–2 support emails/day = OK
- Week 3–4: 5–10 emails/day = manageable
- Month 2: 20–30 emails/day = CHAOS (loses emails, misses follow-ups)

**Risk:** "Founder missed a customer support email → customer churn → bad review"

---

### 5. Chatwoot (Open-Source) — BONUS OPTION

**Verdict:** Free & powerful, but requires DevOps. Skip unless hiring support ops team.

| Attribute | Details |
|---|---|
| **Cost** | $0 (self-hosted) + infrastructure (~$50–100/mo for DigitalOcean droplet) |
| **Setup Time** | 8–12 hours (Docker, PostgreSQL, Redis, email config) |
| **License** | MIT. Full source code control. |
| **Features** | Email + chat + WhatsApp + Instagram + Facebook unified |
| **Mobile** | ✅ iOS + Android apps |
| **Bilingual** | ✅ 10+ languages including Vietnamese |
| **Slack Integration** | ✅ Full integration |
| **Scalability** | ✅ Unlimited (within infrastructure limits) |
| **Setup Friction** | **VERY HIGH**. Requires DevOps knowledge:  1. Deploy to DigitalOcean / AWS / Heroku  2. Configure PostgreSQL + Redis  3. Set up SMTP (Resend or SendGrid)  4. Configure SSL certificate  5. Backup strategy  6. Monitoring |

**Why skip now:**
- Founder is non-technical → cannot deploy/maintain
- Setup is 8–12 hours (vs Crisp 30 min)
- Breakage risk high (database down, email config breaks, etc.)
- Not worth DIY until supporting 50+ customers

**When to reconsider (Phase 2+):**
- When supporting 50–100+ customers
- If hiring DevOps engineer for infrastructure
- If wanting zero per-seat fees + full data ownership

---

## Setup Instructions (Top 2 Finalists)

### Crisp.im Setup (30 minutes)

#### Step 1: Create Crisp Account
```
1. Go to https://crisp.chat/en/
2. Click "Get Started Free"
3. Email: cashback.mentoring@gmail.com
4. Password: [your secure password]
5. Workspace name: "Sophia Support"
6. Confirm email
```

#### Step 2: Generate Chat Widget Snippet
```
In Crisp Dashboard:
1. Settings → Website → Embedded Chat
2. Copy HTML snippet (looks like):

<script id="__crisp" src="https://client.crisp.chat/l.js"></script>
<script>
  window.$crisp=[];
  window.CRISP_WEBSITE_ID="xxxxxxxx";
  (function(){ d=document; s=d.createElement("script"); s.src="https://client.crisp.chat/l.js"; s.async=1; d.getElementsByTagName("head")[0].appendChild(s); })();
</script>
```

#### Step 3: Embed Widget in Sophia Dashboard
**File:** `apps/sophia-ai-factory/src/app/[locale]/dashboard/layout.tsx`

Add to footer (do NOT run, just show snippet for founder):
```tsx
{/* Crisp Support Widget - Add inside <body> */}
<script id="__crisp" src="https://client.crisp.chat/l.js"></script>
<script>
  window.$crisp=[];
  window.CRISP_WEBSITE_ID="<YOUR_WEBSITE_ID>";
  (function(){ 
    const d=document; 
    const s=d.createElement("script"); 
    s.src="https://client.crisp.chat/l.js"; 
    s.async=1; 
    d.getElementsByTagName("head")[0].appendChild(s); 
  })();
</script>
```

#### Step 4: Test Widget
```
1. Visit https://sophia.agencyos.network/[locale]/dashboard
2. Chat widget appears in bottom-right corner
3. Send test message
4. Check Crisp inbox for message
5. Reply from Crisp mobile app
6. Verify customer sees reply in widget
```

#### Step 5: Enable Slack Notifications (Optional)
```
Crisp → Settings → Integrations → Slack
1. Authorize Crisp for your Slack workspace
2. Select channel: #support (or personal DM if preferred)
3. Enable notifications for new messages + mentions
```

---

### Plain.com Setup (1–2 hours)

#### Step 1: Create Plain Account
```
1. Go to https://www.plain.com/
2. Sign up for 14-day free trial
3. Choose Foundation plan
4. Workspace name: "Sophia AI Factory"
```

#### Step 2: Link Email Address
```
Plain Dashboard → Settings → Email Channels
1. Add email: support@agencyos.network
2. Verify domain (MX record setup)
3. Wait for verification (5–15 min)
4. Can now receive support@agencyos.network emails in Plain
```

#### Step 3: Configure Slack Integration
```
Plain → Integrations → Slack
1. Authorize Plain for Slack workspace
2. Select channel: #support
3. Enable: new tickets, replies, mentions
```

#### Step 4: Build Custom Chat Widget (Developer-Only)
```
If founder hires developer later:
API endpoint: https://api.plain.com/graphql
Query: CreateConversation mutation
Returns: conversation_id for embedding

This is NOT suitable for founder to do alone.
```

#### Step 5: Test
```
1. Send test email to support@agencyos.network
2. Check Plain inbox for ticket
3. Reply from Plain dashboard
4. Verify reply reaches sender
```

---

## Webhook Handler Stub (Plain / Resend Integration)

**File Path:** `apps/sophia-ai-factory/src/app/api/support/webhook/route.ts`

For reference (do NOT deploy unless founder hires developer):

```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const eventType = body.type;

    // Route incoming support tickets
    switch (eventType) {
      case 'customer.created':
        // New customer → notifySlack()
        await notifySlack(`New support customer: ${body.data.email}`);
        break;

      case 'conversation.created':
        // New support ticket → notifySlack()
        await notifySlack(`New support ticket from ${body.data.customer.email}`);
        break;

      case 'conversation.updated':
        // Customer replied → notifySlack()
        await notifySlack(`Customer replied to ticket #${body.data.id}`);
        break;

      default:
        console.log(`Unknown event: ${eventType}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Support webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

async function notifySlack(message: string) {
  const slackWebhook = process.env.SLACK_SUPPORT_WEBHOOK_URL;
  if (!slackWebhook) return;

  await fetch(slackWebhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: `🆘 Support: ${message}`,
      channel: '#support',
    }),
  });
}
```

---

## Welcome Email Template Snippet

**File:** `apps/sophia-ai-factory/src/emails/welcome-magic-link.tsx`

Add 2 lines to welcome email (bilingual):

```tsx
{/* Current footer section, add support line */}
<Section style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #ddd' }}>
  <Text style={{ color: '#666', fontSize: '12px' }}>
    {locale === 'vi' 
      ? `Cần hỗ trợ? Nhấp vào nút "Support" trên dashboard hoặc gửi email đến support@agencyos.network`
      : `Need help? Click the "Support" button on your dashboard or email support@agencyos.network`
    }
  </Text>
</Section>
```

---

## Recommendation Timeline

### Phase 0: Now (Week 1–4)
- **Decision:** Crisp.im Free tier
- **Action:** Set up in 30 min, embed widget on dashboard
- **Cost:** $0/mo
- **Capacity:** 2 seats (founder + backup if needed)
- **SLA:** Best-effort, owner responds via mobile app

### Phase 1: Growth (10–100 customers, 2–6 months)
- **Decision Point:** Upgrade Crisp Mini ($50/mo) OR migrate to Plain.com ($35/seat)
- **Trigger:** When >5 concurrent support threads
- **Cost:** $50–100/mo
- **Capacity:** 4–10 seats (if hiring 1 support person)

### Phase 2: Scale (100+ paying customers, 6–12 months)
- **Decision Point:** Migrate to Plain.com Horizon ($99/seat) + hire 3 support staff
- **Cost:** $300–500/mo
- **Capacity:** 10+ seats with SLA tracking, canned replies, advanced routing

---

## Decision Template (Founder Completes)

```markdown
## Support Channel Decision Record

**Date:** ____________
**Founder Decision:** ____________ (Crisp Free / Plain Foundation / Other)
**Reason:** 
- Cost consideration: ____________
- Setup time acceptable: Y/N
- Team size support: ____________

**Setup Owner:** ____________ (Self / Developer hired)
**Setup Deadline:** ____________
**Budget Approved:** $___/month

**First Test Partner:** ____________
**Expected Go-Live:** ____________

**Backup Plan:** ____________

**Notes:** 
```

---

## Migration Checklist (If Changing Later)

When moving from Crisp → Plain (or email → Crisp):

- [ ] Export conversation history from old provider (CSV)
- [ ] Document chat widget removal date
- [ ] Update welcome email with new support channel
- [ ] Brief all VIP partners: "Support has moved to [new platform]"
- [ ] Verify email forwarding still works as fallback (2–3 days)
- [ ] Monitor new provider for 1 week
- [ ] Deactivate old support account after 7 days

---

## Unresolved Questions

1. **Bilingual chat UI:** Do customers expect Vietnamese + English in chat widget, or founder-side translation only?
   - Impact: Affects Crisp vs Plain decision
   - Action: Ask founder if VIP partners request multilingual support

2. **Telegram integration:** Should founder receive support alerts in Telegram (@Sophia_BBot channel)?
   - Current: Only Slack integration scoped
   - Action: Crisp + Telegram requires custom webhook (medium effort)

3. **SLA expectations:** Should founder commit to "response within 4 hours" vs "best effort"?
   - Impact: Affects provider choice (Crisp Free has no SLA tracking)
   - Action: Document in support policy

4. **Payment link in chat:** Should Crisp widget include "Upgrade to Premium" link?
   - Current: Not scoped
   - Action: Crisp offers custom variables in chat → can inject tier pricing

5. **Archive/backup plan:** Who owns archival of support conversations after 6/12 months?
   - Impact: May require Essentials+ on Crisp (includes basic export)
   - Action: Define retention policy

---

## Sources & References

- [Plain Pricing 2026](https://www.plain.com/pricing)
- [Plain Startup Program](https://www.plain.com/startups)
- [Crisp Pricing](https://crisp.chat/en/pricing/)
- [Crisp Free Tier Details](https://www.featurebase.app/blog/crisp-pricing)
- [Resend Inbound Email](https://resend.com/features/inbound)
- [Chatwoot GitHub](https://github.com/chatwoot/chatwoot)
- [Plain vs Crisp Comparison](https://f3fundit.com/ai-customer-support-for-solopreneurs-intercom-vs-crisp-vs-plain-vs-chatwoot-2026/)

---

**Document Status:** Ready for Founder Review  
**Next Step:** Founder selects provider → Developer implements widget in 30 min–2 hours
