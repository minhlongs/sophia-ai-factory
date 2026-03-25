/**
 * Cold outreach email templates — 5-touch sequence for agency sales.
 * Used by sendOutreachSequence() in sender.ts.
 */

// Brand styling
const BRAND_COLOR = '#6750A4';

function wrapOutreach(body: string, senderName: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#1a1a1a;max-width:600px;margin:0 auto;padding:24px;">
${body}
<p style="margin-top:24px;">Best,<br/>${senderName}<br/><span style="font-size:13px;color:#666;">Sophia AI Factory</span></p>
</body></html>`;
}

export interface OutreachContext {
  companyName: string;
  contactName: string;
  senderName: string;
  pilotUrl: string;
  demoUrl: string;
  docsUrl: string;
}

export interface OutreachEmail {
  subject: string;
  html: string;
}

export interface OutreachSequenceStep {
  day: number;
  subject: string;
  body: string;
  channel: 'email';
}

// Email 1 (Day 0) — Pain point hook
export function outreachDay0(ctx: OutreachContext): OutreachEmail {
  return {
    subject: `${ctx.companyName} — 15 hours per proposal?`,
    html: wrapOutreach(`
      <p>Hi ${ctx.contactName},</p>
      <p>Saw ${ctx.companyName} is growing fast. Most agencies I talk to spend 15-25 hours on each client proposal.</p>
      <p>We built an API that generates SOW-ready proposals in <strong>30 seconds</strong>. One agency went from 34% to 78% proposal win rate.</p>
      <p><a href="${ctx.pilotUrl}" style="display:inline-block;background:${BRAND_COLOR};color:white;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600;">See a live demo →</a></p>
    `, ctx.senderName),
  };
}

// Email 2 (Day 3) — Social proof
export function outreachDay3(ctx: OutreachContext): OutreachEmail {
  return {
    subject: `Re: ${ctx.companyName} — 15 hours per proposal?`,
    html: wrapOutreach(`
      <p>Hi ${ctx.contactName},</p>
      <p>Quick follow-up. One agency using our tool went from 34% to 78% proposal win rate.</p>
      <p>The API handles proposals, battlecards, content, and lead gen — 17 AI commands total.</p>
      <p><strong>50% off for early adopters</strong> → <a href="${ctx.pilotUrl}" style="color:${BRAND_COLOR}">Apply for pilot</a></p>
    `, ctx.senderName),
  };
}

// Email 3 (Day 7) — Technical angle
export function outreachDay7(ctx: OutreachContext): OutreachEmail {
  return {
    subject: `curl -X POST sophia.ai/api/v1/missions`,
    html: wrapOutreach(`
      <p>Hi ${ctx.contactName},</p>
      <p>If your team is technical: one API call, 17 AI commands, TypeScript SDK.</p>
      <div style="background:#0a0f1a;color:#4ade80;padding:16px;border-radius:8px;font-family:monospace;font-size:13px;margin:16px 0;">
        curl -X POST ${ctx.docsUrl}/api/v1/missions \\<br/>
        &nbsp;&nbsp;-H "Authorization: Bearer sk_live_xxx" \\<br/>
        &nbsp;&nbsp;-d '{"command":"proposal:create"}'
      </div>
      <p><a href="${ctx.docsUrl}" style="color:${BRAND_COLOR}">API docs</a> · Free to try (200 MCU credits on signup).</p>
    `, ctx.senderName),
  };
}

// Email 4 (Day 10) — ROI angle
export function outreachDay10(ctx: OutreachContext): OutreachEmail {
  return {
    subject: `$450K in recaptured capacity`,
    html: wrapOutreach(`
      <p>Hi ${ctx.contactName},</p>
      <p>Quick math:</p>
      <ul>
        <li>100 proposals/year × 15 hours saved × $300/hour = <strong>$450K in freed capacity</strong></li>
        <li>Our Growth plan is $149/mo</li>
        <li>That's a <strong>3000:1 ROI</strong></li>
      </ul>
      <p>Pilot spots closing this week → <a href="${ctx.pilotUrl}" style="color:${BRAND_COLOR}">Apply now</a></p>
    `, ctx.senderName),
  };
}

// Email 5 (Day 14) — Last chance / urgency
export function outreachDay14(ctx: OutreachContext): OutreachEmail {
  return {
    subject: `Closing pilot spots Friday`,
    html: wrapOutreach(`
      <p>Hi ${ctx.contactName},</p>
      <p>Last 3 pilot spots at <strong>50% off</strong> ($75/mo for 6 months). After Friday, full price.</p>
      <p>Reply "in" and I'll set up your account today.</p>
      <p><a href="${ctx.pilotUrl}" style="display:inline-block;background:${BRAND_COLOR};color:white;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Claim your pilot spot →</a></p>
    `, ctx.senderName),
  };
}

// Full sequence config for use with sendOutreachSequence()
export const OUTREACH_SEQUENCE = [
  { day: 0, fn: outreachDay0 },
  { day: 3, fn: outreachDay3 },
  { day: 7, fn: outreachDay7 },
  { day: 10, fn: outreachDay10 },
  { day: 14, fn: outreachDay14 },
] as const;

export function generateOutreachSequence(ctx: OutreachContext): OutreachSequenceStep[] {
  return OUTREACH_SEQUENCE.map(step => {
    const { subject, html } = step.fn(ctx);
    return { day: step.day, subject, body: html, channel: 'email' as const };
  });
}
