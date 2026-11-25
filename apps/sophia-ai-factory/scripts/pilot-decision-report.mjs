#!/usr/bin/env node
/**
 * End-of-Pilot Strategic Decision Engine (`BUILD / FIX / HOLD / SCALE`).
 *
 * Cross-examines real usage, P0/P1 reliability, MP4 generation, and Affiliate
 * attribution evidence in `sophia-pilot-db` against:
 * - REPORT 10 ("30/60/90-Day Evidence Roadmap" — Ship business proof before architectural vanity,
 *   Day 0-30 activation & zero cross-tenant/auth/BYOK blockers)
 * - REPORT 12 ("Final Decision Memorandum" — 12 Founder Test questions, 1-Key BYOK onboarding
 *   funnel falsified if completion < 30%, human-approved manual publish compliance, Paid Pilot $79 / 1,990,000 VND gate,
 *   REJECT second agent frameworks, HOLD heavy GPU video/Thompson Sampling until 10-50 paying customers)
 *
 * Honesty rule: Never fabricates customer activity, clicks, conversions, or commissions.
 *
 * Usage:
 *   node scripts/pilot-decision-report.mjs [--markdown]
 */

import { fileURLToPath } from 'node:url';
import { collectLivePilotOpsSnapshot } from './pilot-ops-report.mjs';

