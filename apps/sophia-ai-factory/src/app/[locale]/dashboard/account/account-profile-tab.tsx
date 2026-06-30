"use client";

/**
 * Profile tab — display name, locale, timezone editor.
 *
 * Wave 20 Phase 04 (7B): self-service email change + GDPR data export.
 * Email field is editable; "Update Email" mails a verification link to the
 * new address. "Export Data" downloads tenant-scoped JSON via the existing
 * /api/account/export endpoint.
 */

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useCsrfToken } from '@/seed/security/use-csrf-token';
import { Button } from '@/seed/components/ui/button';
import { Input } from '@/seed/components/ui/input';
import { Label } from '@/seed/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/seed/components/ui/select';
import { AccountDangerZone } from './account-danger-zone';

interface ProfileData {
  email: string;
  display_name: string;
  locale: string;
  timezone: string;
}

interface AccountProfileTabProps {
  initial: ProfileData;
}

type EmailStatus =
  | { kind: 'idle' }
  | { kind: 'pending' }
  | { kind: 'sent'; to: string }
  | { kind: 'changed' }
  | { kind: 'error'; message: string };

export function AccountProfileTab({ initial }: AccountProfileTabProps) {
  const t = useTranslations('account');
  const csrfHeaders = useCsrfToken();
  const searchParams = useSearchParams();
  const [form, setForm] = useState<ProfileData>(initial);
  const [emailDraft, setEmailDraft] = useState(initial.email);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [emailStatus, setEmailStatus] = useState<EmailStatus>({ kind: 'idle' });
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const sp = searchParams!;
    if (sp.get('ok') === 'email-changed') {
      setEmailStatus({ kind: 'changed' });
    } else if (sp.get('error')?.startsWith('email-change-')) {
      setEmailStatus({ kind: 'error', message: t('email_change_invalid') });
    }
  }, [searchParams, t]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: form.display_name,
          locale: form.locale,
          timezone: form.timezone,
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  async function handleChangeEmail() {
    const newEmail = emailDraft.trim();
    if (!newEmail || newEmail === initial.email) return;
    setEmailStatus({ kind: 'pending' });
    try {
      const res = await fetch('/api/account/change-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...csrfHeaders },
        body: JSON.stringify({ newEmail }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setEmailStatus({ kind: 'error', message: body.error ?? t('email_change_invalid') });
        return;
      }
      setEmailStatus({ kind: 'sent', to: newEmail });
    } catch {
      setEmailStatus({ kind: 'error', message: t('email_change_invalid') });
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch('/api/account/export');
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sophia-account-export-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  const emailDirty = emailDraft.trim().length > 0 && emailDraft.trim() !== initial.email;

  return (
    <div className="space-y-8 max-w-lg">
      <form onSubmit={handleSave} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="profile-email">{t('profile_email')}</Label>
          <div className="flex gap-2">
            <Input
              id="profile-email"
              type="email"
              value={emailDraft}
              onChange={(e) => setEmailDraft(e.target.value)}
              maxLength={254}
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleChangeEmail}
              disabled={!emailDirty || emailStatus.kind === 'pending'}
              className="cursor-pointer whitespace-nowrap"
            >
              {emailStatus.kind === 'pending' ? t('email_change_pending') : t('email_change_btn')}
            </Button>
          </div>
          {emailStatus.kind === 'sent' && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400">
              {t('email_change_sent', { email: emailStatus.to })}
            </p>
          )}
          {emailStatus.kind === 'changed' && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400">{t('email_changed_success')}</p>
          )}
          {emailStatus.kind === 'error' && (
            <p className="text-xs text-red-500">{emailStatus.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="profile-name">{t('profile_name')}</Label>
          <Input
            id="profile-name"
            value={form.display_name}
            onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
            maxLength={100}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="profile-locale">{t('profile_locale')}</Label>
          <Select value={form.locale} onValueChange={(v) => setForm((f) => ({ ...f, locale: v }))}>
            <SelectTrigger id="profile-locale">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="vi">{t('locale_vi')}</SelectItem>
              <SelectItem value="en">{t('locale_en')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="profile-timezone">{t('profile_timezone')}</Label>
          <Input
            id="profile-timezone"
            value={form.timezone}
            onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
            maxLength={64}
          />
        </div>

        <Button type="submit" disabled={saving} className="cursor-pointer">
          {saving ? t('profile_saving') : saved ? t('profile_saved') : t('profile_save')}
        </Button>
      </form>

      <div className="border-t border-border pt-6 space-y-3">
        <h3 className="text-sm font-semibold">{t('data_section')}</h3>
        <p className="text-xs text-muted-foreground">{t('export_description')}</p>
        <Button
          type="button"
          variant="outline"
          onClick={handleExport}
          disabled={exporting}
          className="cursor-pointer"
        >
          {exporting ? t('export_pending') : t('export_btn')}
        </Button>
      </div>

      <AccountDangerZone />
    </div>
  );
}
