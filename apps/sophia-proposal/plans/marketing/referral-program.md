# Referral Program Plan

**Goal:** 20% of new customers from referrals
**Timeline:** Launch Week 3
**Owner:** Marketing Agent

---

## Program Structure

### Incentive: 1 Month Free

**For Referrer:**
- 1 month free for each successful referral
- Unlimited referrals (no cap)
- Applies to any paid tier

**For Referee:**
- 14-day extended trial (vs. standard 7-day)
- 10% off first month
- Priority onboarding

---

## Referral Mechanics

### Step 1: Share Link

Each customer gets unique referral link:
```
https://sophia.agencyos.network/signup?ref=[customer_id]
```

### Step 2: Friend Signs Up

Friend uses link to:
- Start 14-day trial (vs. 7-day standard)
- Get 10% off first month

### Step 3: Friend Converts to Paid

When friend becomes paid customer:
- Referrer gets 1 month free credit
- Credit auto-applied to next invoice

### Step 4: Track Progress

Customer dashboard shows:
- Total referrals sent
- Pending conversions
- Credits earned

---

## Technical Requirements

### Database Schema

```sql
-- Referrals table
create table referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_org_id uuid references organizations(id),
  referee_email text not null,
  referral_code text unique not null,
  status text not null default 'pending', -- pending, trial, converted
  created_at timestamptz default now(),
  converted_at timestamptz
);

-- Referral credits table
create table referral_credits (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id),
  credits integer not null,
  source text not null, -- 'referral'
  created_at timestamptz default now()
);
```

### API Endpoints

```
GET /api/referrals — Get referral stats for org
POST /api/referrals/generate — Generate referral link
POST /api/referrals/track — Track referral signup
POST /api/referrals/convert — Convert referral to credit
```

### UI Components

```
/components/referral/
- referral-dashboard.tsx — Main dashboard
- referral-link.tsx — Link copy component
- referral-stats.tsx — Stats display
- referral-history.tsx — History table
```

---

## Launch Plan

### Week 1: Build

- [ ] Database migrations
- [ ] API endpoints
- [ ] UI components
- [ ] Email templates

### Week 2: Test

- [ ] Internal testing
- [ ] Bug fixes
- [ ] Email sequence testing
- [ ] Analytics tracking

### Week 3: Soft Launch

- [ ] Launch to existing customers
- [ ] Email announcement
- [ ] In-app notification
- [ ] Track initial usage

### Week 4: Full Launch

- [ ] Add to main website
- [ ] Social media announcement
- [ ] Email newsletter feature
- [ ] Community posts

---

## Email Templates

### Announcement Email

```
Subject: 🎁 Free Month for You (and Your Friends!)

Hi [Name],

Great news! We're launching our Referral Program.

For every agency owner you refer who becomes a Sophia AI customer, you get:
✅ 1 month FREE (unlimited)
✅ No cap on referrals
✅ Auto-applied to your invoice

Your friends get:
✅ 14-day trial (vs. 7-day standard)
✅ 10% off their first month

Your referral link:
[Referral Link]

Share it with your network and start earning free months!

Best,
The Sophia AI Team

P.S. Top referrer this month gets a special bonus — stay tuned!
```

### Follow-Up Email (Week 2)

```
Subject: You've earned $0 in referral credits... let's fix that!

Hi [Name],

Quick update on your referral status:

Referrals sent: 0
Conversions: 0
Credits earned: $0

Here's an easy way to get started:

1. Share your link on LinkedIn
2. Post in your agency Slack group
3. Mention it to 3 agency owner friends

Your link: [Referral Link]

One referral = 1 month free. That's $499 in your pocket!

Best,
The Sophia AI Team
```

### Success Notification

```
Subject: 🎉 You earned a free month!

Hi [Name],

Congratulations! [Referee Name] just became a Sophia AI customer.

You've earned:
✅ 1 month free credit
✅ Applied to your next invoice

Total credits earned: $499

Keep sharing your link to earn more:
[Referral Link]

Thanks for spreading the word!

Best,
The Sophia AI Team
```

---

## Promotion Channels

| Channel | Frequency | Content | Owner |
|---------|-----------|---------|-------|
| Email | Launch + weekly | Program updates | Marketing |
| In-app | Persistent | Banner + dashboard | Product |
| LinkedIn | 2x/week | Success stories | CEO |
| Communities | 1x/week | Program announcement | Marketing |
| Blog | 1x/month | Top referrer spotlight | Content |

---

## Success Metrics

| Metric | Target | Tracking |
|--------|--------|----------|
| Referral link clicks | 100/month | Analytics |
| Referral signups | 20/month | Database |
| Referral conversions | 5/month | CRM |
| % customers from referrals | 20% | Analytics |
| CAC (referral) | <$100 | Finance |
| CAC (paid ads) | $500 | Finance |

---

## Anti-Fraud Measures

### Rules

1. **One referral per company** — Multiple accounts at same company don't count
2. **Self-referral prohibited** — Same email domain = no credit
3. **Minimum 30-day retention** — Referee must stay 30+ days for credit
4. **Valid email required** — Disposable emails don't count

### Detection

```typescript
function isValidReferral(referrer: Org, referee: Org): boolean {
  // Check email domain match
  if (referrer.emailDomain === referee.emailDomain) return false;

  // Check for self-referral (same IP, same device)
  if (referrer.ip === referee.ip) return false;

  // Check for duplicate referee
  if (isDuplicateReferee(referee.email)) return false;

  return true;
}
```

---

## Budget

| Item | Cost |
|------|------|
| Development | $0 (internal) |
| Email credits | $50/month |
| Top referrer bonus | $500/month |
| **Total** | **$550/month** |

**ROI Calculation:**
- 5 referrals/month × $499 = $2,495 MRR
- CAC: $550 / 5 = $110 (vs. $500 paid ads)
- Savings: $390 per customer

---

**Created:** 2026-03-20
**Launch Date:** Week 3 (2026-04-06)
**Owner:** Marketing Agent
