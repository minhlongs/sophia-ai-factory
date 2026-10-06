'use client';

/**
 * Storage Settings Form Component (Cloudflare R2 BYOS)
 * Allows users to configure R2 credentials for media asset offloading.
 *
 * @module components/settings/storage-settings-form
 */

import React from 'react';
import { HardDrive, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';
import { useStorageSettings } from './use-storage-settings';

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
      <div className="flex items-start justify-between pb-4 border-b border-white/10">
        <div>
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-indigo-400" />
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
          className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300"
        >
          R2 Console <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {statusMessage && (
        <div
          role="alert"
          className={`p-4 rounded-lg flex items-center gap-3 text-sm ${
            statusMessage.type === 'success'
              ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-800/60'
              : 'bg-rose-950/40 text-rose-300 border border-rose-800/60'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/10">
          <div>
            <label htmlFor="use-tenant-storage-toggle" className="text-sm font-medium text-white cursor-pointer">
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
              formData.useTenantStorage ? 'bg-indigo-600' : 'bg-white/20'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                formData.useTenantStorage ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-200">R2 Bucket Name</label>
          <input
            type="text"
            value={formData.r2BucketName}
            onChange={(e) => updateField('r2BucketName', e.target.value)}
            placeholder="e.g. sophia-media-assets"
            className="w-full px-3.5 py-2.5 rounded-lg bg-black/40 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-200">S3 Endpoint URL</label>
            <input
              type="url"
              value={formData.r2Endpoint}
              onChange={(e) => updateField('r2Endpoint', e.target.value)}
              placeholder="https://<account_id>.r2.cloudflarestorage.com"
              className="w-full px-3.5 py-2.5 rounded-lg bg-black/40 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-200">Public Base URL / Custom Domain</label>
            <input
              type="url"
              value={formData.r2PublicBaseUrl}
              onChange={(e) => updateField('r2PublicBaseUrl', e.target.value)}
              placeholder="https://pub-xxxxxx.r2.dev or https://assets.yoursite.com"
              className="w-full px-3.5 py-2.5 rounded-lg bg-black/40 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-200">R2 Access Key ID</label>
            <div className="relative">
              <input
                type={isMasked.accessKey ? 'password' : 'text'}
                value={formData.r2AccessKeyId}
                onChange={(e) => updateField('r2AccessKeyId', e.target.value)}
                placeholder="R2 API Token Access Key ID"
                className="w-full pl-3.5 pr-10 py-2.5 rounded-lg bg-black/40 border border-white/10 text-white placeholder-gray-500 text-sm font-mono"
              />
              <button
                type="button"
                onClick={() => toggleMask('accessKey')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                title={isMasked.accessKey ? 'Reveal key' : 'Mask key'}
              >
                {isMasked.accessKey ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-200">R2 Secret Access Key</label>
            <div className="relative">
              <input
                type={isMasked.secretKey ? 'password' : 'text'}
                value={formData.r2SecretAccessKey}
                onChange={(e) => updateField('r2SecretAccessKey', e.target.value)}
                placeholder="R2 API Token Secret Access Key"
                className="w-full pl-3.5 pr-10 py-2.5 rounded-lg bg-black/40 border border-white/10 text-white placeholder-gray-500 text-sm font-mono"
              />
              <button
                type="button"
                onClick={() => toggleMask('secretKey')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                title={isMasked.secretKey ? 'Reveal key' : 'Mask key'}
              >
                {isMasked.secretKey ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

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
