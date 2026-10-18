'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Trash2, Wifi, Loader2, Edit2 } from 'lucide-react';
import { Button } from '@/seed/components/ui/button';
import type { Provider, TestResult } from './types';

export interface ProviderCardActionsProps {
  provider: Provider;
  isPending: boolean;
  testResult: TestResult | null;
  testingProvider: Provider | null;
  onTest: (p: Provider) => void;
  onToggleEditing: (isEditing: boolean) => void;
  onClear: (p: Provider) => void;
}

export function ProviderCardActions({
  provider,
  isPending,
  testResult,
  testingProvider,
  onTest,
  onToggleEditing,
  onClear,
}: ProviderCardActionsProps) {
  const t = useTranslations('byok');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-background/40 border border-border/10 rounded-lg px-3 py-2">
        <span className="text-sm font-mono text-muted-foreground select-none">••••••••••••</span>
        {testResult && (
          <span
            className={`text-xs font-semibold ${testResult.ok ? 'text-emerald-400' : 'text-rose-400'}`}
            title={testResult.error}
          >
            {testResult.ok ? `✓ ${testResult.latencyMs}ms` : `✗ Error`}
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onTest(provider)}
          disabled={isPending || testingProvider === provider}
          className="flex-1 text-blue-400 hover:text-blue-300"
        >
          {testingProvider === provider ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Wifi className="h-3.5 w-3.5" />
          )}
          {t('test_button')}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onToggleEditing(true)}
          disabled={isPending}
          className="flex-1 text-amber-400 hover:text-amber-300"
        >
          <Edit2 className="h-3.5 w-3.5" />
          Edit
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onClear(provider)}
          disabled={isPending}
          className="text-rose-500 hover:text-rose-400"
          aria-label="Delete key"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
