'use client';

/**
 * SSE stream reader and markdown report generator for AuditRunnerButton.
 * @module forest/components/audit/audit-runner-helpers
 */

import type { CheckResult } from '@/tree/audit/zero-gap-types';

export type RunState = 'idle' | 'running' | 'done' | 'error';

export interface AuditSummary {
  id: string;
  totalScore: number;
  totalChecks: number;
  passed: number;
  warned: number;
  failed: number;
}

export async function consumeAuditSseStream(
  body: ReadableStream<Uint8Array>,
  handlers: {
    onCheck: (check: CheckResult) => void;
    onComplete: (summary: AuditSummary) => void;
    onError: (message: string) => void;
  },
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split('\n\n');
    buffer = frames.pop() ?? '';

    for (const frame of frames) {
      if (!frame.trim()) continue;
      const eventMatch = frame.match(/^event: (\w+)/);
      const dataMatch = frame.match(/^data: (.+)$/m);
      if (!eventMatch || !dataMatch) continue;

      const event = eventMatch[1];
      const data = JSON.parse(dataMatch[1]);

      if (event === 'check') {
        handlers.onCheck(data as CheckResult);
      } else if (event === 'complete') {
        handlers.onComplete(data as AuditSummary);
      } else if (event === 'error') {
        handlers.onError((data as { message: string }).message);
      }
    }
  }
}

export function triggerAuditMarkdownDownload(
  summary: AuditSummary,
  checks: CheckResult[],
): void {
  const date = new Date().toISOString().slice(0, 10);
  const lines = [
    `# Zero-GAP Audit Report — ${date}`,
    `Score: ${summary.totalScore}/100`,
    `Pass: ${summary.passed} | Warn: ${summary.warned} | Fail: ${summary.failed}`,
    ``,
    `## Check Results`,
    ...checks.map(
      (c) =>
        `### ${c.status === 'pass' ? '✅' : c.status === 'warn' ? '⚠️' : '❌'} ${c.name}\n- Category: ${c.category}\n- Evidence: ${c.evidence}${c.fix ? `\n- Fix: ${c.fix}` : ''}`,
    ),
  ].join('\n');

  const blob = new Blob([lines], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `zero-gap-audit-${date}-${summary.id.slice(0, 8)}.md`;
  a.click();
  URL.revokeObjectURL(url);
}
