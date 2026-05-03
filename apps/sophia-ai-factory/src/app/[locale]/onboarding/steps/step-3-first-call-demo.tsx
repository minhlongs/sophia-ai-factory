'use client';
/**
 * Onboarding Step 3 — First call demo: POST to /api/v1/agent-chat, stream result.
 * First chunk received marks milestone complete.
 * @module app/[locale]/onboarding/steps/step-3-first-call-demo
 */

import { useState } from 'react';

interface Props {
  locale: string;
  onComplete: () => void;
}

const DEMO_PROMPTS = {
  vi: 'Giới thiệu ngắn về Sophia AI Factory trong 2 câu.',
  en: 'Briefly introduce Sophia AI Factory in 2 sentences.',
};

export function StepFirstCallDemo({ locale, onComplete }: Props) {
  const isVi = locale.startsWith('vi');
  const [prompt, setPrompt] = useState(isVi ? DEMO_PROMPTS.vi : DEMO_PROMPTS.en);
  const [streaming, setStreaming] = useState(false);
  const [response, setResponse] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [milestoneRecorded, setMilestoneRecorded] = useState(false);

  async function handleSubmit() {
    if (streaming || !prompt.trim()) return;
    setStreaming(true);
    setResponse('');
    setError(null);

    try {
      const res = await fetch('/api/v1/agent-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt }),
      });

      if (!res.ok || !res.body) {
        const errBody = await res.text().catch(() => 'Error');
        setError(errBody.slice(0, 200));
        setStreaming(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let firstChunk = true;
      let accumulated = '';

      while (true) {
        const { done: doneReading, value } = await reader.read();
        if (doneReading) break;
        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;
        setResponse(accumulated);

        if (firstChunk && !milestoneRecorded) {
          firstChunk = false;
          setMilestoneRecorded(true);
          fetch('/api/welcome/milestone', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ step: 'first_run' }),
          }).catch(() => {});
        }
      }

      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-2">
        {isVi ? 'Thực hiện cuộc gọi đầu tiên' : 'Make your first API call'}
      </h2>
      <p className="text-zinc-400 text-sm mb-4">
        {isVi ? 'Gửi tin nhắn đến Sophia AI và xem phản hồi trực tiếp.' : 'Send a message to Sophia AI and see the live response.'}
      </p>

      <textarea
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
        rows={3}
        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-sm text-white resize-none focus:outline-none focus:border-violet-500"
        disabled={streaming}
      />

      <button
        onClick={handleSubmit}
        disabled={streaming || !prompt.trim()}
        className="mt-3 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-semibold py-2 px-6 rounded-lg"
      >
        {streaming ? (isVi ? 'Đang gửi...' : 'Sending...') : (isVi ? 'Gửi' : 'Send')}
      </button>

      {error && <p className="mt-3 text-red-400 text-sm">{error}</p>}

      {response && (
        <div className="mt-4 bg-zinc-800 border border-zinc-700 rounded-lg p-4 text-sm text-zinc-200 whitespace-pre-wrap min-h-16 max-h-48 overflow-y-auto">
          {response}
          {streaming && <span className="animate-pulse ml-1">▋</span>}
        </div>
      )}

      {done && (
        <button
          onClick={onComplete}
          className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-6 rounded-lg"
        >
          {isVi ? 'Tiếp tục →' : 'Continue →'}
        </button>
      )}
    </div>
  );
}
