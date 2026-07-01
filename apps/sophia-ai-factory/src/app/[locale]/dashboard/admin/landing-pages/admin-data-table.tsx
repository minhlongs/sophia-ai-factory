'use client';

/**
 * Admin Data Table — displays landing pages with inline toggle + delete actions.
 * Client component for interactivity (publish toggle, delete with confirm).
 */

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { useCsrfToken } from '@/seed/security/use-csrf-token';

interface PageRow {
  id: string;
  nicheLabel: string;
  isPublished: boolean;
  updatedAt: string;
}

interface Props {
  pages: PageRow[];
}

export function AdminDataTable({ pages }: Props) {
  const router = useRouter();
  const csrfHeaders = useCsrfToken();
  const [optimisticPages, setOptimisticPages] = useState<PageRow[]>(pages);
  const [toggling, setToggling] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle(slug: string) {
    const current = optimisticPages.find((p) => p.id === slug);
    if (!current) return;

    const newValue = !current.isPublished;
    setOptimisticPages((prev) =>
      prev.map((p) => (p.id === slug ? { ...p, isPublished: newValue } : p)),
    );
    setError(null);
    setToggling(slug);

    try {
      const res = await fetch(`/api/admin/landing-pages/${slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...csrfHeaders },
        body: JSON.stringify({ isPublished: newValue }),
      });
      if (!res.ok) {
        setOptimisticPages((prev) =>
          prev.map((p) => (p.id === slug ? { ...p, isPublished: !newValue } : p)),
        );
        setError(`Failed to update "${slug}". Please try again.`);
      }
    } catch {
      setOptimisticPages((prev) =>
        prev.map((p) => (p.id === slug ? { ...p, isPublished: !newValue } : p)),
      );
      setError(`Network error updating "${slug}".`);
    } finally {
      setToggling(null);
    }
  }

  async function handleDelete(slug: string) {
    if (!window.confirm(`Delete landing page "${slug}"? This cannot be undone.`)) return;

    setDeleting(slug);
    setError(null);
    try {
      const res = await fetch(`/api/admin/landing-pages/${slug}`, {
        method: 'DELETE',
        headers: { ...csrfHeaders },
      });
      if (res.ok) {
        router.refresh();
      } else {
        setError('Failed to delete. Please try again.');
      }
    } catch {
      setError('Network error deleting page.');
    } finally {
      setDeleting(null);
    }
  }

  function formatDate(dateStr: string): string {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  }

  return (
    <div className="space-y-4">
      {/* Error banner */}
      {error && (
        <div className="p-3 rounded-lg text-sm bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="ml-4 font-bold text-lg leading-none">&times;</button>
        </div>
      )}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Slug</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Niche Label</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Published</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Updated</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {optimisticPages.map((page) => (
              <tr key={page.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                <td className="px-4 py-3 font-mono text-xs text-gray-900 dark:text-white">
                  {page.id}
                </td>
                <td className="px-4 py-3 text-gray-900 dark:text-white">{page.nicheLabel}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    disabled={toggling === page.id}
                    onClick={() => handleToggle(page.id)}
                    className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium transition-colors ${
                      page.isPublished
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                    }`}
                  >
                    {page.isPublished ? 'Live' : 'Draft'}
                  </button>
                </td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                  {formatDate(page.updatedAt)}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      href={`/dashboard/admin/landing-pages/${page.id}`}
                      className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </Link>
                    <button
                      type="button"
                      disabled={deleting === page.id}
                      onClick={() => handleDelete(page.id)}
                      className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {optimisticPages.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                  No landing pages yet.{' '}
                  <Link href="/dashboard/admin/landing-pages/new" className="text-blue-600 hover:underline">
                    Create your first page
                  </Link>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
