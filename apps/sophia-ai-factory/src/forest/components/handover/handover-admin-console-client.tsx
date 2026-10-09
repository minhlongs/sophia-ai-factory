'use client';

/**
 * Operator Handover Console Client - Root Facade.
 * Layer: forest/components (UI orchestration; imports from @/seed and @/tree)
 *
 * Cockpit for operators to monitor customer handover velocity across tenants,
 * execute the 11-point Day-1 verification suite, run automated DR backup drills,
 * export sanitized .env.production configurations, and inspect signed certificates.
 *
 * @module forest/components/handover/handover-admin-console-client
 */

import React from 'react';
import {
  type HandoverAdminConsoleClientProps,
  useAdminConsoleState,
  AdminHeader,
  AdminStatsOverview,
  VerificationReportPanel,
  DrDrillCard,
  TenantDirectoryTable,
  CertificateInspectModal,
} from './admin-console';

export * from './admin-console';

export function HandoverAdminConsoleClient(props: HandoverAdminConsoleClientProps) {
  const {
    stats,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    filteredHandovers,
    isVerifying,
    verificationReport,
    verificationError,
    handleRunVerification,
    isDrilling,
    drDrillReport,
    handleRunDrDrill,
    isExportingEnv,
    exportNotice,
    setExportNotice,
    handleExportEnv,
    selectedRecord,
    setSelectedRecord,
    copiedHash,
    handleCopy,
  } = useAdminConsoleState(props);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* ── Page Header & Action Toolbar ────────────────────────────────────────── */}
      <AdminHeader
        isVerifying={isVerifying}
        isDrilling={isDrilling}
        isExportingEnv={isExportingEnv}
        exportNotice={exportNotice}
        onDismissExportNotice={() => setExportNotice(null)}
        onRunVerification={handleRunVerification}
        onRunDrDrill={handleRunDrDrill}
        onExportEnv={handleExportEnv}
      />

      {/* ── Metrics Overview Grid ─────────────────────────────────────────────── */}
      <AdminStatsOverview stats={stats} handovers={props.handovers} />

      {/* ── Real-Time Verification Report Panel (If Run) ───────────────────────── */}
      <VerificationReportPanel report={verificationReport} error={verificationError} />

      {/* ── Disaster Recovery (DR) Drill Result Card (If Run) ────────────────── */}
      <DrDrillCard report={drDrillReport} />

      {/* ── Tenant Handover Directory Table ───────────────────────────────────── */}
      <TenantDirectoryTable
        handovers={props.handovers}
        filteredHandovers={filteredHandovers}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        onSelectRecord={setSelectedRecord}
      />

      {/* ── Certificate Inspection Modal ──────────────────────────────────────── */}
      <CertificateInspectModal
        record={selectedRecord}
        copiedHash={copiedHash}
        onCopyHash={handleCopy}
        onClose={() => setSelectedRecord(null)}
      />
    </div>
  );
}
