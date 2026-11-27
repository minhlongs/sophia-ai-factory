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
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center rounded-full border border-border bg-muted/50 px-2.5 py-0.5 font-medium text-foreground">
          {locale === 'vi' ? 'Mô Phỏng Chính Sách Bảo Mật' : 'Security Policy Simulator'}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-primary-text">
            {locale === 'vi' ? 'Kiểm Thử Phân Quyền Nhân Viên (VA)' : 'Creator-VA Permission Tester'}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={role}
              aria-label={locale === 'vi' ? 'Chọn vai trò thành viên' : 'Select workspace role'}
              onChange={(e) => setRole(e.target.value as WorkspaceRole)}
              className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground"
            >
              <option value="owner">{locale === 'vi' ? 'Chủ sở hữu (Owner)' : 'Owner'}</option>
              <option value="va_editor">{locale === 'vi' ? 'Nhân viên sửa bài (VA)' : 'VA Editor'}</option>
              <option value="viewer">{locale === 'vi' ? 'Chỉ xem (Viewer)' : 'Viewer'}</option>
            </select>
            <select
              value={fieldToEdit}
              aria-label={locale === 'vi' ? 'Chọn trường dữ liệu cần kiểm tra quyền sửa' : 'Select field to test edit permission'}
              onChange={(e) => setFieldToEdit(e.target.value)}
              className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground"
            >
              <option value="referralUrl">{locale === 'vi' ? 'Link hoa hồng (Khóa cứng)' : 'Affiliate Link (Locked)'}</option>
              <option value="shortCode">{locale === 'vi' ? 'Mã rút gọn (Khóa cứng)' : 'Short Link Code (Locked)'}</option>
              <option value="script">{locale === 'vi' ? 'Kịch bản (VA được sửa)' : 'Script (VA Allowed)'}</option>
              <option value="hook">{locale === 'vi' ? 'Câu mở đầu (VA được sửa)' : 'Hook (VA Allowed)'}</option>
            </select>
          </div>
          <div className="rounded-lg bg-muted/40 p-3 text-xs text-foreground">
            <p>
              {locale === 'vi' ? 'Quyền sửa trường' : 'Field edit'}{' '}
              <span className="font-mono font-semibold">{fieldToEdit}</span>:{' '}
              <span className={checks.fieldCheck.allowed ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-rose-700 dark:text-rose-400 font-semibold'}>
                {checks.fieldCheck.allowed
                  ? locale === 'vi' ? 'CHO PHÉP' : 'ALLOWED'
                  : locale === 'vi' ? 'BỊ KHÓA (An toàn mặc định)' : 'LOCKED (Fail-Closed)'}
              </span>
            </p>
            <p className="mt-1 text-muted-foreground">
              {locale === 'vi' ? 'Quyền xuất bản chiến dịch:' : 'Publish campaign:'}{' '}
              {checks.canPublish
                ? locale === 'vi' ? 'CHO PHÉP' : 'ALLOWED'
                : locale === 'vi' ? 'TỪ CHỐI' : 'DENIED'}
            </p>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-primary-text">
            {locale === 'vi' ? 'Khiên Lọc Bot & Click Ảo Trung Tâm Dữ Liệu' : 'Bot & Datacenter Click-Fraud Shield'}
          </div>
          <input
            type="text"
            value={sampleUa}
            aria-label={locale === 'vi' ? 'Nhập chuỗi trình duyệt (User-Agent) để kiểm tra' : 'Sample User-Agent string'}
            onChange={(e) => setSampleUa(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground"
            placeholder="User-Agent"
          />
          <input
            type="text"
            value={sampleAsn}
            aria-label={locale === 'vi' ? 'Nhập mã mạng ASN để kiểm tra' : 'Sample network ASN'}
            onChange={(e) => setSampleAsn(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground"
            placeholder="ASN (e.g. 16509 AWS)"
          />
          <div className="rounded-lg bg-muted/40 p-3 text-xs text-foreground">
            <p>
              {locale === 'vi' ? 'Phân loại truy cập:' : 'Traffic type:'}{' '}
              <span className="font-mono">
                {checks.botCheck.isBot ? `BOT (${checks.botCheck.botCategory ?? 'bot'})` : 'HUMAN'}
              </span>
            </p>
            <p className="mt-1">
              {locale === 'vi' ? 'Lọc thống kê click:' : 'Click analytics:'}{' '}
              <span className="font-mono">
                {checks.asnCheck.suspicious
                  ? locale === 'vi'
                    ? 'LOẠI KHỎI THỐNG KÊ (Vẫn chuyển hướng)'
                    : 'EXCLUDED FROM ANALYTICS (Redirect Allowed)'
                  : locale === 'vi'
                    ? 'NGƯỜI DÙNG THẬT (Ghi nhận)'
                    : 'CLEAN RESIDENTIAL (Recorded)'}
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
