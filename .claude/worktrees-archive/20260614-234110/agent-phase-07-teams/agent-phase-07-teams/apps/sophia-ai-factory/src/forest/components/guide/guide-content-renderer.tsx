"use client";

import dynamic from "next/dynamic";

const ReactMarkdown = dynamic(() => import("react-markdown"), {
  ssr: false,
  loading: () => (
    <div className="space-y-4 motion-safe:animate-pulse">
      <div className="h-8 bg-muted/30 rounded w-3/4" />
      <div className="h-4 bg-muted/20 rounded w-full" />
      <div className="h-4 bg-muted/20 rounded w-5/6" />
      <div className="h-4 bg-muted/20 rounded w-4/5" />
    </div>
  ),
});

interface GuideContentRendererProps {
  content: string;
}

export function GuideContentRenderer({ content }: GuideContentRendererProps) {
  return (
    <div className="prose prose-invert max-w-none
      prose-headings:text-foreground prose-headings:font-bold
      prose-h1:text-3xl prose-h1:mb-6 prose-h1:pb-3 prose-h1:border-b prose-h1:border-border/40
      prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4
      prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3
      prose-p:text-muted-foreground prose-p:leading-relaxed
      prose-a:text-[var(--neon-cyan)] prose-a:no-underline hover:prose-a:underline
      prose-strong:text-foreground
      prose-code:text-[var(--neon-cyan)] prose-code:bg-muted/50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:before:content-none prose-code:after:content-none
      prose-pre:bg-muted/30 prose-pre:border prose-pre:border-border/40 prose-pre:rounded-xl
      prose-blockquote:border-[var(--neon-cyan)]/50 prose-blockquote:bg-[var(--neon-cyan)]/5 prose-blockquote:rounded-r-lg prose-blockquote:py-1 prose-blockquote:text-muted-foreground
      prose-table:border-collapse
      prose-th:bg-muted/30 prose-th:px-4 prose-th:py-2 prose-th:text-left prose-th:text-sm prose-th:font-semibold prose-th:text-foreground prose-th:border prose-th:border-border/40
      prose-td:px-4 prose-td:py-2 prose-td:text-sm prose-td:text-muted-foreground prose-td:border prose-td:border-border/40
      prose-li:text-muted-foreground prose-li:marker:text-[var(--neon-cyan)]
      prose-hr:border-border/40
    ">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}
