import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/better-auth-session";
import { localizedHref } from "@/lib/i18n/localized-href";
import { VideoGallery } from "./components/video-gallery";

export default async function VideosGalleryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const user = await getCurrentUser();
  const { locale } = await params;
  if (!user) redirect(localizedHref(locale, "/login"));

  const t = await getTranslations("dashboard.videos");

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
      <VideoGallery locale={locale} />
    </div>
  );
}
