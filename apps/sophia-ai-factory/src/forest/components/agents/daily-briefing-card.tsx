/**
 * DailyBriefingCard — Displays the CEO Agent daily briefing as a card.
 *
 * SERVER COMPONENT — renders pre-generated briefing content.
 * If briefing is null, renders nothing (feature quietly unavailable).
 */

import React from 'react';
import { BrainCircuit, TrendingUp, AlertTriangle, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/seed/components/ui/card';
import type { DailyBriefing } from '@/forest/agents/daily-briefing/briefing-types';

// ── Props ──────────────────────────────────────────────────────────────────────

interface DailyBriefingCardProps {
  /** The generated briefing, or null if unavailable. */
  briefing: DailyBriefing | null;
}

// ── Render helpers ─────────────────────────────────────────────────────────────

/**
 * Split markdown text into sections by ## headings.
 * Returns an array of { heading, content } pairs.
 */
function parseSections(rawText: string): Array<{ heading: string; content: string }> {
  const sections: Array<{ heading: string; content: string }> = [];
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
function getSectionIcon(heading: string): React.ReactNode {
  const lower = heading.toLowerCase();

  if (lower.includes('revenue') || lower.includes('doanh thu')) {
    return <TrendingUp className="w-4 h-4 text-emerald-500" />;
  }
  if (lower.includes('campaign') || lower.includes('chiến dịch')) {
    return <Activity className="w-4 h-4 text-primary" />;
  }
  if (lower.includes('issue') || lower.includes('vấn đề') || lower.includes('issue')) {
    return <AlertTriangle className="w-4 h-4 text-amber-500" />;
  }

  return <Activity className="w-4 h-4 text-muted-foreground" />;
}

/**
 * Determine if a heading is the summary section (rendered differently).
 */
function isSummarySection(heading: string): boolean {
  const lower = heading.toLowerCase();
  return lower.includes('summary') || lower.includes('tóm tắt');
}

// ── Component ──────────────────────────────────────────────────────────────────

export function DailyBriefingCard({ briefing }: DailyBriefingCardProps) {
  if (!briefing || !briefing.generated) {
    return null;
  }

  const sections = parseSections(briefing.rawText);
  const summarySection = sections.find((s) => isSummarySection(s.heading));
  const mainSections = sections.filter((s) => !isSummarySection(s.heading));

  // Format the generated timestamp
  const generatedTime = new Date(briefing.generatedAt).toLocaleTimeString(
    briefing.locale === 'vi' ? 'vi-VN' : 'en-US',
    { hour: '2-digit', minute: '2-digit' },
  );

  return (
    <Card className="border border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BrainCircuit className="w-5 h-5 text-primary" />
            <CardTitle className="text-sm font-medium">
              {briefing.locale === 'vi'
                ? 'Báo Cáo Sáng CEO Agent'
                : 'CEO Agent Morning Briefing'}
            </CardTitle>
          </div>
          <span className="text-xs text-muted-foreground">
            {generatedTime}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Main sections */}
        {mainSections.map((section, index) => (
          <div key={index} className="space-y-1">
            <div className="flex items-center gap-1.5">
              {getSectionIcon(section.heading)}
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide">
                {section.heading}
              </h4>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {section.content}
            </p>
          </div>
        ))}

        {/* Summary callout */}
        {summarySection && (
          <div className="mt-4 pt-3 border-t border-border">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              <p className="text-sm font-medium text-foreground italic">
                {summarySection.content}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
