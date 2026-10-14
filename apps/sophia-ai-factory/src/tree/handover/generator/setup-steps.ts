/**
 * Handover Document Setup Steps
 *
 * Layer: tree/handover
 */

export function buildSetupSection(): string {
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
