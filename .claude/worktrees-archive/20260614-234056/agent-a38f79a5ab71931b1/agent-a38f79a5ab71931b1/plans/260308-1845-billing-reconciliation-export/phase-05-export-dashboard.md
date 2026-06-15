---
title: "Phase 05: Export Dashboard UI"
description: Admin dashboard UI for manual export trigger, job status monitoring, and export history
status: pending
priority: P2
effort: 1.5h
branch: main
tags: [dashboard, ui, admin, export]
created: 2026-03-08
---

# Phase 05: Export Dashboard UI

## Overview

Create admin dashboard UI for triggering manual exports, monitoring export job status, and viewing export history with download capabilities.

## Success Criteria

- [ ] Export dashboard page at `/admin/exports`
- [ ] Manual export trigger with date range picker
- [ ] Export job status table with real-time updates
- [ ] Download button for completed exports
- [ ] Export history with filtering
- [ ] Export statistics display

## Files to Create

1. `src/app/[locale]/(admin)/admin/exports/page.tsx` - Main exports dashboard
2. `src/components/admin/export-job-table.tsx` - Export job status table
3. `src/components/admin/export-form.tsx` - Manual export form
4. `src/components/admin/export-statistics.tsx` - Export statistics display
5. `src/hooks/use-export-jobs.ts` - Hook for polling export job status

## Files to Modify

1. `src/app/[locale]/(admin)/admin/layout.tsx` - Add exports navigation link (if needed)

## Implementation Steps

### Step 1: Create Export Dashboard Page (`src/app/[locale]/(admin)/admin/exports/page.tsx`)

```typescript
/**
 * Admin Exports Dashboard
 *
 * Page for managing usage exports
 */

'use client';

import { useState, useEffect } from 'react';
import { ExportJobTable } from '@/components/admin/export-job-table';
import { ExportForm } from '@/components/admin/export-form';
import { ExportStatistics } from '@/components/admin/export-statistics';
import { useExportJobs } from '@/hooks/use-export-jobs';
import { useTranslations } from 'next-intl';

export default function AdminExportsPage() {
  const t = useTranslations();
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const {
    jobs,
    loading,
    error,
    refreshJobs,
    triggerExport,
  } = useExportJobs();

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('admin.exports.title', 'Usage Exports')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t('admin.exports.description', 'Manage and download billing reconciliation exports')}
          </p>
        </div>
      </div>

      {/* Statistics */}
      <ExportStatistics jobs={jobs} />

      {/* Two column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Export Form */}
        <div className="lg:col-span-1">
          <ExportForm
            onExportSuccess={() => {
              refreshJobs();
            }}
          />
        </div>

        {/* Right: Job Table */}
        <div className="lg:col-span-2">
          <ExportJobTable
            jobs={jobs}
            loading={loading}
            error={error}
            selectedJobId={selectedJobId}
            onSelectJob={setSelectedJobId}
            onRefresh={refreshJobs}
          />
        </div>
      </div>
    </div>
  );
}
```

### Step 2: Create Export Form Component (`src/components/admin/export-form.tsx`)