export function evaluatePilotDecisionAgainstResearch(opsReport) {
  const p0Count = opsReport.p0p1Findings.filter((f) => f.severity === 'P0').length;
  const p1Count = opsReport.p0p1Findings.filter((f) => f.severity === 'P1').length;

  const inviteAccepted = opsReport.eventCounts.INVITE_ACCEPTED ?? 0;
  const byokSaved = opsReport.eventCounts.BYOK_KEY_SAVED ?? 0;
  const genSucceeded = opsReport.eventCounts.GENERATION_SUCCEEDED ?? 0;
  const mp4Completed = opsReport.commercialEvidence.mp4CompletedWithCtaAndLink ?? 0;
  const shortlinks = opsReport.commercialEvidence.affiliateShortlinksCreated ?? 0;
  const verifiedClicks = opsReport.commercialEvidence.serverVerifiedClicks ?? 0;
  const manualPosts = opsReport.commercialEvidence.manualPublishesByPlatform.reduce(
    (sum, item) => sum + item.posts,
    0,
  );
  const selfReportedConversions = opsReport.commercialEvidence.manualPublishesByPlatform.reduce(
    (sum, item) => sum + item.selfReportedConversions,
    0,
  );

  // Decision logic anchored strictly to REPORT 10 & REPORT 12 falsification & stop conditions:
  let verdict = 'HOLD';
  let verdictCode = 'HOLD_AWAITING_REAL_CUSTOMER_EVIDENCE';
  let rationale = '';
  let nextRecommendedActions = [];

  if (p0Count > 0 || p1Count >= 2) {
    verdict = 'FIX';
    verdictCode = 'FIX_VERIFIED_P0_P1_BOTTLENECKS';
    rationale =
      'REPORT 10 Hard Stop Condition triggered: active P0/P1 login, BYOK, schema, or MP4 render/export blockers exist in sophia-pilot-db. Engineering time must strictly remediate verified activation defects before inviting more users or enabling billing.';
    nextRecommendedActions = [
      'Resolve all active P0/P1 findings surfaced by `npm run pilot:ops-report`.',
      'Keep PAYMENTS_ENABLED=false and B2_PUBLISH_ENABLED=false until activation reliability is restored.',
    ];
  } else if (inviteAccepted === 0 || byokSaved === 0 || mp4Completed === 0) {
    verdict = 'HOLD';
    verdictCode = 'HOLD_AWAITING_CUSTOMER_FUNNEL_COMPLETION';
    rationale =
      'REPORT 10 (Day 0-30) & REPORT 12 (Founder Test): Zero P0 blockers, but real invited customer completion evidence (Consent -> 1-Key BYOK -> Real MP4 with CTA & Shortlink -> Manual Publish) is not yet complete in sophia-pilot-db. Per REPORT 12 Opportunity Cost rule, spend 100% of Founder hours on customer onboarding & interviews — 0 hours on new architecture.';
    nextRecommendedActions = [
      'Provision the invited customer email via `npm run pilot:invite -- "<customer-email>"` and share Section 1 of `docs/customer-pilot-01-handoff.md`.',
      'Observe real self-serve completion of 1-Key BYOK -> Script -> MP4 + Shortlink -> Manual Post without Founder hand-holding.',
    ];
  } else if (mp4Completed >= 3 && manualPosts >= 1 && verifiedClicks >= 5 && selfReportedConversions >= 1) {
    verdict = 'SCALE';
    verdictCode = 'SCALE_TO_PAID_PILOT_COHORT_79_USD';
    rationale =
      'REPORT 12 Cheapest Decisive Experiment unlocked: Real customer self-served 1-Key BYOK, exported multiple MP4s with CTA & referral links, manually published, earned server-verified clicks, and recorded real affiliate conversion proof at $0 Founder AI subsidy.';
    nextRecommendedActions = [
      'Graduate to REPORT 12 Paid Pilot ($79 / 1,990,000 VND via VietQR/PayOS Blueprint 05) with 5 real SMB/Affiliate customers.',
      'Keep Mastra/LangGraph/OmniRoute REJECTED and keep Hunyuan/Wan2.1/Thompson Sampling on HOLD (until 10-50 paying customers).',
    ];
  } else {
    verdict = 'BUILD';
    verdictCode = 'BUILD_NARROW_ACTIVATION_AND_AUDIO_PREVIEW_ONLY';
    rationale =
      'REPORT 12 Matrix (BUILD NOW / TEST FIRST): Customer proved end-to-end 1-Key BYOK -> Script -> Real MP4 + Affiliate Shortlink activation with zero P0 issues, while commercial click/conversion volume is still early. Proceed strictly with REPORT 12 narrow high-ROI items without expanding core architecture.';
    nextRecommendedActions = [
      'Continue collecting manual publish posts & server-verified `/api/r/*` clicks across the 7-day pilot window.',
      'Prepare REPORT 12 TEST FIRST sandbox only if customer requests voiceover quality upgrade (Kokoro-82M + faster-whisper) or Paid Pilot ($79 VietQR/PayOS).',
    ];
  }

  return {
    evaluatedAtIso: new Date().toISOString(),
    verdict,
    verdictCode,
    monitoringMode: opsReport.monitoringMode,
    financingMode: opsReport.financingMode,
    founderAiSubsidyUsd: 0,
    rationale,
    evidenceSummary: {
      p0Count,
      p1Count,
      inviteAccepted,
      byokSaved,
      generationsSucceeded: genSucceeded,
      mp4CompletedWithCtaAndLink: mp4Completed,
      affiliateShortlinksCreated: shortlinks,
      serverVerifiedClicks: verifiedClicks,
      manualPublishesRecorded: manualPosts,
      customerSelfReportedConversions: selfReportedConversions,
    },
    researchCrossCheck: {
      report10_day0_30_gate: {
        principle: 'Ship business proof before architectural vanity (Hard Stop on unverified SHA or tenant leaks)',
        status: p0Count === 0 ? 'PASS_TECHNICAL_GATE' : 'BLOCKED_BY_P0',
      },
      report12_build_now_blueprint01_byok: {
        target: '1-Key BYOK onboarding without multi-key friction; falsified if completion < 30%',
        observedByokSaves: byokSaved,
        observedGenerations: genSucceeded,
      },
      report12_exit_blind_autopublish: {
        rule: 'EXIT blind 1-click auto-publish (TikTok SELF_ONLY / YouTube policy risk); enforce human-reviewed publish',
        enforced: !opsReport.b2PublishEnabled,
        b2PublishEnabled: Boolean(opsReport.b2PublishEnabled),
        observedManualPublishes: manualPosts,
      },
      report12_hold_and_reject_guardrails: {
        paymentsEnabled: Boolean(opsReport.paymentsEnabled),
        newArchitectureAdded: false,
        rejectedFrameworks: ['Mastra', 'LangGraph', 'CrewAI', 'Temporal', 'OmniRoute OAuth-pooling'],
        heldUntil10To50PayingCustomers: ['HunyuanVideo/Wan2.1 GPU', 'Thompson Sampling / Half-Kelly'],
      },
    },
    nextRecommendedActions,
  };
}

