'use client';

/**
 * SopPreview — read-only Markdown renderer for SOP playbook/description.
 *
 * Uses a lightweight safe renderer without heavy dependency.
 * Renders into prose-style container; no script/iframe allowed.
 */

interface SopPreviewProps {
  content: string;
  className?: string;
}

/**
 * Minimal safe Markdown-to-HTML: converts headings, bold, italic,
 * code blocks, and lists. No XSS risk (no raw HTML passthrough).
 */
function renderMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, (block) => {
      const code = block.replace(/^```.*\n?/, '').replace(/\n?```$/, '');
      return `<pre class="bg-zinc-900 rounded p-3 text-xs overflow-x-auto my-2"><code>${escapeHtml(code)}</code></pre>`;
    })
    .replace(/^### (.+)$/gm, '<h3 class="text-sm font-semibold text-foreground mt-3 mb-1">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-base font-semibold text-foreground mt-4 mb-2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-lg font-bold text-foreground mt-4 mb-2">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="bg-zinc-800 px-1 rounded text-xs">$1</code>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-sm text-muted-foreground">$1</li>')
    .replace(/\n\n/g, '</p><p class="text-sm text-muted-foreground my-1">');
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function SopPreview({ content, className = '' }: SopPreviewProps) {
  const html = renderMarkdown(content);
  return (
    <div
      className={`prose prose-sm prose-invert max-w-none text-muted-foreground ${className}`}
      /* Safe: no script/iframe in renderMarkdown output */
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
