/**
 * Script viewer — displays a generated script with its structural sections.
 * Pure presentational component.
 */

export interface ScriptSection {
  readonly label: string;
  readonly content: string;
}

export interface ScriptData {
  readonly id: string;
  readonly title: string;
  readonly hook?: string | null;
  readonly introduction?: string | null;
  readonly mainContent?: string | null;
  readonly conclusion?: string | null;
  readonly callToAction?: string | null;
  readonly duration?: string | null;
  readonly tone?: string | null;
  readonly pacing?: string | null;
  readonly sections?: readonly ScriptSection[];
}

interface ScriptViewerProps {
  script: ScriptData;
}

function ScriptBlock({ label, content }: { label: string; content: string }) {
  if (!content) return null;
  return (
    <div className="rounded-md border border-border bg-muted/30 p-3">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </h4>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
        {content}
      </p>
    </div>
  );
}

export function ScriptViewer({ script }: ScriptViewerProps) {
  const sections: readonly ScriptSection[] =
    script.sections ??
    [
      script.hook ? { label: 'Hook', content: script.hook } : null,
      script.introduction ? { label: 'Introduction', content: script.introduction } : null,
      script.mainContent ? { label: 'Main Content', content: script.mainContent } : null,
      script.conclusion ? { label: 'Conclusion', content: script.conclusion } : null,
      script.callToAction ? { label: 'Call to Action', content: script.callToAction } : null,
    ].filter((s): s is ScriptSection => s !== null);

  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-foreground">{script.title}</h3>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          {script.duration ? <span>Duration: {script.duration}</span> : null}
          {script.tone ? <span>Tone: {script.tone}</span> : null}
          {script.pacing ? <span>Pacing: {script.pacing}</span> : null}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {sections.map((section) => (
          <ScriptBlock key={section.label} label={section.label} content={section.content} />
        ))}
      </div>
    </div>
  );
}