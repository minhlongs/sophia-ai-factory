import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { localizedHref } from '@/seed/utils/localized-href';

export default async function VideoNotFound() {
  const t = await getTranslations("dashboard.videos.notFound");
  const locale = await getLocale();

  return (
    <div className="container mx-auto p-6 max-w-4xl text-center space-y-3">
      <h2 className="font-semibold">{t("title")}</h2>
      <p className="text-sm text-muted-foreground">{t("description")}</p>
      <Link
        href={localizedHref(locale, "/dashboard/videos")}
        className="inline-flex items-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm min-h-[44px] hover:opacity-90"
      >
        {t("backToGallery")}
      </Link>
    </div>
  );
}
