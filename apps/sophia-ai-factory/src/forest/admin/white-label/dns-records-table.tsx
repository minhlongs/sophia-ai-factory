/**
 * DNS Records Table for Domain Item Card.
 *
 * Layer: forest (UI component composition)
 *
 * @module forest/admin/white-label/dns-records-table
 */

import React from 'react';
import { Check, Copy } from 'lucide-react';
import type { CustomDomainRecord } from '@/seed/types/custom-domains';

export interface DnsRecordInfo {
  type?: string;
  name?: string;
  value?: string;
}

export function parseDns(val: unknown): DnsRecordInfo | null {
  if (!val) return null;
  if (typeof val === 'string') {
    try {
      return JSON.parse(val) as DnsRecordInfo;
    } catch {
      return null;
    }
  }
  return val as DnsRecordInfo;
}

interface DnsRowProps {
  type: string;
  name: string;
  value: string;
  typeColor: string;
  copyId: string;
  copiedKey: string | null;
  onCopy: (key: string, val: string) => void;
}

function DnsRow({ type, name, value, typeColor, copyId, copiedKey, onCopy }: DnsRowProps) {
  return (
    <tr>
      <td className={`py-2 font-bold ${typeColor}`}>{type}</td>
      <td className="py-2 text-zinc-200 max-w-[200px] truncate">{name}</td>
      <td className="py-2 text-zinc-200 max-w-[250px] truncate">{value}</td>
      <td className="py-2 text-right">
        <button
          type="button"
          onClick={() => onCopy(copyId, value)}
          className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
        >
          {copiedKey === copyId ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
        </button>
      </td>
    </tr>
  );
}

interface DnsRecordsTableProps {
  dom: CustomDomainRecord;
  copiedKey: string | null;
  onCopy: (key: string, val: string) => void;
  title: string;
  cnameHost: string;
  cnameTarget: string;
}

export function DnsRecordsTable({
  dom,
  copiedKey,
  onCopy,
  title,
  cnameHost,
  cnameTarget,
}: DnsRecordsTableProps) {
  const ownership = parseDns(dom.ownership_verification);
  const sslDcv = parseDns(dom.ssl_verification);
  const target = dom.cname_target || 'cname.sophia.agencyos.network';

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4 space-y-3">
      <div className="text-xs font-semibold text-zinc-300">{title}</div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-zinc-400">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-500 font-mono">
              <th className="pb-2">Type</th>
              <th className="pb-2">{cnameHost}</th>
              <th className="pb-2">{cnameTarget}</th>
              <th className="pb-2 text-right">Copy</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-900 font-mono text-[11px]">
            <DnsRow
              type="CNAME"
              name={dom.hostname}
              value={target}
              typeColor="text-indigo-400"
              copyId={`cname-${dom.id}`}
              copiedKey={copiedKey}
              onCopy={onCopy}
            />
            {ownership?.name && ownership?.value && (
              <DnsRow
                type={ownership.type || 'TXT'}
                name={ownership.name}
                value={ownership.value}
                typeColor="text-amber-400"
                copyId={`txt-${dom.id}`}
                copiedKey={copiedKey}
                onCopy={onCopy}
              />
            )}
            {sslDcv?.name && sslDcv?.value && (
              <DnsRow
                type={sslDcv.type || 'TXT'}
                name={sslDcv.name}
                value={sslDcv.value}
                typeColor="text-cyan-400"
                copyId={`ssl-${dom.id}`}
                copiedKey={copiedKey}
                onCopy={onCopy}
              />
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