```typescript
/**
 * Manual Export Form
 *
 * Form for triggering on-demand usage exports
 */

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

interface ExportFormProps {
  onExportSuccess: () => void;
}

export function ExportForm({ onExportSuccess }: ExportFormProps) {
  const t = useTranslations();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    format: 'json' as 'json' | 'csv',
    startTimestamp: '',
    endTimestamp: '',
    licenseNonce: '',
    customerId: '',
    service: 'all',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Convert date strings to timestamps
      const startTimestamp = formData.startTimestamp
        ? Math.floor(new Date(formData.startTimestamp).getTime() / 1000)
        : Math.floor(Date.now() / 1000) - (30 * 86400);  // Default: last 30 days

      const endTimestamp = formData.endTimestamp
        ? Math.floor(new Date(formData.endTimestamp).getTime() / 1000)
        : Math.floor(Date.now() / 1000);

      const response = await fetch('/api/usage/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          format: formData.format,
          audience: 'admin',
          startTimestamp,
          endTimestamp,
          licenseNonce: formData.licenseNonce || undefined,
          customerId: formData.customerId || undefined,
          service: formData.service !== 'all' ? formData.service : undefined,
          includeAggregated: true,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Export failed');
      }

      setSuccess(`Export successful! ${result.rowCount} rows exported.`);
      setFormData(prev => ({
        ...prev,
        startTimestamp: '',
        endTimestamp: '',
        licenseNonce: '',
        customerId: '',
      }));
      onExportSuccess();

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        {t('admin.exports.new_export', 'New Export')}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Format */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('admin.exports.format', 'Format')}
          </label>
          <select
            value={formData.format}
            onChange={(e) => setFormData(prev => ({ ...prev, format: e.target.value as 'json' | 'csv' }))}
            className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700"
          >
            <option value="json">JSON</option>
            <option value="csv">CSV</option>
          </select>
        </div>

        {/* Date Range */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('admin.exports.date_range', 'Date Range')}
          </label>
          <input
            type="datetime-local"
            value={formData.startTimestamp}
            onChange={(e) => setFormData(prev => ({ ...prev, startTimestamp: e.target.value }))}
            className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700"
            placeholder="Start date"
          />
          <input
            type="datetime-local"
            value={formData.endTimestamp}
            onChange={(e) => setFormData(prev => ({ ...prev, endTimestamp: e.target.value }))}
            className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700"
            placeholder="End date"
          />
        </div>

        {/* Filters */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('admin.exports.filters', 'Filters (Optional)')}
          </label>
          <input
            type="text"
            value={formData.licenseNonce}
            onChange={(e) => setFormData(prev => ({ ...prev, licenseNonce: e.target.value }))}
            className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700"
            placeholder="License nonce"
          />
          <input
            type="text"
            value={formData.customerId}
            onChange={(e) => setFormData(prev => ({ ...prev, customerId: e.target.value }))}
            className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700"
            placeholder="Customer ID"
          />
          <select
            value={formData.service}
            onChange={(e) => setFormData(prev => ({ ...prev, service: e.target.value }))}
            className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700"
          >
            <option value="all">All Services</option>
            <option value="heygen">HeyGen</option>
            <option value="elevenlabs">ElevenLabs</option>
            <option value="openrouter">OpenRouter</option>
          </select>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? t('common.exporting', 'Exporting...') : t('common.export', 'Export')}
        </button>

        {/* Messages */}
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-md">
            {error}
          </div>
        )}
        {success && (
          <div className="p-3 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-sm rounded-md">
            {success}
          </div>
        )}
      </form>
    </div>
  );
}
```

### Step 3: Create Export Job Table (`src/components/admin/export-job-table.tsx`)

