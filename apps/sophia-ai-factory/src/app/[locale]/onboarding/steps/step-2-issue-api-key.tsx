'use client';
/**
 * Onboarding Step 2 — Issue API key via /api/v1/api-keys endpoint.
 * Shows key once in a copy panel, then records milestone.
 * @module app/[locale]/onboarding/steps/step-2-issue-api-key
 */

import { useState } from 'react';

interface Props {
  locale: string;
  onComplete: () => void;
}

interface CreateKeyResponse {
  fullKey: string;
  prefix: string;
  keyId: string;
}

export function StepIssueApiKey({ locale, onComplete }: Props) {
  const isVi = locale.startsWith('vi');
  const [loading, setLoading] = useState(false);
  const [keyData, setKeyData] = useState<CreateKeyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  async function handleCreate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Onboarding Key' }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed' })) as { error?: string };
        setError(err.error ?? 'Failed to create key');
        return;
      }
      const data = await res.json() as CreateKeyResponse;
      setKeyData(data);
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!keyData) return;
    await navigator.clipboard.writeText(keyData.fullKey).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleAcknowledge() {
    setAcknowledged(true);
    await fetch('/api/welcome/milestone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step: 'api_key' }),
    }).catch(() => {});
    onComplete();
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-2">
        {isVi ? 'Tạo API Key' : 'Generate API Key'}
      </h2>
      <p className="text-zinc-400 text-sm mb-6">
        {isVi
          ? 'Key này cho phép ứng dụng của bạn gọi Sophia AI API. Lưu lại ngay — chỉ hiển thị 1 lần.'
          : 'This key lets your app call the Sophia AI API. Save it now — shown only once.'}
      </p>

      {!keyData && (
        <button
          onClick={handleCreate}
          disabled={loading}
          className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-semibold py-3 px-6 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-violet-500/50 focus-visible:outline-none"
        >
          {loading
            ? (isVi ? 'Đang tạo…' : 'Generating…')
            : (isVi ? 'Tạo API Key' : 'Generate API Key')}
        </button>
      )}

      {error && <p role="alert" aria-live="polite" className="mt-3 text-red-400 text-sm">{error}</p>}

      {keyData && !acknowledged && (
        <div className="mt-4">
          <div aria-live="polite" className="bg-zinc-800 border border-zinc-700 rounded-lg p-4 font-mono tabular-nums text-sm text-emerald-300 break-all">
            {keyData.fullKey}
          </div>
          <div className="flex gap-3 mt-3">
            <button
              onClick={handleCopy}
              className="bg-zinc-700 hover:bg-zinc-600 text-white text-sm py-2 px-4 rounded-lg focus-visible:ring-2 focus-visible:ring-violet-500/50 focus-visible:outline-none"
            >
              <span aria-live="polite">{copied ? '✓ Copied' : (isVi ? 'Sao chép' : 'Copy')}</span>
            </button>
          </div>
          <p className="text-amber-400 text-xs mt-3">
            <span aria-hidden="true">⚠</span>{isVi ? ' Key này sẽ không hiển thị lại. Hãy lưu vào nơi an toàn.' : ' This key will not be shown again. Store it securely.'}
          </p>
          <button
            onClick={handleAcknowledge}
            className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-6 rounded-lg focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:outline-none"
          >
            {isVi ? 'Tôi đã lưu key này' : 'I\'ve saved this key'}
          </button>
        </div>
      )}
    </div>
  );
}
