'use client';

/**
 * Tab 4 — Security, Creator-VA Fail-Closed RBAC & Edge Click-Fraud Shield Tester.
 */

import { useMemo, useState } from 'react';
import {
  assertFieldsMutableByRole,
  canPerformWorkspaceAction,
  type WorkspaceRole,
} from '@/seed/security/creator-va-rbac';
import { classifyBotUserAgent } from '@/seed/security/bot-user-agent';
import { evaluateAsnClickFraud } from '@/seed/security/asn-click-fraud-shield';

export function WorkbenchTabSecurityRbac({ locale }: { readonly locale: 'vi' | 'en' }) {
  const [role, setRole] = useState<WorkspaceRole>('va_editor');
  const [fieldToEdit, setFieldToEdit] = useState('referralUrl');
  const [sampleUa, setSampleUa] = useState('TelegramBot (like TwitterBot)');
  const [sampleAsn, setSampleAsn] = useState('16509');

  const checks = useMemo(() => {
    const canPublish = canPerformWorkspaceAction(role, 'publish_campaign');
    const fieldCheck = assertFieldsMutableByRole(role, [fieldToEdit]);
    const botCheck = classifyBotUserAgent(sampleUa);
    const asnCheck = evaluateAsnClickFraud(sampleAsn);
    return { canPublish, fieldCheck, botCheck, asnCheck };
  }, [role, fieldToEdit, sampleUa, sampleAsn]);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
          {locale === 'vi' ? 'Kiểm Thử Phân Quyền VA (Fail-Closed RBAC)' : 'Creator-VA Fail-Closed RBAC Tester'}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as WorkspaceRole)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="owner">owner</option>
            <option value="va_editor">va_editor</option>
            <option value="viewer">viewer</option>
          </select>
          <select
            value={fieldToEdit}
            onChange={(e) => setFieldToEdit(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="referralUrl">referralUrl (Locked)</option>
            <option value="shortCode">shortCode (Locked)</option>
            <option value="script">script (VA Allowed)</option>
            <option value="hook">hook (VA Allowed)</option>
          </select>
        </div>
        <div className="rounded-lg bg-slate-50 p-3 text-xs dark:bg-slate-950">
          <p>
            {locale === 'vi' ? 'Quyền sửa trường' : 'Field mutation'}{' '}
            <span className="font-mono font-semibold">{fieldToEdit}</span>:{' '}
            <span className={checks.fieldCheck.allowed ? 'text-emerald-600' : 'text-rose-600 font-semibold'}>
              {checks.fieldCheck.allowed ? 'ALLOWED' : 'BLOCKED (Fail-Closed)'}
            </span>
          </p>
          <p className="mt-1 text-slate-500">
            publish_campaign: {checks.canPublish ? 'ALLOWED' : 'DENIED'}
          </p>
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="text-xs font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400">
          {locale === 'vi' ? 'Khiên Lọc Bot-UA & Datacenter ASN' : 'Bot-UA & Datacenter ASN Shield'}
        </div>
        <input
          type="text"
          value={sampleUa}
          onChange={(e) => setSampleUa(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950"
          placeholder="User-Agent"
        />
        <input
          type="text"
          value={sampleAsn}
          onChange={(e) => setSampleAsn(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950"
          placeholder="ASN (e.g. 16509 AWS)"
        />
        <div className="rounded-lg bg-slate-50 p-3 text-xs dark:bg-slate-950">
          <p>
            Bot-UA:{' '}
            <span className="font-mono">
              {checks.botCheck.isBot ? `BOT (${checks.botCheck.botCategory ?? 'bot'})` : 'HUMAN'}
            </span>
          </p>
          <p className="mt-1">
            ASN Fraud:{' '}
            <span className="font-mono">
              {checks.asnCheck.suspicious ? `BLOCKED (${checks.asnCheck.reason ?? 'Datacenter'})` : 'CLEAN RESIDENTIAL'}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
