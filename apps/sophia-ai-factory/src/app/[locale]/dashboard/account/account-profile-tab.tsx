"use client";

/**
 * Profile tab — display name, locale, timezone editor.
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ProfileData {
  email: string;
  display_name: string;
  locale: string;
  timezone: string;
}

interface AccountProfileTabProps {
  initial: ProfileData;
}

export function AccountProfileTab({ initial }: AccountProfileTabProps) {
  const t = useTranslations('account');
  const [form, setForm] = useState<ProfileData>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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

  return (
    <form onSubmit={handleSave} className="space-y-5 max-w-lg">
      <div className="space-y-1.5">
        <Label htmlFor="profile-email">{t('profile_email')}</Label>
        <Input id="profile-email" value={form.email} readOnly className="bg-slate-50 dark:bg-slate-800/40 cursor-not-allowed" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="profile-name">{t('profile_name')}</Label>
        <Input
          id="profile-name"
          value={form.display_name}
          onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
          maxLength={100}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="profile-locale">{t('profile_locale')}</Label>
        <Select value={form.locale} onValueChange={v => setForm(f => ({ ...f, locale: v }))}>
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
          onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))}
          maxLength={64}
        />
      </div>

      <Button type="submit" disabled={saving} className="cursor-pointer">
        {saving ? t('profile_saving') : saved ? t('profile_saved') : t('profile_save')}
      </Button>
    </form>
  );
}
