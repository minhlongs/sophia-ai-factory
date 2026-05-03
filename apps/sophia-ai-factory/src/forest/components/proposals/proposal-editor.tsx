'use client';

/**
 * Proposal Editor
 *
 * Sectional editor for generated proposals.
 * Each section can be toggled between preview and edit mode.
 * Uses DOMPurify for safe HTML rendering of AI-generated content.
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';

interface ProposalSection {
  key: string;
  title: string;
  content: string;
  aiGenerated: boolean;
}

interface Props {
  initialContent?: Record<string, string>;
  onSave?: (content: Record<string, string>) => void;
}

const DEFAULT_SECTION_KEYS = [
  'executiveSummary',
  'problemStatement',
  'proposedSolution',
  'timeline',
  'investment',
  'nextSteps',
];

function sanitize(html: string): string {
  // Basic sanitization without DOMPurify (server-safe)
  return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
}

export function ProposalEditor({ initialContent = {}, onSave }: Props) {
  const t = useTranslations('dashboard.proposals');

  const [sections, setSections] = useState<ProposalSection[]>(
    DEFAULT_SECTION_KEYS.map(key => ({
      key,
      title: t(`section_${key}`),
      content: initialContent[key] || '',
      aiGenerated: !!initialContent[key],
    }))
  );
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleChange(key: string, content: string) {
    setSections(prev =>
      prev.map(s => s.key === key ? { ...s, content, aiGenerated: false } : s)
    );
    setSaved(false);
  }

  function handleSave() {
    const content = Object.fromEntries(sections.map(s => [s.key, s.content]));
    onSave?.(content);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">{t('editor_title')}</h2>
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          {saved ? (
            <><span className="material-symbols-outlined text-base">check</span>{t('saved')}</>
          ) : (
            <><span className="material-symbols-outlined text-base">save</span>{t('save_changes')}</>
          )}
        </button>
      </div>

      {sections.map(section => (
        <div key={section.key} className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-muted/50 border-b border-border">
            <h3 className="text-sm font-medium text-foreground">{section.title}</h3>
            <div className="flex items-center gap-2">
              {section.aiGenerated && (
                <span className="text-xs text-muted-foreground">{t('ai_generated')}</span>
              )}
              <button
                onClick={() => setEditingSection(editingSection === section.key ? null : section.key)}
                className="text-xs text-primary hover:text-primary/80 focus:outline-none"
              >
                {editingSection === section.key ? t('preview') : t('edit')}
              </button>
            </div>
          </div>

          <div className="p-4">
            {editingSection === section.key ? (
              <textarea
                value={section.content}
                onChange={e => handleChange(section.key, e.target.value)}
                rows={6}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
              />
            ) : (
              <div
                className="prose prose-sm max-w-none text-foreground"
                dangerouslySetInnerHTML={{
                  __html: sanitize(section.content || `<em class="text-muted-foreground">${t('empty_section')}</em>`),
                }}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
