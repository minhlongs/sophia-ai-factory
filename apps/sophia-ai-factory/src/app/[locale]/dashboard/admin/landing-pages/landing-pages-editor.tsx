'use client';

/**
 * Landing Pages Editor — client form for create/edit/delete of niche pages.
 *
 * Handles both create (initialData=null) and edit (initialData populated) modes.
 * Features and FAQ are edited as JSON textareas with validation on blur.
 */

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Save, Trash2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import type { LandingPage } from '@/seed/types/landing-page-types';
import { useCsrfToken } from '@/seed/security/use-csrf-token';

interface Props {
  locale: string;
  initialData: LandingPage | null;
}

interface FormErrors {
  [key: string]: string;
}

const DEFAULT_FEATURES = JSON.stringify(
  [
    { icon: 'zap', title_en: '', title_vi: '', desc_en: '', desc_vi: '' },
    { icon: 'star', title_en: '', title_vi: '', desc_en: '', desc_vi: '' },
    { icon: 'check', title_en: '', title_vi: '', desc_en: '', desc_vi: '' },
  ],
  null,
  2,
);

const DEFAULT_FAQ = JSON.stringify(
  [
    { question_en: '', question_vi: '', answer_en: '', answer_vi: '' },
    { question_en: '', question_vi: '', answer_en: '', answer_vi: '' },
    { question_en: '', question_vi: '', answer_en: '', answer_vi: '' },
  ],
  null,
  2,
);

