import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/seed/auth/better-auth-session";
import { localizedHref } from "@/lib/i18n/localized-href";
import { VideoCreatorWizard } from "./components/video-creator-wizard";

export const dynamic = "force-dynamic";

export default async function NewVideoPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const user = await getCurrentUser();
  const { locale } = await params;
  if (!user) redirect(localizedHref(locale, "/login"));

  const t = await getTranslations("dashboard.videos");

  return (
    <div className="container mx-auto py-8 max-w-3xl">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">{t("create.title")}</h1>
        <p className="text-muted-foreground mt-2">{t("create.subtitle")}</p>
      </header>
      <VideoCreatorWizard />
    </div>
  );
}
