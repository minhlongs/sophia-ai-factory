import React from 'react';
import { useTranslations } from 'next-intl';
import { KeyRound, RefreshCw, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { EmptyState } from '@/seed/components/ui/empty-state';
import { ActionBtn } from './action-btn';
import { getTierColor, getStatusColor } from './license-helpers';
import type { License, LicenseAction } from './types';

interface LicenseTableProps {
  licenses: License[];
  loading: boolean;
  actionId: string | null;
  onAction: (licenseId: string, action: LicenseAction) => void;
}

export function LicenseTable({
  licenses,
  loading,
  actionId,
  onAction,
}: LicenseTableProps): React.JSX.Element {
  const t = useTranslations('admin.licenses');

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="px-4 py-3 text-left font-medium">License ID</th>
              <th className="px-4 py-3 text-left font-medium">User</th>
              <th className="px-4 py-3 text-left font-medium">Tier</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Expires</th>
              <th className="px-4 py-3 text-left font-medium">Created</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && licenses.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                </td>
              </tr>
            ) : licenses.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-0">
                  <EmptyState
                    icon={KeyRound}
                    title={t('emptyTitle')}
                    description={t('emptyDesc')}
                    className="border-0 rounded-none bg-transparent py-12"
                  />
                </td>
              </tr>
            ) : (
              licenses.map((lic) => (
                <tr key={lic.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <code className="font-mono text-xs bg-muted px-2 py-0.5 rounded">
                      {lic.license_key}
                    </code>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {lic.user_id.slice(0, 8)}...
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getTierColor(
                        lic.tier,
                      )}`}
                    >
                      {lic.tier}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${getStatusColor(
                        lic.status,
                      )}`}
                    >
                      {lic.status === 'active' ? (
                        <CheckCircle className="w-3 h-3" />
                      ) : (
                        <XCircle className="w-3 h-3" />
                      )}
                      {lic.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {lic.expires_at ? new Date(lic.expires_at).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(lic.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <ActionBtn
                        icon={RefreshCw}
                        label="Extend"
                        onClick={() => onAction(lic.id, 'extend')}
                        busy={actionId === lic.id}
                      />
                      <ActionBtn
                        icon={CheckCircle}
                        label="Reactivate"
                        onClick={() => onAction(lic.id, 'reactivate')}
                        busy={actionId === lic.id}
                      />
                      <ActionBtn
                        icon={KeyRound}
                        label="Regenerate"
                        onClick={() => onAction(lic.id, 'regenerate')}
                        busy={actionId === lic.id}
                      />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
