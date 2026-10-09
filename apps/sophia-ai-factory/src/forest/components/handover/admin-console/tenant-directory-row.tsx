/**
 * Admin Console Submodule: Tenant Directory Table Row.
 * Layer: forest/components (UI presentation; imports from @/seed and @/tree)
 *
 * @module forest/components/handover/admin-console/tenant-directory-row
 */

import React from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Check, Clock, Eye, ExternalLink } from 'lucide-react';
import type { CustomerHandoverRecord } from '@/seed/handover/handover-types';

interface TenantDirectoryRowProps {
  record: CustomerHandoverRecord;
  onSelectRecord: (record: CustomerHandoverRecord) => void;
}

export function TenantDirectoryRow({ record, onSelectRecord }: TenantDirectoryRowProps) {
  const t = useTranslations('admin.handover');
  const isRecordAccepted = record.acceptance_status === 'accepted';

  return (
    <tr className="hover:bg-muted/10 transition-colors">
      <td className="py-3 px-3">
        <div className="font-bold text-foreground">{record.agency_name}</div>
        <span className="text-[11px] text-muted-foreground font-mono">
          ID: {record.id.slice(0, 12)}
        </span>
      </td>

      <td className="py-3 px-3">
        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20">
          {record.tier}
        </span>
      </td>

      <td className="py-3 px-3">
        <span className="capitalize text-muted-foreground">{record.status}</span>
      </td>

      <td className="py-3 px-3">
        {isRecordAccepted ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <Check className="w-3 h-3" />
            Accepted
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Clock className="w-3 h-3" />
            Pending
          </span>
        )}
      </td>

      <td className="py-3 px-3">
        {record.signer_name ? (
          <div>
            <span className="font-semibold text-foreground block">{record.signer_name}</span>
            <span className="text-[11px] text-muted-foreground block">{record.signer_role}</span>
          </div>
        ) : (
          <span className="text-muted-foreground italic">Unsigned</span>
        )}
      </td>

      <td className="py-3 px-3 font-mono text-muted-foreground">
        {record.certificate_hash ? (
          <span title={record.certificate_hash} className="truncate block max-w-[120px]">
            {record.certificate_hash.slice(0, 10)}...
          </span>
        ) : (
          <span className="text-muted-foreground/50">—</span>
        )}
      </td>

      <td className="py-3 px-3 text-right space-x-2">
        {isRecordAccepted && (
          <button
            type="button"
            onClick={() => onSelectRecord(record)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border"
          >
            <Eye className="w-3 h-3" />
            {t('table.inspectAction')}
          </button>
        )}

        <Link
          href={`/dashboard/handover`}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground border border-border"
        >
          <ExternalLink className="w-3 h-3" />
          {t('table.viewPortalAction')}
        </Link>
      </td>
    </tr>
  );
}
