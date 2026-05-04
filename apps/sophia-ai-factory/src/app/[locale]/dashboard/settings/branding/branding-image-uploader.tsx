'use client';

/**
 * BrandingImageUploader — file input + preview + remove for branding assets.
 * Calls POST /api/v1/branding/upload on selection.
 *
 * @module app/[locale]/dashboard/settings/branding/branding-image-uploader
 */

import { useState, useRef } from 'react';

interface Props {
  kind: 'logo' | 'favicon' | 'social';
  currentUrl: string | null;
  label: string;
  onUploaded: (url: string) => void;
  onRemoved: () => void;
}

export function BrandingImageUploader({ kind, currentUrl, label, onUploaded, onRemoved }: Props) {
  const [url, setUrl] = useState<string | null>(currentUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('kind', kind);
      form.append('file', file);
      const res = await fetch('/api/v1/branding/upload', { method: 'POST', body: form });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? 'Upload failed');
      }
      const data = (await res.json()) as { url: string };
      setUrl(data.url);
      onUploaded(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  function handleRemove() {
    setUrl(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
    onRemoved();
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm text-zinc-300">{label}</label>
      <div className="flex items-center gap-4">
        {url && (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={kind}
              className="h-14 w-auto max-w-[120px] rounded border border-zinc-700 object-contain bg-zinc-800 p-1"
            />
          </div>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="px-3 py-1.5 text-xs bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 rounded-lg text-zinc-100 transition-colors"
          >
            {uploading ? 'Uploading…' : url ? 'Replace' : 'Upload'}
          </button>
          {url && (
            <button
              type="button"
              onClick={handleRemove}
              className="px-3 py-1.5 text-xs bg-red-900/50 hover:bg-red-800/50 rounded-lg text-red-300 transition-colors"
            >
              Remove
            </button>
          )}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={kind === 'favicon' ? 'image/png,image/x-icon,image/svg+xml,image/webp,image/jpeg' : 'image/png,image/jpeg,image/webp,image/svg+xml'}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
