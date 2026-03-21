'use client';

/**
 * CRM Sync Status Component
 *
 * Displays last sync time and manual sync trigger
 */

import { useState, useEffect } from 'react';

interface SyncStatus {
  lastSync: string | null;
  status: 'idle' | 'syncing' | 'completed' | 'error';
  contactsSynced?: number;
  dealsSynced?: number;
  error?: string;
}

interface CrmSyncStatusProps {
  isConnected: boolean;
}

export function CrmSyncStatus({ isConnected }: CrmSyncStatusProps) {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    lastSync: null,
    status: 'idle',
  });

  const handleSync = async () => {
    setSyncStatus((prev) => ({ ...prev, status: 'syncing' }));

    try {
      const response = await fetch('/api/crm/sync', {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success) {
        setSyncStatus({
          lastSync: new Date().toISOString(),
          status: 'completed',
          contactsSynced: data.contactsSynced,
          dealsSynced: data.dealsSynced,
        });
      } else {
        setSyncStatus({
          lastSync: null,
          status: 'error',
          error: data.error,
        });
      }
    } catch (error) {
      setSyncStatus({
        lastSync: null,
        status: 'error',
        error: 'Failed to sync',
      });
    }
  };

  if (!isConnected) {
    return (
      <div className="text-sm text-gray-500">
        Connect HubSpot to enable CRM sync
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-900">Sync Status</p>
          {syncStatus.lastSync && (
            <p className="text-xs text-gray-500 mt-1">
              Last synced:{' '}
              {new Date(syncStatus.lastSync).toLocaleString()}
            </p>
          )}
        </div>

        <button
          onClick={handleSync}
          disabled={syncStatus.status === 'syncing'}
          className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50"
        >
          {syncStatus.status === 'syncing' ? (
            <>
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-700"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Syncing...
            </>
          ) : (
            <>
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Sync Now
            </>
          )}
        </button>
      </div>

      {syncStatus.status === 'completed' && (
        <div className="text-sm text-green-600">
          <p>Sync completed successfully!</p>
          {syncStatus.contactsSynced !== undefined && (
            <p className="text-xs mt-1">
              {syncStatus.contactsSynced} contacts synced
              {syncStatus.dealsSynced ? `, ${syncStatus.dealsSynced} deals` : ''}
            </p>
          )}
        </div>
      )}

      {syncStatus.status === 'error' && syncStatus.error && (
        <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
          <p className="font-medium">Sync failed</p>
          <p className="text-xs mt-1">{syncStatus.error}</p>
        </div>
      )}
    </div>
  );
}
