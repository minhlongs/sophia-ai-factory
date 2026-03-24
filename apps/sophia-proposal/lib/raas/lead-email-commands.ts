/**
 * Lead & Email RaaS commands for $1M ARR sales pipeline.
 *
 * Commands:
 *   lead:generate — AI-powered prospect research via LeadHunter
 *   email:send    — Send outreach email via Resend
 */

import { getD1Client } from '@/lib/db/client';
import { generateLeads } from '@/lib/ai/lead-hunter';
import { sendEmail } from '@/lib/email/sender';
import type { Mission, MissionResult } from '@/types/raas';

// ── lead:generate ────────────────────────────────────────────────────────────

export async function runLeadGenerate(mission: Mission): Promise<MissionResult> {
  const params = mission.params as {
    industry?: string;
    company_size?: string;
    region?: string;
    pain_points?: string[];
    max_leads?: number;
  };

  if (!params.industry) {
    return { success: false, error: 'Missing params.industry' };
  }

  const result = await generateLeads({
    industry: params.industry,
    company_size: params.company_size,
    region: params.region,
    pain_points: params.pain_points,
    max_leads: params.max_leads,
  });

  // Persist leads to database
  const db = await getD1Client();
  let savedCount = 0;
  for (const lead of result.leads) {
    try {
      await db.from('leads').insert({
        org_id: mission.org_id,
        company_name: lead.company_name,
        industry: lead.industry,
        estimated_size: lead.estimated_size,
        decision_maker_title: lead.decision_maker_title,
        pain_points: JSON.stringify(lead.pain_points),
        fit_score: lead.fit_score,
        approach_angle: lead.approach_angle,
        suggested_first_touch: lead.suggested_first_touch,
        source: 'lead-hunter-ai',
        status: 'new',
        created_at: new Date().toISOString(),
      });
      savedCount++;
    } catch (err) {
      console.error(`[LeadHunter] Failed to save lead "${lead.company_name}":`, err);
    }
  }

  return {
    success: true,
    summary: `Generated ${result.leads.length} leads (${savedCount} saved) for ${params.industry}`,
    data: {
      leads: result.leads,
      icp_summary: result.icp_summary,
      saved_count: savedCount,
    },
  };
}

// ── email:send ───────────────────────────────────────────────────────────────

export async function runEmailSend(mission: Mission): Promise<MissionResult> {
  const params = mission.params as {
    to: string;
    subject: string;
    body: string;
    reply_to?: string;
  };

  if (!params.to || !params.subject) {
    return { success: false, error: 'Missing params.to or params.subject' };
  }

  // Basic email format validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(params.to)) {
    return { success: false, error: 'Invalid email format' };
  }

  const result = await sendEmail({
    to: params.to,
    subject: params.subject,
    text: params.body,
    replyTo: params.reply_to,
    tags: [
      { name: 'mission_id', value: mission.id },
      { name: 'org_id', value: mission.org_id },
    ],
  });

  if (!result.success) {
    return { success: false, error: result.error ?? 'Email send failed' };
  }

  return {
    success: true,
    summary: `Email sent to ${params.to}: "${params.subject}"`,
    data: {
      message_id: result.messageId,
      provider: result.provider,
      to: params.to,
    },
  };
}
