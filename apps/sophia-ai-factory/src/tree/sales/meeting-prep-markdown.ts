/**
 * Markdown Formatter for AI Meeting & Demo Prep Executive Sales Dossiers
 *
 * Layer: tree/sales
 *
 * @module tree/sales/meeting-prep-markdown
 */

import type {
  EnterpriseDeal,
  BattlecardItem,
} from '@/seed/types/enterprise-deal';

/**
 * Builds the executive dossier briefing in markdown format.
 */
export function formatDossierMarkdown(
  deal: EnterpriseDeal,
  companyOverview: string,
  keyStakeholders: string,
  painPointAnalysis: string,
  proposedSolutionBlueprint: string,
  commercialRecommendation: string,
  battlecards: BattlecardItem[],
): string {
  const battlecardSections = battlecards
    .map(
      (b) =>
        `#### Objection / Competitor: ${b.competitorOrObjection}\n- **Our Edge:** ${b.ourDifferentiator}\n- **Executive Response:** ${b.talkingPoint}`,
    )
    .join('\n\n');

  return `# Executive Sales Dossier: ${deal.companyName}
**Generated Date:** ${new Date().toISOString().split('T')[0]}
**Lead Contact:** ${deal.leadName} (${deal.leadTitle || 'Executive'}, ${deal.leadEmail})
**Pipeline Tier:** ${deal.pipelineTier.toUpperCase()} (BANT Score: ${deal.bantScore}/100)
**Estimated Annual Contract:** $${((deal.dealValueEstimateCents || 0) / 100).toLocaleString()} USD

---

## 1. Company & Stakeholder Snapshot
${companyOverview}

**Key Stakeholders & Decision Flow:**
${keyStakeholders}

---

## 2. Quantified Pain Points & Automation Opportunities
${painPointAnalysis}

---

## 3. Recommended Sophia AI Factory Solution Blueprint
${proposedSolutionBlueprint}

---

## 4. Competitive Battlecards & Objection Playbook
${battlecardSections}

---

## 5. Commercial Recommendation & Pilot Terms
${commercialRecommendation}
`;
}
