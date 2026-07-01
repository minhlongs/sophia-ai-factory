import { redirect } from "@/navigation";

/**
 * /[locale]/guides → /[locale]/guide
 * Server-side locale-aware redirect for the plural "guides" URL.
 */
export default async function GuidesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect({ href: "/guide", locale });
}
