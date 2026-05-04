'use client';

/**
 * API Key Create Modal
 *
 * Modal to create a new API key (name input + submit).
 * Displays the full key once after creation (show once warning).
 * A11y: role=dialog, aria-modal, aria-labelledby, Escape to close, focus trap.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';

interface Props {
  onCreated: (key: string) => void;
  onCancel: () => void;
}

interface ApiKeysCreateResponse {
  error?: string;
  message?: string;
  key?: { apiKey?: string };
  apiKey?: string;
}

export function ApiKeyCreateModal({ onCreated, onCancel }: Props) {
  const t = useTranslations('dashboard.apiKeys');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleId = 'api-key-create-title';
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Escape key closes the modal
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  // Focus trap: keep Tab/Shift+Tab inside dialog
  const handleFocusTrap = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusable = Array.from(
      dialog.querySelectorAll<HTMLElement>('button, input, [href], [tabindex]:not([tabindex="-1"])')
    ).filter(el => !el.hasAttribute('disabled'));
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }, []);

  async function handleCreate() {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), permissions: ['audit:read', 'reports:download'] }),
      });
      const data = (await res.json()) as ApiKeysCreateResponse;
      if (!res.ok) throw new Error(data.error ?? data.message ?? `HTTP ${res.status}`);
      onCreated(data.key?.apiKey ?? data.apiKey ?? '');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      style={{ overscrollBehavior: 'contain' }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-card rounded-2xl w-full max-w-md shadow-xl border border-border p-6 space-y-4"
        onKeyDown={handleFocusTrap}
      >
        <h2 id={titleId} className="text-lg font-semibold text-foreground">{t('create_key')}</h2>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">{t('key_name')}</label>
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={t('key_name_placeholder')}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            autoFocus
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg"
          >
            {t('cancel')}
          </button>
          <button
            onClick={handleCreate}
            disabled={saving || !name.trim()}
            className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? t('creating') : t('create_key')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Show Key Modal (displayed after creation) ────────────────────────────────

interface ShowKeyProps {
  apiKey: string;
  onDone: () => void;
}

export function ApiKeyShowModal({ apiKey, onDone }: ShowKeyProps) {
  const t = useTranslations('dashboard.apiKeys');
  const [copied, setCopied] = useState(false);
  const showTitleId = 'api-key-show-title';
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onDone();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onDone]);

  const handleFocusTrap = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusable = Array.from(
      dialog.querySelectorAll<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])')
    ).filter(el => !el.hasAttribute('disabled'));
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }, []);

  function handleCopy() {
    navigator.clipboard.writeText(apiKey).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      style={{ overscrollBehavior: 'contain' }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={showTitleId}
        className="bg-card rounded-2xl w-full max-w-md shadow-xl border border-border p-6 space-y-4"
        onKeyDown={handleFocusTrap}
      >
        <div className="flex items-center gap-2 text-amber-600">
          <span className="material-symbols-outlined" aria-hidden="true">warning</span>
          <h2 id={showTitleId} className="text-lg font-semibold">{t('copy_now')}</h2>
        </div>

        <p className="text-sm text-muted-foreground">{t('copy_warning')}</p>

        <div className="flex items-center gap-2 p-3 bg-muted rounded-lg border border-border">
          <code className="flex-1 text-xs font-mono text-foreground break-all">{apiKey}</code>
          <button
            onClick={handleCopy}
            aria-label="Copy API key"
            className="flex-shrink-0 text-muted-foreground hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined text-lg">{copied ? 'check' : 'content_copy'}</span>
          </button>
        </div>

        <button
          onClick={onDone}
          className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-colors"
        >
          {t('done')}
        </button>
      </div>
    </div>
  );
}
