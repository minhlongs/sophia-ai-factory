'use client';

import React from 'react';
import { LISTING_CATEGORIES, type ListingFormInitialData } from './types';

interface FormFieldsProps {
  initialData?: ListingFormInitialData;
  t: (key: string) => string;
}

export function FormFields({ initialData, t }: FormFieldsProps) {
  return (
    <>
      {/* Title */}
      <div>
        <label
          htmlFor="title"
          className="mb-1 block text-sm font-medium text-foreground"
        >
          {t('title')}
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          defaultValue={initialData?.title}
          placeholder={t('titlePlaceholder')}
          className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {/* Description */}
      <div>
        <label
          htmlFor="description"
          className="mb-1 block text-sm font-medium text-foreground"
        >
          {t('bio')}
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={initialData?.description}
          placeholder={t('bioPlaceholder')}
          className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {/* Category */}
      <div>
        <label
          htmlFor="category"
          className="mb-1 block text-sm font-medium text-foreground"
        >
          {t('category')}
        </label>
        <select
          id="category"
          name="category"
          defaultValue={initialData?.category}
          className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">{t('categoryPlaceholder')}</option>
          {LISTING_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      {/* SOP Template ID */}
      <div>
        <label
          htmlFor="sopTemplateId"
          className="mb-1 block text-sm font-medium text-foreground"
        >
          {t('sopTemplate')}
        </label>
        <input
          id="sopTemplateId"
          name="sopTemplateId"
          type="text"
          required
          defaultValue={initialData?.sopTemplateId}
          className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {/* Thumbnail URL */}
      <div>
        <label
          htmlFor="thumbnailUrl"
          className="mb-1 block text-sm font-medium text-foreground"
        >
          {t('thumbnail')}
        </label>
        <input
          id="thumbnailUrl"
          name="thumbnailUrl"
          type="text"
          defaultValue={initialData?.thumbnailUrl}
          className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
    </>
  );
}
