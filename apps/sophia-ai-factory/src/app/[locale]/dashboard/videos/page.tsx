import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/seed/auth/better-auth-session";
import { localizedHref } from "@/land/i18n/localized-href";
import { VideoGallery } from "./components/video-gallery";
import { EmptyState } from "@/seed/components/ui/empty-state";
import { Video } from "lucide-react";

function getD1(): D1Database | null {
  try {
    const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
    if (env?.DB) return env.DB as D1Database;
    const ctx = (globalThis as Record<symbol, { env?: Record<string, unknown> }>)[Symbol.for('__cloudflare-context__')];
    if (ctx?.env?.DB) return ctx.env.DB as D1Database;
    return null;
  } catch { return null; }
}

export default async function VideosGalleryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const user = await getCurrentUser();
  const { locale } = await params;
  if (!user) redirect(localizedHref(locale, "/login"));

  const [t, tEmpty] = await Promise.all([
    getTranslations("dashboard.videos"),
    getTranslations("dashboard.emptyState.videos"),
  ]);

  // Pre-fetch count to decide empty state at SSR level
  let videoCount = -1; // -1 = unknown (D1 unavailable) — fall back to VideoGallery
  const d1 = getD1();
  if (d1) {
    try {
      const row = await d1
        .prepare('SELECT COUNT(*) as cnt FROM videos WHERE user_id = ?')
        .bind(user.id)
        .first<{ cnt: number }>();
      videoCount = row?.cnt ?? 0;
    } catch {
      // D1 unavailable — let VideoGallery handle it
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Link
          href={localizedHref(locale, "/dashboard/videos/new")}
          className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 min-h-[44px] inline-flex items-center"
        >
          {t("newVideo")}
        </Link>
      </header>

      {videoCount === 0 ? (
        <EmptyState
          icon={Video}
          title={tEmpty("title")}
          description={tEmpty("description")}
          cta={{
            label: tEmpty("cta"),
            href: localizedHref(locale, "/dashboard/videos/new"),
          }}
        />
      ) : (
        <VideoGallery locale={locale} />
      )}
    </div>
  );
}
