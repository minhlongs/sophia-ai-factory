/**
 * Reproducible Markdown renderer for B4 First-Value Economic Benchmark reports.
 *
 * @module land/eval/first-value-benchmark/report-markdown
 */

import type { BenchmarkReport } from './report-builder';
import { formatMicroUsdAsUsd } from './telemetry-and-economics';
import { BENCHMARK_ARMS } from './types';

export function renderBenchmarkReportMarkdown(report: BenchmarkReport): string {
  const lines = [
    `# B4 First-Value Economic Benchmark Report (${report.config.configVersion})`,
    `- Dataset SHA-256: \`${report.config.datasetSha256}\``,
    `- Rubric SHA-256: \`${report.config.rubricSha256}\``,
    `- Execution Mode: \`${report.config.mode}\``,
    `- Comparative Quality: \`${report.comparativeQualityStatus}\``,
    `- Real Inference Cost: \`${report.realInferenceCostStatus}\``,
    `- Customer Acceptance: \`${report.customerAcceptanceStatus}\``,
    `- Provenance SHA-256: \`${report.provenanceSha256}\``,
    '',
  ];
  for (const armId of BENCHMARK_ARMS) {
    const arm = report.arms[armId];
    const costStr =
      arm.costPerAcceptedDeliverable.status === 'COMPUTED'
        ? formatMicroUsdAsUsd(arm.costPerAcceptedDeliverable.microUsd)
        : arm.costPerAcceptedDeliverable.status;
    lines.push(
      `## ${armId}`,
      `- Trials: ${arm.totalTrials} (fixture=${arm.fixtureSimulatedTrials}, live=${arm.liveObservedTrials})`,
      `- Human Accepted: ${arm.acceptedHumanCount}/${arm.scoredTrialsHuman}`,
      `- Real Paid Inference Cost: ${formatMicroUsdAsUsd(arm.totalRealPaidInferenceCostMicroUsd)}`,
      `- Cost per Accepted Deliverable: ${costStr}`,
      `- Contribution Margin: ${arm.contributionPerAcceptedDeliverable.status}`,
      '',
    );
  }
  return lines.join('\n');
}
