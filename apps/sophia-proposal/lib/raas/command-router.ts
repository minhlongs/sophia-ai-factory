/**
 * RaaS Command Router
 *
 * Maps OpenClaw command strings to actual execution functions.
 * Stub commands delegated to command-helpers.ts; real commands inline.
 */

import { getD1Client } from '@/lib/db/client';
import { generateBlogReview } from '@/lib/affiliate/content/blog-generator';
import { generateSocialBundle } from '@/lib/affiliate/content/social-generator';
import { generateContent } from '@/lib/ai/claude-proposal-generator';
import { runScrape } from '@/lib/affiliate/program-scraper';
import type { Mission, MissionResult } from '@/types/raas';
import type { AffiliateProgram } from '@/types/affiliate';
import {
  runProposalCreate,
  runVideoCreate,
  runCrmSync,
  runAnalyticsExport,
  runGtmCampaign,
  runSalesBattlecard,
} from './command-helpers';
import {
  runProposalDeck,
  runRoiCalculator,
  runCompetitorAnalysis,
  runPricingOptimizer,
  runOutreachSequence,
} from './sales-commands';
import { runLeadGenerate, runEmailSend } from './lead-email-commands';

// ============================================================================
// MAIN ROUTER
// ============================================================================

/**
 * Execute the command specified in a mission.
 * Returns { success, data, error } — never throws.
 */
export async function executeCommand(mission: Mission): Promise<MissionResult> {
  try {
    switch (mission.command) {
      case 'proposal:create':
        return await runProposalCreate(mission);

      case 'video:create':
        return await runVideoCreate(mission);

      case 'affiliate:generate':
        return await runAffiliateGenerate(mission);

      case 'affiliate:scrape':
        return await runAffiliateScrape();

      case 'content:blog':
        return await runContentBlog(mission);

      case 'content:social':
        return await runContentSocial(mission);

      case 'crm:sync':
        return await runCrmSync(mission);

      case 'analytics:export':
        return await runAnalyticsExport(mission);

      case 'gtm:campaign':
        return await runGtmCampaign(mission);

      case 'sales:battlecard':
        return await runSalesBattlecard(mission);

      case 'sales:proposal-deck':
        return await runProposalDeck(mission);

      case 'sales:roi-calculator':
        return await runRoiCalculator(mission);

      case 'sales:competitor-analysis':
        return await runCompetitorAnalysis(mission);

      case 'sales:pricing-optimizer':
        return await runPricingOptimizer(mission);

      case 'sales:outreach-sequence':
        return await runOutreachSequence(mission);

      case 'lead:generate':
        return await runLeadGenerate(mission);

      case 'email:send':
        return await runEmailSend(mission);

      default:
        return { success: false, error: `Unknown command: ${mission.command}` };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

// ============================================================================
// WORKING COMMAND IMPLEMENTATIONS
// ============================================================================

async function runAffiliateGenerate(mission: Mission): Promise<MissionResult> {
  const db = await getD1Client();
  const { program_id } = mission.params as { program_id?: string };

  if (!program_id) {
    return { success: false, error: 'Missing params.program_id' };
  }

  const { data: program, error } = await db
    .from<AffiliateProgram>('affiliate_programs')
    .select('*')
    .eq('id', program_id)
    .single();

  if (error || !program) {
    return { success: false, error: 'Affiliate program not found' };
  }

  const programData = {
    id: program.id,
    name: program.name,
    description: program.description ?? '',
    category: program.niche,
    website_url: program.url,
    affiliate_url: program.signup_url ?? program.url,
    commission_rate: program.commission_rate,
  };

  const [blog, social] = await Promise.all([
    generateBlogReview(programData, mission.org_id),
    generateSocialBundle(programData, mission.org_id),
  ]);

  return {
    success: true,
    summary: `Generated blog + social bundle for ${program.name}`,
    data: { blog, social },
  };
}

async function runAffiliateScrape(): Promise<MissionResult> {
  const result = await runScrape();
  return {
    success: true,
    summary: `Scrape complete: ${result.inserted} inserted, ${result.updated} updated`,
    data: result as unknown as Record<string, unknown>,
  };
}

async function runContentBlog(mission: Mission): Promise<MissionResult> {
  const { topic, affiliate_program_id } = mission.params as {
    topic?: string;
    affiliate_program_id?: string;
  };

  if (affiliate_program_id) {
    const db = await getD1Client();
    const { data: program } = await db
      .from<AffiliateProgram>('affiliate_programs')
      .select('*')
      .eq('id', affiliate_program_id)
      .single();

    if (program) {
      const blog = await generateBlogReview(
        {
          id: program.id,
          name: program.name,
          description: program.description ?? '',
          category: program.niche,
          website_url: program.url,
          affiliate_url: program.signup_url ?? program.url,
          commission_rate: program.commission_rate,
        },
        mission.org_id
      );
      return { success: true, summary: `Blog post created: ${blog.title}`, data: { blog } };
    }
  }

  // No affiliate program — use Claude AI to generate blog content
  const aiContent = await generateContent('blog', {
    topic,
    company: (mission.params as Record<string, string>).company,
    tone: (mission.params as Record<string, string>).tone,
    target_audience: (mission.params as Record<string, string>).target_audience,
  });

  return {
    success: true,
    summary: `Blog post created: ${aiContent.title}`,
    data: { blog: aiContent },
  };
}

async function runContentSocial(mission: Mission): Promise<MissionResult> {
  const { affiliate_program_id } = mission.params as { affiliate_program_id?: string };

  if (affiliate_program_id) {
    const db = await getD1Client();
    const { data: program } = await db
      .from<AffiliateProgram>('affiliate_programs')
      .select('*')
      .eq('id', affiliate_program_id)
      .single();

    if (program) {
      const social = await generateSocialBundle(
        {
          id: program.id,
          name: program.name,
          description: program.description ?? '',
          category: program.niche,
          website_url: program.url,
          affiliate_url: program.signup_url ?? program.url,
          commission_rate: program.commission_rate,
        },
        mission.org_id
      );
      return { success: true, summary: 'Social bundle created', data: { social } };
    }
  }

  // No affiliate program — use Claude AI to generate social content
  const aiSocial = await generateContent('social', {
    topic: (mission.params as Record<string, string>).topic,
    company: (mission.params as Record<string, string>).company,
    tone: (mission.params as Record<string, string>).tone,
    target_audience: (mission.params as Record<string, string>).target_audience,
  });

  return {
    success: true,
    summary: `Social bundle created: ${aiSocial.title}`,
    data: { social: aiSocial },
  };
}
