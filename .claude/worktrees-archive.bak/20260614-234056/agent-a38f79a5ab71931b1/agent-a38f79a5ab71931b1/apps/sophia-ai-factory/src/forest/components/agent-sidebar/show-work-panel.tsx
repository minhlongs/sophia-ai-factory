/**
 * Show Work Panel — collapsible reasoning block per message
 *
 * Displays the <think> content extracted from R1/DeepSeek responses.
 * Collapsed by default per spec.
 *
 * @module components/agent-sidebar/show-work-panel
 */

'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Brain } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface ShowWorkPanelProps {
  reasoning: string;
}

export function ShowWorkPanel({ reasoning }: ShowWorkPanelProps) {
  const [open, setOpen] = useState(false);
  const t = useTranslations('agentChat');

  return (
    <div className="mt-1 rounded border border-border/60 bg-muted/30">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        aria-expanded={open}
      >
        <Brain className="h-3 w-3 flex-shrink-0" />
        <span>{open ? t('hideWork') : t('showWork')}</span>
        {open ? (
          <ChevronDown className="ml-auto h-3 w-3" />
        ) : (
          <ChevronRight className="ml-auto h-3 w-3" />
        )}
      </button>
      {open && (
        <div className="border-t border-border/60 px-3 py-2">
          <pre className="whitespace-pre-wrap text-xs text-muted-foreground font-mono leading-relaxed">
            {reasoning}
          </pre>
        </div>
      )}
    </div>
  );
}
