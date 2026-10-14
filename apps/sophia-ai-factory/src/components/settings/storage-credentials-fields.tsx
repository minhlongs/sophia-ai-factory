'use client';

import React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import type { StorageFormData } from './use-storage-settings';

interface StorageCredentialsFieldsProps {
  formData: StorageFormData;
  isMasked: { accessKey: boolean; secretKey: boolean };
  updateField: (field: keyof StorageFormData, value: string | boolean) => void;
  toggleMask: (key: 'accessKey' | 'secretKey') => void;
}

export function StorageCredentialsFields({
  formData,
  isMasked,
  updateField,
  toggleMask,
}: StorageCredentialsFieldsProps) {
  return (
    <>
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
    </>
  );
}
