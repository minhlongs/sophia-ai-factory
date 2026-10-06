'use client';

/**
 * Local Engine Setup Guide Hook
 * Handles loading/generating connection API key and copy-to-clipboard state.
 *
 * @module components/dashboard/use-local-engine
 */

import { useState, useEffect, useCallback } from 'react';

const INSTALL_COMMAND = 'curl -s https://platform.sophia.ai/install-m1.sh | bash';

export function useLocalEngine() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [isLoadingKey, setIsLoadingKey] = useState(true);
  const [isGeneratingKey, setIsGeneratingKey] = useState(false);

  const fetchActiveKey = useCallback(async () => {
    setIsLoadingKey(true);
    try {
      const res = await fetch('/api/v1/api-keys');
      if (res.ok) {
        const data = (await res.json()) as { keys?: Array<{ prefix?: string; keyId?: string }> };
        if (data.keys && data.keys.length > 0) {
          const first = data.keys[0];
          setApiKey(first.prefix || `sk_live_${first.keyId || 'active'}`);
        }
      }
    } catch {
      // Non-blocking fallback
    } finally {
      setIsLoadingKey(false);
    }
  }, []);

  useEffect(() => {
    void fetchActiveKey();
  }, [fetchActiveKey]);

  const generateNewKey = async () => {
    setIsGeneratingKey(true);
    try {
      const res = await fetch('/api/v1/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Local Engine (Apple Silicon)' }),
      });
      if (res.ok) {
        const data = (await res.json()) as { fullKey?: string; prefix?: string };
        setApiKey(data.fullKey || data.prefix || 'sk_live_connected');
      }
    } catch {
      // Non-blocking fallback
    } finally {
      setIsGeneratingKey(false);
    }
  };

  const copyCommand = async () => {
    try {
      await navigator.clipboard.writeText(INSTALL_COMMAND);
      setCopiedCmd(true);
      setTimeout(() => setCopiedCmd(false), 2000);
    } catch {
      // Clipboard fallback
    }
  };

  const copyKey = async () => {
    if (!apiKey) return;
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } catch {
      // Clipboard fallback
    }
  };

  return {
    installCommand: INSTALL_COMMAND,
    apiKey,
    copiedCmd,
    copiedKey,
    isLoadingKey,
    isGeneratingKey,
    copyCommand,
    copyKey,
    generateNewKey,
  };
}
