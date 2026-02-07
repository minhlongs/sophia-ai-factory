import React from 'react';
import { ExternalLink } from 'lucide-react';
import { ApiKeyInput } from '../api-key-input';
import { DEFAULTS } from '@/config/defaults';

interface DatabaseStepProps {
  config: {
    AIRTABLE_ACCESS_TOKEN: string;
    AIRTABLE_BASE_ID: string;
  };
  updateConfig: (key: string, value: string) => void;
  verifyKey: (service: string, keyName: string, keyValue: string) => Promise<boolean>;
  status: Record<string, 'idle' | 'validating' | 'valid' | 'invalid'>;
  errors: Record<string, string>;
}

export function DatabaseStep({ config, updateConfig, verifyKey, status, errors }: DatabaseStepProps) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <h2 className="text-xl font-semibold text-foreground">Database Connection</h2>
      <p className="text-muted-foreground text-sm">Connect to your Airtable content base.</p>

      <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-lg border border-amber-200 dark:border-amber-800 text-sm text-amber-900 dark:text-amber-200 mb-4">
        <p className="font-semibold mb-1">Don&apos;t have a Base yet?</p>
        <p>1. <a href={DEFAULTS.AIRTABLE_TEMPLATE_URL} target="_blank" rel="noopener noreferrer" className="underline font-medium hover:text-amber-700 dark:hover:text-amber-100 inline-flex items-center">Copy this Template Base <ExternalLink className="w-3 h-3 ml-1" /></a></p>
        <p>2. Find your Base ID in the URL (appXXXXXXXXXXXXXX)</p>
      </div>

      <ApiKeyInput
        id="airtable_pat"
        label="Airtable Personal Access Token (PAT)"
        value={config.AIRTABLE_ACCESS_TOKEN}
        onChange={(v) => updateConfig('AIRTABLE_ACCESS_TOKEN', v)}
        onVerify={() => verifyKey('airtable', 'AIRTABLE_ACCESS_TOKEN', config.AIRTABLE_ACCESS_TOKEN)}
        status={status.AIRTABLE_ACCESS_TOKEN}
        errorMessage={errors.AIRTABLE_ACCESS_TOKEN}
        required
        helpText="Create at airtable.com/create/tokens with 'data.records:read/write' scope"
      />

      <div className="w-full space-y-2">
        <label htmlFor="base_id" className="block text-sm font-medium text-foreground">Base ID *</label>
        <input
          id="base_id"
          type="text"
          value={config.AIRTABLE_BASE_ID}
          onChange={(e) => updateConfig('AIRTABLE_BASE_ID', e.target.value)}
          className="w-full px-4 py-2 border border-input bg-background rounded-lg focus:ring-2 focus:ring-primary focus:outline-none text-foreground"
          placeholder="app..."
        />
        <p className="text-xs text-muted-foreground">Found in your browser URL when viewing the base.</p>
      </div>
    </div>
  );
}
