/**
 * Handover document generator — produces a Markdown onboarding document
 * for new agency customers. Copy-paste friendly, phone-readable.
 * @module lib/handover/handover-doc-generator
 */

import type { Tier } from '@/seed/types';
import type { AgencyType } from '@/tree/handover/handover-types';
import { TIER_MCU_LIMITS } from '@/tree/handover/handover-types';
import { TIER_PRICES, TIER_FEATURES, TIER_SUPPORT_SLA, TIER_CONCURRENT_RUNS } from '@/tree/handover/handover-tier-content';

export interface HandoverDocInput {
  customerId: string;
  agencyName: string;
  ownerFullName: string;
  ownerEmail: string;
  tier: Tier;
  agencyType: AgencyType;
  locale: string;
  installedSops: string[];
  magicLinkUrl: string;
  contractDate: string;
}

function buildCoverSection(input: HandoverDocInput): string {
  const { agencyName, ownerFullName, ownerEmail, tier, customerId, contractDate } = input;
  return `# Welcome to Sophia AI — Onboarding Document

---

## Cover

| Field | Value |
|-------|-------|
| Agency | **${agencyName}** |
| Contact | ${ownerFullName} |
| Email | ${ownerEmail} |
| Tier | **${tier}** — ${TIER_PRICES[tier]} |
| Contract Date | ${contractDate} |
| Customer ID | \`${customerId}\` |
| Document Date | ${new Date().toISOString().split('T')[0]} |`;
}

function buildAccountSection(input: HandoverDocInput): string {
  const { ownerEmail, magicLinkUrl } = input;
  return `
---

## Account Access

| Field | Value |
|-------|-------|
| Login URL | https://sophia.agencyos.network/login |
| Your Email | ${ownerEmail} |
| First Access | Use magic link below (valid 24h) |

### Magic Link (One-Time Use)

> **Click the link in your welcome email, or paste below into your browser:**
>
> ${magicLinkUrl}
>
> **Important:** This link expires 24 hours from delivery. After first login, set your password in Settings.`;
}

function buildTierSection(tier: Tier): string {
  const mcuLimit = TIER_MCU_LIMITS[tier].toLocaleString();
  const features = TIER_FEATURES[tier];
  return `
---

## Your Tier: ${tier}

**Monthly Allowance:** ${mcuLimit} MCU (Media Compute Units)

**Included Features:**
${features.map((f) => `- ${f}`).join('\n')}`;
}

function buildSopsSection(installedSops: string[]): string {
  const sopList = installedSops.length > 0
    ? installedSops.map((s, i) => `${i + 1}. \`${s}\``).join('\n')
    : '_No SOPs pre-installed — select from marketplace after login._';
  return `
---

## Pre-Installed SOPs

The following SOP automations have been installed in your account:

${sopList}

> **Note:** SOPs are pre-installed but require your API keys before they can run.
> Complete the setup steps below first.`;
}

function buildSetupSection(): string {
  return `
---

## Required Setup Steps (Do These First)

### Step 1 — Set Your Password
After clicking the magic link, go to **Settings → Security → Change Password**.

### Step 2 — Add HeyGen API Key
1. Sign up at https://heygen.com
2. Go to Settings → API → Create API Key
3. In Sophia: **Settings → API Keys → HeyGen** → Paste key → Save
4. Click "Test Connection"

### Step 3 — Configure Resend (Email SOPs)
1. Sign up at https://resend.com
2. Create API key (full access)
3. In Sophia: **Settings → API Keys → Resend** → Paste key → Save

### Step 4 — Configure NOWPayments (Optional — Reseller Mode)
1. Sign up at https://nowpayments.io
2. Create a payment wallet
3. In Sophia: **Settings → API Keys → NOWPayments** → Paste key

### Step 5 — Enable Your First SOP
1. Go to **Dashboard → SOPs**
2. Click any pre-installed SOP
3. Click **Enable** → Follow setup wizard
4. Click **Run Now** to test

### Step 6 — Verify HeyGen Connection
1. Go to **Settings → Integrations → HeyGen**
2. Click **Test Connection**
3. Should show: ✅ Connected

### Step 7 — Watch Your First Video Generate
After running a SOP, go to **Dashboard → Videos** to see results.

### Step 8 — Set Up Notifications
Go to **Settings → Notifications** to configure Telegram or email alerts.`;
}

function buildSupportAndFaq(tier: Tier): string {
  return `
---

## Support

| Channel | Details |
|---------|---------|
| Email | support@mekongmind.com |
| Response SLA | ${TIER_SUPPORT_SLA[tier]} |
| Telegram Bot | @Sophia_Bbot |
| Help Center | https://sophia.agencyos.network/guide |

---

## Quick Start Cheat Sheet

\`\`\`
1. Click magic link → set password
2. Settings → API Keys → add HeyGen key
3. Dashboard → SOPs → enable first SOP
4. Run SOP → watch video generate
5. Dashboard → monitor results
\`\`\`

---

## FAQ

**Q: How many SOPs can I run simultaneously?**
A: ${TIER_CONCURRENT_RUNS[tier]}.

**Q: What happens when I run out of MCU?**
A: SOPs pause automatically. You can purchase additional credits or upgrade your tier.

**Q: Can I bring my own AI models?**
A: Yes — Sophia is BYOK (Bring Your Own Keys). All your API keys stay in your account.

**Q: How do I upgrade my tier?**
A: Go to Dashboard → Billing → Upgrade Plan.

**Q: Can I get a refund?**
A: Contact support@mekongmind.com within 7 days of charge.`;
}

/** Generate Markdown handover document */
export function generateHandoverDoc(input: HandoverDocInput): string {
  const { customerId, tier, contractDate } = input;
  const price = TIER_PRICES[tier];

  return [
    buildCoverSection(input),
    buildAccountSection(input),
    buildTierSection(tier),
    buildSopsSection(input.installedSops),
    buildSetupSection(),
    `
---

## Required API Keys Summary

| Service | Required | Where to Get |
|---------|----------|--------------|
| HeyGen | **Yes** | heygen.com → Settings → API |
| Resend | Yes (email SOPs) | resend.com → API Keys |
| NOWPayments | Optional | nowpayments.io → Dashboard |
| OpenRouter | Optional | openrouter.ai → Keys |`,
    buildSupportAndFaq(tier),
    `
---

## Contract Details

- **Tier:** ${tier} — ${price}
- **Contract Date:** ${contractDate}
- **Billing:** Monthly, auto-renew
- **Customer ID:** \`${customerId}\`

---

*Document generated by Sophia AI Factory — ${new Date().toISOString()}*
*Keep this document secure — it contains your one-time access credentials.*
`,
  ].join('');
}
