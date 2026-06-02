'use client';

/**
 * MarketplaceClient — searchable, filterable card grid for public SOP marketplace.
 *
 * Receives initialTemplates (pre-serialized by server) + supported categories.
 * Client-side filtering is purely cosmetic; server owns the source of truth.
 */

import { useMemo, useState } from 'react';

type Template = {
  id: string;
  title: string;
  category: string;
  ratingAvg: number;
  installCount: number;
  authorName: string;
  thumbnailUrl: string | null;
  tags: string[];
  shortDescription: string;
};

type Props = {
  initialTemplates: Template[];
  categories: readonly string[];
};

function stars(avg: number) {
  const full = Math.floor(avg);
  const half = avg - full >= 0.5;
  return (
    <span className="text-yellow-500">
      {'★'.repeat(full)}
      {half ? '⯪' : ''}
      {'☆'.repeat(5 - full - (half ? 1 : 0))}
    </span>
  );
}

export default function MarketplaceClient({ initialTemplates, categories }: Props) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string>('all');
  const [sort, setSort] = useState<'popular' | 'rating' | 'newest'>('popular');

  const filtered = useMemo(() => {
    let list = initialTemplates;
    if (cat !== 'all') list = list.filter((t) => t.category === cat);
    if (q.trim()) {
      const qq = q.trim().toLowerCase();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(qq) ||
          (t.shortDescription ?? '').toLowerCase().includes(qq) ||
          (t.tags ?? []).some((tag) => tag.toLowerCase().includes(qq)),
      );
    }
    if (sort === 'popular') list = [...list].sort((a, b) => b.installCount - a.installCount);
    if (sort === 'rating') list = [...list].sort((a, b) => b.ratingAvg - a.ratingAvg);
    // 'newest' — initial order is fine (server returns newest-first)
    return list;
  }, [initialTemplates, q, cat, sort]);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          placeholder="Search SOPs…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="flex-1 min-w-[200px] rounded-lg border px-3 py-2 text-sm"
        />
        <select
          value={cat}
          onChange={(e) => setCat(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm"
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {c === 'all' ? 'All categories' : c}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          className="rounded-lg border px-3 py-2 text-sm"
        >
          <option value="popular">Most popular</option>
          <option value="rating">Highest rated</option>
          <option value="newest">Newest</option>
        </select>
      </div>

      {/* Result count */}
      <p className="text-xs text-muted-foreground">
        {filtered.length} template{filtered.length === 1 ? '' : 's'} found
      </p>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
          No SOPs match your filters. Try a different search or category.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => (
            <div
              key={t.id}
              className="rounded-lg border bg-card p-4 flex flex-col gap-2 hover:shadow-md transition-shadow"
            >
              {t.thumbnailUrl && (
                <img
                  src={t.thumbnailUrl}
                  alt=""
                  className="h-32 w-full rounded-md object-cover bg-muted"
                />
              )}
              <div className="text-xs text-muted-foreground">{t.category}</div>
              <h3 className="font-semibold leading-snug">{t.title}</h3>
              <p className="text-xs text-muted-foreground line-clamp-2">
                {t.shortDescription}
              </p>
              <div className="mt-auto flex items-center justify-between text-xs">
                <span>{stars(t.ratingAvg)} {t.ratingAvg.toFixed(1)}</span>
                <span className="text-muted-foreground">{t.installCount} installs</span>
              </div>
              <div className="text-xs text-muted-foreground">by {t.authorName}</div>
              {t.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {t.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-muted px-2 py-0.5 text-[10px]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
