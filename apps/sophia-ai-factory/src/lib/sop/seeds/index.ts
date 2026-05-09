/**
 * SOP Seed Registry — 31 official playbooks + 5 legacy seeds
 *
 * All entries exported as SOP_SEEDS for SQL generation.
 * New playbooks live in seeds/playbooks/{category}/*.ts
 */

// --- Playbook imports: content (9) ---
import * as videoGenerationStarter from './playbooks/content/video-generation-starter';
import * as dailyTiktok3x from './playbooks/content/daily-tiktok-3x';
import * as weeklyYoutubeLongform from './playbooks/content/weekly-youtube-longform';
import * as dailyInstagramReels from './playbooks/content/daily-instagram-reels';
import * as multiChannelCrosspost from './playbooks/content/multi-channel-crosspost';
import * as autoSubtitleTranslate from './playbooks/content/auto-subtitle-translate';
import * as voiceCloneNarration from './playbooks/content/voice-clone-narration';
import * as brandedIntroOutro from './playbooks/content/branded-intro-outro';
import * as evergreenContentRecycle from './playbooks/content/evergreen-content-recycle';

// --- Playbook imports: leads (5) ---
import * as dailyLeadEnrichment from './playbooks/leads/daily-lead-enrichment';
import * as reactiveFormLead from './playbooks/leads/reactive-form-lead';
import * as linkedinOutreach from './playbooks/leads/linkedin-outreach';
import * as coldEmailWarmup from './playbooks/leads/cold-email-warmup';
import * as icpScoring from './playbooks/leads/icp-scoring';

// --- Playbook imports: email (5) ---
import * as welcomeDrip7day from './playbooks/email/welcome-drip-7day';
import * as reengagementCampaign from './playbooks/email/reengagement-campaign';
import * as weeklyNewsletter from './playbooks/email/weekly-newsletter';
import * as abandonedCartRecovery from './playbooks/email/abandoned-cart-recovery';
import * as birthdayMilestone from './playbooks/email/birthday-milestone';

// --- Playbook imports: sales (4) ---
import * as proposalAutoPilot from './playbooks/sales/proposal-auto-pilot';
import * as quoteGenerator from './playbooks/sales/quote-generator';
import * as postDemoFollowup from './playbooks/sales/post-demo-followup';
import * as winLossAnalysis from './playbooks/sales/win-loss-analysis';

// --- Playbook imports: social (4) ---
import * as dailyLinkedinPost from './playbooks/social/daily-linkedin-post';
import * as weeklyTwitterThread from './playbooks/social/weekly-twitter-thread';
import * as tiktokHookAbTest from './playbooks/social/tiktok-hook-ab-test';
import * as commentAutoReply from './playbooks/social/comment-auto-reply';

// --- Playbook imports: analytics (3) ---
import * as weeklyPerformanceReport from './playbooks/analytics/weekly-performance-report';
import * as monthlyDashboardPdf from './playbooks/analytics/monthly-dashboard-pdf';
import * as dailyAnomalyAlerts from './playbooks/analytics/daily-anomaly-alerts';

// --- Playbook imports: crisis (2) ---
import * as mentionMonitorRespond from './playbooks/crisis/mention-monitor-respond';
import * as negativeReviewClassify from './playbooks/crisis/negative-review-classify';

/** Unified seed entry including new no-code fields */
export interface SopSeedEntry {
  slug: string;
  nameVi: string;
  nameEn: string;
  descVi: string;
  descEn: string;
  category: string;
  creditsPerRun: number;
  agentsYaml: string;
  playbookMd: string;
  outputSchema: string;
  /** JSON Schema string describing the no-code form fields */
  configSchema?: string;
  /** JSON object string with default form values */
  configDefaults?: string;
  /** Minutes to set up (shown in UI) */
  setupTimeMinutes?: number;
  /** 1 = show in featured section */
  isFeatured?: 0 | 1;
}

export const SOP_SEEDS: SopSeedEntry[] = [
  // Content (9)
  videoGenerationStarter.template,
  dailyTiktok3x.template,
  weeklyYoutubeLongform.template,
  dailyInstagramReels.template,
  multiChannelCrosspost.template,
  autoSubtitleTranslate.template,
  voiceCloneNarration.template,
  brandedIntroOutro.template,
  evergreenContentRecycle.template,

  // Leads (5)
  dailyLeadEnrichment.template,
  reactiveFormLead.template,
  linkedinOutreach.template,
  coldEmailWarmup.template,
  icpScoring.template,

  // Email (5)
  welcomeDrip7day.template,
  reengagementCampaign.template,
  weeklyNewsletter.template,
  abandonedCartRecovery.template,
  birthdayMilestone.template,

  // Sales (4)
  proposalAutoPilot.template,
  quoteGenerator.template,
  postDemoFollowup.template,
  winLossAnalysis.template,

  // Social (4)
  dailyLinkedinPost.template,
  weeklyTwitterThread.template,
  tiktokHookAbTest.template,
  commentAutoReply.template,

  // Analytics (3)
  weeklyPerformanceReport.template,
  monthlyDashboardPdf.template,
  dailyAnomalyAlerts.template,

  // Crisis (2)
  mentionMonitorRespond.template,
  negativeReviewClassify.template,
];