```typescript
/**
 * Export Job Table
 *
 * Displays export job status and history
 */

'use client';

import { formatDistanceToNow } from 'date-fns';

interface ExportJob {
  id: string;
  job_type: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  license_nonce?: string;
  format: string;
  row_count?: number;
  total_credits?: number;
  storage_url?: string;
  error_message?: string;
  created_at: number;
  completed_at?: number;
}

interface ExportJobTableProps {
  jobs: ExportJob[];
  loading: boolean;
  error: string | null;
  selectedJobId: string | null;
  onSelectJob: (id: string) => void;
  onRefresh: () => void;
}

export function ExportJobTable({
  jobs,
  loading,
  error,
  selectedJobId,
  onSelectJob,
  onRefresh,
}: ExportJobTableProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'running': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'failed': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  const formatTimestamp = (timestamp?: number) => {
    if (!timestamp) return '-';
    return formatDistanceToNow(new Date(timestamp * 1000), { addSuffix: true });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Export History
        </h2>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Status
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Type
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                License
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Rows
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Credits
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Created
              </th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  Loading...
                </td>
              </tr>
            )}
            {!loading && jobs.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  No export jobs yet
                </td>
              </tr>
            )}
            {!loading && jobs.map((job) => (
              <tr
                key={job.id}
                className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 ${
                  selectedJobId === job.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                }`}
                onClick={() => onSelectJob(job.id)}
              >
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(job.status)}`}>
                    {job.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                  {job.job_type.replace('_', ' ')}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                  {job.license_nonce?.slice(0, 8) + '...' || '-'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                  {job.row_count?.toLocaleString() || '-'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                  {job.total_credits?.toLocaleString() || '-'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                  {formatTimestamp(job.created_at)}
                </td>
                <td className="px-4 py-3 text-right">
                  {job.status === 'completed' && job.storage_url && (
                    <a
                      href={job.storage_url}
                      download
                      className="text-blue-600 hover:text-blue-700 dark:text-blue-400 text-sm font-medium"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Download
                    </a>
                  )}
                  {job.status === 'failed' && (
                    <span className="text-red-600 dark:text-red-400 text-sm" title={job.error_message}>
                      !
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

### Step 4: Create Hook (`src/hooks/use-export-jobs.ts`)

```typescript
/**
 * Export Jobs Hook
 *
 * Manages export job state and API calls
 */

import { useState, useEffect, useCallback } from 'react';

interface ExportJob {
  id: string;
  job_type: string;
  status: string;
  license_nonce?: string;
  format: string;
  row_count?: number;
  total_credits?: number;
  storage_url?: string;
  error_message?: string;
  created_at: number;
  completed_at?: number;
}

interface UseExportJobsReturn {
  jobs: ExportJob[];
  loading: boolean;
  error: string | null;
  refreshJobs: () => Promise<void>;
  triggerExport: (options: {
    format: 'json' | 'csv';
    startTimestamp: number;
    endTimestamp: number;
    licenseNonce?: string;
    customerId?: string;
  }) => Promise<void>;
}

export function useExportJobs(): UseExportJobsReturn {
  const [jobs, setJobs] = useState<ExportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/exports/jobs');
      if (!response.ok) throw new Error('Failed to fetch jobs');
      const data = await response.json();
      setJobs(data.jobs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch export jobs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
    // Poll every 30 seconds for real-time updates
    const interval = setInterval(fetchJobs, 30000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  const triggerExport = useCallback(async (options: {
    format: 'json' | 'csv';
    startTimestamp: number;
    endTimestamp: number;
    licenseNonce?: string;
    customerId?: string;
  }) => {
    const response = await fetch('/api/usage/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...options,
        audience: 'admin',
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Export failed');
    }

    // Refresh job list after export
    await fetchJobs();
  }, []);

  return {
    jobs,
    loading,
    error,
    refreshJobs: fetchJobs,
    triggerExport,
  };
}
```

## Todo Checklist

- [ ] Create `src/app/[locale]/(admin)/admin/exports/page.tsx`
- [ ] Create `src/components/admin/export-job-table.tsx`
- [ ] Create `src/components/admin/export-form.tsx`
- [ ] Create `src/hooks/use-export-jobs.ts`
- [ ] Create API endpoint for fetching export jobs
- [ ] Add navigation link to admin sidebar
- [ ] Test export form submission
- [ ] Test download functionality
- [ ] Test real-time job status updates

## Related Code Files

- `src/app/[locale]/(admin)/admin/analytics/page.tsx` - Admin page pattern reference
- `src/components/admin/admin-sidebar.tsx` - Navigation component
- `src/app/api/admin/exports/jobs/route.ts` - API for fetching jobs (needs creation)

## Dependencies

- Phase 02: Export API endpoint
- Phase 04: Export jobs database table
- `date-fns` - Date formatting (already installed)
- `next-intl` - Internationalization

## Unresolved Questions

1. Should we add export scheduling UI (cron configuration)?
2. Should we add export preview before download?
3. Should we add batch export functionality for multiple licenses at once?
