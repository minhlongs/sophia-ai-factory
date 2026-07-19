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
 * code blocks, and lists.
 *
 * Security: all content is HTML-entity-escaped BEFORE markdown regex
 * transformations to prevent XSS via injected tags.
 */
function renderMarkdown(md: string): string {
  // 1. Extract code blocks into placeholders (they get their own escaping).
  const codeBlocks: string[] = [];
  let processed = md.replace(/```[\s\S]*?```/g, (block) => {
    const code = block.replace(/^```.*\n?/, '').replace(/\n?```$/, '');
    const idx = codeBlocks.length;
    codeBlocks.push(
      `<pre class="bg-muted rounded p-3 text-xs overflow-x-auto my-2"><code>${escapeHtml(code)}</code></pre>`,
    );
    return `%%CODEBLOCK_${idx}%%`;
  });

  // 2. Escape HTML entities in all remaining content BEFORE markdown regexes.
  processed = escapeHtml(processed);

  // 3. Apply markdown-to-HTML transformations (content is now safe).
  processed = processed
    .replace(/^### (.+)$/gm, '<h3 class="text-sm font-semibold text-foreground mt-3 mb-1">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-base font-semibold text-foreground mt-4 mb-2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-lg font-bold text-foreground mt-4 mb-2">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="bg-muted/50 px-1 rounded text-xs">$1</code>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-sm text-muted-foreground">$1</li>')
    .replace(/\n\n/g, '</p><p class="text-sm text-muted-foreground my-1">');

  // 4. Restore code blocks from placeholders.
  codeBlocks.forEach((block, idx) => {
    processed = processed.replace(`%%CODEBLOCK_${idx}%%`, block);
  });

  return processed;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
