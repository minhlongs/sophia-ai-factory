/**
 * Handover Document Section Builders
 * Layer: tree/handover
 */

import type { Tier } from '@/seed/types';
import { TIER_MCU_LIMITS } from '@/tree/handover/handover-types';
import {
  TIER_PRICES,
  TIER_FEATURES,
  TIER_SUPPORT_SLA,
  TIER_CONCURRENT_RUNS,
} from '@/tree/handover/handover-tier-content';
import type { HandoverDocInput } from './types';

export function buildCoverSection(input: HandoverDocInput): string {
  const { agencyName, ownerFullName, ownerEmail, tier, customerId, contractDate } = input;
  return `# Welcome to Sophia AI — Onboarding Document\n\n---\n\n## Cover\n
| Field | Value |
|---|---|
| Agency | **${agencyName}** |
| Contact | ${ownerFullName} |
| Email | ${ownerEmail} |
| Tier | **${tier}** — ${TIER_PRICES[tier]} |
| Contract Date | ${contractDate} |
| Customer ID | \`${customerId}\` |
| Document Date | ${new Date().toISOString().split('T')[0]} |`;
}

export function buildAccountSection(input: HandoverDocInput): string {
  return `\n---\n\n## Account Access\n
| Field | Value |
|---|---|
| Login URL | https://sophia.agencyos.network/login |
| Your Email | ${input.ownerEmail} |
| First Access | Use magic link below (valid 24h) |

### Magic Link (One-Time Use)

> **Click the link in your welcome email, or paste below into your browser:**
> ${input.magicLinkUrl}
> **Important:** This link expires 24 hours from delivery. After first login, set your password in Settings.`;
}

export function buildTierSection(tier: Tier): string {
  const mcuLimit = TIER_MCU_LIMITS[tier].toLocaleString();
  return `\n---\n\n## Your Tier: ${tier}\n\n**Monthly Allowance:** ${mcuLimit} MCU (Media Compute Units)\n\n**Included Features:**\n${TIER_FEATURES[tier].map((f) => `- ${f}`).join('\n')}`;
}

export function buildSopsSection(installedSops: string[]): string {
  const sopList = installedSops.length > 0
    ? installedSops.map((s, i) => `${i + 1}. \`${s}\``).join('\n')
    : '_No SOPs pre-installed — select from marketplace after login._';
  return `\n---\n\n## Pre-Installed SOPs\n\nThe following SOP automations have been installed in your account:\n\n${sopList}\n\n> **Note:** SOPs are pre-installed but require your API keys before they can run.\n> Complete the setup steps below first.`;
}

export function buildSupportAndFaq(tier: Tier): string {
  return `\n---\n\n## Support\n
| Channel | Details |
|---|---|
| Email | support@mekongmind.com |
| Response SLA | ${TIER_SUPPORT_SLA[tier]} |
| Telegram Bot | @Sophia_Bbot |
| Help Center | https://sophia.agencyos.network/guide |

---\n\n## Quick Start Cheat Sheet\n
\`\`\`
1. Click magic link → set password
2. Settings → API Keys → add HeyGen key
3. Dashboard → SOPs → enable first SOP
4. Run SOP → watch video generate
5. Dashboard → monitor results
\`\`\`

---\n\n## FAQ\n
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
