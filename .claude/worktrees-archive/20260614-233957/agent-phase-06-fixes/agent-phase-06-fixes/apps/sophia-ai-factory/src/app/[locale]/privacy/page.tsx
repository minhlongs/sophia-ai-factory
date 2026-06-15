import { getTranslations } from "next-intl/server";

export const revalidate = 60;

export async function generateMetadata() {
  const t = await getTranslations("privacy");
  return {
    title: t("meta_title"),
    description: t("meta_description"),
  };
}

export default async function PrivacyPage() {
  const t = await getTranslations("privacy");

  return (
    <main id="main-content" className="min-h-screen bg-black pt-24 pb-16">
      <div className="mx-auto max-w-3xl px-6 space-y-8">
        <h1 className="text-3xl font-bold text-foreground">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("last_updated")}</p>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">{t("section1_title")}</h2>
          <p className="text-muted-foreground">{t("section1_body")}</p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">{t("section2_title")}</h2>
          <p className="text-muted-foreground">{t("section2_body")}</p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">{t("section3_title")}</h2>
          <p className="text-muted-foreground">{t("section3_body")}</p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">{t("section4_title")}</h2>
          <p className="text-muted-foreground">{t("section4_body")}</p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">{t("section5_title")}</h2>
          <p className="text-muted-foreground">{t("section5_body")}</p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">{t("section6_title")}</h2>
          <p className="text-muted-foreground">{t("section6_body")}</p>
        </section>
      </div>
    </main>
  );
}