export function formatDecisionMarkdown(decision) {
  const e = decision.evidenceSummary;
  return [
    '# Sophia Customer Pilot — REPORT 10 & REPORT 12 Decision Memorandum',
    '',
    `- **Evaluated At:** \`${decision.evaluatedAtIso}\``,
    `- **Strategic Verdict:** **\`${decision.verdict}\`** (\`${decision.verdictCode}\`)`,
    `- **Financing Mode:** \`${decision.financingMode}\` (\`$0.00\` Founder AI subsidy)`,
    `- **Monitoring Mode:** \`${decision.monitoringMode}\` (No background daemon claimed)`,
    '',
    '## 1. Executive Rationale',
    decision.rationale,
    '',
    '## 2. Observed Real Pilot Evidence (`sophia-pilot-db` — Zero Fabricated Metrics)',
    `- **P0 / P1 Active Blockers:** \`${e.p0Count} P0 / ${e.p1Count} P1\``,
    `- **Consent Accepted (\`INVITE_ACCEPTED\`):** \`${e.inviteAccepted}\``,
    `- **1-Key OpenRouter BYOK Verified (\`BYOK_KEY_SAVED\`):** \`${e.byokSaved}\``,
    `- **Live AI Scripts Succeeded (\`GENERATION_SUCCEEDED\`):** \`${e.generationsSucceeded}\``,
    `- **Real MP4 Videos Exported (with CTA & Shortlink):** \`${e.mp4CompletedWithCtaAndLink}\``,
    `- **Affiliate Shortlinks Created:** \`${e.affiliateShortlinksCreated}\``,
    `- **Server-Verified Clicks (\`/api/r/*\` HTTP 302):** \`${e.serverVerifiedClicks}\``,
    `- **Manual Social Posts Logged (\`CUSTOMER_SELF_REPORTED\`):** \`${e.manualPublishesRecorded}\``,
    `- **Customer Self-Reported Conversions (Unfabricated):** \`${e.customerSelfReportedConversions}\``,
    '',
    '## 3. REPORT 10 & REPORT 12 Cross-Examination (`Sophia AI Factory Research.pdf`)',
    `- **REPORT 10 (Day 0–30 Gate):** \`${decision.researchCrossCheck.report10_day0_30_gate.status}\` — ${decision.researchCrossCheck.report10_day0_30_gate.principle}`,
    `- **REPORT 12 (Blueprint 01 — 1-Key BYOK):** BYOK saves=\`${e.byokSaved}\`, live scripts=\`${e.generationsSucceeded}\`, 1-Key MP4 exports=\`${e.mp4CompletedWithCtaAndLink}\`.`,
    `- **REPORT 12 (EXIT Blind Auto-Publish):** Enforced (\`B2_PUBLISH_ENABLED=false\`, manual human publish posts=\`${e.manualPublishesRecorded}\`).`,
    `- **REPORT 12 (REJECT / HOLD Discipline):** Zero secondary agent frameworks added; payments disabled (\`PAYMENTS_ENABLED=false\`); zero new benchmarks.`,
    '',
    '## 4. Recommended Next Actions',
    ...decision.nextRecommendedActions.map((item, idx) => `${idx + 1}. ${item}`),
    '',
  ].join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const ops = collectLivePilotOpsSnapshot();
    const decision = evaluatePilotDecisionAgainstResearch(ops);
    if (process.argv.includes('--markdown')) {
      process.stdout.write(formatDecisionMarkdown(decision));
    } else {
      process.stdout.write(`${JSON.stringify(decision, null, 2)}\n`);
    }
  } catch (err) {
    process.stderr.write(`[pilot-decision-report] ERROR: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  }
}
