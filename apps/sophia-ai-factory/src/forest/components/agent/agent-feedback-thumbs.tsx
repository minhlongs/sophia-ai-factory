'use client';

/**
 * AgentFeedbackThumbs — Phase 03 Forest: Feedback Widget
 *
 * Thumbs up/down + optional comment (≤280 chars).
 * POSTs to /api/agents/feedback (fire-and-forget from server side).
 * Optimistic UI: disable after submission, show success state inline.
 *
 * Usage:
 *   <AgentFeedbackThumbs taskId="task-123" agentRole="CEO" />
 */

import React, { useState } from 'react';
import { ThumbsUp, ThumbsDown, Loader2, CheckCircle } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AgentFeedbackThumbsProps {
  taskId: string;
  agentRole: string;
}

type FeedbackState = 'idle' | 'pending' | 'done' | 'error';

// ── Component ─────────────────────────────────────────────────────────────────

export function AgentFeedbackThumbs({ taskId, agentRole }: AgentFeedbackThumbsProps) {
  const [score, setScore] = useState<1 | -1 | null>(null);
  const [comment, setComment] = useState('');
  const [state, setState] = useState<FeedbackState>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const submit = async (s: 1 | -1) => {
    if (state === 'pending' || state === 'done') return;
    setScore(s);
    setState('pending');
    setErrorMsg('');

    try {
      const res = await fetch('/api/agents/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_id: taskId,
          agent_role: agentRole,
          score: s,
          comment: comment.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }

      setState('done');
    } catch (err) {
      setState('error');
      setErrorMsg(err instanceof Error ? err.message : 'Failed to submit feedback');
    }
  };

  if (state === 'done') {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <CheckCircle size={12} className="text-green-500" />
        Feedback saved
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Was this helpful?</span>

        <button
          onClick={() => submit(1)}
          disabled={state === 'pending'}
          aria-label="Thumbs up"
          className={[
            'rounded p-1 transition-colors',
            score === 1 ? 'text-green-500' : 'text-muted-foreground hover:text-green-500',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          ].join(' ')}
        >
          {state === 'pending' && score === 1 ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <ThumbsUp size={14} />
          )}
        </button>

        <button
          onClick={() => submit(-1)}
          disabled={state === 'pending'}
          aria-label="Thumbs down"
          className={[
            'rounded p-1 transition-colors',
            score === -1 ? 'text-destructive' : 'text-muted-foreground hover:text-destructive',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          ].join(' ')}
        >
          {state === 'pending' && score === -1 ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <ThumbsDown size={14} />
          )}
        </button>
      </div>

      {/* Optional comment — only show if a score selected (done branch returned early above) */}
      {score !== null && state !== 'pending' && (
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value.slice(0, 280))}
          placeholder="Optional comment (max 280 chars)"
          rows={2}
          className="w-full text-xs rounded border border-border bg-background px-2 py-1 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
        />
      )}

      {state === 'error' && (
        <p className="text-xs text-destructive">{errorMsg}</p>
      )}
    </div>
  );
}
