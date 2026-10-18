/**
 * Admin Console Submodule: State & Handlers Hook.
 * Layer: forest/components (UI presentation; imports from @/seed and @/tree)
 *
 * @module forest/components/handover/admin-console/use-admin-console-state
 */

import { useState } from 'react';
import type { CustomerHandoverRecord, VerificationRunReport } from '@/seed/handover/handover-types';
import type { HandoverAdminConsoleClientProps, DrDrillReport, StatusFilterType } from './types';
import { downloadBlob, filterHandoverRecords, executeDrDrillProbe } from './admin-console-helpers';

export function useAdminConsoleState({
  handovers,
  initialStats,
  onVerifyAction,
  onExportEnvAction,
}: HandoverAdminConsoleClientProps) {
  const [stats] = useState(initialStats);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilterType>('all');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationReport, setVerificationReport] = useState<VerificationRunReport | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [isDrilling, setIsDrilling] = useState(false);
  const [drDrillReport, setDrDrillReport] = useState<DrDrillReport | null>(null);
  const [isExportingEnv, setIsExportingEnv] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<CustomerHandoverRecord | null>(null);
  const [copiedHash, setCopiedHash] = useState(false);

  const filteredHandovers = filterHandoverRecords(handovers, searchQuery, statusFilter);

  const handleRunVerification = async () => {
    setIsVerifying(true);
    setVerificationError(null);
    try {
      if (onVerifyAction) {
        const res = await onVerifyAction();
        if (res.ok) setVerificationReport(res.value);
        else setVerificationError(res.error.message || 'Verification execution failed.');
      } else {
        const res = await fetch('/api/admin/handover/verify', { method: 'POST' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setVerificationReport((await res.json()) as VerificationRunReport);
      }
    } catch (err) {
      setVerificationError(err instanceof Error ? err.message : 'Failed to execute verification suite.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleRunDrDrill = async () => {
    setIsDrilling(true);
    try {
      setDrDrillReport(await executeDrDrillProbe());
    } finally {
      setIsDrilling(false);
    }
  };

  const handleExportEnv = async () => {
    setIsExportingEnv(true);
    setExportNotice(null);
    try {
      if (onExportEnvAction) {
        const res = await onExportEnvAction();
        if (res.ok) {
          downloadBlob(res.value.sanitizedContent, '.env.production', 'text/plain;charset=utf-8');
          setExportNotice(`Exported ${res.value.totalKeys} keys (${res.value.missingKeys.length} unconfigured).`);
        } else {
          setExportNotice(`Export error: ${res.error.message}`);
        }
      } else {
        window.open('/api/admin/handover/export-env?format=env', '_blank');
        setExportNotice('Downloading .env.production bundle...');
      }
    } catch (err) {
      setExportNotice(`Failed to export: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsExportingEnv(false);
    }
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    } catch {
      // ignore
    }
  };

  return {
    stats, searchQuery, setSearchQuery, statusFilter, setStatusFilter, filteredHandovers,
    isVerifying, verificationReport, verificationError, handleRunVerification,
    isDrilling, drDrillReport, handleRunDrDrill,
    isExportingEnv, exportNotice, setExportNotice, handleExportEnv,
    selectedRecord, setSelectedRecord, copiedHash, handleCopy,
  };
}
