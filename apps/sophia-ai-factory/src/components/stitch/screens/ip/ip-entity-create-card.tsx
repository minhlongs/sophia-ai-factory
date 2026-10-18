'use client';

// i18n-namespace: dashboard.ip
import React from 'react';
import { Plus } from 'lucide-react';
import { Card, Button, Input } from '@/components/stitch/ui';

export interface IpEntity {
  id: string;
  workspaceId: string;
  type: string;
  name: string;
  description: string;
  status: string;
  parentId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface IpEntityFormState {
  type: string;
  name: string;
  description: string;
  parentId: string;
}

export interface IpEntityCreateCardProps {
  form: IpEntityFormState;
  setForm: React.Dispatch<React.SetStateAction<IpEntityFormState>>;
  creating: boolean;
  onSubmit: (e: React.FormEvent) => void;
  t: (key: string) => string;
}

export function IpEntityCreateCard({
  form,
  setForm,
  creating,
  onSubmit,
  t,
}: IpEntityCreateCardProps) {
  return (
    <Card padding="lg" className="mt-6">
      <h2 className="text-title-lg">{t('create.title')}</h2>
      <p className="mt-1 text-body-sm text-on-surface-variant">{t('create.subtitle')}</p>
      <form className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={onSubmit}>
        <div>
          <label className="mb-1 block text-label-sm text-on-surface-variant">
            {t('create.type')}
          </label>
          <select
            className="w-full rounded-lg border border-outline bg-surface px-3 py-2 text-body-sm"
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
          >
            <option value="universe">{t('type.universe')}</option>
            <option value="world">{t('type.world')}</option>
            <option value="series">{t('type.series')}</option>
            <option value="character">{t('type.character')}</option>
            <option value="theme">{t('type.theme')}</option>
            <option value="brand">{t('type.brand')}</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-label-sm text-on-surface-variant">
            {t('create.name')}
          </label>
          <Input
            placeholder={t('create.namePlaceholder')}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-label-sm text-on-surface-variant">
            {t('create.description')}
          </label>
          <Input
            placeholder={t('create.descriptionPlaceholder')}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </div>
        <div>
          <label className="mb-1 block text-label-sm text-on-surface-variant">
            {t('create.parent')}
          </label>
          <Input
            placeholder={t('create.parentPlaceholder')}
            value={form.parentId}
            onChange={(e) => setForm((f) => ({ ...f, parentId: e.target.value }))}
          />
        </div>
        <div className="flex items-end">
          <Button type="submit" variant="primary" loading={creating}>
            <Plus className="h-4 w-4" />
            {t('create.submit')}
          </Button>
        </div>
      </form>
    </Card>
  );
}