export function LandingPagesEditor({ locale: _locale, initialData }: Props) {
  const router = useRouter();
  const csrfHeaders = useCsrfToken();
  const isCreate = !initialData;

  const [slug, setSlug] = useState(initialData?.id ?? '');
  const [nicheLabel, setNicheLabel] = useState(initialData?.nicheLabel ?? '');
  const [heroTitleEn, setHeroTitleEn] = useState(initialData?.heroTitleEn ?? '');
  const [heroTitleVi, setHeroTitleVi] = useState(initialData?.heroTitleVi ?? '');
  const [heroSubEn, setHeroSubEn] = useState(initialData?.heroSubEn ?? '');
  const [heroSubVi, setHeroSubVi] = useState(initialData?.heroSubVi ?? '');
  const [featuresJson, setFeaturesJson] = useState(
    initialData?.features?.length
      ? JSON.stringify(initialData.features, null, 2)
      : DEFAULT_FEATURES,
  );
  const [faqJson, setFaqJson] = useState(
    initialData?.faq?.length
      ? JSON.stringify(initialData.faq, null, 2)
      : DEFAULT_FAQ,
  );
  const [metaTitleEn, setMetaTitleEn] = useState(initialData?.metaTitleEn ?? '');
  const [metaTitleVi, setMetaTitleVi] = useState(initialData?.metaTitleVi ?? '');
  const [metaDescEn, setMetaDescEn] = useState(initialData?.metaDescEn ?? '');
  const [metaDescVi, setMetaDescVi] = useState(initialData?.metaDescVi ?? '');
  const [isPublished, setIsPublished] = useState(initialData?.isPublished ?? false);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  function validateJson(value: string, fieldName: string): boolean {
    try {
      JSON.parse(value);
      setErrors((prev) => {
        const next = { ...prev };
        delete next[fieldName];
        return next;
      });
      return true;
    } catch {
      setErrors((prev) => ({ ...prev, [fieldName]: `Invalid JSON: ${fieldName}` }));
      return false;
    }
  }

  function validate(): boolean {
    const newErrors: FormErrors = {};
    if (!slug.trim()) newErrors.slug = 'Slug is required';
    if (!nicheLabel.trim()) newErrors.nicheLabel = 'Niche label is required';
    if (!validateJson(featuresJson, 'features')) newErrors.features = 'Invalid JSON';
    if (!validateJson(faqJson, 'faq')) newErrors.faq = 'Invalid JSON';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    setStatusMsg(null);

    try {
      const body = {
        id: slug.trim(),
        nicheLabel: nicheLabel.trim(),
        heroTitleEn: heroTitleEn.trim() || undefined,
        heroTitleVi: heroTitleVi.trim() || undefined,
        heroSubEn: heroSubEn.trim() || undefined,
        heroSubVi: heroSubVi.trim() || undefined,
        features: JSON.parse(featuresJson),
        faq: JSON.parse(faqJson),
        metaTitleEn: metaTitleEn.trim() || undefined,
        metaTitleVi: metaTitleVi.trim() || undefined,
        metaDescEn: metaDescEn.trim() || undefined,
        metaDescVi: metaDescVi.trim() || undefined,
        isPublished,
      };

      const url = isCreate
        ? '/api/admin/landing-pages'
        : `/api/admin/landing-pages/${slug}`;
      const method = isCreate ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...csrfHeaders },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setStatusMsg({ type: 'success', text: isCreate ? 'Page created!' : 'Page saved!' });
        if (isCreate) {
          router.push(`/dashboard/admin/landing-pages/${slug}`);
        }
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({ error: 'Unknown error' })) as { error?: string };
        setStatusMsg({ type: 'error', text: data.error ?? 'Save failed' });
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: err instanceof Error ? err.message : 'Save failed' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Permanently delete "${slug}"? This cannot be undone.`)) return;

    setDeleting(true);
    setStatusMsg(null);

    try {
      const res = await fetch(`/api/admin/landing-pages/${slug}`, {
        method: 'DELETE',
        headers: { ...csrfHeaders },
      });
      if (res.ok) {
        router.push('/dashboard/admin/landing-pages');
        router.refresh();
      } else {
        setStatusMsg({ type: 'error', text: 'Delete failed' });
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: err instanceof Error ? err.message : 'Delete failed' });
    } finally {
      setDeleting(false);
    }
  }

  function field(label: string, children: React.ReactNode, errorKey?: string) {
    return (
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
        {children}
        {errorKey && errors[errorKey] && (
          <p className="text-xs text-red-600 mt-1">{errors[errorKey]}</p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-8 max-w-3xl">
      {/* Back + title */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/admin/landing-pages"
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-700 dark:text-gray-400 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            {isCreate ? 'Create New Landing Page' : `Edit: ${initialData?.nicheLabel}`}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {isCreate ? 'Fill in the bilingual content for a new niche page.' : `Slug: ${slug}`}
          </p>
        </div>
      </div>

      {/* Status message */}
      {statusMsg && (
        <div
          className={`p-3 rounded-lg text-sm ${
            statusMsg.type === 'success'
              ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
              : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
          }`}
        >
          {statusMsg.text}
        </div>
      )}

      {/* Basic info */}
      <div className="grid grid-cols-2 gap-4">
        {field(
          'Slug',
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            disabled={!isCreate}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm disabled:opacity-50"
            placeholder="e.g., real-estate"
          />,
          'slug',
        )}
        {field(
          'Niche Label',
          <input
            type="text"
            value={nicheLabel}
            onChange={(e) => setNicheLabel(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
            placeholder="e.g., Real Estate / Bất Động Sản"
          />,
          'nicheLabel',
        )}
      </div>

      {/* Hero section */}
      <fieldset className="border border-gray-200 dark:border-gray-700 rounded-xl p-6 space-y-4">
        <legend className="text-sm font-semibold text-gray-900 dark:text-white px-2">Hero Section</legend>
        <div className="grid grid-cols-2 gap-4">
          {field('Hero Title (EN)', <input type="text" value={heroTitleEn} onChange={(e) => setHeroTitleEn(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm" />)}
          {field('Hero Title (VI)', <input type="text" value={heroTitleVi} onChange={(e) => setHeroTitleVi(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm" />)}
          {field('Hero Subtitle (EN)', <input type="text" value={heroSubEn} onChange={(e) => setHeroSubEn(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm" />)}
          {field('Hero Subtitle (VI)', <input type="text" value={heroSubVi} onChange={(e) => setHeroSubVi(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm" />)}
        </div>
      </fieldset>

      {/* Features JSON */}
      {field(
        'Features (JSON array)',
        <textarea
          value={featuresJson}
          onChange={(e) => setFeaturesJson(e.target.value)}
          onBlur={() => validateJson(featuresJson, 'features')}
          rows={10}
          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-mono"
          placeholder='[{"icon":"zap","title_en":"...","title_vi":"...","desc_en":"...","desc_vi":"..."}]'
        />,
        'features',
      )}

      {/* FAQ JSON */}
      {field(
        'FAQ (JSON array)',
        <textarea
          value={faqJson}
          onChange={(e) => setFaqJson(e.target.value)}
          onBlur={() => validateJson(faqJson, 'faq')}
          rows={10}
          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-mono"
          placeholder='[{"question_en":"...","question_vi":"...","answer_en":"...","answer_vi":"..."}]'
        />,
        'faq',
      )}

      {/* Meta section */}
      <fieldset className="border border-gray-200 dark:border-gray-700 rounded-xl p-6 space-y-4">
        <legend className="text-sm font-semibold text-gray-900 dark:text-white px-2">SEO Metadata</legend>
        <div className="grid grid-cols-2 gap-4">
          {field('Meta Title (EN)', <input type="text" value={metaTitleEn} onChange={(e) => setMetaTitleEn(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm" />)}
          {field('Meta Title (VI)', <input type="text" value={metaTitleVi} onChange={(e) => setMetaTitleVi(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm" />)}
          {field('Meta Description (EN)', <textarea value={metaDescEn} onChange={(e) => setMetaDescEn(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm" />)}
          {field('Meta Description (VI)', <textarea value={metaDescVi} onChange={(e) => setMetaDescVi(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm" />)}
        </div>
      </fieldset>

      {/* Publish toggle */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="isPublished"
          checked={isPublished}
          onChange={(e) => setIsPublished(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300"
        />
        <label htmlFor="isPublished" className="text-sm text-gray-700 dark:text-gray-300">
          Published (visible to search engines and users)
        </label>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 bg-primary hover:bg-primary/80 disabled:opacity-50 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : isCreate ? 'Create Page' : 'Save Changes'}
        </button>

        {!isCreate && (
          <button
            type="button"
            disabled={deleting}
            onClick={handleDelete}
            className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            {deleting ? 'Deleting...' : 'Delete Page'}
          </button>
        )}
      </div>
    </form>
  );
}
