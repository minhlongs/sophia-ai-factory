/**
 * DailyBriefingCard Section Parsing & Icon Helpers
 *
 * @module forest/components/agents/daily-briefing-helpers
 */

import React from 'react';
import { TrendingUp, AlertTriangle, Activity } from 'lucide-react';

export interface BriefingSection {
  heading: string;
  content: string;
}

/**
 * Split markdown text into sections by ## headings.
 * Returns an array of { heading, content } pairs.
 */
export function parseSections(rawText: string): BriefingSection[] {
  const sections: BriefingSection[] = [];
  const lines = rawText.split('\n');
  let currentHeading = '';
  let currentContent: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^##\s+(.+)/);
    if (headingMatch) {
      if (currentHeading || currentContent.length > 0) {
        sections.push({
          heading: currentHeading,
          content: currentContent.join('\n').trim(),
        });
      }
      currentHeading = headingMatch[1].trim();
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }

  // Push the last section
  if (currentHeading || currentContent.length > 0) {
    sections.push({
      heading: currentHeading,
      content: currentContent.join('\n').trim(),
    });
  }

  return sections;
}

/**
 * Get the icon for a section heading.
 */
export function getSectionIcon(heading: string): React.ReactNode {
  const lower = heading.toLowerCase();

  if (lower.includes('revenue') || lower.includes('doanh thu')) {
    return <TrendingUp className="w-4 h-4 text-emerald-500" />;
  }
  if (lower.includes('campaign') || lower.includes('chiến dịch')) {
    return <Activity className="w-4 h-4 text-blue-500" />;
  }
  if (lower.includes('issue') || lower.includes('vấn đề')) {
    return <AlertTriangle className="w-4 h-4 text-amber-500" />;
  }

  return <Activity className="w-4 h-4 text-muted-foreground" />;
}

/**
 * Determine if a heading is the summary section (rendered differently).
 */
export function isSummarySection(heading: string): boolean {
  const lower = heading.toLowerCase();
  return lower.includes('summary') || lower.includes('tóm tắt');
}
