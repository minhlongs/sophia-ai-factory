'use client';

/**
 * Storage Settings Form Component (Cloudflare R2 BYOS)
 * Allows users to configure R2 credentials for media asset offloading.
 *
 * @module components/settings/storage-settings-form
 */

import React from 'react';
import { HardDrive, Loader2, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';
import { useStorageSettings } from './use-storage-settings';
import { StorageCredentialsFields } from './storage-credentials-fields';

export function StorageSettingsForm() {
  const {
    formData,
    isMasked,
    isLoading,
    isSaving,
    statusMessage,
    updateField,
    toggleMask,
    saveSettings,
  } = useStorageSettings();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveSettings();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        <span>Loading storage configuration...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between pb-4 border-b border-border dark:border-white/10">
        <div>
          <h2 className="text-xl font-semibold text-foreground dark:text-white flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-primary dark:text-indigo-400" />
            Cloudflare R2 Storage (BYOS)
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Store generated videos, previews, and audio assets in your own Cloudflare R2 bucket.
          </p>
        </div>
        <a
          href="https://dash.cloudflare.com/?to=/:account/r2"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary dark:text-indigo-400 hover:underline"
        >
          R2 Console <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {statusMessage && (
        <div
          role="alert"
          className={`p-4 rounded-lg flex items-center gap-3 text-sm ${
            statusMessage.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
              : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/30'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex items-center justify-between p-4 rounded-xl bg-background/60 dark:bg-white/[0.02] border border-border dark:border-white/10">
          <div>
            <label htmlFor="use-tenant-storage-toggle" className="text-sm font-medium text-foreground dark:text-white cursor-pointer">
              Enable BYOS Object Storage
            </label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Offload synthesized media directly to your Cloudflare R2 bucket.
            </p>
          </div>
          <button
            id="use-tenant-storage-toggle"
            type="button"
            role="switch"
            aria-checked={formData.useTenantStorage}
            aria-label="Enable BYOS Object Storage"
            onClick={() => updateField('useTenantStorage', !formData.useTenantStorage)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              formData.useTenantStorage ? 'bg-indigo-600' : 'bg-muted dark:bg-white/20'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                formData.useTenantStorage ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <StorageCredentialsFields
          formData={formData}
          isMasked={isMasked}
          updateField={updateField}
          toggleMask={toggleMask}
        />

        <button
          type="submit"
          disabled={isSaving}
          className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-colors disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> : null}
          {isSaving ? 'Saving Storage Settings...' : 'Save Storage Configuration'}
        </button>
      </form>
    </div>
  );
}
