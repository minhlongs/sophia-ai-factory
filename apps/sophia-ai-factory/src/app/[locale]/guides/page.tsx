import { permanentRedirect } from "next/navigation";

/**
 * /[locale]/guides → /[locale]/guide
 * Server-side redirect using native next/navigation for CF Workers compatibility.
 */
export default async function GuidesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  permanentRedirect(`/${locale}/guide`);
}
